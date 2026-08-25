#!/usr/bin/env node
'use strict';

/*
 * Execute one frozen Q-Shape metamorphic stream.  This worker intentionally
 * consumes the manifested cases document; generation belongs to the separate
 * preregistration tool and is not part of the execution boundary.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
    buildReferenceInventory,
    float64Hex,
    loadQShape
} = require('./direct-parity-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const CAMPAIGN_CASES_SHA256 =
    '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd';
const EXPECTED_SCHEMA_VERSION = 1;
const EXPECTED_REFERENCE_COUNT = 87;
const EXPECTED_CASE_COUNT = 2871;
const EXPECTED_MATCHED_TARGET_ROWS = 28545;
const EXPECTED_MAIN_CASE_COUNT = 2610;
const EXPECTED_ADVERSARIAL_CASE_COUNT = 261;
const EXPECTED_SEEDS = Object.freeze([0, 0x51534850, 0xffffffff]);
const EXPECTED_STREAMS = Object.freeze([
    'q_primary_input_derived_r1',
    'q_primary_input_derived_r2',
    'q_explicit_seed_0',
    'q_explicit_seed_1364412496',
    'q_explicit_seed_4294967295'
]);
const UINT32_MAX = 0xffffffff;
const FIXED15_TOKEN = /^[+-]?\d+\.\d{15}$/;
const BINARY64_TOKEN = value => Object.is(value, -0) ? '-0' : value.toPrecision(17);
const PAIR_SEPARATOR = '\u0000';
const RUNTIME_IDENTITY_KIND = 'qshape-node-runtime-v1';
const IN_PROCESS_MODEL = 'in_process_runner';

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
    return sha256Buffer(fs.readFileSync(filePath));
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    }
    return value;
}

function runtimeIdentitySha256(identity) {
    return sha256Buffer(Buffer.from(JSON.stringify(stable(identity)), 'utf8'));
}

function captureWorkerRuntimeIdentity(repoRoot, processModel = IN_PROCESS_MODEL) {
    const executablePath = fs.realpathSync.native(path.resolve(process.execPath));
    const executableStat = fs.statSync(executablePath);
    const packageLockPath = path.resolve(repoRoot, 'package-lock.json');
    if (!executableStat.isFile() || !fs.statSync(packageLockPath).isFile()) {
        throw new Error('Q-Shape worker runtime or package-lock boundary is not a regular file');
    }
    const intl = Intl.DateTimeFormat().resolvedOptions();
    const identity = {
        schema_version: 1,
        identity_kind: RUNTIME_IDENTITY_KIND,
        process_model: processModel,
        node_version: process.version,
        node_versions_node: process.versions.node,
        v8_version: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
        node_executable_path: executablePath,
        node_executable_sha256: sha256File(executablePath),
        node_executable_size_bytes: executableStat.size,
        intl_locale: intl.locale || null,
        intl_time_zone: intl.timeZone || null,
        environment_locale: {
            lc_all: process.env.LC_ALL || null,
            lang: process.env.LANG || null,
            language: process.env.LANGUAGE || null
        },
        environment_time_zone: process.env.TZ || null,
        dependency_lockfile: {
            path: 'package-lock.json',
            sha256: sha256File(packageLockPath)
        }
    };
    return { identity, identitySha256: runtimeIdentitySha256(identity) };
}

function readJson(filePath, label) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        throw new Error(`${label} is not a regular file: ${resolved}`);
    }
    let document;
    try {
        document = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}`);
    }
    return { path: resolved, document };
}

function parseUnsigned32(value, label) {
    if (typeof value !== 'string' || !/^(?:\d+|0x[0-9a-f]+)$/i.test(value)) {
        throw new Error(`${label} must be an unsigned 32-bit integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > UINT32_MAX) {
        throw new Error(`${label} must be an unsigned 32-bit integer`);
    }
    return parsed >>> 0;
}

function parsePositiveInteger(value, label) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new Error(`${label} must be a positive integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error(`${label} must be a positive integer`);
    }
    return parsed;
}

function parseArguments(argv) {
    const options = {
        output: null,
        cases: null,
        references: null,
        repo: REPO_ROOT,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        repetition: null,
        stream: null,
        shardIndex: 0,
        shardCount: 1,
        help: false
    };
    let explicitSeedSeen = false;
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${token} requires a value`);
            return argv[++index];
        };
        if (token === '--output') options.output = next();
        else if (token === '--cases') options.cases = next();
        else if (token === '--references') options.references = next();
        else if (token === '--repo') options.repo = next();
        else if (token === '--seed-policy') options.seedPolicy = next();
        else if (token === '--explicit-seed') {
            if (explicitSeedSeen) throw new Error('--explicit-seed may be supplied only once');
            explicitSeedSeen = true;
            // Keep the presence bit separate from the numeric value: `0` is a
            // real explicit seed, not the input-derived/absent-seed mode.
            options.explicitSeed = parseUnsigned32(next(), '--explicit-seed');
        } else if (token === '--repetition') options.repetition = parsePositiveInteger(next(), '--repetition');
        else if (token === '--stream') options.stream = next();
        else if (token === '--shard-index') options.shardIndex = parseNonNegativeInteger(next(), '--shard-index');
        else if (token === '--shard-count') options.shardCount = parsePositiveInteger(next(), '--shard-count');
        else if (token === '--help' || token === '-h') options.help = true;
        else throw new Error(`Unknown argument: ${token}`);
    }

    if (options.help) return options;
    if (!options.output) throw new Error('--output is required');
    if (!options.cases) throw new Error('--cases is required');
    if (!options.references && !options.repo) {
        throw new Error('--references or --repo is required');
    }
    if (!['input-derived', 'explicit'].includes(options.seedPolicy)) {
        throw new Error('--seed-policy must be input-derived or explicit');
    }
    if (options.seedPolicy === 'explicit' && !explicitSeedSeen) {
        throw new Error('--explicit-seed is required for explicit seed policy');
    }
    if (options.seedPolicy === 'input-derived' && explicitSeedSeen) {
        throw new Error('--explicit-seed is forbidden for input-derived seed policy');
    }
    if (!Number.isInteger(options.repetition) || options.repetition < 1) {
        throw new Error('--repetition must be a positive integer');
    }
    if (options.shardIndex >= options.shardCount) {
        throw new Error('--shard-index must be less than --shard-count');
    }
    if (options.seedPolicy === 'explicit' && options.repetition !== 1) {
        throw new Error('Explicit seed streams require --repetition 1');
    }
    const expectedStream = options.seedPolicy === 'explicit'
        ? `q_explicit_seed_${options.explicitSeed}`
        : `q_primary_input_derived_r${options.repetition}`;
    if (!EXPECTED_STREAMS.includes(expectedStream)) {
        throw new Error(`Unsupported frozen Q-Shape stream: ${expectedStream}`);
    }
    if (options.stream !== null && options.stream !== expectedStream) {
        throw new Error(`--stream must be ${expectedStream} for this seed policy`);
    }
    options.stream = options.stream || expectedStream;
    return options;
}

function parseNonNegativeInteger(value, label) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return parsed;
}

function canonicalValueToken(value) {
    if (typeof value !== 'number') throw new Error(`Result is not a number: ${value}`);
    if (Number.isFinite(value)) return BINARY64_TOKEN(value);
    if (Number.isNaN(value)) return 'NaN';
    return value > 0 ? 'Infinity' : '-Infinity';
}

function runtimeToken(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error(`Invalid runtime: ${milliseconds}`);
    }
    return milliseconds.toFixed(6);
}

function pairKey(caseId, targetCode) {
    return `${caseId}${PAIR_SEPARATOR}${targetCode}`;
}

function assertFixed15Tokens(tokens, context) {
    if (!Array.isArray(tokens)) throw new Error(`${context} must be an array`);
    return tokens.map((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 3 ||
            point.some(token => typeof token !== 'string' || !FIXED15_TOKEN.test(token))) {
            throw new Error(`Invalid fixed15 ligand token at ${context}/${pointIndex + 1}`);
        }
        const values = point.map(token => Number(token));
        if (values.some(value => !Number.isFinite(value))) {
            throw new Error(`Non-finite fixed15 ligand token at ${context}/${pointIndex + 1}`);
        }
        return { tokens: point, values };
    });
}

function assertTargetCoordinates(reference, context) {
    const roundtrip = reference.qshape_reference_coordinate_roundtrip_tokens;
    const float64 = reference.qshape_reference_coordinate_float64_hex;
    if (!Array.isArray(roundtrip) || !Array.isArray(float64) ||
        roundtrip.length !== reference.cn + 1 || float64.length !== reference.cn + 1) {
        throw new Error(`Invalid target coordinate count for ${context}`);
    }
    const coordinates = roundtrip.map((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 3 ||
            !Array.isArray(float64[pointIndex]) || float64[pointIndex].length !== 3) {
            throw new Error(`Invalid target coordinate point for ${context}/${pointIndex + 1}`);
        }
        return point.map((token, axis) => {
            if (typeof token !== 'string') throw new Error(`Invalid target token for ${context}`);
            const value = Number(token);
            const canonical = Number.isFinite(value) ? BINARY64_TOKEN(value) : null;
            if (!Number.isFinite(value) || token !== canonical ||
                !/^[0-9a-f]{16}$/.test(float64[pointIndex][axis]) ||
                float64Hex(value) !== float64[pointIndex][axis]) {
                throw new Error(`Invalid target binary64 evidence for ${context}`);
            }
            return value;
        });
    });
    return { coordinates, coordinateRoundtripTokens: roundtrip, coordinateFloat64Hex: float64 };
}

function normalizeReferenceDocument(referencesDocument) {
    if (!referencesDocument || referencesDocument.schema_version !== 2 ||
        referencesDocument.count !== EXPECTED_REFERENCE_COUNT ||
        !Array.isArray(referencesDocument.by_cn) || referencesDocument.by_cn.length !== 11) {
        throw new Error('Invalid frozen reference inventory for metamorphic campaign');
    }
    const inventory = referencesDocument.by_cn.map(group => {
        if (!Number.isInteger(group.cn) || !Array.isArray(group.references) ||
            group.count !== group.references.length) {
            throw new Error(`Invalid frozen reference group CN=${group.cn}`);
        }
        const seenCodes = new Set();
        const targets = group.references.map((reference, offset) => {
            if (seenCodes.has(reference.qshape_code)) {
                throw new Error(`Duplicate frozen target ${reference.qshape_code}`);
            }
            seenCodes.add(reference.qshape_code);
            const ordinal = reference.qshape_index;
            if (ordinal !== offset + 1 || reference.qshape_code === undefined) {
                throw new Error(`Target ordinal mismatch for CN=${group.cn}/${reference.qshape_code}`);
            }
            const coordinateEvidence = assertTargetCoordinates(
                { ...reference, cn: group.cn },
                `CN=${group.cn}/${reference.qshape_code}`
            );
            return {
                code: reference.qshape_code,
                ordinal,
                cn: group.cn,
                ...coordinateEvidence
            };
        });
        return { cn: group.cn, count: targets.length, targets };
    });
    if (inventory.reduce((sum, group) => sum + group.count, 0) !== EXPECTED_REFERENCE_COUNT) {
        throw new Error('Frozen reference census is not 87');
    }
    return inventory;
}

function sourceReferenceDocument(repoRoot) {
    const { referenceGeometries } = loadQShape(repoRoot);
    const inventory = buildReferenceInventory(referenceGeometries);
    return inventory.map(group => ({
        cn: group.cn,
        count: group.count,
        targets: group.targets.map(target => ({
            code: target.code,
            ordinal: target.index,
            cn: target.cn,
            coordinates: target.coordinates,
            coordinateRoundtripTokens: target.coordinates.map(point =>
                point.map(value => Object.is(value, -0) ? '-0' : value.toPrecision(17))
            ),
            coordinateFloat64Hex: target.coordinates.map(point => point.map(float64Hex))
        }))
    }));
}

function parseFrozenCases(casesDocument, casesPath) {
    if (!casesDocument || casesDocument.schema_version !== EXPECTED_SCHEMA_VERSION ||
        casesDocument.campaign_id !== CAMPAIGN_ID ||
        casesDocument.reference_count !== EXPECTED_REFERENCE_COUNT ||
        casesDocument.count !== EXPECTED_CASE_COUNT ||
        casesDocument.main_case_count !== EXPECTED_MAIN_CASE_COUNT ||
        casesDocument.adversarial_positive_case_count !== EXPECTED_ADVERSARIAL_CASE_COUNT ||
        casesDocument.expected_matched_target_evaluations_per_program !== EXPECTED_MATCHED_TARGET_ROWS ||
        !Array.isArray(casesDocument.cases) || casesDocument.cases.length !== EXPECTED_CASE_COUNT) {
        throw new Error('Frozen metamorphic cases do not match the preregistered identity');
    }
    if (sha256File(casesPath) !== CAMPAIGN_CASES_SHA256) {
        throw new Error(`Frozen cases SHA-256 does not match ${CAMPAIGN_CASES_SHA256}`);
    }
    if (JSON.stringify(casesDocument.explicit_seed_sensitivity_uint32) !==
        JSON.stringify(EXPECTED_SEEDS)) {
        throw new Error('Frozen explicit sensitivity seed list changed');
    }
    const seenCaseIds = new Set();
    const cases = casesDocument.cases.map((item, caseOrdinal) => {
        if (!item || typeof item.case_id !== 'string' || !item.case_id ||
            seenCaseIds.has(item.case_id)) {
            throw new Error(`Duplicate or invalid frozen case ID at ordinal ${caseOrdinal}`);
        }
        seenCaseIds.add(item.case_id);
        if (!Number.isInteger(item.cn) || item.cn < 2 || item.cn > 12) {
            throw new Error(`Invalid frozen CN for ${item.case_id}`);
        }
        const ligandEvidence = assertFixed15Tokens(
            item.qshape_actual_ligand_tokens,
            item.case_id
        );
        if (ligandEvidence.length !== item.cn) {
            throw new Error(`Frozen ligand count mismatch for ${item.case_id}`);
        }
        if (!Number.isInteger(item.parent_reference_index) ||
            typeof item.parent_reference_code !== 'string') {
            throw new Error(`Frozen parent reference binding missing for ${item.case_id}`);
        }
        return {
            caseId: item.case_id,
            caseOrdinal,
            stratum: item.stratum,
            cn: item.cn,
            ligandTokens: ligandEvidence.map(item => item.tokens),
            actualLigands: ligandEvidence.map(item => item.values),
            parentReferenceCode: item.parent_reference_code,
            parentReferenceIndex: item.parent_reference_index
        };
    });
    const main = cases.filter(item => item.stratum === 'metamorphic_main').length;
    const adversarial = cases.filter(item => item.stratum === 'adversarial_positive').length;
    if (main !== EXPECTED_MAIN_CASE_COUNT || adversarial !== EXPECTED_ADVERSARIAL_CASE_COUNT) {
        throw new Error('Frozen metamorphic case strata counts changed');
    }
    return cases;
}

function bindCasesToInventory(cases, inventory) {
    const byCn = new Map(inventory.map(group => [group.cn, group]));
    const perReference = new Map();
    for (const item of cases) {
        const group = byCn.get(item.cn);
        if (!group) throw new Error(`No target inventory for ${item.caseId} CN=${item.cn}`);
        const target = group.targets.find(candidate =>
            candidate.code === item.parentReferenceCode &&
            candidate.ordinal === item.parentReferenceIndex
        );
        if (!target) {
            throw new Error(`Frozen parent reference mismatch for ${item.caseId}`);
        }
        const key = `${item.cn}\u0000${item.parentReferenceCode}`;
        perReference.set(key, (perReference.get(key) || 0) + 1);
    }
    if (perReference.size !== EXPECTED_REFERENCE_COUNT ||
        [...perReference.values()].some(value => value !== 33)) {
        throw new Error('Frozen campaign does not contain exactly 33 cases per reference');
    }
    const matched = cases.reduce((sum, item) =>
        sum + byCn.get(item.cn).targets.length, 0);
    if (matched !== EXPECTED_MATCHED_TARGET_ROWS) {
        throw new Error(`Frozen matched-target census ${matched} is not ${EXPECTED_MATCHED_TARGET_ROWS}`);
    }
    return byCn;
}

function selectCaseShard(cases, shardIndex, shardCount) {
    return cases.filter((_, caseOrdinal) => caseOrdinal % shardCount === shardIndex);
}

function inputFingerprint(item, target, seedPolicy, explicitSeed) {
    const contract = {
        schema_version: 1,
        case_id: item.caseId,
        cn: item.cn,
        qshape_ligand_fixed15_tokens: item.ligandTokens,
        target_code: target.code,
        target_reference_binary64_roundtrip_tokens: target.coordinateRoundtripTokens,
        target_reference_float64_hex: target.coordinateFloat64Hex,
        mode: 'default',
        seed_policy: seedPolicy,
        explicit_seed_uint32: explicitSeed
    };
    return sha256Buffer(Buffer.from(JSON.stringify(contract), 'utf8'));
}

function expectedPairKeys(selectedCases, inventoryByCn) {
    const keys = [];
    for (const item of selectedCases) {
        const group = inventoryByCn.get(item.cn);
        for (const target of group.targets) keys.push(pairKey(item.caseId, target.code));
    }
    return keys;
}

function validateRows(rows, expectedKeys) {
    if (!Array.isArray(rows)) throw new Error('Q-Shape worker rows are not an array');
    if (rows.length !== expectedKeys.length) {
        throw new Error(`Q-Shape worker emitted ${rows.length} rows; expected ${expectedKeys.length}`);
    }
    const expected = new Set(expectedKeys);
    const observed = new Set();
    for (const row of rows) {
        const key = pairKey(row?.caseId, row?.targetCode);
        if (!expected.has(key)) throw new Error(`Unknown Q-Shape case-target key: ${key}`);
        if (observed.has(key)) throw new Error(`Duplicate Q-Shape case-target key: ${key}`);
        observed.add(key);
    }
    if (observed.size !== expected.size) {
        const missing = expectedKeys.filter(key => !observed.has(key)).slice(0, 5);
        throw new Error(`Missing Q-Shape case-target key(s): ${missing.join(', ')}`);
    }
    return rows;
}

function runWorker(options, dependencies = {}) {
    const executionProcess = options.executionProcess || 'standalone_worker_cli';
    const observedRuntime = captureWorkerRuntimeIdentity(path.resolve(options.repo), executionProcess);
    if (options.runtimeIdentity || options.runtimeIdentitySha256) {
        if (executionProcess !== IN_PROCESS_MODEL ||
            JSON.stringify(stable(options.runtimeIdentity)) !== JSON.stringify(stable(observedRuntime.identity)) ||
            options.runtimeIdentitySha256 !== observedRuntime.identitySha256) {
            throw new Error('Q-Shape worker runtime does not match the in-process runner identity');
        }
    }
    const casesFile = readJson(options.cases, 'Frozen metamorphic cases');
    const cases = parseFrozenCases(casesFile.document, casesFile.path);
    let referencesFile = null;
    let inventory;
    if (options.references) {
        referencesFile = readJson(options.references, 'Frozen reference inventory');
        inventory = normalizeReferenceDocument(referencesFile.document);
    } else {
        inventory = sourceReferenceDocument(path.resolve(options.repo));
    }
    const inventoryByCn = bindCasesToInventory(cases, inventory);
    const selectedCases = selectCaseShard(cases, options.shardIndex, options.shardCount);
    const expectedKeys = expectedPairKeys(selectedCases, inventoryByCn);
    const calculateShapeMeasure = dependencies.calculateShapeMeasure ||
        loadQShape(path.resolve(options.repo)).calculateShapeMeasure;
    const results = [];
    for (const item of selectedCases) {
        const group = inventoryByCn.get(item.cn);
        for (const target of group.targets) {
            const started = performance.now();
            const result = calculateShapeMeasure(
                item.actualLigands,
                target.coordinates,
                'default',
                null,
                options.seedPolicy === 'explicit' ? { seed: options.explicitSeed } : {}
            );
            const elapsed = performance.now() - started;
            const measure = result?.measure;
            if (typeof measure !== 'number') throw new Error(
                `Q-Shape returned a non-number result for ${item.caseId}/${target.code}`
            );
            const finite = Number.isFinite(measure);
            results.push({
                caseId: item.caseId,
                caseOrdinal: item.caseOrdinal,
                stratum: item.stratum,
                cn: item.cn,
                targetCode: target.code,
                targetOrdinal: target.ordinal,
                qshapeLigandFixed15Tokens: item.ligandTokens,
                targetReferenceBinary64RoundtripTokens: target.coordinateRoundtripTokens,
                targetReferenceFloat64Hex: target.coordinateFloat64Hex,
                valueToken: canonicalValueToken(measure),
                valueHex: float64Hex(measure),
                resultFinite: finite,
                resultDomainValid: finite && measure >= 0 && measure <= 100,
                runtimeMsToken: runtimeToken(elapsed),
                inputFingerprintSha256: inputFingerprint(
                    item,
                    target,
                    options.seedPolicy,
                    options.seedPolicy === 'explicit' ? options.explicitSeed : null
                ),
                mode: 'default',
                seedPolicy: options.seedPolicy,
                explicitSeed: options.seedPolicy === 'explicit' ? options.explicitSeed : null,
                repetition: options.repetition,
                stream: options.stream
            });
        }
    }
    validateRows(results, expectedKeys);
    // The nested loops above are the frozen case order followed by target
    // ordinal order; retain this explicit check so a future refactor cannot
    // silently sort rows by code or by shard.
    for (let index = 0; index < results.length; index++) {
        const expectedKey = expectedKeys[index];
        const actualKey = pairKey(results[index].caseId, results[index].targetCode);
        if (actualKey !== expectedKey) throw new Error(
            `Q-Shape row order changed at row ${index + 1}: ${actualKey} != ${expectedKey}`
        );
    }
    const payload = {
        schema_version: 1,
        program: 'Q-Shape',
        campaign_id: CAMPAIGN_ID,
        cases_sha256: casesFile.path ? sha256File(casesFile.path) : CAMPAIGN_CASES_SHA256,
        references_sha256: referencesFile ? sha256File(referencesFile.path) : null,
        mode: 'default',
        input_contract: 'frozen-metamorphic-cases-and-reference-binary64-v1',
        execution_process: executionProcess,
        runtime_identity_sha256: observedRuntime.identitySha256,
        runtime_identity: observedRuntime.identity,
        seed_policy: options.seedPolicy,
        explicit_seed_uint32: options.seedPolicy === 'explicit' ? options.explicitSeed : null,
        stream: options.stream,
        repetition: options.repetition,
        shard_index: options.shardIndex,
        shard_count: options.shardCount,
        case_count: selectedCases.length,
        count: results.length,
        expected_count: expectedKeys.length,
        results
    };
    return { payload, cases, inventory, selectedCases, results };
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(
            'Usage: node validation/scripts/qshape-metamorphic-worker.cjs ' +
            '--output <json> --cases <frozen-cases.json> [--references <references.json>] ' +
            '--repetition <n> [--seed-policy input-derived|explicit] ' +
            '[--explicit-seed <uint32>] [--stream <name>] ' +
            '[--shard-index <n> --shard-count <n>] [--repo <q-shape-root>]\n'
        );
        return;
    }
    const outputPath = path.resolve(options.output);
    if (fs.existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const { payload } = runWorker(options);
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write(JSON.stringify({
        output: outputPath,
        campaign_id: payload.campaign_id,
        stream: payload.stream,
        repetition: payload.repetition,
        shard_index: payload.shard_index,
        shard_count: payload.shard_count,
        count: payload.count
    }) + '\n');
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    BINARY64_TOKEN,
    CAMPAIGN_CASES_SHA256,
    CAMPAIGN_ID,
    EXPECTED_CASE_COUNT,
    EXPECTED_MATCHED_TARGET_ROWS,
    EXPECTED_REFERENCE_COUNT,
    EXPECTED_STREAMS,
    captureWorkerRuntimeIdentity,
    canonicalValueToken,
    inputFingerprint,
    normalizeReferenceDocument,
    pairKey,
    parseArguments,
    parseFrozenCases,
    runtimeIdentitySha256,
    runWorker,
    selectCaseShard,
    validateRows
};

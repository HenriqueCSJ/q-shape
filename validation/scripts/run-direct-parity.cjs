#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Decimal = require('decimal.js');

const {
    bindShapeReferenceListing,
    buildFixtureCases,
    buildIdealCases,
    buildReferenceInventory,
    buildShapeDat,
    float64Hex,
    formatCoordinate,
    loadQShape,
    parseShapeOut,
    parseShapeReferenceListing,
    parseShapeTab,
    rowsToCsv,
    sha256File,
    shellQuote,
    wslPathCommand
} = require('./direct-parity-core.cjs');
const { analyzeDirectParity } = require('./direct-parity-analysis.cjs');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAX_SHAPE_REFERENCES_PER_CONTROL = 12;
const QSHAPE_REPETITIONS = 2;
const SHAPE_REPETITIONS = 2;
const QSHAPE_SEED_POLICY = 'input-derived';
const EXPECTED_SHAPE_SHA256 = '1592122408e7f5486fd9665e96e129dda9390b1b0ac76da4d348e3070c1bb4cb';
const EXPECTED_WSL_DISTRO = 'Ubuntu-22.04';
const EXPECTED_REFERENCE_SOURCE_SHA256 =
    '4b6a037196629347969ff51d6f3110c1e78b38be3539d79811f84b849a17e26d';
const EXPECTED_QSHAPE_REFERENCE_INVENTORY_SHA256 =
    '33e90f101fdc784a5de9c278dcc6d802390986575d7d7b1cb52c475110be1a71';
const EXPECTED_FIXTURES = Object.freeze({
    2: ['CN2-CuCl2.xyz', 'bd01c81a2d0acd03aaa64b95f5b6fa95a0cb52ebc6b1e8bc79fb3f74fbcd33fe'],
    3: ['CN3-NH3.xyz', '57224e60f8fb4c574eb9b7887e39a1eb4b9fdbbc72a68f3519dfd8435f64cdb9'],
    4: ['CN4-CuCl4.xyz', '498005616704e128bd56dfbde72df61ee3bc09c8b1abb42e96f793c4db6a9f08'],
    5: ['CN5-AgL5.xyz', '8d713513d126cc114f4b84e5dc87fc5ada641ec783aa2f239318a29c392b4b34'],
    6: ['CN6-NiN4O2.xyz', '1d6671c44065be51de2dee136bfd9976d303bccb621a207c5a5143e612e2b73f'],
    7: ['CN7-FeL7.xyz', 'b8d78999e51c1a5d1bec02b6e38e1aed8e49bc28171aeaea8269f5a40a3fef13'],
    8: ['CN8-FeL8.xyz', '25e54c0b64118bee95bc912e1d642cf56c471ea49c4f3560cb4cfb0e6d4e358d'],
    9: ['CN9-CrL9.xyz', 'b3e54773a63549045f067e393892a99445019a8cb88534cb60a7ae461ea54c69'],
    10: ['CN10-FeL10.xyz', 'd7d69dbb0f0f935c7bf51ab0a98051e0c01e93835893a2c03f13b59e1526bb9e'],
    11: ['CN11-NbL11.xyz', 'd766bbe13a8b604299d7f691caae43b91d568f64f6a7fe4cdb4f6de60872ea51'],
    12: ['CN12-NbL12.xyz', '24ea5d356045dcb55a2425384515359508ce3beae4d461d08603512aba1cc401']
});
const OUT_TAB_OVERLAP_LIMIT = new Decimal('0.000505');
const CANDIDATE_SOURCE_PATHS = Object.freeze([
    '.gitattributes',
    'package.json',
    'package-lock.json',
    'src/constants/algorithmConstants.js',
    'src/constants/referenceGeometries/index.js',
    'src/services/algorithms/hungarian.js',
    'src/services/algorithms/kabsch.js',
    'src/services/shapeAnalysis/shapeCalculator.js',
    'validation/protocol.md',
    'validation/scripts/direct-parity-analysis.cjs',
    'validation/scripts/direct-parity-core.cjs',
    'validation/scripts/qshape-direct-worker.cjs',
    'validation/scripts/run-direct-parity.cjs',
    'validation/scripts/verify-direct-parity.cjs'
]);

const RUN_CONTEXT = {
    outputRoot: null,
    stage: 'startup',
    lastCommand: null,
    qshapeCommit: null
};

const COMPARISON_COLUMNS = [
    'case_id', 'stratum', 'cn', 'source_name', 'target_code', 'target_name',
    'shape_code', 'shape_token', 'qshape_full_precision', 'qshape_float64_hex',
    'qshape_display_5dp', 'signed_error', 'absolute_error', 'result_domain_valid',
    'pass_abs_0_01', 'runtime_ms', 'qshape_seed_policy',
    'qshape_explicit_seed_uint32', 'shape_raw_path',
    'qshape_raw_path'
];

const CASE_SUMMARY_COLUMNS = [
    'case_id', 'stratum', 'cn', 'source_name', 'expected_own_target_code',
    'shape_best_code', 'qshape_best_code', 'shape_tie_set', 'qshape_tie_set',
    'exact_best_label_agrees', 'qshape_best_within_shape_tie_set',
    'shape_best_second_margin', 'qshape_best_second_margin', 'max_absolute_error',
    'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
    'mean_absolute_error', 'root_mean_square_error', 'signed_bias',
    'kendall_tau_b_gamma', 'kendall_concordant_pairs',
    'kendall_discordant_pairs', 'kendall_shape_only_ties',
    'kendall_qshape_only_ties', 'kendall_joint_ties',
    'resolved_ranking_pairs', 'discordant_ranking_pairs',
    'ranking_agreement_fraction', 'failure_count', 'pass'
];

const FAILURE_COLUMNS = [
    'failure_id', 'case_id', 'stratum', 'cn', 'gate', 'target_code',
    'comparison_code', 'observed', 'threshold', 'details', 'shape_raw_path',
    'qshape_raw_path', 'severity', 'status'
];

function parseArguments(argv) {
    const options = {
        output: null,
        shapeExecutable: process.env.SHAPE_BIN || null,
        wslDistro: process.env.SHAPE_WSL_DISTRO || 'Ubuntu-22.04',
        expectedShapeSha256: process.env.SHAPE_EXPECTED_SHA256 || null,
        help: false
    };
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--output') options.output = argv[++index];
        else if (token === '--shape-executable') options.shapeExecutable = argv[++index];
        else if (token === '--wsl-distro') options.wslDistro = argv[++index];
        else if (token === '--expected-shape-sha256') options.expectedShapeSha256 = argv[++index];
        else if (token === '--help' || token === '-h') options.help = true;
        else throw new Error(`Unknown argument: ${token}`);
    }
    return options;
}

function usage() {
    return [
        'Usage:',
        '  node validation/scripts/run-direct-parity.cjs --output <new-directory>',
        '    --shape-executable </absolute/linux/path/to/shape_2.1_linux64>',
        '    --expected-shape-sha256 <64-hex-digest>',
        '    [--wsl-distro Ubuntu-22.04]',
        '',
        'The output directory must not exist. The worktree must be clean. The',
        'expected executable digest is mandatory and is checked before SHAPE is run.'
    ].join('\n');
}

function writeText(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
}

function writeJson(filePath, value) {
    writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isRegularFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function relativeTo(root, filePath) {
    return path.relative(root, filePath).replace(/\\/g, '/');
}

function binary64RoundTripToken(value) {
    if (Object.is(value, -0)) return '-0';
    if (!Number.isFinite(value)) throw new Error(`Non-finite reference coordinate: ${value}`);
    return value.toPrecision(17);
}

function qshapeInputFingerprint(item, target) {
    const contract = {
        schema_version: 1,
        case_id: item.caseId,
        cn: item.cn,
        qshape_ligand_fixed15_tokens: item.shapeAtoms.slice(1).map(atom => atom.tokens),
        target_code: target.code,
        target_reference_binary64_roundtrip_tokens: target.coordinates.map(point =>
            point.map(binary64RoundTripToken)
        ),
        target_reference_float64_hex: target.coordinates.map(point => point.map(float64Hex)),
        mode: 'default',
        seed_policy: QSHAPE_SEED_POLICY,
        explicit_seed_uint32: null
    };
    return crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function qshapeReferenceInventoryFingerprint(inventory) {
    const contract = {
        schema_version: 1,
        by_cn: [...inventory].sort((left, right) => left.cn - right.cn).map(group => ({
            cn: group.cn,
            references: [...group.targets].sort((left, right) => left.index - right.index)
                .map(target => ({
                    qshape_index: target.index,
                    qshape_code: target.code,
                    qshape_name: target.name,
                    qshape_center_index_zero_based: group.cn,
                    qshape_reference_coordinate_fixed15_tokens: target.coordinates.map(
                        point => point.map(formatCoordinate)
                    ),
                    qshape_reference_coordinate_roundtrip_tokens: target.coordinates.map(
                        point => point.map(binary64RoundTripToken)
                    ),
                    qshape_reference_coordinate_float64_hex: target.coordinates.map(
                        point => point.map(float64Hex)
                    )
                }))
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function setStage(stage, details = {}) {
    RUN_CONTEXT.stage = stage;
    if (RUN_CONTEXT.outputRoot && fs.existsSync(RUN_CONTEXT.outputRoot)) {
        writeJson(path.join(RUN_CONTEXT.outputRoot, 'run-state.json'), {
            schema_version: 1,
            status: stage === 'complete' ? 'complete' : 'in_progress',
            stage,
            updated_at_utc: new Date().toISOString(),
            qshape_commit: RUN_CONTEXT.qshapeCommit,
            ...details
        });
    }
}

function run(command, args, options = {}) {
    RUN_CONTEXT.lastCommand = {
        command,
        args,
        cwd: options.cwd || REPO_ROOT,
        purpose: options.purpose || null
    };
    const started = process.hrtime.bigint();
    const result = spawnSync(command, args, {
        cwd: options.cwd || REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: options.maxBuffer || 128 * 1024 * 1024,
        windowsHide: true,
        timeout: options.timeout || 60 * 60 * 1000,
        killSignal: 'SIGTERM'
    });
    result.durationMsToken = (Number(process.hrtime.bigint() - started) / 1e6).toFixed(3);
    if (result.error) throw result.error;
    if (!options.allowFailure && result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} exited ${result.status}\n${result.stderr || result.stdout}`
        );
    }
    return result;
}

function runWslShell(distro, command, options = {}) {
    return run(
        'wsl.exe',
        ['-d', distro, '--', 'bash', '-lc', command],
        { ...options, purpose: options.purpose || 'WSL command' }
    );
}

function writeCommandRecord(root, stem, commandText, result) {
    writeText(path.join(root, `${stem}.command.txt`), `${commandText}\n`);
    writeText(path.join(root, `${stem}.stdout.txt`), result.stdout || '');
    writeText(path.join(root, `${stem}.stderr.txt`), result.stderr || '');
    writeText(path.join(root, `${stem}.exit-code.txt`), `${result.status}\n`);
}

function runRecordedWsl(distro, root, stem, commandText, required = true) {
    const fullCommand = `export LC_ALL=C LANG=C TZ=UTC\n${commandText}`;
    const result = runWslShell(distro, fullCommand, {
        allowFailure: true,
        purpose: stem
    });
    writeCommandRecord(root, stem, fullCommand, result);
    if (required && result.status !== 0) {
        throw new Error(`${stem} failed with exit status ${result.status}`);
    }
    return result;
}

function toWslPath(distro, windowsPath) {
    const result = runWslShell(
        distro,
        wslPathCommand(path.resolve(windowsPath)),
        { purpose: 'convert output path to WSL path' }
    );
    const converted = result.stdout.trim();
    if (!converted.startsWith('/')) throw new Error(`wslpath returned invalid path: ${converted}`);
    return converted;
}

function chunk(values, size) {
    const chunks = [];
    for (let offset = 0; offset < values.length; offset += size) {
        chunks.push(values.slice(offset, offset + size));
    }
    return chunks;
}

function collectFiles(root, current = root) {
    const files = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) throw new Error(`Validation package contains symlink: ${fullPath}`);
        if (entry.isDirectory()) files.push(...collectFiles(root, fullPath));
        else if (entry.isFile()) files.push(fullPath);
    }
    return files;
}

function candidateSourceFingerprints() {
    return Object.fromEntries(CANDIDATE_SOURCE_PATHS.map(relativePath => {
        const filePath = path.join(REPO_ROOT, ...relativePath.split('/'));
        if (!isRegularFile(filePath)) throw new Error(`Candidate source file missing: ${relativePath}`);
        return [relativePath, sha256File(filePath)];
    }));
}

function copyCandidateSnapshot(snapshotRoot, fingerprints) {
    for (const relativePath of CANDIDATE_SOURCE_PATHS) {
        const source = path.join(REPO_ROOT, ...relativePath.split('/'));
        const destination = path.join(snapshotRoot, ...relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        if (sha256File(destination) !== fingerprints[relativePath]) {
            throw new Error(`Candidate snapshot copy mismatch: ${relativePath}`);
        }
    }
}

function exactSet(actualValues, expectedValues, label) {
    const actual = new Set(actualValues);
    const expected = new Set(expectedValues);
    if (actual.size !== actualValues.length) throw new Error(`${label} contains duplicates`);
    const missing = [...expected].filter(value => !actual.has(value));
    const extra = [...actual].filter(value => !expected.has(value));
    if (missing.length || extra.length) {
        throw new Error(`${label} set mismatch; missing=${missing.join('|')}; extra=${extra.join('|')}`);
    }
}

function pairKey(caseId, targetCode) {
    return `${caseId}\u0000${targetCode}`;
}

function expectedPairKeys(cases, inventory) {
    const keys = [];
    for (const item of cases) {
        const targets = inventory.find(entry => entry.cn === item.cn).targets;
        for (const target of targets) keys.push(pairKey(item.caseId, target.code));
    }
    return keys;
}

function validateUniqueRows(rows, expectedKeys, label) {
    const keys = rows.map(row => pairKey(row.caseId, row.targetCode));
    exactSet(keys, expectedKeys, label);
    return new Map(rows.map(row => [pairKey(row.caseId, row.targetCode), row]));
}

function normalizeShapeOut(parsed, cnCases, targetBatch, caseByStructureId, rawPath, replicate) {
    exactSet(
        parsed.map(item => item.structureId),
        cnCases.map(item => item.structureId),
        `${rawPath} structures`
    );
    const expectedCodes = targetBatch.map(target => target.shapeCode);
    const targetByShapeCode = new Map(targetBatch.map(target => [target.shapeCode, target]));
    const rows = [];
    for (const structure of parsed) {
        exactSet(
            structure.values.map(value => value.targetCode),
            expectedCodes,
            `${rawPath}/${structure.structureId} targets`
        );
        const caseItem = caseByStructureId.get(structure.structureId);
        if (!caseItem || caseItem.cn !== cnCases[0].cn) {
            throw new Error(`${rawPath} returned unknown structure ${structure.structureId}`);
        }
        for (const value of structure.values) {
            const target = targetByShapeCode.get(value.targetCode);
            rows.push({
                caseId: caseItem.caseId,
                targetCode: target.code,
                shapeCode: target.shapeCode,
                targetIndex: target.shapeIndex,
                valueToken: value.valueToken,
                lexicallyValid: value.lexicallyValid,
                rawLineNumber: value.rawLineNumber,
                rawPath,
                replicate
            });
        }
    }
    return rows;
}

function normalizeShapeTab(parsed, cnCases, targetBatch, caseByStructureId, rawPath) {
    const expectedCodes = targetBatch.map(target => target.shapeCode);
    if (parsed.targetCodes.join('\u0000') !== expectedCodes.join('\u0000')) {
        throw new Error(`${rawPath} target order does not match the SHAPE control`);
    }
    exactSet(
        parsed.structures.map(item => item.structureId),
        cnCases.map(item => item.structureId),
        `${rawPath} structures`
    );
    const targetByShapeCode = new Map(targetBatch.map(target => [target.shapeCode, target]));
    const rows = [];
    for (const structure of parsed.structures) {
        const caseItem = caseByStructureId.get(structure.structureId);
        if (!caseItem) throw new Error(`${rawPath} returned unknown structure ${structure.structureId}`);
        for (const value of structure.values) {
            const target = targetByShapeCode.get(value.targetCode);
            rows.push({
                caseId: caseItem.caseId,
                targetCode: target.code,
                shapeCode: target.shapeCode,
                valueToken: value.valueToken,
                lexicallyValid: value.lexicallyValid,
                rawLineNumber: value.rawLineNumber,
                rawPath
            });
        }
    }
    return rows;
}

function tabConsistencyFailures(outRows, tabRows, replicate) {
    const tabByPair = new Map(tabRows.map(row => [pairKey(row.caseId, row.targetCode), row]));
    const failures = [];
    for (const outRow of outRows) {
        const tabRow = tabByPair.get(pairKey(outRow.caseId, outRow.targetCode));
        if (!tabRow.lexicallyValid) {
            failures.push({
                caseId: outRow.caseId,
                gate: 'shape_tab_lexical_token',
                targetCode: outRow.targetCode,
                observed: tabRow.valueToken,
                threshold: 'non-negative fixed decimal with exactly three fractional digits',
                details: `SHAPE repetition ${replicate}; .tab line ${tabRow.rawLineNumber}`,
                shapeRawPath: tabRow.rawPath
            });
            continue;
        }
        if (!outRow.lexicallyValid) continue;
        const difference = new Decimal(outRow.valueToken).minus(tabRow.valueToken).abs();
        if (difference.gt(OUT_TAB_OVERLAP_LIMIT)) {
            failures.push({
                caseId: outRow.caseId,
                gate: 'shape_out_tab_inconsistency',
                targetCode: outRow.targetCode,
                observed: `.out=${outRow.valueToken}; .tab=${tabRow.valueToken}`,
                threshold: '|out-tab|<=0.000505 CShM (overlapping printed-value intervals)',
                details: `SHAPE repetition ${replicate}; difference ${difference.toString()}`,
                shapeRawPath: `${outRow.rawPath}|${tabRow.rawPath}`
            });
        }
    }
    return failures;
}

function parseOsRelease(text) {
    const result = {};
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) result[match[1]] = match[2].replace(/^"|"$/g, '');
    }
    return result;
}

function validateQPayload(
    payload,
    repetition,
    expectedKeys,
    expectedInputFingerprints,
    expectedCasesSha256,
    expectedReferencesSha256,
    rawPath
) {
    if (
        payload?.program !== 'Q-Shape' || payload.mode !== 'default' ||
        payload.seed_policy !== QSHAPE_SEED_POLICY ||
        payload.explicit_seed_uint32 !== null || payload.repetition !== repetition ||
        payload.input_contract !== 'manifested-cases-and-references-v1' ||
        payload.cases_sha256 !== expectedCasesSha256 ||
        payload.references_sha256 !== expectedReferencesSha256 ||
        payload.count !== expectedKeys.length || !Array.isArray(payload.results)
    ) {
        throw new Error(`Invalid Q-Shape worker envelope for repetition ${repetition}`);
    }
    const rows = payload.results.map(row => {
        if (
            row.repetition !== repetition || row.seedPolicy !== QSHAPE_SEED_POLICY ||
            row.explicitSeed !== null || row.mode !== 'default'
        ) {
            throw new Error(`Q-Shape worker row contract mismatch in repetition ${repetition}`);
        }
        if (!/^[0-9a-f]{16}$/.test(row.valueHex || '')) {
            throw new Error(`Invalid Q-Shape float64 hex for ${row.caseId}/${row.targetCode}`);
        }
        const key = pairKey(row.caseId, row.targetCode);
        if (!/^[0-9a-f]{64}$/.test(row.inputFingerprintSha256 || '') ||
            row.inputFingerprintSha256 !== expectedInputFingerprints.get(key)) {
            throw new Error(`Q-Shape input fingerprint mismatch for ${row.caseId}/${row.targetCode}`);
        }
        const parsed = Number(row.valueToken);
        const canonicalToken = Number.isFinite(parsed)
            ? (Object.is(parsed, -0) ? '-0' : parsed.toPrecision(17))
            : null;
        if (canonicalToken !== row.valueToken || float64Hex(parsed) !== row.valueHex) {
            throw new Error(
                `Q-Shape canonical decimal/float64 mismatch for ${row.caseId}/${row.targetCode}`
            );
        }
        return {
            ...row,
            rawPath,
            lexicallyValid: true
        };
    });
    validateUniqueRows(rows, expectedKeys, `Q-Shape repetition ${repetition}`);
    return rows;
}

function buildWorkingReport(summary, metadata) {
    const statistics = summary.totals.error_statistics;
    const runtime = summary.totals.runtime_statistics_ms;
    return [
        '# Direct SHAPE parity census — working report',
        '',
        'Status: working validation artifact; not a publication-ready table or a claim of external chemical validity.',
        '',
        `Direct-campaign gate: **${summary.campaign_gate_status.toUpperCase()}**.`,
        `Overall validation: **${summary.overall_validation_status.toUpperCase()}**.`,
        '',
        `- Q-Shape commit: \`${metadata.qshape_commit}\`.`,
        `- Q-Shape optimizer seed policy: \`${metadata.qshape_seed_policy}\` (production path; no explicit seed).`,
        `- SHAPE banner: \`${metadata.shape_banner}\`.`,
        `- SHAPE executable SHA-256: \`${metadata.shape_executable_sha256}\`.`,
        `- Cases: ${summary.totals.cases}; matched target evaluations per program: ${summary.totals.comparisons_observed}.`,
        `- Failures retained in the ledger: ${summary.totals.failures}.`,
        `- MAE / RMSE: ${statistics.mean_absolute_error ?? 'not_available'} / ${statistics.root_mean_square_error ?? 'not_available'} CShM.`,
        `- Median / P95 / P99 / maximum absolute error: ${statistics.median_absolute_error ?? 'not_available'} / ${statistics.p95_absolute_error ?? 'not_available'} / ${statistics.p99_absolute_error ?? 'not_available'} / ${statistics.max_absolute_error ?? 'not_available'} CShM.`,
        `- Signed bias: ${statistics.signed_bias ?? 'not_available'} CShM.`,
        `- Q-Shape diagnostic runtime mean / median / P95 / P99 / maximum: ${runtime.mean ?? 'not_available'} / ${runtime.median ?? 'not_available'} / ${runtime.p95 ?? 'not_available'} / ${runtime.p99 ?? 'not_available'} / ${runtime.max ?? 'not_available'} ms.`,
        '',
        'This census covers shared ideal references and retained fixtures. It does not replace the preregistered perturbation family, external chemical holdout, browser workflow validation, or independent-user study.',
        ''
    ].join('\n');
}

function buildDataDictionary() {
    return {
        schema_version: 2,
        table_mode: 'working_tidy_data',
        publication_status: 'not_reviewed_not_publication_ready',
        quantities: {
            shape_token: {
                meaning: 'CShM printed by SHAPE .out',
                type: 'exact non-negative fixed five-decimal token',
                unit: 'dimensionless CShM',
                resolution: '0.00001'
            },
            qshape_full_precision: {
                meaning: 'Q-Shape Number rendered as a binary64 round-trip token',
                type: 'IEEE-754 binary64 lexical token',
                unit: 'dimensionless CShM'
            },
            qshape_float64_hex: {
                meaning: 'big-endian hexadecimal encoding of all 64 result bits',
                type: '16 lowercase hexadecimal characters'
            },
            signed_error: { meaning: 'Q-Shape minus SHAPE', unit: 'dimensionless CShM' },
            runtime_ms: { meaning: 'worker wall time per target', unit: 'ms', claim_boundary: 'diagnostic only' }
        },
        gates: {
            matched_target_absolute_error: '<0.01 CShM',
            cshm_domain: 'finite and within [0, 100]',
            ideal_qshape_self: '<1e-8 CShM',
            ideal_shape_self: '<0.01 CShM',
            shape_tie_set_gamma: '0.02001 CShM',
            qshape_repeatability: 'identical float64 hex across independent worker processes',
            shape_repeatability: 'identical five-decimal CShM tokens across clean runs',
            shape_out_tab_consistency: '|out-tab|<=0.000505 CShM'
        }
    };
}

function writeFailureArtifacts(error) {
    if (!RUN_CONTEXT.outputRoot || !fs.existsSync(RUN_CONTEXT.outputRoot)) return;
    try {
        writeJson(path.join(RUN_CONTEXT.outputRoot, 'run-state.json'), {
            schema_version: 1,
            status: 'aborted',
            stage: RUN_CONTEXT.stage,
            updated_at_utc: new Date().toISOString(),
            qshape_commit: RUN_CONTEXT.qshapeCommit
        });
        writeJson(path.join(RUN_CONTEXT.outputRoot, 'run-failure.json'), {
            schema_version: 1,
            package_status: 'aborted',
            campaign_gate_status: 'not_evaluable',
            overall_validation_status: 'incomplete',
            failed_at_utc: new Date().toISOString(),
            stage: RUN_CONTEXT.stage,
            error_name: error.name,
            error_message: error.message,
            error_stack: error.stack || null,
            last_command: RUN_CONTEXT.lastCommand,
            qshape_commit: RUN_CONTEXT.qshapeCommit
        });
        const files = collectFiles(RUN_CONTEXT.outputRoot)
            .filter(filePath => path.basename(filePath) !== 'partial-manifest.json')
            .sort((a, b) => relativeTo(RUN_CONTEXT.outputRoot, a).localeCompare(
                relativeTo(RUN_CONTEXT.outputRoot, b)
            ))
            .map(filePath => ({
                path: relativeTo(RUN_CONTEXT.outputRoot, filePath),
                size_bytes: fs.statSync(filePath).size,
                sha256: sha256File(filePath)
            }));
        writeJson(path.join(RUN_CONTEXT.outputRoot, 'partial-manifest.json'), {
            schema_version: 1,
            package_status: 'aborted',
            stage: RUN_CONTEXT.stage,
            files
        });
    } catch (artifactError) {
        process.stderr.write(`Could not write failure artifacts: ${artifactError.message}\n`);
    }
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
    }
    if (!options.output) throw new Error('--output is required');
    if (!options.shapeExecutable || !options.shapeExecutable.startsWith('/')) {
        throw new Error('--shape-executable must be an absolute Linux path');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(options.expectedShapeSha256 || '')) {
        throw new Error('--expected-shape-sha256 is required and must contain 64 hexadecimal characters');
    }
    if (process.platform !== 'win32') {
        throw new Error('This campaign runner requires Windows Node.js with wsl.exe available');
    }
    if (options.wslDistro !== EXPECTED_WSL_DISTRO) {
        throw new Error(`--wsl-distro must be ${EXPECTED_WSL_DISTRO} for this frozen campaign`);
    }
    if (options.expectedShapeSha256.toLowerCase() !== EXPECTED_SHAPE_SHA256) {
        throw new Error('The supplied SHAPE digest is not the preregistered SHAPE 2.1 digest');
    }

    const gitStatus = run('git', ['status', '--porcelain'], { purpose: 'freeze check' }).stdout.trim();
    if (gitStatus) throw new Error('Git worktree is dirty. Commit candidate and harness before validation.');
    const qshapeCommit = run('git', ['rev-parse', 'HEAD'], { purpose: 'candidate commit' }).stdout.trim();
    const qshapeBranch = run('git', ['branch', '--show-current'], { purpose: 'candidate branch' }).stdout.trim();
    if (!qshapeBranch) throw new Error('Detached HEAD is not allowed for a sealed campaign');
    const candidateFingerprintsAtStart = candidateSourceFingerprints();
    RUN_CONTEXT.qshapeCommit = qshapeCommit;

    const referenceSourcePath = path.join(REPO_ROOT, 'src/constants/referenceGeometries/index.js');
    const referenceSourceSha256 = sha256File(referenceSourcePath);
    if (referenceSourceSha256 !== EXPECTED_REFERENCE_SOURCE_SHA256) {
        throw new Error(
            `Reference source hash ${referenceSourceSha256} does not match the frozen LF-normalized source`
        );
    }
    const expectedFixtureNames = Object.values(EXPECTED_FIXTURES).map(([name]) => name).sort();
    const fixtureRoot = path.join(REPO_ROOT, 'tests', 'fixtures', 'shape-parity');
    const actualFixtureNames = fs.readdirSync(fixtureRoot)
        .filter(name => name.toLowerCase().endsWith('.xyz'))
        .sort();
    exactSet(actualFixtureNames, expectedFixtureNames, 'frozen retained fixture filenames');
    for (const [cn, [name, expectedDigest]] of Object.entries(EXPECTED_FIXTURES)) {
        const actualDigest = sha256File(path.join(fixtureRoot, name));
        if (actualDigest !== expectedDigest) {
            throw new Error(`CN=${cn} fixture ${name} hash ${actualDigest} does not match the frozen LF bytes`);
        }
    }
    const { referenceGeometries } = loadQShape(REPO_ROOT);
    const inventory = buildReferenceInventory(referenceGeometries);
    const referenceInventorySha256 = qshapeReferenceInventoryFingerprint(inventory);
    if (referenceInventorySha256 !== EXPECTED_QSHAPE_REFERENCE_INVENTORY_SHA256) {
        throw new Error(
            `Canonical Q-Shape reference inventory hash ${referenceInventorySha256} is not preregistered`
        );
    }

    const outputRoot = path.resolve(options.output);
    const outputRelativeToRepo = path.relative(REPO_ROOT, outputRoot);
    if (outputRelativeToRepo === '' || (
        !outputRelativeToRepo.startsWith(`..${path.sep}`) &&
        outputRelativeToRepo !== '..' && !path.isAbsolute(outputRelativeToRepo)
    )) {
        throw new Error('Output directory must be outside the Q-Shape repository');
    }
    const verificationSidecarPath = `${outputRoot}.verification.json`;
    if (fs.existsSync(outputRoot)) throw new Error(`Output directory already exists: ${outputRoot}`);
    if (fs.existsSync(verificationSidecarPath)) {
        throw new Error(`Verification sidecar already exists: ${verificationSidecarPath}`);
    }
    fs.mkdirSync(outputRoot, { recursive: false });
    RUN_CONTEXT.outputRoot = outputRoot;

    const inputFixtureRoot = path.join(outputRoot, 'inputs', 'fixtures');
    const oracleMetadataRoot = path.join(outputRoot, 'oracle', 'metadata');
    const oracleRawRoot = path.join(outputRoot, 'oracle', 'raw');
    const qshapeRawRoot = path.join(outputRoot, 'qshape', 'raw');
    const candidateSnapshotRoot = path.join(outputRoot, 'inputs', 'candidate-snapshot');
    const reportRoot = path.join(outputRoot, 'reports');
    const metadataRoot = path.join(outputRoot, 'metadata');
    for (const directory of [
        inputFixtureRoot, candidateSnapshotRoot, oracleMetadataRoot, oracleRawRoot, qshapeRawRoot,
        reportRoot, metadataRoot
    ]) fs.mkdirSync(directory, { recursive: true });
    copyCandidateSnapshot(candidateSnapshotRoot, candidateFingerprintsAtStart);
    setStage('preflight_shape_identity');

    const shaResult = runRecordedWsl(
        options.wslDistro,
        oracleMetadataRoot,
        'shape-sha256',
        `sha256sum ${shellQuote(options.shapeExecutable)}`
    );
    const shaMatch = shaResult.stdout.match(/^([a-fA-F0-9]{64})\s/m);
    if (!shaMatch) throw new Error('Could not parse SHAPE executable SHA-256');
    const shapeExecutableSha256 = shaMatch[1].toLowerCase();
    if (shapeExecutableSha256 !== options.expectedShapeSha256.toLowerCase()) {
        throw new Error(
            `SHAPE executable hash ${shapeExecutableSha256} does not match expected ` +
            options.expectedShapeSha256.toLowerCase()
        );
    }

    setStage('metadata_after_identity');
    const metadataResults = {
        help: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-help',
            `${shellQuote(options.shapeExecutable)} -h`),
        listAll: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-list-all',
            `${shellQuote(options.shapeExecutable)} +`),
        file: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-file',
            `file ${shellQuote(options.shapeExecutable)}`),
        ldd: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-ldd',
            `ldd ${shellQuote(options.shapeExecutable)}`, false),
        uname: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'uname', 'uname -a'),
        osRelease: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'os-release',
            'cat /etc/os-release')
    };
    const helpText = `${metadataResults.help.stdout}${metadataResults.help.stderr}`;
    const bannerMatch = helpText.match(/S H A P E\s+v([\d.]+)/);
    if (!bannerMatch || bannerMatch[1] !== '2.1') {
        throw new Error(`Expected SHAPE v2.1 banner; observed ${bannerMatch?.[1] || 'unparsed'}`);
    }

    setStage('reference_binding');
    const referenceListings = [];
    for (const item of inventory) {
        const stem = `references-cn${String(item.cn).padStart(2, '0')}`;
        const listingRun = runRecordedWsl(
            options.wslDistro,
            oracleMetadataRoot,
            stem,
            `${shellQuote(options.shapeExecutable)} +${item.cn}`
        );
        const parsed = parseShapeReferenceListing(listingRun.stdout, item.cn);
        bindShapeReferenceListing(item, parsed);
        referenceListings.push({
            cn: item.cn,
            raw_path: relativeTo(outputRoot, path.join(oracleMetadataRoot, `${stem}.stdout.txt`)),
            references: parsed.references
        });
    }

    const fixtureCases = buildFixtureCases(REPO_ROOT, inventory);
    const idealCases = buildIdealCases(inventory);
    const cases = [...fixtureCases, ...idealCases].sort(
        (left, right) => left.cn - right.cn ||
            left.stratum.localeCompare(right.stratum) ||
            left.caseId.localeCompare(right.caseId)
    );
    if (fixtureCases.length !== 11 || idealCases.length !== 87 || cases.length !== 98) {
        throw new Error('Canonical case census must contain 11 fixtures and 87 ideal references');
    }
    exactSet(cases.map(item => item.structureId), cases.map(item => item.structureId), 'structure IDs');
    for (const item of fixtureCases) {
        fs.copyFileSync(
            path.resolve(REPO_ROOT, item.sourceFile),
            path.join(inputFixtureRoot, path.basename(item.sourceFile))
        );
    }

    const referencesPath = path.join(outputRoot, 'references.json');
    writeJson(referencesPath, {
        schema_version: 2,
        source_file: 'src/constants/referenceGeometries/index.js',
        source_sha256: referenceSourceSha256,
        canonical_qshape_inventory_sha256: referenceInventorySha256,
        mapping_policy: 'explicit code plus index; alias table v1 contains exactly three entries',
        count: 87,
        by_cn: inventory.map(item => ({
            cn: item.cn,
            count: item.count,
            references: item.targets.map(target => ({
                reference_id: `cn${String(item.cn).padStart(2, '0')}-r${String(target.index).padStart(2, '0')}`,
                qshape_index: target.index,
                shape_index: target.shapeIndex,
                qshape_code: target.code,
                qshape_name: target.name,
                shape_code: target.shapeCode,
                mapping_rule: target.mappingRule,
                shape_point_group: target.shapePointGroup,
                shape_description: target.shapeDescription,
                qshape_center_index_zero_based: item.cn,
                qshape_reference_coordinate_fixed15_tokens: target.coordinates.map(
                    point => point.map(formatCoordinate)
                ),
                qshape_reference_coordinate_roundtrip_tokens: target.coordinates.map(
                    point => point.map(binary64RoundTripToken)
                ),
                qshape_reference_coordinate_float64_hex: target.coordinates.map(
                    point => point.map(float64Hex)
                )
            }))
        }))
    });
    const casesPath = path.join(outputRoot, 'cases.json');
    writeJson(casesPath, {
        schema_version: 2,
        count: cases.length,
        strata: { retained_fixture: fixtureCases.length, ideal_reference: idealCases.length },
        cases: cases.map(item => ({
            case_id: item.caseId,
            structure_id: item.structureId,
            stratum: item.stratum,
            cn: item.cn,
            source_name: item.sourceName,
            source_file: item.sourceFile,
            source_sha256: item.sourceSha256 ?? null,
            source_atoms: item.sourceAtoms ?? null,
            source_center: item.centerOriginal,
            source_center_roundtrip_tokens: item.centerOriginal.map(binary64RoundTripToken),
            source_center_float64_hex: item.centerOriginal.map(float64Hex),
            expected_own_target_code: item.expectedOwnTargetCode,
            center_index_one_based_in_shape_input: 1,
            input_coordinate_policy: item.inputCoordinatePolicy,
            canonical_shape_atoms: item.shapeAtoms,
            qshape_actual_ligand_tokens: item.shapeAtoms.slice(1).map(atom => atom.tokens)
        }))
    });

    setStage('shape_runs');
    const oracleRawWsl = toWslPath(options.wslDistro, oracleRawRoot);
    const caseByStructureId = new Map(cases.map(item => [item.structureId, item]));
    const shapePrimaryRows = [];
    const shapeAllRows = [];
    const oracleRepeatability = [];
    const additionalFailures = [];
    for (const item of inventory) {
        const cnCases = cases.filter(caseItem => caseItem.cn === item.cn);
        const targetBatches = chunk(item.targets, MAX_SHAPE_REFERENCES_PER_CONTROL);
        for (let batchIndex = 0; batchIndex < targetBatches.length; batchIndex++) {
            const targetBatch = targetBatches[batchIndex];
            const replicateRows = [];
            const replicateFiles = [];
            for (let replicate = 1; replicate <= SHAPE_REPETITIONS; replicate++) {
                const stem = `cn${String(item.cn).padStart(2, '0')}-b${String(batchIndex + 1).padStart(2, '0')}-r${replicate}`;
                const datPath = path.join(oracleRawRoot, `${stem}.dat`);
                writeText(datPath, buildShapeDat(item.cn, cnCases, targetBatch));
                const command = [
                    'set -o pipefail',
                    'export LC_ALL=C LANG=C TZ=UTC',
                    `cd ${shellQuote(oracleRawWsl)}`,
                    `timeout -k 30s 1800s ${shellQuote(options.shapeExecutable)} ${shellQuote(`${stem}.dat`)}`
                ].join('\n');
                const result = runWslShell(options.wslDistro, command, {
                    allowFailure: true,
                    purpose: `SHAPE ${stem}`
                });
                const stdoutPath = path.join(oracleRawRoot, `${stem}.stdout.txt`);
                const stderrPath = path.join(oracleRawRoot, `${stem}.stderr.txt`);
                const exitCodePath = path.join(oracleRawRoot, `${stem}.exit-code.txt`);
                writeText(stdoutPath, result.stdout || '');
                writeText(stderrPath, result.stderr || '');
                writeText(exitCodePath, `${result.status}\n`);
                const outPath = path.join(oracleRawRoot, `${stem}.out`);
                const tabPath = path.join(oracleRawRoot, `${stem}.tab`);
                if (result.status !== 0 || !fs.existsSync(outPath) || !fs.existsSync(tabPath)) {
                    throw new Error(
                        `SHAPE failed for ${stem}: exit=${result.status}, ` +
                        `out=${fs.existsSync(outPath)}, tab=${fs.existsSync(tabPath)}`
                    );
                }
                const outRawPath = relativeTo(outputRoot, outPath);
                const tabRawPath = relativeTo(outputRoot, tabPath);
                const outRows = normalizeShapeOut(
                    parseShapeOut(fs.readFileSync(outPath, 'utf8')),
                    cnCases, targetBatch, caseByStructureId, outRawPath, replicate
                );
                const tabRows = normalizeShapeTab(
                    parseShapeTab(fs.readFileSync(tabPath, 'utf8')),
                    cnCases, targetBatch, caseByStructureId, tabRawPath
                );
                additionalFailures.push(...tabConsistencyFailures(outRows, tabRows, replicate));
                replicateRows.push(outRows);
                shapeAllRows.push(...outRows);
                replicateFiles.push({
                    replicate,
                    dat: relativeTo(outputRoot, datPath),
                    out: outRawPath,
                    tab: tabRawPath,
                    stdout: relativeTo(outputRoot, stdoutPath),
                    stderr: relativeTo(outputRoot, stderrPath),
                    exit_code_file: relativeTo(outputRoot, exitCodePath),
                    exit_code: result.status,
                    duration_ms: result.durationMsToken,
                    timeout_seconds: 1800,
                    dat_sha256: sha256File(datPath),
                    out_sha256: sha256File(outPath),
                    tab_sha256: sha256File(tabPath)
                });
            }
            if (replicateFiles[0].dat_sha256 !== replicateFiles[1].dat_sha256) {
                throw new Error(`Generated SHAPE inputs differ across repetitions for CN=${item.cn} batch=${batchIndex + 1}`);
            }
            const batchExpectedKeys = replicateRows[0].map(row => pairKey(row.caseId, row.targetCode));
            const primaryByPair = validateUniqueRows(replicateRows[0], batchExpectedKeys, 'SHAPE primary batch');
            const repeatedByPair = validateUniqueRows(replicateRows[1], batchExpectedKeys, 'SHAPE repeated batch');
            let mismatchCount = 0;
            for (const [key, primary] of primaryByPair) {
                const repeated = repeatedByPair.get(key);
                if (primary.valueToken !== repeated.valueToken) {
                    mismatchCount += 1;
                    additionalFailures.push({
                        caseId: primary.caseId,
                        gate: 'shape_repeatability',
                        targetCode: primary.targetCode,
                        observed: `rep1=${primary.valueToken}; rep2=${repeated.valueToken}`,
                        threshold: 'identical five-decimal CShM token',
                        details: 'Two clean SHAPE executions disagreed.',
                        shapeRawPath: `${primary.rawPath}|${repeated.rawPath}`
                    });
                }
            }
            shapePrimaryRows.push(...replicateRows[0]);
            oracleRepeatability.push({
                cn: item.cn,
                batch: batchIndex + 1,
                target_indices: targetBatch.map(target => target.shapeIndex),
                target_shape_codes: targetBatch.map(target => target.shapeCode),
                comparison_count: replicateRows[0].length,
                value_token_mismatches: mismatchCount,
                dat_files_byte_identical: true,
                out_files_byte_identical: replicateFiles[0].out_sha256 === replicateFiles[1].out_sha256,
                tab_files_byte_identical: replicateFiles[0].tab_sha256 === replicateFiles[1].tab_sha256,
                raw_byte_identity_is_diagnostic_not_a_scientific_gate: true,
                files: replicateFiles
            });
            process.stdout.write(
                `SHAPE CN=${item.cn} batch=${batchIndex + 1}/${targetBatches.length}: ` +
                `${replicateRows[0].length} primary values\n`
            );
        }
    }
    const expectedKeys = expectedPairKeys(cases, inventory);
    const expectedQInputFingerprints = new Map();
    for (const item of cases) {
        const targets = inventory.find(entry => entry.cn === item.cn).targets;
        for (const target of targets) {
            expectedQInputFingerprints.set(
                pairKey(item.caseId, target.code),
                qshapeInputFingerprint(item, target)
            );
        }
    }
    validateUniqueRows(shapePrimaryRows, expectedKeys, 'SHAPE primary census');
    if (shapeAllRows.length !== expectedKeys.length * SHAPE_REPETITIONS) {
        throw new Error(`SHAPE repeated row count ${shapeAllRows.length}; expected ${expectedKeys.length * SHAPE_REPETITIONS}`);
    }
    writeJson(path.join(outputRoot, 'oracle', 'parsed-results.json'), {
        schema_version: 2,
        source: 'SHAPE .out primary repetition, five-decimal tokens',
        count: shapePrimaryRows.length,
        results: shapePrimaryRows
    });
    writeJson(path.join(outputRoot, 'oracle', 'all-results.json'), {
        schema_version: 1,
        repetitions: SHAPE_REPETITIONS,
        count: shapeAllRows.length,
        results: shapeAllRows
    });
    writeJson(path.join(outputRoot, 'oracle', 'repeatability.json'), {
        schema_version: 2,
        repetitions: SHAPE_REPETITIONS,
        batches: oracleRepeatability,
        total_value_token_mismatches: oracleRepeatability.reduce(
            (sum, batch) => sum + batch.value_token_mismatches, 0
        ),
        raw_byte_differences_are_warnings_not_gates: true
    });

    setStage('qshape_runs');
    const casesSha256 = sha256File(casesPath);
    const referencesSha256 = sha256File(referencesPath);
    const qshapeAllRows = [];
    const qshapeReplicateRows = [];
    for (let repetition = 1; repetition <= QSHAPE_REPETITIONS; repetition++) {
        const rawPath = path.join(qshapeRawRoot, `repetition-${String(repetition).padStart(2, '0')}.json`);
        const stdoutPath = path.join(qshapeRawRoot, `repetition-${String(repetition).padStart(2, '0')}.stdout.txt`);
        const stderrPath = path.join(qshapeRawRoot, `repetition-${String(repetition).padStart(2, '0')}.stderr.txt`);
        const exitCodePath = path.join(qshapeRawRoot, `repetition-${String(repetition).padStart(2, '0')}.exit-code.txt`);
        const result = run(process.execPath, [
            path.join(REPO_ROOT, 'validation', 'scripts', 'qshape-direct-worker.cjs'),
            '--output', rawPath,
            '--cases', casesPath,
            '--references', referencesPath,
            '--seed-policy', QSHAPE_SEED_POLICY,
            '--repetition', String(repetition)
        ], { allowFailure: true, purpose: `Q-Shape repetition ${repetition}` });
        writeText(stdoutPath, result.stdout || '');
        writeText(stderrPath, result.stderr || '');
        writeText(exitCodePath, `${result.status}\n`);
        if (result.status !== 0 || !fs.existsSync(rawPath)) {
            throw new Error(`Q-Shape worker repetition ${repetition} failed with exit ${result.status}`);
        }
        const payload = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
        const rows = validateQPayload(
            payload,
            repetition,
            expectedKeys,
            expectedQInputFingerprints,
            casesSha256,
            referencesSha256,
            relativeTo(outputRoot, rawPath)
        );
        qshapeReplicateRows.push(rows);
        qshapeAllRows.push(...rows);
        process.stdout.write(`Q-Shape repetition ${repetition}: ${rows.length} values\n`);
    }
    const qshapePrimaryByPair = validateUniqueRows(
        qshapeReplicateRows[0], expectedKeys, 'Q-Shape primary census'
    );
    const qshapeRepeatedByPair = validateUniqueRows(
        qshapeReplicateRows[1], expectedKeys, 'Q-Shape repeated census'
    );
    const qshapeRepeatabilityMismatches = [];
    for (const [key, primary] of qshapePrimaryByPair) {
        const repeated = qshapeRepeatedByPair.get(key);
        if (primary.valueHex !== repeated.valueHex) {
            qshapeRepeatabilityMismatches.push({
                caseId: primary.caseId,
                targetCode: primary.targetCode,
                primaryToken: primary.valueToken,
                repeatedToken: repeated.valueToken,
                primaryHex: primary.valueHex,
                repeatedHex: repeated.valueHex,
                primaryRawPath: primary.rawPath,
                repeatedRawPath: repeated.rawPath
            });
            additionalFailures.push({
                caseId: primary.caseId,
                gate: 'qshape_repeatability',
                targetCode: primary.targetCode,
                observed: `rep1=${primary.valueHex}; rep2=${repeated.valueHex}`,
                threshold: 'identical IEEE-754 binary64 bits',
                details: 'Independent Q-Shape worker processes disagreed.',
                qshapeRawPath: `${primary.rawPath}|${repeated.rawPath}`
            });
        }
    }
    writeJson(path.join(outputRoot, 'qshape', 'results.json'), {
        schema_version: 2,
        mode: 'default',
        seed_policy: QSHAPE_SEED_POLICY,
        explicit_seed_uint32: null,
        repetitions: QSHAPE_REPETITIONS,
        count: qshapeAllRows.length,
        results: qshapeAllRows
    });
    writeJson(path.join(outputRoot, 'qshape', 'repeatability.json'), {
        schema_version: 2,
        comparisons_per_repetition: expectedKeys.length,
        comparison_basis: 'IEEE-754 binary64 hexadecimal bits',
        mismatch_count: qshapeRepeatabilityMismatches.length,
        mismatches: qshapeRepeatabilityMismatches
    });

    setStage('analysis');
    const analysis = analyzeDirectParity({
        cases,
        inventory,
        shapeRows: shapePrimaryRows,
        qshapeRows: qshapeReplicateRows[0],
        additionalFailures
    });
    writeJson(path.join(reportRoot, 'summary.json'), analysis.summary);
    writeText(path.join(reportRoot, 'comparisons.csv'), rowsToCsv(COMPARISON_COLUMNS, analysis.comparisonRows));
    writeText(path.join(reportRoot, 'case-summary.csv'), rowsToCsv(CASE_SUMMARY_COLUMNS, analysis.caseSummaryRows));
    writeText(path.join(reportRoot, 'failure-ledger.csv'), rowsToCsv(FAILURE_COLUMNS, analysis.failures));
    writeJson(path.join(metadataRoot, 'data-dictionary.json'), buildDataDictionary());

    setStage('final_freeze_check');
    const finalGitStatus = run('git', ['status', '--porcelain'], {
        purpose: 'final candidate cleanliness check'
    }).stdout.trim();
    const finalCommit = run('git', ['rev-parse', 'HEAD'], {
        purpose: 'final candidate commit check'
    }).stdout.trim();
    if (finalGitStatus || finalCommit !== qshapeCommit) {
        throw new Error('Candidate worktree or HEAD changed during validation');
    }
    const candidateFingerprintsAtEnd = candidateSourceFingerprints();
    if (JSON.stringify(candidateFingerprintsAtEnd) !== JSON.stringify(candidateFingerprintsAtStart)) {
        throw new Error('Candidate source fingerprints changed during validation');
    }
    const finalShaResult = runRecordedWsl(
        options.wslDistro,
        oracleMetadataRoot,
        'shape-sha256-final',
        `sha256sum ${shellQuote(options.shapeExecutable)}`
    );
    const finalShaMatch = finalShaResult.stdout.match(/^([a-fA-F0-9]{64})\s/m);
    if (!finalShaMatch || finalShaMatch[1].toLowerCase() !== shapeExecutableSha256) {
        throw new Error('SHAPE executable fingerprint changed during validation');
    }
    const finalMetadataResults = {
        help: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-help-final',
            `${shellQuote(options.shapeExecutable)} -h`),
        file: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'shape-file-final',
            `file ${shellQuote(options.shapeExecutable)}`),
        uname: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'uname-final', 'uname -a'),
        osRelease: runRecordedWsl(options.wslDistro, oracleMetadataRoot, 'os-release-final',
            'cat /etc/os-release')
    };
    const finalHelpText = `${finalMetadataResults.help.stdout}${finalMetadataResults.help.stderr}`;
    if (!/S H A P E\s+v2\.1/.test(finalHelpText)) {
        throw new Error('SHAPE version banner changed or became unavailable during validation');
    }
    for (const field of ['file', 'uname', 'osRelease']) {
        if (finalMetadataResults[field].stdout !== metadataResults[field].stdout ||
            finalMetadataResults[field].stderr !== metadataResults[field].stderr) {
            throw new Error(`SHAPE/WSL ${field} metadata changed during validation`);
        }
    }

    const osRelease = parseOsRelease(metadataResults.osRelease.stdout);
    const generatedAtUtc = new Date().toISOString();
    const runMetadata = {
        schema_version: 2,
        generated_at_utc: generatedAtUtc,
        qshape_commit: qshapeCommit,
        qshape_branch: qshapeBranch,
        qshape_worktree_clean_before_run: true,
        node_version: process.version,
        node_platform: process.platform,
        node_arch: process.arch,
        host_os_release: os.release(),
        host_os_version: os.version(),
        host_cpu_model: os.cpus()[0]?.model || 'not_reported',
        host_logical_cpu_count: os.cpus().length,
        host_total_memory_bytes: os.totalmem(),
        package_lock_sha256: sha256File(path.join(REPO_ROOT, 'package-lock.json')),
        reference_source_sha256: sha256File(path.join(REPO_ROOT, 'src/constants/referenceGeometries/index.js')),
        shape_banner: `SHAPE v${bannerMatch[1]}`,
        shape_executable_basename: path.posix.basename(options.shapeExecutable),
        shape_executable_sha256: shapeExecutableSha256,
        shape_expected_sha256: options.expectedShapeSha256.toLowerCase(),
        shape_executable_redistributed: false,
        shape_license_status: 'third-party executable; no license file identified in the audited local installation',
        wsl_registered_distro_name: options.wslDistro,
        wsl_guest_os_pretty_name: osRelease.PRETTY_NAME || 'not_parsed',
        shape_process_locale: 'C',
        shape_process_timezone: 'UTC',
        node_process_locale: Intl.DateTimeFormat().resolvedOptions().locale,
        node_process_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'not_reported',
        qshape_mode: 'default',
        qshape_seed_policy: QSHAPE_SEED_POLICY,
        qshape_explicit_seed_uint32: null,
        qshape_repetitions: QSHAPE_REPETITIONS,
        qshape_repetition_processes: 'independent Node.js worker processes',
        shape_repetitions: SHAPE_REPETITIONS,
        shape_timeout_seconds_per_invocation: 1800,
        max_shape_references_per_control: MAX_SHAPE_REFERENCES_PER_CONTROL,
        reference_listings: referenceListings,
        candidate_source_sha256: candidateFingerprintsAtStart
    };
    writeJson(path.join(metadataRoot, 'run-environment.json'), runMetadata);
    writeText(path.join(reportRoot, 'working-report.md'), buildWorkingReport(analysis.summary, runMetadata));

    setStage('complete', {
        campaign_gate_status: analysis.summary.campaign_gate_status,
        overall_validation_status: 'incomplete'
    });
    const filesForManifest = collectFiles(outputRoot)
        .filter(filePath => !['manifest.json', 'manifest.sha256'].includes(path.basename(filePath)))
        .sort((a, b) => relativeTo(outputRoot, a).localeCompare(relativeTo(outputRoot, b)))
        .map(filePath => ({
            path: relativeTo(outputRoot, filePath),
            size_bytes: fs.statSync(filePath).size,
            sha256: sha256File(filePath)
        }));
    const manifest = {
        schema_version: 2,
        package_status: 'complete',
        release_kind: 'direct_canonical_plus_retained_fixtures',
        campaign_gate_status: analysis.summary.campaign_gate_status,
        overall_validation_status: 'incomplete',
        claim_boundary: analysis.summary.claim_boundary,
        generated_at_utc: generatedAtUtc,
        qshape_commit: qshapeCommit,
        qshape_seed_policy: QSHAPE_SEED_POLICY,
        qshape_explicit_seed_uint32: null,
        shape_executable_sha256: shapeExecutableSha256,
        expected_counts: {
            reference_geometries: 87,
            retained_fixture_cases: 11,
            ideal_reference_cases: 87,
            total_cases: 98,
            matched_target_evaluations_per_program: 952,
            qshape_raw_rows_with_repetitions: 1904,
            shape_raw_rows_with_repetitions: 1904,
            shape_batches: 15,
            shape_runs_with_repetitions: 30
        },
        observed_counts: {
            reference_geometries: inventory.reduce((sum, item) => sum + item.count, 0),
            retained_fixture_cases: fixtureCases.length,
            ideal_reference_cases: idealCases.length,
            total_cases: cases.length,
            matched_target_evaluations_per_program: analysis.summary.totals.comparisons_observed,
            qshape_raw_rows_with_repetitions: qshapeAllRows.length,
            shape_raw_rows_with_repetitions: shapeAllRows.length,
            shape_batches: oracleRepeatability.length,
            shape_runs_with_repetitions: oracleRepeatability.length * SHAPE_REPETITIONS,
            failures: analysis.failures.length
        },
        files: filesForManifest
    };
    const manifestPath = path.join(outputRoot, 'manifest.json');
    writeJson(manifestPath, manifest);
    writeText(path.join(outputRoot, 'manifest.sha256'), `${sha256File(manifestPath)}  manifest.json\n`);

    const verifierResult = run(process.execPath, [
        path.join(REPO_ROOT, 'validation', 'scripts', 'verify-direct-parity.cjs'),
        outputRoot
    ], { allowFailure: true, purpose: 'independent sealed-package verification' });
    let verificationReceipt = null;
    let receiptParseError = null;
    try {
        verificationReceipt = JSON.parse((verifierResult.stdout || '').trim());
    } catch (error) {
        receiptParseError = error.message;
    }
    const manifestSha256 = sha256File(manifestPath);
    writeJson(verificationSidecarPath, {
        schema_version: 1,
        receipt_kind: 'external-independent-verifier-sidecar',
        package_manifest_sha256: manifestSha256,
        verifier_exit_code: verifierResult.status,
        verifier_stderr: verifierResult.stderr || '',
        receipt_parse_error: receiptParseError,
        receipt: verificationReceipt
    });
    const expectedVerifierExit = analysis.summary.campaign_gate_status === 'pass' ? 0 : 2;
    const expectedVerifiedCounts = {
        references: 87,
        cases: 98,
        matched_target_evaluations_per_program: 952,
        qshape_rows_with_repetitions: 1904,
        shape_rows_with_repetitions: 1904,
        shape_batches: 15,
        shape_runs: 30,
        gate_failures: analysis.failures.length
    };
    const verifierAccepted = verifierResult.status === expectedVerifierExit &&
        (verifierResult.stderr || '') === '' && receiptParseError === null &&
        verificationReceipt?.schema_version === 1 &&
        verificationReceipt?.verifier === 'verify-direct-parity.cjs' &&
        verificationReceipt?.verification_status === 'valid' &&
        verificationReceipt?.manifest_sha256 === manifestSha256 &&
        verificationReceipt?.package_status === 'complete' &&
        verificationReceipt?.campaign_gate_status === analysis.summary.campaign_gate_status &&
        verificationReceipt?.overall_validation_status === 'incomplete' &&
        JSON.stringify(verificationReceipt?.verified_counts) ===
            JSON.stringify(expectedVerifiedCounts) &&
        Array.isArray(verificationReceipt?.warnings) &&
        JSON.stringify(verificationReceipt.warnings) ===
            JSON.stringify([...verificationReceipt.warnings].sort());
    if (!verifierAccepted) {
        process.stderr.write(
            `Independent verifier rejected the sealed package; receipt: ${verificationSidecarPath}\n`
        );
        process.exitCode = 3;
        return;
    }

    process.stdout.write(
        `Direct parity package written to ${outputRoot}\n` +
        `Independent verification receipt written to ${verificationSidecarPath}\n` +
        `Campaign gate: ${analysis.summary.campaign_gate_status.toUpperCase()}\n` +
        `Overall validation: INCOMPLETE\n` +
        `Cases: ${cases.length}; matched target evaluations: ${analysis.summary.totals.comparisons_observed}; ` +
        `failures: ${analysis.failures.length}\n`
    );
    if (analysis.summary.campaign_gate_status !== 'pass') process.exitCode = 2;
}

try {
    main();
} catch (error) {
    writeFailureArtifacts(error);
    process.stderr.write(`Direct parity run failed: ${error.stack || error.message}\n`);
    process.exitCode = 3;
}

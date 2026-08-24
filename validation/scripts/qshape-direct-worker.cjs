#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
    float64Hex,
    loadQShape
} = require('./direct-parity-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function parseArguments(argv) {
    const options = {
        output: null,
        cases: null,
        references: null,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        repetition: null
    };
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--output') options.output = argv[++index];
        else if (token === '--cases') options.cases = argv[++index];
        else if (token === '--references') options.references = argv[++index];
        else if (token === '--seed-policy') options.seedPolicy = argv[++index];
        else if (token === '--explicit-seed') options.explicitSeed = Number(argv[++index]);
        else if (token === '--repetition') options.repetition = Number(argv[++index]);
        else throw new Error(`Unknown argument: ${token}`);
    }
    if (!options.output) throw new Error('--output is required');
    if (!options.cases) throw new Error('--cases is required');
    if (!options.references) throw new Error('--references is required');
    if (!['input-derived', 'explicit'].includes(options.seedPolicy)) {
        throw new Error('--seed-policy must be input-derived or explicit');
    }
    if (options.seedPolicy === 'explicit' && (
        !Number.isInteger(options.explicitSeed) ||
        options.explicitSeed < 0 ||
        options.explicitSeed > 0xffffffff
    )) {
        throw new Error('--explicit-seed must be an unsigned 32-bit integer');
    }
    if (options.seedPolicy === 'input-derived' && options.explicitSeed !== null) {
        throw new Error('--explicit-seed is forbidden for input-derived seed policy');
    }
    if (!Number.isInteger(options.repetition) || options.repetition < 1) {
        throw new Error('--repetition must be a positive integer');
    }
    return options;
}

function valueToken(value) {
    if (Object.is(value, -0)) return '-0';
    return Number.isFinite(value) ? value.toPrecision(17) : String(value);
}

function runtimeToken(milliseconds) {
    return Number(milliseconds).toFixed(6);
}

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath, label) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        throw new Error(`${label} is not a regular file: ${resolved}`);
    }
    return { path: resolved, document: JSON.parse(fs.readFileSync(resolved, 'utf8')) };
}

function parseFrozenInputs(casesDocument, referencesDocument) {
    if (casesDocument.schema_version !== 2 || casesDocument.count !== 98 ||
        !Array.isArray(casesDocument.cases) || casesDocument.cases.length !== 98) {
        throw new Error('Invalid frozen case inventory');
    }
    if (referencesDocument.schema_version !== 2 || referencesDocument.count !== 87 ||
        !Array.isArray(referencesDocument.by_cn) || referencesDocument.by_cn.length !== 11) {
        throw new Error('Invalid frozen reference inventory');
    }
    const seenCases = new Set();
    const cases = casesDocument.cases.map(item => {
        if (seenCases.has(item.case_id)) throw new Error(`Duplicate frozen case ${item.case_id}`);
        seenCases.add(item.case_id);
        if (!Number.isInteger(item.cn) || !Array.isArray(item.qshape_actual_ligand_tokens) ||
            item.qshape_actual_ligand_tokens.length !== item.cn) {
            throw new Error(`Invalid frozen ligands for ${item.case_id}`);
        }
        const ligandTokens = item.qshape_actual_ligand_tokens.map((point, pointIndex) => {
            if (!Array.isArray(point) || point.length !== 3 ||
                point.some(token => typeof token !== 'string' || !/^[+-]?\d+\.\d{15}$/.test(token))) {
                throw new Error(`Invalid frozen ligand token for ${item.case_id}/${pointIndex + 1}`);
            }
            return point;
        });
        const actualLigands = ligandTokens.map(point => point.map(token => {
            const value = Number(token);
            if (!Number.isFinite(value)) throw new Error(`Non-finite ligand token in ${item.case_id}`);
            return value;
        }));
        return {
            caseId: item.case_id,
            stratum: item.stratum,
            cn: item.cn,
            ligandTokens,
            actualLigands
        };
    });
    const inventory = referencesDocument.by_cn.map(group => {
        if (!Number.isInteger(group.cn) || !Array.isArray(group.references) ||
            group.count !== group.references.length) {
            throw new Error(`Invalid frozen reference group CN=${group.cn}`);
        }
        const seenCodes = new Set();
        const targets = group.references.map(reference => {
            if (seenCodes.has(reference.qshape_code)) {
                throw new Error(`Duplicate frozen target ${reference.qshape_code}`);
            }
            seenCodes.add(reference.qshape_code);
            const roundtrip = reference.qshape_reference_coordinate_roundtrip_tokens;
            const hex = reference.qshape_reference_coordinate_float64_hex;
            if (!Array.isArray(roundtrip) || !Array.isArray(hex) ||
                roundtrip.length !== group.cn + 1 || hex.length !== group.cn + 1) {
                throw new Error(`Invalid frozen target coordinates for ${reference.qshape_code}`);
            }
            const coordinates = roundtrip.map((point, pointIndex) => {
                if (!Array.isArray(point) || point.length !== 3 ||
                    !Array.isArray(hex[pointIndex]) || hex[pointIndex].length !== 3) {
                    throw new Error(`Invalid frozen target point for ${reference.qshape_code}`);
                }
                return point.map((token, axis) => {
                    const value = Number(token);
                    const canonical = Object.is(value, -0) ? '-0' : value.toPrecision(17);
                    if (!Number.isFinite(value) || token !== canonical ||
                        float64Hex(value) !== hex[pointIndex][axis]) {
                        throw new Error(`Invalid frozen binary64 target for ${reference.qshape_code}`);
                    }
                    return value;
                });
            });
            return {
                code: reference.qshape_code,
                coordinates,
                coordinateRoundtripTokens: roundtrip,
                coordinateFloat64Hex: hex
            };
        });
        return { cn: group.cn, targets };
    });
    if (inventory.reduce((sum, group) => sum + group.targets.length, 0) !== 87) {
        throw new Error('Frozen reference census is not 87');
    }
    return { cases, inventory };
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
    return crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const outputPath = path.resolve(options.output);
    if (fs.existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const frozenCases = readJson(options.cases, 'Frozen case inventory');
    const frozenReferences = readJson(options.references, 'Frozen reference inventory');
    const { cases, inventory } = parseFrozenInputs(
        frozenCases.document, frozenReferences.document
    );
    const { calculateShapeMeasure } = loadQShape(REPO_ROOT);

    const results = [];
    for (const item of cases) {
        const targets = inventory.find(entry => entry.cn === item.cn).targets;
        for (const target of targets) {
            const started = performance.now();
            const result = calculateShapeMeasure(
                item.actualLigands,
                target.coordinates,
                'default',
                null,
                options.seedPolicy === 'explicit'
                    ? { seed: options.explicitSeed }
                    : {}
            );
            const elapsed = performance.now() - started;
            results.push({
                caseId: item.caseId,
                stratum: item.stratum,
                cn: item.cn,
                targetCode: target.code,
                valueToken: valueToken(result.measure),
                valueHex: float64Hex(result.measure),
                runtimeMsToken: runtimeToken(elapsed),
                inputFingerprintSha256: inputFingerprint(
                    item,
                    target,
                    options.seedPolicy,
                    options.seedPolicy === 'explicit' ? options.explicitSeed >>> 0 : null
                ),
                mode: 'default',
                seedPolicy: options.seedPolicy,
                explicitSeed: options.seedPolicy === 'explicit'
                    ? options.explicitSeed >>> 0
                    : null,
                repetition: options.repetition
            });
        }
    }
    if (results.length !== 952) {
        throw new Error(`Unexpected Q-Shape result count: ${results.length}`);
    }
    fs.writeFileSync(outputPath, `${JSON.stringify({
        schema_version: 1,
        program: 'Q-Shape',
        mode: 'default',
        seed_policy: options.seedPolicy,
        explicit_seed_uint32: options.seedPolicy === 'explicit'
            ? options.explicitSeed >>> 0
            : null,
        input_contract: 'manifested-cases-and-references-v1',
        cases_sha256: sha256File(frozenCases.path),
        references_sha256: sha256File(frozenReferences.path),
        repetition: options.repetition,
        count: results.length,
        results
    }, null, 2)}\n`, 'utf8');
    process.stdout.write(`Q-Shape repetition ${options.repetition}: ${results.length} values\n`);
}

function cli() {
    try {
        main();
    } catch (error) {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) cli();

module.exports = {
    inputFingerprint,
    parseFrozenInputs,
    valueToken
};

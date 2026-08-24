#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
    buildFixtureCases,
    buildIdealCases,
    buildReferenceInventory,
    float64Hex,
    loadQShape
} = require('./direct-parity-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function parseArguments(argv) {
    const options = {
        output: null,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        repetition: null
    };
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--output') options.output = argv[++index];
        else if (token === '--seed-policy') options.seedPolicy = argv[++index];
        else if (token === '--explicit-seed') options.explicitSeed = Number(argv[++index]);
        else if (token === '--repetition') options.repetition = Number(argv[++index]);
        else throw new Error(`Unknown argument: ${token}`);
    }
    if (!options.output) throw new Error('--output is required');
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

function main() {
    const options = parseArguments(process.argv.slice(2));
    const outputPath = path.resolve(options.output);
    if (fs.existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const { referenceGeometries, calculateShapeMeasure } = loadQShape(REPO_ROOT);
    const inventory = buildReferenceInventory(referenceGeometries);
    const fixtureCases = buildFixtureCases(REPO_ROOT, inventory);
    const idealCases = buildIdealCases(inventory);
    const cases = [...fixtureCases, ...idealCases].sort(
        (left, right) => left.cn - right.cn ||
            left.stratum.localeCompare(right.stratum) ||
            left.caseId.localeCompare(right.caseId)
    );
    if (cases.length !== 98) throw new Error(`Unexpected Q-Shape case count: ${cases.length}`);

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
        repetition: options.repetition,
        count: results.length,
        results
    }, null, 2)}\n`, 'utf8');
    process.stdout.write(`Q-Shape repetition ${options.repetition}: ${results.length} values\n`);
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
}

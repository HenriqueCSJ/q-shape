'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const core = require('../scripts/direct-parity-core.cjs');
const worker = require('../scripts/qshape-metamorphic-worker.cjs');
const generator = require('../scripts/metamorphic-cases.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
let fixtureDirectory;
let casesPath;
let referencesPath;
let generatedDocument;

function targetRoundtripTokens(target) {
    return target.coordinates.map(point => point.map(value =>
        Object.is(value, -0) ? '-0' : value.toPrecision(17)
    ));
}

function referenceDocument() {
    const { referenceGeometries } = core.loadQShape(REPO_ROOT);
    const inventory = core.buildReferenceInventory(referenceGeometries);
    return {
        schema_version: 2,
        count: 87,
        by_cn: inventory.map(group => ({
            cn: group.cn,
            count: group.count,
            references: group.targets.map(target => ({
                qshape_index: target.index,
                qshape_code: target.code,
                qshape_reference_coordinate_roundtrip_tokens: targetRoundtripTokens(target),
                qshape_reference_coordinate_float64_hex: target.coordinates.map(point =>
                    point.map(core.float64Hex)
                )
            }))
        }))
    };
}

function setupFixtures() {
    if (fixtureDirectory) return;
    fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-worker-'));
    generatedDocument = generator.generateMetamorphicCases(REPO_ROOT).document;
    const casesText = `${JSON.stringify(generatedDocument, null, 2)}\n`;
    assert.equal(
        crypto.createHash('sha256').update(casesText).digest('hex'),
        worker.CAMPAIGN_CASES_SHA256
    );
    casesPath = path.join(fixtureDirectory, 'cases.json');
    referencesPath = path.join(fixtureDirectory, 'references.json');
    fs.writeFileSync(casesPath, casesText, 'utf8');
    fs.writeFileSync(referencesPath, `${JSON.stringify(referenceDocument(), null, 2)}\n`, 'utf8');
}

function commonOptions(overrides = {}) {
    setupFixtures();
    return {
        output: path.join(fixtureDirectory, 'result.json'),
        cases: casesPath,
        references: referencesPath,
        repo: REPO_ROOT,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        repetition: 1,
        stream: 'primary-input-derived',
        shardIndex: 0,
        shardCount: 2871,
        ...overrides
    };
}

test('worker production boundary does not import the case generator', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../scripts/qshape-metamorphic-worker.cjs'),
        'utf8'
    );
    assert.doesNotMatch(source, /metamorphic-cases\.cjs/);
});

test('argument parsing distinguishes absent seed from explicit uint32 seed zero', () => {
    const absent = worker.parseArguments([
        '--output', 'out.json', '--cases', 'cases.json', '--repetition', '1'
    ]);
    assert.equal(absent.seedPolicy, 'input-derived');
    assert.equal(absent.explicitSeed, null);
    assert.equal(absent.stream, 'q_primary_input_derived_r1');

    const explicitZero = worker.parseArguments([
        '--output', 'out.json', '--cases', 'cases.json', '--repetition', '1',
        '--seed-policy', 'explicit', '--explicit-seed', '0'
    ]);
    assert.equal(explicitZero.seedPolicy, 'explicit');
    assert.equal(explicitZero.explicitSeed, 0);
    assert.equal(explicitZero.stream, 'q_explicit_seed_0');
    assert.throws(() => worker.parseArguments([
        '--output', 'out.json', '--cases', 'cases.json', '--repetition', '1',
        '--seed-policy', 'input-derived', '--explicit-seed', '0'
    ]), /forbidden/);
});

test('frozen campaign identity and target census are validated before execution', () => {
    setupFixtures();
    const cases = worker.parseFrozenCases(
        JSON.parse(fs.readFileSync(casesPath, 'utf8')),
        casesPath
    );
    assert.equal(cases.length, 2871);
    assert.equal(cases[0].caseOrdinal, 0);
    assert.equal(cases[2870].caseOrdinal, 2870);
    const inventory = worker.normalizeReferenceDocument(
        JSON.parse(fs.readFileSync(referencesPath, 'utf8'))
    );
    assert.equal(inventory.reduce((sum, group) => sum + group.count, 0), 87);
    const byCn = new Map(inventory.map(group => [group.cn, group]));
    assert.equal(cases.reduce((sum, item) => sum + byCn.get(item.cn).count, 0), 28545);

    const mutatedPath = path.join(fixtureDirectory, 'mutated-cases.json');
    const mutated = { ...generatedDocument, cases: generatedDocument.cases.slice() };
    mutated.cases[0] = { ...mutated.cases[0], case_id: 'mutated-case-id' };
    fs.writeFileSync(mutatedPath, `${JSON.stringify(mutated, null, 2)}\n`, 'utf8');
    assert.throws(() => worker.parseFrozenCases(
        JSON.parse(fs.readFileSync(mutatedPath, 'utf8')),
        mutatedPath
    ), /SHA-256/);
});

test('sharding uses frozen zero-based case ordinal and preserves target order', () => {
    setupFixtures();
    const cases = worker.parseFrozenCases(
        JSON.parse(fs.readFileSync(casesPath, 'utf8')),
        casesPath
    );
    assert.deepEqual(
        worker.selectCaseShard(cases, 0, 3).slice(0, 3).map(item => item.caseOrdinal),
        [0, 3, 6]
    );
    assert.deepEqual(
        worker.selectCaseShard(cases, 2, 3).slice(0, 3).map(item => item.caseOrdinal),
        [2, 5, 8]
    );
});

test('explicit seed zero emits one fully bound result row per case-target key', () => {
    const { payload, results } = worker.runWorker(commonOptions({
        seedPolicy: 'explicit',
        explicitSeed: 0,
        stream: 'q_explicit_seed_0'
    }));
    assert.equal(payload.campaign_id, worker.CAMPAIGN_ID);
    assert.equal(payload.cases_sha256, worker.CAMPAIGN_CASES_SHA256);
    assert.equal(payload.seed_policy, 'explicit');
    assert.equal(payload.explicit_seed_uint32, 0);
    assert.equal(payload.stream, 'q_explicit_seed_0');
    assert.equal(payload.shard_index, 0);
    assert.equal(payload.shard_count, 2871);
    assert.equal(results.length, 3);
    assert.deepEqual(results.map(row => row.targetOrdinal), [1, 2, 3]);
    for (const row of results) {
        assert.equal(row.caseOrdinal, 0);
        assert.equal(row.explicitSeed, 0);
        assert.equal(row.seedPolicy, 'explicit');
        assert.equal(row.qshapeLigandFixed15Tokens.length, 2);
        assert.equal(row.targetReferenceBinary64RoundtripTokens.length, 3);
        assert.match(row.targetReferenceFloat64Hex[0][0], /^[0-9a-f]{16}$/);
        assert.equal(
            row.valueToken,
            Number.isFinite(Number(row.valueToken))
                ? (Object.is(Number(row.valueToken), -0) ? '-0' : Number(row.valueToken).toPrecision(17))
                : row.valueToken
        );
        assert.match(row.valueHex, /^[0-9a-f]{16}$/);
        assert.equal(row.resultFinite, true);
        assert.equal(row.resultDomainValid, true);
        assert.match(row.inputFingerprintSha256, /^[0-9a-f]{64}$/);
        assert.match(row.runtimeMsToken, /^\d+\.\d{6}$/);
    }
});

test('input-derived stream records an absent seed as null', () => {
    const { payload, results } = worker.runWorker(commonOptions({
        shardIndex: 1,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        stream: 'q_primary_input_derived_r1'
    }));
    assert.equal(payload.seed_policy, 'input-derived');
    assert.equal(payload.explicit_seed_uint32, null);
    assert.equal(results.length, 3);
    assert.ok(results.every(row => row.explicitSeed === null));
    assert.ok(results.every(row => row.caseOrdinal === 1));
});

test('non-finite product results retain canonical tokens, IEEE-754 bits, and domain flags', () => {
    const expected = [
        { measure: NaN, token: 'NaN', hex: '7ff8000000000000' },
        { measure: Infinity, token: 'Infinity', hex: '7ff0000000000000' },
        { measure: -Infinity, token: '-Infinity', hex: 'fff0000000000000' }
    ];
    let ordinal = 0;
    const { results } = worker.runWorker(commonOptions({
        seedPolicy: 'explicit',
        explicitSeed: 0,
        stream: 'q_explicit_seed_0'
    }), {
        calculateShapeMeasure: () => ({ measure: expected[ordinal++].measure })
    });
    assert.equal(results.length, expected.length);
    for (const [index, row] of results.entries()) {
        assert.equal(row.valueToken, expected[index].token);
        assert.equal(row.valueHex, expected[index].hex);
        assert.equal(row.resultFinite, false);
        assert.equal(row.resultDomainValid, false);
    }
});

test('full frozen shard emits exactly 28545 ordered case-target rows', () => {
    const { payload, results } = worker.runWorker(commonOptions({
        shardIndex: 0,
        shardCount: 1,
        seedPolicy: 'input-derived',
        explicitSeed: null,
        stream: 'q_primary_input_derived_r1'
    }), {
        // The focused census test uses a constant result so it exercises the
        // complete frozen key space without spending time in the optimizer.
        calculateShapeMeasure: () => ({ measure: 0 })
    });
    assert.equal(payload.count, 28545);
    assert.equal(payload.expected_count, 28545);
    assert.equal(results.length, 28545);
    assert.equal(results[0].caseId, 'meta-cn02-ref01-r01');
    assert.equal(results[0].targetCode, 'L-2');
    assert.equal(results.at(-1).caseId, 'adv-cn12-ref13-r03');
    assert.equal(results.at(-1).targetOrdinal, 13);
});

test('row validator rejects duplicate and missing case-target keys', () => {
    const one = { caseId: 'case-a', targetCode: 'T-2' };
    const two = { caseId: 'case-a', targetCode: 'L-2' };
    assert.deepEqual(worker.validateRows([one, two], [
        worker.pairKey('case-a', 'T-2'),
        worker.pairKey('case-a', 'L-2')
    ]), [one, two]);
    assert.throws(() => worker.validateRows([one, one], [
        worker.pairKey('case-a', 'T-2'),
        worker.pairKey('case-a', 'L-2')
    ]), /Duplicate/);
    assert.throws(() => worker.validateRows([one], [
        worker.pairKey('case-a', 'T-2'),
        worker.pairKey('case-a', 'L-2')
    ]), /expected 2/);
});

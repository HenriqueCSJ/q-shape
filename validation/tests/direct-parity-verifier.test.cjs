'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Decimal = require('decimal.js');

const {
    analyzeDirectParity,
    errorStatistics,
    stats
} = require('../scripts/direct-parity-analysis.cjs');
const verifier = require('../scripts/verify-direct-parity.cjs');
const worker = require('../scripts/qshape-direct-worker.cjs');

test('verifier is implementation-independent and uses no project parser or decimal dependency', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'scripts', 'verify-direct-parity.cjs'),
        'utf8'
    );
    assert.doesNotMatch(source, /require\(['"]\.\/direct-parity/);
    assert.doesNotMatch(source, /require\(['"]decimal\.js/);
});

test('BigInt decimal comparison is exact across exponents and trailing zeros', () => {
    assert.equal(verifier.compareDecimals(
        verifier.parseDecimal('1e-8'), verifier.parseDecimal('0.0000000100')
    ), 0);
    assert.equal(verifier.compareDecimals(
        verifier.parseDecimal('0.009999999999999999'), verifier.parseDecimal('0.01')
    ), -1);
    assert.equal(verifier.compareDecimals(
        verifier.absoluteDecimal(verifier.subtractDecimals(
            verifier.parseDecimal('31.37468'), verifier.parseDecimal('31.375')
        )),
        verifier.parseDecimal('0.000505')
    ), -1);
});

test('independent CSV parser preserves quoted commas, quotes, and embedded newlines', () => {
    const rows = verifier.parseCsv('a,b\n"x,y","line 1\nline ""2"""\n');
    assert.deepEqual(rows, [{ a: 'x,y', b: 'line 1\nline "2"' }]);
});

test('independent SHAPE parsers retain invalid tokens and fixed-width identifiers', () => {
    const out = verifier.parseShapeOut([
        'Structure     1    [F04]',
        ' T-4          Ideal structure    CShM =   31.37468',
        ' SP-4         Ideal structure    CShM =   Infinity'
    ].join('\n'));
    assert.equal(out[0].values[0].lexicallyValid, true);
    assert.equal(out[0].values[1].lexicallyValid, false);
    const tab = verifier.parseShapeTab([
        'Structure [ML4 ]          T-4         SP-4',
        ` ${'F04'.padEnd(15, ' ')},      31.375,       0.970`
    ].join('\n'));
    assert.equal(tab.structures[0].structureId, 'F04');
    assert.deepEqual(tab.targetCodes, ['T-4', 'SP-4']);
});

test('independent .dat parser enforces center index and fixed 15-decimal tokens', () => {
    const dat = [
        '$ Q-Shape direct parity validation, CN=2',
        '%fullout',
        '2 1',
        '1 3',
        'F02',
        'Fe  0.000000000000000 0.000000000000000 0.000000000000000',
        'C   1.000000000000000 0.000000000000000 0.000000000000000',
        'C   -1.000000000000000 0.000000000000000 0.000000000000000',
        ''
    ].join('\n');
    const parsed = verifier.parseShapeDat(dat, 2);
    assert.deepEqual(parsed.targetIndices, [1, 3]);
    assert.equal(parsed.structures[0].atoms.length, 3);
    assert.throws(() => verifier.parseShapeDat(dat.replace('2 1', '2 2'), 2),
        /center control/);
});

test('float64 verification distinguishes negative zero and exact round-trip tokens', () => {
    assert.equal(verifier.float64Hex(0), '0000000000000000');
    assert.equal(verifier.float64Hex(Number('-0')), '8000000000000000');
});

test('worker decimals must use the unique canonical binary64 round-trip spelling', () => {
    assert.equal(verifier.canonicalBinary64Token('0.010000000000000000'), 0.01);
    assert.equal(verifier.canonicalBinary64Token('1.0000000000000000e-8'), 1e-8);
    assert.equal(verifier.canonicalBinary64Token('0.020010000000000000'), 0.02001);
    assert.ok(Object.is(verifier.canonicalBinary64Token('-0'), -0));
    for (const alternative of ['0.01', '0.0100', '1e-8', '0.02001', '-0.0']) {
        assert.throws(() => verifier.canonicalBinary64Token(alternative), /canonical/);
    }
});

test('independent fixed-decimal rendering uses exact decimal half-up rounding', () => {
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('1.234565'), 5), '1.23457');
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('1.234564999'), 5), '1.23456');
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('100'), 5), '100.00000');
});

test('independent significant-decimal rendering matches the analysis contract', () => {
    const tokens = [
        '0', '-0', '1e-8', '1e-7', '1e-6', '0.010000000000000001',
        '0.009999999999999999', '999999999999999999.5', '9999999999999999999',
        '1e20', '1e21', '-12345678901234567895', '0.00000009999999999999999995'
    ];
    for (const token of tokens) {
        const expected = new Decimal(token).toSignificantDigits(18).toString();
        assert.equal(
            verifier.decimalToSignificantHalfUp(verifier.parseDecimal(token)),
            expected,
            token
        );
    }
});

test('independent rational and square-root rounding match Decimal.js', () => {
    const rationalCases = [
        [1n, 3n], [2n, 3n], [9999999999999999995n, 10n],
        [-1n, 7n], [1n, 10n ** 40n], [10n ** 40n, 7n]
    ];
    for (const [numerator, denominator] of rationalCases) {
        const expected = new Decimal(numerator.toString())
            .dividedBy(denominator.toString()).toSignificantDigits(18).toString();
        assert.equal(verifier.rationalToSignificantHalfUp(numerator, denominator), expected);
    }
    const squareRootCases = [
        [1n, 2n], [2n, 3n], [1n, 10n ** 41n],
        [999999999999999999n, 7n], [10n ** 45n, 3n]
    ];
    for (const [numerator, denominator] of squareRootCases) {
        const expected = new Decimal(numerator.toString())
            .dividedBy(denominator.toString()).sqrt().toSignificantDigits(18).toString();
        assert.equal(
            verifier.sqrtRationalToSignificantHalfUp(numerator, denominator),
            expected
        );
    }
});

test('independent exact statistics reproduce Decimal.js tokens', () => {
    const signedTokens = [
        '0.010000000000000001', '-0.009999999999999999',
        '0.000000000000000003', '-0.000000000000000002', '1.2345678901234567'
    ];
    const runtimeTokens = ['0.001', '1.234', '2.345', '3.456', '99.999', '100.001'];
    assert.deepEqual(
        verifier.exactDecimalErrorStatistics(signedTokens.map(verifier.parseDecimal)),
        errorStatistics(signedTokens.map(token => new Decimal(token)))
    );
    assert.deepEqual(
        verifier.exactDecimalDistribution(runtimeTokens.map(verifier.parseDecimal)),
        stats(runtimeTokens.map(token => new Decimal(token)))
    );
});

test('data dictionary is independently frozen field for field', () => {
    assert.deepEqual(verifier.expectedDataDictionary(), {
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
            runtime_ms: {
                meaning: 'worker wall time per target',
                unit: 'ms',
                claim_boundary: 'diagnostic only'
            }
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
    });
});

test('working report is reconstructed exactly from summary and environment values', () => {
    const summary = {
        campaign_gate_status: 'pass',
        overall_validation_status: 'incomplete',
        totals: {
            cases: 98,
            comparisons_observed: 952,
            failures: 0,
            error_statistics: {
                mean_absolute_error: '0.001',
                root_mean_square_error: '0.002',
                median_absolute_error: '0.0009',
                p95_absolute_error: '0.004',
                p99_absolute_error: '0.006',
                max_absolute_error: '0.009',
                signed_bias: '-0.0001'
            },
            runtime_statistics_ms: {
                mean: '1', median: '2', p95: '3', p99: '4', max: '5'
            }
        }
    };
    const environment = {
        qshape_commit: '0123456789abcdef',
        qshape_seed_policy: 'input-derived',
        shape_banner: 'SHAPE v2.1',
        shape_executable_sha256: 'a'.repeat(64)
    };
    const report = verifier.expectedWorkingReport(summary, environment);
    assert.match(report, /Direct-campaign gate: \*\*PASS\*\*\./);
    assert.match(report, /MAE \/ RMSE: 0\.001 \/ 0\.002 CShM\./);
    assert.match(report, /Signed bias: -0\.0001 CShM\./);
    assert.match(report, /maximum: 1 \/ 2 \/ 3 \/ 4 \/ 5 ms\./);
    assert.ok(report.endsWith('\n'));
});

test('failure ledger reconstruction binds every semantic and provenance field', () => {
    const caseById = new Map([['case-1', {
        case_id: 'case-1', stratum: 'retained_fixture', cn: 4
    }]]);
    const event = {
        caseId: 'case-1',
        gate: 'absolute_error',
        targetCode: 'T-4',
        comparisonCode: '',
        observed: '0.01',
        threshold: '<0.01 CShM',
        details: 'Q-Shape 1.01; SHAPE 1.00',
        shapeRawPath: 'oracle/raw/cn04.out',
        qshapeRawPath: 'qshape/raw/repetition-01.json'
    };
    const [row] = verifier.expectedFailureLedger([event], caseById);
    assert.deepEqual({ ...row, failure_id: '' }, {
        failure_id: '',
        case_id: 'case-1',
        stratum: 'retained_fixture',
        cn: '4',
        gate: 'absolute_error',
        target_code: 'T-4',
        comparison_code: '',
        observed: '0.01',
        threshold: '<0.01 CShM',
        details: 'Q-Shape 1.01; SHAPE 1.00',
        shape_raw_path: 'oracle/raw/cn04.out',
        qshape_raw_path: 'qshape/raw/repetition-01.json',
        severity: 'gate_failure',
        status: 'fail'
    });
    assert.match(row.failure_id, /^failure-[0-9a-f]{16}$/);
    const [changed] = verifier.expectedFailureLedger([
        { ...event, observed: '0.02' }
    ], caseById);
    assert.notEqual(changed.failure_id, row.failure_id);
    const duplicateRows = verifier.expectedFailureLedger([event, event], caseById);
    assert.equal(duplicateRows[1].failure_id, `${duplicateRows[0].failure_id}-2`);
});

test('independent gate reconstruction matches the analyzer failure ledger exactly', () => {
    const cases = [
        {
            caseId: 'fixture-cn02',
            stratum: 'retained_fixture',
            cn: 2,
            sourceName: 'fixture'
        },
        {
            caseId: 'ideal-cn02-a',
            stratum: 'ideal_reference',
            cn: 2,
            sourceName: 'ideal A',
            expectedOwnTargetCode: 'A'
        }
    ];
    const inventory = [{
        cn: 2,
        count: 2,
        targets: [
            { code: 'A', name: 'reference A', shapeCode: 'L-2' },
            { code: 'B', name: 'reference B', shapeCode: 'A-2' }
        ]
    }];
    const values = {
        'fixture-cn02': {
            A: { shape: '0.00000', qshape: '0.02' },
            B: { shape: '0.05000', qshape: '0' }
        },
        'ideal-cn02-a': {
            A: { shape: '0.03000', qshape: '1e-8' },
            B: { shape: '0.00000', qshape: '0' }
        }
    };
    const shapeRows = [];
    const qshapeRows = [];
    for (const item of cases) {
        for (const target of inventory[0].targets) {
            const value = values[item.caseId][target.code];
            shapeRows.push({
                caseId: item.caseId,
                targetCode: target.code,
                shapeCode: target.shapeCode,
                valueToken: value.shape,
                lexicallyValid: true,
                rawLineNumber: 10,
                rawPath: `oracle/raw/${item.caseId}.out`
            });
            qshapeRows.push({
                caseId: item.caseId,
                targetCode: target.code,
                valueToken: value.qshape,
                valueHex: '0000000000000000',
                lexicallyValid: true,
                runtimeMsToken: '1',
                seedPolicy: 'input-derived',
                explicitSeed: '',
                rawPath: 'qshape/raw/repetition-01.json'
            });
        }
    }
    const analyzed = analyzeDirectParity({ cases, inventory, shapeRows, qshapeRows });
    const verifierCases = cases.map(item => ({
        case_id: item.caseId,
        stratum: item.stratum,
        cn: item.cn,
        expected_own_target_code: item.expectedOwnTargetCode ?? ''
    }));
    const casesState = {
        cases: verifierCases,
        caseById: new Map(verifierCases.map(item => [item.case_id, item]))
    };
    const referencesByCn = new Map([[2, inventory[0].targets.map(target => ({
        qshape_code: target.code,
        qshape_name: target.name,
        shape_code: target.shapeCode
    }))]]);
    const events = [];
    verifier.recomputeAnalysis(casesState, referencesByCn, shapeRows, qshapeRows, events);
    const reconstructed = verifier.expectedFailureLedger(events, casesState.caseById);
    const expected = analyzed.failures.map(row => ({ ...row, cn: String(row.cn) }));
    assert.deepEqual(reconstructed, expected);
});

test('Q-Shape input fingerprint freezes ligand order, target bits, mode, and seed', () => {
    const item = {
        caseId: 'fixture-cn02',
        cn: 2,
        ligandTokens: [
            ['1.000000000000000', '0.000000000000000', '0.000000000000000'],
            ['-1.000000000000000', '0.000000000000000', '0.000000000000000']
        ]
    };
    const target = {
        code: 'L-2',
        coordinateRoundtripTokens: [
            ['1.0000000000000000', '0.0000000000000000', '-0'],
            ['-1.0000000000000000', '0.0000000000000000', '0.0000000000000000'],
            ['0.0000000000000000', '0.0000000000000000', '0.0000000000000000']
        ],
        coordinateFloat64Hex: [
            ['3ff0000000000000', '0000000000000000', '8000000000000000'],
            ['bff0000000000000', '0000000000000000', '0000000000000000'],
            ['0000000000000000', '0000000000000000', '0000000000000000']
        ]
    };
    const fingerprint = worker.inputFingerprint(item, target, 'input-derived', null);
    assert.equal(fingerprint,
        '40a31897704b42f8cb327043a23aa82fe2dbbc2b9c863f1d8586d3d582167e07');
    const reordered = { ...item, ligandTokens: [...item.ligandTokens].reverse() };
    assert.notEqual(worker.inputFingerprint(reordered, target, 'input-derived', null), fingerprint);
    const changedSignBit = {
        ...target,
        coordinateFloat64Hex: target.coordinateFloat64Hex.map(point => [...point])
    };
    changedSignBit.coordinateFloat64Hex[0][2] = '0000000000000000';
    assert.notEqual(worker.inputFingerprint(item, changedSignBit, 'input-derived', null), fingerprint);
});

test('verifier CLI classifies a missing package as invalid rather than an internal error', () => {
    const script = path.resolve(__dirname, '..', 'scripts', 'verify-direct-parity.cjs');
    const missing = path.resolve(__dirname, 'definitely-missing-package');
    const result = spawnSync(process.execPath, [script, missing], { encoding: 'utf8' });
    assert.equal(result.status, 3);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.verification_status, 'invalid');
    assert.match(receipt.error, /does not exist/);
});

test('external sidecar must equal a fresh verifier receipt byte for byte', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-sidecar-test-'));
    try {
        const packagePath = path.join(temporaryRoot, 'package');
        fs.mkdirSync(packagePath);
        const receipt = {
            schema_version: 1,
            verifier: 'verify-direct-parity.cjs',
            verification_status: 'valid',
            manifest_sha256: 'a'.repeat(64),
            package_status: 'complete',
            campaign_gate_status: 'pass',
            overall_validation_status: 'incomplete',
            verified_counts: { cases: 98 },
            warnings: []
        };
        const sidecarPath = `${packagePath}.verification.json`;
        const sidecar = {
            schema_version: 1,
            receipt_kind: 'external-independent-verifier-sidecar',
            package_manifest_sha256: receipt.manifest_sha256,
            verifier_exit_code: 0,
            verifier_stderr: '',
            receipt_parse_error: null,
            receipt: JSON.parse(JSON.stringify(receipt))
        };
        fs.writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
        assert.equal(
            verifier.verifyExternalSidecarIfPresent(packagePath, receipt),
            sidecarPath
        );
        sidecar.receipt.verified_counts.cases = 97;
        fs.writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
        assert.throws(
            () => verifier.verifyExternalSidecarIfPresent(packagePath, receipt),
            /does not exactly match/
        );
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
});

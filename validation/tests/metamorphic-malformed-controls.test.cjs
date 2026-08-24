'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { generateMetamorphicCases } = require('../scripts/metamorphic-cases.cjs');
const {
    CONTROL_CAMPAIGN_ID,
    POSITIVE_CASES_SHA256,
    buildMalformedControlDocument,
    executeMalformedControls,
    main,
    sha256Buffer,
    validateMalformedControlDocument
} = require('../scripts/metamorphic-malformed-controls.cjs');
const { loadQShape } = require('../scripts/direct-parity-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let positive;

test.before(() => {
    loadQShape(REPO_ROOT);
    positive = generateMetamorphicCases(REPO_ROOT).document;
    const pretty = Buffer.from(`${JSON.stringify(positive, null, 2)}\n`, 'utf8');
    assert.equal(sha256Buffer(pretty), POSITIVE_CASES_SHA256);
});

test('malformed registry is deterministic, typed, and covers the frozen seven categories', () => {
    const first = buildMalformedControlDocument(positive);
    const second = buildMalformedControlDocument(positive);
    assert.deepEqual(first, second);
    assert.equal(first.campaign_id, CONTROL_CAMPAIGN_ID);
    assert.equal(first.count, 7);
    assert.equal(validateMalformedControlDocument(first), true);
    assert.deepEqual(
        first.controls.map(control => control.category),
        [
            'missing_center',
            'misplaced_center',
            'incorrect_point_count',
            'nonfinite_token',
            'duplicate_ligand',
            'effectively_zero_length_ligand',
            'unsupported_coordination_number'
        ]
    );
    assert.equal(first.status, 'preregistered_product_boundary_probes');
    assert.ok(first.controls.every(control => control.campaign_gate === 'malformed_control_contract'));
    assert.deepEqual(first.controls.map(control => control.expected_numeric_rows), [1, 1, 0, 0, 1, 0, 0]);
    assert.deepEqual(first.controls.map(control => control.expected_outcome), [
        'accepted_with_numeric_rows',
        'accepted_with_numeric_rows',
        'nonfinite_result',
        'nonfinite_result',
        'finite_result',
        'nonfinite_result',
        'reference_set_unavailable'
    ]);
});

test('center controls apply only to the raw SHAPE .dat product interface', () => {
    const document = buildMalformedControlDocument(positive);
    const centerControls = document.controls.filter(control => control.category.includes('center'));
    assert.equal(centerControls.length, 2);
    assert.ok(centerControls.every(control => control.interface === 'shape_2_1_raw_dat'));
    assert.ok(document.controls
        .filter(control => control.program === 'Q-Shape')
        .every(control => !control.category.includes('center')));
});

test('control CLI refuses overwrite and preserves a hash-stable document', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-malformed-'));
    const positivePath = path.join(tempRoot, 'positive.json');
    const outputPath = path.join(tempRoot, 'controls.json');
    fs.writeFileSync(positivePath, `${JSON.stringify(positive, null, 2)}\n`);

    assert.equal(main(['--positive', positivePath, '--output', outputPath]), 0);
    const first = fs.readFileSync(outputPath);
    assert.equal(validateMalformedControlDocument(JSON.parse(first)), true);
    assert.throws(
        () => main(['--positive', positivePath, '--output', outputPath]),
        /output path already exists/
    );
    assert.deepEqual(fs.readFileSync(outputPath), first);
});

test('tampered source identity and partial-row policy are rejected', () => {
    const document = buildMalformedControlDocument(positive);
    const sourceTamper = structuredClone(document);
    sourceTamper.source_positive_cases_sha256 = '0'.repeat(64);
    assert.throws(() => validateMalformedControlDocument(sourceTamper), /source hash mismatch/);

    const rowTamper = structuredClone(document);
    rowTamper.controls[0].expected_numeric_rows = -1;
    assert.throws(() => validateMalformedControlDocument(rowTamper), /numeric-row count is invalid/);
});

test('synthetic validator is explicitly harness-only and is not product evidence', () => {
    const document = buildMalformedControlDocument(positive);
    const execution = executeMalformedControls(document);

    assert.equal(execution.count, 7);
    assert.equal(execution.passed, 7);
    assert.equal(execution.failed, 0);
    assert.equal(execution.evidence_scope, 'synthetic_harness_only');
    assert.equal(execution.product_boundary_invoked, false);
    assert.equal(execution.campaign_gate_status, 'not_scientific_evidence');
    assert.ok(execution.results.every(result => result.status === 'harness_match'));
    assert.ok(execution.results.every(result => result.evidence_scope === 'synthetic_harness_only'));
    assert.ok(execution.results.every(result => result.product_boundary_invoked === false));
    assert.ok(execution.results.every(result => result.observed_numeric_rows === 0));
    assert.deepEqual(
        execution.results.map(result => result.observed_rejection_code),
        document.controls.map(control => control.harness_only_expected_rejection_code)
    );
});

test('synthetic harness mismatch remains diagnostic rather than a scientific campaign gate', () => {
    const document = buildMalformedControlDocument(positive);
    document.controls[0].harness_only_expected_rejection_code = 'shape.center_misplaced';
    const execution = executeMalformedControls(document);

    assert.equal(execution.passed, 6);
    assert.equal(execution.failed, 1);
    assert.equal(execution.campaign_gate_status, 'not_scientific_evidence');
    assert.equal(execution.results[0].harness_only_expected_rejection_code, 'shape.center_misplaced');
    assert.equal(execution.results[0].observed_rejection_code, 'shape.center_missing_at_position_1');
    assert.equal(execution.results[0].observed_numeric_rows, 0);
    assert.equal(execution.results[0].status, 'harness_mismatch');
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    buildExecutionInputBundle,
    main,
    sha256,
    writeExecutionInputBundle
} = require('../scripts/freeze-metamorphic-execution-inputs.cjs');

const DIRECT_REFERENCES = path.resolve(
    'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/',
    'validation_runs/direct-parity-feec5b2-qualification-20260824/references.json'
);
const FROZEN_CASES = path.resolve(
    'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/',
    'validation_preregistrations/metamorphic-adversarial-v1-102895a8-20260824/cases.json'
);
const SOURCE_COMMIT = '1'.repeat(40);

function build() {
    return buildExecutionInputBundle(
        fs.readFileSync(DIRECT_REFERENCES),
        fs.readFileSync(FROZEN_CASES),
        SOURCE_COMMIT
    );
}

test('execution-input bundle is deterministic, input-only, and hash-binds all three frozen sources', () => {
    const first = build();
    const second = build();
    assert.deepEqual(first, second);
    assert.match(first.bundleSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(first.files).sort(), [
        'STATUS.md', 'malformed-controls.json', 'receipt.json', 'references.json'
    ]);
    assert.equal(first.receipt.positive_execution_started, false);
    assert.equal(first.receipt.positive_cases.count, 2871);
    assert.equal(first.receipt.references.count, 87);
    assert.equal(first.receipt.malformed_controls.count, 7);
    assert.equal(first.receipt.malformed_controls.expected_numeric_rows_contract, 'per-control');
    assert.deepEqual(first.receipt.malformed_controls.expected_numeric_rows_by_control, {
        'mal-shape-center-missing-01': 1,
        'mal-shape-center-misplaced-01': 1,
        'mal-qshape-point-count-01': 0,
        'mal-qshape-nonfinite-01': 0,
        'mal-qshape-duplicate-01': 1,
        'mal-qshape-zero-length-01': 0,
        'mal-qshape-unsupported-cn-01': 0
    });
    assert.equal(first.receipt.malformed_controls.expected_numeric_rows_total, 3);
    assert.equal(sha256(first.files['references.json']), first.receipt.references.sha256);
    assert.equal(sha256(first.files['malformed-controls.json']), first.receipt.malformed_controls.sha256);
    assert.doesNotMatch(first.files['STATUS.md'].toString('utf8'), /result|pass/i);
});

test('bundle writer creates an exact four-file directory and refuses reuse', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-freeze-'));
    const output = path.join(parent, 'bundle');
    const bundle = build();
    assert.equal(writeExecutionInputBundle(output, bundle), path.resolve(output));
    assert.deepEqual(fs.readdirSync(output).sort(), Object.keys(bundle.files).sort());
    assert.throws(() => writeExecutionInputBundle(output, bundle), /already exists/);
});

test('freeze CLI requires a source commit and never overwrites an existing directory', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-freeze-cli-'));
    const output = path.join(parent, 'bundle');
    const args = [
        '--direct', DIRECT_REFERENCES,
        '--cases', FROZEN_CASES,
        '--source-commit', SOURCE_COMMIT,
        '--output', output
    ];
    assert.equal(main(args), 0);
    assert.throws(() => main(args), /already exists/);
    assert.equal(main(['--direct', DIRECT_REFERENCES]), 64);
});

test('source-commit and source-byte mutations are rejected before directory creation', () => {
    const direct = fs.readFileSync(DIRECT_REFERENCES);
    const cases = fs.readFileSync(FROZEN_CASES);
    assert.throws(() => buildExecutionInputBundle(direct, cases, 'bad'), /source commit/);
    const mutated = Buffer.from(cases);
    mutated[mutated.length - 2] ^= 1;
    assert.throws(() => buildExecutionInputBundle(direct, mutated, SOURCE_COMMIT), /cases SHA-256/);
});

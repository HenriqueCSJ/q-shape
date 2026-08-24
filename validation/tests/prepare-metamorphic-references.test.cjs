'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    DIRECT_REFERENCES_SHA256,
    buildMetamorphicReferenceDocument,
    main,
    sha256Buffer,
    validateMetamorphicReferenceDocument
} = require('../scripts/prepare-metamorphic-references.cjs');
const { verifyFrozenInputs } = require('../scripts/verify-metamorphic-parity.cjs');

const DIRECT_REFERENCES = path.resolve(
    'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/',
    'validation_runs/direct-parity-feec5b2-qualification-20260824/references.json'
);
const FROZEN_CASES = path.resolve(
    'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/',
    'validation_preregistrations/metamorphic-adversarial-v1-102895a8-20260824/cases.json'
);

function sourceDocuments() {
    const directBytes = fs.readFileSync(DIRECT_REFERENCES);
    const casesBytes = fs.readFileSync(FROZEN_CASES);
    assert.equal(sha256Buffer(directBytes), DIRECT_REFERENCES_SHA256);
    return {
        direct: JSON.parse(directBytes.toString('utf8')),
        cases: JSON.parse(casesBytes.toString('utf8')),
        casesBytes
    };
}

test('enhanced reference inventory is deterministic and independently reconstructs all frozen inputs', () => {
    const { direct, cases, casesBytes } = sourceDocuments();
    const first = buildMetamorphicReferenceDocument(direct, cases);
    const second = buildMetamorphicReferenceDocument(direct, cases);

    assert.deepEqual(first, second);
    assert.equal(validateMetamorphicReferenceDocument(first, cases), true);
    assert.equal(first.count, 87);
    assert.equal(first.by_cn.length, 11);
    assert.ok(first.by_cn.flatMap(group => group.references)
        .every(reference => reference.qshape_point_group && reference.qshape_chirality));
    assert.deepEqual(verifyFrozenInputs(cases, first, casesBytes), {
        campaign_id: 'qshape-metamorphic-adversarial-v1',
        cases_sha256: '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd',
        reference_count: 87,
        case_count: 2871,
        matched_pairs_per_program: 28545,
        input_reconstruction_status: 'pass'
    });
});

test('inconsistent point-group provenance is rejected before output is constructed', () => {
    const { direct, cases } = sourceDocuments();
    const tampered = structuredClone(cases);
    const sibling = tampered.cases.find(item =>
        item.parent_reference_code === tampered.cases[0].parent_reference_code &&
        item.case_id !== tampered.cases[0].case_id
    );
    sibling.reference_point_group = 'tampered';
    assert.throws(() => buildMetamorphicReferenceDocument(direct, tampered), /inconsistent qshape_point_group/);
});

test('reference CLI verifies both certified sources and refuses overwrite', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-refs-'));
    const output = path.join(tempRoot, 'references.json');
    const args = ['--direct', DIRECT_REFERENCES, '--cases', FROZEN_CASES, '--output', output];

    assert.equal(main(args), 0);
    const first = fs.readFileSync(output);
    assert.equal(validateMetamorphicReferenceDocument(JSON.parse(first)), true);
    assert.throws(() => main(args), /output path already exists/);
    assert.deepEqual(fs.readFileSync(output), first);
});

#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const POSITIVE_CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const POSITIVE_CASES_SHA256 =
    '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd';
const CONTROL_CAMPAIGN_ID = 'qshape-metamorphic-malformed-v1';
const PARENT_CASE_ID = 'meta-cn04-ref01-r01';
const FIXED15_PATTERN = /^[+-]?\d+\.\d{15}$/;

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function fixed15(value) {
    return Number(value).toFixed(15);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function buildUnsupportedLigands() {
    return Array.from({ length: 13 }, (_, index) => {
        const n = index + 1;
        return [fixed15(n), fixed15(n * n), fixed15(n * n * n)];
    });
}

function buildMalformedControlDocument(positiveDocument, sourceSha256 = POSITIVE_CASES_SHA256) {
    assert(positiveDocument?.schema_version === 1, 'positive schema_version must be 1');
    assert(positiveDocument?.campaign_id === POSITIVE_CAMPAIGN_ID, 'positive campaign_id mismatch');
    assert(positiveDocument?.count === 2871, 'positive case count mismatch');
    assert(sourceSha256 === POSITIVE_CASES_SHA256, 'positive cases SHA-256 mismatch');

    const parent = positiveDocument.cases?.find(item => item.case_id === PARENT_CASE_ID);
    assert(parent, `missing parent case ${PARENT_CASE_ID}`);
    assert(parent.cn === 4, 'malformed-control parent CN must be 4');
    assert(parent.qshape_actual_ligand_tokens?.length === 4, 'parent must contain four Q ligands');
    assert(parent.shape_atoms?.length === 5, 'parent must contain center plus four SHAPE ligands');

    const parentLigands = clone(parent.qshape_actual_ligand_tokens);
    const parentShapeAtoms = clone(parent.shape_atoms);
    const center = parentShapeAtoms[0];
    const shapeLigands = parentShapeAtoms.slice(1);

    const missingCenterAtoms = [
        ...clone(shapeLigands),
        { element: 'C', tokens: ['0.250000000000000', '0.250000000000000', '0.250000000000000'] }
    ];
    const misplacedCenterAtoms = [...clone(shapeLigands), clone(center)];
    const incorrectPointCount = clone(parentLigands.slice(0, 3));
    const nonfinite = clone(parentLigands);
    nonfinite[1][2] = 'NaN';
    const duplicate = clone(parentLigands);
    duplicate[1] = clone(duplicate[0]);
    const effectivelyZero = clone(parentLigands);
    effectivelyZero[0] = ['0.000001000000000', '0.000000000000000', '0.000000000000000'];

    const shared = Object.freeze({
        source_parent_case_id: parent.case_id,
        source_parent_reference_code: parent.parent_reference_code,
        source_parent_reference_fingerprint_sha256: parent.parent_reference_fingerprint_sha256,
        campaign_gate: 'malformed_control_contract'
    });

    const controls = [
        {
            control_id: 'mal-shape-center-missing-01',
            program: 'SHAPE 2.1',
            interface: 'shape_2_1_raw_dat',
            category: 'missing_center',
            cn: 4,
            expected_outcome: 'accepted_with_numeric_rows',
            expected_numeric_rows: 1,
            harness_only_expected_rejection_code: 'shape.center_missing_at_position_1',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', target_index: 1, atoms: missingCenterAtoms }
        },
        {
            control_id: 'mal-shape-center-misplaced-01',
            program: 'SHAPE 2.1',
            interface: 'shape_2_1_raw_dat',
            category: 'misplaced_center',
            cn: 4,
            expected_outcome: 'accepted_with_numeric_rows',
            expected_numeric_rows: 1,
            harness_only_expected_rejection_code: 'shape.center_misplaced',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', target_index: 1, atoms: misplacedCenterAtoms }
        },
        {
            control_id: 'mal-qshape-point-count-01',
            program: 'Q-Shape',
            interface: 'qshape_core_calculator',
            category: 'incorrect_point_count',
            cn: 4,
            expected_outcome: 'nonfinite_result',
            expected_numeric_rows: 0,
            harness_only_expected_rejection_code: 'qshape.ligand_count_mismatch',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', ligand_tokens: incorrectPointCount }
        },
        {
            control_id: 'mal-qshape-nonfinite-01',
            program: 'Q-Shape',
            interface: 'qshape_core_calculator',
            category: 'nonfinite_token',
            cn: 4,
            expected_outcome: 'nonfinite_result',
            expected_numeric_rows: 0,
            harness_only_expected_rejection_code: 'qshape.nonfinite_coordinate_token',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', ligand_tokens: nonfinite }
        },
        {
            control_id: 'mal-qshape-duplicate-01',
            program: 'Q-Shape',
            interface: 'qshape_core_calculator',
            category: 'duplicate_ligand',
            cn: 4,
            expected_outcome: 'finite_result',
            expected_numeric_rows: 1,
            harness_only_expected_rejection_code: 'qshape.duplicate_ligand',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', ligand_tokens: duplicate }
        },
        {
            control_id: 'mal-qshape-zero-length-01',
            program: 'Q-Shape',
            interface: 'qshape_core_calculator',
            category: 'effectively_zero_length_ligand',
            cn: 4,
            expected_outcome: 'nonfinite_result',
            expected_numeric_rows: 0,
            harness_only_expected_rejection_code: 'qshape.effectively_zero_length_ligand',
            ...shared,
            input: { declared_cn: 4, target_code: 'SP-4', ligand_tokens: effectivelyZero }
        },
        {
            control_id: 'mal-qshape-unsupported-cn-01',
            program: 'Q-Shape',
            interface: 'qshape_reference_registry',
            category: 'unsupported_coordination_number',
            cn: 13,
            expected_outcome: 'reference_set_unavailable',
            expected_numeric_rows: 0,
            harness_only_expected_rejection_code: 'qshape.unsupported_coordination_number',
            ...shared,
            input: { declared_cn: 13, target_code: null, ligand_tokens: buildUnsupportedLigands() }
        }
    ];

    return {
        schema_version: 1,
        campaign_id: CONTROL_CAMPAIGN_ID,
        status: 'preregistered_product_boundary_probes',
        claim_boundary: 'raw SHAPE 2.1 .dat execution and Q-Shape core calculator/reference-registry behavior; legacy typed codes are synthetic-harness diagnostics only, not product API outcomes or scientific gates; browser behavior is not tested',
        source_positive_campaign_id: POSITIVE_CAMPAIGN_ID,
        source_positive_cases_sha256: POSITIVE_CASES_SHA256,
        expected_numeric_rows_policy: 'per-control product-boundary contract',
        count: controls.length,
        controls
    };
}

function validateTokenMatrix(matrix, allowNonfinite = false) {
    assert(Array.isArray(matrix), 'coordinate matrix must be an array');
    for (const row of matrix) {
        assert(Array.isArray(row) && row.length === 3, 'every coordinate row must have three tokens');
        for (const token of row) {
            assert(
                allowNonfinite ? typeof token === 'string' : FIXED15_PATTERN.test(token),
                `invalid coordinate token ${String(token)}`
            );
        }
    }
}

function validateMalformedControlDocument(document) {
    assert(document?.schema_version === 1, 'control schema_version must be 1');
    assert(document?.campaign_id === CONTROL_CAMPAIGN_ID, 'control campaign_id mismatch');
    assert(document?.status === 'preregistered_product_boundary_probes', 'control status mismatch');
    assert(document?.claim_boundary ===
        'raw SHAPE 2.1 .dat execution and Q-Shape core calculator/reference-registry behavior; legacy typed codes are synthetic-harness diagnostics only, not product API outcomes or scientific gates; browser behavior is not tested',
    'control claim boundary mismatch');
    assert(document?.source_positive_campaign_id === POSITIVE_CAMPAIGN_ID, 'source campaign mismatch');
    assert(document?.source_positive_cases_sha256 === POSITIVE_CASES_SHA256, 'source hash mismatch');
    assert(document?.expected_numeric_rows_policy === 'per-control product-boundary contract',
        'numeric-row policy mismatch');
    assert(document?.count === 7, 'control count must be 7');
    assert(Array.isArray(document.controls) && document.controls.length === document.count, 'controls count mismatch');

    const ids = new Set();
    const categories = new Set();
    for (const control of document.controls) {
        assert(!ids.has(control.control_id), `duplicate control_id ${control.control_id}`);
        ids.add(control.control_id);
        categories.add(control.category);
        assert(Number.isInteger(control.expected_numeric_rows) && control.expected_numeric_rows >= 0,
            `${control.control_id} expected numeric-row count is invalid`);
        assert(typeof control.expected_outcome === 'string' && control.expected_outcome.length > 0,
            `${control.control_id} expected outcome mismatch`);
        assert(control.campaign_gate === 'malformed_control_contract',
            `${control.control_id} campaign gate mismatch`);
        assert(typeof control.harness_only_expected_rejection_code === 'string' &&
            control.harness_only_expected_rejection_code.includes('.'),
        `${control.control_id} has invalid harness-only rejection code`);
        assert(control.source_parent_case_id === PARENT_CASE_ID, `${control.control_id} parent mismatch`);

        if (control.interface === 'shape_2_1_raw_dat') {
            assert(control.input.target_code === 'SP-4' && control.input.target_index === 1,
                `${control.control_id} SHAPE target binding mismatch`);
            validateTokenMatrix(control.input.atoms.map(atom => atom.tokens));
        } else {
            assert(['qshape_core_calculator', 'qshape_reference_registry'].includes(control.interface),
                `${control.control_id} interface mismatch`);
            validateTokenMatrix(control.input.ligand_tokens, control.category === 'nonfinite_token');
        }
    }

    const expectedCategories = new Set([
        'missing_center',
        'misplaced_center',
        'incorrect_point_count',
        'nonfinite_token',
        'duplicate_ligand',
        'effectively_zero_length_ligand',
        'unsupported_coordination_number'
    ]);
    assert(categories.size === expectedCategories.size && [...expectedCategories].every(item => categories.has(item)),
        'malformed category census mismatch');
    return true;
}

function typedRejection(code, message) {
    const error = new Error(message || code);
    error.rejection_code = code;
    throw error;
}

function validateShapeControl(control) {
    const atoms = control?.input?.atoms;
    if (!Array.isArray(atoms) || atoms.length !== control.cn + 1) {
        typedRejection('shape.point_count_mismatch');
    }
    const centerIndices = atoms.map((atom, index) => ({ atom, index })).filter(({ atom }) =>
        atom?.element === 'Fe' && Array.isArray(atom.tokens) &&
        atom.tokens.length === 3 && atom.tokens.every(token => Number(token) === 0)
    ).map(item => item.index);
    if (centerIndices.length === 0) typedRejection('shape.center_missing_at_position_1');
    if (centerIndices.length !== 1 || centerIndices[0] !== 0) {
        typedRejection('shape.center_misplaced');
    }
    return [];
}

function validateQShapeControl(control) {
    const cn = control?.input?.declared_cn;
    const ligands = control?.input?.ligand_tokens;
    if (!Number.isInteger(cn) || cn < 2 || cn > 12) {
        typedRejection('qshape.unsupported_coordination_number');
    }
    if (!Array.isArray(ligands) || ligands.length !== cn) {
        typedRejection('qshape.ligand_count_mismatch');
    }
    const coordinates = ligands.map((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 3) {
            typedRejection('qshape.point_token_shape', `invalid point ${pointIndex}`);
        }
        return point.map(token => {
            if (typeof token !== 'string' || !FIXED15_PATTERN.test(token) || !Number.isFinite(Number(token))) {
                typedRejection('qshape.nonfinite_coordinate_token');
            }
            return Number(token);
        });
    });
    const seen = new Set();
    for (const point of coordinates) {
        const token = point.map(value => value.toPrecision(17)).join('\u0000');
        if (seen.has(token)) typedRejection('qshape.duplicate_ligand');
        seen.add(token);
        const norm = Math.hypot(...point);
        if (!Number.isFinite(norm) || norm <= 1e-5) {
            typedRejection('qshape.effectively_zero_length_ligand');
        }
    }
    return [];
}

function executeMalformedControls(document) {
    validateMalformedControlDocument(document);
    const results = document.controls.map(control => {
        let rejectionCode = null;
        let numericRows = [];
        try {
            numericRows = control.interface === 'shape_2_1_raw_dat'
                ? validateShapeControl(control)
                : validateQShapeControl(control);
        } catch (error) {
            rejectionCode = error.rejection_code || 'unexpected_error';
        }
        const numericRowCount = Array.isArray(numericRows) ? numericRows.length : 0;
        return {
            control_id: control.control_id,
            program: control.program,
            interface: control.interface,
            category: control.category,
            harness_only_expected_rejection_code: control.harness_only_expected_rejection_code,
            observed_rejection_code: rejectionCode,
            expected_numeric_rows: control.expected_numeric_rows,
            observed_numeric_rows: numericRowCount,
            evidence_scope: 'synthetic_harness_only',
            product_boundary_invoked: false,
            status: rejectionCode === control.harness_only_expected_rejection_code && numericRowCount === 0
                ? 'harness_match' : 'harness_mismatch'
        };
    });
    return {
        schema_version: 1,
        campaign_id: document.campaign_id,
        source_positive_cases_sha256: document.source_positive_cases_sha256,
        count: results.length,
        passed: results.filter(item => item.status === 'harness_match').length,
        failed: results.filter(item => item.status === 'harness_mismatch').length,
        evidence_scope: 'synthetic_harness_only',
        product_boundary_invoked: false,
        campaign_gate_status: 'not_scientific_evidence',
        results
    };
}

function parseArguments(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith('--') || value === undefined) return null;
        options[key.slice(2)] = value;
    }
    if (!options.positive || !options.output) return null;
    return options;
}

function main(argv) {
    const options = parseArguments(argv);
    if (!options) {
        process.stderr.write('Usage: node metamorphic-malformed-controls.cjs --positive <cases.json> --output <controls.json>\n');
        return 64;
    }
    const positivePath = path.resolve(options.positive);
    const outputPath = path.resolve(options.output);
    assert(fs.statSync(positivePath).isFile(), 'positive cases path is not a regular file');
    assert(!fs.existsSync(outputPath), 'output path already exists');
    const raw = fs.readFileSync(positivePath);
    const sourceHash = sha256Buffer(raw);
    const document = buildMalformedControlDocument(JSON.parse(raw.toString('utf8')), sourceHash);
    validateMalformedControlDocument(document);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${sha256Buffer(fs.readFileSync(outputPath))}  ${outputPath}\n`);
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 3;
    }
}

module.exports = {
    CONTROL_CAMPAIGN_ID,
    PARENT_CASE_ID,
    POSITIVE_CAMPAIGN_ID,
    POSITIVE_CASES_SHA256,
    buildMalformedControlDocument,
    executeMalformedControls,
    main,
    sha256Buffer,
    validateMalformedControlDocument,
    validateQShapeControl,
    validateShapeControl
};

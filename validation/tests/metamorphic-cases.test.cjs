'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const {
    ADVERSARIAL_CASES_PER_REFERENCE,
    ADVERSARIAL_RECIPE_REGISTRY,
    CASES_PER_REFERENCE,
    EXPECTED_ADVERSARIAL_CASE_COUNT,
    EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS,
    EXPECTED_CASE_COUNT,
    EXPECTED_MATCHED_TARGET_EVALUATIONS,
    EXPECTED_TOTAL_CASE_COUNT,
    EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS,
    PREREGISTERED_DOCUMENT_SHA256,
    RECIPE_REGISTRY,
    SENSITIVITY_SEEDS,
    TOTAL_CASES_PER_REFERENCE,
    classifyPointGroupChirality,
    generateMetamorphicCases
} = require('../scripts/metamorphic-cases.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
let cached = null;

function generated() {
    if (!cached) cached = generateMetamorphicCases(REPO_ROOT);
    return cached;
}

function documentHash(document) {
    return crypto.createHash('sha256')
        .update(`${JSON.stringify(document, null, 2)}\n`)
        .digest('hex');
}

function distance(a, b) {
    return Math.sqrt(a.reduce((sum, value, axis) =>
        sum + (value - b[axis]) ** 2, 0));
}

function norm(vector) {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function fixed15Point(point) {
    return point.map(value => Number(value.toFixed(15)));
}

function pairDistances(ligands) {
    const values = [];
    for (let i = 0; i < ligands.length; i++) {
        for (let j = i + 1; j < ligands.length; j++) {
            values.push(distance(ligands[i], ligands[j]));
        }
    }
    return values.sort((a, b) => a - b);
}

function centerInclusiveNormalizedDistanceSignature(ligands) {
    const rms = Math.sqrt(ligands.reduce((sum, point) => sum + norm(point) ** 2, 0) / ligands.length);
    return pairDistances([[0, 0, 0], ...ligands]).map(value => value / rms);
}

test('recipe registries freeze the 30-case main family and 3-case positive supplement', () => {
    assert.equal(RECIPE_REGISTRY.length, 30);
    assert.equal(CASES_PER_REFERENCE, 30);
    const categoryCounts = Object.fromEntries(
        [...new Set(RECIPE_REGISTRY.map(item => item.category))].map(category => [
            category,
            RECIPE_REGISTRY.filter(item => item.category === category).length
        ])
    );
    assert.deepEqual(categoryCounts, {
        canonical: 1,
        representation: 6,
        input_precision: 3,
        radial: 6,
        angular: 6,
        mixed: 6,
        distorted_twin: 1,
        reflection: 1
    });
    assert.equal(ADVERSARIAL_RECIPE_REGISTRY.length, 3);
    assert.equal(ADVERSARIAL_CASES_PER_REFERENCE, 3);
    assert.equal(TOTAL_CASES_PER_REFERENCE, 33);
    assert.deepEqual(
        ADVERSARIAL_RECIPE_REGISTRY.map(item => item.id),
        ['near-degenerate-assignment', 'near-collinear', 'center-ligand-swap']
    );
    assert.deepEqual(
        RECIPE_REGISTRY.filter(item => item.category === 'input_precision')
            .map(item => item.decimal_places),
        [9, 6, 3]
    );
    assert.deepEqual(
        RECIPE_REGISTRY.filter(item => item.category === 'radial')
            .map(item => item.radial_fraction),
        ['-0.001', '0.001', '-0.02', '0.02', '-0.10', '0.10']
    );
    assert.deepEqual(
        RECIPE_REGISTRY.filter(item => item.category === 'angular')
            .map(item => item.angular_radians),
        ['-0.001', '0.001', '-0.02', '0.02', '-0.10', '0.10']
    );
    assert.deepEqual(
        RECIPE_REGISTRY.filter(item => item.category === 'mixed')
            .map(item => item.radial_fraction),
        ['-0.005', '0.005', '-0.05', '0.05', '-0.25', '0.25']
    );
    assert.deepEqual(SENSITIVITY_SEEDS, [0, 0x51534850, 0xffffffff]);
});

test('generator creates the exact reference, case, and target-evaluation census', () => {
    const { inventory, cases, mainCases, adversarialCases, document } = generated();
    assert.equal(inventory.reduce((sum, item) => sum + item.count, 0), 87);
    assert.equal(mainCases.length, EXPECTED_CASE_COUNT);
    assert.equal(mainCases.length, 2610);
    assert.equal(adversarialCases.length, EXPECTED_ADVERSARIAL_CASE_COUNT);
    assert.equal(adversarialCases.length, 261);
    assert.equal(cases.length, EXPECTED_TOTAL_CASE_COUNT);
    assert.equal(document.count, 2871);
    assert.equal(document.main_case_count, 2610);
    assert.equal(document.adversarial_positive_case_count, 261);
    assert.equal(
        document.expected_main_matched_target_evaluations_per_program,
        EXPECTED_MATCHED_TARGET_EVALUATIONS
    );
    assert.equal(document.expected_main_matched_target_evaluations_per_program, 25950);
    assert.equal(
        document.expected_adversarial_matched_target_evaluations_per_program,
        EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS
    );
    assert.equal(document.expected_adversarial_matched_target_evaluations_per_program, 2595);
    assert.equal(
        document.expected_matched_target_evaluations_per_program,
        EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS
    );
    assert.equal(document.expected_matched_target_evaluations_per_program, 28545);
    for (const group of inventory) {
        for (const target of group.targets) {
            assert.equal(
                cases.filter(item => item.cn === group.cn &&
                    item.parentReferenceCode === target.code &&
                    item.family === 'main_positive').length,
                30
            );
            assert.equal(
                cases.filter(item => item.cn === group.cn &&
                    item.parentReferenceCode === target.code &&
                    item.family === 'adversarial_positive').length,
                3
            );
        }
    }
});

test('every case identifier, SHAPE structure identifier, and fixed15 input is exact', () => {
    const { cases } = generated();
    assert.equal(new Set(cases.map(item => item.caseId)).size, cases.length);
    assert.equal(new Set(cases.map(item => item.structureId)).size, cases.length);
    for (const item of cases) {
        assert.match(item.caseId, /^(?:meta|adv)-cn\d{2}-ref\d{2}-r\d{2}$/);
        assert.match(item.structureId, /^[MA]\d{6}$/);
        assert.match(item.referencePointGroup, /\S/);
        assert.ok(['achiral', 'chiral'].includes(item.referenceChirality));
        assert.ok(item.structureId.length <= 15);
        assert.equal(item.ligandTokens.length, item.cn);
        assert.equal(item.shapeAtoms.length, item.cn + 1);
        assert.deepEqual(item.shapeAtoms[0].tokens, [
            '0.000000000000000',
            '0.000000000000000',
            '0.000000000000000'
        ]);
        for (const point of item.ligandTokens) {
            assert.equal(point.length, 3);
            point.forEach(token => assert.match(token, /^[+-]?\d+\.\d{15}$/));
        }
    }
});

test('generation is byte-deterministic and sign-paired recipes share frozen selections', () => {
    const first = generated();
    const second = generateMetamorphicCases(REPO_ROOT);
    assert.equal(documentHash(first.document), documentHash(second.document));
    assert.equal(documentHash(first.document), PREREGISTERED_DOCUMENT_SHA256);
    assert.deepEqual(first.document, second.document);
    const seeds = new Set(first.cases.map(item =>
        `${item.cn}:${item.parentReferenceCode}:${item.recipeId}:${item.generationSeedUint32}`
    ));
    assert.equal(seeds.size, first.cases.length);
    for (const canonical of first.cases.filter(item => item.recipeId === 'canonical')) {
        const siblings = first.cases.filter(item => item.cn === canonical.cn &&
            item.parentReferenceCode === canonical.parentReferenceCode);
        for (const [minusId, plusId] of [
            ['radial-minus-0.001', 'radial-plus-0.001'],
            ['radial-minus-0.02', 'radial-plus-0.02'],
            ['radial-minus-0.10', 'radial-plus-0.10'],
            ['angular-minus-0.001', 'angular-plus-0.001'],
            ['angular-minus-0.02', 'angular-plus-0.02'],
            ['angular-minus-0.10', 'angular-plus-0.10'],
            ['mixed-minus-0.005', 'mixed-plus-0.005'],
            ['mixed-minus-0.05', 'mixed-plus-0.05'],
            ['mixed-minus-0.25', 'mixed-plus-0.25']
        ]) {
            const minus = siblings.find(item => item.recipeId === minusId);
            const plus = siblings.find(item => item.recipeId === plusId);
            assert.equal(minus.generationSeedUint32, plus.generationSeedUint32);
            if (minus.recipeCategory === 'radial') {
                assert.equal(
                    minus.generationDetails.ligand_index_zero_based,
                    plus.generationDetails.ligand_index_zero_based
                );
            } else if (minus.recipeCategory === 'angular') {
                assert.equal(
                    minus.generationDetails.ligand_index_zero_based,
                    plus.generationDetails.ligand_index_zero_based
                );
                assert.deepEqual(
                    minus.generationDetails.rotation_axis,
                    plus.generationDetails.rotation_axis
                );
            } else {
                assert.deepEqual(
                    minus.generationDetails.operations.map(item => item.ligand_index_zero_based),
                    plus.generationDetails.operations.map(item => item.ligand_index_zero_based)
                );
                assert.deepEqual(
                    minus.generationDetails.operations.map(item => item.rotation_axis),
                    plus.generationDetails.operations.map(item => item.rotation_axis)
                );
            }
        }
    }
});

test('six representation cases preserve the canonical normalized distance multiset', () => {
    const { cases } = generated();
    for (const canonical of cases.filter(item => item.recipeId === 'canonical')) {
        const expected = centerInclusiveNormalizedDistanceSignature(canonical.actualLigands);
        const siblings = cases.filter(item =>
            item.parentReferenceCode === canonical.parentReferenceCode &&
            item.cn === canonical.cn &&
            item.recipeCategory === 'representation'
        );
        assert.equal(siblings.length, 6);
        for (const sibling of siblings) {
            const observed = centerInclusiveNormalizedDistanceSignature(sibling.actualLigands);
            assert.equal(observed.length, expected.length);
            const tolerance = sibling.recipeParameters.scale === '0.00005' ? 3e-10 : 2e-12;
            observed.forEach((value, index) =>
                assert.ok(Math.abs(value - expected[index]) < tolerance,
                    `${sibling.caseId} changed normalized distance ${index}`)
            );
            if (sibling.recipeParameters.permutation) {
                const order = sibling.generationDetails.permutation_order_zero_based;
                assert.ok(order.some((value, index) => value !== index),
                    `${sibling.caseId} retained the identity permutation`);
            }
        }
    }
});

test('all 18 systematic distortions change the center-inclusive distance multiset', () => {
    const { cases } = generated();
    for (const canonical of cases.filter(item => item.recipeId === 'canonical')) {
        const expected = centerInclusiveNormalizedDistanceSignature(canonical.actualLigands);
        const distortions = cases.filter(item => item.cn === canonical.cn &&
            item.parentReferenceCode === canonical.parentReferenceCode &&
            ['radial', 'angular', 'mixed'].includes(item.recipeCategory));
        assert.equal(distortions.length, 18);
        for (const distortion of distortions) {
            const observed = centerInclusiveNormalizedDistanceSignature(distortion.actualLigands);
            assert.ok(observed.some((value, index) => Math.abs(value - expected[index]) > 1e-12),
                `${distortion.caseId} is congruent to its canonical parent`);
        }
    }
});

test('precision cases are non-duplicate quantizations retained as fixed15 tokens', () => {
    const { cases } = generated();
    for (const item of cases.filter(entry => entry.recipeCategory === 'input_precision')) {
        const decimalPlaces = item.recipeParameters.decimal_places;
        for (const point of item.ligandTokens) {
            for (const token of point) {
                const fractional = token.split('.')[1];
                assert.equal(fractional.length, 15);
                assert.match(fractional.slice(decimalPlaces), /^0+$/);
            }
        }
        const precisionParent = cases.find(entry => entry.cn === item.cn &&
            entry.parentReferenceCode === item.parentReferenceCode &&
            entry.recipeId === 'rotation-a');
        assert.equal(item.parentCaseId, precisionParent.caseId);
        assert.equal(item.generationDetails.parent_recipe_id, 'rotation-a');
        assert.notDeepEqual(item.ligandTokens, precisionParent.ligandTokens,
            `${item.caseId} duplicates the rotated parent tokens`);
    }
});

test('point-group chirality is complete and classifies only SDD-10 as chiral', () => {
    const { cases } = generated();
    assert.equal(classifyPointGroupChirality('D2'), 'chiral');
    assert.equal(classifyPointGroupChirality('D2d'), 'achiral');
    assert.equal(classifyPointGroupChirality('Td'), 'achiral');
    const chiral = cases.filter(item => item.referenceChirality === 'chiral');
    assert.equal(chiral.length, TOTAL_CASES_PER_REFERENCE);
    assert.deepEqual([...new Set(chiral.map(item => item.parentReferenceCode))], ['SDD-10']);
    assert.deepEqual([...new Set(chiral.map(item => item.referencePointGroup))], ['D2']);
});

test('positive adversarial supplement creates near-degenerate, near-collinear, and center-swap inputs', () => {
    const { cases } = generated();
    for (const targetGroup of new Set(cases.map(item => `${item.cn}:${item.parentReferenceCode}`))) {
        const [cnToken, code] = targetGroup.split(':');
        const siblings = cases.filter(item => item.cn === Number(cnToken) &&
            item.parentReferenceCode === code);
        const nearDegenerate = siblings.find(item => item.recipeId === 'near-degenerate-assignment');
        const nearCollinear = siblings.find(item => item.recipeId === 'near-collinear');
        const centerSwap = siblings.find(item => item.recipeId === 'center-ligand-swap');
        const canonical = siblings.find(item => item.recipeId === 'canonical');
        const degenerateDetails = nearDegenerate.generationDetails;
        assert.equal(degenerateDetails.separation_direction_unit.length, 3);
        const parentRms = Math.sqrt(canonical.actualLigands.reduce(
            (sum, point) => sum + norm(point) ** 2, 0
        ) / canonical.cn);
        const separation = parentRms * Number(degenerateDetails.separation_rms_fraction);
        const separationDirection = degenerateDetails.separation_direction_unit.map(Number);
        const degenerateAnchor = canonical.actualLigands[degenerateDetails.anchor_ligand_index_zero_based];
        const reconstructedDegenerate = fixed15Point(degenerateAnchor.map((value, axis) =>
            value + separationDirection[axis] * separation
        ));
        assert.deepEqual(
            nearDegenerate.actualLigands[degenerateDetails.moving_ligand_index_zero_based],
            reconstructedDegenerate
        );

        const collinearDetails = nearCollinear.generationDetails;
        assert.equal(collinearDetails.anchor_direction_unit.length, 3);
        assert.equal(collinearDetails.tangent_direction_unit.length, 3);
        assert.match(collinearDetails.retained_moving_radius, /^\d/);
        const a = nearCollinear.actualLigands[collinearDetails.anchor_ligand_index_zero_based];
        const b = nearCollinear.actualLigands[collinearDetails.moving_ligand_index_zero_based];
        const cosine = Math.max(-1, Math.min(1,
            a.reduce((sum, value, axis) => sum + value * b[axis], 0) / (norm(a) * norm(b))
        ));
        const angleRadians = Math.acos(cosine);
        assert.ok(Math.abs(angleRadians - Number(nearCollinear.recipeParameters.angular_radians)) < 1e-10);
        const manifestedAngle = Number(collinearDetails.angular_radians);
        const anchorDirection = collinearDetails.anchor_direction_unit.map(Number);
        const tangentDirection = collinearDetails.tangent_direction_unit.map(Number);
        const retainedRadius = Number(collinearDetails.retained_moving_radius);
        const reconstructedCollinear = fixed15Point(anchorDirection.map((value, axis) =>
            retainedRadius * (value * Math.cos(manifestedAngle) +
                tangentDirection[axis] * Math.sin(manifestedAngle))
        ));
        assert.deepEqual(b, reconstructedCollinear);

        const selected = centerSwap.generationDetails.selected_original_ligand_index_zero_based;
        assert.equal(centerSwap.actualLigands.length, Number(cnToken));
        assert.ok(Number.isInteger(selected) && selected >= 0 && selected < Number(cnToken));
        assert.ok(centerSwap.actualLigands.every(point => norm(point) > 1e-12));
    }
});

test('distorted twin is explicitly linked to mixed-plus-0.05 and reflection flips x only', () => {
    const { cases } = generated();
    for (const canonical of cases.filter(item => item.recipeId === 'canonical')) {
        const siblings = cases.filter(item => item.cn === canonical.cn &&
            item.parentReferenceCode === canonical.parentReferenceCode);
        const medium = siblings.find(item => item.recipeId === 'mixed-plus-0.05');
        const twin = siblings.find(item => item.recipeId === 'distorted-twin');
        const reflected = siblings.find(item => item.recipeId === 'reflected-x');
        assert.equal(twin.parentCaseId, medium.caseId);
        const expected = centerInclusiveNormalizedDistanceSignature(medium.actualLigands);
        const observed = centerInclusiveNormalizedDistanceSignature(twin.actualLigands);
        observed.forEach((value, index) =>
            assert.ok(Math.abs(value - expected[index]) < 2e-12,
                `${twin.caseId} changed distorted-parent distance ${index}`)
        );
        canonical.actualLigands.forEach((point, index) => {
            assert.ok(Math.abs(reflected.actualLigands[index][0] + point[0]) < 1e-14);
            assert.equal(reflected.actualLigands[index][1], point[1]);
            assert.equal(reflected.actualLigands[index][2], point[2]);
        });
    }
});

#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
    buildReferenceInventory,
    centerRelativeLigands,
    float64Hex,
    formatCoordinate,
    loadQShape,
    sha256Buffer
} = require('./direct-parity-core.cjs');

const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const CASES_PER_REFERENCE = 30;
const ADVERSARIAL_CASES_PER_REFERENCE = 3;
const TOTAL_CASES_PER_REFERENCE = CASES_PER_REFERENCE + ADVERSARIAL_CASES_PER_REFERENCE;
const EXPECTED_REFERENCE_COUNT = 87;
const EXPECTED_CASE_COUNT = 2610;
const EXPECTED_ADVERSARIAL_CASE_COUNT = 261;
const EXPECTED_TOTAL_CASE_COUNT = EXPECTED_CASE_COUNT + EXPECTED_ADVERSARIAL_CASE_COUNT;
const EXPECTED_MATCHED_TARGET_EVALUATIONS = 25950;
const EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS = 2595;
const EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS =
    EXPECTED_MATCHED_TARGET_EVALUATIONS + EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS;
const SENSITIVITY_SEEDS = Object.freeze([0, 0x51534850, 0xffffffff]);
const PREREGISTERED_DOCUMENT_SHA256 =
    '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd';

const ROTATIONS = Object.freeze({
    a: Object.freeze({ axis: Object.freeze([1, 2, 3]), angle_rad: '0.417' }),
    rotationScale: Object.freeze({ axis: Object.freeze([-3, 1, 4]), angle_rad: '1.913' }),
    rotationPermutation: Object.freeze({ axis: Object.freeze([5, -2, 1]), angle_rad: '4.207' }),
    rotationScalePermutation: Object.freeze({ axis: Object.freeze([7, -4, 9]), angle_rad: '2.731' }),
    twin: Object.freeze({ axis: Object.freeze([7, -3, 2]), angle_rad: '2.731' })
});

const RECIPE_REGISTRY = Object.freeze([
    Object.freeze({ id: 'canonical', category: 'canonical', relation: 'self' }),
    Object.freeze({ id: 'rotation-a', category: 'representation', relation: 'canonical_invariant', rotation: 'a' }),
    Object.freeze({ id: 'scale-small', category: 'representation', relation: 'canonical_invariant', scale: '0.00005' }),
    Object.freeze({ id: 'permutation', category: 'representation', relation: 'canonical_invariant', permutation: true }),
    Object.freeze({ id: 'rotation-scale', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationScale', scale: '2.5' }),
    Object.freeze({ id: 'rotation-permutation', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationPermutation', permutation: true }),
    Object.freeze({ id: 'rotation-scale-permutation', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationScalePermutation', scale: '0.00005', permutation: true }),
    Object.freeze({ id: 'precision-9', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 9 }),
    Object.freeze({ id: 'precision-6', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 6 }),
    Object.freeze({ id: 'precision-3', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 3 }),
    Object.freeze({ id: 'radial-minus-0.001', seed_key: 'radial-0.001', category: 'radial', relation: 'distorted', radial_fraction: '-0.001' }),
    Object.freeze({ id: 'radial-plus-0.001', seed_key: 'radial-0.001', category: 'radial', relation: 'distorted', radial_fraction: '0.001' }),
    Object.freeze({ id: 'radial-minus-0.02', seed_key: 'radial-0.02', category: 'radial', relation: 'distorted', radial_fraction: '-0.02' }),
    Object.freeze({ id: 'radial-plus-0.02', seed_key: 'radial-0.02', category: 'radial', relation: 'distorted', radial_fraction: '0.02' }),
    Object.freeze({ id: 'radial-minus-0.10', seed_key: 'radial-0.10', category: 'radial', relation: 'distorted', radial_fraction: '-0.10' }),
    Object.freeze({ id: 'radial-plus-0.10', seed_key: 'radial-0.10', category: 'radial', relation: 'distorted', radial_fraction: '0.10' }),
    Object.freeze({ id: 'angular-minus-0.001', seed_key: 'angular-0.001', category: 'angular', relation: 'distorted', angular_radians: '-0.001' }),
    Object.freeze({ id: 'angular-plus-0.001', seed_key: 'angular-0.001', category: 'angular', relation: 'distorted', angular_radians: '0.001' }),
    Object.freeze({ id: 'angular-minus-0.02', seed_key: 'angular-0.02', category: 'angular', relation: 'distorted', angular_radians: '-0.02' }),
    Object.freeze({ id: 'angular-plus-0.02', seed_key: 'angular-0.02', category: 'angular', relation: 'distorted', angular_radians: '0.02' }),
    Object.freeze({ id: 'angular-minus-0.10', seed_key: 'angular-0.10', category: 'angular', relation: 'distorted', angular_radians: '-0.10' }),
    Object.freeze({ id: 'angular-plus-0.10', seed_key: 'angular-0.10', category: 'angular', relation: 'distorted', angular_radians: '0.10' }),
    Object.freeze({ id: 'mixed-minus-0.005', seed_key: 'mixed-0.005', category: 'mixed', relation: 'distorted', radial_fraction: '-0.005', angular_radians: '-0.005' }),
    Object.freeze({ id: 'mixed-plus-0.005', seed_key: 'mixed-0.005', category: 'mixed', relation: 'distorted', radial_fraction: '0.005', angular_radians: '0.005' }),
    Object.freeze({ id: 'mixed-minus-0.05', seed_key: 'mixed-0.05', category: 'mixed', relation: 'distorted', radial_fraction: '-0.05', angular_radians: '-0.05' }),
    Object.freeze({ id: 'mixed-plus-0.05', seed_key: 'mixed-0.05', category: 'mixed', relation: 'distorted', radial_fraction: '0.05', angular_radians: '0.05' }),
    Object.freeze({ id: 'mixed-minus-0.25', seed_key: 'mixed-0.25', category: 'mixed', relation: 'distorted', radial_fraction: '-0.25', angular_radians: '-0.25' }),
    Object.freeze({ id: 'mixed-plus-0.25', seed_key: 'mixed-0.25', category: 'mixed', relation: 'distorted', radial_fraction: '0.25', angular_radians: '0.25' }),
    Object.freeze({ id: 'distorted-twin', category: 'distorted_twin', relation: 'mixed_plus_0.05_invariant', rotation: 'twin', scale: '0.37', permutation: true }),
    Object.freeze({ id: 'reflected-x', category: 'reflection', relation: 'chirality_probe', reflection_axis: 'x' })
]);

const ADVERSARIAL_RECIPE_REGISTRY = Object.freeze([
    Object.freeze({ id: 'near-degenerate-assignment', category: 'near_degenerate', relation: 'valid_adversarial', separation_rms_fraction: '0.000001' }),
    Object.freeze({ id: 'near-collinear', category: 'near_collinear', relation: 'valid_adversarial', angular_radians: '0.00017453292519943296' }),
    Object.freeze({ id: 'center-ligand-swap', category: 'center_ligand_trap', relation: 'alternate_center_parity_only' })
]);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function classifyPointGroupChirality(pointGroup) {
    assert(typeof pointGroup === 'string' && pointGroup.length > 0,
        'Missing reference point group');
    return /^(?:C\d+|D\d+|T|O|I)$/.test(pointGroup) ? 'chiral' : 'achiral';
}

function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function norm(vector) {
    return Math.sqrt(dot(vector, vector));
}

function normalize(vector, context = 'vector') {
    const length = norm(vector);
    assert(Number.isFinite(length) && length > 1e-15, `Cannot normalize ${context}`);
    return scale(vector, 1 / length);
}

function rotateVector(vector, axis, angle) {
    const unitAxis = normalize(axis, 'rotation axis');
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return add(
        add(scale(vector, cosine), scale(cross(unitAxis, vector), sine)),
        scale(unitAxis, dot(unitAxis, vector) * (1 - cosine))
    );
}

function perpendicularUnit(vector, seed) {
    const unit = normalize(vector, 'ligand vector');
    const candidates = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ].sort((a, b) => Math.abs(dot(unit, a)) - Math.abs(dot(unit, b)));
    const offset = seed % candidates.length;
    for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[(index + offset) % candidates.length];
        const perpendicular = cross(unit, candidate);
        if (norm(perpendicular) > 1e-12) return normalize(perpendicular, 'perpendicular axis');
    }
    throw new Error('Could not construct a perpendicular axis');
}

function deriveSeed(cn, referenceCode, recipeId) {
    const digest = crypto.createHash('sha256')
        .update(`${CAMPAIGN_ID}\0${cn}\0${referenceCode}\0${recipeId}`)
        .digest();
    return digest.readUInt32BE(0);
}

function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function permutationOrder(length, seed) {
    const order = Array.from({ length }, (_, index) => index);
    const random = createRandom(seed);
    for (let index = length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    if (length > 1 && order.every((value, index) => value === index)) {
        order.push(order.shift());
    }
    return order;
}

function permute(values, order) {
    assert(values.length === order.length, 'Permutation length mismatch');
    return order.map(index => values[index].slice());
}

function cloneLigands(ligands) {
    return ligands.map(point => point.slice());
}

function fixed15Tokens(ligands) {
    return ligands.map(point => point.map(formatCoordinate));
}

function tokensToLigands(tokens) {
    return tokens.map((point, pointIndex) => point.map((token, axis) => {
        assert(/^[+-]?\d+\.\d{15}$/.test(token), `Invalid fixed15 token ${pointIndex}/${axis}`);
        const value = Number(token);
        assert(Number.isFinite(value), `Non-finite fixed15 token ${token}`);
        return value;
    }));
}

function canonicalLigands(referenceCoordinates) {
    return tokensToLigands(fixed15Tokens(centerRelativeLigands(referenceCoordinates)));
}

function rmsRadius(ligands) {
    return Math.sqrt(ligands.reduce((sum, point) => sum + dot(point, point), 0) / ligands.length);
}

function centerInclusiveNormalizedDistanceSignature(ligands) {
    const points = [[0, 0, 0], ...ligands];
    const radius = rmsRadius(ligands);
    const distances = [];
    for (let first = 0; first < points.length; first++) {
        for (let second = first + 1; second < points.length; second++) {
            distances.push(norm(subtract(points[first], points[second])) / radius);
        }
    }
    return distances.sort((a, b) => a - b);
}

function changesCenterInclusiveDistanceSignature(before, after, tolerance = 1e-12) {
    const beforeSignature = centerInclusiveNormalizedDistanceSignature(before);
    const afterSignature = centerInclusiveNormalizedDistanceSignature(after);
    assert(beforeSignature.length === afterSignature.length, 'Distance signature length mismatch');
    return beforeSignature.some((value, index) =>
        Math.abs(value - afterSignature[index]) > tolerance
    );
}

function selectedIndices(length, seed, count) {
    return permutationOrder(length, seed).slice(0, Math.min(count, length));
}

function transformRepresentation(ligands, recipe, seed) {
    let transformed = cloneLigands(ligands);
    const details = {};
    if (recipe.rotation) {
        const rotation = ROTATIONS[recipe.rotation];
        transformed = transformed.map(point => rotateVector(
            point,
            rotation.axis,
            Number(rotation.angle_rad)
        ));
        details.rotation = rotation;
    }
    if (recipe.scale) {
        transformed = transformed.map(point => scale(point, Number(recipe.scale)));
        details.scale = recipe.scale;
    }
    if (recipe.permutation) {
        const order = permutationOrder(transformed.length, seed);
        transformed = permute(transformed, order);
        details.permutation_order_zero_based = order;
    }
    return { ligands: transformed, details };
}

function transformRadial(ligands, recipe, seed) {
    const transformed = cloneLigands(ligands);
    const ligandIndex = selectedIndices(ligands.length, seed, 1)[0];
    const factor = 1 + Number(recipe.radial_fraction);
    transformed[ligandIndex] = scale(transformed[ligandIndex], factor);
    return {
        ligands: transformed,
        details: { ligand_index_zero_based: ligandIndex, radial_factor: factor.toString() }
    };
}

function transformAngular(ligands, recipe, seed) {
    const transformed = cloneLigands(ligands);
    const ligandIndex = selectedIndices(ligands.length, seed, 1)[0];
    const angle = Number(recipe.angular_radians);
    let axis = null;
    let axisCandidateOffset = null;
    for (let offset = 0; offset < 3; offset++) {
        const candidateAxis = perpendicularUnit(transformed[ligandIndex], (seed >>> 8) + offset);
        const probe = cloneLigands(ligands);
        probe[ligandIndex] = rotateVector(probe[ligandIndex], candidateAxis, Math.abs(angle));
        if (changesCenterInclusiveDistanceSignature(ligands, probe)) {
            axis = candidateAxis;
            axisCandidateOffset = offset;
            break;
        }
    }
    assert(axis, `Could not construct a genuinely distorting angular axis for ${recipe.id}`);
    transformed[ligandIndex] = rotateVector(transformed[ligandIndex], axis, angle);
    return {
        ligands: transformed,
        details: {
            ligand_index_zero_based: ligandIndex,
            rotation_axis: axis.map(value => value.toPrecision(17)),
            axis_candidate_offset: axisCandidateOffset,
            angular_radians: recipe.angular_radians
        }
    };
}

function transformMixed(ligands, recipe, seed) {
    const transformed = cloneLigands(ligands);
    const indices = selectedIndices(ligands.length, seed, 3);
    const radialMagnitude = Number(recipe.radial_fraction);
    const angularMagnitude = Number(recipe.angular_radians);
    const operations = [];
    indices.forEach((ligandIndex, operationIndex) => {
        const sign = operationIndex % 2 === 0 ? 1 : -1;
        const radialFactor = 1 + sign * radialMagnitude;
        const axis = perpendicularUnit(transformed[ligandIndex], (seed + operationIndex + 1) >>> 0);
        transformed[ligandIndex] = rotateVector(
            scale(transformed[ligandIndex], radialFactor),
            axis,
            sign * angularMagnitude
        );
        operations.push({
            ligand_index_zero_based: ligandIndex,
            radial_factor: radialFactor.toString(),
            angular_radians: (sign * angularMagnitude).toString(),
            rotation_axis: axis.map(value => value.toPrecision(17))
        });
    });
    return { ligands: transformed, details: { operations } };
}

function transformNearDegenerate(ligands, recipe, seed) {
    const transformed = cloneLigands(ligands);
    const [movingIndex, anchorIndex] = selectedIndices(ligands.length, seed, 2);
    const separation = rmsRadius(ligands) * Number(recipe.separation_rms_fraction);
    const direction = perpendicularUnit(transformed[anchorIndex], seed >>> 5);
    transformed[movingIndex] = add(transformed[anchorIndex], scale(direction, separation));
    return {
        ligands: transformed,
        details: {
            moving_ligand_index_zero_based: movingIndex,
            anchor_ligand_index_zero_based: anchorIndex,
            separation_rms_fraction: recipe.separation_rms_fraction,
            separation_direction_unit: direction.map(value => value.toPrecision(17))
        }
    };
}

function transformNearCollinear(ligands, recipe, seed) {
    const transformed = cloneLigands(ligands);
    const [anchorIndex, movingIndex] = selectedIndices(ligands.length, seed, 2);
    const anchorDirection = normalize(transformed[anchorIndex], 'near-collinear anchor');
    const movingRadius = norm(transformed[movingIndex]);
    const perpendicular = perpendicularUnit(anchorDirection, seed >>> 7);
    const angle = Number(recipe.angular_radians);
    transformed[movingIndex] = scale(
        add(scale(anchorDirection, Math.cos(angle)), scale(perpendicular, Math.sin(angle))),
        movingRadius
    );
    return {
        ligands: transformed,
        details: {
            anchor_ligand_index_zero_based: anchorIndex,
            moving_ligand_index_zero_based: movingIndex,
            angular_radians: recipe.angular_radians,
            anchor_direction_unit: anchorDirection.map(value => value.toPrecision(17)),
            tangent_direction_unit: perpendicular.map(value => value.toPrecision(17)),
            retained_moving_radius: movingRadius.toPrecision(17)
        }
    };
}

function transformCenterSwap(ligands, seed) {
    const selectedCenterIndex = selectedIndices(ligands.length, seed, 1)[0];
    const selectedCenter = ligands[selectedCenterIndex];
    const oldPoints = [[0, 0, 0], ...ligands.map(point => point.slice())];
    const newLigands = oldPoints
        .filter((_, pointIndex) => pointIndex !== selectedCenterIndex + 1)
        .map(point => subtract(point, selectedCenter));
    assert(newLigands.length === ligands.length, 'Center-swap ligand count mismatch');
    return {
        ligands: newLigands,
        details: {
            selected_original_ligand_index_zero_based: selectedCenterIndex,
            original_center_becomes_ligand: true
        }
    };
}

function applyRecipe(baseLigands, recipe, seed, generatedByRecipe) {
    if (recipe.id === 'canonical') return { ligands: cloneLigands(baseLigands), details: {} };
    if (recipe.category === 'representation') {
        return transformRepresentation(baseLigands, recipe, seed);
    }
    if (recipe.category === 'input_precision') {
        const parent = generatedByRecipe.get('rotation-a');
        assert(parent, `${recipe.id} requires rotation-a parent`);
        return {
            ligands: parent.map(point => point.map(value =>
                Number(value.toFixed(recipe.decimal_places))
            )),
            details: { decimal_places: recipe.decimal_places, parent_recipe_id: 'rotation-a' }
        };
    }
    if (recipe.category === 'radial') return transformRadial(baseLigands, recipe, seed);
    if (recipe.category === 'angular') return transformAngular(baseLigands, recipe, seed);
    if (recipe.category === 'mixed') return transformMixed(baseLigands, recipe, seed);
    if (recipe.id === 'near-degenerate-assignment') {
        return transformNearDegenerate(baseLigands, recipe, seed);
    }
    if (recipe.id === 'near-collinear') {
        return transformNearCollinear(baseLigands, recipe, seed);
    }
    if (recipe.id === 'center-ligand-swap') return transformCenterSwap(baseLigands, seed);
    if (recipe.id === 'distorted-twin') {
        const parent = generatedByRecipe.get('mixed-plus-0.05');
        assert(parent, 'distorted-twin requires mixed-plus-0.05 parent');
        const transformed = transformRepresentation(parent, recipe, seed);
        transformed.details.parent_recipe_id = 'mixed-plus-0.05';
        return transformed;
    }
    if (recipe.id === 'reflected-x') {
        return {
            ligands: baseLigands.map(([x, y, z]) => [-x, y, z]),
            details: { reflection_matrix_diagonal: ['-1', '1', '1'] }
        };
    }
    throw new Error(`Unhandled metamorphic recipe: ${recipe.id}`);
}

function referenceFingerprint(target) {
    const contract = {
        cn: target.cn,
        index: target.index,
        code: target.code,
        name: target.name,
        point_group: target.pointGroup,
        chirality: target.chirality,
        coordinate_roundtrip_tokens: target.coordinates.map(point =>
            point.map(value => Object.is(value, -0) ? '-0' : value.toPrecision(17))
        ),
        coordinate_float64_hex: target.coordinates.map(point => point.map(float64Hex))
    };
    return sha256Buffer(Buffer.from(JSON.stringify(contract), 'utf8'));
}

function buildCase(target, recipe, recipeIndex, transformed, seed, family) {
    const ligandTokens = fixed15Tokens(transformed.ligands);
    const actualLigands = tokensToLigands(ligandTokens);
    const cnToken = String(target.cn).padStart(2, '0');
    const referenceToken = String(target.index).padStart(2, '0');
    const recipeToken = String(recipeIndex + 1).padStart(2, '0');
    const isMain = family === 'main_positive';
    const caseId = isMain
        ? `meta-cn${cnToken}-ref${referenceToken}-r${recipeToken}`
        : `adv-cn${cnToken}-ref${referenceToken}-r${recipeToken}`;
    const structureId = `${isMain ? 'M' : 'A'}${cnToken}${referenceToken}${recipeToken}`;
    assert(structureId.length <= 15, `SHAPE structure identifier too long: ${structureId}`);
    const canonicalCaseId = `meta-cn${cnToken}-ref${referenceToken}-r01`;
    const rotationParentIndex = RECIPE_REGISTRY.findIndex(item => item.id === 'rotation-a');
    assert(rotationParentIndex >= 0, 'Missing rotation-a precision parent recipe');
    const twinParentIndex = RECIPE_REGISTRY.findIndex(item => item.id === 'mixed-plus-0.05');
    assert(twinParentIndex >= 0, 'Missing mixed-plus-0.05 twin parent recipe');
    return {
        caseId,
        structureId,
        stratum: isMain ? 'metamorphic_main' : 'adversarial_positive',
        family,
        cn: target.cn,
        sourceName: target.name,
        parentReferenceCode: target.code,
        parentReferenceIndex: target.index,
        parentReferenceFingerprintSha256: referenceFingerprint(target),
        referencePointGroup: target.pointGroup,
        referenceChirality: target.chirality,
        expectedOwnTargetCode: recipe.id === 'canonical' || recipe.category === 'representation'
            ? target.code
            : null,
        recipeId: recipe.id,
        recipeIndex: recipeIndex + 1,
        recipeCategory: recipe.category,
        relation: recipe.relation,
        generationSeedUint32: seed,
        generationSeedDerivationKey: recipe.seed_key || recipe.id,
        applicability: recipe.id === 'near-collinear' && target.cn === 2
            ? 'structurally_degenerate_cn2_stress'
            : 'general',
        parentCaseId: recipe.id === 'distorted-twin'
            ? `meta-cn${cnToken}-ref${referenceToken}-r${String(twinParentIndex + 1).padStart(2, '0')}`
            : recipe.category === 'input_precision'
                ? `meta-cn${cnToken}-ref${referenceToken}-r${String(rotationParentIndex + 1).padStart(2, '0')}`
            : recipe.id === 'canonical'
                ? null
                : canonicalCaseId,
        recipeParameters: Object.fromEntries(
            Object.entries(recipe).filter(([key]) => !['id', 'category', 'relation'].includes(key))
        ),
        generationDetails: transformed.details,
        actualLigands,
        ligandTokens,
        shapeAtoms: [
            {
                element: 'Fe',
                tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000']
            },
            ...ligandTokens.map(tokens => ({ element: 'C', tokens }))
        ],
        inputCoordinatePolicy: 'recipe_applied_to_parent_fixed15_ligands_then_reserialized_fixed15; identical tokens feed Q-Shape and SHAPE'
    };
}

function serializeCase(item) {
    return {
        case_id: item.caseId,
        structure_id: item.structureId,
        stratum: item.stratum,
        family: item.family,
        cn: item.cn,
        source_name: item.sourceName,
        parent_reference_code: item.parentReferenceCode,
        parent_reference_index: item.parentReferenceIndex,
        parent_reference_fingerprint_sha256: item.parentReferenceFingerprintSha256,
        reference_point_group: item.referencePointGroup,
        reference_chirality: item.referenceChirality,
        expected_own_target_code: item.expectedOwnTargetCode,
        recipe_id: item.recipeId,
        recipe_index: item.recipeIndex,
        recipe_category: item.recipeCategory,
        relation: item.relation,
        generation_seed_uint32: item.generationSeedUint32,
        generation_seed_derivation_key: item.generationSeedDerivationKey,
        applicability: item.applicability,
        parent_case_id: item.parentCaseId,
        recipe_parameters: item.recipeParameters,
        generation_details: item.generationDetails,
        qshape_actual_ligand_tokens: item.ligandTokens,
        shape_atoms: item.shapeAtoms,
        input_coordinate_policy: item.inputCoordinatePolicy
    };
}

function generateMetamorphicCases(repoRoot) {
    assert(RECIPE_REGISTRY.length === CASES_PER_REFERENCE, 'Recipe registry must contain 30 cases');
    assert(ADVERSARIAL_RECIPE_REGISTRY.length === ADVERSARIAL_CASES_PER_REFERENCE,
        'Adversarial recipe registry must contain 3 cases');
    const { referenceGeometries, pointGroups } = loadQShape(repoRoot);
    const inventory = buildReferenceInventory(referenceGeometries);
    for (const group of inventory) {
        for (const target of group.targets) {
            const pointGroup = pointGroups[target.name];
            assert(pointGroup, `Missing point group for ${target.name}`);
            target.pointGroup = pointGroup;
            target.chirality = classifyPointGroupChirality(pointGroup);
        }
    }
    const cases = [];
    const mainCases = [];
    const adversarialCases = [];
    for (const group of inventory) {
        for (const target of group.targets) {
            const baseLigands = canonicalLigands(target.coordinates);
            const generatedByRecipe = new Map();
            const generateFamily = (registry, family, destination) => {
                registry.forEach((recipe, recipeIndex) => {
                    const seed = deriveSeed(group.cn, target.code, recipe.seed_key || recipe.id);
                    const transformed = applyRecipe(baseLigands, recipe, seed, generatedByRecipe);
                    const finalizedLigands = tokensToLigands(fixed15Tokens(transformed.ligands));
                    generatedByRecipe.set(recipe.id, finalizedLigands);
                    const generatedCase = buildCase(
                        target,
                        recipe,
                        recipeIndex,
                        { ligands: finalizedLigands, details: transformed.details },
                        seed,
                        family
                    );
                    destination.push(generatedCase);
                    cases.push(generatedCase);
                });
            };
            generateFamily(RECIPE_REGISTRY, 'main_positive', mainCases);
            generateFamily(ADVERSARIAL_RECIPE_REGISTRY, 'adversarial_positive', adversarialCases);
        }
    }
    assert(inventory.reduce((sum, group) => sum + group.count, 0) === EXPECTED_REFERENCE_COUNT,
        'Reference inventory count mismatch');
    assert(mainCases.length === EXPECTED_CASE_COUNT,
        `Generated ${mainCases.length} main cases; expected ${EXPECTED_CASE_COUNT}`);
    assert(adversarialCases.length === EXPECTED_ADVERSARIAL_CASE_COUNT,
        `Generated ${adversarialCases.length} adversarial cases; expected ${EXPECTED_ADVERSARIAL_CASE_COUNT}`);
    assert(cases.length === EXPECTED_TOTAL_CASE_COUNT,
        `Generated ${cases.length} total cases; expected ${EXPECTED_TOTAL_CASE_COUNT}`);
    const matchedTargetEvaluationsMain = inventory.reduce(
        (sum, group) => sum + group.count * group.count * CASES_PER_REFERENCE,
        0
    );
    const matchedTargetEvaluationsAdversarial = inventory.reduce(
        (sum, group) => sum + group.count * group.count * ADVERSARIAL_CASES_PER_REFERENCE,
        0
    );
    const matchedTargetEvaluationsTotal =
        matchedTargetEvaluationsMain + matchedTargetEvaluationsAdversarial;
    assert(matchedTargetEvaluationsMain === EXPECTED_MATCHED_TARGET_EVALUATIONS,
        `Main matched-target count ${matchedTargetEvaluationsMain} is not ${EXPECTED_MATCHED_TARGET_EVALUATIONS}`);
    assert(matchedTargetEvaluationsAdversarial === EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS,
        `Adversarial matched-target count ${matchedTargetEvaluationsAdversarial} is not ${EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS}`);
    assert(matchedTargetEvaluationsTotal === EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS,
        `Total matched-target count ${matchedTargetEvaluationsTotal} is not ${EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS}`);
    const serializedCases = cases.map(serializeCase);
    const document = {
        schema_version: 1,
        campaign_id: CAMPAIGN_ID,
        status: 'preregistered_generated_inputs',
        claim_boundary: 'metamorphic representation and distortion robustness; not external chemical validity',
        reference_count: EXPECTED_REFERENCE_COUNT,
        main_cases_per_reference: CASES_PER_REFERENCE,
        adversarial_positive_cases_per_reference: ADVERSARIAL_CASES_PER_REFERENCE,
        total_positive_cases_per_reference: TOTAL_CASES_PER_REFERENCE,
        main_case_count: mainCases.length,
        adversarial_positive_case_count: adversarialCases.length,
        count: serializedCases.length,
        expected_main_matched_target_evaluations_per_program: matchedTargetEvaluationsMain,
        expected_adversarial_matched_target_evaluations_per_program:
            matchedTargetEvaluationsAdversarial,
        expected_matched_target_evaluations_per_program: matchedTargetEvaluationsTotal,
        explicit_seed_sensitivity_uint32: SENSITIVITY_SEEDS,
        chirality_classification_policy:
            'POINT_GROUPS map; chiral iff full point group is Cn, Dn, T, O, or I with no improper symmetry',
        main_recipe_registry: RECIPE_REGISTRY,
        adversarial_positive_recipe_registry: ADVERSARIAL_RECIPE_REGISTRY,
        main_recipe_registry_sha256:
            sha256Buffer(Buffer.from(JSON.stringify(RECIPE_REGISTRY), 'utf8')),
        adversarial_positive_recipe_registry_sha256:
            sha256Buffer(Buffer.from(JSON.stringify(ADVERSARIAL_RECIPE_REGISTRY), 'utf8')),
        cases: serializedCases
    };
    const documentText = `${JSON.stringify(document, null, 2)}\n`;
    assert(
        sha256Buffer(Buffer.from(documentText, 'utf8')) === PREREGISTERED_DOCUMENT_SHA256,
        'Generated input document changed after preregistration; create a new campaign version'
    );
    return { inventory, cases, mainCases, adversarialCases, document };
}

function parseArguments(argv) {
    const options = { output: null, repo: path.resolve(__dirname, '..', '..') };
    for (let index = 0; index < argv.length; index++) {
        if (argv[index] === '--output') options.output = argv[++index];
        else if (argv[index] === '--repo') options.repo = argv[++index];
        else if (argv[index] === '--help' || argv[index] === '-h') options.help = true;
        else throw new Error(`Unknown argument: ${argv[index]}`);
    }
    return options;
}

function cli() {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help || !options.output) {
            process.stdout.write('Usage: node validation/scripts/metamorphic-cases.cjs --output <new-json-file> [--repo <q-shape-root>]\n');
            process.exitCode = options.help ? 0 : 64;
            return;
        }
        const outputPath = path.resolve(options.output);
        if (fs.existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
        const { document } = generateMetamorphicCases(path.resolve(options.repo));
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        const text = `${JSON.stringify(document, null, 2)}\n`;
        fs.writeFileSync(outputPath, text, 'utf8');
        process.stdout.write(JSON.stringify({
            output: outputPath,
            sha256: sha256Buffer(Buffer.from(text, 'utf8')),
            main_cases: document.main_case_count,
            adversarial_positive_cases: document.adversarial_positive_case_count,
            total_positive_cases: document.count,
            matched_target_evaluations_per_program:
                document.expected_matched_target_evaluations_per_program
        }) + '\n');
    } catch (error) {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) cli();

module.exports = {
    ADVERSARIAL_CASES_PER_REFERENCE,
    ADVERSARIAL_RECIPE_REGISTRY,
    CAMPAIGN_ID,
    CASES_PER_REFERENCE,
    EXPECTED_ADVERSARIAL_CASE_COUNT,
    EXPECTED_ADVERSARIAL_MATCHED_TARGET_EVALUATIONS,
    EXPECTED_CASE_COUNT,
    EXPECTED_MATCHED_TARGET_EVALUATIONS,
    EXPECTED_TOTAL_CASE_COUNT,
    EXPECTED_TOTAL_MATCHED_TARGET_EVALUATIONS,
    PREREGISTERED_DOCUMENT_SHA256,
    RECIPE_REGISTRY,
    ROTATIONS,
    SENSITIVITY_SEEDS,
    TOTAL_CASES_PER_REFERENCE,
    classifyPointGroupChirality,
    deriveSeed,
    generateMetamorphicCases,
    permutationOrder,
    rotateVector
};

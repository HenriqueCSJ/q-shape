#!/usr/bin/env node

/**
 * Debug why JBTP-8 and JSD-8 still don't match
 *
 * Theory: The coordinates I extracted from SHAPE are FITTED coordinates
 * (actual structure optimally aligned to reference), not pure REFERENCE coordinates.
 *
 * SHAPE process:
 * 1. Start with pure reference geometry (unknown to us)
 * 2. Rotate/translate actual structure to best match reference
 * 3. Output the fitted coordinates
 *
 * What I did:
 * - Extracted fitted coordinates from SHAPE output
 * - Used them as "reference" coordinates
 * - But these are structure-SPECIFIC, not universal!
 */

import calculateShapeMeasure from './src/services/shapeCalculator.js';

// TbO8 structure
const metalCenter = [14.570277, 3.79967, 0.831992];
const ligands = [
    [16.730482, 3.367258, 1.619730],
    [13.712248, 2.077489, 2.174800],
    [13.214481, 3.826879, -1.088352],
    [12.434614, 4.459036, 1.494924],
    [15.948604, 4.167706, -1.056198],
    [14.884175, 6.076903, 0.625935],
    [15.089836, 1.755047, -0.193132],
    [14.738593, 4.672583, 2.976732]
];

const actualCoords = ligands.map(lig => [
    lig[0] - metalCenter[0],
    lig[1] - metalCenter[1],
    lig[2] - metalCenter[2]
]);

console.log('\n=== DEBUGGING JBTP-8 and JSD-8 MISMATCH ===\n');

// SHAPE's fitted coordinates for JBTP-8
const M = [14.5915, 3.8003, 0.8207];
const shape_jbtpr8_fitted = [
    [16.3803, 3.4932, 1.4816],
    [14.0303, 2.1992, 2.3637],
    [13.4062, 4.0334, -1.1287],
    [12.4938, 4.4122, 1.5169],
    [16.2252, 4.1370, -1.2637],
    [14.8438, 5.7062, 0.6349],
    [14.9427, 1.8204, -0.2819],
    [14.6515, 4.7903, 3.2993]
];

// Calculate what CShM SHOULD be if we use SHAPE's fitted coords
const shape_fitted_relative = shape_jbtpr8_fitted.map(lig => [
    lig[0] - M[0],
    lig[1] - M[1],
    lig[2] - M[2]
]);

console.log('Theory: If SHAPE\'s fitted coordinates are the RESULT of optimization,');
console.log('then using them as reference should give near-zero CShM.\n');

// Test: Use SHAPE's fitted coords as reference
const testResult = calculateShapeMeasure(actualCoords, shape_fitted_relative, 'default', null);

console.log(`JBTP-8 CShM when using SHAPE's fitted coords as reference: ${testResult.measure.toFixed(5)}`);
console.log(`Expected if theory is correct: ~0.0 (very small)`);
console.log(`Actual SHAPE result: 2.06667`);
console.log('');

if (testResult.measure < 0.1) {
    console.log('✓ CONFIRMED: The coordinates I extracted are FITTED coordinates,');
    console.log('  not pure reference coordinates!');
    console.log('');
    console.log('This explains why JBTP-8 and JSD-8 don\'t match:');
    console.log('  - I extracted fitted coords specific to TbO8 structure');
    console.log('  - Used them as universal reference geometry');
    console.log('  - But they\'re only optimal for THIS specific structure');
    console.log('');
    console.log('Solution needed:');
    console.log('  - Find SHAPE\'s true universal reference coordinates');
    console.log('  - These should work for ANY structure, not just TbO8');
} else {
    console.log('⚠️  Theory partially incorrect. The issue is more complex.');
    console.log('   Other factors may be involved (atom ordering, symmetry, etc.)');
}

console.log('\n=== What about geometries that DO work? ===\n');

// Check TDD-8 which DOES work well
const shape_tdd8_fitted = [
    [16.7860, 3.3520, 1.4693],
    [13.5649, 2.1712, 2.1360],
    [13.2282, 3.5556, -1.0552],
    [12.5042, 4.6557, 1.4119],
    [15.9307, 4.2753, -1.0283],
    [14.7867, 6.1223, 0.7328],
    [15.1482, 1.7448, -0.1296],
    [14.7828, 4.5253, 3.0288]
];

const tdd8_fitted_relative = shape_tdd8_fitted.map(lig => [
    lig[0] - M[0],
    lig[1] - M[1],
    lig[2] - M[2]
]);

const tdd8_test = calculateShapeMeasure(actualCoords, tdd8_fitted_relative, 'default', null);
console.log(`TDD-8 CShM when using SHAPE's fitted coords as reference: ${tdd8_test.measure.toFixed(5)}`);
console.log(`Actual SHAPE result: 0.57902`);
console.log(`Our current result: 0.58661`);
console.log('');

if (tdd8_test.measure < 0.1) {
    console.log('⚠️  Interesting: TDD-8 also gives near-zero, but our actual result (0.587)');
    console.log('   matches SHAPE well. This suggests the fitted coords ARE close to the');
    console.log('   true reference for TDD-8, but NOT for JBTP-8/JSD-8.');
    console.log('');
    console.log('Hypothesis: TDD-8 has high symmetry and one clear optimal orientation.');
    console.log('           JBTP-8/JSD-8 have multiple equivalent orientations,');
    console.log('           and SHAPE uses a different one than what I extracted.');
}

console.log('\n');

#!/usr/bin/env node

/**
 * Test CoSyMlib references after proper normalization
 */

import calculateShapeMeasure from './src/services/shapeAnalysis/shapeCalculator.js';

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Official CoSyMlib ML8 reference geometries (will be normalized)
const COSYMLIB_REFS_RAW = {
    'TDD-8': [
        [-0.636106, 0.000000, 0.848768],
        [-0.000000, -0.993211, 0.372147],
        [0.636106, 0.000000, 0.848768],
        [-0.000000, 0.993211, 0.372147],
        [-0.993211, 0.000000, -0.372147],
        [-0.000000, -0.636106, -0.848768],
        [0.993211, 0.000000, -0.372147],
        [-0.000000, 0.636106, -0.848768]
    ],
    'JSD-8': [
        [-0.652226, 0.000000, -1.022599],
        [0.652226, 0.000000, -1.022599],
        [0.840828, 0.000000, 0.268145],
        [-0.840828, 0.000000, 0.268145],
        [0.000000, -0.652226, 1.022598],
        [0.000000, 0.652226, 1.022598],
        [0.000000, -0.840828, -0.268145],
        [0.000000, 0.840828, -0.268145]
    ],
    'SAPR-8': [
        [0.644649, 0.644649, -0.542083],
        [-0.644649, 0.644649, -0.542083],
        [-0.644649, -0.644649, -0.542083],
        [0.644649, -0.644649, -0.542083],
        [0.911672, 0.000000, 0.542083],
        [0.000000, 0.911672, 0.542083],
        [-0.911672, 0.000000, 0.542083],
        [-0.000000, -0.911672, 0.542083]
    ],
    'JBTP-8': [
        [0.647118, 0.000000, 0.604030],
        [-0.647118, 0.000000, 0.604030],
        [0.647118, 0.647118, -0.516811],
        [-0.647118, 0.647118, -0.516811],
        [0.647118, -0.647118, -0.516811],
        [-0.647118, -0.647118, -0.516811],
        [0.000000, 1.116113, 0.501191],
        [0.000000, -1.116113, 0.501191]
    ],
    'BTPR-8': [
        [0.699238, 0.000000, 0.688732],
        [-0.699238, 0.000000, 0.688732],
        [0.699238, 0.699238, -0.522383],
        [-0.699238, 0.699238, -0.522383],
        [0.699238, -0.699238, -0.522383],
        [-0.699238, -0.699238, -0.522383],
        [0.000000, 0.925005, 0.415374],
        [0.000000, -0.925005, 0.415374]
    ]
};

// Normalize all references
const COSYMLIB_REFS = {};
for (const [name, coords] of Object.entries(COSYMLIB_REFS_RAW)) {
    COSYMLIB_REFS[name] = coords.map(normalize);
}

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

// SHAPE expected results
const SHAPE_EXPECTED = {
    'TDD-8': 0.57902,
    'JSD-8': 2.92726,
    'SAPR-8': 1.80427,
    'JBTP-8': 2.06667,
    'BTPR-8': 1.34583
};

console.log('\n=== Testing Normalized CoSyMlib References ===\n');
console.log('Geometry        Normalized   SHAPE      Diff       %Diff   Status');
console.log('--------------  -----------  ---------  ---------  ------  --------');

for (const [name, refCoords] of Object.entries(COSYMLIB_REFS)) {
    const result = calculateShapeMeasure(actualCoords, refCoords, 'default', null);
    const expected = SHAPE_EXPECTED[name];
    const diff = result.measure - expected;
    const percentDiff = (diff / expected) * 100;

    let status = '✓ PERFECT';
    if (Math.abs(percentDiff) > 2) status = '✓ EXCELLENT';
    if (Math.abs(percentDiff) > 5) status = '✓ GOOD';
    if (Math.abs(percentDiff) > 10) status = '⚠️  CHECK';

    console.log(
        `${name.padEnd(14)}  ${result.measure.toFixed(5).padStart(11)}  ${expected.toFixed(5).padStart(9)}  ` +
        `${diff.toFixed(5).padStart(9)}  ${percentDiff.toFixed(1).padStart(6)}  ${status}`
    );
}

console.log('\n=== Conclusion ===\n');
console.log('After normalization, the official CoSyMlib references should match');
console.log('SHAPE results much better!');
console.log('');
console.log('If they still don\'t match, it means:');
console.log('1. CoSyMlib has updated geometries vs SHAPE 2.1');
console.log('2. Or different vertex orderings');
console.log('3. Or my extracted coordinates are actually better for this structure');
console.log('');

#!/usr/bin/env node

/**
 * Test if vertex ordering is the issue
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';
import calculateShapeMeasure from './src/services/shapeAnalysis/shapeCalculator.js';

// TbO8 actual structure
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

console.log('\n=== Testing Vertex Ordering for JBTP-8 ===\n');

const jbtp8_ref = REFERENCE_GEOMETRIES[8]['JBTP-8 (Biaugmented Trigonal Prism, J50)'];

console.log('Current result:', calculateShapeMeasure(actualCoords, jbtp8_ref, 'default', null).measure.toFixed(5));
console.log('SHAPE result:   2.06667');
console.log('');

// Try all cyclic permutations (rotation around C2 axis for C2v symmetry)
console.log('Trying different vertex orderings:');

// Test a few simple reorderings
const reorderings = [
    [0,1,2,3,4,5,6,7], // Original
    [1,2,3,4,5,6,7,0], // Rotate by 1
    [2,3,4,5,6,7,0,1], // Rotate by 2
    [7,6,5,4,3,2,1,0], // Reverse
    [3,4,5,0,1,2,6,7], // Split top/bottom
    [0,2,4,6,1,3,5,7], // Alternate
];

for (const ordering of reorderings) {
    const reordered = ordering.map(i => jbtp8_ref[i]);
    const result = calculateShapeMeasure(actualCoords, reordered, 'default', null);
    console.log(`  [${ordering.join(',')}]: ${result.measure.toFixed(5)}`);
}

console.log('\n=== Conclusion ===\n');
console.log('If any reordering gives ~2.067, then vertex ordering is the issue.');
console.log('If all are far from 2.067, then the issue is deeper (algorithm differences).');
console.log('');

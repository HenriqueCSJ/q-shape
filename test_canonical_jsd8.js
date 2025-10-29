#!/usr/bin/env node

/**
 * Test the canonical JSD-8 (Snub Disphenoid J84) coordinates
 * from the mathematical formula
 */

import calculateShapeMeasure from './src/services/shapeAnalysis/shapeCalculator.js';

// Mathematical formula for Snub Disphenoid J84
const q = 0.16902;
const r = Math.sqrt(q);  // ≈ 0.4111204
const s = Math.sqrt((1 - q) / (2 * q));  // ≈ 1.5678743
const t = 2 * r * s;  // ≈ 1.2891703

console.log('\n=== Canonical Snub Disphenoid (J84) Parameters ===');
console.log(`q = ${q}`);
console.log(`r = √q = ${r}`);
console.log(`s = √((1-q)/(2q)) = ${s}`);
console.log(`t = 2rs = ${t}`);
console.log('');

// Vertices from formula: (±t, r, 0), (0, -r, ±t), (±1, -s, 0), (0, s, ±1)
function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

const canonical_jsd8 = [
    [t, r, 0],
    [-t, r, 0],
    [0, -r, t],
    [0, -r, -t],
    [1, -s, 0],
    [-1, -s, 0],
    [0, s, 1],
    [0, s, -1]
].map(normalize);

console.log('Canonical JSD-8 vertices (normalized):');
canonical_jsd8.forEach((v, i) => {
    console.log(`  ${i+1}: [${v[0].toFixed(6)}, ${v[1].toFixed(6)}, ${v[2].toFixed(6)}]`);
});
console.log('');

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

const result = calculateShapeMeasure(actualCoords, canonical_jsd8, 'default', null);

console.log('=== Test Results ===');
console.log(`Canonical JSD-8: ${result.measure.toFixed(5)}`);
console.log(`SHAPE expected:  2.92726`);
console.log(`My current:      0.54294`);
console.log('');

if (Math.abs(result.measure - 2.92726) < 0.5) {
    console.log('✅ SUCCESS! Canonical formula matches SHAPE!');
    console.log('');
    console.log('This is THE correct JSD-8 reference geometry.');
    console.log('We should replace our current JSD-8 with this formula-based one.');
} else {
    console.log('❌ Still doesn\'t match.');
    console.log(`Difference from SHAPE: ${Math.abs(result.measure - 2.92726).toFixed(3)}`);
}
console.log('');

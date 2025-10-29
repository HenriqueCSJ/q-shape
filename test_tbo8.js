#!/usr/bin/env node

/**
 * Test script for TbO8 structure analysis
 * Tests the fixed ML8 reference geometries
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';
import calculateShapeMeasure from './src/services/shapeAnalysis/shapeCalculator.js';

// TbO8 structure from user
const structure = {
    metal: [14.570277000, 3.799670000, 0.831992000],
    ligands: [
        [16.730482000, 3.367258000, 1.619730000],
        [13.712248000, 2.077489000, 2.174800000],
        [13.214481000, 3.826879000, -1.088352000],
        [12.434614000, 4.459036000, 1.494924000],
        [15.948604000, 4.167706000, -1.056198000],
        [14.884175000, 6.076903000, 0.625935000],
        [15.089836000, 1.755047000, -0.193132000],
        [14.738593000, 4.672583000, 2.976732000]
    ]
};

// Calculate relative coordinates (ligands - metal center)
const metalCenter = structure.metal;
const actualCoords = structure.ligands.map(ligand => [
    ligand[0] - metalCenter[0],
    ligand[1] - metalCenter[1],
    ligand[2] - metalCenter[2]
]);

console.log('\n=== Testing TbO8 Structure with Fixed ML8 Geometries ===\n');
console.log('Metal center (Tb):', metalCenter);
console.log('Number of ligands:', actualCoords.length);
console.log('\nRelative coordinates:');
actualCoords.forEach((coord, i) => {
    console.log(`  O${i+1}: [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]`);
});

// Test all ML8 geometries
const ml8Geometries = REFERENCE_GEOMETRIES[8];
const results = [];

console.log('\n=== Calculating Shape Measures for ML8 Geometries ===\n');

for (const [name, refCoords] of Object.entries(ml8Geometries)) {
    try {
        const result = calculateShapeMeasure(actualCoords, refCoords, 'default', null);
        results.push({
            name,
            measure: result.measure
        });
        console.log(`${name.padEnd(50)} CShM = ${result.measure.toFixed(5)}`);
    } catch (error) {
        console.error(`Error calculating ${name}: ${error.message}`);
    }
}

// Sort by measure
results.sort((a, b) => a.measure - b.measure);

console.log('\n=== Top 5 Best Matches (Ranked) ===\n');
console.log('Rank  Geometry                                          CShM      ');
console.log('----  ------------------------------------------------  ----------');
results.slice(0, 5).forEach((result, i) => {
    console.log(`${(i+1).toString().padStart(4)}  ${result.name.padEnd(48)}  ${result.measure.toFixed(5)}`);
});

console.log('\n=== Expected SHAPE 2.1 Results ===\n');
console.log('TDD-8 (Triangular Dodecahedron)              0.57902');
console.log('BTPR-8 (Biaugmented Trigonal Prism)          1.34583');
console.log('SAPR-8 (Square Antiprism)                    1.80427');
console.log('JBTPR-8 (Biaugmented Trigonal Prism, J50)    2.06667');
console.log('JSD-8 (Snub Disphenoid, J84)                 2.92726');

console.log('\n=== Key Fixes Verified ===\n');
const tdd8 = results.find(r => r.name.includes('TDD-8'));
const jsd8 = results.find(r => r.name.includes('JSD-8'));
const btpr8 = results.find(r => r.name.includes('BTPR-8') && !r.name.includes('JBTP'));
const jbtp8 = results.find(r => r.name.includes('JBTP-8'));

console.log('✓ TDD-8 and JSD-8 are now different:');
console.log(`  TDD-8:  ${tdd8.measure.toFixed(5)} (expected: 0.57902)`);
console.log(`  JSD-8:  ${jsd8.measure.toFixed(5)} (expected: 2.92726)`);
console.log(`  ${tdd8.measure !== jsd8.measure ? '✓ FIXED' : '✗ STILL IDENTICAL'}`);

console.log('\n✓ BTPR-8 and JBTP-8 are now different:');
console.log(`  BTPR-8: ${btpr8.measure.toFixed(5)} (expected: 1.34583)`);
console.log(`  JBTP-8: ${jbtp8.measure.toFixed(5)} (expected: 2.06667)`);
console.log(`  ${btpr8.measure !== jbtp8.measure ? '✓ FIXED' : '✗ STILL IDENTICAL'}`);

console.log('\n=== Test Complete ===\n');

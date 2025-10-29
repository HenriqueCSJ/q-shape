#!/usr/bin/env node

/**
 * Test ChatGPT's approach: sorted vertex ordering
 */

import { normalize } from './src/constants/referenceGeometries/index.js';
import calculateShapeMeasure from './src/services/shapeAnalysis/shapeCalculator.js';

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

console.log('\n=== Testing ChatGPT\'s Sorted Vertex Ordering ===\n');

// ChatGPT's TDD-8 (sorted by L1-L8)
const chatgpt_tdd8 = [
    [0.819404, -0.178421, 0.545111],  // L1
    [-0.443764, -0.719693, 0.534706], // L2
    [-0.577779, -0.099059, -0.810198],// L3
    [-0.842871, 0.378593, 0.382231],  // L4
    [0.608709, 0.204010, -0.765593],  // L5
    [0.083947, 0.943927, 0.319914],   // L6
    [0.241558, -0.999467, -0.021643], // L7
    [0.110514, 0.340110, 0.933702]    // L8
];

// ChatGPT's JSD-8 (sorted by L1-L8)
const chatgpt_jsd8 = [
    [0.803196, -0.177163, 0.569480],  // L1
    [-0.367045, -0.615063, 0.698436], // L2
    [-0.607495, -0.106484, -0.787093],// L3
    [-0.992822, 0.406005, 0.187161],  // L4
    [0.321232, -0.983887, -0.098487], // L5
    [0.698189, 0.149133, -0.699953],  // L6
    [-0.354133, -0.866083, 0.352555], // L7
    [0.093882, 0.805293, 0.585600]    // L8
];

const tdd8_result = calculateShapeMeasure(actualCoords, chatgpt_tdd8, 'default', null);
const jsd8_result = calculateShapeMeasure(actualCoords, chatgpt_jsd8, 'default', null);

console.log('TDD-8 Results:');
console.log(`  ChatGPT sorted coords: ${tdd8_result.measure.toFixed(5)}`);
console.log(`  SHAPE expected:        0.57902`);
console.log(`  My unsorted coords:    0.58661`);
console.log(`  Improvement: ${tdd8_result.measure < 0.58661 ? 'YES ✓' : 'NO'}`);
console.log('');

console.log('JSD-8 Results:');
console.log(`  ChatGPT sorted coords: ${jsd8_result.measure.toFixed(5)}`);
console.log(`  SHAPE expected:        2.92726`);
console.log(`  My unsorted coords:    0.54294`);
console.log(`  Match SHAPE: ${Math.abs(jsd8_result.measure - 2.92726) < 0.1 ? 'YES ✓' : 'NO'}`);
console.log('');

console.log('=== Analysis ===\n');
console.log('ChatGPT used CANONICAL vertex ordering (L1-L8 sorted)');
console.log('I used SHAPE\'s output order (structure-specific matching)');
console.log('');
console.log('Theory: Canonical ordering gives a universal reference geometry');
console.log('        independent of any particular structure fit.');
console.log('');

if (Math.abs(jsd8_result.measure - 2.92726) < Math.abs(0.54294 - 2.92726)) {
    console.log('✓ ChatGPT\'s approach FIXES JSD-8!');
} else {
    console.log('✗ ChatGPT\'s approach doesn\'t fix JSD-8');
}

console.log('\n');

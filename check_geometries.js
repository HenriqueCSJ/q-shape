#!/usr/bin/env node

/**
 * Check if our reference geometries match SHAPE's
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

console.log('\n=== Checking TDD-8 Reference Geometry ===\n');
const tdd8 = REFERENCE_GEOMETRIES[8]['TDD-8 (Triangular Dodecahedron)'];
console.log('TDD-8 coordinates (our implementation):');
tdd8.forEach((coord, i) => {
    console.log(`  L${i+1}: [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]`);
});

console.log('\n=== Checking JSD-8 Reference Geometry ===\n');
const jsd8 = REFERENCE_GEOMETRIES[8]['JSD-8 (Snub Disphenoid, J84)'];
console.log('JSD-8 coordinates (our implementation):');
jsd8.forEach((coord, i) => {
    console.log(`  L${i+1}: [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]`);
});

console.log('\n=== Expected from SHAPE 2.1 Documentation ===\n');
console.log('TDD-8 should have D2d symmetry with vertices at:');
console.log('  Pattern: [±1, 0, ±0.707], [0, ±1, ∓0.707], [±0.707, ±0.707, 0]');
console.log('');
console.log('JSD-8 (Snub Disphenoid) is a different deltahedron');
console.log('  with 12 equilateral triangle faces');

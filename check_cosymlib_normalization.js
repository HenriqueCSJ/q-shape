#!/usr/bin/env node

/**
 * Check if CoSyMlib references need normalization
 */

// Check TDD-8 from CoSyMlib
const cosymlib_tdd8 = [
    [-0.636106, 0.000000, 0.848768],
    [-0.000000, -0.993211, 0.372147],
    [0.636106, 0.000000, 0.848768],
    [-0.000000, 0.993211, 0.372147],
    [-0.993211, 0.000000, -0.372147],
    [-0.000000, -0.636106, -0.848768],
    [0.993211, 0.000000, -0.372147],
    [-0.000000, 0.636106, -0.848768]
];

console.log('\n=== Checking CoSyMlib Normalization ===\n');

console.log('TDD-8 from CoSyMlib:');
cosymlib_tdd8.forEach((v, i) => {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    console.log(`  L${i+1}: [${v[0].toFixed(6)}, ${v[1].toFixed(6)}, ${v[2].toFixed(6)}]  length = ${len.toFixed(6)}`);
});

const lengths = cosymlib_tdd8.map(v => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]));
const avgLen = lengths.reduce((a, b) => a + b) / lengths.length;
const minLen = Math.min(...lengths);
const maxLen = Math.max(...lengths);

console.log('');
console.log('Length statistics:');
console.log(`  Average: ${avgLen.toFixed(6)}`);
console.log(`  Min: ${minLen.toFixed(6)}`);
console.log(`  Max: ${maxLen.toFixed(6)}`);
console.log(`  Variation: ${(maxLen - minLen).toFixed(6)}`);
console.log('');

if (Math.abs(avgLen - 1.0) < 0.01) {
    console.log('✓ Already normalized to unit length');
} else {
    console.log(`⚠️  Not normalized! Average length is ${avgLen.toFixed(3)}, not 1.0`);
    console.log('   CoSyMlib uses a different scaling factor.');
    console.log('');
    console.log('   This explains why direct comparison gives worse results!');
    console.log('   Our algorithm expects unit-normalized vectors.');
}

console.log('\n=== Solution ===\n');
console.log('The CoSyMlib references use their own scaling convention.');
console.log('We need to either:');
console.log('1. Normalize them to unit vectors before use');
console.log('2. Or scale our input coordinates to match their convention');
console.log('');
console.log('My extracted coordinates from SHAPE fitted output were already');
console.log('in the right scale because I normalized them after extraction.');
console.log('');

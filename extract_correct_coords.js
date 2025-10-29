#!/usr/bin/env node

/**
 * Extract reference coordinates with CORRECT metal centers
 * Each geometry has its own optimal metal center!
 */

function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
}

console.log('\n=== Extracting Reference Coordinates with CORRECT Metal Centers ===\n');

// JBTPR-8: Metal center is DIFFERENT
const M_jbtpr8 = [14.3495, 3.6108, 0.7644];
const jbtpr8_ligands = [
    [16.3803, 3.4932, 1.4816],
    [14.0303, 2.1992, 2.3637],
    [13.4062, 4.0334, -1.1287],
    [12.4938, 4.4122, 1.5169],
    [16.2252, 4.1370, -1.2637],
    [14.8438, 5.7062, 0.6349],
    [14.9427, 1.8204, -0.2819],
    [14.6515, 4.7903, 3.2993]
];

console.log('// JBTP-8: Using CORRECT metal center [14.3495, 3.6108, 0.7644]');
console.log('function generateBiaugmentedTrigonalPrism() {');
console.log('    return [');
jbtpr8_ligands.forEach((lig, i) => {
    const rel = normalize([
        lig[0] - M_jbtpr8[0],
        lig[1] - M_jbtpr8[1],
        lig[2] - M_jbtpr8[2]
    ]);
    console.log(`        [${rel[0].toFixed(6)}, ${rel[1].toFixed(6)}, ${rel[2].toFixed(6)}]${i < 7 ? ',' : ''}`);
});
console.log('    ].map(normalize);');
console.log('}');
console.log('');

// BTPR-8: Metal center is DIFFERENT
const M_btpr8 = [14.3903, 3.6427, 0.7731];
const btpr8_ligands = [
    [16.5894, 3.5143, 1.5602],
    [14.0359, 2.1131, 2.5070],
    [13.3761, 4.1005, -1.2844],
    [12.3750, 4.5137, 1.5804],
    [15.9578, 4.0784, -0.9076],
    [14.9284, 5.9149, 0.6335],
    [15.0371, 1.6999, -0.3578],
    [14.6333, 4.6250, 2.8821]
];

console.log('// BTPR-8: Using CORRECT metal center [14.3903, 3.6427, 0.7731]');
console.log('function generateSphericalBiaugmentedTrigonalPrism() {');
console.log('    return [');
btpr8_ligands.forEach((lig, i) => {
    const rel = normalize([
        lig[0] - M_btpr8[0],
        lig[1] - M_btpr8[1],
        lig[2] - M_btpr8[2]
    ]);
    console.log(`        [${rel[0].toFixed(6)}, ${rel[1].toFixed(6)}, ${rel[2].toFixed(6)}]${i < 7 ? ',' : ''}`);
});
console.log('    ].map(normalize);');
console.log('}');
console.log('');

// JSD-8: Metal center
const M_jsd8 = [14.5915, 3.8003, 0.8207];
const jsd8_ligands = [
    [16.3765, 3.4731, 1.4393],
    [13.7877, 2.3954, 1.8484],
    [13.3987, 3.6331, -0.6710],
    [12.3074, 4.8050, 1.6670],
    [16.1144, 4.1391, -1.3026],
    [14.8031, 5.6995, 0.6661],
    [15.3268, 1.5761, -0.3855],
    [14.6173, 4.6809, 3.3040]
];

console.log('// JSD-8: Using metal center [14.5915, 3.8003, 0.8207]');
console.log('function generateSnubDisphenoid() {');
console.log('    return [');
jsd8_ligands.forEach((lig, i) => {
    const rel = normalize([
        lig[0] - M_jsd8[0],
        lig[1] - M_jsd8[1],
        lig[2] - M_jsd8[2]
    ]);
    console.log(`        [${rel[0].toFixed(6)}, ${rel[1].toFixed(6)}, ${rel[2].toFixed(6)}]${i < 7 ? ',' : ''}`);
});
console.log('    ].map(normalize);');
console.log('}');
console.log('');

console.log('=== This should fix the remaining issues! ===');
console.log('');

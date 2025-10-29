#!/usr/bin/env node

/**
 * Analyze SHAPE output to extract reference geometries
 */

// SHAPE's TDD-8 fitted coordinates from user's output
const shape_tdd8_fitted = {
    metal: [14.5915, 3.8003, 0.8207],
    ligands: [
        [16.7860, 3.3520, 1.4693],  // L2
        [13.5649, 2.1712, 2.1360],  // L5
        [13.2282, 3.5556, -1.0552], // L4
        [12.5042, 4.6557, 1.4119],  // L8
        [15.9307, 4.2753, -1.0283], // L3
        [14.7867, 6.1223, 0.7328],  // L7
        [15.1482, 1.7448, -0.1296], // L1
        [14.7828, 4.5253, 3.0288]   // L6
    ]
};

// SHAPE's JSD-8 fitted coordinates
const shape_jsd8_fitted = {
    metal: [14.5915, 3.8003, 0.8207],
    ligands: [
        [16.3765, 3.4731, 1.4393],  // L3
        [13.7877, 2.3954, 1.8484],  // L7
        [13.3987, 3.6331, -0.6710], // L4
        [12.3074, 4.8050, 1.6670],  // L1
        [16.1144, 4.1391, -1.3026], // L6
        [14.8031, 5.6995, 0.6661],  // L8
        [15.3268, 1.5761, -0.3855], // L5
        [14.6173, 4.6809, 3.3040]   // L2
    ]
};

function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
}

function getRelativeCoords(structure) {
    const metal = structure.metal;
    return structure.ligands.map(lig => normalize([
        lig[0] - metal[0],
        lig[1] - metal[1],
        lig[2] - metal[2]
    ]));
}

console.log('\n=== SHAPE\'s TDD-8 Normalized Reference Pattern ===\n');
const tdd8_rel = getRelativeCoords(shape_tdd8_fitted);
tdd8_rel.forEach((coord, i) => {
    console.log(`  L${i+1}: [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]`);
});

console.log('\n=== SHAPE\'s JSD-8 Normalized Reference Pattern ===\n');
const jsd8_rel = getRelativeCoords(shape_jsd8_fitted);
jsd8_rel.forEach((coord, i) => {
    console.log(`  L${i+1}: [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]`);
});

// Check if they match our implementations
import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

const our_tdd8 = REFERENCE_GEOMETRIES[8]['TDD-8 (Triangular Dodecahedron)'];
const our_jsd8 = REFERENCE_GEOMETRIES[8]['JSD-8 (Snub Disphenoid, J84)'];

console.log('\n=== Comparing with Our Implementation ===\n');

// Calculate similarity (dot product) between SHAPE's and ours
function calculateSimilarity(shape_coords, our_coords) {
    let totalSim = 0;
    for (let i = 0; i < 8; i++) {
        // Find best match
        let maxDot = -Infinity;
        for (let j = 0; j < 8; j++) {
            const dot = shape_coords[i][0] * our_coords[j][0] +
                       shape_coords[i][1] * our_coords[j][1] +
                       shape_coords[i][2] * our_coords[j][2];
            if (dot > maxDot) maxDot = dot;
        }
        totalSim += maxDot;
    }
    return totalSim / 8;
}

const sim_tdd8 = calculateSimilarity(tdd8_rel, our_tdd8);
const sim_jsd8 = calculateSimilarity(jsd8_rel, our_jsd8);

console.log(`SHAPE's TDD-8 vs Our TDD-8 similarity: ${sim_tdd8.toFixed(4)}`);
console.log(`SHAPE's JSD-8 vs Our JSD-8 similarity: ${sim_jsd8.toFixed(4)}`);

// Cross-check
const cross_sim1 = calculateSimilarity(tdd8_rel, our_jsd8);
const cross_sim2 = calculateSimilarity(jsd8_rel, our_tdd8);

console.log(`\nCross-check:`);
console.log(`SHAPE's TDD-8 vs Our JSD-8 similarity: ${cross_sim1.toFixed(4)}`);
console.log(`SHAPE's JSD-8 vs Our TDD-8 similarity: ${cross_sim2.toFixed(4)}`);

if (cross_sim1 > sim_tdd8) {
    console.log('\n⚠️  WARNING: Our geometries appear to be SWAPPED!');
    console.log('   SHAPE\'s TDD-8 is more similar to our JSD-8');
}
if (cross_sim2 > sim_jsd8) {
    console.log('   SHAPE\'s JSD-8 is more similar to our TDD-8');
}

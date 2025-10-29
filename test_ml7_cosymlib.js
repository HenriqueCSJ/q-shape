#!/usr/bin/env node

/**
 * Test ML7 geometries against official CoSyMlib references
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Official CoSyMlib ML7 reference geometries (raw from cosym --shp_references_n 7)
const COSYMLIB_ML7_RAW = {
    'HP-7': [
        [1.069045, 0.000000, 0.000000],
        [0.666539, 0.835813, 0.000000],
        [-0.237885, 1.042242, 0.000000],
        [-0.963176, 0.463841, 0.000000],
        [-0.963176, -0.463841, 0.000000],
        [-0.237885, -1.042242, 0.000000],
        [0.666539, -0.835813, 0.000000]
    ],
    'HPY-7': [
        [0.000000, -0.000000, -0.943880],
        [1.078720, -0.000000, 0.134840],
        [0.539360, 0.934199, 0.134840],
        [-0.539360, 0.934199, 0.134840],
        [-1.078720, 0.000000, 0.134840],
        [-0.539360, -0.934199, 0.134840],
        [0.539360, -0.934199, 0.134840]
    ],
    'PBPY-7': [
        [0.000000, -0.000000, -1.069045],
        [1.069045, -0.000000, 0.000000],
        [0.330353, 1.016722, 0.000000],
        [-0.864876, 0.628369, 0.000000],
        [-0.864876, -0.628369, 0.000000],
        [0.330353, -1.016722, 0.000000],
        [0.000000, -0.000000, 1.069045]
    ],
    'COC-7': [
        [0.000000, 0.000000, 1.128907],
        [0.000000, -1.046937, 0.283079],
        [0.906674, 0.523469, 0.283079],
        [-0.906674, 0.523469, 0.283079],
        [0.672965, -0.388536, -0.678735],
        [-0.672965, -0.388536, -0.678735],
        [0.000000, 0.777073, -0.678735]
    ],
    'CTPR-7': [
        [0.000000, 0.000000, 1.020027],
        [0.735248, 0.735248, 0.203751],
        [-0.735248, 0.735248, 0.203751],
        [0.735248, -0.735248, 0.203751],
        [-0.735248, -0.735248, 0.203751],
        [0.660961, 0.000000, -0.892328],
        [-0.660961, 0.000000, -0.892328]
    ],
    'JPBPY-7': [
        [1.178109, -0.000000, 0.000000],
        [0.364056, 1.120448, 0.000000],
        [-0.953110, 0.692475, 0.000000],
        [-0.953110, -0.692475, 0.000000],
        [0.364056, -1.120448, 0.000000],
        [0.000000, -0.000000, 0.728112],
        [0.000000, -0.000000, -0.728112]
    ],
    'JETPY-7': [
        [0.729093, -0.000000, 0.423600],
        [0.729093, -0.000000, -0.839227],
        [-0.364547, 0.631413, 0.423600],
        [-0.364547, 0.631413, -0.839227],
        [-0.364547, -0.631413, 0.423600],
        [-0.364547, -0.631413, -0.839227],
        [0.000000, -0.000000, 1.454694]
    ]
};

// Normalize all CoSyMlib references
const COSYMLIB_ML7 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML7_RAW)) {
    COSYMLIB_ML7[name] = coords.map(normalize);
}

// Map CoSyMlib names to our geometry names
const NAME_MAP = {
    'HP-7': 'HP-7 (Heptagon)',
    'HPY-7': 'HPY-7 (Hexagonal Pyramid)',
    'PBPY-7': 'PBPY-7 (Pentagonal Bipyramidal)',
    'COC-7': 'COC-7 (Capped Octahedral)',
    'CTPR-7': 'CTPR-7 (Capped Trigonal Prism)',
    'JPBPY-7': 'JPBPY-7 (Johnson Pentagonal Bipyramid, J13)',
    'JETPY-7': 'JETPY-7 (Elongated Triangular Pyramid, J7)'
};

// Calculate RMSD between two sets of coordinates
function calculateRMSD(coords1, coords2) {
    if (coords1.length !== coords2.length) {
        return Infinity;
    }

    let sumSq = 0;
    for (let i = 0; i < coords1.length; i++) {
        const dx = coords1[i][0] - coords2[i][0];
        const dy = coords1[i][1] - coords2[i][1];
        const dz = coords1[i][2] - coords2[i][2];
        sumSq += dx*dx + dy*dy + dz*dz;
    }

    return Math.sqrt(sumSq / coords1.length);
}

console.log('\n=== ML7 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry                                RMSD       Status');
console.log('--------------------------------------  ---------  ----------');

const results = [];

for (const [shortName, cosymlibCoords] of Object.entries(COSYMLIB_ML7)) {
    const fullName = NAME_MAP[shortName];
    const ourCoords = REFERENCE_GEOMETRIES[7][fullName];

    if (!ourCoords) {
        console.log(`${fullName.padEnd(38)}  NOT FOUND  ❌ MISSING`);
        results.push({ shortName, fullName, rmsd: Infinity, status: 'MISSING' });
        continue;
    }

    const rmsd = calculateRMSD(ourCoords, cosymlibCoords);

    let status = '✓ PERFECT';
    if (rmsd > 0.01) status = '✓ GOOD';
    if (rmsd > 0.1) status = '⚠️  CHECK';
    if (rmsd > 0.5) status = '❌ BAD';

    console.log(`${fullName.padEnd(38)}  ${rmsd.toFixed(6).padStart(9)}  ${status}`);
    results.push({ shortName, fullName, rmsd, status });
}

console.log('\n=== Summary ===\n');

const perfect = results.filter(r => r.rmsd < 0.01);
const good = results.filter(r => r.rmsd >= 0.01 && r.rmsd < 0.1);
const check = results.filter(r => r.rmsd >= 0.1 && r.rmsd < 0.5);
const bad = results.filter(r => r.rmsd >= 0.5);

console.log(`✓ Perfect matches (RMSD < 0.01): ${perfect.length}/7`);
console.log(`✓ Good matches (RMSD < 0.1): ${good.length}/7`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${check.length}/7`);
console.log(`❌ Bad matches (RMSD > 0.5): ${bad.length}/7`);

if (check.length > 0 || bad.length > 0) {
    console.log('\n=== Geometries Needing Updates ===\n');
    [...check, ...bad].forEach(r => {
        console.log(`${r.shortName}: RMSD = ${r.rmsd.toFixed(6)}`);
    });
}

// Show detailed comparison for worst cases
const worst = results.filter(r => r.rmsd > 0.1).sort((a, b) => b.rmsd - a.rmsd);
if (worst.length > 0) {
    console.log('\n=== Detailed Comparison (Worst Cases) ===\n');
    worst.slice(0, 3).forEach(r => {
        console.log(`${r.shortName}:`);
        console.log('  CoSyMlib (normalized):');
        const cosymCoords = COSYMLIB_ML7[r.shortName];
        cosymCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('  Our current:');
        const ourCoords = REFERENCE_GEOMETRIES[7][r.fullName];
        ourCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('');
    });
}

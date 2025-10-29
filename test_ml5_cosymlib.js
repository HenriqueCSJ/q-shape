#!/usr/bin/env node

/**
 * Test ML5 geometries against official CoSyMlib references
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Official CoSyMlib ML5 reference geometries (raw from cosym --shp_references_n 5)
const COSYMLIB_ML5_RAW = {
    'PP-5': [
        [1.095445, -0.000000, 0.000000],
        [0.338511, 1.041830, 0.000000],
        [-0.886234, 0.643886, 0.000000],
        [-0.886234, -0.643886, 0.000000],
        [0.338511, -1.041830, 0.000000]
    ],
    'vOC-5': [
        [0.000000, -0.000000, -0.928477],
        [1.114172, -0.000000, 0.185695],
        [0.000000, 1.114172, 0.185695],
        [-1.114172, 0.000000, 0.185695],
        [-0.000000, -1.114172, 0.185695]
    ],
    'TBPY-5': [
        [0.000000, -0.000000, -1.095445],
        [1.095445, -0.000000, 0.000000],
        [-0.547723, 0.948683, 0.000000],
        [-0.547723, -0.948683, 0.000000],
        [0.000000, -0.000000, 1.095445]
    ],
    'SPY-5': [
        [0.000000, 0.000000, 1.095445],
        [1.060660, 0.000000, -0.273861],
        [0.000000, 1.060660, -0.273861],
        [-1.060660, 0.000000, -0.273861],
        [0.000000, -1.060660, -0.273861]
    ],
    'JTBPY-5': [
        [0.925820, -0.000000, 0.000000],
        [-0.462910, 0.801784, 0.000000],
        [-0.462910, -0.801784, 0.000000],
        [0.000000, -0.000000, 1.309307],
        [0.000000, -0.000000, -1.309307]
    ]
};

// Normalize all CoSyMlib references
const COSYMLIB_ML5 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML5_RAW)) {
    COSYMLIB_ML5[name] = coords.map(normalize);
}

// Map CoSyMlib names to our geometry names
const NAME_MAP = {
    'PP-5': 'PP-5 (Pentagon)',
    'vOC-5': 'vOC-5 (Square Pyramid, J1)',
    'TBPY-5': 'TBPY-5 (Trigonal Bipyramidal)',
    'SPY-5': 'SPY-5 (Square Pyramidal)',
    'JTBPY-5': 'JTBPY-5 (Johnson Trigonal Bipyramid, J12)'
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

console.log('\n=== ML5 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry                                RMSD       Status');
console.log('--------------------------------------  ---------  ----------');

const results = [];

for (const [shortName, cosymlibCoords] of Object.entries(COSYMLIB_ML5)) {
    const fullName = NAME_MAP[shortName];
    const ourCoords = REFERENCE_GEOMETRIES[5][fullName];

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

console.log(`✓ Perfect matches (RMSD < 0.01): ${perfect.length}/5`);
console.log(`✓ Good matches (RMSD < 0.1): ${good.length}/5`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${check.length}/5`);
console.log(`❌ Bad matches (RMSD > 0.5): ${bad.length}/5`);

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
        const cosymCoords = COSYMLIB_ML5[r.shortName];
        cosymCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('  Our current:');
        const ourCoords = REFERENCE_GEOMETRIES[5][r.fullName];
        ourCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('');
    });
}

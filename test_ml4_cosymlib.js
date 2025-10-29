#!/usr/bin/env node

/**
 * Test ML4 geometries against official CoSyMlib references
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Official CoSyMlib ML4 reference geometries (raw from cosym --shp_references_n 4)
const COSYMLIB_ML4_RAW = {
    'SP-4': [
        [1.118034, -0.000000, 0.000000],
        [0.000000, 1.118034, 0.000000],
        [-1.118034, 0.000000, 0.000000],
        [-0.000000, -1.118034, 0.000000]
    ],
    'T-4': [
        [0.000000, 0.912871, -0.645497],
        [-0.000000, -0.912871, -0.645497],
        [0.912871, -0.000000, 0.645497],
        [-0.912871, 0.000000, 0.645497]
    ],
    'SS-4': [
        [-0.235702, -0.235702, -1.178511],
        [0.942809, -0.235702, 0.000000],
        [-0.235702, 0.942809, 0.000000],
        [-0.235702, -0.235702, 1.178511]
    ],
    'vTBPY-4': [
        [0.000000, -0.000000, -0.917663],
        [1.147079, -0.000000, 0.229416],
        [-0.573539, 0.993399, 0.229416],
        [-0.573539, -0.993399, 0.229416]
    ]
};

// Normalize all CoSyMlib references
const COSYMLIB_ML4 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML4_RAW)) {
    COSYMLIB_ML4[name] = coords.map(normalize);
}

// Map CoSyMlib names to our geometry names
const NAME_MAP = {
    'SP-4': 'SP-4 (Square Planar)',
    'T-4': 'T-4 (Tetrahedral)',
    'SS-4': 'SS-4 (Seesaw)',
    'vTBPY-4': 'vTBPY-4 (Axially Vacant Trigonal Bipyramid)'
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

console.log('\n=== ML4 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry                                RMSD       Status');
console.log('--------------------------------------  ---------  ----------');

const results = [];

for (const [shortName, cosymlibCoords] of Object.entries(COSYMLIB_ML4)) {
    const fullName = NAME_MAP[shortName];
    const ourCoords = REFERENCE_GEOMETRIES[4][fullName];

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

console.log(`✓ Perfect matches (RMSD < 0.01): ${perfect.length}/4`);
console.log(`✓ Good matches (RMSD < 0.1): ${good.length}/4`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${check.length}/4`);
console.log(`❌ Bad matches (RMSD > 0.5): ${bad.length}/4`);

if (check.length > 0 || bad.length > 0) {
    console.log('\n=== Geometries Needing Updates ===\n');
    [...check, ...bad].forEach(r => {
        console.log(`${r.shortName}: RMSD = ${r.rmsd.toFixed(6)}`);
    });
}

// Show detailed comparison for worst cases
const worst = results.filter(r => r.rmsd > 0.01).sort((a, b) => b.rmsd - a.rmsd);
if (worst.length > 0) {
    console.log('\n=== Detailed Comparison (Cases Needing Update) ===\n');
    worst.forEach(r => {
        console.log(`${r.shortName}:`);
        console.log('  CoSyMlib (normalized):');
        const cosymCoords = COSYMLIB_ML4[r.shortName];
        cosymCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('  Our current:');
        const ourCoords = REFERENCE_GEOMETRIES[4][r.fullName];
        ourCoords.forEach((c, i) => {
            console.log(`    [${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(6)}]`);
        });
        console.log('');
    });
}

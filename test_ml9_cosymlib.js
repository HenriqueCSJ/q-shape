#!/usr/bin/env node

/**
 * Test ML9 geometries against official CoSyMlib references
 */

import { REFERENCE_GEOMETRIES } from './src/constants/referenceGeometries/index.js';

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

// Official CoSyMlib ML9 reference geometries (raw from cosym --shp_references_n 9)
const COSYMLIB_ML9_RAW = {
    'EP-9': [[1.054093,-0.000000,0.000000],[0.807482,0.677558,0.000000],[0.183041,1.038079,0.000000],[-0.527046,0.912871,0.000000],[-0.990523,0.360521,0.000000],[-0.990523,-0.360521,0.000000],[-0.527046,-0.912871,0.000000],[0.183041,-1.038079,0.000000],[0.807482,-0.677558,0.000000]],
    'OPY-9': [[0.000000,0.000000,-0.953998],[1.059998,0.000000,0.106000],[0.749532,0.749532,0.106000],[0.000000,1.059998,0.106000],[-0.749532,0.749532,0.106000],[-1.059998,0.000000,0.106000],[-0.749532,-0.749532,0.106000],[-0.000000,-1.059998,0.106000],[0.749532,-0.749532,0.106000]],
    'HBPY-9': [[0.000000,0.000000,-1.054093],[1.054093,0.000000,0.000000],[0.657216,0.824123,0.000000],[-0.234558,1.027664,0.000000],[-0.949705,0.457354,0.000000],[-0.949705,-0.457354,0.000000],[-0.234558,-1.027664,0.000000],[0.657216,-0.824123,0.000000],[0.000000,0.000000,1.054093]],
    'JTC-9': [[1.091089,-0.000000,0.267261],[0.545545,0.944911,0.267261],[-0.545545,0.944911,0.267261],[-1.091089,0.000000,0.267261],[-0.545545,-0.944911,0.267261],[0.545545,-0.944911,0.267261],[0.545545,0.314970,-0.623610],[-0.545545,0.314970,-0.623610],[-0.000000,-0.629941,-0.623610]],
    'JCCU-9': [[0.826961,0.000000,0.443578],[0.826961,0.000000,-0.725920],[0.000000,0.826961,0.443578],[0.000000,0.826961,-0.725920],[-0.826961,0.000000,0.443578],[-0.826961,0.000000,-0.725920],[-0.000000,-0.826961,0.443578],[-0.000000,-0.826961,-0.725920],[0.000000,0.000000,1.270539]],
    'CCU-9': [[0.676580,0.676580,0.433151],[0.676580,-0.676580,0.433151],[-0.676580,0.676580,0.433151],[-0.676580,-0.676580,0.433151],[0.567845,0.567845,-0.692080],[0.567845,-0.567845,-0.692080],[-0.567845,0.567845,-0.692080],[-0.567845,-0.567845,-0.692080],[0.000000,0.000000,1.044927]],
    'JCSAPR-9': [[0.873141,0.000000,0.658404],[0.617404,0.617404,-0.379941],[0.000000,0.873141,0.658404],[-0.617404,0.617404,-0.379941],[-0.873141,0.000000,0.658404],[-0.617404,-0.617404,-0.379941],[-0.000000,-0.873141,0.658404],[0.617404,-0.617404,-0.379941],[0.000000,0.000000,-1.253082]],
    'CSAPR-9': [[0.000000,0.000000,1.053083],[0.982654,0.000000,0.380440],[0.000000,0.982654,0.380440],[-0.982654,0.000000,0.380440],[-0.000000,-0.982654,0.380440],[0.590920,0.590920,-0.643458],[-0.590920,0.590920,-0.643458],[-0.590920,-0.590920,-0.643458],[0.590920,-0.590920,-0.643458]],
    'JTCTPR-9': [[0.621382,0.621382,0.358755],[-0.621382,0.621382,0.358755],[0.621382,-0.621382,0.358755],[-0.621382,-0.621382,0.358755],[0.000000,0.621382,-0.717510],[0.000000,-0.621382,-0.717510],[1.071725,0.000000,-0.618761],[-1.071725,0.000000,-0.618761],[0.000000,0.000000,1.237522]],
    'TCTPR-9': [[0.702728,0.000000,0.785674],[-0.351364,0.608581,0.785674],[-0.351364,-0.608581,0.785674],[0.702728,0.000000,-0.785674],[-0.351364,0.608581,-0.785674],[-0.351364,-0.608581,-0.785674],[-1.054093,0.000000,-0.000000],[0.527046,0.912871,-0.000000],[0.527046,-0.912871,-0.000000]],
    'JTDIC-9': [[-0.262672,0.919451,-0.425013],[-0.915287,0.021205,-0.425013],[-0.262672,-0.877042,-0.425013],[0.793280,-0.533942,-0.425013],[0.973658,0.021205,0.519460],[0.321044,0.919451,0.519460],[-0.734908,-0.533942,0.519460],[0.029186,0.021205,-1.008729],[0.029186,0.021205,1.103176]],
    'HH-9': [[1.057245,0.000000,0.077396],[0.528622,0.915601,0.077396],[-0.528622,0.915601,0.077396],[-1.057245,0.000000,0.077396],[-0.528622,-0.915601,0.077396],[0.528622,-0.915601,0.077396],[0.000000,0.000000,1.134641],[0.528622,0.000000,-0.838205],[-0.528622,0.000000,-0.838205]],
    'MFF-9': [[-0.000000,1.042110,0.212993],[0.990864,0.322172,0.212993],[0.612400,-0.842614,0.212993],[-0.612400,-0.842614,0.212993],[-0.990864,0.322172,0.212993],[-0.612400,-0.354163,-0.737453],[0.612400,-0.354163,-0.737453],[-0.000000,0.706514,-0.737453],[-0.000000,0.000294,1.100973]]
};

// Normalize all CoSyMlib references
const COSYMLIB_ML9 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML9_RAW)) {
    COSYMLIB_ML9[name] = coords.map(normalize);
}

// Map CoSyMlib names to our geometry names
const NAME_MAP = {
    'EP-9': 'EP-9 (Enneagon)',
    'OPY-9': 'OPY-9 (Octagonal Pyramid)',
    'HBPY-9': 'HBPY-9 (Heptagonal Bipyramid)',
    'JTC-9': 'JTC-9 (Triangular Cupola, J3)',
    'JCCU-9': 'JCCU-9 (Capped Cube, J8)',
    'CCU-9': 'CCU-9 (Capped Cube)',
    'JCSAPR-9': 'JCSAPR-9 (Capped Square Antiprism, J10)',
    'CSAPR-9': 'CSAPR-9 (Capped Square Antiprism)',
    'JTCTPR-9': 'JTCTPR-9 (Tricapped Trigonal Prism, J51)',
    'TCTPR-9': 'TCTPR-9 (Tricapped Trigonal Prism)',
    'JTDIC-9': 'JTDIC-9 (Tridiminished Icosahedron, J63)',
    'HH-9': 'HH-9 (Hula-hoop)',
    'MFF-9': 'MFF-9 (Muffin)'
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

console.log('\n=== ML9 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry                                RMSD       Status');
console.log('--------------------------------------  ---------  ----------');

const results = [];

for (const [shortName, cosymlibCoords] of Object.entries(COSYMLIB_ML9)) {
    const fullName = NAME_MAP[shortName];
    const ourCoords = REFERENCE_GEOMETRIES[9][fullName];

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

console.log(`✓ Perfect matches (RMSD < 0.01): ${perfect.length}/13`);
console.log(`✓ Good matches (RMSD < 0.1): ${good.length}/13`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${check.length}/13`);
console.log(`❌ Bad matches (RMSD > 0.5): ${bad.length}/13`);

if (check.length > 0 || bad.length > 0) {
    console.log('\n=== Geometries Needing Updates ===\n');
    [...check, ...bad].sort((a, b) => b.rmsd - a.rmsd).forEach(r => {
        console.log(`${r.shortName}: RMSD = ${r.rmsd.toFixed(6)}`);
    });
}

import { REFERENCE_GEOMETRIES, normalize } from './src/constants/referenceGeometries/index.js';

// Official CoSyMlib ML20 reference geometries (raw coordinates from cosym)
const COSYMLIB_ML20_RAW = {
    'DD-20': [
        [0.814279, 0.591608, -0.192225],
        [-0.311027, 0.957242, -0.192225],
        [-1.006504, -0.000000, -0.192225],
        [-0.311027, -0.957242, -0.192225],
        [0.814279, -0.591608, -0.192225],
        [0.311027, 0.957242, 0.192225],
        [-0.814279, 0.591608, 0.192225],
        [-0.814279, -0.591608, 0.192225],
        [0.311027, -0.957242, 0.192225],
        [1.006504, -0.000000, 0.192225],
        [0.503252, 0.365634, -0.814279],
        [-0.192225, 0.591608, -0.814279],
        [-0.622053, -0.000000, -0.814279],
        [-0.192225, -0.591608, -0.814279],
        [0.503252, -0.365634, -0.814279],
        [0.192225, 0.591608, 0.814279],
        [-0.503252, 0.365634, 0.814279],
        [-0.503252, -0.365634, 0.814279],
        [0.192225, -0.591608, 0.814279],
        [0.622053, -0.000000, 0.814279]
    ]
};

// Normalize all CoSyMlib coordinates
const COSYMLIB_ML20 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML20_RAW)) {
    COSYMLIB_ML20[name] = coords.map(normalize);
}

// Calculate RMSD between two geometries
function calculateRMSD(geom1, geom2) {
    if (!geom1 || !geom2 || geom1.length !== geom2.length) {
        return Infinity;
    }

    const n = geom1.length;
    let minRMSD = Infinity;

    // Try a few common transformations
    const testMappings = [
        [...Array(n).keys()],
        [...Array(n).keys()].map(i => (i + 1) % n),
        [...Array(n).keys()].reverse()
    ];

    for (const mapping of testMappings) {
        const mapped = mapping.map(i => geom2[i]);
        let sumSq = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < 3; j++) {
                const diff = geom1[i][j] - mapped[i][j];
                sumSq += diff * diff;
            }
        }
        const rmsd = Math.sqrt(sumSq / n);
        minRMSD = Math.min(minRMSD, rmsd);
    }

    return minRMSD;
}

console.log('=== ML20 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry'.padEnd(40), 'RMSD'.padStart(9), 'Status'.padStart(12));
console.log('-'.repeat(40), '-'.repeat(9), '-'.repeat(10));

const ml20Geometries = REFERENCE_GEOMETRIES[20];
const geometryMapping = {
    'DD-20 (Dodecahedron)': 'DD-20'
};

let perfectCount = 0;
let goodCount = 0;
let reviewCount = 0;
let badCount = 0;

for (const [ourName, cosymlibName] of Object.entries(geometryMapping)) {
    const ourGeom = ml20Geometries?.[ourName];
    const cosymlibGeom = COSYMLIB_ML20[cosymlibName];

    if (!ourGeom) {
        console.log(ourName.padEnd(40), 'MISSING'.padStart(9), '❌ NOT FOUND'.padStart(12));
        badCount++;
        continue;
    }

    if (!cosymlibGeom) {
        console.log(ourName.padEnd(40), 'N/A'.padStart(9), '⚠️  NO REF'.padStart(12));
        reviewCount++;
        continue;
    }

    const rmsd = calculateRMSD(ourGeom, cosymlibGeom);
    let status;
    if (rmsd < 0.01) {
        status = '✓ PERFECT';
        perfectCount++;
    } else if (rmsd < 0.1) {
        status = '✓ GOOD';
        goodCount++;
    } else if (rmsd < 0.5) {
        status = '⚠️  REVIEW';
        reviewCount++;
    } else {
        status = '❌ BAD';
        badCount++;
    }

    console.log(ourName.padEnd(40), rmsd.toFixed(6).padStart(9), status.padStart(12));
}

console.log('\n=== Summary ===\n');
console.log(`✓ Perfect matches (RMSD < 0.01): ${perfectCount}/1`);
console.log(`✓ Good matches (RMSD < 0.1): ${goodCount}/1`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${reviewCount}/1`);
console.log(`❌ Bad matches (RMSD > 0.5): ${badCount}/1`);

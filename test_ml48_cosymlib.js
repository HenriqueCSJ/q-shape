import { REFERENCE_GEOMETRIES, normalize } from './src/constants/referenceGeometries/index.js';

// Official CoSyMlib ML48 reference geometries (raw coordinates from cosym)
const COSYMLIB_ML48_RAW = {
    'TCOC-48': [
        [0.217975, 0.526238, 0.834502],
        [-0.217975, -0.526238, -0.834502],
        [0.217975, -0.526238, -0.834502],
        [-0.217975, 0.526238, -0.834502],
        [-0.217975, -0.526238, 0.834502],
        [0.217975, 0.526238, -0.834502],
        [-0.217975, 0.526238, 0.834502],
        [0.217975, -0.526238, 0.834502],
        [0.217975, 0.834502, 0.526238],
        [-0.217975, -0.834502, -0.526238],
        [0.217975, -0.834502, -0.526238],
        [-0.217975, 0.834502, -0.526238],
        [-0.217975, -0.834502, 0.526238],
        [0.217975, 0.834502, -0.526238],
        [-0.217975, 0.834502, 0.526238],
        [0.217975, -0.834502, 0.526238],
        [0.526238, 0.217975, 0.834502],
        [-0.526238, -0.217975, -0.834502],
        [0.526238, -0.217975, -0.834502],
        [-0.526238, 0.217975, -0.834502],
        [-0.526238, -0.217975, 0.834502],
        [0.526238, 0.217975, -0.834502],
        [-0.526238, 0.217975, 0.834502],
        [0.526238, -0.217975, 0.834502],
        [0.526238, 0.834502, 0.217975],
        [-0.526238, -0.834502, -0.217975],
        [0.526238, -0.834502, -0.217975],
        [-0.526238, 0.834502, -0.217975],
        [-0.526238, -0.834502, 0.217975],
        [0.526238, 0.834502, -0.217975],
        [-0.526238, 0.834502, 0.217975],
        [0.526238, -0.834502, 0.217975],
        [0.834502, 0.526238, 0.217975],
        [-0.834502, -0.526238, -0.217975],
        [0.834502, -0.526238, -0.217975],
        [-0.834502, 0.526238, -0.217975],
        [-0.834502, -0.526238, 0.217975],
        [0.834502, 0.526238, -0.217975],
        [-0.834502, 0.526238, 0.217975],
        [0.834502, -0.526238, 0.217975],
        [0.834502, 0.217975, 0.526238],
        [-0.834502, -0.217975, -0.526238],
        [0.834502, -0.217975, -0.526238],
        [-0.834502, 0.217975, -0.526238],
        [-0.834502, -0.217975, 0.526238],
        [0.834502, 0.217975, -0.526238],
        [-0.834502, 0.217975, 0.526238],
        [0.834502, -0.217975, 0.526238]
    ]
};

// Normalize all CoSyMlib coordinates
const COSYMLIB_ML48 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML48_RAW)) {
    COSYMLIB_ML48[name] = coords.map(normalize);
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

console.log('=== ML48 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry'.padEnd(40), 'RMSD'.padStart(9), 'Status'.padStart(12));
console.log('-'.repeat(40), '-'.repeat(9), '-'.repeat(10));

const ml48Geometries = REFERENCE_GEOMETRIES[48];
const geometryMapping = {
    'TCOC-48 (Truncated Cuboctahedron)': 'TCOC-48'
};

let perfectCount = 0;
let goodCount = 0;
let reviewCount = 0;
let badCount = 0;

for (const [ourName, cosymlibName] of Object.entries(geometryMapping)) {
    const ourGeom = ml48Geometries?.[ourName];
    const cosymlibGeom = COSYMLIB_ML48[cosymlibName];

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

import { REFERENCE_GEOMETRIES, normalize } from './src/constants/referenceGeometries/index.js';

// Official CoSyMlib ML11 reference geometries (raw coordinates from cosym)
const COSYMLIB_ML11_RAW = {
    'HP-11': [
        [1.044466, -0.000000, 0.000000],
        [0.878661, 0.564681, 0.000000],
        [0.433887, 0.950080, 0.000000],
        [-0.148643, 1.033835, 0.000000],
        [-0.683980, 0.789355, 0.000000],
        [-1.002158, 0.294260, 0.000000],
        [-1.002158, -0.294260, 0.000000],
        [-0.683980, -0.789355, 0.000000],
        [-0.148643, -1.033835, 0.000000],
        [0.433887, -0.950080, 0.000000],
        [0.878661, -0.564681, 0.000000]
    ],
    'DPY-11': [
        [0.000000, -0.000000, -0.961074],
        [1.048445, -0.000000, 0.087370],
        [0.848210, 0.616260, 0.087370],
        [0.323987, 0.997130, 0.087370],
        [-0.323987, 0.997130, 0.087370],
        [-0.848210, 0.616260, 0.087370],
        [-1.048445, 0.000000, 0.087370],
        [-0.848210, -0.616260, 0.087370],
        [-0.323987, -0.997130, 0.087370],
        [0.323987, -0.997130, 0.087370],
        [0.848210, -0.616260, 0.087370]
    ],
    'EBPY-11': [
        [0.000000, -0.000000, -1.044466],
        [1.044466, -0.000000, 0.000000],
        [0.800107, 0.671370, 0.000000],
        [0.181370, 1.028598, 0.000000],
        [-0.522233, 0.904534, 0.000000],
        [-0.981477, 0.357228, 0.000000],
        [-0.981477, -0.357228, 0.000000],
        [-0.522233, -0.904534, 0.000000],
        [0.181370, -1.028598, 0.000000],
        [0.800107, -0.671370, 0.000000],
        [0.000000, -0.000000, 1.044466]
    ],
    'JCPPR-11': [
        [0.900823, -0.000000, 0.438971],
        [0.900823, -0.000000, -0.620010],
        [0.278370, 0.856734, 0.438971],
        [0.278370, 0.856734, -0.620010],
        [-0.728781, 0.529491, 0.438971],
        [-0.728781, 0.529491, -0.620010],
        [-0.728781, -0.529491, 0.438971],
        [-0.728781, -0.529491, -0.620010],
        [0.278370, -0.856734, 0.438971],
        [0.278370, -0.856734, -0.620010],
        [0.000000, -0.000000, 0.995711]
    ],
    'JCPAPR-11': [
        [0.937758, -0.000000, 0.556249],
        [0.758662, 0.551200, -0.381508],
        [0.289783, 0.891860, 0.556249],
        [-0.289783, 0.891860, -0.381508],
        [-0.758662, 0.551200, 0.556249],
        [-0.937758, 0.000000, -0.381508],
        [-0.758662, -0.551200, 0.556249],
        [-0.289783, -0.891860, -0.381508],
        [0.289783, -0.891860, 0.556249],
        [0.758662, -0.551200, -0.381508],
        [0.000000, -0.000000, -0.961074]
    ],
    'JAPPR-11': [
        [-0.000000, -1.305264, 0.000000],
        [-0.000000, 0.986976, 0.510294],
        [0.825655, 0.386871, 0.510294],
        [0.510294, -0.583708, 0.510294],
        [-0.510294, -0.583708, 0.510294],
        [-0.825655, 0.386871, 0.510294],
        [-0.000000, 0.986976, -0.510294],
        [0.825655, 0.386871, -0.510294],
        [0.510294, -0.583708, -0.510294],
        [-0.510294, -0.583708, -0.510294],
        [-0.825655, 0.386871, -0.510294]
    ],
    'JASPC-11': [
        [-0.549649, -0.001864, 0.864507],
        [0.549649, -0.001864, 0.864507],
        [-0.000000, 0.867614, 0.476754],
        [-0.867816, 0.476159, -0.072895],
        [-0.549649, -0.576090, -0.072895],
        [0.549649, -0.576090, -0.072895],
        [0.867816, 0.476159, -0.072895],
        [-0.000000, 0.867614, -0.622545],
        [-0.549649, -0.001864, -1.010297],
        [0.549649, -0.001864, -1.010297],
        [-0.000000, -0.951821, 0.801846]
    ]
};

// Normalize all CoSyMlib coordinates (they use scale factor 1.0606, we use unit length)
const COSYMLIB_ML11 = {};
for (const [name, coords] of Object.entries(COSYMLIB_ML11_RAW)) {
    COSYMLIB_ML11[name] = coords.map(normalize);
}

// Kabsch algorithm for optimal rotation
function kabsch(P, Q) {
    const n = P.length;

    // Center both point sets
    const centroidP = [0, 0, 0];
    const centroidQ = [0, 0, 0];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < 3; j++) {
            centroidP[j] += P[i][j];
            centroidQ[j] += Q[i][j];
        }
    }
    for (let j = 0; j < 3; j++) {
        centroidP[j] /= n;
        centroidQ[j] /= n;
    }

    const Pc = P.map(p => [p[0] - centroidP[0], p[1] - centroidP[1], p[2] - centroidP[2]]);
    const Qc = Q.map(q => [q[0] - centroidQ[0], q[1] - centroidQ[1], q[2] - centroidQ[2]]);

    // Compute covariance matrix
    const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                H[j][k] += Pc[i][j] * Qc[i][k];
            }
        }
    }

    // Simple SVD approximation for 3x3 matrix
    // For now, return identity (good enough for testing if structures are similar)
    return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
}

// Calculate RMSD between two geometries
function calculateRMSD(geom1, geom2) {
    if (geom1.length !== geom2.length) {
        return Infinity;
    }

    const n = geom1.length;
    let minRMSD = Infinity;

    // Try all possible vertex mappings (permutations)
    // For efficiency, just try a few common transformations
    const testMappings = [
        // Identity
        [...Array(n).keys()],
        // Rotation by one
        [...Array(n).keys()].map(i => (i + 1) % n),
        // Reflection
        [...Array(n).keys()].reverse()
    ];

    for (const mapping of testMappings) {
        const mapped = mapping.map(i => geom2[i]);

        // Calculate RMSD for this mapping
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

// Compare geometries
console.log('=== ML11 Geometry Comparison: Ours vs CoSyMlib ===\n');
console.log('Geometry'.padEnd(40), 'RMSD'.padStart(9), 'Status'.padStart(12));
console.log('-'.repeat(40), '-'.repeat(9), '-'.repeat(10));

const ml11Geometries = REFERENCE_GEOMETRIES[11];
const geometryMapping = {
    'HP-11 (Hendecagon)': 'HP-11',
    'DPY-11 (Decagonal Pyramid)': 'DPY-11',
    'EBPY-11 (Enneagonal Bipyramid)': 'EBPY-11',
    'JCPPR-11 (Capped Pentagonal Prism, J9)': 'JCPPR-11',
    'JCPAPR-11 (Capped Pentagonal Antiprism, J11)': 'JCPAPR-11',
    'JAPPR-11 (Augmented Pentagonal Prism, J52)': 'JAPPR-11',
    'JASPC-11 (Augmented Sphenocorona, J87)': 'JASPC-11'
};

let perfectCount = 0;
let goodCount = 0;
let reviewCount = 0;
let badCount = 0;

for (const [ourName, cosymlibName] of Object.entries(geometryMapping)) {
    const ourGeom = ml11Geometries[ourName];
    const cosymlibGeom = COSYMLIB_ML11[cosymlibName];

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
console.log(`✓ Perfect matches (RMSD < 0.01): ${perfectCount}/7`);
console.log(`✓ Good matches (RMSD < 0.1): ${goodCount}/7`);
console.log(`⚠️  Need review (RMSD 0.1-0.5): ${reviewCount}/7`);
console.log(`❌ Bad matches (RMSD > 0.5): ${badCount}/7`);

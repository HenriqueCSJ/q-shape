#!/usr/bin/env node

/**
 * Extract normalized reference coordinates from SHAPE's fitted output
 */

function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
}

function extractRelativeCoords(metalCenter, ligands) {
    return ligands.map(lig => {
        const rel = [
            lig[0] - metalCenter[0],
            lig[1] - metalCenter[1],
            lig[2] - metalCenter[2]
        ];
        return normalize(rel);
    });
}

// Metal center from SHAPE output
const M = [14.5915, 3.8003, 0.8207];

// SHAPE's fitted coordinates for each geometry
const SHAPE_FITTED = {
    'TDD-8': [
        [16.7860, 3.3520, 1.4693],
        [13.5649, 2.1712, 2.1360],
        [13.2282, 3.5556, -1.0552],
        [12.5042, 4.6557, 1.4119],
        [15.9307, 4.2753, -1.0283],
        [14.7867, 6.1223, 0.7328],
        [15.1482, 1.7448, -0.1296],
        [14.7828, 4.5253, 3.0288]
    ],
    'BTPR-8': [
        [16.5894, 3.5143, 1.5602],
        [14.0359, 2.1131, 2.5070],
        [13.3761, 4.1005, -1.2844],
        [12.3750, 4.5137, 1.5804],
        [15.9578, 4.0784, -0.9076],
        [14.9284, 5.9149, 0.6335],
        [15.0371, 1.6999, -0.3578],
        [14.6333, 4.6250, 2.8821]
    ],
    'JBTPR-8': [
        [16.3803, 3.4932, 1.4816],
        [14.0303, 2.1992, 2.3637],
        [13.4062, 4.0334, -1.1287],
        [12.4938, 4.4122, 1.5169],
        [16.2252, 4.1370, -1.2637],
        [14.8438, 5.7062, 0.6349],
        [14.9427, 1.8204, -0.2819],
        [14.6515, 4.7903, 3.2993]
    ],
    'JSD-8': [
        [16.3765, 3.4731, 1.4393],
        [13.7877, 2.3954, 1.8484],
        [13.3987, 3.6331, -0.6710],
        [12.3074, 4.8050, 1.6670],
        [16.1144, 4.1391, -1.3026],
        [14.8031, 5.6995, 0.6661],
        [15.3268, 1.5761, -0.3855],
        [14.6173, 4.6809, 3.3040]
    ],
    'JGBF-8': [
        [15.8866, 3.3558, 1.9615],
        [13.7714, 2.2523, 1.1486],
        [13.2964, 4.2448, -0.3201],
        [12.4205, 4.1833, 2.0424],
        [15.4674, 3.8618, -1.5418],
        [15.4116, 5.3482, 0.4928],
        [15.9424, 1.8693, -0.0731],
        [14.5357, 5.2868, 2.8554]
    ],
    'JETBPY-8': [
        [15.0142, 2.5117, 1.6868],
        [13.6972, 2.8964, 3.2858],
        [13.8026, 4.0491, -0.5595],
        [13.1234, 3.3625, 1.3129],
        [15.4857, 4.7042, -1.6444],
        [15.2973, 5.1834, 0.3986],
        [15.6934, 3.1983, -0.1856],
        [14.6180, 4.4968, 2.2711]
    ],
    'HPY-8': [
        [16.2144, 3.2703, 1.4671],
        [13.5018, 2.2469, 1.6388],
        [14.8906, 3.1417, -1.1149],
        [13.5913, 3.7270, 2.6274],
        [15.3232, 4.8428, -0.8063],
        [15.0521, 5.8087, 0.6665],
        [14.0800, 1.9865, -0.0267],
        [14.2813, 5.3121, 2.1947]
    ]
};

console.log('\n=== SHAPE Reference Coordinates (Normalized) ===\n');

for (const [geom, ligands] of Object.entries(SHAPE_FITTED)) {
    console.log(`\n// ${geom}: Reference coordinates from SHAPE 2.1`);
    console.log(`function generate${geom.replace('-', '_')}() {`);
    console.log(`    return [`);

    const normalized = extractRelativeCoords(M, ligands);
    normalized.forEach((coord, i) => {
        console.log(`        [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}, ${coord[2].toFixed(6)}]${i < normalized.length - 1 ? ',' : ''}`);
    });

    console.log(`    ].map(normalize);`);
    console.log(`}`);
}

console.log('\n\n=== Summary ===\n');
console.log('These are the EXACT reference geometries SHAPE 2.1 uses.');
console.log('Copy these functions to replace the incorrect ones in:');
console.log('  src/constants/referenceGeometries/index.js');
console.log('');

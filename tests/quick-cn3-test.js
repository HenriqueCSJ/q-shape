/**
 * Quick CN=3 test: NH3 Ammonia
 */

import calculateShapeMeasure from '../src/services/shapeAnalysis/shapeCalculator.js';
import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';

// NH3 coordinates (N-centered, same as in shapeParityBenchmark.test.js)
// N at (-0.5265, -0.0022, -0.7633), H atoms relative to N
const nh3Coords = [
    [-0.0155 - (-0.5265), -0.8755 - (-0.0022), -0.7216 - (-0.7633)],  // H1
    [0.1498 - (-0.5265), 0.7509 - (-0.0022), -0.7328 - (-0.7633)],    // H2
    [-0.9915 - (-0.5265), 0.0389 - (-0.0022), -1.6620 - (-0.7633)]    // H3
];

// SHAPE v2.1 reference values for NH3
const SHAPE_REFERENCE = {
    'vT-3 (Pyramid)': 0.02875,
    'fac-vOC-3 (fac-Trivacant Octahedron)': 2.17184
};

console.log('=== CN=3 Quick Test: NH3 Ammonia ===\n');

const geometries = REFERENCE_GEOMETRIES[3];
const results = {};

for (const [name, refCoords] of Object.entries(geometries)) {
    const { measure } = calculateShapeMeasure(nh3Coords, refCoords, 'intensive');
    results[name] = measure;
}

// Sort by CShM
const sorted = Object.entries(results).sort((a, b) => a[1] - b[1]);

console.log('Geometry                                    Q-Shape     SHAPE      Diff     Rel.Err');
console.log('─'.repeat(85));

for (const [name, qshapeValue] of sorted) {
    const shapeValue = SHAPE_REFERENCE[name];
    if (shapeValue !== undefined) {
        const diff = qshapeValue - shapeValue;
        const relErr = Math.abs(diff) / shapeValue * 100;
        console.log(
            `${name.padEnd(42)} ${qshapeValue.toFixed(5).padStart(10)} ${shapeValue.toFixed(5).padStart(10)} ${diff.toFixed(5).padStart(10)} ${relErr.toFixed(2).padStart(8)}%`
        );
    } else {
        console.log(`${name.padEnd(42)} ${qshapeValue.toFixed(5).padStart(10)}`);
    }
}

console.log('─'.repeat(85));
console.log('\nRanking comparison:');
console.log('Q-Shape:', sorted.map(([name]) => name.split(' ')[0]).join(' → '));
console.log('SHAPE:   vT-3 → fac-vOC-3');

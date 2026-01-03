/**
 * Quick CN=4 parity test with SHAPE v2.1
 *
 * Test structure: [CuCl4] square planar complex
 * Cu at origin, 4 Cl ligands
 */

import calculateShapeMeasure from '../src/services/shapeAnalysis/shapeCalculator.js';
import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';

// Cu complex coordinates (metal-centered, Cu at origin)
const ligandCoords = [
    [-2.0673, 0.9219, -0.0636],  // Cl
    [2.0673, -0.9219, -0.0636],  // Cl
    [-0.9118, -2.0777, 0.0037],  // Cl
    [0.9118, 2.0777, 0.0037]     // Cl
];

// SHAPE v2.1 reference values
const SHAPE_REFERENCE = {
    'SP-4 (Square Planar)': 0.02657,
    'T-4 (Tetrahedral)': 31.94357,
    'SS-4 (Seesaw)': 17.86037,
    'vTBPY-4 (Axially Vacant Trigonal Bipyramid)': 33.48664
};

console.log('=== CN=4 Parity Test: [CuCl4] Square Planar ===\n');

const geometries = REFERENCE_GEOMETRIES[4];
const results = {};

for (const [name, refCoords] of Object.entries(geometries)) {
    const { measure } = calculateShapeMeasure(ligandCoords, refCoords, 'intensive');
    results[name] = measure;
}

// Sort by CShM
const sorted = Object.entries(results).sort((a, b) => a[1] - b[1]);

console.log('Geometry                                    Q-Shape     SHAPE      Diff     Rel.Err');
console.log('─'.repeat(85));

for (const [name, qshapeValue] of sorted) {
    const shapeValue = SHAPE_REFERENCE[name];
    const diff = qshapeValue - shapeValue;
    const relErr = Math.abs(diff) / shapeValue * 100;

    console.log(
        `${name.padEnd(42)} ${qshapeValue.toFixed(5).padStart(10)} ${shapeValue.toFixed(5).padStart(10)} ${diff.toFixed(5).padStart(10)} ${relErr.toFixed(2).padStart(8)}%`
    );
}

console.log('─'.repeat(85));
console.log('\nRanking comparison:');
console.log('Q-Shape:', sorted.map(([name]) => name.split(' ')[0]).join(' → '));
console.log('SHAPE:   SP-4 → SS-4 → T-4 → vTBPY-4');

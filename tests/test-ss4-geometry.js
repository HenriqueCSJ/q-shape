/**
 * Test SS-4 (Seesaw) geometry with/without central atom
 */

import calculateShapeMeasure from '../src/services/shapeAnalysis/shapeCalculator.js';
import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';

// [CuCl4] coordinates
const cn4Coords = [
    [-2.0673, 0.9219, -0.0636],
    [2.0673, -0.9219, -0.0636],
    [-0.9118, -2.0777, 0.0037],
    [0.9118, 2.0777, 0.0037]
];

console.log('=== SS-4 (Seesaw) Geometry Analysis ===\n');

// Current reference (4 points, no center)
const ss4Current = REFERENCE_GEOMETRIES[4]['SS-4 (Seesaw)'];
console.log('Current SS-4 reference (4 points):');
ss4Current.forEach((c, i) => console.log(`  V${i+1}: [${c.map(x => x.toFixed(6)).join(', ')}]`));

// Calculate centroid
const centroid = ss4Current.reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0]).map(x => x/4);
console.log(`  Centroid: [${centroid.map(x => x.toFixed(6)).join(', ')}]`);

// Cosymlib SS-4 with center (from the YAML)
// Central: [-0.235702260396, -0.235702260396, 0.000000000000]
const ss4CosymlibRaw = [
    [-0.235702, -0.235702, -1.178511],
    [0.942809, -0.235702, 0.000000],
    [-0.235702, 0.942809, 0.000000],
    [-0.235702, -0.235702, 1.178511],
    [-0.235702, -0.235702, 0.000000]  // central atom
];

console.log('\nCosymlib SS-4 RAW (5 points, with center):');
ss4CosymlibRaw.forEach((c, i) => console.log(`  ${i < 4 ? 'V'+(i+1) : 'M'}: [${c.map(x => x.toFixed(6)).join(', ')}]`));

// Normalize cosymlib version
function normalizeScale(coords) {
    const n = coords.length;
    const centroid = [0, 0, 0];
    for (const c of coords) {
        centroid[0] += c[0]; centroid[1] += c[1]; centroid[2] += c[2];
    }
    centroid[0] /= n; centroid[1] /= n; centroid[2] /= n;
    const centered = coords.map(c => [c[0] - centroid[0], c[1] - centroid[1], c[2] - centroid[2]]);
    let sumSq = 0;
    for (const c of centered) {
        sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
    }
    const rms = Math.sqrt(sumSq / n);
    return centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
}

const ss4CosymlibNorm = normalizeScale(ss4CosymlibRaw);
console.log('\nCosymlib SS-4 NORMALIZED (5 points):');
ss4CosymlibNorm.forEach((c, i) => console.log(`  ${i < 4 ? 'V'+(i+1) : 'M'}: [${c.map(x => x.toFixed(6)).join(', ')}]`));

// Now let's see what the metal position is in our normalized reference
console.log('\n--- Key Insight ---');
console.log('In SS-4, the metal is NOT at the centroid of the 4 ligands!');
console.log('Cosymlib raw metal: [-0.2357, -0.2357, 0]');
console.log('Cosymlib raw ligand centroid: ' +
    ss4CosymlibRaw.slice(0,4).reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0])
    .map(x => (x/4).toFixed(4)));

// Calculate CShM with current (4-point) reference
const { measure: cshm4 } = calculateShapeMeasure(cn4Coords, ss4Current, 'intensive');
console.log(`\nCShM with 4-point reference: ${cshm4.toFixed(5)}`);
console.log('SHAPE reference: 17.86037');
console.log(`Error: ${((cshm4 - 17.86037) / 17.86037 * 100).toFixed(2)}%`);

// Test with 5-point reference (with center)
const cn4WithMetal = [...cn4Coords, [0, 0, 0]];
const { measure: cshm5 } = calculateShapeMeasure(cn4WithMetal, ss4CosymlibNorm, 'intensive');
console.log(`\nCShM with 5-point reference (center included): ${cshm5.toFixed(5)}`);

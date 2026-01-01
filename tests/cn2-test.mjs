import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';
import calculateShapeMeasure from '../src/services/shapeAnalysis/shapeCalculator.js';

// CuCl2 from SHAPE output - ligand coordinates relative to Cu at origin
const ligandCoords = [
    [-1.7322, 2.0044, -0.3571],   // Cl1
    [-0.9118, -2.0777, 0.0037]    // Cl2
];

console.log("=== CN=2 [CuCl2] Q-Shape vs SHAPE v2.1 ===\n");
console.log("SHAPE Results:");
console.log("  L-2:   11.96364");
console.log("  vT-2:   0.48568 (BEST)");
console.log("  vOC-2:  3.33069\n");

console.log("Q-Shape Results:");
const cn2Geometries = REFERENCE_GEOMETRIES[2];
const results = [];

for (const [name, refCoords] of Object.entries(cn2Geometries)) {
    console.log(`  ${name} ref has ${refCoords.length} points`);
    const cshm = calculateShapeMeasure(ligandCoords, refCoords);
    console.log(`  ${name} raw result:`, cshm, typeof cshm);
    const value = typeof cshm === 'object' ? cshm.cshm : cshm;
    results.push({ name, cshm: value });
    console.log(`  ${name}: ${value}`);
}

results.sort((a, b) => a.cshm - b.cshm);
console.log("\nQ-Shape Ranking:", results.map(r => r.name).join(" < "));
console.log("SHAPE Ranking:   vT-2 < vOC-2 < L-2");

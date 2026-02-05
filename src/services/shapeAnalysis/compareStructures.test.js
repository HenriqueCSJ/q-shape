/**
 * Compare NiN4O2 (works) vs user's NiN6 (doesn't work)
 */

import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

describe('Compare Working vs Non-Working OC-6 Structures', () => {

    test('Compare the two structures', () => {
        console.log("\n=== Comparing Two OC-6 Structures ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // NiN4O2 from benchmark (WORKS - 0.00% error)
        // Ni at (-0.3317, 12.0165, 1.2469)
        const niN4O2Metal = [-0.3317, 12.0165, 1.2469];
        const niN4O2Ligands = [
            [-0.4577 - niN4O2Metal[0], 9.7734 - niN4O2Metal[1], 1.2212 - niN4O2Metal[2]],    // N1
            [0.4360 - niN4O2Metal[0], 12.0165 - niN4O2Metal[1], 3.1526 - niN4O2Metal[2]],    // N2
            [1.5045 - niN4O2Metal[0], 12.0165 - niN4O2Metal[1], 0.3292 - niN4O2Metal[2]],    // N3
            [-2.2777 - niN4O2Metal[0], 12.0165 - niN4O2Metal[1], 2.2016 - niN4O2Metal[2]],   // O1
            [-1.2331 - niN4O2Metal[0], 12.0165 - niN4O2Metal[1], -0.6084 - niN4O2Metal[2]],  // O2
            [-0.4577 - niN4O2Metal[0], 14.2596 - niN4O2Metal[1], 1.2212 - niN4O2Metal[2]]    // N4
        ];

        // User's NiN6 (DOESN'T WORK - 15.81% error)
        const userLigands = [
            [0, 0.062076, -2.255810],
            [1.417646, 1.531172, 0],
            [1.459398, -1.474949, 0],
            [0, 0.062076, 2.255810],
            [-1.417646, 1.531172, 0],
            [-1.459398, -1.474949, 0]
        ];

        // Compute CShM
        const niN4O2Result = calculateShapeMeasure(niN4O2Ligands, ocRef, 'intensive');
        const userResult = calculateShapeMeasure(userLigands, ocRef, 'intensive');

        console.log("NiN4O2 benchmark:");
        console.log("  CShM:", niN4O2Result.measure.toFixed(5), "(SHAPE: 0.21577)");

        console.log("\nUser's NiN6:");
        console.log("  CShM:", userResult.measure.toFixed(5), "(SHAPE: 0.19694)");

        // Analyze the structures
        function analyzeStructure(coords, name) {
            console.log(`\n--- ${name} Analysis ---`);

            // Centroid of ligands
            const centroid = [0, 0, 0];
            for (const c of coords) {
                centroid[0] += c[0] / 6;
                centroid[1] += c[1] / 6;
                centroid[2] += c[2] / 6;
            }
            console.log("Ligand centroid:", centroid.map(x => x.toFixed(6)));

            // Bond lengths
            const distances = coords.map(c => Math.sqrt(c[0]**2 + c[1]**2 + c[2]**2));
            console.log("Bond lengths:", distances.map(d => d.toFixed(4)));
            console.log("  Mean:", (distances.reduce((a,b) => a+b, 0) / 6).toFixed(4));
            console.log("  Std:", Math.sqrt(distances.map(d => (d - distances.reduce((a,b) => a+b, 0)/6)**2).reduce((a,b) => a+b, 0) / 6).toFixed(4));

            // Symmetry check: distances from centroid
            const centeredCoords = coords.map(c => [c[0] - centroid[0], c[1] - centroid[1], c[2] - centroid[2]]);
            const centroidDistances = centeredCoords.map(c => Math.sqrt(c[0]**2 + c[1]**2 + c[2]**2));
            console.log("Distances from ligand centroid:", centroidDistances.map(d => d.toFixed(4)));

            // Check if centroid is far from metal (at origin)
            const metalToCentroid = Math.sqrt(centroid[0]**2 + centroid[1]**2 + centroid[2]**2);
            console.log("Metal-to-centroid distance:", metalToCentroid.toFixed(6));
        }

        analyzeStructure(niN4O2Ligands, "NiN4O2");
        analyzeStructure(userLigands, "User NiN6");

        expect(true).toBe(true);
    });
});

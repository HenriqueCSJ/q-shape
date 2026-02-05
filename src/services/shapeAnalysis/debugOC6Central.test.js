/**
 * Test to investigate if the central atom handling affects OC-6 CShM
 *
 * Hypothesis: SHAPE might handle the central atom differently for near-perfect matches
 */

import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

describe('OC-6 Central Atom Investigation', () => {

    test('Compare perfectly symmetric vs user asymmetric octahedron', () => {
        console.log("\n=== Symmetric vs Asymmetric Octahedron ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Perfect octahedron (symmetric, centroid at metal)
        const perfectOct = [
            [0, 0, -2.0],     // L1 - z axis down
            [2.0, 0, 0],      // L2 - x axis +
            [0, 2.0, 0],      // L3 - y axis +
            [-2.0, 0, 0],     // L4 - x axis -
            [0, -2.0, 0],     // L5 - y axis -
            [0, 0, 2.0]       // L6 - z axis up
        ];

        // User's Ni complex (slightly asymmetric in y)
        const userOct = [
            [0, 0.062076, -2.255810],
            [1.417646, 1.531172, 0],
            [1.459398, -1.474949, 0],
            [0, 0.062076, 2.255810],
            [-1.417646, 1.531172, 0],
            [-1.459398, -1.474949, 0]
        ];

        // Calculate for perfect octahedron
        const perfectResult = calculateShapeMeasure(perfectOct, ocRef, 'intensive');
        console.log("Perfect octahedron CShM:", perfectResult.measure.toFixed(6));

        // Calculate for user's octahedron
        const userResult = calculateShapeMeasure(userOct, ocRef, 'intensive');
        console.log("User's octahedron CShM:", userResult.measure.toFixed(6), "(SHAPE: 0.19694)");

        // Check centroid of each
        function getCentroid(coords) {
            const n = coords.length;
            return [
                coords.reduce((s, c) => s + c[0], 0) / n,
                coords.reduce((s, c) => s + c[1], 0) / n,
                coords.reduce((s, c) => s + c[2], 0) / n
            ];
        }

        console.log("\nPerfect oct centroid (ligands only):", getCentroid(perfectOct).map(x => x.toFixed(6)));
        console.log("User oct centroid (ligands only):", getCentroid(userOct).map(x => x.toFixed(6)));

        // The asymmetry: user's y-centroid is NOT zero
        const userYCentroid = userOct.reduce((s, c) => s + c[1], 0) / 6;
        console.log("\nUser's y-centroid (ligands):", userYCentroid.toFixed(6));
        console.log("This causes the metal to be 'off-center' after normalization");

        expect(perfectResult.measure).toBeLessThan(0.01);  // Perfect should be ~0
    });

    test('What if we pre-center on metal instead of centroid?', () => {
        console.log("\n=== Alternative: Center on Metal Position ===\n");

        // User's octahedron centered on metal (already is, since coords are metal-relative)
        const userOct = [
            [0, 0.062076, -2.255810],
            [1.417646, 1.531172, 0],
            [1.459398, -1.474949, 0],
            [0, 0.062076, 2.255810],
            [-1.417646, 1.531172, 0],
            [-1.459398, -1.474949, 0]
        ];

        // The y-asymmetry values
        const yCoords = userOct.map(c => c[1]);
        console.log("Y-coordinates of ligands:", yCoords.map(y => y.toFixed(4)));
        console.log("Y-centroid:", (yCoords.reduce((a,b) => a+b, 0) / 6).toFixed(6));

        // Positive y: 0.062076, 1.531172, 1.531172 → avg = 1.041473
        // Negative y: -1.474949, -1.474949 → avg = -1.474949
        // Wait, there are 6 y-values:
        // 0.062076, 1.531172, -1.474949, 0.062076, 1.531172, -1.474949
        // Sum = 0.062076*2 + 1.531172*2 - 1.474949*2 = 0.124152 + 3.062344 - 2.949898 = 0.236598
        // Mean = 0.236598 / 6 = 0.0394
        console.log("Expected y-centroid:", (0.236598 / 6).toFixed(6));

        // With 7 atoms (ligands + metal at y=0):
        const yWith7 = [...yCoords, 0];
        console.log("Y-centroid with metal:", (yWith7.reduce((a,b) => a+b, 0) / 7).toFixed(6));

        expect(true).toBe(true);
    });

    test('Test with a symmetric octahedron that has same bond lengths as user', () => {
        console.log("\n=== Symmetric version of user's structure ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Average the bond lengths from user's structure
        // Axial: 2.257 Å
        // Equatorial 1 (N2, N5): 2.086 Å
        // Equatorial 2 (N3, N6): 2.076 Å

        // Create a symmetric octahedron with averaged equatorial distance
        const avgEquatorial = (2.086 + 2.076) / 2;  // 2.081
        const axial = 2.257;

        const symmetricOct = [
            [0, 0, -axial],           // L1 - z axis down
            [avgEquatorial, 0, 0],     // L2 - x axis +
            [0, avgEquatorial, 0],     // L3 - y axis +
            [-avgEquatorial, 0, 0],    // L4 - x axis -
            [0, -avgEquatorial, 0],    // L5 - y axis -
            [0, 0, axial]              // L6 - z axis up
        ];

        const result = calculateShapeMeasure(symmetricOct, ocRef, 'intensive');
        console.log("Symmetric oct with user's bond lengths:");
        console.log("  Axial:", axial.toFixed(3), "Å");
        console.log("  Equatorial:", avgEquatorial.toFixed(3), "Å");
        console.log("  CShM:", result.measure.toFixed(5));

        // Compare to user's result
        const userOct = [
            [0, 0.062076, -2.255810],
            [1.417646, 1.531172, 0],
            [1.459398, -1.474949, 0],
            [0, 0.062076, 2.255810],
            [-1.417646, 1.531172, 0],
            [-1.459398, -1.474949, 0]
        ];
        const userResult = calculateShapeMeasure(userOct, ocRef, 'intensive');
        console.log("\nUser's oct CShM:", userResult.measure.toFixed(5));
        console.log("SHAPE reference:", "0.19694");

        console.log("\nDifference analysis:");
        console.log("  Symmetric - User:", (result.measure - userResult.measure).toFixed(5));
        console.log("  User - SHAPE:", (userResult.measure - 0.19694).toFixed(5));

        expect(true).toBe(true);
    });
});

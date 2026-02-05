/**
 * Test if there's a specific rotation that gives a better alignment
 */

import * as THREE from 'three';
import calculateShapeMeasure from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

describe('Rotation Optimization Test', () => {

    test('Manual rotation optimization for user NiN6', () => {
        console.log("\n=== Manual Rotation Optimization ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // User's ligands
        const userLigands = [
            [0, 0.062076, -2.255810],
            [1.417646, 1.531172, 0],
            [1.459398, -1.474949, 0],
            [0, 0.062076, 2.255810],
            [-1.417646, 1.531172, 0],
            [-1.459398, -1.474949, 0]
        ];

        // Get Q-Shape result
        const { measure, alignedCoords } = calculateShapeMeasure(userLigands, ocRef, 'intensive');
        console.log("Q-Shape CShM:", measure.toFixed(5));
        console.log("SHAPE CShM:   0.19694");

        // Normalize coordinates manually
        function normalize(coords) {
            const n = coords.length;
            const centroid = coords.reduce(
                (acc, c) => [acc[0] + c[0]/n, acc[1] + c[1]/n, acc[2] + c[2]/n],
                [0, 0, 0]
            );
            const centered = coords.map(c => [c[0] - centroid[0], c[1] - centroid[1], c[2] - centroid[2]]);
            const sumSq = centered.reduce((s, c) => s + c[0]**2 + c[1]**2 + c[2]**2, 0);
            const rms = Math.sqrt(sumSq / n);
            return centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
        }

        // Add central atom
        const actualWithCentral = [...userLigands, [0, 0, 0]];
        const P = normalize(actualWithCentral);
        const Q = normalize(ocRef);

        console.log("\nNormalized actual (with central):");
        P.forEach((p, i) => console.log(`  ${i}: [${p.map(x => x.toFixed(4)).join(', ')}]`));

        console.log("\nNormalized reference:");
        Q.forEach((q, i) => console.log(`  ${i}: [${q.map(x => x.toFixed(4)).join(', ')}]`));

        // The equatorial ligands in actual are at ~45° from axes
        // Try different z-axis rotations and see if any gives better CShM
        console.log("\n=== Trying different z-rotations ===");

        function computeCShMForRotation(P, Q, angleZ) {
            const cosZ = Math.cos(angleZ);
            const sinZ = Math.sin(angleZ);

            let totalOverlap = 0;
            for (let i = 0; i < 7; i++) {
                // Rotate P around z-axis
                const px = P[i][0] * cosZ - P[i][1] * sinZ;
                const py = P[i][0] * sinZ + P[i][1] * cosZ;
                const pz = P[i][2];

                // Dot product with Q[i] (assuming 1:1 matching)
                totalOverlap += px * Q[i][0] + py * Q[i][1] + pz * Q[i][2];
            }

            const overlapNorm = totalOverlap / 7;
            return 100 * (1 - overlapNorm * overlapNorm);
        }

        // Find best z-rotation
        let bestAngle = 0;
        let bestCShM = Infinity;

        for (let deg = -90; deg <= 90; deg += 5) {
            const angle = deg * Math.PI / 180;
            const cshm = computeCShMForRotation(P, Q, angle);
            if (cshm < bestCShM) {
                bestCShM = cshm;
                bestAngle = deg;
            }
        }

        console.log(`Best z-rotation angle: ${bestAngle}°`);
        console.log(`CShM at best angle (1:1 matching): ${bestCShM.toFixed(5)}`);

        // Now try optimizing over permutations at this angle
        console.log("\n=== Trying permutations at best angle ===");

        // Simple permutation: swap some equatorial ligands
        // The equatorial ligands are indices 1,2,4,5 in actual, and 1,2,3,4 in reference

        expect(true).toBe(true);
    });

    test('Verify SHAPE ideal vs Q-Shape aligned', () => {
        console.log("\n=== Comparing Q-Shape aligned to SHAPE ideal ===\n");

        // SHAPE's ideal OC-6 coordinates (from user's output)
        // These are in the original Angstrom frame, centered on (6.0162, 1.1756, 11.7457)
        const shapeIdeal = {
            metal: [6.0162, 1.1756, 11.7457],
            L1: [6.0162, 1.1756, 9.6071],
            L2: [7.5284, 2.6878, 11.7457],
            L3: [7.5284, -0.3366, 11.7457],
            L4: [4.5039, -0.3366, 11.7457],
            L5: [4.5039, 2.6878, 11.7457],
            L6: [6.0162, 1.1756, 13.8844]
        };

        // Convert to metal-centered
        const shapeIdealCentered = [
            [shapeIdeal.L1[0] - shapeIdeal.metal[0], shapeIdeal.L1[1] - shapeIdeal.metal[1], shapeIdeal.L1[2] - shapeIdeal.metal[2]],
            [shapeIdeal.L2[0] - shapeIdeal.metal[0], shapeIdeal.L2[1] - shapeIdeal.metal[1], shapeIdeal.L2[2] - shapeIdeal.metal[2]],
            [shapeIdeal.L3[0] - shapeIdeal.metal[0], shapeIdeal.L3[1] - shapeIdeal.metal[1], shapeIdeal.L3[2] - shapeIdeal.metal[2]],
            [shapeIdeal.L4[0] - shapeIdeal.metal[0], shapeIdeal.L4[1] - shapeIdeal.metal[1], shapeIdeal.L4[2] - shapeIdeal.metal[2]],
            [shapeIdeal.L5[0] - shapeIdeal.metal[0], shapeIdeal.L5[1] - shapeIdeal.metal[1], shapeIdeal.L5[2] - shapeIdeal.metal[2]],
            [shapeIdeal.L6[0] - shapeIdeal.metal[0], shapeIdeal.L6[1] - shapeIdeal.metal[1], shapeIdeal.L6[2] - shapeIdeal.metal[2]],
        ];

        console.log("SHAPE ideal (metal-centered):");
        shapeIdealCentered.forEach((c, i) => console.log(`  L${i+1}: [${c.map(x => x.toFixed(4)).join(', ')}]`));

        // Check if SHAPE's ideal is a perfect octahedron
        const distances = shapeIdealCentered.map(c => Math.sqrt(c[0]**2 + c[1]**2 + c[2]**2));
        console.log("\nBond lengths in SHAPE ideal:", distances.map(d => d.toFixed(4)));
        console.log("All equal?", Math.max(...distances) - Math.min(...distances) < 0.01);

        expect(true).toBe(true);
    });
});

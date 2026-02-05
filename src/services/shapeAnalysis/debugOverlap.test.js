/**
 * Detailed test to trace the overlap calculation for OC-6
 *
 * The issue: Q-Shape gets overlap=6.992 while SHAPE effectively gets overlap=6.993
 * This tiny difference (0.001) causes 16% CShM difference when close to perfect.
 */

import * as THREE from 'three';
import calculateShapeMeasure from './shapeCalculator';
import kabschAlignment from '../algorithms/kabsch';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

describe('OC-6 Overlap Debug', () => {

    // User's Ni complex coordinates (metal-centered)
    const userLigands = [
        [0, 0.062076, -2.255810],      // N1 - axial
        [1.417646, 1.531172, 0],        // N2 - equatorial
        [1.459398, -1.474949, 0],       // N3 - equatorial
        [0, 0.062076, 2.255810],        // N4 - axial
        [-1.417646, 1.531172, 0],       // N5 - equatorial
        [-1.459398, -1.474949, 0]       // N6 - equatorial
    ];

    function scaleNormalize(coords) {
        const n = coords.length;
        const centroid = [0, 0, 0];
        for (const c of coords) {
            centroid[0] += c[0] / n;
            centroid[1] += c[1] / n;
            centroid[2] += c[2] / n;
        }
        const centered = coords.map(c => [
            c[0] - centroid[0],
            c[1] - centroid[1],
            c[2] - centroid[2]
        ]);
        let sumSq = 0;
        for (const c of centered) {
            sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
        }
        const rms = Math.sqrt(sumSq / n);
        const normalized = centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
        return { normalized, centroid, rms };
    }

    test('Trace exhaustive search for optimal permutation', () => {
        console.log("\n=== Tracing Exhaustive Permutation Search ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Add central atom
        const actualWithCentral = [...userLigands, [0, 0, 0]];

        // Normalize
        const { normalized: P } = scaleNormalize(actualWithCentral);
        const { normalized: Q } = scaleNormalize(ocRef);

        console.log("Normalized P (actual with central):");
        P.forEach((p, i) => console.log(`  P[${i}]: [${p.map(x => x.toFixed(6)).join(', ')}]`));

        console.log("\nNormalized Q (reference):");
        Q.forEach((q, i) => console.log(`  Q[${i}]: [${q.map(x => x.toFixed(6)).join(', ')}]`));

        // Convert to Vector3
        const P_vecs = P.map(c => new THREE.Vector3(...c));
        const Q_vecs = Q.map(c => new THREE.Vector3(...c));

        // Test specific permutations that might give better results
        // Key insight: equatorial ligands in user are at ~45° from axes

        // Permutation generator (Heap's algorithm)
        function* permutations(arr) {
            const n = arr.length;
            const c = new Array(n).fill(0);
            yield [...arr];
            let i = 0;
            while (i < n) {
                if (c[i] < i) {
                    if (i % 2 === 0) [arr[0], arr[i]] = [arr[i], arr[0]];
                    else [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]];
                    yield [...arr];
                    c[i]++;
                    i = 0;
                } else {
                    c[i] = 0;
                    i++;
                }
            }
        }

        let bestMeasure = Infinity;
        let bestPerm = null;
        let bestOverlap = 0;
        let permCount = 0;

        const ligandIndices = [0, 1, 2, 3, 4, 5];

        for (const perm of permutations([...ligandIndices])) {
            // Build matching: actual ligand i → reference vertex perm[i]
            const matching = [];
            for (let i = 0; i < 6; i++) {
                matching.push([i, perm[i]]);
            }
            matching.push([6, 6]); // Central atom

            // Prepare ordered arrays for Kabsch
            const P_ordered = [];
            const Q_ordered = [];
            for (const [p_idx, q_idx] of matching) {
                P_ordered.push(P[p_idx]);
                Q_ordered.push(Q[q_idx]);
            }

            // Get optimal rotation via Kabsch (skip centering - already centered)
            const rotation = kabschAlignment(P_ordered, Q_ordered, true);

            // Compute overlap with this rotation and matching
            let overlap = 0;
            for (const [p_idx, q_idx] of matching) {
                const rotatedP = P_vecs[p_idx].clone().applyMatrix4(rotation);
                overlap += rotatedP.dot(Q_vecs[q_idx]);
            }

            const overlapNorm = overlap / 7;
            const measure = 100 * (1 - overlapNorm * overlapNorm);

            if (measure < bestMeasure) {
                bestMeasure = measure;
                bestPerm = [...perm];
                bestOverlap = overlap;
            }

            permCount++;
        }

        console.log(`\nTotal permutations tested: ${permCount}`);
        console.log(`Best permutation: [${bestPerm.join(', ')}]`);
        console.log(`Best overlap: ${bestOverlap.toFixed(6)}`);
        console.log(`Best overlap/N: ${(bestOverlap/7).toFixed(6)}`);
        console.log(`Best CShM: ${bestMeasure.toFixed(5)}`);

        // What SHAPE must be getting
        const shapeCShM = 0.19694;
        const shapeOverlapN = Math.sqrt(1 - shapeCShM / 100);
        const shapeOverlap = shapeOverlapN * 7;
        console.log(`\nSHAPE CShM: ${shapeCShM}`);
        console.log(`SHAPE overlap/N: ${shapeOverlapN.toFixed(6)}`);
        console.log(`SHAPE overlap: ${shapeOverlap.toFixed(6)}`);

        console.log(`\nGap in overlap: ${(shapeOverlap - bestOverlap).toFixed(6)}`);

        expect(true).toBe(true);
    });

    test('Check if Kabsch is finding optimal rotation', () => {
        console.log("\n=== Verifying Kabsch Optimality ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Add central atom and normalize
        const actualWithCentral = [...userLigands, [0, 0, 0]];
        const { normalized: P } = scaleNormalize(actualWithCentral);
        const { normalized: Q } = scaleNormalize(ocRef);

        const P_vecs = P.map(c => new THREE.Vector3(...c));
        const Q_vecs = Q.map(c => new THREE.Vector3(...c));

        // Use Q-Shape's result
        const result = calculateShapeMeasure(userLigands, ocRef, 'intensive');
        console.log("Q-Shape CShM:", result.measure.toFixed(5));

        // Extract the matching from aligned coords
        // The alignedCoords are in reference order, so alignedCoords[i] = rotated P that matches Q[i]
        console.log("\nAligned coords (should match Q order):");
        result.alignedCoords.forEach((c, i) => {
            console.log(`  Aligned[${i}]: [${c.map(x => x.toFixed(6)).join(', ')}]`);
        });

        // Compute overlap with the aligned coords
        let overlap = 0;
        for (let i = 0; i < 7; i++) {
            const p = new THREE.Vector3(...result.alignedCoords[i]);
            overlap += p.dot(Q_vecs[i]);
        }
        console.log(`\nOverlap from aligned: ${overlap.toFixed(6)}`);
        console.log(`Overlap/N: ${(overlap/7).toFixed(6)}`);
        console.log(`Computed CShM: ${(100 * (1 - (overlap/7)**2)).toFixed(5)}`);

        // Now try local refinement around this rotation
        console.log("\n--- Trying rotation refinement ---");

        // Small rotations around each axis
        const rotMatrix = result.rotationMatrix;
        let bestLocalOverlap = overlap;
        let bestLocalRotation = rotMatrix;

        const steps = 100;
        const maxAngle = 0.1; // radians

        for (let ax = 0; ax < 3; ax++) {
            for (let step = -steps; step <= steps; step++) {
                const angle = (step / steps) * maxAngle;
                const axis = new THREE.Vector3(
                    ax === 0 ? 1 : 0,
                    ax === 1 ? 1 : 0,
                    ax === 2 ? 1 : 0
                );
                const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
                const newRot = new THREE.Matrix4().multiplyMatrices(perturbation, rotMatrix);

                // Recompute overlap with same matching (identity mapping after aligned)
                let newOverlap = 0;
                for (let i = 0; i < 7; i++) {
                    const p = new THREE.Vector3(...P[i]).applyMatrix4(newRot);
                    // Need to use original matching - assuming it's identity for aligned
                    // Actually we need the original matching
                    newOverlap += p.dot(Q_vecs[i]); // This assumes identity matching which may be wrong
                }

                if (newOverlap > bestLocalOverlap) {
                    bestLocalOverlap = newOverlap;
                    bestLocalRotation = newRot.clone();
                }
            }
        }

        console.log(`Best local overlap: ${bestLocalOverlap.toFixed(6)}`);
        console.log(`Improvement: ${(bestLocalOverlap - overlap).toFixed(6)}`);

        if (bestLocalOverlap > overlap) {
            const newCShM = 100 * (1 - (bestLocalOverlap/7)**2);
            console.log(`New CShM: ${newCShM.toFixed(5)}`);
        }

        expect(true).toBe(true);
    });

    test('Test if the issue is in how Kabsch skips centering', () => {
        console.log("\n=== Testing Kabsch centering behavior ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Add central atom and normalize
        const actualWithCentral = [...userLigands, [0, 0, 0]];
        const { normalized: P, centroid: Pc } = scaleNormalize(actualWithCentral);
        const { normalized: Q, centroid: Qc } = scaleNormalize(ocRef);

        console.log("P centroid after normalization:", Pc.map(x => x.toFixed(6)));
        console.log("Q centroid after normalization:", Qc.map(x => x.toFixed(6)));

        // Check if normalized coords are truly centered
        const Pcentroid = [0, 0, 0];
        const Qcentroid = [0, 0, 0];
        for (let i = 0; i < 7; i++) {
            Pcentroid[0] += P[i][0] / 7;
            Pcentroid[1] += P[i][1] / 7;
            Pcentroid[2] += P[i][2] / 7;
            Qcentroid[0] += Q[i][0] / 7;
            Qcentroid[1] += Q[i][1] / 7;
            Qcentroid[2] += Q[i][2] / 7;
        }

        console.log("P normalized centroid:", Pcentroid.map(x => x.toFixed(10)));
        console.log("Q normalized centroid:", Qcentroid.map(x => x.toFixed(10)));

        // The issue: when Kabsch skips centering, it assumes both are already centered.
        // Let's verify they are.
        const Psum = P.reduce((s, p) => [s[0]+p[0], s[1]+p[1], s[2]+p[2]], [0,0,0]);
        const Qsum = Q.reduce((s, q) => [s[0]+q[0], s[1]+q[1], s[2]+q[2]], [0,0,0]);
        console.log("\nSum of P coords:", Psum.map(x => x.toFixed(10)));
        console.log("Sum of Q coords:", Qsum.map(x => x.toFixed(10)));

        // Both should be [0, 0, 0] if properly centered
        const Pmag = Math.sqrt(Psum[0]**2 + Psum[1]**2 + Psum[2]**2);
        const Qmag = Math.sqrt(Qsum[0]**2 + Qsum[1]**2 + Qsum[2]**2);
        console.log("Magnitude of P sum:", Pmag.toExponential(4));
        console.log("Magnitude of Q sum:", Qmag.toExponential(4));

        expect(Pmag).toBeLessThan(1e-10);
        expect(Qmag).toBeLessThan(1e-10);
    });

    test('Check per-ligand contribution to overlap', () => {
        console.log("\n=== Per-Ligand Overlap Contribution ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Add central atom and normalize
        const actualWithCentral = [...userLigands, [0, 0, 0]];
        const { normalized: P } = scaleNormalize(actualWithCentral);
        const { normalized: Q } = scaleNormalize(ocRef);

        const P_vecs = P.map(c => new THREE.Vector3(...c));
        const Q_vecs = Q.map(c => new THREE.Vector3(...c));

        // Get Q-Shape's result
        const result = calculateShapeMeasure(userLigands, ocRef, 'intensive');

        console.log("Contribution to overlap (should each be ~1.0 for perfect match):");
        console.log("Point     |P|      |Q|      P·Q     Contribution");
        console.log("------------------------------------------------------");

        let totalOverlap = 0;
        for (let i = 0; i < 7; i++) {
            const p = new THREE.Vector3(...result.alignedCoords[i]);
            const q = Q_vecs[i];
            const pMag = p.length();
            const qMag = q.length();
            const dot = p.dot(q);
            totalOverlap += dot;

            const label = i < 6 ? `L${i+1}` : 'M ';
            console.log(`${label}        ${pMag.toFixed(4)}   ${qMag.toFixed(4)}   ${dot.toFixed(4)}   ${dot.toFixed(4)}`);
        }

        console.log("------------------------------------------------------");
        console.log(`Total overlap: ${totalOverlap.toFixed(5)}`);
        console.log(`Overlap/N: ${(totalOverlap/7).toFixed(6)}`);

        // For a perfect match with same RMS, each dot product should be ~1.0 (if vectors point same way)
        // Max possible overlap if all vectors perfectly aligned = N (since |p|²=1 on average)
        // Actually for normalized coords, sum|p|² = N and sum|q|² = N

        const sumPsq = P_vecs.reduce((s, p) => s + p.lengthSq(), 0);
        const sumQsq = Q_vecs.reduce((s, q) => s + q.lengthSq(), 0);
        console.log(`\nsum|P|²: ${sumPsq.toFixed(4)} (should be 7)`);
        console.log(`sum|Q|²: ${sumQsq.toFixed(4)} (should be 7)`);

        expect(true).toBe(true);
    });

    test('What if we try all 720 perms with refinement?', () => {
        console.log("\n=== All Permutations with Local Refinement ===\n");

        const ocRef = REFERENCE_GEOMETRIES[6]['OC-6 (Octahedral)'];

        // Add central atom and normalize
        const actualWithCentral = [...userLigands, [0, 0, 0]];
        const { normalized: P } = scaleNormalize(actualWithCentral);
        const { normalized: Q } = scaleNormalize(ocRef);

        const P_vecs = P.map(c => new THREE.Vector3(...c));
        const Q_vecs = Q.map(c => new THREE.Vector3(...c));

        function* permutations(arr) {
            const n = arr.length;
            const c = new Array(n).fill(0);
            yield [...arr];
            let i = 0;
            while (i < n) {
                if (c[i] < i) {
                    if (i % 2 === 0) [arr[0], arr[i]] = [arr[i], arr[0]];
                    else [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]];
                    yield [...arr];
                    c[i]++;
                    i = 0;
                } else {
                    c[i] = 0;
                    i++;
                }
            }
        }

        let globalBestMeasure = Infinity;
        let globalBestPerm = null;
        let globalBestOverlap = 0;
        let globalBestRotation = null;

        const ligandIndices = [0, 1, 2, 3, 4, 5];

        for (const perm of permutations([...ligandIndices])) {
            // Build matching
            const matching = [];
            for (let i = 0; i < 6; i++) {
                matching.push([i, perm[i]]);
            }
            matching.push([6, 6]);

            // Prepare ordered arrays for Kabsch
            const P_ordered = [];
            const Q_ordered = [];
            for (const [p_idx, q_idx] of matching) {
                P_ordered.push(P[p_idx]);
                Q_ordered.push(Q[q_idx]);
            }

            // Get initial rotation via Kabsch
            const rotation = kabschAlignment(P_ordered, Q_ordered, true);

            // Function to compute overlap for this matching
            const getOverlapForRotation = (rot) => {
                let overlap = 0;
                for (const [p_idx, q_idx] of matching) {
                    const rotatedP = P_vecs[p_idx].clone().applyMatrix4(rot);
                    overlap += rotatedP.dot(Q_vecs[q_idx]);
                }
                return overlap;
            };

            // Get initial overlap
            let bestOverlap = getOverlapForRotation(rotation);
            let bestRotation = rotation.clone();

            // Local refinement: gradient-free optimization
            const steps = 20;
            const angles = [-0.01, -0.005, -0.001, 0.001, 0.005, 0.01];

            for (let iter = 0; iter < steps; iter++) {
                let improved = false;
                for (const axis of [[1,0,0], [0,1,0], [0,0,1]]) {
                    for (const angle of angles) {
                        const axisVec = new THREE.Vector3(...axis);
                        const perturbation = new THREE.Matrix4().makeRotationAxis(axisVec, angle);
                        const newRot = new THREE.Matrix4().multiplyMatrices(perturbation, bestRotation);
                        const newOverlap = getOverlapForRotation(newRot);

                        if (newOverlap > bestOverlap) {
                            bestOverlap = newOverlap;
                            bestRotation = newRot.clone();
                            improved = true;
                        }
                    }
                }
                if (!improved) break;
            }

            const measure = 100 * (1 - (bestOverlap/7)**2);

            if (measure < globalBestMeasure) {
                globalBestMeasure = measure;
                globalBestPerm = [...perm];
                globalBestOverlap = bestOverlap;
                globalBestRotation = bestRotation.clone();
            }
        }

        console.log(`Best permutation: [${globalBestPerm.join(', ')}]`);
        console.log(`Best overlap: ${globalBestOverlap.toFixed(6)}`);
        console.log(`Best overlap/N: ${(globalBestOverlap/7).toFixed(6)}`);
        console.log(`Best CShM: ${globalBestMeasure.toFixed(5)}`);

        // What SHAPE must be getting
        const shapeCShM = 0.19694;
        const shapeOverlapN = Math.sqrt(1 - shapeCShM / 100);
        console.log(`\nSHAPE target overlap/N: ${shapeOverlapN.toFixed(6)}`);
        console.log(`Gap to SHAPE: ${(shapeOverlapN - globalBestOverlap/7).toFixed(6)}`);

        expect(true).toBe(true);
    });
});

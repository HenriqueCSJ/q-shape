import * as THREE from 'three';
import kabschAlignment from '../algorithms/kabsch.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';
import { SHAPE_MEASURE, KABSCH, PROGRESS } from '../../constants/algorithmConstants';

/**
 * Normalizes a structure by centering on centroid and scaling by RMS distance.
 * This matches the normalization used by SHAPE software and cshm-cc.
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates
 * @returns {Object} Object with normalized coordinates and normalization factor
 */
function normalizeStructure(coords) {
    const N = coords.length;

    // Calculate centroid
    let cx = 0, cy = 0, cz = 0;
    for (const [x, y, z] of coords) {
        cx += x; cy += y; cz += z;
    }
    cx /= N; cy /= N; cz /= N;

    // Center coordinates
    const centered = coords.map(([x, y, z]) => [x - cx, y - cy, z - cz]);

    // Calculate RMS distance
    let sumSqDist = 0;
    for (const [x, y, z] of centered) {
        sumSqDist += x * x + y * y + z * z;
    }
    const rms = Math.sqrt(sumSqDist / N);

    // Normalize by RMS
    if (rms < 1e-10) {
        return { normalized: centered, rms: 1 };
    }

    const normalized = centered.map(([x, y, z]) => [x / rms, y / rms, z / rms]);
    return { normalized, rms };
}

/**
 * Calculates the shape measure between actual and reference coordinates using
 * a multi-stage optimization approach.
 *
 * This function implements the Continuous Shape Measure (CShM) algorithm, which:
 * 1. Adds the central atom at origin to the structure (matching SHAPE convention)
 * 2. Normalizes coordinates by centering and RMS scaling (not unit vectors)
 * 3. Uses Kabsch algorithm for initial alignment
 * 4. Tests key orientations for coarse search
 * 5. Performs grid search over rotation space
 * 6. Applies simulated annealing for global optimization
 * 7. Applies optimal scaling factor
 *
 * The algorithm finds the optimal rotation and atom-to-vertex matching that
 * minimizes the root mean square deviation between the actual and reference
 * geometries, matching the original SHAPE software methodology.
 *
 * @param {Array<Array<number>>} actualCoords - Array of [x, y, z] coordinates for actual structure (ligands only, metal at origin)
 * @param {Array<Array<number>>} referenceCoords - Array of [x, y, z] coordinates for reference shape (ligands only)
 * @param {string} [mode='default'] - Optimization mode: 'default' or 'intensive'
 *   - 'default': Faster computation with good accuracy (18 grid steps, 6 restarts, 3000 steps/run)
 *   - 'intensive': More thorough search with higher accuracy (30 grid steps, 12 restarts, 8000 steps/run)
 * @param {Function} [progressCallback=null] - Optional callback to report progress
 *   Called with: { stage, percentage, current, total, extra }
 *   - stage: Current optimization stage name
 *   - percentage: Overall progress (0-100)
 *   - current: Current step in stage
 *   - total: Total steps in stage
 *   - extra: Additional info (e.g., current best measure)
 *
 * @returns {Object} Result object containing:
 *   - measure {number}: The shape measure (0 = perfect match, higher = worse)
 *   - alignedCoords {Array<Array<number>>}: Aligned coordinates in reference order
 *   - rotationMatrix {THREE.Matrix4}: The optimal rotation matrix found
 *
 * @throws {Error} If calculation fails due to invalid input or algorithm error
 *
 * @example
 * const result = calculateShapeMeasure(
 *   [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
 *   [[0.9, 0.1, 0], [0, 0.95, 0.05], [0.05, 0, 0.95]],
 *   'default',
 *   ({ stage, percentage }) => console.log(`${stage}: ${percentage}%`)
 * );
 * console.log(`Shape measure: ${result.measure}`);
 */
function calculateShapeMeasure(actualCoords, referenceCoords, mode = 'default', progressCallback = null) {
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
    }

    // Load parameters from constants (documented with scientific justification)
    const currentParams = mode === 'intensive'
        ? SHAPE_MEASURE.INTENSIVE
        : SHAPE_MEASURE.DEFAULT;

    try {
        // Add central atom at origin to both structures (matching SHAPE convention)
        const actualWithCenter = [...actualCoords, [0, 0, 0]];
        const refWithCenter = [...referenceCoords, [0, 0, 0]];
        const Ntotal = actualWithCenter.length;

        // Normalize ONLY the actual structure using SHAPE-style normalization
        // (center on centroid, scale by RMS) - matching cshm-cc behavior
        const { normalized: actualNorm } = normalizeStructure(actualWithCenter);

        // Reference uses RAW coordinates (not normalized) - scale factor adjusts
        const refRaw = refWithCenter;

        // Calculate sum of squared norms for reference (for optimal scaling)
        const refSqNorm = refRaw.reduce((sum, [x, y, z]) => sum + x*x + y*y + z*z, 0);

        // Convert to THREE.Vector3 for rotation operations
        const P_vecs = actualNorm.map(c => new THREE.Vector3(...c));
        const Q_vecs = refRaw.map(c => new THREE.Vector3(...c));

        // Cached evaluation function with optimal scaling (matching SHAPE formula)
        // We rotate P (actual) to align with Q (reference), then calculate optimal scale
        const getMeasureForRotation = (rotationMatrix) => {
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rotationMatrix));

            const costMatrix = [];
            for (let i = 0; i < Ntotal; i++) {
                costMatrix[i] = [];
                for (let j = 0; j < Ntotal; j++) {
                    costMatrix[i][j] = rotatedP[i].distanceToSquared(Q_vecs[j]);
                }
            }

            const matching = hungarianAlgorithm(costMatrix);

            // Calculate optimal scale factor: scale = Σ(Prot·Q) / Σ(Q²)
            // This finds the scale that minimizes |Prot - scale*Q|²
            let dotProduct = 0;
            for (const [i, j] of matching) {
                dotProduct += rotatedP[i].x * Q_vecs[j].x +
                              rotatedP[i].y * Q_vecs[j].y +
                              rotatedP[i].z * Q_vecs[j].z;
            }
            const scale = dotProduct / refSqNorm;

            // Calculate CShM with optimal scaling: mean(|Prot - scale*Q|²) * 100
            let sumSqDiff = 0;
            for (const [i, j] of matching) {
                const dx = rotatedP[i].x - scale * Q_vecs[j].x;
                const dy = rotatedP[i].y - scale * Q_vecs[j].y;
                const dz = rotatedP[i].z - scale * Q_vecs[j].z;
                sumSqDiff += dx * dx + dy * dy + dz * dz;
            }

            return { measure: (sumSqDiff / Ntotal) * 100, matching, scale };
        };

        let globalBestMeasure = Infinity;
        let globalBestRotation = new THREE.Matrix4();
        let globalBestMatching = [];

        let totalSteps = 0;
        const estimatedTotalSteps = (currentParams.USE_KABSCH ? 1 : 0) +
            SHAPE_MEASURE.NUM_KEY_ORIENTATIONS +
            Math.ceil(currentParams.GRID_STEPS / currentParams.GRID_STRIDE) ** 3 +
            currentParams.NUM_RESTARTS * currentParams.STEPS_PER_RUN +
            currentParams.REFINEMENT_STEPS;

        const reportProgress = (stage, current, total, extra = '') => {
            if (progressCallback) {
                const percentage = Math.min(99, Math.round((totalSteps / estimatedTotalSteps) * 100));
                progressCallback({ stage, percentage, current, total, extra });
            }
        };

        // STAGE 0: Kabsch Initial Alignment (IMPROVED)
        if (currentParams.USE_KABSCH) {
            reportProgress('Kabsch Alignment', 0, 1);
            try {
                const initialCostMatrix = P_vecs.map(p => Q_vecs.map(q => p.distanceToSquared(q)));
                const initialMatching = hungarianAlgorithm(initialCostMatrix);

                const P_ordered = initialMatching.map(([p_idx, _]) => actualCoords[p_idx]);
                const Q_ordered = initialMatching.map(([_, q_idx]) => referenceCoords[q_idx]);

                const kabschRotation = kabschAlignment(P_ordered, Q_ordered);
                const kabschResult = getMeasureForRotation(kabschRotation);

                if (isFinite(kabschResult.measure)) {
                    globalBestMeasure = kabschResult.measure;
                    globalBestRotation.copy(kabschRotation);
                    globalBestMatching = kabschResult.matching;
                }
                totalSteps++;
                reportProgress('Kabsch Alignment', 1, 1, `Initial Best: ${globalBestMeasure.toFixed(4)}`);
            } catch (error) {
                console.warn("Kabsch alignment failed, proceeding without it:", error);
            }
        }

        // STAGE 1: Key orientations test
        const numKeyOrientations = SHAPE_MEASURE.NUM_KEY_ORIENTATIONS;
        reportProgress('Key Orientations', 0, numKeyOrientations);
        const keyOrientations = [
            [0, 0, 0],
            [Math.PI/2, 0, 0], [0, Math.PI/2, 0], [0, 0, Math.PI/2],
            [Math.PI, 0, 0], [0, Math.PI, 0], [0, 0, Math.PI],
            [Math.PI/2, Math.PI/2, 0], [Math.PI/2, 0, Math.PI/2], [0, Math.PI/2, Math.PI/2],
            [Math.PI/4, 0, 0], [0, Math.PI/4, 0], [0, 0, Math.PI/4],
            [Math.PI/4, Math.PI/4, 0], [Math.PI/4, 0, Math.PI/4], [0, Math.PI/4, Math.PI/4],
            [Math.PI/4, Math.PI/4, Math.PI/4], [Math.PI/3, Math.PI/3, Math.PI/3]
        ];

        keyOrientations.forEach(([ax, ay, az], idx) => {
            const euler = new THREE.Euler(ax, ay, az, 'XYZ');
            const R = new THREE.Matrix4().makeRotationFromEuler(euler);
            const result = getMeasureForRotation(R);
            if (result.measure < globalBestMeasure) {
                globalBestMeasure = result.measure;
                globalBestRotation.copy(R);
                globalBestMatching = result.matching;
            }
            totalSteps++;
            if (idx % PROGRESS.KEY_ORIENTATIONS_UPDATE_FREQUENCY === 0) {
                reportProgress('Key Orientations', idx, numKeyOrientations, `Best: ${globalBestMeasure.toFixed(4)}`);
            }
        });

        // Early termination if already excellent
        if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_KEY_ORIENTATIONS) {
            reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
            const finalAlignedCoords = new Array(N);
            for (const [p_idx, q_idx] of globalBestMatching) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
            return {
                measure: globalBestMeasure,
                alignedCoords: finalAlignedCoords.filter(Boolean),
                rotationMatrix: globalBestRotation
            };
        }

        // STAGE 2: Grid search (optimized)
        reportProgress('Grid Search', 0, 100);
        const gridSteps = currentParams.GRID_STEPS;
        const gridStride = currentParams.GRID_STRIDE;
        const angleStep = (2 * Math.PI) / gridSteps;

        let gridCount = 0;
        const totalGridPoints = Math.ceil(gridSteps / gridStride) ** 3;

        for (let i = 0; i < gridSteps; i += gridStride) {
            for (let j = 0; j < gridSteps; j += gridStride) {
                for (let k = 0; k < gridSteps; k += gridStride) {
                    const euler = new THREE.Euler(i * angleStep, j * angleStep, k * angleStep, 'XYZ');
                    const R = new THREE.Matrix4().makeRotationFromEuler(euler);
                    const result = getMeasureForRotation(R);
                    if (result.measure < globalBestMeasure) {
                        globalBestMeasure = result.measure;
                        globalBestRotation.copy(R);
                        globalBestMatching = result.matching;
                    }
                    totalSteps++;
                    gridCount++;
                    if (gridCount % PROGRESS.GRID_UPDATE_FREQUENCY === 0) {
                        reportProgress('Grid Search', gridCount, totalGridPoints, `Best: ${globalBestMeasure.toFixed(4)}`);
                    }
                }
            }
        }

        // Early termination check
        if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_GRID_SEARCH) {
            reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
            const finalAlignedCoords = new Array(N);
            for (const [p_idx, q_idx] of globalBestMatching) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
            return {
                measure: globalBestMeasure,
                alignedCoords: finalAlignedCoords.filter(Boolean),
                rotationMatrix: globalBestRotation
            };
        }

        // STAGE 3: Simulated annealing (optimized)
        const numRestarts = currentParams.NUM_RESTARTS;
        const stepsPerRun = currentParams.STEPS_PER_RUN;

        for (let restart = 0; restart < numRestarts; restart++) {
            reportProgress('Annealing', restart, numRestarts, `Best: ${globalBestMeasure.toFixed(4)}`);

            let currentRotation;

            if (restart === 0) {
                currentRotation = globalBestRotation.clone();
            } else if (restart < numRestarts / 2) {
                const randomAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const randomAngle = (Math.random() - 0.5) * Math.PI;
                const perturbation = new THREE.Matrix4().makeRotationAxis(randomAxis, randomAngle);
                currentRotation = new THREE.Matrix4().multiplyMatrices(perturbation, globalBestRotation);
            } else {
                currentRotation = new THREE.Matrix4().makeRotationFromEuler(
                    new THREE.Euler(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, 'XYZ')
                );
            }

            let currentResult = getMeasureForRotation(currentRotation);
            let bestInRun = currentResult.measure;
            let bestRotationInRun = currentRotation.clone();
            let bestMatchingInRun = currentResult.matching;

            // Adaptive temperature schedule
            const initialTemp = mode === 'intensive'
                ? SHAPE_MEASURE.ANNEALING.INITIAL_TEMP_INTENSIVE
                : SHAPE_MEASURE.ANNEALING.INITIAL_TEMP_DEFAULT;
            let temp = initialTemp;
            const minTemp = SHAPE_MEASURE.ANNEALING.MIN_TEMP;
            const alpha = Math.pow(minTemp / temp, 1 / stepsPerRun);

            for (let step = 0; step < stepsPerRun; step++) {
                const stepSize = temp * SHAPE_MEASURE.ANNEALING.STEP_SIZE_FACTOR *
                    (1 + SHAPE_MEASURE.ANNEALING.STEP_SIZE_RANDOMNESS * Math.random());
                const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const angle = (Math.random() - 0.5) * 2 * stepSize;

                const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
                const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
                const newResult = getMeasureForRotation(newRotation);

                const deltaE = newResult.measure - currentResult.measure;
                const acceptProb = deltaE < 0 ? 1.0 : Math.exp(-deltaE / temp);

                if (Math.random() < acceptProb) {
                    currentRotation.copy(newRotation);
                    currentResult = newResult;

                    if (currentResult.measure < bestInRun) {
                        bestInRun = currentResult.measure;
                        bestRotationInRun.copy(currentRotation);
                        bestMatchingInRun = currentResult.matching;
                    }
                }

                temp *= alpha;
                totalSteps++;

                // Early termination for this run
                if (bestInRun < SHAPE_MEASURE.EARLY_STOP.DURING_ANNEALING_RUN) break;
            }

            if (bestInRun < globalBestMeasure) {
                globalBestMeasure = bestInRun;
                globalBestRotation.copy(bestRotationInRun);
                globalBestMatching = bestMatchingInRun;
            }

            // Early termination if excellent result
            if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_ANNEALING) break;
        }

        // STAGE 4: Final refinement (optimized)
        reportProgress('Refinement', 0, 100);
        let currentRotation = globalBestRotation.clone();
        let currentMeasure = globalBestMeasure;
        let temp = SHAPE_MEASURE.REFINEMENT.INITIAL_TEMP;
        const refinementSteps = currentParams.REFINEMENT_STEPS;
        let noImprovementCount = 0;

        for (let step = 0; step < refinementSteps; step++) {
            const stepSize = temp * SHAPE_MEASURE.REFINEMENT.STEP_SIZE_FACTOR;
            const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            const angle = (Math.random() - 0.5) * 2 * stepSize;

            const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
            const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
            const newResult = getMeasureForRotation(newRotation);

            if (newResult.measure < currentMeasure) {
                currentMeasure = newResult.measure;
                currentRotation.copy(newRotation);
                noImprovementCount = 0;

                if (currentMeasure < globalBestMeasure) {
                    globalBestMeasure = currentMeasure;
                    globalBestRotation.copy(newRotation);
                    globalBestMatching = newResult.matching;
                }
            } else {
                noImprovementCount++;
            }

            temp *= SHAPE_MEASURE.REFINEMENT.TEMP_DECAY;
            totalSteps++;

            if (step % PROGRESS.REFINEMENT_UPDATE_FREQUENCY === 0) {
                reportProgress('Refinement', step, refinementSteps, `Best: ${globalBestMeasure.toFixed(4)}`);
            }

            // Early termination
            if (noImprovementCount > SHAPE_MEASURE.REFINEMENT.NO_IMPROVEMENT_LIMIT &&
                globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.DURING_REFINEMENT) {
                break;
            }
        }

        reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);

        // Return aligned coordinates (excluding the central atom we added)
        const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
        const finalAlignedCoords = new Array(N);

        for (const [p_idx, q_idx] of globalBestMatching) {
            // Only include ligand positions (indices 0 to N-1), not the central atom (index N)
            if (q_idx < N && p_idx < N) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
        }

        return {
            measure: globalBestMeasure,
            alignedCoords: finalAlignedCoords.filter(Boolean),
            rotationMatrix: globalBestRotation
        };

    } catch (error) {
        console.error("Error during CShM calculation:", error);
        throw new Error(`Shape measure calculation failed: ${error.message}`);
    }
}

export default calculateShapeMeasure;

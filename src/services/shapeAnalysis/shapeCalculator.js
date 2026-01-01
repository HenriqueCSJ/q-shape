import * as THREE from 'three';
import kabschAlignment from '../algorithms/kabsch.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';
import { SHAPE_MEASURE, KABSCH, PROGRESS } from '../../constants/algorithmConstants.js';

/**
 * Scale-normalizes coordinates using centroid-based strategy.
 *
 * This is the standard normalization used by SHAPE/cosymlib/cshm-cc:
 * 1. Center coordinates on their centroid
 * 2. Scale to unit RMS distance from centroid
 *
 * For CN=3, the input should include the central atom (4 points total).
 * This preserves pyramidal character that would be lost with ligand-only centering.
 *
 * @param {THREE.Vector3[]} vectors - Array of Vector3 coordinates
 * @returns {object} { normalized: THREE.Vector3[], scale: number }
 */
function scaleNormalize(vectors) {
    if (!vectors || vectors.length === 0) {
        return { normalized: [], scale: 1 };
    }

    const n = vectors.length;

    // Centroid-based normalization for all CNs
    const centroid = new THREE.Vector3(0, 0, 0);
    for (const v of vectors) {
        centroid.add(v);
    }
    centroid.divideScalar(n);

    const centered = vectors.map(v => v.clone().sub(centroid));

    let sumSq = 0;
    for (const v of centered) {
        sumSq += v.lengthSq();
    }
    const rms = Math.sqrt(sumSq / n);

    if (rms < 1e-10) {
        return { normalized: centered, scale: 1 };
    }

    const normalized = centered.map(v => v.clone().divideScalar(rms));
    return { normalized, scale: rms };
}

/**
 * Calculates the shape measure between actual and reference coordinates using
 * a multi-stage optimization approach.
 *
 * This function implements the Continuous Shape Measure (CShM) algorithm, which:
 * 1. Normalizes coordinates to unit sphere
 * 2. Uses Kabsch algorithm for initial alignment
 * 3. Tests key orientations for coarse search
 * 4. Performs grid search over rotation space
 * 5. Applies simulated annealing for global optimization
 * 6. Refines the solution with local optimization
 *
 * The algorithm finds the optimal rotation and atom-to-vertex matching that
 * minimizes the root mean square deviation between the actual and reference
 * geometries.
 *
 * @param {Array<Array<number>>} actualCoords - Array of [x, y, z] coordinates for actual structure
 * @param {Array<Array<number>>} referenceCoords - Array of [x, y, z] coordinates for reference shape
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
    let workingActualCoords = actualCoords;
    let workingRefCoords = referenceCoords;

    // CN=3 special handling: reference has 4 points (3 ligands + central atom)
    // Add central atom at origin to input if needed
    if (actualCoords.length === 3 && referenceCoords.length === 4) {
        workingActualCoords = [...actualCoords, [0, 0, 0]];
    }

    const N = workingActualCoords.length;
    if (N !== workingRefCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
    }

    // Load parameters from constants (documented with scientific justification)
    const currentParams = mode === 'intensive'
        ? SHAPE_MEASURE.INTENSIVE
        : SHAPE_MEASURE.DEFAULT;

    try {
        // Convert actual coordinates to Vector3
        const P_vecs_raw = workingActualCoords.map(c => new THREE.Vector3(...c));

        // Check for ligand atoms at center (would cause normalization issues)
        // Skip the last atom for CN=3 since it's the intentionally-added central atom
        const ligandsToCheck = (actualCoords.length === 3 && referenceCoords.length === 4)
            ? P_vecs_raw.slice(0, -1)
            : P_vecs_raw;
        if (ligandsToCheck.some(v => v.lengthSq() < KABSCH.MIN_VECTOR_LENGTH_SQ)) {
            console.warn("Found coordinating atom at the same position as the center.");
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
        }

        // Use centroid-based scale normalization (standard for SHAPE/cosymlib)
        const { normalized: P_vecs } = scaleNormalize(P_vecs_raw);

        // Reference coordinates are already scale-normalized in referenceGeometries
        const Q_vecs = workingRefCoords.map(c => new THREE.Vector3(...c));

        // Cached evaluation function
        const getMeasureForRotation = (rotationMatrix) => {
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rotationMatrix));

            const costMatrix = [];
            for (let i = 0; i < N; i++) {
                costMatrix[i] = [];
                for (let j = 0; j < N; j++) {
                    costMatrix[i][j] = rotatedP[i].distanceToSquared(Q_vecs[j]);
                }
            }

            const matching = hungarianAlgorithm(costMatrix);
            const sumSqDiff = matching.reduce((sum, [i, j]) => sum + costMatrix[i][j], 0);

            return { measure: (sumSqDiff / N) * 100, matching };
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

    } catch (error) {
        console.error("Error during CShM calculation:", error);
        throw new Error(`Shape measure calculation failed: ${error.message}`);
    }
}

export default calculateShapeMeasure;

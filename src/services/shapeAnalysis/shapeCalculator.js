import * as THREE from 'three';
import kabschAlignment from '../algorithms/kabsch.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';

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
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
    }

    const params = {
        default: {
            gridSteps: 18,        // Reduced from 20
            gridStride: 3,
            numRestarts: 6,         // Reduced from 8
            stepsPerRun: 3000,      // Reduced from 5000
            refinementSteps: 2000,  // Reduced from 4000
            useKabsch: true,
        },
        intensive: {
            gridSteps: 30,          // Reduced from 36
            gridStride: 2,
            numRestarts: 12,        // Reduced from 16
            stepsPerRun: 8000,     // Reduced from 12000
            refinementSteps: 6000,  // Reduced from 10000
            useKabsch: true,
        }
    };
    const currentParams = params[mode] || params.default;

    try {
        // Normalize actual coordinates
        const P_vecs = actualCoords.map(c => new THREE.Vector3(...c));
        if (P_vecs.some(v => v.lengthSq() < 1e-8)) {
            console.warn("Found coordinating atom at the same position as the center.");
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
        }
        P_vecs.forEach(v => v.normalize());

        const Q_vecs = referenceCoords.map(c => new THREE.Vector3(...c));

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
        const estimatedTotalSteps = (currentParams.useKabsch ? 1 : 0) + 18 +
            Math.ceil(currentParams.gridSteps / currentParams.gridStride) ** 3 +
            currentParams.numRestarts * currentParams.stepsPerRun +
            currentParams.refinementSteps;

        const reportProgress = (stage, current, total, extra = '') => {
            if (progressCallback) {
                const percentage = Math.min(99, Math.round((totalSteps / estimatedTotalSteps) * 100));
                progressCallback({ stage, percentage, current, total, extra });
            }
        };

        // STAGE 0: Kabsch Initial Alignment (IMPROVED)
        if (currentParams.useKabsch) {
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

        // STAGE 1: Reduced key orientations (18 instead of 24)
        reportProgress('Key Orientations', 0, 18);
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
            if (idx % 6 === 0) reportProgress('Key Orientations', idx, 18, `Best: ${globalBestMeasure.toFixed(4)}`);
        });

        // Early termination if already excellent
        if (globalBestMeasure < 0.01) {
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
        const gridSteps = currentParams.gridSteps;
        const gridStride = currentParams.gridStride;
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
                    if (gridCount % 50 === 0) {
                        reportProgress('Grid Search', gridCount, totalGridPoints, `Best: ${globalBestMeasure.toFixed(4)}`);
                    }
                }
            }
        }

        // Early termination check
        if (globalBestMeasure < 0.05) {
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
        const numRestarts = currentParams.numRestarts;
        const stepsPerRun = currentParams.stepsPerRun;

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
            let temp = 20.0;  // Reduced from 30.0
            const minTemp = 0.001;
            const alpha = Math.pow(minTemp / temp, 1 / stepsPerRun);

            for (let step = 0; step < stepsPerRun; step++) {
                const stepSize = temp * 0.12 * (1 + 0.2 * Math.random());
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
                if (bestInRun < 0.001) break;
            }

            if (bestInRun < globalBestMeasure) {
                globalBestMeasure = bestInRun;
                globalBestRotation.copy(bestRotationInRun);
                globalBestMatching = bestMatchingInRun;
            }

            // Early termination if excellent result
            if (globalBestMeasure < 0.01) break;
        }

        // STAGE 4: Final refinement (optimized)
        reportProgress('Refinement', 0, 100);
        let currentRotation = globalBestRotation.clone();
        let currentMeasure = globalBestMeasure;
        let temp = 3.0;  // Reduced from 5.0
        const refinementSteps = currentParams.refinementSteps;
        let noImprovementCount = 0;

        for (let step = 0; step < refinementSteps; step++) {
            const stepSize = temp * 0.02;
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

            temp *= 0.999;
            totalSteps++;

            if (step % 500 === 0) {
                reportProgress('Refinement', step, refinementSteps, `Best: ${globalBestMeasure.toFixed(4)}`);
            }

            // Early termination
            if (noImprovementCount > 500 && globalBestMeasure < 0.01) break;
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

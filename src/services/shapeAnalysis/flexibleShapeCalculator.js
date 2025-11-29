/**
 * Flexible Shape Measure Calculator
 *
 * Extends rigid CShM with anisotropic scaling (ab initio approach).
 *
 * Computes both:
 * - Rigid CShM: Traditional shape measure (no scaling)
 * - Flexible CShM: Optimizes scaling along XYZ axes after rigid alignment
 *
 * Method:
 * 1. Perform rigid alignment (rotation only)
 * 2. Optimize independent scaling factors (sx, sy, sz) along XYZ axes
 * 3. Use simulated annealing for global search (no geometry-specific assumptions)
 *
 * This distinguishes:
 * - "Wrong geometry" (high CShM even with scaling)
 * - "Distorted correct geometry" (low flexible CShM with reasonable distortion)
 */

import * as THREE from 'three';
import calculateShapeMeasure from './shapeCalculator.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';
import {
    optimizeScalingAnnealing,
    calculateDistortionIndex,
    formatScalingDescription
} from './anisotropicScaling.js';
import { KABSCH } from '../../constants/algorithmConstants.js';

/**
 * Calculate both rigid and flexible shape measures
 *
 * @param {Array<Array<number>>} actualCoords - Actual structure coordinates
 * @param {Array<Array<number>>} referenceCoords - Reference polyhedron coordinates
 * @param {string} mode - 'default' or 'intensive'
 * @param {Function} progressCallback - Progress reporting function
 * @param {Object} rigidResult - Optional pre-computed rigid result to reuse
 * @returns {Object} {
 *   rigid: { measure, alignedCoords, rotationMatrix },
 *   flexible: { measure, alignedCoords, rotationMatrix, scaling: { sx, sy, sz, distortion, description } },
 *   delta: number,
 *   improvement: number (percentage)
 * }
 */
export function calculateFlexibleShapeMeasure(actualCoords, referenceCoords, mode = 'default', progressCallback = null, rigidResult = null) {
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return {
            rigid: { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() },
            flexible: { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4(), scaling: null },
            delta: 0,
            improvement: 0
        };
    }

    // Stage 1: Calculate rigid CShM (standard algorithm) or use provided result
    let computedRigidResult;

    if (rigidResult) {
        // Reuse pre-computed rigid result (efficient when toggling from rigid to flexible mode)
        computedRigidResult = rigidResult;
        if (progressCallback) {
            progressCallback({
                stage: 'rigid_reuse',
                percentage: 50,
                current: 50,
                total: 100,
                extra: 'Reusing rigid CShM calculation...'
            });
        }
    } else {
        // Calculate rigid CShM from scratch
        if (progressCallback) {
            progressCallback({
                stage: 'rigid_alignment',
                percentage: 0,
                current: 0,
                total: 100,
                extra: 'Calculating rigid shape measure...'
            });
        }

        computedRigidResult = calculateShapeMeasure(actualCoords, referenceCoords, mode, (progress) => {
            if (progressCallback) {
                // Map rigid calculation to 0-50% of overall progress
                progressCallback({
                    ...progress,
                    percentage: progress.percentage * 0.5,
                    stage: `rigid_${progress.stage}`
                });
            }
        });
    }

    if (computedRigidResult.measure === Infinity) {
        return {
            rigid: computedRigidResult,
            flexible: { ...computedRigidResult, scaling: null },
            delta: 0,
            improvement: 0
        };
    }

    // Stage 2: Calculate flexible CShM (with anisotropic scaling)
    if (progressCallback) {
        progressCallback({
            stage: 'flexible_optimization',
            percentage: 50,
            current: 0,
            total: 100,
            extra: 'Optimizing anisotropic scaling...'
        });
    }

    try {
        const flexibleResult = calculateFlexibleCShM(
            actualCoords,
            referenceCoords,
            computedRigidResult.rotationMatrix,
            mode,
            (progress) => {
                if (progressCallback) {
                    // Map flexible calculation to 50-100% of overall progress
                    progressCallback({
                        stage: 'flexible_scaling',
                        percentage: 50 + progress * 0.5,
                        current: progress,
                        total: 100,
                        extra: 'Optimizing scaling parameters...'
                    });
                }
            }
        );

        // Calculate delta and improvement
        const delta = computedRigidResult.measure - flexibleResult.measure;
        const improvement = computedRigidResult.measure > 0
            ? (delta / computedRigidResult.measure) * 100
            : 0;

        // Debug logging
        if (delta > 0.5) { // Only log significant improvements
            console.log(`[Flexible] Rigid=${computedRigidResult.measure.toFixed(2)}, Flex=${flexibleResult.measure.toFixed(2)}, Δ=${delta.toFixed(2)} (${improvement.toFixed(0)}% improvement)`);
        }

        if (progressCallback) {
            progressCallback({
                stage: 'complete',
                percentage: 100,
                current: 100,
                total: 100,
                extra: `Δ = ${delta.toFixed(2)}, improvement = ${improvement.toFixed(1)}%`
            });
        }

        return {
            rigid: computedRigidResult,
            flexible: flexibleResult,
            delta,
            improvement
        };

    } catch (error) {
        console.error('Error in flexible shape calculation:', error);
        // Fallback to rigid-only results
        return {
            rigid: computedRigidResult,
            flexible: { ...computedRigidResult, scaling: null },
            delta: 0,
            improvement: 0
        };
    }
}

/**
 * Calculate flexible CShM with anisotropic scaling optimization
 *
 * Ab initio approach:
 * - After rigid alignment, optimizes scaling along XYZ axes
 * - No PCA, no geometry-specific heuristics
 * - Pure simulated annealing global search over (sx, sy, sz)
 */
function calculateFlexibleCShM(actualCoords, referenceCoords, rigidRotation, mode, progressCallback) {
    const N = actualCoords.length;

    // Normalize coordinates
    const P_vecs = actualCoords.map(c => new THREE.Vector3(...c));
    if (P_vecs.some(v => v.lengthSq() < KABSCH.MIN_VECTOR_LENGTH_SQ)) {
        throw new Error("Invalid coordinates");
    }
    P_vecs.forEach(v => v.normalize());

    const Q_vecs = referenceCoords.map(c => new THREE.Vector3(...c));

    // Apply rigid rotation to actual coordinates once
    const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rigidRotation));

    // Define measure function for scaling optimization
    // Scales reference geometry along standard XYZ axes (ab initio, no PCA)
    const getMeasureForScaling = (sx, sy, sz) => {
        // Apply anisotropic scaling to reference in XYZ frame
        const scaledQ = Q_vecs.map(q => {
            return new THREE.Vector3(q.x * sx, q.y * sy, q.z * sz);
        });

        // Compute cost matrix
        const costMatrix = [];
        for (let i = 0; i < N; i++) {
            costMatrix[i] = [];
            for (let j = 0; j < N; j++) {
                costMatrix[i][j] = rotatedP[i].distanceToSquared(scaledQ[j]);
            }
        }

        // Optimal assignment
        const matching = hungarianAlgorithm(costMatrix);
        const sumSqDiff = matching.reduce((sum, [i, j]) => sum + costMatrix[i][j], 0);

        return (sumSqDiff / N) * 100;
    };

    // Optimize scaling parameters using simulated annealing
    // Pure ab initio approach: no PCA, no geometry-specific assumptions
    // Scales along XYZ axes in the coordinate frame established by rigid alignment
    const scalingOptions = {
        minScale: 0.4,
        maxScale: 2.5,
        preserveVolume: false,
        initialTemp: mode === 'intensive' ? 1.0 : 0.6,
        coolingRate: mode === 'intensive' ? 0.96 : 0.94,
        iterations: mode === 'intensive' ? 3000 : 1500,
        restarts: mode === 'intensive' ? 8 : 5  // More restarts for global search
    };

    const optimalScaling = optimizeScalingAnnealing(getMeasureForScaling, scalingOptions);

    // Apply optimal scaling to get final result (simple XYZ scaling, no rotation needed)
    const scaledQ = Q_vecs.map(q => {
        return new THREE.Vector3(q.x * optimalScaling.sx, q.y * optimalScaling.sy, q.z * optimalScaling.sz);
    });

    // Final cost matrix and matching
    const costMatrix = [];
    for (let i = 0; i < N; i++) {
        costMatrix[i] = [];
        for (let j = 0; j < N; j++) {
            costMatrix[i][j] = rotatedP[i].distanceToSquared(scaledQ[j]);
        }
    }

    const finalMatching = hungarianAlgorithm(costMatrix);

    // Build aligned coordinates
    const alignedCoords = new Array(N);
    for (const [i, j] of finalMatching) {
        const rotated = rotatedP[i];
        alignedCoords[j] = [rotated.x, rotated.y, rotated.z];
    }

    // Calculate distortion metrics
    const distortion = calculateDistortionIndex(optimalScaling.sx, optimalScaling.sy, optimalScaling.sz);
    const description = formatScalingDescription(optimalScaling.sx, optimalScaling.sy, optimalScaling.sz);

    return {
        measure: optimalScaling.measure,
        alignedCoords: alignedCoords.filter(Boolean),
        rotationMatrix: rigidRotation.clone(),
        scaling: {
            sx: optimalScaling.sx,
            sy: optimalScaling.sy,
            sz: optimalScaling.sz,
            distortion,
            description
        }
    };
}

/**
 * Interpret flexible vs rigid results
 * Provides scientific interpretation of the difference
 *
 * @param {number} rigidCShM - Rigid shape measure
 * @param {number} flexibleCShM - Flexible shape measure
 * @param {number} distortion - Distortion index
 * @returns {Object} { category, interpretation, recommendation }
 */
export function interpretFlexibleResults(rigidCShM, flexibleCShM, distortion) {
    const delta = rigidCShM - flexibleCShM;
    const improvement = rigidCShM > 0 ? (delta / rigidCShM) * 100 : 0;

    // Classification logic
    if (flexibleCShM > 10.0) {
        return {
            category: 'wrong_geometry',
            interpretation: 'This geometry is not a good match, even with distortion.',
            recommendation: 'Try a different reference geometry.',
            color: '#dc2626' // red
        };
    }

    if (delta < 1.0 || improvement < 10) {
        return {
            category: 'rigid_match',
            interpretation: 'The structure matches well without needing distortion.',
            recommendation: 'Use the rigid CShM value.',
            color: '#16a34a' // green
        };
    }

    if (distortion < 5.0) {
        return {
            category: 'slight_distortion',
            interpretation: 'The structure is slightly distorted from the ideal geometry.',
            recommendation: 'This is a good match with minor distortion.',
            color: '#16a34a' // green
        };
    }

    if (distortion < 15.0) {
        return {
            category: 'moderate_distortion',
            interpretation: 'The structure shows moderate distortion from the ideal geometry.',
            recommendation: 'Consider reporting both rigid and flexible CShM values.',
            color: '#ea580c' // orange
        };
    }

    return {
        category: 'high_distortion',
        interpretation: 'The structure is heavily distorted from the ideal geometry.',
        recommendation: 'This may indicate a different geometry type or significant structural strain.',
        color: '#dc2626' // red
    };
}

export default calculateFlexibleShapeMeasure;

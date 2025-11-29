/**
 * Flexible Shape Measure Calculator
 *
 * Extends the rigid CShM calculation with anisotropic scaling support.
 * Computes both:
 * - Rigid CShM: Traditional shape measure (no scaling)
 * - Flexible CShM: Shape measure with optimized anisotropic scaling
 *
 * This allows distinguishing between:
 * - "Wrong geometry" (high CShM even with scaling)
 * - "Distorted correct geometry" (low flexible CShM, but with distortion)
 */

import * as THREE from 'three';
import calculateShapeMeasure from './shapeCalculator.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';
import {
    computeReferenceAxes,
    applyAnisotropicScaling,
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
 * @returns {Object} {
 *   rigid: { measure, alignedCoords, rotationMatrix },
 *   flexible: { measure, alignedCoords, rotationMatrix, scaling: { sx, sy, sz, distortion, description } },
 *   delta: number,
 *   improvement: number (percentage)
 * }
 */
export function calculateFlexibleShapeMeasure(actualCoords, referenceCoords, mode = 'default', progressCallback = null) {
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return {
            rigid: { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() },
            flexible: { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4(), scaling: null },
            delta: 0,
            improvement: 0
        };
    }

    // Stage 1: Calculate rigid CShM (standard algorithm)
    if (progressCallback) {
        progressCallback({
            stage: 'rigid_alignment',
            percentage: 0,
            current: 0,
            total: 100,
            extra: 'Calculating rigid shape measure...'
        });
    }

    const rigidResult = calculateShapeMeasure(actualCoords, referenceCoords, mode, (progress) => {
        if (progressCallback) {
            // Map rigid calculation to 0-50% of overall progress
            progressCallback({
                ...progress,
                percentage: progress.percentage * 0.5,
                stage: `rigid_${progress.stage}`
            });
        }
    });

    if (rigidResult.measure === Infinity) {
        return {
            rigid: rigidResult,
            flexible: { ...rigidResult, scaling: null },
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
            rigidResult.rotationMatrix,
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
        const delta = rigidResult.measure - flexibleResult.measure;
        const improvement = rigidResult.measure > 0
            ? (delta / rigidResult.measure) * 100
            : 0;

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
            rigid: rigidResult,
            flexible: flexibleResult,
            delta,
            improvement
        };

    } catch (error) {
        console.error('Error in flexible shape calculation:', error);
        // Fallback to rigid-only results
        return {
            rigid: rigidResult,
            flexible: { ...rigidResult, scaling: null },
            delta: 0,
            improvement: 0
        };
    }
}

/**
 * Calculate flexible CShM with anisotropic scaling optimization
 * Internal function - uses rigid alignment as starting point
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

    // Pre-compute reference geometry principal axes
    const refAxes = computeReferenceAxes(Q_vecs);

    // Define measure function for scaling optimization
    const getMeasureForScaling = (sx, sy, sz) => {
        // Apply anisotropic scaling to reference
        const scaledQ = applyAnisotropicScaling(Q_vecs, refAxes, sx, sy, sz);

        // Apply rigid rotation to actual coordinates
        const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rigidRotation));

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
    const scalingOptions = {
        minScale: 0.4,
        maxScale: 2.5,
        preserveVolume: false, // Allow volume changes for now
        initialTemp: mode === 'intensive' ? 0.8 : 0.5,
        coolingRate: mode === 'intensive' ? 0.96 : 0.94,
        iterations: mode === 'intensive' ? 2000 : 1000,
        restarts: mode === 'intensive' ? 5 : 3
    };

    const optimalScaling = optimizeScalingAnnealing(getMeasureForScaling, scalingOptions);

    // Apply optimal scaling to get final result
    const scaledQ = applyAnisotropicScaling(Q_vecs, refAxes, optimalScaling.sx, optimalScaling.sy, optimalScaling.sz);
    const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rigidRotation));

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

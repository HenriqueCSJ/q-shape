/**
 * Anisotropic Scaling for Reference Geometries
 *
 * Allows reference polyhedra to be scaled along their principal axes
 * to better match distorted coordination geometries (e.g., piano stools,
 * compressed/elongated structures).
 *
 * This provides a "flexible" shape matching mode that distinguishes:
 * - "Wrong geometry" (high CShM even with scaling)
 * - "Distorted geometry" (low CShM with scaling, but high scaling distortion)
 */

import * as THREE from 'three';
import { calculatePrincipalAxes } from './propertyAnalysis.js';

/**
 * Pre-compute principal axes for a reference geometry
 * These define the natural scaling axes for the polyhedron
 *
 * @param {Array<THREE.Vector3>} refVectors - Reference geometry vertices (normalized)
 * @returns {Object} { axes: [v1, v2, v3], eigenvalues, rotation }
 */
export function computeReferenceAxes(refVectors) {
    // Convert to coordinate arrays
    const coords = refVectors.map(v => [v.x, v.y, v.z]);

    // Calculate principal axes using PCA
    const pca = calculatePrincipalAxes(coords);

    if (pca.axes.length < 3) {
        // Fallback to standard axes if PCA fails
        return {
            axes: [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 1)
            ],
            eigenvalues: [1, 1, 1],
            rotation: new THREE.Matrix4()
        };
    }

    // Build rotation matrix from principal axes
    // This transforms from PCA space to world space
    const rotation = new THREE.Matrix4();
    rotation.makeBasis(pca.axes[0], pca.axes[1], pca.axes[2]);

    return {
        axes: pca.axes,
        eigenvalues: pca.eigenvalues,
        rotation
    };
}

/**
 * Apply anisotropic scaling to reference geometry
 *
 * @param {Array<THREE.Vector3>} refVectors - Reference geometry vertices
 * @param {Object} refAxes - Pre-computed reference axes from computeReferenceAxes
 * @param {number} sx - Scale factor along principal axis 1
 * @param {number} sy - Scale factor along principal axis 2
 * @param {number} sz - Scale factor along principal axis 3
 * @returns {Array<THREE.Vector3>} Scaled reference vectors
 */
export function applyAnisotropicScaling(refVectors, refAxes, sx, sy, sz) {
    const { rotation } = refAxes;
    const inverseRotation = rotation.clone().invert();

    // Build scaling matrix in PCA space
    const scalingMatrix = new THREE.Matrix4().makeScale(sx, sy, sz);

    // Transform to PCA space, scale, transform back
    // T = R * S * R^(-1)
    const transform = new THREE.Matrix4()
        .multiply(rotation)
        .multiply(scalingMatrix)
        .multiply(inverseRotation);

    return refVectors.map(v => v.clone().applyMatrix4(transform));
}

/**
 * Calculate distortion index from scaling parameters
 * Measures how much the reference geometry had to be distorted
 *
 * Higher values = more distortion needed
 * 0 = no distortion (isotropic scaling or sx=sy=sz=1)
 *
 * @param {number} sx - Scale factor along axis 1
 * @param {number} sy - Scale factor along axis 2
 * @param {number} sz - Scale factor along axis 3
 * @returns {number} Distortion index (0-100 scale)
 */
export function calculateDistortionIndex(sx, sy, sz) {
    // Geometric mean (average scale)
    const meanScale = Math.pow(sx * sy * sz, 1/3);

    // Normalize scales relative to mean
    const s1 = sx / meanScale;
    const s2 = sy / meanScale;
    const s3 = sz / meanScale;

    // Calculate variance from unity
    const variance = ((s1-1)**2 + (s2-1)**2 + (s3-1)**2) / 3;

    // Convert to 0-100 scale (empirically calibrated)
    // variance of ~0.01 = distortion ~3
    // variance of ~0.05 = distortion ~10
    // variance of ~0.20 = distortion ~30
    const distortion = Math.sqrt(variance) * 100;

    return distortion;
}

/**
 * Optimize scaling parameters to minimize CShM
 * Uses gradient descent with bounds constraints
 *
 * @param {Array<THREE.Vector3>} actualVecs - Actual structure vertices (normalized)
 * @param {Array<THREE.Vector3>} refVecs - Reference geometry vertices (normalized)
 * @param {Object} refAxes - Pre-computed reference axes
 * @param {THREE.Matrix4} rotationMatrix - Optimal rotation (from rigid alignment)
 * @param {Function} getMeasure - Function that calculates CShM given scaled ref vectors
 * @param {Object} options - { minScale, maxScale, preserveVolume, initialScales }
 * @returns {Object} { sx, sy, sz, measure, iterations }
 */
export function optimizeScaling(actualVecs, refVecs, refAxes, rotationMatrix, getMeasure, options = {}) {
    const {
        minScale = 0.5,
        maxScale = 2.0,
        preserveVolume = false,
        initialScales = [1.0, 1.0, 1.0],
        maxIterations = 500,
        tolerance = 1e-6
    } = options;

    let [sx, sy, sz] = initialScales;

    // Ensure volume preservation if requested
    if (preserveVolume) {
        const volume = sx * sy * sz;
        sz = volume / (sx * sy);
    }

    // Clamp to bounds
    const clamp = (val) => Math.max(minScale, Math.min(maxScale, val));
    sx = clamp(sx);
    sy = clamp(sy);
    sz = clamp(sz);

    let bestMeasure = Infinity;
    let bestScales = [sx, sy, sz];

    // Gradient descent with adaptive step size
    let stepSize = 0.1;
    const stepDecay = 0.95;
    const minStepSize = 1e-4;

    for (let iter = 0; iter < maxIterations; iter++) {
        // Evaluate current position
        const scaledRef = applyAnisotropicScaling(refVecs, refAxes, sx, sy, sz);
        const currentMeasure = getMeasure(scaledRef);

        if (currentMeasure < bestMeasure) {
            bestMeasure = currentMeasure;
            bestScales = [sx, sy, sz];
        }

        // Early termination if excellent match
        if (currentMeasure < 0.01) break;

        // Numerical gradient (finite differences)
        const epsilon = 1e-4;
        const gradSx = (getMeasure(applyAnisotropicScaling(refVecs, refAxes, sx + epsilon, sy, sz)) - currentMeasure) / epsilon;
        const gradSy = (getMeasure(applyAnisotropicScaling(refVecs, refAxes, sx, sy + epsilon, sz)) - currentMeasure) / epsilon;
        const gradSz = (getMeasure(applyAnisotropicScaling(refVecs, refAxes, sx, sy, sz + epsilon)) - currentMeasure) / epsilon;

        // Update with gradient descent
        let newSx = sx - stepSize * gradSx;
        let newSy = sy - stepSize * gradSy;
        let newSz = sz - stepSize * gradSz;

        // Volume preservation constraint
        if (preserveVolume) {
            const currentVolume = sx * sy * sz;
            newSz = currentVolume / (newSx * newSy);
        }

        // Clamp to bounds
        newSx = clamp(newSx);
        newSy = clamp(newSy);
        newSz = clamp(newSz);

        // Check convergence
        const change = Math.abs(newSx - sx) + Math.abs(newSy - sy) + Math.abs(newSz - sz);
        if (change < tolerance) break;

        sx = newSx;
        sy = newSy;
        sz = newSz;

        // Decay step size
        stepSize = Math.max(minStepSize, stepSize * stepDecay);
    }

    return {
        sx: bestScales[0],
        sy: bestScales[1],
        sz: bestScales[2],
        measure: bestMeasure,
        iterations: maxIterations
    };
}

/**
 * Simplified scaling optimization using simulated annealing
 * More robust for non-convex optimization landscapes
 *
 * @param {Function} getMeasure - Function: (sx, sy, sz) => CShM value
 * @param {Object} options - Configuration options
 * @returns {Object} { sx, sy, sz, measure }
 */
export function optimizeScalingAnnealing(getMeasure, options = {}) {
    const {
        minScale = 0.5,
        maxScale = 2.0,
        preserveVolume = false,
        initialTemp = 0.5,
        coolingRate = 0.95,
        iterations = 1000,
        restarts = 3
    } = options;

    const clamp = (val) => Math.max(minScale, Math.min(maxScale, val));

    let globalBest = { sx: 1, sy: 1, sz: 1, measure: Infinity };

    for (let restart = 0; restart < restarts; restart++) {
        // Random initialization (or start from [1,1,1] on first restart)
        let sx = restart === 0 ? 1.0 : minScale + Math.random() * (maxScale - minScale);
        let sy = restart === 0 ? 1.0 : minScale + Math.random() * (maxScale - minScale);
        let sz = restart === 0 ? 1.0 : minScale + Math.random() * (maxScale - minScale);

        if (preserveVolume) {
            sz = 1.0 / (sx * sy); // Ensure volume = 1
            sz = clamp(sz);
        }

        let currentMeasure = getMeasure(sx, sy, sz);
        let bestMeasure = currentMeasure;
        let bestScales = { sx, sy, sz };

        let temp = initialTemp;

        for (let iter = 0; iter < iterations; iter++) {
            // Propose new scales with random perturbation
            const perturbation = temp * 0.2;
            let newSx = sx + (Math.random() - 0.5) * 2 * perturbation;
            let newSy = sy + (Math.random() - 0.5) * 2 * perturbation;
            let newSz = sz + (Math.random() - 0.5) * 2 * perturbation;

            // Volume preservation
            if (preserveVolume) {
                newSz = (sx * sy * sz) / (newSx * newSy);
            }

            // Clamp to bounds
            newSx = clamp(newSx);
            newSy = clamp(newSy);
            newSz = clamp(newSz);

            const newMeasure = getMeasure(newSx, newSy, newSz);

            // Metropolis criterion
            const delta = newMeasure - currentMeasure;
            const accept = delta < 0 || Math.random() < Math.exp(-delta / temp);

            if (accept) {
                sx = newSx;
                sy = newSy;
                sz = newSz;
                currentMeasure = newMeasure;

                if (currentMeasure < bestMeasure) {
                    bestMeasure = currentMeasure;
                    bestScales = { sx, sy, sz };
                }
            }

            // Cool down
            temp *= coolingRate;

            // Early termination
            if (bestMeasure < 0.01) break;
        }

        if (bestMeasure < globalBest.measure) {
            globalBest = { ...bestScales, measure: bestMeasure };
        }
    }

    return globalBest;
}

/**
 * Format scaling parameters for display
 *
 * @param {number} sx - Scale along axis 1
 * @param {number} sy - Scale along axis 2
 * @param {number} sz - Scale along axis 3
 * @returns {string} Human-readable description
 */
export function formatScalingDescription(sx, sy, sz) {
    const tolerance = 0.05; // 5% tolerance for "approximately equal"

    // Check if isotropic (all equal)
    if (Math.abs(sx - sy) < tolerance && Math.abs(sy - sz) < tolerance) {
        if (Math.abs(sx - 1.0) < tolerance) {
            return 'No scaling';
        }
        const percent = ((sx - 1.0) * 100).toFixed(0);
        return percent > 0 ? `Uniformly expanded (${percent}%)` : `Uniformly compressed (${Math.abs(percent)}%)`;
    }

    // Find most and least scaled axes
    const scales = [
        { axis: 'X', value: sx },
        { axis: 'Y', value: sy },
        { axis: 'Z', value: sz }
    ];
    scales.sort((a, b) => b.value - a.value);

    const descriptions = [];
    if (scales[0].value > 1.0 + tolerance) {
        const percent = ((scales[0].value - 1.0) * 100).toFixed(0);
        descriptions.push(`elongated along ${scales[0].axis} (+${percent}%)`);
    }
    if (scales[2].value < 1.0 - tolerance) {
        const percent = ((1.0 - scales[2].value) * 100).toFixed(0);
        descriptions.push(`compressed along ${scales[2].axis} (-${percent}%)`);
    }

    return descriptions.length > 0 ? descriptions.join(', ') : 'Anisotropic scaling';
}

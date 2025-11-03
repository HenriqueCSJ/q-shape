/**
 * Smart Alignment Module
 *
 * Uses geometric properties to provide intelligent initial alignments
 * for CShM optimization. This dramatically improves convergence for
 * complex structures like sandwich complexes, layered geometries, etc.
 *
 * Strategy:
 * 1. Analyze both actual and reference geometries for properties
 * 2. Try to align matching properties (layers→layers, C5→C5, etc.)
 * 3. Return multiple good starting rotations for the optimizer
 */

import * as THREE from 'three';
import {
    analyzeGeometricProperties,
    calculatePrincipalAxes,
    detectCoplanarLayers,
    detectSymmetryAxes
} from './propertyAnalysis';

/**
 * Align two vectors by computing rotation that maps v1 to v2
 * Returns rotation matrix
 */
function alignVectors(v1, v2) {
    const axis = v1.clone().cross(v2);
    const axisLength = axis.length();

    // Vectors are parallel or antiparallel
    if (axisLength < 1e-6) {
        const dot = v1.dot(v2);
        if (dot > 0) {
            return new THREE.Matrix4(); // Identity
        } else {
            // 180° rotation around perpendicular axis
            const perp = Math.abs(v1.x) < 0.9
                ? new THREE.Vector3(1, 0, 0)
                : new THREE.Vector3(0, 1, 0);
            const rotAxis = v1.clone().cross(perp).normalize();
            return new THREE.Matrix4().makeRotationAxis(rotAxis, Math.PI);
        }
    }

    axis.normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));

    return new THREE.Matrix4().makeRotationAxis(axis, angle);
}

/**
 * Align based on principal axes (PCA alignment)
 * Good for anisotropic structures
 */
function alignByPrincipalAxes(actualCoords, referenceCoords) {
    const actualPCA = calculatePrincipalAxes(actualCoords);
    const refPCA = calculatePrincipalAxes(referenceCoords);

    if (actualPCA.axes.length < 3 || refPCA.axes.length < 3) {
        return [new THREE.Matrix4()]; // Fallback to identity
    }

    const rotations = [];

    // Strategy 1: Align primary axes directly
    const R1_primary = alignVectors(actualPCA.axes[0], refPCA.axes[0]);

    // Apply R1 and then align secondary axes
    const actualSecondary = actualPCA.axes[1].clone().applyMatrix4(R1_primary);
    const R2_secondary = alignVectors(actualSecondary, refPCA.axes[1]);

    const R_direct = new THREE.Matrix4().multiplyMatrices(R2_secondary, R1_primary);
    rotations.push(R_direct);

    // Strategy 2: Try swapping axes (handles different axis ordering)
    const axisPermutations = [
        [0, 1, 2], // Already tried above
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0]
    ];

    for (const [i, j] of axisPermutations.slice(1)) { // Skip first (already done)
        const R1 = alignVectors(actualPCA.axes[i], refPCA.axes[0]);
        const temp = actualPCA.axes[j].clone().applyMatrix4(R1);
        const R2 = alignVectors(temp, refPCA.axes[1]);
        const R = new THREE.Matrix4().multiplyMatrices(R2, R1);
        rotations.push(R);
    }

    return rotations;
}

/**
 * Align based on coplanar layers
 * Excellent for sandwich complexes (ferrocene, etc.)
 */
function alignByLayers(actualCoords, referenceCoords) {
    const actualLayers = detectCoplanarLayers(actualCoords);
    const refLayers = detectCoplanarLayers(referenceCoords);

    if (actualLayers.length === 0 || refLayers.length === 0) {
        return [];
    }

    const rotations = [];

    // Try aligning the largest layers
    for (let i = 0; i < Math.min(2, actualLayers.length); i++) {
        for (let j = 0; j < Math.min(2, refLayers.length); j++) {
            const actualNormal = actualLayers[i].normal;
            const refNormal = refLayers[j].normal;

            // Align normals (try both directions)
            const R1 = alignVectors(actualNormal, refNormal);
            rotations.push(R1);

            const R2 = alignVectors(actualNormal, refNormal.clone().negate());
            rotations.push(R2);

            // Also try with 180° flip
            const flip = new THREE.Matrix4().makeRotationAxis(refNormal, Math.PI);
            rotations.push(new THREE.Matrix4().multiplyMatrices(flip, R1));
        }
    }

    return rotations;
}

/**
 * Align based on symmetry axes
 * Useful for high-symmetry structures (C5, C6, etc.)
 */
function alignBySymmetry(actualCoords, referenceCoords) {
    const actualSyms = detectSymmetryAxes(actualCoords);
    const refSyms = detectSymmetryAxes(referenceCoords);

    if (actualSyms.length === 0 || refSyms.length === 0) {
        return [];
    }

    const rotations = [];

    // Try aligning symmetry axes of the same order
    for (const actualSym of actualSyms.slice(0, 3)) { // Top 3
        for (const refSym of refSyms.slice(0, 3)) {
            // Only align if orders are compatible
            if (actualSym.order === refSym.order || actualSym.order % refSym.order === 0 || refSym.order % actualSym.order === 0) {
                const R = alignVectors(actualSym.axis, refSym.axis);
                rotations.push(R);

                // Also try opposite direction
                const R_neg = alignVectors(actualSym.axis, refSym.axis.clone().negate());
                rotations.push(R_neg);

                // Try rotations around the aligned axis
                if (actualSym.order === refSym.order && actualSym.order >= 2) {
                    const angleStep = (2 * Math.PI) / actualSym.order;
                    for (let k = 1; k < actualSym.order; k++) {
                        const extraRot = new THREE.Matrix4().makeRotationAxis(refSym.axis, k * angleStep);
                        rotations.push(new THREE.Matrix4().multiplyMatrices(extraRot, R));
                    }
                }
            }
        }
    }

    return rotations;
}

/**
 * Generate smart initial alignments based on geometric properties
 * Returns array of rotation matrices to try
 *
 * @param {Array<Array<number>>} actualCoords - Actual structure coordinates (centered)
 * @param {Array<Array<number>>} referenceCoords - Reference geometry coordinates
 * @returns {Array<THREE.Matrix4>} Array of candidate rotation matrices
 */
export function generateSmartAlignments(actualCoords, referenceCoords) {
    const rotations = [];

    // Always include identity as fallback
    rotations.push(new THREE.Matrix4());

    // Analyze properties
    const actualProps = analyzeGeometricProperties(actualCoords);
    const refProps = analyzeGeometricProperties(referenceCoords);

    console.log(`Smart Alignment: Actual has ${actualProps.layers.length} layers, ${actualProps.symmetries.length} symmetries`);
    console.log(`Smart Alignment: Reference has ${refProps.layers.length} layers, ${refProps.symmetries.length} symmetries`);

    // Strategy 1: Layer-based alignment (excellent for sandwich complexes)
    if (actualProps.layers.length > 0 && refProps.layers.length > 0) {
        const layerAlignments = alignByLayers(actualCoords, referenceCoords);
        rotations.push(...layerAlignments);
        console.log(`  Added ${layerAlignments.length} layer-based alignments`);
    }

    // Strategy 2: Symmetry-based alignment (good for high-symmetry structures)
    if (actualProps.symmetries.length > 0 && refProps.symmetries.length > 0) {
        const symAlignments = alignBySymmetry(actualCoords, referenceCoords);
        rotations.push(...symAlignments);
        console.log(`  Added ${symAlignments.length} symmetry-based alignments`);
    }

    // Strategy 3: PCA-based alignment (general purpose)
    if (actualProps.principalAxes.anisotropy > 0.1) { // Only if not too spherical
        const pcaAlignments = alignByPrincipalAxes(actualCoords, referenceCoords);
        rotations.push(...pcaAlignments);
        console.log(`  Added ${pcaAlignments.length} PCA-based alignments`);
    }

    // Remove duplicates (very similar rotations)
    const unique = [];
    const testPoint = new THREE.Vector3(1, 0.5, 0.3);

    for (const R of rotations) {
        const transformed = testPoint.clone().applyMatrix4(R);

        const isDuplicate = unique.some(U => {
            const otherTransform = testPoint.clone().applyMatrix4(U);
            return transformed.distanceTo(otherTransform) < 0.1;
        });

        if (!isDuplicate) {
            unique.push(R);
        }
    }

    console.log(`Smart Alignment: Generated ${unique.length} unique candidate alignments (from ${rotations.length} total)`);

    // Limit to reasonable number (avoid overwhelming the optimizer)
    return unique.slice(0, 20);
}

/**
 * Enhanced version that returns alignments with metadata
 * Useful for debugging and progress reporting
 */
export function generateSmartAlignmentsWithMetadata(actualCoords, referenceCoords) {
    const alignments = [];

    // Identity
    alignments.push({
        rotation: new THREE.Matrix4(),
        strategy: 'identity',
        description: 'No rotation'
    });

    const actualProps = analyzeGeometricProperties(actualCoords);
    const refProps = analyzeGeometricProperties(referenceCoords);

    // Layer alignments
    if (actualProps.layers.length > 0 && refProps.layers.length > 0) {
        const layerRots = alignByLayers(actualCoords, referenceCoords);
        layerRots.forEach((R, i) => {
            alignments.push({
                rotation: R,
                strategy: 'layer',
                description: `Layer-based alignment ${i + 1}`
            });
        });
    }

    // Symmetry alignments
    if (actualProps.symmetries.length > 0 && refProps.symmetries.length > 0) {
        const symRots = alignBySymmetry(actualCoords, referenceCoords);
        symRots.forEach((R, i) => {
            alignments.push({
                rotation: R,
                strategy: 'symmetry',
                description: `Symmetry-based alignment ${i + 1}`
            });
        });
    }

    // PCA alignments
    if (actualProps.principalAxes.anisotropy > 0.1) {
        const pcaRots = alignByPrincipalAxes(actualCoords, referenceCoords);
        pcaRots.forEach((R, i) => {
            alignments.push({
                rotation: R,
                strategy: 'pca',
                description: `PCA-based alignment ${i + 1}`
            });
        });
    }

    // Remove duplicates
    const unique = [];
    const testPoint = new THREE.Vector3(1, 0.5, 0.3);

    for (const alignment of alignments) {
        const transformed = testPoint.clone().applyMatrix4(alignment.rotation);

        const isDuplicate = unique.some(u => {
            const otherTransform = testPoint.clone().applyMatrix4(u.rotation);
            return transformed.distanceTo(otherTransform) < 0.1;
        });

        if (!isDuplicate) {
            unique.push(alignment);
        }
    }

    return unique.slice(0, 20);
}

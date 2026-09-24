import * as THREE from 'three';
import { SHAPE_COMPARISON_CONVENTION } from '../../constants/shapeComparison';

const REFLECTION = new THREE.Matrix4().makeScale(-1, 1, 1);

function validateTransform(matrix, parity) {
    const e = matrix?.elements;
    if (!e || e.length !== 16 || !e.every(Number.isFinite) ||
        !Number.isFinite(matrix.determinant()) || Math.abs(matrix.determinant() - parity) > 1e-8 ||
        [3, 7, 11, 12, 13, 14].some(i => Math.abs(e[i]) > 1e-8) || Math.abs(e[15] - 1) > 1e-8) {
        throw new Error('Invalid orthogonal comparison transform or parity');
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const dot = [0, 1, 2].reduce((sum, k) => sum + e[4 * i + k] * e[4 * j + k], 0);
        if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-8) {
            throw new Error('Comparison transform is not orthonormal');
        }
    }
}

function validateBranch(result, count, fixedCenter) {
    if (!Number.isFinite(result?.measure) || result.measure < 0 || result.measure > 100) {
        throw new Error('Parity branch did not return a finite CShM');
    }
    const matching = result.matching;
    if (!Array.isArray(matching) || matching.length !== count ||
        matching.some(pair => !Array.isArray(pair) || pair.length !== 2 ||
            pair.some(i => !Number.isInteger(i) || i < 0 || i >= count)) ||
        new Set(matching.map(([i]) => i)).size !== count ||
        new Set(matching.map(([, j]) => j)).size !== count ||
        (fixedCenter && !matching.some(([i, j]) => i === count - 1 && j === count - 1))) {
        throw new Error('Parity branch returned an invalid assignment');
    }
    validateTransform(result.rotationMatrix, 1);
}

function normalize(points) {
    const vectors = points.map(point => new THREE.Vector3(...point));
    const center = vectors.reduce((sum, point) => sum.add(point), new THREE.Vector3())
        .divideScalar(vectors.length);
    const centered = vectors.map(point => point.sub(center));
    const rms = Math.sqrt(centered.reduce((sum, point) => sum + point.lengthSq(), 0) / vectors.length);
    if (!Number.isFinite(rms) || rms < 1e-10) {
        throw new Error('Comparison normalization requires finite RMS spatial extent >= 1e-10');
    }
    return centered.map(point => point.divideScalar(rms));
}

/**
 * O(3) = SO(3) union SO(3)F. Each branch uses the unchanged proper solver.
 * An injected RNG is replayed from draw zero with separate branch cursors;
 * neither branch can advance the other's sequence position. Default/seeded
 * generators are independently initialized inside each proper solve.
 */
export function runOrthogonalComparison(solveProper, actual, reference, mode, progressCallback, options = {}) {
    const branches = {};
    const branchErrors = {};
    const branchFinalizations = {};
    const randomTape = [];
    const fixedCenter = Array.isArray(actual) && Array.isArray(reference) && reference.length === actual.length + 1;
    const count = Array.isArray(actual) ? actual.length + (fixedCenter ? 1 : 0) : 0;
    for (const [branchIndex, branch] of ['proper', 'reflected'].entries()) {
        let cursor = 0;
        const branchOptions = {
            ...options,
            onFinalization: data => {
                const record = { ...data, branch, alignmentParity: branchIndex ? -1 : 1 };
                branchFinalizations[branch] = record;
                if (typeof options.onFinalization === 'function') options.onFinalization(record);
            }
        };
        if (typeof options.rng === 'function') branchOptions.rng = () => {
            if (cursor === randomTape.length) randomTape.push(options.rng());
            return randomTape[cursor++];
        };
        try {
            // Reflect before normalization, including an explicitly supplied
            // center. An automatically added center is zero before centering.
            const input = branchIndex && Array.isArray(actual)
                ? actual.map(point => [-point[0], point[1], point[2]]) : actual;
            const callback = typeof progressCallback === 'function' ? update => progressCallback({
                ...update, branch, percentage: (branchIndex * 100 + update.percentage) / 2
            }) : null;
            const result = solveProper(input, reference, mode, callback, branchOptions);
            validateBranch(result, count, fixedCenter);
            branches[branch] = result;
        } catch (error) {
            branchErrors[branch] = error;
        }
    }
    if (Object.keys(branchErrors).length) {
        const error = new Error(`Two-parity shape comparison failed: ${Object.entries(branchErrors)
            .map(([branch, cause]) => `${branch}: ${cause.message}`).join('; ')}`);
        error.branchErrors = branchErrors;
        error.branchScores = Object.fromEntries(Object.entries(branches).map(([branch, result]) => [branch, result.measure]));
        error.branchFinalizations = branchFinalizations;
        throw error;
    }
    const selectedBranch = branches.reflected.measure < branches.proper.measure ? 'reflected' : 'proper';
    const selected = branches[selectedBranch];
    const alignmentParity = selectedBranch === 'proper' ? 1 : -1;
    const transformationMatrix = selected.rotationMatrix.clone();
    if (alignmentParity === -1) transformationMatrix.multiply(REFLECTION);
    validateTransform(transformationMatrix, alignmentParity);
    const normalized = normalize(fixedCenter ? [...actual, [0, 0, 0]] : actual);
    const alignedCoords = new Array(count);
    for (const [i, j] of selected.matching) {
        alignedCoords[j] = normalized[i].clone().applyMatrix4(transformationMatrix).toArray();
    }
    const target = normalize(reference);
    const overlap = alignedCoords.reduce((sum, p, i) => sum + new THREE.Vector3(...p).dot(target[i]), 0) / count;
    const scale = Math.max(0, Math.min(1, overlap));
    const directResidual = 100 * alignedCoords.reduce((sum, p, i) => sum + new THREE.Vector3(...p)
        .sub(target[i].clone().multiplyScalar(scale)).lengthSq(), 0) / count;
    if (!Number.isFinite(directResidual) || Math.abs(directResidual - selected.measure) > 1e-9) {
        throw new Error('Selected comparison transform does not reproduce its CShM');
    }
    if (typeof progressCallback === 'function') progressCallback({
        stage: 'Complete', percentage: 100, current: 2, total: 2,
        extra: `Final: ${selected.measure.toFixed(4)}`, branch: selectedBranch
    });
    return {
        ...selected,
        comparisonConvention: SHAPE_COMPARISON_CONVENTION,
        alignmentParity,
        selectedBranch,
        transformationMatrix,
        // Legacy name: this is the SAME full T, possibly improper, never R alone.
        rotationMatrix: transformationMatrix,
        properRotationMatrix: selected.rotationMatrix,
        alignedCoords,
        branchScores: { proper: branches.proper.measure, reflected: branches.reflected.measure },
        branchFinalizations,
        directResidual,
        optimalScale: scale
    };
}

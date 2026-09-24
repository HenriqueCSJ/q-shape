import { Matrix4, Vector3 } from 'three';
import { SHAPE_COMPARISON_CONVENTION } from '../constants/shapeComparison';

// Three.js matrices serialize as { elements: [...] }. Accept that representation
// without changing the recorded convention or guessing a missing parity.
export function restoreAlignmentMatrix(value) {
    const elements = Array.isArray(value) ? value : value?.elements;
    if (!elements || elements.length !== 16 || !Array.from(elements).every(Number.isFinite)) return null;
    return new Matrix4().fromArray(Array.from(elements));
}

export function getAlignmentTransform(result) {
    return restoreAlignmentMatrix(result?.transformationMatrix ?? result?.rotationMatrix);
}

export function restoreAlignmentFields(result) {
    const restored = { ...result };
    if (result.transformationMatrix != null) {
        const matrix = restoreAlignmentMatrix(result.transformationMatrix);
        if (matrix) {
            restored.transformationMatrix = matrix;
            restored.rotationMatrix = matrix;
        }
    } else if (result.rotationMatrix != null) {
        restored.rotationMatrix = restoreAlignmentMatrix(result.rotationMatrix) || result.rotationMatrix;
    }
    if (result.properRotationMatrix != null) {
        restored.properRotationMatrix = restoreAlignmentMatrix(result.properRotationMatrix) || result.properRotationMatrix;
    }
    return restored;
}

export function comparisonConventionLabel(result) {
    return result?.comparisonConvention === SHAPE_COMPARISON_CONVENTION
        ? 'CShM treats mirror images as equivalent.'
        : `Comparison convention: ${result?.comparisonConvention || 'legacy / not recorded'}.`;
}

export function alignmentParityLabel(result) {
    if (result?.alignmentParity === -1) return 'Mirrored reference alignment';
    if (result?.alignmentParity === 1) return 'Proper reference alignment';
    return 'Alignment parity not recorded';
}

export function referenceOverlayCoordinates(result) {
    const transform = getAlignmentTransform(result);
    if (!transform || !Array.isArray(result?.refCoords)) return null;
    const inverse = transform.invert();
    // T maps original observed coordinates to the retained reference. Inverse T
    // transforms only that reference into the molecule's unchanged frame.
    return result.refCoords.map(coords => new Vector3(...coords).applyMatrix4(inverse));
}

export function alignmentExportRecord(result) {
    if (!result) return null;
    const matrix = getAlignmentTransform(result);
    return {
        name: result.name,
        shapeMeasure: Number.isFinite(result.shapeMeasure) ? result.shapeMeasure : null,
        comparisonConvention: result.comparisonConvention || null,
        alignmentParity: result.alignmentParity === 1 || result.alignmentParity === -1 ? result.alignmentParity : null,
        transformationMatrix: matrix?.toArray() || null,
        rotationMatrix: matrix?.toArray() || null,
        matrixStorage: 'THREE.Matrix4 column-major; original observed to retained reference',
        properRotationMatrix: restoreAlignmentMatrix(result.properRotationMatrix)?.toArray() || null,
        matching: result.matching || null,
        alignedCoords: result.alignedCoords || null,
        refCoords: result.refCoords || null,
        branchScores: result.branchScores || null,
        status: result.status || null,
        error: result.error || null
    };
}

export function analysisContextRecord({ atoms, selectedMetal, coordAtoms, coordRadius, analysisMode, structureId }) {
    return {
        structureId: structureId || null,
        atoms: atoms || null,
        atomIndexBase: 0,
        selectedMetal: Number.isInteger(selectedMetal) ? selectedMetal : null,
        selectedDonorIndices: Array.isArray(coordAtoms) ? coordAtoms.map(entry => entry.idx ?? null) : null,
        coordRadius: Number.isFinite(coordRadius) ? coordRadius : null,
        analysisMode: analysisMode || null
    };
}

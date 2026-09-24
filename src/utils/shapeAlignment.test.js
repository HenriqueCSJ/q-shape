import { Matrix4 } from 'three';
import { normalizeShapeResult, prepareGeometryResults } from './shapeResults';
import { alignmentExportRecord, alignmentParityLabel, comparisonConventionLabel, referenceOverlayCoordinates } from './shapeAlignment';
import { SHAPE_COMPARISON_CONVENTION } from '../constants/shapeComparison';

const fullTransform = new Matrix4().set(
    0, -1, 0, 0,
    -1, 0, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
);
const record = () => ({
    name: 'asymmetric test', shapeMeasure: 1.23456789012345,
    comparisonConvention: SHAPE_COMPARISON_CONVENTION, alignmentParity: -1,
    transformationMatrix: fullTransform, rotationMatrix: fullTransform,
    properRotationMatrix: new Matrix4().makeRotationZ(Math.PI / 2),
    refCoords: [[1, 2, 3], [2, -3, 1], [-1, 1, 4], [0, 0, 0]],
    alignedCoords: [[1, 2, 3], [2, -3, 1], [-1, 1, 4], [0, 0, 0]],
    matching: [[0, 1], [1, 2], [2, 0], [3, 3]],
    branchScores: { proper: 2.3456789012345, reflected: 1.23456789012345 }
});

test('a serialized result restores one canonical full transform and retains its scientific identity', () => {
    const source = record();
    const restored = prepareGeometryResults([JSON.parse(JSON.stringify(source))])[0];
    expect(restored.transformationMatrix.isMatrix4).toBe(true);
    expect(restored.rotationMatrix).toBe(restored.transformationMatrix);
    expect(restored.transformationMatrix.determinant()).toBe(-1);
    expect(alignmentExportRecord(restored)).toEqual(alignmentExportRecord(normalizeShapeResult(source)));
    expect(restored.matching).toEqual(source.matching);
    expect(restored.branchScores).toEqual(source.branchScores);
});

test('the viewer inverts the full transform once on the reference without mutating its retained coordinates', () => {
    const source = record();
    // A conflicting legacy alias cannot supersede the canonical full transform.
    source.rotationMatrix = new Matrix4();
    const refBefore = JSON.stringify(source.refCoords);
    const expected = [
        [-2, -1, 3], [3, -2, 1], [-1, 1, 4], [0, 0, 0]
    ];
    referenceOverlayCoordinates(source).forEach((point, i) =>
        point.toArray().forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 14)));
    expect(JSON.stringify(source.refCoords)).toBe(refBefore);
    expect(source.transformationMatrix.toArray()).toEqual(fullTransform.toArray());
});

test('proper and legacy overlays remain supported without relabeling historical results', () => {
    const legacy = normalizeShapeResult({ name: 'old', shapeMeasure: 1, rotationMatrix: new Matrix4(), refCoords: [[1, 2, 3]] });
    expect(referenceOverlayCoordinates(legacy)[0].toArray()).toEqual([1, 2, 3]);
    expect(legacy.comparisonConvention).toBeUndefined();
    expect(legacy.alignmentParity).toBeUndefined();
    expect(comparisonConventionLabel(legacy)).toContain('legacy / not recorded');
    expect(alignmentExportRecord(legacy).comparisonConvention).toBeNull();
    expect(alignmentParityLabel(legacy)).toBe('Alignment parity not recorded');
    expect(alignmentParityLabel({ alignmentParity: 1 })).toBe('Proper reference alignment');
    expect(alignmentParityLabel(record())).toBe('Mirrored reference alignment');
});

import { Matrix4 } from 'three';
import { buildGeneralGeometry, buildSandwichGeometry, buildMacrocycleGeometry, buildPianoStoolGeometry } from './geometryBuilder';
import calculateShapeMeasure from '../../shapeAnalysis/shapeCalculator';
import { SHAPE_COMPARISON_CONVENTION } from '../../../constants/shapeComparison';

jest.mock('../../shapeAnalysis/shapeCalculator', () => ({ __esModule: true, default: jest.fn() }));

test('general and retained builder adapters preserve both parity transforms and diagnostics', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const transform = new Matrix4().makeScale(-1, 1, 1);
    const tuple = { measure: 0.123456789012345, comparisonConvention: SHAPE_COMPARISON_CONVENTION,
        alignmentParity: -1, transformationMatrix: transform, rotationMatrix: transform,
        properRotationMatrix: new Matrix4(), matching: [[0, 0]], alignedCoords: [[0, 0, 0]],
        branchScores: { proper: 3, reflected: 0.123456789012345 } };
    calculateShapeMeasure.mockReturnValue(tuple);
    const actual = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, -1, -1]];
    const original = JSON.stringify(actual);
    const pattern = { metadata: { coordinationNumber: 4, ringSize: 4, axialCount: 0, monodentateCount: 0 } };
    const outputs = [await buildGeneralGeometry(actual, 4), buildSandwichGeometry(actual, pattern),
        buildMacrocycleGeometry(actual, pattern), await buildPianoStoolGeometry(actual, pattern)];
    for (const output of outputs) for (const result of output) {
        expect(result.comparisonConvention).toBe(SHAPE_COMPARISON_CONVENTION);
        expect(result.alignmentParity).toBe(-1);
        expect(result.transformationMatrix.toArray()).toEqual(transform.toArray());
        expect(result.rotationMatrix.toArray()).toEqual(transform.toArray());
        expect(result.matching).toEqual(tuple.matching);
        expect(result.branchScores).toEqual(tuple.branchScores);
        expect(result.shapeMeasure).toBe(tuple.measure);
    }
    expect(JSON.stringify(actual)).toBe(original);
    log.mockRestore();
});

jest.mock('../../shapeAnalysis/shapeCalculator', () => jest.fn());

import { REFERENCE_GEOMETRIES } from '../../../constants/referenceGeometries';
import calculateShapeMeasure from '../../shapeAnalysis/shapeCalculator';
import { isShapeResultAvailable } from '../../../utils/shapeResults';
import { buildGeneralGeometry } from './geometryBuilder';

describe('general geometry builder failure retention', () => {
    let logSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    test('keeps the exact reference set when one calculation throws', async () => {
        const names = Object.keys(REFERENCE_GEOMETRIES[2]);
        const progress = jest.fn();
        calculateShapeMeasure.mockImplementation(() => {
            const index = calculateShapeMeasure.mock.calls.length - 1;
            if (index === 1) throw new Error('synthetic Kabsch failure');
            return {
                measure: index + 0.25,
                alignedCoords: [[1, 0, 0], [-1, 0, 0]],
                rotationMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
            };
        });

        const results = await buildGeneralGeometry(
            [[1, 0, 0], [-1, 0, 0]],
            2,
            'intensive',
            progress
        );

        expect(results).toHaveLength(names.length);
        expect(new Set(results.map(result => result.name))).toEqual(new Set(names));
        expect(results.filter(isShapeResultAvailable)).toHaveLength(names.length - 1);
        expect(results.at(-1)).toMatchObject({
            name: names[1],
            shapeMeasure: null,
            status: 'error',
            alignedCoords: [],
            rotationMatrix: null
        });
        expect(results.at(-1).error).toMatch(/synthetic Kabsch failure/);
        expect(progress).toHaveBeenCalledTimes(names.length);
    });
});

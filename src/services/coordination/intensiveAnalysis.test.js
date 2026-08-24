jest.mock('./ringDetector', () => ({
    detectLigandGroups: jest.fn()
}));

jest.mock('./patterns/geometryBuilder', () => ({
    buildGeneralGeometry: jest.fn()
}));

import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import { detectLigandGroups } from './ringDetector';
import { buildGeneralGeometry } from './patterns/geometryBuilder';
import {
    runIntensiveAnalysisAsync,
    validateIntensiveGeometryResults
} from './intensiveAnalysis';

const atoms = [
    { element: 'Fe', x: 0, y: 0, z: 0 },
    { element: 'N', x: 1, y: 0, z: 0 },
    { element: 'N', x: -1, y: 0, z: 0 }
];

function validCn2Results() {
    return Object.keys(REFERENCE_GEOMETRIES[2]).map((name, index) => ({
        name,
        shapeMeasure: index,
        refCoords: REFERENCE_GEOMETRIES[2][name],
        alignedCoords: [],
        rotationMatrix: []
    }));
}

describe('intensive-analysis failure contract', () => {
    let logSpy;
    let errorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        detectLigandGroups.mockReturnValue({
            rings: [],
            monodentate: [1, 2],
            totalGroups: 2,
            ringCount: 0,
            summary: '2 monodentate',
            hasSandwichStructure: false,
            detectedHapticities: []
        });
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('rejects when the geometry builder fails and reports error progress', async () => {
        buildGeneralGeometry.mockRejectedValue(new Error('optimizer failed'));
        const progress = [];
        await expect(runIntensiveAnalysisAsync(atoms, 0, 2, item => progress.push(item)))
            .rejects.toThrow('optimizer failed');
        expect(progress.at(-1)).toMatchObject({ stage: 'error', progress: 0 });
    });

    test('rejects an empty geometry list without reporting completion', async () => {
        buildGeneralGeometry.mockResolvedValue([]);
        const progress = [];
        await expect(runIntensiveAnalysisAsync(atoms, 0, 2, item => progress.push(item)))
            .rejects.toThrow('Intensive analysis returned no geometry results');
        expect(progress.some(item => item.stage === 'complete')).toBe(false);
        expect(progress.at(-1)).toMatchObject({ stage: 'error' });
    });

    test('requires the exact finite reference set for the coordination number', () => {
        const valid = validCn2Results();
        const nonFinite = valid.map(item => ({ ...item }));
        nonFinite[0].shapeMeasure = Number.NaN;
        expect(() => validateIntensiveGeometryResults(nonFinite, 2))
            .toThrow('Invalid intensive geometry result at index 0');

        const outOfRange = valid.map(item => ({ ...item }));
        outOfRange[0].shapeMeasure = 100.01;
        expect(() => validateIntensiveGeometryResults(outOfRange, 2))
            .toThrow('Invalid intensive geometry result at index 0');

        const duplicate = valid.map(item => ({ ...item }));
        duplicate[1].name = duplicate[0].name;
        expect(() => validateIntensiveGeometryResults(duplicate, 2))
            .toThrow('Duplicate intensive geometry result');

        const wrongSet = valid.map(item => ({ ...item }));
        wrongSet[0].name = 'NOT-A-CN2-REFERENCE';
        expect(() => validateIntensiveGeometryResults(wrongSet, 2))
            .toThrow('Intensive geometry set mismatch');

        expect(validateIntensiveGeometryResults(valid, 2))
            .toHaveLength(Object.keys(REFERENCE_GEOMETRIES[2]).length);
    });

    test('uses the same greater-than-0.1 angstrom sphere rule as standard mode', async () => {
        buildGeneralGeometry.mockResolvedValue(validCn2Results());
        const withNearDuplicate = [
            ...atoms,
            { element: 'H', x: 0.05, y: 0, z: 0 }
        ];
        const result = await runIntensiveAnalysisAsync(withNearDuplicate, 0, 2);
        expect(result.metadata.coordinationNumber).toBe(2);
        expect(buildGeneralGeometry.mock.calls[0][0]).toHaveLength(2);
    });
});

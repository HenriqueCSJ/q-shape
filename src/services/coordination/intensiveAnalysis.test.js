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
    describeIntensiveSearchProfile,
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
            hasMultipleLargeRings: false,
            candidateRingSizeLabels: []
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

    test('requires the exact reference set and normalizes unavailable rows', () => {
        const valid = validCn2Results();
        const nonFinite = valid.map(item => ({ ...item }));
        nonFinite[0].shapeMeasure = Number.NaN;
        expect(validateIntensiveGeometryResults(nonFinite, 2)[0]).toMatchObject({
            name: nonFinite[1].name,
            status: 'available'
        });
        expect(validateIntensiveGeometryResults(nonFinite, 2).at(-1)).toMatchObject({
            name: nonFinite[0].name,
            status: 'invalid'
        });

        const outOfRange = valid.map(item => ({ ...item }));
        outOfRange[0].shapeMeasure = 100.01;
        expect(validateIntensiveGeometryResults(outOfRange, 2).at(-1)).toMatchObject({
            name: outOfRange[0].name,
            status: 'invalid'
        });

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

    test('retains an explicit per-geometry failure and chooses the best finite result', async () => {
        const partial = validCn2Results();
        partial[0] = {
            ...partial[0],
            shapeMeasure: null,
            status: 'error',
            error: 'synthetic target failure'
        };
        buildGeneralGeometry.mockResolvedValue(partial);

        const result = await runIntensiveAnalysisAsync(atoms, 0, 2);

        expect(result.geometryResults).toHaveLength(partial.length);
        expect(result.geometryResults.at(-1)).toMatchObject({
            name: partial[0].name,
            status: 'error',
            error: 'synthetic target failure'
        });
        expect(result.metadata).toMatchObject({
            bestGeometry: partial[1].name,
            bestCShM: partial[1].shapeMeasure,
            availableGeometryCount: partial.length - 1,
            unavailableGeometryCount: 1,
            analysisComplete: false
        });
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
        expect(buildGeneralGeometry).toHaveBeenCalledWith(
            expect.any(Array),
            2,
            'intensive',
            expect.any(Function)
        );
        expect(result.metadata).toMatchObject({
            searchProfile: 'extended-bounded',
            expandedSearchBudget: true
        });
    });
});

describe('intensive search-profile communication', () => {
    test.each([5, 6, 7])('explains that CN %i uses the same exact solver in both modes', (cn) => {
        expect(describeIntensiveSearchProfile(cn)).toMatchObject({
            id: 'exact-permutation',
            expandedSearchBudget: false,
            message: expect.stringMatching(/same exact solver.*identical CShM values are expected/i)
        });
    });

    test.each([8, 9, 10, 11, 12])('explains the shared early anchor stage for CN %i', (cn) => {
        expect(describeIntensiveSearchProfile(cn)).toMatchObject({
            id: 'anchor-plus-extended-bounded',
            expandedSearchBudget: true,
            message: expect.stringMatching(/finish before the extra stages and match Standard/i)
        });
    });

    test.each([2, 3, 4, 20])('identifies an expanded bounded-search budget for CN %i', (cn) => {
        expect(describeIntensiveSearchProfile(cn)).toMatchObject({
            id: 'extended-bounded',
            expandedSearchBudget: true,
            message: expect.stringMatching(/lower CShM is possible but not guaranteed/i)
        });
    });
});

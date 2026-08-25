import {
    calculateGeometryResult,
    intensiveResultsMatchInput,
    makeShapeAnalysisCacheKey
} from './useShapeAnalysis';
import {
    isShapeResultAvailable,
    summarizeGeometryResults
} from '../utils/shapeResults';

function entry(idx, element, x, y, z) {
    return {
        idx,
        atom: { element },
        distance: Math.hypot(x, y, z),
        vec: { x, y, z }
    };
}

describe('shape-analysis cache identity', () => {
    const linear = [
        entry(1, 'N', 1, 0, 0),
        entry(2, 'N', -1, 0, 0)
    ];
    const bent = [
        entry(1, 'N', 1, 0, 0),
        entry(2, 'N', 0, 1, 0)
    ];

    test('distinguishes equal radial shells with different angles', () => {
        expect(linear.map(item => item.distance)).toEqual(bent.map(item => item.distance));
        expect(linear.map(item => item.atom.element)).toEqual(bent.map(item => item.atom.element));
        expect(makeShapeAnalysisCacheKey(linear, 'default'))
            .not.toBe(makeShapeAnalysisCacheKey(bent, 'default'));
    });

    test('is stable for cloned identical coordinates and binds the mode', () => {
        const clone = linear.map(item => ({
            ...item,
            atom: { ...item.atom },
            vec: { ...item.vec }
        }));
        expect(makeShapeAnalysisCacheKey(clone, 'default'))
            .toBe(makeShapeAnalysisCacheKey(linear, 'default'));
        expect(makeShapeAnalysisCacheKey(clone, 'intensive'))
            .not.toBe(makeShapeAnalysisCacheKey(linear, 'default'));
    });

    test('accepts intensive results only for the exact originating sphere', () => {
        const params = {
            mode: 'intensive',
            intensiveResults: [{ name: 'L-2', shapeMeasure: 0 }],
            intensiveInputKey: makeShapeAnalysisCacheKey(linear, 'intensive')
        };
        expect(intensiveResultsMatchInput(params, linear)).toBe(true);
        expect(intensiveResultsMatchInput(params, bent)).toBe(false);
        expect(intensiveResultsMatchInput({ ...params, intensiveResults: [] }, linear)).toBe(false);
    });
});

describe('fail-closed per-target result handling', () => {
    const params = {
        name: 'T-4',
        actualCoords: [[1, 0, 0], [0, 1, 0]],
        refCoords: [[1, 0, 0], [0, 1, 0]],
        mode: 'default'
    };

    test('retains a target that returns Infinity as an explicit N/A row', () => {
        const result = calculateGeometryResult({
            ...params,
            calculator: () => ({
                measure: Infinity,
                alignedCoords: [[1, 0, 0]],
                rotationMatrix: {}
            })
        });

        expect(result.name).toBe('T-4');
        expect(result.shapeMeasure).toBe(Infinity);
        expect(result.status).toBe('invalid');
        expect(isShapeResultAvailable(result)).toBe(false);
        expect(result.error).toMatch(/unavailable/);
    });

    test('retains a target that throws as an explicit error row', () => {
        const result = calculateGeometryResult({
            ...params,
            calculator: () => {
                throw new Error('synthetic Kabsch failure');
            }
        });

        expect(result).toMatchObject({
            name: 'T-4',
            shapeMeasure: null,
            status: 'error',
            alignedCoords: [],
            rotationMatrix: null
        });
        expect(result.error).toMatch(/T-4.*synthetic Kabsch failure/);
    });

    test('sorts finite results first, chooses best only from them, and marks the set incomplete', () => {
        const summary = summarizeGeometryResults([
            { name: 'failed', shapeMeasure: NaN, status: 'error', error: 'failed' },
            { name: 'valid-high', shapeMeasure: 4.2 },
            { name: 'invalid-domain', shapeMeasure: 101 },
            { name: 'valid-low', shapeMeasure: 0.7 }
        ]);

        expect(summary.results.map(result => result.name)).toEqual([
            'valid-low',
            'valid-high',
            'failed',
            'invalid-domain'
        ]);
        expect(summary.best.name).toBe('valid-low');
        expect(summary.availableResults).toHaveLength(2);
        expect(summary.unavailableResults).toHaveLength(2);
        expect(summary.isComplete).toBe(false);
    });
});

import {
    intensiveResultsMatchInput,
    makeShapeAnalysisCacheKey
} from './useShapeAnalysis';

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

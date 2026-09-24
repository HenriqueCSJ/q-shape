import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Matrix4, Vector3 } from 'three';
import { SHAPE_COMPARISON_CONVENTION } from '../constants/shapeComparison';
import useShapeAnalysis, {
    calculateGeometryResult,
    intensiveResultsMatchInput,
    makeShapeAnalysisCacheKey
} from './useShapeAnalysis';
import {
    isShapeResultAvailable,
    isShapeResultRecord,
    summarizeGeometryResults
} from '../utils/shapeResults';
import calculateShapeMeasure from '../services/shapeAnalysis/shapeCalculator';

jest.mock('../services/shapeAnalysis/shapeCalculator', () => ({
    __esModule: true,
    default: jest.fn()
}));

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

    test('cache identity binds the comparison convention and rejects a historical input key', () => {
        const key = makeShapeAnalysisCacheKey(linear, 'intensive');
        const parts = JSON.parse(key);
        expect(parts[0]).toBe(SHAPE_COMPARISON_CONVENTION);
        const historicalKey = JSON.stringify(parts.slice(1));
        expect(intensiveResultsMatchInput({ intensiveResults: [{ shapeMeasure: 1 }], intensiveInputKey: historicalKey }, linear)).toBe(false);
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

    test('the live adapter retains the full reflected result tuple and unchanged reference', () => {
        const transform = new Matrix4().makeScale(-1, 1, 1);
        const calculation = { measure: 0.123456789012345, transformationMatrix: transform, rotationMatrix: transform,
            comparisonConvention: SHAPE_COMPARISON_CONVENTION, alignmentParity: -1,
            matching: [[0, 1], [1, 0]], branchScores: { proper: 2, reflected: 0.123456789012345 }, alignedCoords: [[0, 1, 0], [-1, 0, 0]] };
        const output = calculateGeometryResult({ ...params, calculator: () => calculation });
        expect(output).toMatchObject({ comparisonConvention: SHAPE_COMPARISON_CONVENTION, alignmentParity: -1,
            matching: calculation.matching, branchScores: calculation.branchScores, alignedCoords: calculation.alignedCoords });
        expect(output.transformationMatrix.toArray()).toEqual(transform.toArray());
        expect(output.rotationMatrix).toBe(output.transformationMatrix);
        expect(output.refCoords).toBe(params.refCoords);
        expect(output.shapeMeasure).toBe(calculation.measure);
    });

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

    test('distinguishes explicit unavailable rows from malformed result objects', () => {
        expect(isShapeResultRecord({ name: 'valid', shapeMeasure: 0.5 })).toBe(true);
        expect(isShapeResultRecord({
            name: 'failed',
            shapeMeasure: null,
            status: 'error',
            error: 'synthetic failure'
        })).toBe(true);
        expect(isShapeResultRecord({ name: 'silent-failure', shapeMeasure: NaN })).toBe(false);
    });
});

describe('selected-sphere result freshness', () => {
    let container;
    let root;
    let renders;

    function Harness(props) {
        const result = useShapeAnalysis(props);
        // Capture every render, including the one before passive effects run.
        renders.push(result);
        return null;
    }

    function sphere(y = 0) {
        return [entry(1, 'N', 1, 0, 0), entry(2, 'N', -1, y, 0)]
            .map(item => ({ ...item, vec: new Vector3(item.vec.x, item.vec.y, item.vec.z) }));
    }

    function render(props) {
        act(() => root.render(<Harness {...props} />));
    }

    beforeEach(() => {
        jest.useFakeTimers();
        calculateShapeMeasure.mockReset();
        calculateShapeMeasure.mockImplementation(coords => ({ measure: coords[1][1] + 1 }));
        global.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        renders = [];
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        jest.useRealTimers();
        delete global.IS_REACT_ACT_ENVIRONMENT;
    });

    test('hides previous results immediately when the sphere changes, until its calculation finishes', () => {
        const analysisParams = { mode: 'default', key: 0 };
        render({ coordAtoms: sphere(), analysisParams });
        act(() => jest.runAllTimers());
        expect(renders[renders.length - 1].bestGeometry.shapeMeasure).toBe(1);

        renders = [];
        render({ coordAtoms: sphere(0.5), analysisParams });
        expect(renders.every(result => result.geometryResults.length === 0 && result.bestGeometry === null)).toBe(true);
        expect(renders[0].additionalMetrics).toBeNull();
        expect(renders[renders.length - 1].isLoading).toBe(true);

        act(() => jest.runAllTimers());
        expect(renders[renders.length - 1].bestGeometry.shapeMeasure).toBe(1.5);
    });

    test('does not expose standard results while recalculating in intensive mode', () => {
        const coordAtoms = sphere();
        render({ coordAtoms, analysisParams: { mode: 'default', key: 0 } });
        act(() => jest.runAllTimers());
        expect(renders[renders.length - 1].analysisComplete).toBe(true);

        renders = [];
        render({ coordAtoms, analysisParams: { mode: 'intensive', key: 1 } });
        expect(renders.every(result => result.geometryResults.length === 0)).toBe(true);
        act(() => jest.runAllTimers());
        expect(calculateShapeMeasure.mock.calls.at(-1)[2]).toBe('intensive');
    });

    test('disabled analysis starts no calculation and cancels pending work', () => {
        const props = { coordAtoms: sphere(), analysisParams: { mode: 'default', key: 0 } };
        render({ ...props, enabled: false });
        act(() => jest.runAllTimers());
        expect(calculateShapeMeasure).not.toHaveBeenCalled();
        expect(renders[renders.length - 1]).toMatchObject({
            geometryResults: [], bestGeometry: null, additionalMetrics: null,
            analysisComplete: false, isLoading: false, progress: null
        });

        render({ ...props, enabled: true });
        expect(renders[renders.length - 1].isLoading).toBe(true);
        render({ ...props, enabled: false });
        act(() => jest.runAllTimers());
        expect(calculateShapeMeasure).not.toHaveBeenCalled();

        render({ ...props, enabled: true });
        act(() => jest.runAllTimers());
        expect(renders[renders.length - 1].analysisComplete).toBe(true);
        renders = [];
        render({ ...props, enabled: false });
        expect(renders.every(result => result.geometryResults.length === 0 && !result.isLoading)).toBe(true);
    });
});

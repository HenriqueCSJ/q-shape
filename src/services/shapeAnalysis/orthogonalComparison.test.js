import * as THREE from 'three';
import calculateShapeMeasure, { calculateProperShapeMeasure } from './shapeCalculator';
import { runOrthogonalComparison } from './orthogonalComparison';
import kabschAlignment from '../algorithms/kabsch';
import witness from './orientationWitness.fixture.json';

const asymmetric = [[1.1, 0.2, 0.3], [-0.4, 1.7, 0.1], [0.2, -0.1, 2.3], [-1.3, -0.8, 0.7], [0.6, -1.2, -0.9]];
const reflect = points => points.map(([x, y, z]) => [-x, y, z]);
const normalize = points => {
    const center = [0, 1, 2].map(k => points.reduce((s, p) => s + p[k], 0) / points.length);
    const centered = points.map(p => p.map((v, k) => v - center[k]));
    const rms = Math.sqrt(centered.reduce((s, p) => s + p.reduce((t, v) => t + v * v, 0), 0) / points.length);
    return centered.map(p => new THREE.Vector3(...p.map(v => v / rms)));
};
const residual = (actual, target, matrix) => {
    const aligned = actual.map(p => p.clone().applyMatrix4(matrix));
    const scale = Math.max(0, aligned.reduce((s, p, i) => s + p.dot(target[i]), 0) / actual.length);
    return 100 * aligned.reduce((s, p, i) => s + p.clone().sub(target[i].clone().multiplyScalar(scale)).lengthSq(), 0) / actual.length;
};

describe('Enantiomer-insensitive comparison contract', () => {
    test.each([1, -1])('asymmetric fixed-center mirror control composes parity %s', parity => {
        const input = parity === 1 ? asymmetric : reflect(asymmetric);
        const target = [...asymmetric, [0, 0, 0]];
        const originalInput = JSON.stringify(input), originalTarget = JSON.stringify(target);
        const proper = calculateProperShapeMeasure(input, target);
        const result = calculateShapeMeasure(input, target);
        expect(result.measure).toBeLessThan(1e-10);
        expect(result.branchScores.proper).toBe(proper.measure);
        expect(result.measure).toBeLessThanOrEqual(proper.measure);
        expect(result.alignmentParity).toBe(parity);
        expect(result.comparisonConvention).toBe('cshm-o3-v1');
        expect(result.rotationMatrix).toBe(result.transformationMatrix);
        expect(result.transformationMatrix.determinant()).toBeCloseTo(parity, 10);
        expect(result.properRotationMatrix.determinant()).toBeCloseTo(1, 10);
        expect(proper.rotationMatrix.determinant()).toBeCloseTo(1, 10);
        if (parity === -1) expect(proper.measure).toBeGreaterThan(0.001);
        expect(JSON.stringify(input)).toBe(originalInput);
        expect(JSON.stringify(target)).toBe(originalTarget);
        expect(result.matching).toContainEqual([5, 5]);
        const normalized = normalize([...input, [0, 0, 0]]);
        // The normalized center is deliberately nonzero in this control.
        expect(normalized[5].length()).toBeGreaterThan(0.1);
        for (const [i, j] of result.matching) {
            const aligned = normalized[i].clone().applyMatrix4(result.transformationMatrix);
            expect(aligned.distanceTo(new THREE.Vector3(...result.alignedCoords[j]))).toBeLessThan(1e-12);
        }
        const orderedReference = result.matching.map(([, j]) => normalize(target)[j]);
        const orderedActual = result.matching.map(([i]) => normalized[i]);
        expect(residual(orderedActual, orderedReference, result.transformationMatrix)).toBeLessThan(1e-10);
        expect(calculateShapeMeasure(input, target).measure).toBe(result.measure);
    });

    test('achiral control completes both branches and selects the proper exact tie', () => {
        const actual = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
        const diagnostics = [], progress = [];
        const result = calculateShapeMeasure(actual, [...actual, [0, 0, 0]], 'default', p => progress.push(p), {
            onFinalization: d => diagnostics.push(d)
        });
        expect(result.branchScores).toEqual({ proper: 0, reflected: 0 });
        expect(result.alignmentParity).toBe(1);
        expect(diagnostics.map(d => d.branch)).toEqual(['proper', 'reflected']);
        expect(Object.keys(result.branchFinalizations)).toEqual(['proper', 'reflected']);
        expect(progress[progress.length - 1].percentage).toBe(100);
        expect(progress.every((p, i) => !i || p.percentage >= progress[i - 1].percentage)).toBe(true);
    });

    test('independent SHAPE fixed-correspondence reflection witness agrees with proper Kabsch', () => {
        const actual = witness.actual.map(p => p.map(Number));
        const reference = normalize(witness.reference.map(p => p.map(Number)));
        const target = witness.pairing.map(i => reference[i]);
        for (const mirrored of [false, true]) {
            const p = normalize([...(mirrored ? reflect(actual) : actual), [0, 0, 0]]);
            const rotation = kabschAlignment(p.map(v => v.toArray()), target.map(v => v.toArray()), true);
            expect(rotation.determinant()).toBeCloseTo(1, 10);
            expect(residual(p, target, rotation)).toBeCloseTo(mirrored ? witness.reflectedWitness : witness.properSamePairing, 10);
        }
    });
});

describe('Required parity branches and random-stream isolation', () => {
    const points = [[1, 0, 0], [0, 1, 0]];
    const valid = () => ({ measure: 0, rotationMatrix: new THREE.Matrix4(), matching: [[0, 0], [1, 1]] });

    test.each([0, 1])('retains branch %s failure and still attempts both required branches', failedIndex => {
        let calls = 0;
        const solver = () => {
            if (calls++ === failedIndex) throw new Error('deliberate branch failure');
            return valid();
        };
        let error;
        try { runOrthogonalComparison(solver, points, points, 'default', null); } catch (e) { error = e; }
        expect(calls).toBe(2);
        expect(error.message).toContain('deliberate branch failure');
        expect(Object.keys(error.branchErrors)).toEqual([failedIndex ? 'reflected' : 'proper']);
        expect(Object.values(error.branchScores)).toEqual([0]);
    });

    test('does not accept an improper internal rotation as a proper branch', () => {
        const solver = jest.fn(() => ({ ...valid(), rotationMatrix: new THREE.Matrix4().makeScale(-1, 1, 1) }));
        expect(() => runOrthogonalComparison(solver, points, points, 'default', null)).toThrow('Invalid orthogonal');
        expect(solver).toHaveBeenCalledTimes(2);
    });

    test('rejects the inherited numerical normalization floor explicitly', () => {
        const tiny = points.map(p => p.map(v => v * 1e-12));
        expect(() => runOrthogonalComparison(valid, tiny, tiny, 'default', null)).toThrow('RMS spatial extent >= 1e-10');
    });

    test('replays an explicit RNG independently from draw zero without perturbing the proper sequence', () => {
        let calls = 0, state = 0;
        const seen = [];
        const rng = jest.fn(() => ++state / 10);
        const solver = (actual, reference, mode, callback, options) => {
            seen.push(Array.from({ length: calls++ ? 5 : 3 }, () => options.rng()));
            return valid();
        };
        const result = runOrthogonalComparison(solver, points, points, 'default', null, { rng });
        expect(seen).toEqual([[0.1, 0.2, 0.3], [0.1, 0.2, 0.3, 0.4, 0.5]]);
        expect(rng).toHaveBeenCalledTimes(5);
        expect(result.alignmentParity).toBe(1);
    });
});

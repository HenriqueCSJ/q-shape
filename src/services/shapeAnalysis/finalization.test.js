import * as THREE from 'three';
import calculateShapeMeasure, { finalizeBoundedCandidate } from './shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

const matching = [[0, 0], [1, 1], [2, 2]];
const candidate = () => ({ measure: 12, matching, rotation: new THREE.Matrix4() });

describe('Bounded-search finalization contract', () => {
    test.each([12, 13])('keeps the entire valid fallback when polish returns %s', measure => {
        const original = candidate();
        const output = finalizeBoundedCandidate(original, () => ({
            measure, matching: [[0, 1], [1, 0], [2, 2]],
            rotation: new THREE.Matrix4().makeRotationZ(0.2), steps: 1,
            stopReason: 'improvement_tolerance'
        }), 3, true);
        expect(output.measure).toBe(original.measure);
        expect(output.matching).toBe(original.matching);
        expect(output.rotation).toBe(original.rotation);
        expect(output.finalization.improved).toBe(false);
    });

    test('retains a strictly better score together with its matching and proper rotation', () => {
        const improved = { measure: 10, matching: [[0, 1], [1, 0], [2, 2]],
            rotation: new THREE.Matrix4().makeRotationY(0.3), steps: 2, stopReason: 'repeated_assignment' };
        const output = finalizeBoundedCandidate(candidate(), () => improved, 3, true);
        expect(output.measure).toBe(10);
        expect(output.matching).toBe(improved.matching);
        expect(output.rotation).toBe(improved.rotation);
        expect(output.finalization.assignmentChanged).toBe(true);
        expect(output.finalization.steps).toBeLessThanOrEqual(10);
    });

    test.each([
        { measure: NaN },
        { matching: [[0, 0], [1, 0], [2, 2]] },
        { matching: [[0, 2], [1, 1], [2, 0]] },
        { rotation: new THREE.Matrix4().makeScale(-1, 1, 1) },
        { rotation: new THREE.Matrix4().makeScale(2, 0.5, 1) }
    ])('does not disguise invalid refinement output as a successful target', invalid => {
        expect(() => finalizeBoundedCandidate(candidate(), () => ({ ...candidate(), ...invalid }), 3, true)).toThrow();
    });

    test('propagates a refinement solver failure', () => {
        expect(() => finalizeBoundedCandidate(candidate(), () => { throw new Error('refinement failed'); }, 3, true))
            .toThrow('refinement failed');
    });

    test.each([[2, 'default'], [8, 'default'], [2, 'intensive'], [8, 'intensive']])(
        'CN%s %s keeps a consistent non-worsening result', (cn, mode) => {
            const reference = Object.values(REFERENCE_GEOMETRIES[cn])[0];
            const center = reference[cn];
            const actual = reference.slice(0, cn).map((p, i) => p.map((v, k) =>
                v - center[k] + 0.09 * Math.sin((i + 1) * (k + 1))));
            let diagnostics;
            const result = calculateShapeMeasure(actual, reference, mode, null, {
                onFinalization: value => { diagnostics = value; }
            });
            expect(diagnostics.afterMeasure).toBeLessThanOrEqual(diagnostics.beforeMeasure);
            expect(diagnostics.steps).toBeLessThanOrEqual(10);
            expect(result.rotationMatrix.determinant()).toBeCloseTo(1, 10);
            expect(result.alignedCoords).toHaveLength(cn + 1);
            const mean = [0, 1, 2].map(k => reference.reduce((s, p) => s + p[k], 0) / reference.length);
            const centered = reference.map(p => p.map((v, k) => v - mean[k]));
            const rms = Math.sqrt(centered.reduce((s, p) => s + p.reduce((a, v) => a + v * v, 0), 0) / centered.length);
            const normalized = centered.map(p => p.map(v => v / rms));
            const overlap = result.alignedCoords.reduce((s, p, i) => s + p.reduce((a, v, k) => a + v * normalized[i][k], 0), 0) / normalized.length;
            const scale = Math.max(0, overlap);
            const residual = 100 * result.alignedCoords.reduce((s, p, i) => s + p.reduce((a, v, k) => a + (v - scale * normalized[i][k]) ** 2, 0), 0) / normalized.length;
            expect(Math.abs(residual - result.measure)).toBeLessThanOrEqual(1e-9);
        }
    );
});

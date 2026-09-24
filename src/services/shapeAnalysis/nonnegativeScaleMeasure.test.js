import * as THREE from 'three';
import calculateShapeMeasure, { nonnegativeScaleMeasure } from './shapeCalculator';
import hungarianAlgorithm from '../algorithms/hungarian';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

function normalize(points) {
    const vectors = points.map(point => new THREE.Vector3(...point));
    const center = vectors.reduce((sum, point) => sum.add(point), new THREE.Vector3())
        .divideScalar(vectors.length);
    const centered = vectors.map(point => point.clone().sub(center));
    const rms = Math.sqrt(centered.reduce((sum, point) => sum + point.lengthSq(), 0) / points.length);
    return centered.map(point => point.divideScalar(rms));
}

function residual(actual, reference, scale) {
    return 100 * actual.reduce((sum, point, index) => sum + point.clone()
        .sub(reference[index].clone().multiplyScalar(scale)).lengthSq(), 0) / actual.length;
}

describe('Nonnegative scale objective', () => {
    test('the visited CN2 negative-overlap orientation minimizes at zero scale', () => {
        const actual = normalize([[1, 1, 0], [2, 2, 0], [0, 0, 0]])
            .map(point => point.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI)));
        const reference = normalize([[1, -0.5, 0], [-0.5, 1, 0], [-0.5, -0.5, 0]]);
        const matching = hungarianAlgorithm(actual.slice(0, 2).map(point =>
            reference.slice(0, 2).map(target => -point.dot(target))));
        matching.push([2, 2]);
        const orderedReference = matching.map(([, index]) => reference[index]);
        const overlap = matching.reduce((sum, [i, j]) => sum + actual[i].dot(reference[j]), 0) / 3;
        expect(overlap).toBeCloseTo(-Math.sqrt(3) / 4, 14);
        expect(100 * (1 - overlap * overlap)).toBeCloseTo(81.25, 12);
        const score = nonnegativeScaleMeasure(overlap);
        expect(score).toBe(100);
        expect(residual(actual, orderedReference, 0)).toBeCloseTo(score, 12);
        // An independent direct residual scan over admissible scales includes
        // the optimum and verifies that positive scaling only increases it.
        for (let index = 1; index <= 100; index++) {
            expect(residual(actual, orderedReference, index / 25)).toBeGreaterThan(score);
        }
    });

    test.each([[-1, 100], [0, 100], [0.5, 75], [1, 0], [1 + Number.EPSILON, 0]])(
        'overlap %s has score %s', (overlap, expected) => {
            expect(nonnegativeScaleMeasure(overlap)).toBe(expected);
        }
    );

    test.each([NaN, Infinity, -Infinity])('rejects nonfinite overlap %s', overlap => {
        expect(() => nonnegativeScaleMeasure(overlap)).toThrow('Normalized overlap must be finite');
    });

    test.each([2, 5, 8])('CN%s returned score agrees with its aligned residual', cn => {
        const referenceCoords = Object.values(REFERENCE_GEOMETRIES[cn])[0];
        const referenceCenter = new THREE.Vector3(...referenceCoords[cn]);
        const actual = referenceCoords.slice(0, cn).map((point, index) =>
            new THREE.Vector3(...point).sub(referenceCenter)
                .add(new THREE.Vector3(0.08 * Math.sin(index + 1), 0.05 * Math.cos(index + 2), 0.04 * Math.sin(index + 3)))
                .toArray());
        const result = calculateShapeMeasure(actual, referenceCoords);
        const aligned = result.alignedCoords.map(point => new THREE.Vector3(...point));
        const reference = normalize(referenceCoords);
        const numerator = aligned.reduce((sum, point, index) => sum + point.dot(reference[index]), 0);
        const denominator = reference.reduce((sum, point) => sum + point.lengthSq(), 0);
        const scale = Math.max(0, numerator / denominator);
        expect(residual(aligned, reference, scale)).toBeCloseTo(result.measure, 10);
    });
});

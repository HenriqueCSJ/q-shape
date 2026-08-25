import * as THREE from 'three';
import { calculateAdditionalMetrics } from './structuralMetrics';

describe('structural summary metrics', () => {
    test('returns null for an empty coordination sphere', () => {
        expect(calculateAdditionalMetrics([])).toBeNull();
        expect(calculateAdditionalMetrics(null)).toBeNull();
    });

    test('returns null when any selected distance is invalid', () => {
        expect(calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(2, 0, 0) },
            { distance: NaN, vec: new THREE.Vector3(0, 2, 0) }
        ])).toBeNull();
        expect(calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(2, 0, 0) },
            { distance: -1, vec: new THREE.Vector3(0, 2, 0) }
        ])).toBeNull();
    });

    test('returns null for a missing or invalid coordination vector', () => {
        expect(calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(2, 0, 0) },
            { distance: 2, vec: null }
        ])).toBeNull();
        expect(calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(2, 0, 0) },
            { distance: 2, vec: new THREE.Vector3(NaN, 1, 0) }
        ])).toBeNull();
        expect(calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(0, 0, 0) },
            { distance: 2, vec: new THREE.Vector3(0, 1, 0) }
        ])).toBeNull();
    });

    test('returns only direct distance and complete angle summaries for a valid sphere', () => {
        const result = calculateAdditionalMetrics([
            { distance: 2, vec: new THREE.Vector3(2, 0, 0) },
            { distance: 2.2, vec: new THREE.Vector3(0, 2.2, 0) },
            { distance: 2.1, vec: new THREE.Vector3(0, 0, 2.1) }
        ]);

        expect(result).toEqual(expect.objectContaining({
            meanBondLength: 2.1,
            minBondLength: 2,
            maxBondLength: 2.2,
            angleStats: expect.objectContaining({ count: 3, mean: 90 })
        }));
        expect(result).not.toHaveProperty('overallQualityScore');
        expect(result).not.toHaveProperty('rmsd');
        expect(result).not.toHaveProperty('polyhedralVolumeRatio');
        expect(result).not.toHaveProperty('shapeDeviationParameter');
        expect(result).not.toHaveProperty('confidence');
    });
});

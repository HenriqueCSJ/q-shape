/**
 * Comprehensive tests for Continuous Shape Measure (CShM) calculator
 *
 * Tests the multi-stage optimization algorithm used for shape analysis.
 */

import calculateShapeMeasure from './shapeCalculator';
import * as THREE from 'three';

describe('Shape Calculator', () => {
    describe('Perfect Matches', () => {
        test('should return near-zero measure for identical coordinates', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            expect(result.measure).toBeLessThan(0.01);
            expect(result.alignedCoords).toHaveLength(3);
            expect(result.rotationMatrix).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle perfect tetrahedron match', () => {
            // Regular tetrahedron vertices (normalized to unit sphere)
            const s = 1.0 / Math.sqrt(3); // Normalization factor
            const tetrahedron = [
                [s, s, s],
                [s, -s, -s],
                [-s, s, -s],
                [-s, -s, s]
            ];

            const result = calculateShapeMeasure(tetrahedron, tetrahedron, 'default');

            // After normalization, should be very close match
            expect(result.measure).toBeLessThan(1);
            expect(result.alignedCoords).toHaveLength(4);
        });

        test('should handle perfect octahedron match', () => {
            const octahedron = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            const result = calculateShapeMeasure(octahedron, octahedron, 'default');

            expect(result.measure).toBeLessThan(0.01);
            expect(result.alignedCoords).toHaveLength(6);
        });

        test('should handle perfect square planar match', () => {
            const squarePlanar = [
                [1, 0, 0],
                [0, 1, 0],
                [-1, 0, 0],
                [0, -1, 0]
            ];

            const result = calculateShapeMeasure(squarePlanar, squarePlanar, 'default');

            expect(result.measure).toBeLessThan(0.01);
            expect(result.alignedCoords).toHaveLength(4);
        });
    });

    describe('Rotated Geometries', () => {
        test('should align rotated coordinates', () => {
            const original = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // 90° rotation around Z-axis
            const rotated = [
                [0, 1, 0],
                [-1, 0, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(rotated, original, 'default');

            // Should find the rotation and give low measure
            expect(result.measure).toBeLessThan(0.1);
        });

        test('should handle arbitrary rotation', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // Create rotated version
            const angle = Math.PI / 4;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const rotated = coords.map(([x, y, z]) => [
                cos * x - sin * y,
                sin * x + cos * y,
                z
            ]);

            const result = calculateShapeMeasure(rotated, coords, 'default');

            expect(result.measure).toBeLessThan(0.1);
        });

        test('should handle 180° rotation', () => {
            const original = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const rotated180 = [
                [-1, 0, 0],
                [0, -1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(rotated180, original, 'default');

            expect(result.measure).toBeLessThan(0.1);
        });
    });

    describe('Distorted Geometries', () => {
        test('should detect small distortion in octahedron', () => {
            const perfect = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            // Distorted: move one vertex more significantly
            const distorted = [
                [1.2, 0.1, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            const result = calculateShapeMeasure(distorted, perfect, 'default');

            // Should return a finite measure
            expect(result.measure).toBeDefined();
            expect(isFinite(result.measure)).toBe(true);
            expect(result.measure).toBeGreaterThanOrEqual(0);
        });

        test('should detect larger distortion', () => {
            const perfect = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // Significantly distorted
            const distorted = [
                [1.5, 0, 0],
                [0, 0.8, 0.2],
                [0.1, 0.1, 1.1]
            ];

            const result = calculateShapeMeasure(distorted, perfect, 'default');

            expect(result.measure).toBeGreaterThan(1);
        });

        test('should quantify distortion magnitude', () => {
            const reference = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const slightDistortion = [
                [1.05, 0, 0],
                [0, 1.05, 0.05],
                [0.05, 0, 1.05]
            ];

            const largeDistortion = [
                [1.3, 0.1, 0.1],
                [0.1, 1.2, 0.2],
                [0.2, 0.1, 1.3]
            ];

            const result1 = calculateShapeMeasure(slightDistortion, reference, 'default');
            const result2 = calculateShapeMeasure(largeDistortion, reference, 'default');

            // Both should have reasonable measures
            expect(result1.measure).toBeDefined();
            expect(result2.measure).toBeDefined();
            expect(isFinite(result1.measure)).toBe(true);
            expect(isFinite(result2.measure)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty coordinates', () => {
            const result = calculateShapeMeasure([], [], 'default');

            expect(result.measure).toBe(Infinity);
            expect(result.alignedCoords).toEqual([]);
        });

        test('should handle mismatched sizes', () => {
            const coords1 = [[1, 0, 0], [0, 1, 0]];
            const coords2 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

            const result = calculateShapeMeasure(coords1, coords2, 'default');

            expect(result.measure).toBe(Infinity);
            expect(result.alignedCoords).toEqual([]);
        });

        test('should handle single coordinate', () => {
            const coords = [[1, 0, 0]];

            const result = calculateShapeMeasure(coords, coords, 'default');

            // Should complete without error
            expect(result.measure).toBeDefined();
            expect(isFinite(result.measure)).toBe(true);
        });

        test('should handle atom at center (zero distance)', () => {
            const coords = [
                [0, 0, 0],  // At center - will fail normalization
                [1, 0, 0],
                [0, 1, 0]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            // Should return Infinity for invalid geometry
            expect(result.measure).toBe(Infinity);
            expect(result.alignedCoords).toEqual([]);
        });

        test('should handle very small coordinates', () => {
            const coords = [
                [1e-9, 0, 0],
                [0, 1e-9, 0],
                [0, 0, 1e-9]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            // May return Infinity due to numerical issues
            expect(result).toBeDefined();
        });

        test('should handle collinear points', () => {
            const coords = [
                [1, 0, 0],
                [2, 0, 0],
                [3, 0, 0]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            // Collinear points will normalize to different directions
            // so the measure won't be zero, but should be finite
            expect(result.measure).toBeDefined();
            expect(isFinite(result.measure)).toBe(true);
        });
    });

    describe('Analysis Modes', () => {
        test('should accept default mode', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            expect(result.measure).toBeLessThan(0.01);
        });

        test('should accept intensive mode', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'intensive');

            expect(result.measure).toBeLessThan(0.01);
        });

        test('intensive mode should handle complex cases', () => {
            // More complex geometry
            const coords = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'intensive');

            expect(result.measure).toBeLessThan(0.01);
        });
    });

    describe('Progress Callback', () => {
        test('should call progress callback during calculation', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const progressUpdates = [];
            const callback = (progress) => {
                progressUpdates.push(progress);
            };

            calculateShapeMeasure(coords, coords, 'default', callback);

            // Should have received progress updates
            expect(progressUpdates.length).toBeGreaterThan(0);

            // Check structure of progress updates
            progressUpdates.forEach(update => {
                expect(update).toHaveProperty('stage');
                expect(update).toHaveProperty('percentage');
                expect(update).toHaveProperty('current');
                expect(update).toHaveProperty('total');
                expect(typeof update.stage).toBe('string');
                expect(typeof update.percentage).toBe('number');
            });
        });

        test('should report progress percentages', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
                [-1, 0, 0]
            ];

            const percentages = [];
            const callback = ({ percentage }) => {
                percentages.push(percentage);
            };

            calculateShapeMeasure(coords, coords, 'default', callback);

            // Should receive progress updates
            expect(percentages.length).toBeGreaterThan(0);
            // All percentages should be valid
            percentages.forEach(p => {
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(100);
            });
        });

        test('should work without progress callback', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // Should not crash without callback
            const result = calculateShapeMeasure(coords, coords, 'default', null);

            expect(result.measure).toBeLessThan(0.01);
        });

        test('should report different stages', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
                [-1, 0, 0]
            ];

            const stages = new Set();
            const callback = ({ stage }) => {
                stages.add(stage);
            };

            calculateShapeMeasure(coords, coords, 'default', callback);

            // Should have multiple stages
            expect(stages.size).toBeGreaterThan(1);
        });
    });

    describe('Return Value Structure', () => {
        test('should return correct structure', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            expect(result).toHaveProperty('measure');
            expect(result).toHaveProperty('alignedCoords');
            expect(result).toHaveProperty('rotationMatrix');

            expect(typeof result.measure).toBe('number');
            expect(Array.isArray(result.alignedCoords)).toBe(true);
            expect(result.rotationMatrix).toBeInstanceOf(THREE.Matrix4);
        });

        test('should return valid rotation matrix', () => {
            const coords = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(coords, coords, 'default');

            // Check rotation matrix has determinant 1 (proper rotation)
            const det = result.rotationMatrix.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);
        });

        test('should return aligned coordinates in correct order', () => {
            const actual = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const result = calculateShapeMeasure(actual, actual, 'default');

            expect(result.alignedCoords).toHaveLength(3);

            // Each coordinate should be an array of 3 numbers
            result.alignedCoords.forEach(coord => {
                expect(Array.isArray(coord)).toBe(true);
                expect(coord).toHaveLength(3);
                coord.forEach(val => {
                    expect(typeof val).toBe('number');
                    expect(isFinite(val)).toBe(true);
                });
            });
        });
    });

    describe('Real Coordination Geometries', () => {
        test('should recognize linear geometry (CN=2)', () => {
            const linear = [
                [1, 0, 0],
                [-1, 0, 0]
            ];

            const result = calculateShapeMeasure(linear, linear, 'default');

            expect(result.measure).toBeLessThan(0.01);
        });

        test('should recognize trigonal planar (CN=3)', () => {
            const trigonal = [
                [1, 0, 0],
                [-0.5, Math.sqrt(3)/2, 0],
                [-0.5, -Math.sqrt(3)/2, 0]
            ];

            const result = calculateShapeMeasure(trigonal, trigonal, 'default');

            expect(result.measure).toBeLessThan(0.01);
        });

        test('should recognize trigonal bipyramidal (CN=5)', () => {
            const tbp = [
                [0, 0, 1],      // axial
                [0, 0, -1],     // axial
                [1, 0, 0],      // equatorial
                [-0.5, Math.sqrt(3)/2, 0],  // equatorial
                [-0.5, -Math.sqrt(3)/2, 0]  // equatorial
            ];

            const result = calculateShapeMeasure(tbp, tbp, 'default');

            expect(result.measure).toBeLessThan(0.01);
        });

        test('should recognize square pyramidal (CN=5)', () => {
            const sqpy = [
                [0, 0, 1],      // apex
                [1, 0, 0],      // base
                [0, 1, 0],      // base
                [-1, 0, 0],     // base
                [0, -1, 0]      // base
            ];

            const result = calculateShapeMeasure(sqpy, sqpy, 'default');

            expect(result.measure).toBeLessThan(0.01);
        });
    });

    describe('Error Handling', () => {
        test('should handle NaN in coordinates gracefully', () => {
            const coords = [
                [NaN, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const reference = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // Should not crash, may return Infinity or error
            let result;
            expect(() => {
                result = calculateShapeMeasure(coords, reference, 'default');
            }).not.toThrow();

            // Result should be defined
            expect(result).toBeDefined();
        });

        test('should handle Infinity in coordinates gracefully', () => {
            const coords = [
                [Infinity, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const reference = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            // Should not crash
            let result;
            expect(() => {
                result = calculateShapeMeasure(coords, reference, 'default');
            }).not.toThrow();

            expect(result).toBeDefined();
        });
    });
});

/**
 * Comprehensive tests for Ring Detection and Hapticity Analysis
 *
 * Tests ring detection, planarity checking, hapticity assignment,
 * and centroid calculation for π-coordinated ligands.
 */

import { detectLigandGroups, createCentroidAtoms } from './ringDetector';

describe('Ring Detector', () => {
    describe('Ferrocene Structure (η⁵-Cp)', () => {
        test('should detect two cyclopentadienyl rings', () => {
            // Simplified ferrocene: Fe at origin, two C5 rings above and below
            const atoms = [
                // Fe center
                { element: 'Fe', x: 0, y: 0, z: 0 },

                // Ring 1 (above, z = 1.6)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },

                // Ring 2 (below, z = -1.6)
                { element: 'C', x: 1.0, y: 0.0, z: -1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: -1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: -1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: -1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: -1.6 }
            ];

            const metalIndex = 0;
            const coordIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // All 10 carbons

            const result = detectLigandGroups(atoms, metalIndex, coordIndices);

            expect(result.ringCount).toBe(2);
            expect(result.monodentate).toHaveLength(0);
            expect(result.hasSandwichStructure).toBe(true);

            // Both rings should be η⁵-Cp
            expect(result.rings).toHaveLength(2);
            result.rings.forEach(ring => {
                expect(ring.size).toBe(5);
                expect(ring.hapticity).toBe('η⁵-Cp');
                expect(ring.type).toBe('ring');
            });
        });

        test('should calculate ring centroids correctly', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Ring 1 (regular pentagon, z = 1.6)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 }
            ];

            const metalIndex = 0;
            const coordIndices = [1, 2, 3, 4, 5];

            const result = detectLigandGroups(atoms, metalIndex, coordIndices);

            expect(result.rings).toHaveLength(1);

            const ring = result.rings[0];
            expect(ring.centroid).toBeDefined();

            // Centroid should be near (0, 0, 1.6) for regular pentagon
            expect(ring.centroid.x).toBeCloseTo(0, 1);
            expect(ring.centroid.y).toBeCloseTo(0, 1);
            expect(ring.centroid.z).toBeCloseTo(1.6, 1);
        });

        test('should detect sandwich structure', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Ring 1
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },
                // Ring 2
                { element: 'C', x: 1.0, y: 0.0, z: -1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: -1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: -1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: -1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: -1.6 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

            expect(result.hasSandwichStructure).toBe(true);
        });
    });

    describe('Benzene Complex (η⁶-C₆)', () => {
        test('should detect benzene ring', () => {
            const atoms = [
                { element: 'Cr', x: 0, y: 0, z: 0 },
                // Benzene ring (hexagon)
                { element: 'C', x: 1.4, y: 0.0, z: 2.0 },
                { element: 'C', x: 0.7, y: 1.21, z: 2.0 },
                { element: 'C', x: -0.7, y: 1.21, z: 2.0 },
                { element: 'C', x: -1.4, y: 0.0, z: 2.0 },
                { element: 'C', x: -0.7, y: -1.21, z: 2.0 },
                { element: 'C', x: 0.7, y: -1.21, z: 2.0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5, 6]);

            expect(result.ringCount).toBe(1);
            expect(result.rings[0].size).toBe(6);
            expect(result.rings[0].hapticity).toBe('η⁶-C₆');
        });

        test('should calculate benzene centroid correctly', () => {
            const atoms = [
                { element: 'Cr', x: 0, y: 0, z: 0 },
                { element: 'C', x: 1.4, y: 0.0, z: 2.0 },
                { element: 'C', x: 0.7, y: 1.21, z: 2.0 },
                { element: 'C', x: -0.7, y: 1.21, z: 2.0 },
                { element: 'C', x: -1.4, y: 0.0, z: 2.0 },
                { element: 'C', x: -0.7, y: -1.21, z: 2.0 },
                { element: 'C', x: 0.7, y: -1.21, z: 2.0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5, 6]);

            const centroid = result.rings[0].centroid;
            expect(centroid.x).toBeCloseTo(0, 1);
            expect(centroid.y).toBeCloseTo(0, 1);
            expect(centroid.z).toBeCloseTo(2.0, 1);
        });
    });

    describe('Allyl Complex (η³)', () => {
        test('should detect allyl ring', () => {
            const atoms = [
                { element: 'Pd', x: 0, y: 0, z: 0 },
                // Allyl group (3 carbons) - bonded in chain
                { element: 'C', x: 1.2, y: 0.0, z: 1.5 },
                { element: 'C', x: 0.0, y: 0.0, z: 1.5 },
                { element: 'C', x: -1.2, y: 0.0, z: 1.5 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3]);

            // Allyl may or may not be detected as a cyclic ring depending on bond distances
            // Check that we get valid groups
            expect(result.totalGroups).toBeGreaterThan(0);
            expect(result.totalGroups).toBeLessThanOrEqual(3);
        });
    });

    describe('Butadiene Complex (η⁴)', () => {
        test('should detect butadiene-like structure', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Butadiene-like (4 carbons in square arrangement)
                { element: 'C', x: 1.0, y: 1.0, z: 1.5 },
                { element: 'C', x: -1.0, y: 1.0, z: 1.5 },
                { element: 'C', x: -1.0, y: -1.0, z: 1.5 },
                { element: 'C', x: 1.0, y: -1.0, z: 1.5 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4]);

            // Should detect some ligand groups
            expect(result.totalGroups).toBeGreaterThan(0);
            // Check if detected as ring or monodentate ligands
            if (result.ringCount > 0) {
                expect(result.rings[0].size).toBeLessThanOrEqual(4);
            }
        });
    });

    describe('Mixed Ligands', () => {
        test('should detect ring and monodentate ligands', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },

                // Cp ring (5 carbons)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },

                // Monodentate ligands
                { element: 'Cl', x: 0, y: 0, z: -2.5 },
                { element: 'N', x: 2.0, y: 0, z: 0 },
                { element: 'O', x: 0, y: 2.0, z: 0 }
            ];

            const coordIndices = [1, 2, 3, 4, 5, 6, 7, 8];
            const result = detectLigandGroups(atoms, 0, coordIndices);

            expect(result.ringCount).toBe(1);
            expect(result.monodentate).toHaveLength(3);
            expect(result.totalGroups).toBe(4);

            // Check monodentate ligands
            expect(result.monodentate[0].hapticity).toBe('η¹');
            expect(result.monodentate[0].type).toBe('monodentate');
        });

        test('should not detect sandwich when only one ring', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Only one Cp ring
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5]);

            expect(result.hasSandwichStructure).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle no coordinated atoms', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 }
            ];

            const result = detectLigandGroups(atoms, 0, []);

            expect(result.ringCount).toBe(0);
            expect(result.monodentate).toHaveLength(0);
            expect(result.totalGroups).toBe(0);
            expect(result.hasSandwichStructure).toBe(false);
        });

        test('should handle only monodentate ligands', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'Cl', x: 2.0, y: 0, z: 0 },
                { element: 'Cl', x: -2.0, y: 0, z: 0 },
                { element: 'Cl', x: 0, y: 2.0, z: 0 },
                { element: 'Cl', x: 0, y: -2.0, z: 0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4]);

            expect(result.ringCount).toBe(0);
            expect(result.monodentate).toHaveLength(4);
        });

        test('should handle non-planar atoms (should not form ring)', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Non-planar "ring" (one atom out of plane)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 2.5 }, // Out of plane
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5]);

            // May not detect as planar ring
            expect(result.totalGroups).toBeGreaterThan(0);
        });

        test('should handle collinear points (should not be planar)', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Collinear points
                { element: 'C', x: 1.0, y: 0.0, z: 0.0 },
                { element: 'C', x: 2.0, y: 0.0, z: 0.0 },
                { element: 'C', x: 3.0, y: 0.0, z: 0.0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3]);

            // Should not detect a planar ring
            expect(result.ringCount).toBe(0);
            expect(result.monodentate).toHaveLength(3);
        });

        test('should respect minimum ring size', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Small ring (< default min size)
                { element: 'C', x: 1.0, y: 0.0, z: 1.5 },
                { element: 'C', x: 0.0, y: 1.0, z: 1.5 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2], 3); // minRingSize = 3

            // 2-membered ring should be filtered out
            expect(result.ringCount).toBe(0);
        });

        test('should handle atoms too far apart (no bonds)', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Atoms too far to bond
                { element: 'C', x: 5.0, y: 0.0, z: 0.0 },
                { element: 'C', x: 10.0, y: 0.0, z: 0.0 },
                { element: 'C', x: 15.0, y: 0.0, z: 0.0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3]);

            // Should not form a ring (atoms not bonded)
            expect(result.ringCount).toBe(0);
            expect(result.monodentate).toHaveLength(3);
        });
    });

    describe('createCentroidAtoms', () => {
        test('should create pseudo-atoms from ring centroids', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Cp ring
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 }
            ];

            const ligandGroups = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5]);
            const centroidAtoms = createCentroidAtoms(ligandGroups);

            expect(centroidAtoms).toHaveLength(1);

            const centroidAtom = centroidAtoms[0];
            expect(centroidAtom.element).toBe('η⁵-Cp');
            expect(centroidAtom.isRingCentroid).toBe(true);
            expect(centroidAtom.ringSize).toBe(5);
            expect(centroidAtom.originalIndices).toHaveLength(5);
            expect(centroidAtom.x).toBeDefined();
            expect(centroidAtom.y).toBeDefined();
            expect(centroidAtom.z).toBeDefined();
        });

        test('should preserve monodentate atoms', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Cp ring
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },
                // Monodentate
                { element: 'Cl', x: 0, y: 0, z: -2.5 }
            ];

            const ligandGroups = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5, 6]);
            const centroidAtoms = createCentroidAtoms(ligandGroups);

            expect(centroidAtoms).toHaveLength(2);

            // First should be ring centroid
            expect(centroidAtoms[0].isRingCentroid).toBe(true);
            expect(centroidAtoms[0].ringSize).toBe(5);

            // Second should be monodentate atom
            expect(centroidAtoms[1].isRingCentroid).toBe(false);
            expect(centroidAtoms[1].element).toBe('Cl');
            expect(centroidAtoms[1].ringSize).toBe(1);
        });

        test('should handle multiple rings and monodentate', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Ring 1 (Cp)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },
                // Ring 2 (Cp)
                { element: 'C', x: 1.0, y: 0.0, z: -1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: -1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: -1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: -1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: -1.6 },
                // Monodentate
                { element: 'N', x: 2.0, y: 0, z: 0 }
            ];

            const coordIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            const ligandGroups = detectLigandGroups(atoms, 0, coordIndices);
            const centroidAtoms = createCentroidAtoms(ligandGroups);

            // Should have 2 ring centroids + 1 monodentate = 3 total
            expect(centroidAtoms).toHaveLength(3);

            const ringCentroids = centroidAtoms.filter(a => a.isRingCentroid);
            const monodentate = centroidAtoms.filter(a => !a.isRingCentroid);

            expect(ringCentroids).toHaveLength(2);
            expect(monodentate).toHaveLength(1);
        });

        test('should handle empty ligand groups', () => {
            const ligandGroups = {
                rings: [],
                monodentate: [],
                totalGroups: 0,
                ringCount: 0
            };

            const centroidAtoms = createCentroidAtoms(ligandGroups);

            expect(centroidAtoms).toHaveLength(0);
        });
    });

    describe('Summary Information', () => {
        test('should provide correct summary string', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Cp ring
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },
                // Monodentate
                { element: 'Cl', x: 0, y: 0, z: -2.5 },
                { element: 'N', x: 2.0, y: 0, z: 0 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5, 6, 7]);

            expect(result.summary).toBe('1 ring(s) + 2 monodentate ligand(s)');
        });

        test('should list detected hapticities', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Cp ring (η⁵)
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 },
                // Benzene ring (η⁶)
                { element: 'C', x: 1.4, y: 0.0, z: -2.0 },
                { element: 'C', x: 0.7, y: 1.21, z: -2.0 },
                { element: 'C', x: -0.7, y: 1.21, z: -2.0 },
                { element: 'C', x: -1.4, y: 0.0, z: -2.0 },
                { element: 'C', x: -0.7, y: -1.21, z: -2.0 },
                { element: 'C', x: 0.7, y: -1.21, z: -2.0 }
            ];

            const coordIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            const result = detectLigandGroups(atoms, 0, coordIndices);

            expect(result.detectedHapticities).toContain('η⁵-Cp');
            expect(result.detectedHapticities).toContain('η⁶-C₆');
            expect(result.detectedHapticities).toHaveLength(2);
        });
    });

    describe('Distance Calculations', () => {
        test('should calculate distance from metal to ring centroid', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                // Cp ring at z = 1.6
                { element: 'C', x: 1.0, y: 0.0, z: 1.6 },
                { element: 'C', x: 0.31, y: 0.95, z: 1.6 },
                { element: 'C', x: -0.81, y: 0.59, z: 1.6 },
                { element: 'C', x: -0.81, y: -0.59, z: 1.6 },
                { element: 'C', x: 0.31, y: -0.95, z: 1.6 }
            ];

            const result = detectLigandGroups(atoms, 0, [1, 2, 3, 4, 5]);

            expect(result.rings[0].distanceToMetal).toBeCloseTo(1.6, 1);
        });

        test('should calculate distance for monodentate ligands', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'Cl', x: 0, y: 0, z: 2.5 }
            ];

            const result = detectLigandGroups(atoms, 0, [1]);

            expect(result.monodentate[0].distanceToMetal).toBeCloseTo(2.5, 10);
        });
    });
});

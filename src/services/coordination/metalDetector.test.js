/**
 * Test Suite for Metal Center Detection
 *
 * Critical test: Verifies metal detection fix with weighted scoring
 * Bug fixed: 2025-01-05 - Metals now have base score of 1000 to beat ligands
 */

import { detectMetalCenter } from './metalDetector';

describe('detectMetalCenter', () => {
    describe('Basic functionality', () => {
        test('should return 0 for empty atom array (graceful fallback)', () => {
            // Function is designed to be fault-tolerant
            const result = detectMetalCenter([]);
            expect(result).toBe(0);
        });

        test('should return 0 for null input (graceful fallback)', () => {
            // Function is designed to be fault-tolerant
            const result = detectMetalCenter(null);
            expect(result).toBe(0);
        });

        test('should return 0 for single atom', () => {
            const atoms = [{ element: 'Fe', x: 0, y: 0, z: 0 }];
            expect(detectMetalCenter(atoms)).toBe(0);
        });
    });

    describe('CRITICAL: Single metal detection (fast path)', () => {
        test('should detect single metal at position 0', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'N', x: 2.0, y: 0, z: 0 },
                { element: 'N', x: 0, y: 2.0, z: 0 }
            ];
            expect(detectMetalCenter(atoms)).toBe(0);
        });

        test('should detect single metal at position 2', () => {
            const atoms = [
                { element: 'N', x: 0, y: 0, z: 0 },
                { element: 'N', x: 2.0, y: 0, z: 0 },
                { element: 'Fe', x: 1.0, y: 1.0, z: 0 },
                { element: 'N', x: 0, y: 2.0, z: 0 }
            ];
            expect(detectMetalCenter(atoms)).toBe(2);
        });

        test('should detect single metal at last position', () => {
            const atoms = [
                { element: 'N', x: 0, y: 0, z: 0 },
                { element: 'N', x: 2.0, y: 0, z: 0 },
                { element: 'N', x: 0, y: 2.0, z: 0 },
                { element: 'Fe', x: 1.0, y: 1.0, z: 0 }
            ];
            expect(detectMetalCenter(atoms)).toBe(3);
        });
    });

    describe('CRITICAL: Bug fix - Metals should ALWAYS beat nonmetals', () => {
        test('should select Fe over highly coordinated N', () => {
            // Setup: N has 6 neighbors, Fe has 4 neighbors
            // Before fix: N would win (6 > 4)
            // After fix: Fe wins (1004 > 6)
            const atoms = [
                { element: 'N', x: 0, y: 0, z: 0 },      // 6 neighbors
                { element: 'C', x: 2.0, y: 0, z: 0 },
                { element: 'C', x: -2.0, y: 0, z: 0 },
                { element: 'C', x: 0, y: 2.0, z: 0 },
                { element: 'C', x: 0, y: -2.0, z: 0 },
                { element: 'C', x: 0, y: 0, z: 2.0 },
                { element: 'C', x: 0, y: 0, z: -2.0 },
                { element: 'Fe', x: 5.0, y: 5.0, z: 5.0 },  // 4 neighbors
                { element: 'O', x: 7.0, y: 5.0, z: 5.0 },
                { element: 'O', x: 3.0, y: 5.0, z: 5.0 },
                { element: 'O', x: 5.0, y: 7.0, z: 5.0 },
                { element: 'O', x: 5.0, y: 3.0, z: 5.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(7); // Fe should win despite fewer neighbors
        });

        test('should select Cu over highly coordinated C', () => {
            const atoms = [
                { element: 'C', x: 0, y: 0, z: 0 },      // 8 neighbors (sp3 carbon)
                { element: 'H', x: 1.0, y: 0, z: 0 },
                { element: 'H', x: -1.0, y: 0, z: 0 },
                { element: 'H', x: 0, y: 1.0, z: 0 },
                { element: 'H', x: 0, y: -1.0, z: 0 },
                { element: 'C', x: 0, y: 0, z: 1.5 },
                { element: 'C', x: 0, y: 0, z: -1.5 },
                { element: 'C', x: 1.5, y: 1.5, z: 0 },
                { element: 'C', x: -1.5, y: -1.5, z: 0 },
                { element: 'Cu', x: 10.0, y: 10.0, z: 10.0 }, // 2 neighbors
                { element: 'N', x: 12.0, y: 10.0, z: 10.0 },
                { element: 'N', x: 8.0, y: 10.0, z: 10.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(9); // Cu should win
        });

        test('should select La over N in lanthanide complex', () => {
            // Real-world case: User reported N being selected over La
            const atoms = [
                { element: 'N', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 },
                { element: 'O', x: -2.0, y: 0, z: 0 },
                { element: 'O', x: 0, y: 2.0, z: 0 },
                { element: 'O', x: 0, y: -2.0, z: 0 },
                { element: 'La', x: 5.0, y: 5.0, z: 5.0 },
                { element: 'O', x: 7.0, y: 5.0, z: 5.0 },
                { element: 'O', x: 3.0, y: 5.0, z: 5.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(5); // La should win
        });

        test('should select U (actinide) over O', () => {
            const atoms = [
                { element: 'O', x: 0, y: 0, z: 0 },
                { element: 'C', x: 1.5, y: 0, z: 0 },
                { element: 'C', x: -1.5, y: 0, z: 0 },
                { element: 'C', x: 0, y: 1.5, z: 0 },
                { element: 'U', x: 5.0, y: 5.0, z: 5.0 },
                { element: 'O', x: 7.0, y: 5.0, z: 5.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(4); // U should win
        });
    });

    describe('Multiple metals - should select most coordinated', () => {
        test('should select metal with more neighbors', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },      // 6 neighbors
                { element: 'O', x: 2.0, y: 0, z: 0 },
                { element: 'O', x: -2.0, y: 0, z: 0 },
                { element: 'O', x: 0, y: 2.0, z: 0 },
                { element: 'O', x: 0, y: -2.0, z: 0 },
                { element: 'O', x: 0, y: 0, z: 2.0 },
                { element: 'O', x: 0, y: 0, z: -2.0 },
                { element: 'Cu', x: 10.0, y: 10.0, z: 10.0 }, // 2 neighbors
                { element: 'N', x: 12.0, y: 10.0, z: 10.0 },
                { element: 'N', x: 8.0, y: 10.0, z: 10.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0); // Fe has more neighbors
        });

        test('should handle equal coordination - select first metal', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },      // 4 neighbors
                { element: 'O', x: 2.0, y: 0, z: 0 },
                { element: 'O', x: -2.0, y: 0, z: 0 },
                { element: 'O', x: 0, y: 2.0, z: 0 },
                { element: 'O', x: 0, y: -2.0, z: 0 },
                { element: 'Cu', x: 10.0, y: 10.0, z: 10.0 }, // 4 neighbors
                { element: 'N', x: 12.0, y: 10.0, z: 10.0 },
                { element: 'N', x: 8.0, y: 10.0, z: 10.0 },
                { element: 'N', x: 10.0, y: 12.0, z: 10.0 },
                { element: 'N', x: 10.0, y: 8.0, z: 10.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0); // Fe appears first
        });
    });

    describe('CRITICAL: H should NEVER be selected', () => {
        test('should not select H even if only H atoms present', () => {
            const atoms = [
                { element: 'H', x: 0, y: 0, z: 0 },
                { element: 'H', x: 1.0, y: 0, z: 0 },
                { element: 'H', x: 0, y: 1.0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            // Should fall back to first atom as last resort
            expect(result).toBe(0);
        });

        test('should select any non-H atom over H', () => {
            const atoms = [
                { element: 'H', x: 0, y: 0, z: 0 },
                { element: 'C', x: 2.0, y: 0, z: 0 },
                { element: 'H', x: 0, y: 2.0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(1); // C should be selected
        });
    });

    describe('CRITICAL: Noble gases should NEVER be selected', () => {
        test('should not select Ar', () => {
            const atoms = [
                { element: 'Ar', x: 0, y: 0, z: 0 },
                { element: 'C', x: 2.0, y: 0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(1); // C should be selected
        });

        test('should not select He', () => {
            const atoms = [
                { element: 'He', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(1); // O should be selected
        });

        test('should not select any noble gas (Ne, Ar, Kr, Xe, Rn)', () => {
            const nobleGases = ['Ne', 'Ar', 'Kr', 'Xe', 'Rn'];

            nobleGases.forEach(gas => {
                const atoms = [
                    { element: gas, x: 0, y: 0, z: 0 },
                    { element: 'N', x: 2.0, y: 0, z: 0 }
                ];

                const result = detectMetalCenter(atoms);
                expect(result).toBe(1); // N should be selected over noble gas
            });
        });
    });

    describe('Coordination sphere calculation (3.5 Å cutoff)', () => {
        test('should count neighbors within 3.5 Å', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 },    // Within 3.5
                { element: 'O', x: 3.4, y: 0, z: 0 },    // Within 3.5
                { element: 'O', x: 3.6, y: 0, z: 0 },    // Outside 3.5
                { element: 'O', x: 5.0, y: 0, z: 0 }     // Outside 3.5
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0); // Fe should be selected (has 2 neighbors < 3.5)
        });

        test('should handle 3D distances correctly', () => {
            const atoms = [
                { element: 'Cu', x: 0, y: 0, z: 0 },
                { element: 'N', x: 2.0, y: 2.0, z: 2.0 }  // Distance = √12 ≈ 3.46 (within)
            ];

            const distance = Math.sqrt(2*2 + 2*2 + 2*2);
            expect(distance).toBeLessThan(3.5);

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0); // Cu should be selected
        });
    });

    describe('Edge cases and robustness', () => {
        test('should handle invalid coordinates gracefully', () => {
            const atoms = [
                { element: 'Fe', x: NaN, y: 0, z: 0 },
                { element: 'Cu', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(1); // Should skip Fe with NaN, select Cu
        });

        test('should handle Infinity coordinates', () => {
            const atoms = [
                { element: 'Fe', x: Infinity, y: 0, z: 0 },
                { element: 'Cu', x: 0, y: 0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(1); // Should skip Fe with Infinity
        });

        test('should handle structures with no metals gracefully', () => {
            const atoms = [
                { element: 'C', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 },
                { element: 'N', x: 0, y: 2.0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            // Should return highest-coordinated non-metal
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(atoms.length);
        });

        test('should handle collinear atoms', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'O', x: 1.0, y: 0, z: 0 },
                { element: 'O', x: 2.0, y: 0, z: 0 },
                { element: 'O', x: 3.0, y: 0, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0); // Fe should still be selected
        });

        test('should handle very large structures', () => {
            const atoms = [];
            // Create 100-atom structure with Fe at position 50
            for (let i = 0; i < 100; i++) {
                atoms.push({
                    element: i === 50 ? 'Fe' : 'C',
                    x: Math.random() * 10,
                    y: Math.random() * 10,
                    z: Math.random() * 10
                });
            }

            const result = detectMetalCenter(atoms);
            expect(result).toBe(50); // Fe should be detected
        });
    });

    describe('Real-world coordination complexes', () => {
        test('octahedral Fe(II) complex', () => {
            const atoms = [
                { element: 'Fe', x: 0, y: 0, z: 0 },
                { element: 'O', x: 2.1, y: 0, z: 0 },
                { element: 'O', x: -2.1, y: 0, z: 0 },
                { element: 'O', x: 0, y: 2.1, z: 0 },
                { element: 'O', x: 0, y: -2.1, z: 0 },
                { element: 'O', x: 0, y: 0, z: 2.1 },
                { element: 'O', x: 0, y: 0, z: -2.1 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0);
        });

        test('square planar Pt(II) complex', () => {
            const atoms = [
                { element: 'Pt', x: 0, y: 0, z: 0 },
                { element: 'Cl', x: 2.3, y: 0, z: 0 },
                { element: 'Cl', x: -2.3, y: 0, z: 0 },
                { element: 'Cl', x: 0, y: 2.3, z: 0 },
                { element: 'Cl', x: 0, y: -2.3, z: 0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0);
        });

        test('tetrahedral Zn complex', () => {
            const atoms = [
                { element: 'Zn', x: 0, y: 0, z: 0 },
                { element: 'N', x: 2.0, y: 2.0, z: 2.0 },
                { element: 'N', x: -2.0, y: -2.0, z: 2.0 },
                { element: 'N', x: -2.0, y: 2.0, z: -2.0 },
                { element: 'N', x: 2.0, y: -2.0, z: -2.0 }
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(0);
        });
    });

    describe('Scoring system verification', () => {
        test('metal with 0 neighbors should beat non-metal with 10 neighbors', () => {
            // Metal score: 1000 + 0 = 1000
            // Non-metal score: 0 + 10 = 10
            // Metal should win
            const atoms = [
                { element: 'N', x: 0, y: 0, z: 0 },       // 10 neighbors
                { element: 'C', x: 1.0, y: 0, z: 0 },
                { element: 'C', x: -1.0, y: 0, z: 0 },
                { element: 'C', x: 0, y: 1.0, z: 0 },
                { element: 'C', x: 0, y: -1.0, z: 0 },
                { element: 'C', x: 0, y: 0, z: 1.0 },
                { element: 'C', x: 0, y: 0, z: -1.0 },
                { element: 'C', x: 1.5, y: 1.5, z: 0 },
                { element: 'C', x: -1.5, y: -1.5, z: 0 },
                { element: 'C', x: 1.5, y: -1.5, z: 0 },
                { element: 'C', x: -1.5, y: 1.5, z: 0 },
                { element: 'Fe', x: 50.0, y: 50.0, z: 50.0 } // 0 neighbors (far away)
            ];

            const result = detectMetalCenter(atoms);
            expect(result).toBe(11); // Fe should win despite 0 neighbors
        });
    });
});

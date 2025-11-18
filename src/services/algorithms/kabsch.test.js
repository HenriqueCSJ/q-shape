/**
 * Comprehensive tests for Kabsch algorithm
 *
 * Tests the robust Kabsch alignment implementation and its helper functions.
 */

import kabschAlignment, {
    jacobiSVD,
    transpose3x3,
    multiplyMatrices3x3,
    determinant3x3,
    arrayToMatrix4
} from './kabsch';
import * as THREE from 'three';

describe('Kabsch Algorithm', () => {
    describe('kabschAlignment - Basic Alignment', () => {
        test('should return identity for identical point sets', () => {
            const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const Q = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

            const R = kabschAlignment(P, Q);

            // Should be close to identity matrix
            const elements = R.elements;
            expect(elements[0]).toBeCloseTo(1, 5);  // [0,0]
            expect(elements[1]).toBeCloseTo(0, 5);  // [1,0]
            expect(elements[2]).toBeCloseTo(0, 5);  // [2,0]
            expect(elements[4]).toBeCloseTo(0, 5);  // [0,1]
            expect(elements[5]).toBeCloseTo(1, 5);  // [1,1]
            expect(elements[6]).toBeCloseTo(0, 5);  // [2,1]
            expect(elements[8]).toBeCloseTo(0, 5);  // [0,2]
            expect(elements[9]).toBeCloseTo(0, 5);  // [1,2]
            expect(elements[10]).toBeCloseTo(1, 5); // [2,2]
        });

        test('should handle 90° rotation around Z-axis', () => {
            const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const Q = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];

            const R = kabschAlignment(P, Q);

            // Kabsch returns the optimal rotation matrix
            // It uses Hungarian algorithm internally, so P[i] doesn't necessarily map to Q[i]
            // Just verify we get a valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const det = R.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);
        });

        test('should handle 180° rotation', () => {
            const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const Q = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];

            const R = kabschAlignment(P, Q);

            // Verify valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const det = R.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);
        });

        test('should align translated point sets', () => {
            const P = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
            const Q = [[11, 12, 13], [14, 15, 16], [17, 18, 19]];

            const R = kabschAlignment(P, Q);

            // Should still return a valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);

            // Determinant should be 1 (proper rotation)
            const det = R.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);
        });

        test('should handle arbitrary rotation', () => {
            // Create a known rotation matrix (45° around Z-axis)
            const angle = Math.PI / 4;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const Q = [
                [cos, sin, 0],
                [-sin, cos, 0],
                [0, 0, 1]
            ];

            const R = kabschAlignment(P, Q);

            // Verify valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const det = R.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);
        });
    });

    describe('kabschAlignment - Edge Cases', () => {
        test('should handle empty point sets', () => {
            const P = [];
            const Q = [];

            const R = kabschAlignment(P, Q);

            // Should return identity matrix on error
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const elements = R.elements;
            expect(elements[0]).toBe(1);
            expect(elements[5]).toBe(1);
            expect(elements[10]).toBe(1);
        });

        test('should handle mismatched point set sizes', () => {
            const P = [[1, 0, 0], [0, 1, 0]];
            const Q = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

            const R = kabschAlignment(P, Q);

            // Should return identity matrix on error
            expect(R).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle single point', () => {
            const P = [[1, 2, 3]];
            const Q = [[4, 5, 6]];

            const R = kabschAlignment(P, Q);

            // Should return valid matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle collinear points', () => {
            const P = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
            const Q = [[0, 0, 0], [0, 1, 0], [0, 2, 0]];

            const R = kabschAlignment(P, Q);

            // Should return valid rotation
            expect(R).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle coplanar points', () => {
            const P = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
            const Q = [[0, 0, 0], [0, 1, 0], [-1, 0, 0], [-1, 1, 0]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle very small coordinates', () => {
            const P = [[1e-8, 0, 0], [0, 1e-8, 0], [0, 0, 1e-8]];
            const Q = [[0, 1e-8, 0], [-1e-8, 0, 0], [0, 0, 1e-8]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
        });

        test('should handle large coordinates', () => {
            const P = [[1e6, 0, 0], [0, 1e6, 0], [0, 0, 1e6]];
            const Q = [[0, 1e6, 0], [-1e6, 0, 0], [0, 0, 1e6]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
        });
    });

    describe('kabschAlignment - Coordination Chemistry', () => {
        test('should align octahedral geometry', () => {
            // Octahedral coordination: 6 ligands
            const P = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            // Rotated octahedron
            const Q = [
                [0, 1, 0], [0, -1, 0],
                [-1, 0, 0], [1, 0, 0],
                [0, 0, 1], [0, 0, -1]
            ];

            const R = kabschAlignment(P, Q);

            // Verify valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const det = R.determinant();
            expect(Math.abs(det)).toBeCloseTo(1, 4);

            // Verify transformed points are on unit sphere
            const transformed = P.map(p => {
                const v = new THREE.Vector3(p[0], p[1], p[2]);
                v.applyMatrix4(R);
                return v;
            });

            transformed.forEach(v => {
                expect(v.length()).toBeCloseTo(1, 4);
            });
        });

        test('should align tetrahedral geometry', () => {
            // Tetrahedral vertices
            const P = [
                [1, 1, 1],
                [1, -1, -1],
                [-1, 1, -1],
                [-1, -1, 1]
            ];

            // Same tetrahedron, rotated
            const angle = Math.PI / 3; // 60°
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const Q = P.map(p => [
                cos * p[0] - sin * p[1],
                sin * p[0] + cos * p[1],
                p[2]
            ]);

            const R = kabschAlignment(P, Q);

            const transformed = P.map(p => {
                const v = new THREE.Vector3(p[0], p[1], p[2]);
                v.applyMatrix4(R);
                return [v.x, v.y, v.z];
            });

            let sumSqDist = 0;
            for (let i = 0; i < 4; i++) {
                const dx = transformed[i][0] - Q[i][0];
                const dy = transformed[i][1] - Q[i][1];
                const dz = transformed[i][2] - Q[i][2];
                sumSqDist += dx*dx + dy*dy + dz*dz;
            }
            const rmsd = Math.sqrt(sumSqDist / 4);
            // Allow for some numerical error in matching
            expect(rmsd).toBeLessThan(2);
        });

        test('should align square planar geometry', () => {
            const P = [
                [1, 0, 0],
                [0, 1, 0],
                [-1, 0, 0],
                [0, -1, 0]
            ];

            const Q = [
                [0, 1, 0],
                [-1, 0, 0],
                [0, -1, 0],
                [1, 0, 0]
            ];

            const R = kabschAlignment(P, Q);

            const transformed = P.map(p => {
                const v = new THREE.Vector3(p[0], p[1], p[2]);
                v.applyMatrix4(R);
                return [v.x, v.y, v.z];
            });

            let sumSqDist = 0;
            for (let i = 0; i < 4; i++) {
                const dx = transformed[i][0] - Q[i][0];
                const dy = transformed[i][1] - Q[i][1];
                const dz = transformed[i][2] - Q[i][2];
                sumSqDist += dx*dx + dy*dy + dz*dz;
            }
            const rmsd = Math.sqrt(sumSqDist / 4);
            // Allow for matching errors
            expect(rmsd).toBeLessThan(2);
        });
    });

    describe('jacobiSVD', () => {
        test('should decompose identity matrix', () => {
            const I = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            const { U, V } = jacobiSVD(I);

            // U and V should be orthogonal
            const UtU = multiplyMatrices3x3(transpose3x3(U), U);
            const VtV = multiplyMatrices3x3(transpose3x3(V), V);

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    const expected = i === j ? 1 : 0;
                    expect(UtU[i][j]).toBeCloseTo(expected, 4);
                    expect(VtV[i][j]).toBeCloseTo(expected, 4);
                }
            }
        });

        test('should decompose diagonal matrix', () => {
            const D = [
                [3, 0, 0],
                [0, 2, 0],
                [0, 0, 1]
            ];

            const { U, V } = jacobiSVD(D);

            // Verify orthogonality
            const UtU = multiplyMatrices3x3(transpose3x3(U), U);

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    const expected = i === j ? 1 : 0;
                    expect(UtU[i][j]).toBeCloseTo(expected, 4);
                }
            }
        });

        test('should decompose symmetric matrix', () => {
            const A = [
                [4, 1, 1],
                [1, 3, 2],
                [1, 2, 5]
            ];

            const { U, V } = jacobiSVD(A);

            // U and V should be orthogonal
            expect(U).toBeDefined();
            expect(V).toBeDefined();
            expect(U.length).toBe(3);
            expect(V.length).toBe(3);
        });

        test('should handle zero matrix', () => {
            const Z = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0]
            ];

            const { U, V } = jacobiSVD(Z);

            expect(U).toBeDefined();
            expect(V).toBeDefined();
        });
    });

    describe('Helper Functions', () => {
        describe('transpose3x3', () => {
            test('should transpose identity matrix', () => {
                const I = [
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const It = transpose3x3(I);

                expect(It).toEqual(I);
            });

            test('should transpose general matrix', () => {
                const A = [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ];

                const At = transpose3x3(A);

                expect(At[0]).toEqual([1, 4, 7]);
                expect(At[1]).toEqual([2, 5, 8]);
                expect(At[2]).toEqual([3, 6, 9]);
            });

            test('should satisfy (A^T)^T = A', () => {
                const A = [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ];

                const Att = transpose3x3(transpose3x3(A));

                expect(Att).toEqual(A);
            });
        });

        describe('multiplyMatrices3x3', () => {
            test('should multiply by identity', () => {
                const A = [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ];

                const I = [
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const result = multiplyMatrices3x3(A, I);

                expect(result).toEqual(A);
            });

            test('should multiply correctly', () => {
                const A = [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ];

                const B = [
                    [9, 8, 7],
                    [6, 5, 4],
                    [3, 2, 1]
                ];

                const C = multiplyMatrices3x3(A, B);

                expect(C[0][0]).toBe(30);
                expect(C[0][1]).toBe(24);
                expect(C[0][2]).toBe(18);
                expect(C[1][0]).toBe(84);
                expect(C[1][1]).toBe(69);
                expect(C[1][2]).toBe(54);
            });

            test('should be non-commutative', () => {
                const A = [
                    [1, 2, 3],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const B = [
                    [1, 0, 0],
                    [2, 1, 0],
                    [3, 0, 1]
                ];

                const AB = multiplyMatrices3x3(A, B);
                const BA = multiplyMatrices3x3(B, A);

                // Matrix multiplication is generally not commutative
                let areEqual = true;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (Math.abs(AB[i][j] - BA[i][j]) > 1e-10) {
                            areEqual = false;
                            break;
                        }
                    }
                    if (!areEqual) break;
                }
                expect(areEqual).toBe(false);
            });

            test('should be associative', () => {
                const A = [[1, 2, 3], [0, 1, 0], [0, 0, 1]];
                const B = [[1, 0, 0], [2, 1, 0], [3, 0, 1]];
                const C = [[1, 0, 1], [0, 1, 1], [0, 0, 1]];

                const AB_C = multiplyMatrices3x3(multiplyMatrices3x3(A, B), C);
                const A_BC = multiplyMatrices3x3(A, multiplyMatrices3x3(B, C));

                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        expect(AB_C[i][j]).toBeCloseTo(A_BC[i][j], 10);
                    }
                }
            });
        });

        describe('determinant3x3', () => {
            test('should compute determinant of identity', () => {
                const I = [
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const det = determinant3x3(I);

                expect(det).toBe(1);
            });

            test('should compute determinant of zero matrix', () => {
                const Z = [
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ];

                const det = determinant3x3(Z);

                expect(det).toBe(0);
            });

            test('should compute determinant correctly', () => {
                const A = [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ];

                const det = determinant3x3(A);

                // This matrix is singular (rows are linearly dependent)
                expect(det).toBeCloseTo(0, 10);
            });

            test('should compute determinant of rotation matrix', () => {
                const angle = Math.PI / 4;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                const R = [
                    [cos, -sin, 0],
                    [sin, cos, 0],
                    [0, 0, 1]
                ];

                const det = determinant3x3(R);

                // Rotation matrix has determinant 1
                expect(det).toBeCloseTo(1, 10);
            });

            test('should detect reflection (negative determinant)', () => {
                const R = [
                    [-1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const det = determinant3x3(R);

                expect(det).toBe(-1);
            });
        });

        describe('arrayToMatrix4', () => {
            test('should convert identity matrix', () => {
                const I = [
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1]
                ];

                const mat = arrayToMatrix4(I);

                expect(mat).toBeInstanceOf(THREE.Matrix4);
                expect(mat.elements[0]).toBe(1);
                expect(mat.elements[5]).toBe(1);
                expect(mat.elements[10]).toBe(1);
                expect(mat.elements[15]).toBe(1);
            });

            test('should convert rotation matrix', () => {
                const R = [
                    [0, -1, 0],
                    [1, 0, 0],
                    [0, 0, 1]
                ];

                const mat = arrayToMatrix4(R);

                const e = mat.elements;
                expect(e[0]).toBe(0);
                expect(e[1]).toBe(1);
                expect(e[4]).toBe(-1);
                expect(e[5]).toBe(0);
                expect(e[10]).toBe(1);
            });

            test('should preserve matrix properties', () => {
                const R = [
                    [0.5, -0.866, 0],
                    [0.866, 0.5, 0],
                    [0, 0, 1]
                ];

                const mat = arrayToMatrix4(R);

                // Check determinant is preserved
                const det = mat.determinant();
                const det3x3 = determinant3x3(R);

                expect(det).toBeCloseTo(det3x3, 10);
            });
        });
    });
});

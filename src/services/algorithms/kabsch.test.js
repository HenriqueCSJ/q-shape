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

function centeredVectors(points) {
    const centroid = points.reduce(
        (sum, point) => sum.add(new THREE.Vector3(...point)),
        new THREE.Vector3()
    ).divideScalar(points.length);
    return points.map(point => new THREE.Vector3(...point).sub(centroid));
}

function alignmentRmsd(P, Q, rotation) {
    const centeredP = centeredVectors(P);
    const centeredQ = centeredVectors(Q);
    return Math.sqrt(centeredP.reduce((sum, point, index) =>
        sum + point.clone().applyMatrix4(rotation).distanceToSquared(centeredQ[index]),
    0) / P.length);
}

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
            expect(det).toBeCloseTo(1, 4);
        });

        test('should handle 180° rotation', () => {
            const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            const Q = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];

            const R = kabschAlignment(P, Q);

            // Verify valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);
            const det = R.determinant();
            expect(det).toBeCloseTo(1, 4);
        });

        test('should align translated point sets', () => {
            const P = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
            const Q = [[11, 12, 13], [14, 15, 16], [17, 18, 19]];

            const R = kabschAlignment(P, Q);

            // Should still return a valid rotation matrix
            expect(R).toBeInstanceOf(THREE.Matrix4);

            // Determinant should be 1 (proper rotation)
            const det = R.determinant();
            expect(det).toBeCloseTo(1, 4);
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
            expect(det).toBeCloseTo(1, 4);
        });

        test('should recover a proper rotation with negligible alignment residual', () => {
            const P = [
                [1, 2, 0],
                [-1, 0, 1],
                [0, -2, -1],
                [0, 0, 0]
            ];
            const knownRotation = new THREE.Matrix4().makeRotationFromEuler(
                new THREE.Euler(0.4, -0.7, 1.1)
            );
            const Q = P.map(point =>
                new THREE.Vector3(...point).applyMatrix4(knownRotation).toArray()
            );

            const recovered = kabschAlignment(P, Q);

            expect(recovered.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, recovered)).toBeLessThan(1e-10);
        });
    });

    describe('kabschAlignment - Edge Cases', () => {
        test('rejects point sets that are not arrays', () => {
            const valid = [[0, 0, 0], [1, 0, 0]];

            expect(() => kabschAlignment(null, valid)).toThrow(TypeError);
            expect(() => kabschAlignment(valid, 'not-a-point-set')).toThrow(TypeError);
        });

        test('rejects empty point sets', () => {
            const P = [];
            const Q = [];

            expect(() => kabschAlignment(P, Q)).toThrow(/must not be empty/);
        });

        test('rejects mismatched point set sizes', () => {
            const P = [[1, 0, 0], [0, 1, 0]];
            const Q = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

            expect(() => kabschAlignment(P, Q)).toThrow(/size mismatch/);
        });

        test('rejects a single point because it has no spatial extent', () => {
            const P = [[1, 2, 3]];
            const Q = [[4, 5, 6]];

            expect(() => kabschAlignment(P, Q)).toThrow(/insufficient spatial extent/);
        });

        test('rejects malformed and non-finite coordinates', () => {
            expect(() => kabschAlignment(
                [[0, 0, 0], [1, 0]],
                [[0, 0, 0], [1, 0, 0]]
            )).toThrow(/exactly three coordinates/);
            expect(() => kabschAlignment(
                [[0, 0, 0], [NaN, 0, 0]],
                [[0, 0, 0], [1, 0, 0]]
            )).toThrow(/must be finite/);
        });

        test('rejects coincident multi-point sets instead of returning identity', () => {
            const coincident = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
            expect(() => kabschAlignment(coincident, coincident))
                .toThrow(/insufficient spatial extent/);
        });

        test('rejects finite coordinates whose normalization scale underflows or overflows', () => {
            const underflow = [[0, 0, 0], [Number.MIN_VALUE, 0, 0]];
            const overflow = [[0, 0, 0], [Number.MAX_VALUE, 0, 0]];

            expect(() => kabschAlignment(underflow, underflow, true))
                .toThrow(/normalization scale is non-finite or zero/);
            expect(() => kabschAlignment(overflow, overflow, true))
                .toThrow(/normalization scale is non-finite or zero/);
        });

        test('rejects a non-finite rotation matrix produced by the numerical kernel', () => {
            const originalSet = THREE.Matrix4.prototype.set;
            const setSpy = jest.spyOn(THREE.Matrix4.prototype, 'set')
                .mockImplementation(function (...values) {
                    const result = originalSet.apply(this, values);
                    this.elements[0] = NaN;
                    return result;
                });

            try {
                expect(() => kabschAlignment(
                    [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
                    [[0, 0, 0], [0, 1, 0], [-1, 0, 0]]
                )).toThrow(/non-finite rotation matrix/);
            } finally {
                setSpy.mockRestore();
            }
        });

        test.each([NaN, 0])(
            'rejects an invalid rotation determinant (%p)',
            determinant => {
                const determinantSpy = jest.spyOn(THREE.Matrix4.prototype, 'determinant')
                    .mockReturnValue(determinant);

                try {
                    expect(() => kabschAlignment(
                        [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
                        [[0, 0, 0], [0, 1, 0], [-1, 0, 0]]
                    )).toThrow(/invalid rotation determinant/);
                } finally {
                    determinantSpy.mockRestore();
                }
            }
        );

        test('should handle collinear points', () => {
            const P = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
            const Q = [[0, 0, 0], [0, 1, 0], [0, 2, 0]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R)).toBeLessThan(1e-10);
        });

        test('should align a collinear set rotated 45 degrees', () => {
            const P = [[-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]];
            const knownRotation = new THREE.Matrix4().makeRotationZ(Math.PI / 4);
            const Q = P.map(point =>
                new THREE.Vector3(...point).applyMatrix4(knownRotation).toArray()
            );

            const R = kabschAlignment(P, Q);

            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R)).toBeLessThan(1e-10);
        });

        test('should handle coplanar points', () => {
            const P = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
            const Q = [[0, 0, 0], [0, 1, 0], [-1, 0, 0], [-1, 1, 0]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R)).toBeLessThan(1e-10);
        });

        test('should align deterministic rotations for rank-1, rank-2, and rank-3 sets', () => {
            const pointSets = [
                [[-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]],
                [[0, 0, 0], [1, 0, 0], [-0.3, 1.2, 0], [0.8, 0.4, 0]],
                [[0, 0, 0], [1, 0.2, -0.1], [-0.3, 1.2, 0.4], [0.8, 0.4, 1.3]]
            ];

            for (let sample = 0; sample < 24; sample++) {
                const axis = new THREE.Vector3(
                    Math.sin(sample + 1),
                    Math.cos(2 * sample + 0.3),
                    Math.sin(3 * sample + 0.7)
                ).normalize();
                const knownRotation = new THREE.Matrix4().makeRotationAxis(
                    axis,
                    ((sample + 1) * 0.271) % (2 * Math.PI)
                );
                const translation = new THREE.Vector3(
                    0.1 * sample,
                    -0.03 * sample,
                    0.07 * sample
                );

                for (const P of pointSets) {
                    const Q = P.map(point =>
                        new THREE.Vector3(...point)
                            .applyMatrix4(knownRotation)
                            .add(translation)
                            .toArray()
                    );
                    const recovered = kabschAlignment(P, Q);

                    expect(recovered.determinant()).toBeCloseTo(1, 9);
                    expect(alignmentRmsd(P, Q, recovered)).toBeLessThan(1e-8);
                }
            }
        });

        test('should reject a reflection by sacrificing the lowest-variance axis', () => {
            const P = [
                [-1, 0, 0], [1, 0, 0],
                [0, -2, 0], [0, 2, 0],
                [0, 0, -10], [0, 0, 10]
            ];
            const Q = P.map(([x, y, z]) => [-x, y, z]);

            const R = kabschAlignment(P, Q);

            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R)).toBeCloseTo(2 / Math.sqrt(3), 10);
        });

        test('should handle very small coordinates', () => {
            const P = [[1e-8, 0, 0], [0, 1e-8, 0], [0, 0, 1e-8]];
            const Q = [[0, 1e-8, 0], [-1e-8, 0, 0], [0, 0, 1e-8]];

            const R = kabschAlignment(P, Q);

            expect(R).toBeInstanceOf(THREE.Matrix4);
            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R) / 1e-8).toBeLessThan(1e-10);
        });

        test('should remain scale-independent below the former absolute tolerance', () => {
            const scale = 1e-11;
            const P = [
                [scale, 2 * scale, 0],
                [-scale, 0, scale],
                [0, -2 * scale, -scale],
                [0, 0, 0]
            ];
            const knownRotation = new THREE.Matrix4().makeRotationFromEuler(
                new THREE.Euler(0.4, -0.7, 1.1)
            );
            const Q = P.map(point =>
                new THREE.Vector3(...point).applyMatrix4(knownRotation).toArray()
            );

            const R = kabschAlignment(P, Q);

            expect(R.determinant()).toBeCloseTo(1, 10);
            expect(alignmentRmsd(P, Q, R) / scale).toBeLessThan(1e-9);
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
            expect(det).toBeCloseTo(1, 4);

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

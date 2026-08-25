import * as THREE from 'three';
import { KABSCH } from '../../constants/algorithmConstants.js';

/**
 * IMPROVED Kabsch Algorithm with robust numerical SVD
 *
 * The Kabsch algorithm finds the optimal rotation matrix that minimizes the
 * root mean squared deviation (RMSD) between two paired sets of points.
 * This implementation uses the two-sided Jacobi algorithm for SVD,
 * providing better numerical stability than traditional methods.
 *
 * Algorithm Steps:
 * 1. Center both point sets by subtracting their centroids (optional)
 * 2. Compute the covariance matrix H = P^T * Q
 * 3. Perform Singular Value Decomposition (SVD) on H
 * 4. Calculate rotation matrix R = V * U^T
 * 5. Ensure proper rotation by checking determinant
 *
 * @param {Array<Array<number>>} P - First point set, array of [x, y, z] coordinates
 * @param {Array<Array<number>>} Q - Second point set, array of [x, y, z] coordinates
 * @param {boolean} skipCentering - If true, skip centering (use when points are already centered)
 * @returns {THREE.Matrix4} Rotation matrix that aligns P to Q
 * @throws {TypeError|RangeError|Error} For invalid, non-finite, or spatially degenerate point sets
 *
 * @example
 * const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
 * const Q = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
 * const rotationMatrix = kabschAlignment(P, Q);
 */
export default function kabschAlignment(P, Q, skipCentering = false) {
        validatePointSet(P, 'P');
        validatePointSet(Q, 'Q');
        const N = P.length;
        if (N !== Q.length) {
            throw new RangeError(`Kabsch point set size mismatch: P has ${P.length}, Q has ${Q.length}`);
        }
        validateSpatialExtent(P, 'P');
        validateSpatialExtent(Q, 'Q');

        let P_centered, Q_centered;

        if (skipCentering) {
            // Use points as-is (the caller guarantees they are centered).
            P_centered = P.map(point => [...point]);
            Q_centered = Q.map(point => [...point]);
        } else {
            // Step 1: Center both point sets
            const centroidP = [0, 0, 0];
            const centroidQ = [0, 0, 0];

            for (let i = 0; i < N; i++) {
                centroidP[0] += P[i][0];
                centroidP[1] += P[i][1];
                centroidP[2] += P[i][2];
                centroidQ[0] += Q[i][0];
                centroidQ[1] += Q[i][1];
                centroidQ[2] += Q[i][2];
            }

            centroidP[0] /= N;
            centroidP[1] /= N;
            centroidP[2] /= N;
            centroidQ[0] /= N;
            centroidQ[1] /= N;
            centroidQ[2] /= N;

            // Step 2: Translate points to origin
            P_centered = P.map(p => [
                p[0] - centroidP[0],
                p[1] - centroidP[1],
                p[2] - centroidP[2]
            ]);

            Q_centered = Q.map(q => [
                q[0] - centroidQ[0],
                q[1] - centroidQ[1],
                q[2] - centroidQ[2]
            ]);
        }

        // Uniform scale has no effect on the optimal rotation. Normalize both
        // sets independently so SVD and identity tolerances remain meaningful
        // for coordinates ranging from sub-angstrom test scales to very large
        // Cartesian values.
        const rmsMagnitude = points => {
            const magnitude = Math.sqrt(points.reduce(
                (sum, point) => sum + point[0] ** 2 + point[1] ** 2 + point[2] ** 2,
                0
            ) / N);
            if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
                throw new Error('Kabsch normalization scale is non-finite or zero');
            }
            return magnitude;
        };
        const scaleP = rmsMagnitude(P_centered);
        const scaleQ = rmsMagnitude(Q_centered);
        P_centered = P_centered.map(point => point.map(value => value / scaleP));
        Q_centered = Q_centered.map(point => point.map(value => value / scaleQ));

        // Avoid an unnecessary SVD for identical point sets. Symmetric or
        // rank-deficient identical sets do not define a unique orientation,
        // but the identity matrix is always a valid optimal rotation.
        const IDENTITY_THRESHOLD = 1e-12;
        const isIdentical = P_centered.every((p, i) =>
            Math.abs(p[0] - Q_centered[i][0]) <= IDENTITY_THRESHOLD &&
            Math.abs(p[1] - Q_centered[i][1]) <= IDENTITY_THRESHOLD &&
            Math.abs(p[2] - Q_centered[i][2]) <= IDENTITY_THRESHOLD
        );
        if (isIdentical) {
            return new THREE.Matrix4();
        }

        // Step 3: Compute covariance matrix H = P^T * Q
        const H = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];

        for (let i = 0; i < N; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    H[j][k] += P_centered[i][j] * Q_centered[i][k];
                }
            }
        }

        // Step 4: Perform SVD on H using Jacobi algorithm (more robust)
        const { U, V } = jacobiSVD(H);

        // Step 5: Compute rotation matrix R = V * U^T
        const R = multiplyMatrices3x3(V, transpose3x3(U));

        // Step 6: Ensure proper rotation (det(R) = 1)
        const det = determinant3x3(R);
        if (det < 0) {
            V[0][2] *= -1;
            V[1][2] *= -1;
            V[2][2] *= -1;
            const R_corrected = multiplyMatrices3x3(V, transpose3x3(U));
            return validateRotationMatrix(arrayToMatrix4(R_corrected));
        }

        return validateRotationMatrix(arrayToMatrix4(R));
}

function validatePointSet(points, label) {
    if (!Array.isArray(points)) {
        throw new TypeError(`Kabsch point set ${label} must be an array`);
    }
    if (points.length === 0) {
        throw new RangeError(`Kabsch point set ${label} must not be empty`);
    }
    points.forEach((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 3) {
            throw new RangeError(
                `Kabsch point ${label}[${pointIndex}] must contain exactly three coordinates`
            );
        }
        point.forEach((coordinate, coordinateIndex) => {
            if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) {
                throw new TypeError(
                    `Kabsch point ${label}[${pointIndex}][${coordinateIndex}] must be finite`
                );
            }
        });
    });
}

function validateSpatialExtent(points, label) {
    const origin = points[0];
    const maximumSeparation = points.reduce((maximum, point) => {
        const separation = Math.hypot(
            point[0] - origin[0],
            point[1] - origin[1],
            point[2] - origin[2]
        );
        return Math.max(maximum, separation);
    }, 0);

    if (!(maximumSeparation > 0) || !Number.isFinite(maximumSeparation)) {
        throw new Error(`Kabsch point set ${label} has insufficient spatial extent`);
    }
}

function validateRotationMatrix(rotation) {
    if (!rotation.elements.every(Number.isFinite)) {
        throw new Error('Kabsch alignment produced a non-finite rotation matrix');
    }
    const determinant = rotation.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant - 1) > 1e-8) {
        throw new Error(`Kabsch alignment produced an invalid rotation determinant (${determinant})`);
    }
    return rotation;
}

/**
 * Proper SVD for 3x3 matrices using eigendecomposition
 *
 * Computes A = U * S * V^T by:
 * 1. Compute B = A^T * A (symmetric positive semi-definite)
 * 2. Find eigenvalues and eigenvectors of B (gives V and singular values)
 * 3. Compute U = A * V * S^{-1}
 *
 * @param {Array<Array<number>>} A - 3x3 input matrix
 * @returns {{U: Array<Array<number>>, V: Array<Array<number>>}}
 *          Object containing U and V matrices from SVD decomposition
 */
export function jacobiSVD(A) {
    const maxIterations = KABSCH.MAX_ITERATIONS;
    const tolerance = KABSCH.TOLERANCE;

    // Step 1: Compute B = A^T * A (symmetric matrix)
    const At = transpose3x3(A);
    const B = multiplyMatrices3x3(At, A);

    // Step 2: Find eigenvectors of B using Jacobi eigenvalue algorithm
    // Initialize V as identity
    let V = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];

    // Copy B for iteration
    let D = [
        [B[0][0], B[0][1], B[0][2]],
        [B[1][0], B[1][1], B[1][2]],
        [B[2][0], B[2][1], B[2][2]]
    ];

    // Jacobi iteration to diagonalize B
    for (let iter = 0; iter < maxIterations; iter++) {
        // Find largest off-diagonal element
        let maxVal = 0;
        let p = 0, q = 1;

        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const val = Math.abs(D[i][j]);
                if (val > maxVal) {
                    maxVal = val;
                    p = i;
                    q = j;
                }
            }
        }

        // Check for convergence
        if (maxVal < tolerance) {
            break;
        }

        // Compute Jacobi rotation angle
        const Dpp = D[p][p];
        const Dqq = D[q][q];
        const Dpq = D[p][q];

        let c, s;
        if (Math.abs(Dpq) < tolerance) {
            c = 1;
            s = 0;
        } else {
            const theta = (Dqq - Dpp) / (2 * Dpq);
            // Math.sign(0) is zero, but equal diagonal terms with a nonzero
            // off-diagonal term require a 45-degree Jacobi rotation.
            const thetaSign = theta >= 0 ? 1 : -1;
            const t = thetaSign / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
            c = 1 / Math.sqrt(1 + t * t);
            s = c * t;
        }

        // Apply Givens rotation: D = G^T * D * G
        // This is equivalent to rotating rows p,q and then columns p,q
        const Dp = [D[p][0], D[p][1], D[p][2]];
        const Dq = [D[q][0], D[q][1], D[q][2]];

        for (let i = 0; i < 3; i++) {
            D[p][i] = c * Dp[i] - s * Dq[i];
            D[q][i] = s * Dp[i] + c * Dq[i];
        }

        for (let i = 0; i < 3; i++) {
            const Dip = D[i][p];
            const Diq = D[i][q];
            D[i][p] = c * Dip - s * Diq;
            D[i][q] = s * Dip + c * Diq;
        }

        // Update V (eigenvectors): V = V * G
        for (let i = 0; i < 3; i++) {
            const Vip = V[i][p];
            const Viq = V[i][q];
            V[i][p] = c * Vip - s * Viq;
            V[i][q] = s * Vip + c * Viq;
        }
    }

    // Step 3: Sort singular directions from largest to smallest. This is
    // essential for rank-deficient inputs: modified Gram-Schmidt must retain
    // the data-defined directions before completing the null-space basis.
    const singularOrder = [0, 1, 2].sort((a, b) =>
        D[b][b] - D[a][a] || a - b
    );
    V = V.map(row => singularOrder.map(column => row[column]));
    const singularValues = singularOrder.map(column =>
        Math.sqrt(Math.max(0, D[column][column]))
    );

    // Step 4: Compute U = A * V * S^{-1}
    const AV = multiplyMatrices3x3(A, V);
    const U = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];

    for (let j = 0; j < 3; j++) {
        if (singularValues[j] > tolerance) {
            for (let i = 0; i < 3; i++) {
                U[i][j] = AV[i][j] / singularValues[j];
            }
        } else {
            // For zero singular values, set corresponding column of U to zero
            // (will be handled by Kabsch determinant check)
            for (let i = 0; i < 3; i++) {
                U[i][j] = 0;
            }
        }
    }

    // Ensure U is orthogonal (handle numerical errors for small singular values)
    // Use Gram-Schmidt if needed
    orthogonalize(U);

    return { U, V };
}

/**
 * Orthogonalize a 3x3 matrix using modified Gram-Schmidt.
 *
 * Rank-deficient covariance matrices leave one or more SVD columns at zero.
 * Complete those columns with a deterministic orthonormal basis so Kabsch
 * always returns a proper rotation rather than a singular matrix.
 */
function orthogonalize(M) {
    const EPSILON = 1e-10;
    const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

    const getColumn = col => [M[0][col], M[1][col], M[2][col]];
    const setColumn = (col, value) => {
        M[0][col] = value[0];
        M[1][col] = value[1];
        M[2][col] = value[2];
    };
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const norm = value => Math.sqrt(dot(value, value));
    const normalize = value => {
        const length = norm(value);
        return length > EPSILON ? value.map(component => component / length) : null;
    };
    const subtractProjection = (value, axis) => {
        const projection = dot(value, axis);
        return value.map((component, i) => component - projection * axis[i]);
    };
    const cross = (a, b) => [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];

    let column0 = normalize(getColumn(0));
    if (!column0) {
        column0 = basis[0];
    }
    setColumn(0, column0);

    let column1 = normalize(subtractProjection(getColumn(1), column0));
    if (!column1) {
        // Choose the Cartesian axis least parallel to column 0, then remove
        // its projection. This is deterministic for collinear inputs.
        const fallback = basis.reduce((best, candidate) =>
            Math.abs(dot(candidate, column0)) < Math.abs(dot(best, column0))
                ? candidate
                : best
        );
        column1 = normalize(subtractProjection(fallback, column0));
    }
    setColumn(1, column1);

    setColumn(2, normalize(cross(column0, column1)));
}

/**
 * Transpose a 3x3 matrix
 * @param {Array<Array<number>>} M - 3x3 matrix
 * @returns {Array<Array<number>>} Transposed matrix
 */
export function transpose3x3(M) {
    return [
        [M[0][0], M[1][0], M[2][0]],
        [M[0][1], M[1][1], M[2][1]],
        [M[0][2], M[1][2], M[2][2]]
    ];
}

/**
 * Multiply two 3x3 matrices
 * @param {Array<Array<number>>} A - First 3x3 matrix
 * @param {Array<Array<number>>} B - Second 3x3 matrix
 * @returns {Array<Array<number>>} Result of A * B
 */
export function multiplyMatrices3x3(A, B) {
    const C = [[0,0,0], [0,0,0], [0,0,0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
}

/**
 * Calculate the determinant of a 3x3 matrix
 * @param {Array<Array<number>>} M - 3x3 matrix
 * @returns {number} Determinant value
 */
export function determinant3x3(M) {
    return M[0][0] * (M[1][1]*M[2][2] - M[1][2]*M[2][1]) -
           M[0][1] * (M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
           M[0][2] * (M[1][0]*M[2][1] - M[1][1]*M[2][0]);
}

/**
 * Convert a 3x3 rotation matrix array to a THREE.Matrix4
 * @param {Array<Array<number>>} R - 3x3 rotation matrix
 * @returns {THREE.Matrix4} 4x4 transformation matrix
 */
export function arrayToMatrix4(R) {
    const mat = new THREE.Matrix4();
    mat.set(
        R[0][0], R[0][1], R[0][2], 0,
        R[1][0], R[1][1], R[1][2], 0,
        R[2][0], R[2][1], R[2][2], 0,
        0, 0, 0, 1
    );
    return mat;
}

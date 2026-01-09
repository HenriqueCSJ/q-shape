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
 * @returns {THREE.Matrix4} Rotation matrix that aligns P to Q, or identity matrix on failure
 *
 * @example
 * const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
 * const Q = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
 * const rotationMatrix = kabschAlignment(P, Q);
 */
export default function kabschAlignment(P, Q, skipCentering = false) {
    try {
        const N = P.length;
        if (N !== Q.length || N === 0) {
            throw new Error(`Point set size mismatch: P has ${P.length}, Q has ${Q.length}`);
        }

        let P_centered, Q_centered;

        if (skipCentering) {
            // Use points as-is (they're already centered on central atom)
            P_centered = P;
            Q_centered = Q;
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

        // Early return for identical or near-identical point sets
        // (avoids SVD numerical issues with symmetric degenerate covariance matrix)
        const IDENTITY_THRESHOLD = 1e-10;
        let isIdentical = true;
        for (let i = 0; i < N && isIdentical; i++) {
            if (Math.abs(P_centered[i][0] - Q_centered[i][0]) > IDENTITY_THRESHOLD ||
                Math.abs(P_centered[i][1] - Q_centered[i][1]) > IDENTITY_THRESHOLD ||
                Math.abs(P_centered[i][2] - Q_centered[i][2]) > IDENTITY_THRESHOLD) {
                isIdentical = false;
            }
        }
        if (isIdentical) {
            return new THREE.Matrix4(); // Identity rotation
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
            return arrayToMatrix4(R_corrected);
        }

        return arrayToMatrix4(R);

    } catch (error) {
        console.warn("Kabsch alignment failed:", error.message);
        return new THREE.Matrix4(); // Return identity matrix on failure
    }
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
            const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
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

    // Step 3: Compute singular values (square roots of eigenvalues)
    const singularValues = [
        Math.sqrt(Math.max(0, D[0][0])),
        Math.sqrt(Math.max(0, D[1][1])),
        Math.sqrt(Math.max(0, D[2][2]))
    ];

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
 * Orthogonalize a 3x3 matrix using modified Gram-Schmidt with fallback
 * Handles degenerate cases where columns may be zero or near-zero
 */
function orthogonalize(M) {
    const EPSILON = 1e-10;

    // Standard basis vectors for fallback
    const e1 = [1, 0, 0];
    const e2 = [0, 1, 0];
    const e3 = [0, 0, 1];

    // Helper to compute norm
    const norm = (v) => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);

    // Helper to normalize in place, returns success
    const normalizeCol = (col) => {
        const n = norm([M[0][col], M[1][col], M[2][col]]);
        if (n > EPSILON) {
            M[0][col] /= n; M[1][col] /= n; M[2][col] /= n;
            return true;
        }
        return false;
    };

    // Helper to set column from array
    const setCol = (col, v) => {
        M[0][col] = v[0]; M[1][col] = v[1]; M[2][col] = v[2];
    };

    // Helper to get column as array
    const getCol = (col) => [M[0][col], M[1][col], M[2][col]];

    // Helper for cross product
    const cross = (a, b) => [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];

    // Helper for dot product
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

    // Column 0: normalize or use fallback
    if (!normalizeCol(0)) {
        // Column 0 is zero, use e1
        setCol(0, e1);
    }

    // Column 1: subtract projection onto column 0, then normalize
    let col0 = getCol(0);
    let col1 = getCol(1);
    let proj = dot(col0, col1);
    M[0][1] -= proj * col0[0];
    M[1][1] -= proj * col0[1];
    M[2][1] -= proj * col0[2];

    if (!normalizeCol(1)) {
        // Column 1 is zero or parallel to column 0
        // Find a vector perpendicular to column 0
        col0 = getCol(0);
        // Try crossing with e1, e2, or e3
        let perp = cross(col0, e1);
        if (norm(perp) < EPSILON) {
            perp = cross(col0, e2);
        }
        if (norm(perp) < EPSILON) {
            perp = cross(col0, e3);
        }
        const n = norm(perp);
        if (n > EPSILON) {
            setCol(1, [perp[0]/n, perp[1]/n, perp[2]/n]);
        } else {
            // Fallback: use e2 if e1 was used for col0
            setCol(1, Math.abs(col0[0]) > 0.9 ? e2 : e1);
            // Re-orthogonalize
            col0 = getCol(0);
            col1 = getCol(1);
            proj = dot(col0, col1);
            M[0][1] -= proj * col0[0];
            M[1][1] -= proj * col0[1];
            M[2][1] -= proj * col0[2];
            normalizeCol(1);
        }
    }

    // Column 2: cross product of columns 0 and 1 (guaranteed orthonormal)
    col0 = getCol(0);
    col1 = getCol(1);
    const col2 = cross(col0, col1);
    setCol(2, col2);
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

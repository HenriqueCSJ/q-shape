import * as THREE from 'three';
import { KABSCH } from '../../constants/algorithmConstants';

/**
 * IMPROVED Kabsch Algorithm with robust numerical SVD
 *
 * The Kabsch algorithm finds the optimal rotation matrix that minimizes the
 * root mean squared deviation (RMSD) between two paired sets of points.
 * This implementation uses the two-sided Jacobi algorithm for SVD,
 * providing better numerical stability than traditional methods.
 *
 * Algorithm Steps:
 * 1. Center both point sets by subtracting their centroids
 * 2. Compute the covariance matrix H = P^T * Q
 * 3. Perform Singular Value Decomposition (SVD) on H
 * 4. Calculate rotation matrix R = V * U^T
 * 5. Ensure proper rotation by checking determinant
 *
 * @param {Array<Array<number>>} P - First point set, array of [x, y, z] coordinates
 * @param {Array<Array<number>>} Q - Second point set, array of [x, y, z] coordinates
 * @returns {THREE.Matrix4} Rotation matrix that aligns P to Q, or identity matrix on failure
 *
 * @example
 * const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
 * const Q = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
 * const rotationMatrix = kabschAlignment(P, Q);
 */
export default function kabschAlignment(P, Q) {
    try {
        const N = P.length;
        if (N !== Q.length || N === 0) {
            throw new Error(`Point set size mismatch: P has ${P.length}, Q has ${Q.length}`);
        }

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
        const P_centered = P.map(p => [
            p[0] - centroidP[0],
            p[1] - centroidP[1],
            p[2] - centroidP[2]
        ]);

        const Q_centered = Q.map(q => [
            q[0] - centroidQ[0],
            q[1] - centroidQ[1],
            q[2] - centroidQ[2]
        ]);

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
 * Jacobi SVD algorithm for 3x3 matrices
 *
 * This implementation uses the two-sided Jacobi method, which iteratively
 * applies Givens rotations to diagonalize the matrix. It's more numerically
 * stable than alternative methods for small matrices.
 *
 * @param {Array<Array<number>>} A - 3x3 input matrix
 * @returns {{U: Array<Array<number>>, V: Array<Array<number>>}}
 *          Object containing U and V matrices from SVD decomposition
 */
export function jacobiSVD(A) {
    const maxIterations = KABSCH.MAX_ITERATIONS;
    const tolerance = KABSCH.TOLERANCE;

    // Initialize U and V as identity matrices
    const U = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];

    const V = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];

    // Copy A to S
    let S = [
        [A[0][0], A[0][1], A[0][2]],
        [A[1][0], A[1][1], A[1][2]],
        [A[2][0], A[2][1], A[2][2]]
    ];

    // Iterative Jacobi rotations
    for (let iter = 0; iter < maxIterations; iter++) {
        // Find largest off-diagonal element
        let maxVal = 0;
        let p = 0, q = 1;

        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const val = Math.abs(S[i][j]);
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

        // Compute Jacobi rotation
        const Spp = S[p][p];
        const Sqq = S[q][q];
        const Spq = S[p][q];

        let c, s;
        if (Math.abs(Spq) < KABSCH.TOLERANCE) {
            c = 1;
            s = 0;
        } else {
            const tau = (Sqq - Spp) / (2 * Spq);
            const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
            c = 1 / Math.sqrt(1 + t * t);
            s = c * t;
        }

        // Apply rotation to S
        const Sp = [...S[p]];
        const Sq = [...S[q]];

        for (let i = 0; i < 3; i++) {
            S[p][i] = c * Sp[i] - s * Sq[i];
            S[q][i] = s * Sp[i] + c * Sq[i];
        }

        for (let i = 0; i < 3; i++) {
            const Sip = S[i][p];
            const Siq = S[i][q];
            S[i][p] = c * Sip - s * Siq;
            S[i][q] = s * Sip + c * Siq;
        }

        // Update U and V
        for (let i = 0; i < 3; i++) {
            const Uip = U[i][p];
            const Uiq = U[i][q];
            U[i][p] = c * Uip - s * Uiq;
            U[i][q] = s * Uip + c * Uiq;

            const Vip = V[i][p];
            const Viq = V[i][q];
            V[i][p] = c * Vip - s * Viq;
            V[i][q] = s * Vip + c * Viq;
        }
    }

    return { U, V };
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

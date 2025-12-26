# Kabsch Algorithm and Singular Value Decomposition

## 1. The Kabsch Problem

### 1.1 Problem Statement

Given two sets of N corresponding points:
- **P = {p₁, p₂, ..., pₙ}**: Reference points (centered at origin)
- **Q = {q₁, q₂, ..., qₙ}**: Observed points (centered at origin)

Find the optimal rotation matrix **R** that minimizes:

$$E(R) = \sum_{i=1}^{N} ||q_i - R \cdot p_i||^2$$

Subject to:
- R is a proper rotation: R ∈ SO(3)
- det(R) = +1 (no reflections)
- RᵀR = RRᵀ = I (orthogonality)

### 1.2 Historical Context

- **Wolfgang Kabsch** (1976, 1978): Original algorithm using SVD
- **Kabsch, W.** "A solution for the best rotation to relate two sets of vectors." *Acta Crystallogr. A* **1976**, 32, 922-923.
- **Kabsch, W.** "A discussion of the solution for the best rotation to relate two sets of vectors." *Acta Crystallogr. A* **1978**, 34, 827-828.

## 2. Mathematical Derivation

### 2.1 Expanding the Objective Function

$$E(R) = \sum_i ||q_i||^2 + \sum_i ||p_i||^2 - 2\sum_i q_i^T \cdot R \cdot p_i$$

The first two terms are constant. Minimizing E is equivalent to maximizing:

$$\sum_i q_i^T \cdot R \cdot p_i = \text{tr}(Q^T R P) = \text{tr}(R \cdot P \cdot Q^T) = \text{tr}(R \cdot H)$$

Where:
- **H = P · Qᵀ** is the cross-covariance matrix (3×3)
- tr() denotes the matrix trace

### 2.2 The Covariance Matrix

$$H = \sum_{i=1}^{N} p_i \cdot q_i^T = \begin{pmatrix}
\sum p_{i,x}q_{i,x} & \sum p_{i,x}q_{i,y} & \sum p_{i,x}q_{i,z} \\
\sum p_{i,y}q_{i,x} & \sum p_{i,y}q_{i,y} & \sum p_{i,y}q_{i,z} \\
\sum p_{i,z}q_{i,x} & \sum p_{i,z}q_{i,y} & \sum p_{i,z}q_{i,z}
\end{pmatrix}$$

### 2.3 SVD Solution

Apply Singular Value Decomposition to H:

$$H = U \Sigma V^T$$

Where:
- **U**: 3×3 orthogonal matrix (left singular vectors)
- **Σ**: 3×3 diagonal matrix (singular values σ₁ ≥ σ₂ ≥ σ₃ ≥ 0)
- **V**: 3×3 orthogonal matrix (right singular vectors)

The optimal rotation is:

$$R = V \cdot U^T$$

### 2.4 Proof of Optimality

For any orthogonal matrix R:

$$\text{tr}(RH) = \text{tr}(R \cdot U \Sigma V^T) = \text{tr}(V^T R U \cdot \Sigma)$$

Let M = VᵀRU. Since R, V, U are orthogonal, M is also orthogonal.

$$\text{tr}(M \Sigma) = \sum_i M_{ii} \sigma_i \leq \sum_i \sigma_i$$

The maximum is achieved when M = I, giving R = VUᵀ.

## 3. Reflection Handling

### 3.1 The Reflection Problem

When det(VUᵀ) = -1, the "optimal rotation" includes a reflection, which is physically meaningless for molecular structures.

This occurs when:
- Points are (nearly) coplanar
- One singular value is zero or very small
- The optimal superposition requires a mirror operation

### 3.2 Correction Procedure

```
1. Compute SVD: H = UΣVᵀ
2. Calculate d = det(V) × det(U)
3. If d < 0:
   a. Negate the third column of V: V[:,3] = -V[:,3]
   b. This flips the sign of σ₃ in the trace calculation
4. Compute R = VUᵀ
```

The mathematical justification:

$$\text{tr}(R_{corrected} H) = \sigma_1 + \sigma_2 - \sigma_3$$

This is the maximum achievable trace for a proper rotation when the points require reflection.

### 3.3 Implementation

```javascript
function kabschRotation(P, Q) {
    // Build covariance matrix
    const H = buildCovarianceMatrix(P, Q);

    // SVD decomposition
    const { U, S, V } = svd(H);

    // Check for reflection
    const d = det(V) * det(U);

    if (d < 0) {
        // Correct by negating last column of V
        V[0][2] = -V[0][2];
        V[1][2] = -V[1][2];
        V[2][2] = -V[2][2];
    }

    // Optimal rotation
    return multiply(V, transpose(U));
}
```

## 4. Jacobi SVD Algorithm

### 4.1 Overview

The Jacobi method computes SVD through a sequence of plane rotations that diagonalize the matrix. For 3×3 matrices, it is:
- Numerically stable
- No external dependencies
- Suitable for embedded/worker environments

### 4.2 Two-Sided Jacobi Iteration

The algorithm applies Givens rotations from both sides:

$$H^{(k+1)} = J_L^T \cdot H^{(k)} \cdot J_R$$

Where J_L and J_R are Givens rotation matrices chosen to zero off-diagonal elements.

### 4.3 Complete Algorithm

```javascript
function jacobiSVD(A) {
    const TOLERANCE = 1e-10;
    const MAX_ITERATIONS = 100;

    // Initialize U and V as identity
    let U = [[1,0,0], [0,1,0], [0,0,1]];
    let V = [[1,0,0], [0,1,0], [0,0,1]];
    let B = copyMatrix(A);  // Working matrix

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        // Check convergence (off-diagonal sum)
        let offDiag = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (i !== j) offDiag += B[i][j] * B[i][j];
            }
        }
        if (Math.sqrt(offDiag) < TOLERANCE) break;

        // Apply Givens rotations to each pair (i,j)
        for (let i = 0; i < 2; i++) {
            for (let j = i + 1; j < 3; j++) {
                // Compute 2x2 submatrix of BᵀB
                const alpha = B[i][i]*B[i][i] + B[j][i]*B[j][i];
                const beta = B[i][j]*B[i][j] + B[j][j]*B[j][j];
                const gamma = B[i][i]*B[i][j] + B[j][i]*B[j][j];

                // Compute rotation angle for V
                const zeta = (beta - alpha) / (2 * gamma);
                const t = sign(zeta) / (Math.abs(zeta) + Math.sqrt(1 + zeta*zeta));
                const c = 1 / Math.sqrt(1 + t*t);
                const s = c * t;

                // Apply rotation to B from right (and accumulate in V)
                applyGivensRight(B, i, j, c, s);
                applyGivensRight(V, i, j, c, s);

                // Now zero out B[j][i] with left rotation
                if (Math.abs(B[j][i]) > TOLERANCE) {
                    const r = Math.hypot(B[i][i], B[j][i]);
                    const cl = B[i][i] / r;
                    const sl = B[j][i] / r;

                    applyGivensLeft(B, i, j, cl, sl);
                    applyGivensLeft(U, i, j, cl, sl);
                }
            }
        }
    }

    // Extract singular values (diagonal of B)
    const S = [Math.abs(B[0][0]), Math.abs(B[1][1]), Math.abs(B[2][2])];

    // Ensure positive singular values
    for (let i = 0; i < 3; i++) {
        if (B[i][i] < 0) {
            U[0][i] = -U[0][i];
            U[1][i] = -U[1][i];
            U[2][i] = -U[2][i];
        }
    }

    return { U, S, V };
}
```

### 4.4 Givens Rotation Matrices

A Givens rotation in the (i,j) plane by angle θ:

$$G(i,j,\theta) = \begin{pmatrix}
1 & \cdots & 0 & \cdots & 0 & \cdots & 0 \\
\vdots & \ddots & \vdots & & \vdots & & \vdots \\
0 & \cdots & c & \cdots & s & \cdots & 0 \\
\vdots & & \vdots & \ddots & \vdots & & \vdots \\
0 & \cdots & -s & \cdots & c & \cdots & 0 \\
\vdots & & \vdots & & \vdots & \ddots & \vdots \\
0 & \cdots & 0 & \cdots & 0 & \cdots & 1
\end{pmatrix}$$

Where c = cos(θ), s = sin(θ).

### 4.5 Convergence Properties

| Property | Value |
|----------|-------|
| Convergence rate | Quadratic (near solution) |
| Typical iterations | 5-15 for 3×3 matrices |
| Numerical precision | ~10⁻¹⁴ for double precision |
| Stability | Unconditionally stable |

## 5. Q-Shape Implementation

### 5.1 Main Thread (`kabsch.js`)

```javascript
export function kabschAlignment(actualCoords, refCoords) {
    // Center both point sets
    const centeredActual = centerCoordinates(actualCoords);
    const centeredRef = centerCoordinates(refCoords);

    // Build 3x3 covariance matrix
    const H = buildCovarianceMatrix(centeredActual, centeredRef);

    // Compute SVD using Jacobi method
    const svd = jacobiSVD(H);

    // Handle reflection
    const det = determinant3x3(multiply(svd.V, transpose(svd.U)));
    if (det < 0) {
        svd.V[0][2] *= -1;
        svd.V[1][2] *= -1;
        svd.V[2][2] *= -1;
    }

    // Return rotation as THREE.Matrix4
    const R = multiply(svd.V, transpose(svd.U));
    return matrix3ToMatrix4(R);
}
```

### 5.2 Web Worker Implementation

The web worker (`cshm.worker.js`) contains a complete standalone Jacobi SVD implementation to avoid dependencies:

```javascript
// Self-contained implementation for worker isolation
function jacobiSVD(A) {
    // Full implementation without external dependencies
    // Handles edge cases: zero matrix, degenerate cases
    // ...
}

function kabschAlignment(P_coords, Q_coords) {
    // Build H matrix
    const H = [[0,0,0], [0,0,0], [0,0,0]];
    for (let i = 0; i < P_coords.length; i++) {
        for (let a = 0; a < 3; a++) {
            for (let b = 0; b < 3; b++) {
                H[a][b] += P_coords[i][a] * Q_coords[i][b];
            }
        }
    }

    // SVD and rotation computation
    const { U, V } = jacobiSVD(H);
    const R = multiplyMatrices3x3(V, transpose3x3(U));

    // Reflection correction
    if (determinant3x3(R) < 0) {
        V[0][2] = -V[0][2];
        V[1][2] = -V[1][2];
        V[2][2] = -V[2][2];
        R = multiplyMatrices3x3(V, transpose3x3(U));
    }

    return rotationToMatrix4(R);
}
```

## 6. Numerical Edge Cases

### 6.1 Degenerate Configurations

| Case | Detection | Handling |
|------|-----------|----------|
| Identical points | All coordinates equal | Return identity rotation |
| Collinear points | σ₃ ≈ 0, σ₂ > 0 | Use 2D rotation |
| Coplanar points | σ₃ ≈ 0 | Check reflection carefully |
| Zero matrix | All H[i][j] ≈ 0 | Return identity rotation |

### 6.2 Numerical Tolerances

```javascript
const TOLERANCES = {
    ZERO_THRESHOLD: 1e-10,      // Near-zero detection
    CONVERGENCE: 1e-6,          // Iteration convergence
    REFLECTION_THRESHOLD: 0,     // det(R) < 0 check
    SINGULAR_VALUE_MIN: 1e-12   // Minimum singular value
};
```

### 6.3 Error Bounds

For well-conditioned problems, the Kabsch algorithm achieves:
- Rotation error: O(ε × κ(H)) where ε is machine precision
- RMSD error: O(ε × √N)
- For κ(H) ~ 1: rotation accurate to ~10⁻¹⁴

## 7. Performance Optimizations

### 7.1 SIMD-Friendly Operations

The 3×3 matrix operations are optimized for modern CPUs:

```javascript
// Unrolled 3x3 multiply
function multiply3x3(A, B) {
    return [
        [A[0][0]*B[0][0] + A[0][1]*B[1][0] + A[0][2]*B[2][0],
         A[0][0]*B[0][1] + A[0][1]*B[1][1] + A[0][2]*B[2][1],
         A[0][0]*B[0][2] + A[0][1]*B[1][2] + A[0][2]*B[2][2]],
        // ... rows 1 and 2
    ];
}
```

### 7.2 Complexity Analysis

| Operation | Complexity | Time (typical) |
|-----------|------------|----------------|
| Covariance matrix | O(N) | ~1μs for N=12 |
| Jacobi SVD | O(1)* | ~5μs |
| Matrix multiply | O(1) | ~0.5μs |
| **Total** | **O(N)** | **~10μs** |

*O(1) because matrix size is fixed at 3×3

## 8. References

1. Kabsch, W. *Acta Crystallogr. A* **1976**, 32, 922-923.
2. Kabsch, W. *Acta Crystallogr. A* **1978**, 34, 827-828.
3. Golub, G. H.; Van Loan, C. F. *Matrix Computations*, 4th ed.; Johns Hopkins University Press: Baltimore, 2013.
4. Markley, F. L. *J. Astronaut. Sci.* **1988**, 36, 245-258.
5. Söderkvist, I.; Wedin, P. A. *SIAM J. Matrix Anal. Appl.* **1993**, 14, 1175-1188.

---

*Previous: [Continuous Shape Measures](01-Continuous-Shape-Measures.md)*

*Next: [Hungarian Algorithm](03-Hungarian-Algorithm.md)*

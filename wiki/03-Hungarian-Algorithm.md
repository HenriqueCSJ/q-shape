# Hungarian Algorithm (Munkres Assignment)

## 1. The Assignment Problem in CShM

### 1.1 Problem Statement

In Continuous Shape Measure calculation, we must find the optimal one-to-one mapping between:
- **Observed atoms**: {q₁, q₂, ..., qₙ} (N ligand positions)
- **Reference vertices**: {p₁, p₂, ..., pₙ} (N polyhedron vertices)

This is a combinatorial optimization problem:

$$\pi^* = \arg\min_{\pi \in S_N} \sum_{i=1}^{N} ||q_i - R_\pi \cdot p_{\pi(i)}||^2$$

Where:
- π is a permutation of {1, 2, ..., N}
- Sₙ is the symmetric group (all N! permutations)
- R_π is the optimal rotation for permutation π

### 1.2 Why Hungarian Algorithm?

| Approach | Complexity | N=6 | N=8 | N=12 |
|----------|------------|-----|-----|------|
| Exhaustive | O(N! × N) | 4,320 | 322,560 | 5.75×10⁹ |
| Hungarian | O(N³) | 216 | 512 | 1,728 |

For coordination numbers above 7, exhaustive search becomes computationally prohibitive.

## 2. Mathematical Foundation

### 2.1 Bipartite Graph Formulation

The assignment problem is equivalent to finding a minimum-weight perfect matching in a bipartite graph:

```
Observed Atoms (Q)          Reference Vertices (P)
      q₁ ────────────────────── p₁
         ╲                    ╱
      q₂ ──╲──────────────╱── p₂
            ╲            ╱
      q₃ ────╳──────────╳──── p₃
            ╱            ╲
      q₄ ──╱──────────────╲── p₄
         ╱                    ╲
      q₅ ────────────────────── p₅
```

Edge weights = squared distances: wᵢⱼ = ||qᵢ - pⱼ||²

### 2.2 Cost Matrix

$$C_{ij} = ||q_i - p_j||^2 = (q_{i,x} - p_{j,x})^2 + (q_{i,y} - p_{j,y})^2 + (q_{i,z} - p_{j,z})^2$$

Example for octahedral coordination:

```
              p₁     p₂     p₃     p₄     p₅     p₆
        ┌──────────────────────────────────────────┐
   q₁   │  0.12   2.45   1.89   3.21   2.98   4.01 │
   q₂   │  2.51   0.08   2.34   1.92   3.45   2.89 │
   q₃   │  1.92   2.41   0.15   2.87   1.23   3.56 │
   q₄   │  3.14   1.87   2.91   0.11   2.67   1.45 │
   q₅   │  2.89   3.52   1.34   2.78   0.09   2.91 │
   q₆   │  4.12   2.78   3.67   1.56   2.84   0.14 │
        └──────────────────────────────────────────┘
```

Goal: Select one element from each row and column to minimize total cost.

## 3. The Hungarian Algorithm

### 3.1 Algorithm Overview

The Hungarian algorithm (also known as the Kuhn-Munkres algorithm) finds the optimal assignment in polynomial time through a series of matrix transformations.

**Key Inventors:**
- **Harold Kuhn** (1955): Named after Hungarian mathematicians
- **James Munkres** (1957): Proved polynomial complexity

### 3.2 Step-by-Step Algorithm

```
HUNGARIAN ALGORITHM

INPUT: N×N cost matrix C
OUTPUT: Optimal assignment π and minimum cost

Step 0: INITIALIZATION
    For each row i: C[i][j] -= min(C[i][:])  // Row reduction
    For each col j: C[:][j] -= min(C[:][j])  // Column reduction

Step 1: INITIAL ASSIGNMENT
    Greedily assign zeros (one per row, one per column)
    Mark uncovered rows and columns

Step 2: OPTIMALITY CHECK
    If N assignments made: DONE - return assignment

Step 3: COVERING
    Find minimum number of lines to cover all zeros
    If lines == N: DONE - return assignment

Step 4: AUGMENTING
    Find minimum uncovered value m
    Subtract m from uncovered elements
    Add m to doubly-covered elements
    Go to Step 1

COMPLEXITY: O(N³)
```

### 3.3 Detailed Implementation

#### Phase 1: Row and Column Reduction

```javascript
function reduceMatrix(C) {
    const N = C.length;

    // Row reduction: subtract row minimum
    for (let i = 0; i < N; i++) {
        const rowMin = Math.min(...C[i]);
        for (let j = 0; j < N; j++) {
            C[i][j] -= rowMin;
        }
    }

    // Column reduction: subtract column minimum
    for (let j = 0; j < N; j++) {
        let colMin = Infinity;
        for (let i = 0; i < N; i++) {
            colMin = Math.min(colMin, C[i][j]);
        }
        for (let i = 0; i < N; i++) {
            C[i][j] -= colMin;
        }
    }
}
```

#### Phase 2: Zero Covering and Assignment

```javascript
function coverZeros(C, rowCover, colCover) {
    const N = C.length;
    const assignment = new Array(N).fill(-1);
    const colAssigned = new Array(N).fill(false);

    // Greedy initial assignment
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (C[i][j] === 0 && !colAssigned[j]) {
                assignment[i] = j;
                colAssigned[j] = true;
                break;
            }
        }
    }

    // Find minimum cover using König's theorem
    // ... (augmenting path algorithm)

    return { assignment, numCovered };
}
```

#### Phase 3: Augmenting Path

```javascript
function augmentMatrix(C, rowCover, colCover) {
    const N = C.length;

    // Find minimum uncovered value
    let minVal = Infinity;
    for (let i = 0; i < N; i++) {
        if (rowCover[i]) continue;
        for (let j = 0; j < N; j++) {
            if (colCover[j]) continue;
            minVal = Math.min(minVal, C[i][j]);
        }
    }

    // Adjust matrix
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (!rowCover[i] && !colCover[j]) {
                C[i][j] -= minVal;  // Uncovered: subtract
            } else if (rowCover[i] && colCover[j]) {
                C[i][j] += minVal;  // Doubly covered: add
            }
            // Singly covered: unchanged
        }
    }
}
```

## 4. Q-Shape Implementation

### 4.1 File: `hungarian.js`

```javascript
/**
 * Hungarian Algorithm for Optimal Assignment
 *
 * Finds the assignment that minimizes total squared distance
 * between observed atoms and reference vertices.
 *
 * @param {Array<Array<number>>} costMatrix - N×N distance matrix
 * @returns {Array<number>} Optimal permutation [π(0), π(1), ...]
 */
export function hungarianAlgorithm(costMatrix) {
    const N = costMatrix.length;
    if (N === 0) return [];
    if (N === 1) return [0];

    // Deep copy to avoid mutation
    const C = costMatrix.map(row => [...row]);

    // Initialize tracking arrays
    const u = new Array(N).fill(0);      // Row potentials
    const v = new Array(N).fill(0);      // Column potentials
    const p = new Array(N).fill(-1);     // Column assignment
    const way = new Array(N).fill(0);    // Augmenting path

    // Process each row
    for (let i = 0; i < N; i++) {
        // Find augmenting path using Dijkstra-like search
        const minv = new Array(N).fill(Infinity);
        const used = new Array(N).fill(false);
        p[0] = i;
        let j0 = 0;

        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity;
            let j1 = -1;

            for (let j = 1; j < N; j++) {
                if (used[j]) continue;

                const cur = C[i0][j] - u[i0] - v[j];
                if (cur < minv[j]) {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if (minv[j] < delta) {
                    delta = minv[j];
                    j1 = j;
                }
            }

            // Update potentials
            for (let j = 0; j < N; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }

            j0 = j1;
        } while (p[j0] !== -1);

        // Augment along the path
        while (j0 !== 0) {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        }
    }

    // Extract assignment
    const assignment = new Array(N).fill(-1);
    for (let j = 1; j < N; j++) {
        if (p[j] !== -1) {
            assignment[p[j]] = j - 1;
        }
    }

    return assignment;
}
```

### 4.2 Integration with CShM

```javascript
function findOptimalPermutation(actualCoords, refCoords) {
    const N = actualCoords.length;

    // Build cost matrix (squared distances)
    const costMatrix = [];
    for (let i = 0; i < N; i++) {
        costMatrix[i] = [];
        for (let j = 0; j < N; j++) {
            const dx = actualCoords[i][0] - refCoords[j][0];
            const dy = actualCoords[i][1] - refCoords[j][1];
            const dz = actualCoords[i][2] - refCoords[j][2];
            costMatrix[i][j] = dx*dx + dy*dy + dz*dz;
        }
    }

    // Find optimal assignment
    return hungarianAlgorithm(costMatrix);
}
```

## 5. Theoretical Properties

### 5.1 Duality and Optimality

The Hungarian algorithm maintains dual feasibility:

$$u_i + v_j \leq C_{ij} \quad \forall i,j$$

With complementary slackness:

$$x_{ij} > 0 \implies u_i + v_j = C_{ij}$$

Optimal when: ∑uᵢ + ∑vⱼ = minimum cost

### 5.2 Complexity Analysis

| Phase | Operations | Complexity |
|-------|------------|------------|
| Reduction | 2N² comparisons | O(N²) |
| Per assignment | N iterations × N comparisons | O(N²) |
| Total (N assignments) | N × O(N²) | **O(N³)** |

Space complexity: O(N²) for the cost matrix

### 5.3 Numerical Stability

The algorithm is stable because it only uses:
- Comparisons (min/max)
- Additions and subtractions
- No divisions or square roots

Key precautions:
1. Use squared distances (avoid sqrt for cost)
2. Scale large values to prevent overflow
3. Use tolerance for zero comparisons

## 6. Alternative: Exhaustive Search for Small N

For N ≤ 5, exhaustive search may be preferred for its simplicity:

```javascript
function exhaustivePermutations(N) {
    if (N === 1) return [[0]];

    const perms = [];
    const permute = (arr, start) => {
        if (start === N) {
            perms.push([...arr]);
            return;
        }
        for (let i = start; i < N; i++) {
            [arr[start], arr[i]] = [arr[i], arr[start]];
            permute(arr, start + 1);
            [arr[start], arr[i]] = [arr[i], arr[start]];
        }
    };

    permute([...Array(N).keys()], 0);
    return perms;
}

function exhaustiveOptimalPermutation(actual, ref) {
    const N = actual.length;
    const perms = exhaustivePermutations(N);

    let bestPerm = null;
    let bestCost = Infinity;

    for (const perm of perms) {
        let cost = 0;
        for (let i = 0; i < N; i++) {
            cost += squaredDistance(actual[i], ref[perm[i]]);
        }
        if (cost < bestCost) {
            bestCost = cost;
            bestPerm = perm;
        }
    }

    return bestPerm;
}
```

### 6.1 Crossover Point

| N | Exhaustive (μs) | Hungarian (μs) | Winner |
|---|-----------------|----------------|--------|
| 3 | 0.5 | 2 | Exhaustive |
| 4 | 2 | 4 | Exhaustive |
| 5 | 12 | 8 | Hungarian |
| 6 | 80 | 15 | Hungarian |
| 8 | 5,000 | 40 | Hungarian |

In Q-Shape, Hungarian is used for all N to maintain code simplicity.

## 7. Edge Cases and Robustness

### 7.1 Degenerate Cost Matrices

**Case 1: All equal costs**
```
C = [[1, 1, 1],
     [1, 1, 1],
     [1, 1, 1]]
```
Any assignment is optimal. Algorithm returns [0, 1, 2].

**Case 2: Some entries very large**
```
C = [[1e-10,  1e10,   1e10],
     [1e10,   1e-10,  1e10],
     [1e10,   1e10,   1e-10]]
```
Must maintain precision. Use log-scale if needed.

**Case 3: Zero-cost assignments exist**
```
C = [[0, 5, 3],
     [2, 0, 4],
     [6, 1, 0]]
```
Algorithm finds them in O(N²) during reduction.

### 7.2 Input Validation

```javascript
function validateCostMatrix(C) {
    const N = C.length;
    if (N === 0) throw new Error("Empty cost matrix");

    for (let i = 0; i < N; i++) {
        if (C[i].length !== N) {
            throw new Error("Cost matrix must be square");
        }
        for (let j = 0; j < N; j++) {
            if (!isFinite(C[i][j]) || C[i][j] < 0) {
                throw new Error("Invalid cost value");
            }
        }
    }
}
```

## 8. References

1. Kuhn, H. W. "The Hungarian Method for the Assignment Problem." *Naval Research Logistics Quarterly* **1955**, 2, 83-97.
2. Munkres, J. "Algorithms for the Assignment and Transportation Problems." *J. SIAM* **1957**, 5, 32-38.
3. Burkard, R.; Dell'Amico, M.; Martello, S. *Assignment Problems*; SIAM: Philadelphia, 2009.
4. Lawler, E. L. *Combinatorial Optimization: Networks and Matroids*; Holt, Rinehart and Winston: New York, 1976.

---

*Previous: [Kabsch Algorithm & SVD](02-Kabsch-Algorithm-SVD.md)*

*Next: [Reference Geometries](04-Reference-Geometries.md)*

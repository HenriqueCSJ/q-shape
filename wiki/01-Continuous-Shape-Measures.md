# Continuous Shape Measures (CShM) - Mathematical Theory

## 1. Introduction and Historical Context

Continuous Shape Measures (CShM) provide a quantitative metric for evaluating the degree of distortion of a molecular structure from an ideal reference polyhedron. The methodology was developed by Avnir, Pinsky, and colleagues at the Hebrew University of Jerusalem in the 1990s.

### Key Publications

1. **Zabrodsky, H.; Peleg, S.; Avnir, D.** (1992). "Continuous Symmetry Measures." *J. Am. Chem. Soc.*, 114, 7843-7851.
2. **Pinsky, M.; Avnir, D.** (1998). "Continuous Symmetry Measures. 5. The Classical Polyhedra." *Inorg. Chem.*, 37, 5575-5582.
3. **Alvarez, S.; Alemany, P.; Casanova, D.; Cirera, J.; Llunell, M.; Avnir, D.** (2005). "Shape maps and polyhedral interconversion paths in transition metal chemistry." *Coord. Chem. Rev.*, 249, 1693-1708.

## 2. Mathematical Definition

### 2.1 Formal Definition

The Continuous Shape Measure S(Q, P) quantifies the minimal distance between an observed structure Q and a reference polyhedron P:

$$S(Q, P) = 100 \times \min_{\{R, s, \pi\}} \frac{\sum_{i=1}^{N} |\mathbf{q}_i - s \cdot R \cdot \mathbf{p}_{\pi(i)}|^2}{\sum_{i=1}^{N} |\mathbf{q}_i - \mathbf{q}_0|^2}$$

Where:
- **Q = {q₁, q₂, ..., qₙ}**: Observed atomic positions (ligand coordinates)
- **P = {p₁, p₂, ..., pₙ}**: Reference polyhedron vertices
- **q₀**: Centroid of observed structure
- **R**: Optimal rotation matrix (3×3, det(R) = 1)
- **s**: Scaling factor (size normalization)
- **π**: Optimal permutation mapping atoms to vertices
- **N**: Coordination number

### 2.2 Normalization and Scale Invariance

The denominator normalizes the measure by the size of the structure, making CShM scale-invariant. After normalization to unit size:

$$\sum_{i=1}^{N} |\mathbf{q}_i - \mathbf{q}_0|^2 = N$$

The normalized CShM becomes:

$$S(Q, P) = 100 \times \frac{1}{N} \sum_{i=1}^{N} |\mathbf{q}_i^{norm} - R \cdot \mathbf{p}_{\pi(i)}|^2$$

### 2.3 Properties of CShM

| Property | Value | Interpretation |
|----------|-------|----------------|
| Minimum | 0 | Perfect match to reference |
| Maximum | 100 | Maximum possible distortion |
| Typical range | 0-30 | Most coordination complexes |
| Scale | Quadratic | Proportional to squared distance |

## 3. Algorithmic Implementation

### 3.1 Pre-processing Steps

#### Step 1: Centering
Translate both structures to place their centroids at the origin:

```
q̄ = (1/N) Σᵢ qᵢ           // Centroid of observed structure
qᵢ' = qᵢ - q̄              // Centered observed coordinates

p̄ = (1/N) Σᵢ pᵢ           // Centroid of reference (usually already at origin)
pᵢ' = pᵢ - p̄              // Centered reference coordinates
```

#### Step 2: Size Normalization
Normalize to unit radius of gyration:

```
Rg² = (1/N) Σᵢ |qᵢ'|²      // Squared radius of gyration

qᵢ^norm = qᵢ' / Rg         // Normalized coordinates
```

This ensures the structure lies on a unit sphere, making the measure size-independent.

### 3.2 The Three-Step Optimization

The CShM calculation requires solving three nested optimization problems:

```
┌─────────────────────────────────────────────────────────────┐
│  OUTER LOOP: Permutation Optimization                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MIDDLE: Rotation Optimization (Kabsch Algorithm)      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  INNER: SVD Computation                          │  │  │
│  │  │  - Build covariance matrix H                     │  │  │
│  │  │  - Compute H = UΣVᵀ via Jacobi iteration        │  │  │
│  │  │  - Extract optimal rotation R = VUᵀ             │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Computational Complexity

| Component | Algorithm | Complexity |
|-----------|-----------|------------|
| Permutation (exhaustive) | Brute force | O(N!) |
| Permutation (Hungarian) | Munkres | O(N³) |
| Rotation | Kabsch + SVD | O(N) |
| Total (with Hungarian) | Combined | O(N³) |

For N=12 (icosahedron):
- Exhaustive: 479,001,600 permutations
- Hungarian: ~1,728 operations

## 4. Interpretation Scale

### 4.1 Standard Interpretation

| CShM Value | Classification | Physical Interpretation |
|------------|----------------|-------------------------|
| < 0.1 | Perfect | Essentially ideal geometry |
| 0.1 - 0.5 | Excellent | Minor thermal distortions |
| 0.5 - 1.5 | Very Good | Small systematic deviations |
| 1.5 - 3.0 | Good | Moderate distortion, clear geometry |
| 3.0 - 7.5 | Moderate | Significant distortion |
| 7.5 - 15.0 | Poor | Highly distorted |
| > 15.0 | Very Poor | Different geometry or no match |

### 4.2 RMSD Relationship

For unit-normalized coordinates, the approximate RMSD can be derived:

$$RMSD_{approx} = \sqrt{\frac{CShM}{100}}$$

**Important caveat**: This RMSD is on the unit sphere and reflects angular deviation only. It should not be directly compared with Cartesian RMSD values in Ångströms.

## 5. Multiple Reference Comparison

### 5.1 Shape Maps

When comparing a structure against multiple reference geometries, the results form a "shape map" showing the relationship between different ideal polyhedra.

For coordination number N, evaluate:
```
S₁ = S(Q, Octahedron)
S₂ = S(Q, Trigonal Prism)
S₃ = S(Q, ...)
```

The geometry with minimum S value is the "best match."

### 5.2 Pathway Analysis

For polyhedral interconversion (e.g., Berry pseudorotation), the shape measure provides a continuous coordinate:

```
Pathway coordinate = S(Q, P₁) / (S(Q, P₁) + S(Q, P₂))
```

This gives a value from 0 (pure P₁) to 1 (pure P₂).

## 6. Q-Shape Implementation Details

### 6.1 File: `shapeCalculator.js`

The core CShM calculation follows this workflow:

```javascript
function calculateShapeMeasure(actualCoords, refCoords, mode) {
    // 1. Center and normalize coordinates
    const normActual = normalizeCoordinates(actualCoords);
    const normRef = normalizeCoordinates(refCoords);

    // 2. Find optimal permutation (Hungarian algorithm)
    const permutation = findOptimalPermutation(normActual, normRef);

    // 3. Apply permutation and find optimal rotation (Kabsch)
    const permutedRef = applyPermutation(normRef, permutation);
    const rotation = kabschAlignment(normActual, permutedRef);

    // 4. Calculate final CShM
    const aligned = applyRotation(permutedRef, rotation);
    const cshm = 100 * meanSquaredDistance(normActual, aligned);

    return cshm;
}
```

### 6.2 Optimization Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `fast` | Hungarian only, single alignment | Quick screening |
| `default` | Hungarian + refinement | Standard analysis |
| `intensive` | Multiple starting points + simulated annealing | Publication-quality |

### 6.3 Intensive Mode Parameters

```javascript
const INTENSIVE_CONFIG = {
    multiStartCount: 8,          // Random initial rotations
    maxIterations: 50,           // Refinement iterations per start
    convergenceThreshold: 1e-6,  // Convergence criterion
    simulatedAnnealing: {
        initialTemp: 0.5,
        coolingRate: 0.95,
        minTemp: 0.001
    }
};
```

## 7. Numerical Considerations

### 7.1 Precision Requirements

- **Double precision (64-bit)**: Required for rotation matrices
- **Convergence threshold**: 10⁻⁶ for iterative algorithms
- **Tolerance for degeneracy detection**: 10⁻¹⁰

### 7.2 Edge Cases

1. **Coplanar structures**: Require special handling in SVD
2. **Linear structures (CN=2)**: Degenerate case, use angle comparison
3. **Single atom (CN=1)**: Trivially CShM = 0
4. **Identical coordinates**: Check for degeneracy before normalization

### 7.3 Reflection Handling

The Kabsch algorithm may produce an improper rotation (det(R) = -1). This is corrected by:

```javascript
if (det(R) < 0) {
    // Negate the column corresponding to smallest singular value
    V[2] = -V[2];
    R = V * Uᵀ;  // Recalculate rotation
}
```

## 8. References

1. Zabrodsky, H.; Peleg, S.; Avnir, D. *J. Am. Chem. Soc.* **1992**, 114, 7843-7851.
2. Pinsky, M.; Avnir, D. *Inorg. Chem.* **1998**, 37, 5575-5582.
3. Casanova, D.; Cirera, J.; Llunell, M.; Alemany, P.; Avnir, D.; Alvarez, S. *J. Am. Chem. Soc.* **2004**, 126, 1755-1763.
4. Alvarez, S.; Alemany, P.; Casanova, D.; Cirera, J.; Llunell, M.; Avnir, D. *Coord. Chem. Rev.* **2005**, 249, 1693-1708.
5. Alvarez, S. *Chem. Rev.* **2015**, 115, 13447-13483.

---

*Next: [Kabsch Algorithm & SVD](02-Kabsch-Algorithm-SVD.md)*

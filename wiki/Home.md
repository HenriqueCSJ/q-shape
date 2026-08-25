# Q-Shape Scientific Documentation

## Quantitative Shape Analyzer for Coordination Geometry

Q-Shape is a web-based tool for analyzing the geometry of coordination complexes using Continuous Shape Measures (CShM). This documentation provides in-depth scientific and algorithmic details for researchers and developers.

---

## Table of Contents

### Core Theory

1. **[Continuous Shape Measures](01-Continuous-Shape-Measures.md)**
   - Mathematical definition and derivation
   - Normalization and scale invariance
   - Numerical reporting domain
   - Historical context and key references

2. **[Kabsch Algorithm & SVD](02-Kabsch-Algorithm-SVD.md)**
   - Optimal rotation problem
   - Jacobi SVD implementation
   - Reflection handling
   - Numerical considerations

3. **[Hungarian Algorithm](03-Hungarian-Algorithm.md)**
   - Assignment problem formulation
   - Munkres algorithm details
   - Complexity analysis
   - Exhaustive search comparison

### Reference Data

4. **[Reference Geometries](04-Reference-Geometries.md)**
   - Complete catalog of 92 polyhedra (CN 2-12+)
   - SHAPE 2.1 and CoSyMlib sources
   - Coordinate definitions
   - Symmetry classifications

### Structural Summaries

5. **[Structural Summary Statistics](05-Structural-Summaries.md)**
   - Bond length statistics
   - Ligand-metal-ligand angle statistics
   - Scientific reporting boundaries

### Special Cases

6. **[Heuristic Planar-Cycle Descriptors](06-Ring-Detection-Hapticity.md)**
   - π-coordination handling
   - Aromatic ring detection
   - Informational centroid and cycle-size descriptors
   - No chemical hapticity or sandwich-topology assignment

---

## Quick Reference

### CShM numerical reporting

Q-Shape reports finite CShM values in `[0, 100]`. Lower values indicate a
closer match to a tested reference geometry. Q-Shape does not convert numerical
ranges into qualitative classes, probabilities, or confidence estimates.

### Key Equations

**Continuous Shape Measure:**
$$S(Q, P) = 100 \times \min_{\{R, \pi\}} \frac{\sum_{i=1}^{N} |\mathbf{q}_i - R \cdot \mathbf{p}_{\pi(i)}|^2}{\sum_{i=1}^{N} |\mathbf{q}_i|^2}$$

**Kabsch Rotation:**
$$R = V \cdot U^T \quad \text{where} \quad H = U \Sigma V^T$$

---

## Algorithm Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT STRUCTURE                          │
│                    (XYZ coordinates)                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. COORDINATION SPHERE DETECTION                               │
│     - Identify metal center                                      │
│     - Find coordinating atoms within radius                      │
│     - Flag planar-cycle candidates (informational heuristic)     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. COORDINATE PREPROCESSING                                    │
│     - Center at metal position                                   │
│     - Normalize to unit sphere                                   │
│     - Extract ligand vectors                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CShM CALCULATION (for each reference geometry)             │
│                                                                  │
│     ┌─────────────────────────────────────────────────┐         │
│     │  a. HUNGARIAN ALGORITHM                          │         │
│     │     Find optimal atom-to-vertex assignment       │         │
│     └─────────────────────┬───────────────────────────┘         │
│                           │                                      │
│                           ▼                                      │
│     ┌─────────────────────────────────────────────────┐         │
│     │  b. KABSCH ALIGNMENT                            │         │
│     │     Find optimal rotation (SVD)                 │         │
│     └─────────────────────┬───────────────────────────┘         │
│                           │                                      │
│                           ▼                                      │
│     ┌─────────────────────────────────────────────────┐         │
│     │  c. COMPUTE CShM                                │         │
│     │     Calculate mean squared deviation            │         │
│     └─────────────────────────────────────────────────┘         │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. RESULTS RANKING                                             │
│     - Sort geometries by CShM (lowest = best)                   │
│     - Calculate structural summary statistics                    │
│     - Validate the CShM reporting domain [0, 100]                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OUTPUT REPORT                              │
│  - Best matching geometry                                        │
│  - CShM values for all tested geometries                        │
│  - Bond-length and angle summary statistics                     │
│  - Visualization of aligned structures                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supported Geometries by Coordination Number

| CN | Count | Examples |
|----|-------|----------|
| 2 | 3 | Linear, V-shape, L-shape |
| 3 | 4 | Trigonal planar, T-shaped, Pyramidal |
| 4 | 4 | Tetrahedral, Square planar, See-saw |
| 5 | 5 | TBP, Square pyramid, Pentagon |
| 6 | 5 | Octahedral, Trigonal prism, Hexagon |
| 7 | 7 | Pentagonal bipyramid, Capped octahedron |
| 8 | 13 | Square antiprism, Cube, Dodecahedron |
| 9 | 9 | Tricapped trigonal prism, Muffin |
| 10 | 9 | Bicapped square antiprism |
| 11 | 7 | Capped pentagonal antiprism |
| 12 | 5 | Icosahedron, Cuboctahedron |
| 20+ | 4 | Dodecahedron, Truncated structures |

**Total: 92 reference geometries**

---

## Key References

### Foundational CShM Papers

1. Zabrodsky, H.; Peleg, S.; Avnir, D. "Continuous Symmetry Measures." *J. Am. Chem. Soc.* **1992**, 114, 7843-7851.

2. Pinsky, M.; Avnir, D. "Continuous Symmetry Measures. 5. The Classical Polyhedra." *Inorg. Chem.* **1998**, 37, 5575-5582.

3. Casanova, D.; Cirera, J.; Llunell, M.; Alemany, P.; Avnir, D.; Alvarez, S. *J. Am. Chem. Soc.* **2004**, 126, 1755-1763.

4. Alvarez, S.; Alemany, P.; Casanova, D.; Cirera, J.; Llunell, M.; Avnir, D. "Shape maps and polyhedral interconversion paths in transition metal chemistry." *Coord. Chem. Rev.* **2005**, 249, 1693-1708.

### Algorithm References

5. Kabsch, W. "A solution for the best rotation to relate two sets of vectors." *Acta Crystallogr. A* **1976**, 32, 922-923.

6. Kuhn, H. W. "The Hungarian Method for the Assignment Problem." *Naval Res. Logist. Quarterly* **1955**, 2, 83-97.

### Software

7. Llunell, M.; Casanova, D.; Cirera, J.; Bofill, J. M.; Alemany, P.; Alvarez, S. *SHAPE 2.1*; Universitat de Barcelona: Barcelona, 2013.

---

## Technical Implementation

### Technology Stack

- **Frontend**: React.js, Three.js (3D visualization)
- **Algorithms**: JavaScript, including `munkres-js` for assignment
- **SVD**: Custom Jacobi SVD implementation

### Performance

No release-candidate runtime or memory benchmark is currently frozen. Runtime
depends on coordination number, selected mode, browser, and hardware; benchmark
claims will be added only from a version-bound protocol.

### Browser qualification

The build targets current mainstream browser families, but the frozen
cross-browser campaign for `1.6.0-rc.1` is pending. See the
[validation protocol](../validation/protocol.md) for the claim boundary.

---

## Contributing

Q-Shape is being prepared for peer-reviewed publication. Contributions should
preserve explicit numerical domains, deterministic test fixtures where
applicable, source-linked reference data, and the separation between
engineering tests and scientific validation. The current candidate does not
claim complete provenance, browser qualification, or scientific parity.

---

## License

Q-Shape is open source software for academic and research use.

---

*Last updated: August 2026*

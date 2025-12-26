# Reference Geometries Database

## 1. Overview

Q-Shape includes a comprehensive library of **92 reference polyhedra** for coordination numbers 2-12 and select high-coordination geometries. The reference coordinates are sourced from:

1. **SHAPE 2.1** (Universitat de Barcelona): 87 geometries for CN 2-12
2. **CoSyMlib** (Continuous Symmetry Measures Library): Additional high-symmetry references

### Key References

1. Llunell, M.; Casanova, D.; Cirera, J.; Bofill, J. M.; Alemany, P.; Alvarez, S. *SHAPE 2.1*; Universitat de Barcelona: Barcelona, 2013.
2. Zabrodsky, H.; Peleg, S.; Avnir, D. *J. Am. Chem. Soc.* **1992**, 114, 7843-7851.
3. Alvarez, S. *Dalton Trans.* **2005**, 2209-2233.

## 2. Geometry Naming Convention

Each geometry is designated using a standardized nomenclature:

```
[PREFIX]-[CN]: Description

PREFIX codes:
  L     = Linear
  vT    = Vacant Tetrahedron
  vOC   = Vacant Octahedron
  TP    = Trigonal Planar
  T     = Tetrahedral
  SP    = Square Planar
  SS    = Seesaw
  TBPY  = Trigonal Bipyramidal
  SPY   = Square Pyramidal
  OC    = Octahedral
  TPR   = Trigonal Prism
  PBPY  = Pentagonal Bipyramidal
  SAPR  = Square Antiprism
  TDD   = Triangular Dodecahedron
  CU    = Cube
  CSAPR = Capped Square Antiprism
  JTCTPR = Johnson Tricapped Trigonal Prism
  IC    = Icosahedron
  C     = Cuboctahedron
```

## 3. Complete Geometry Catalog

### 3.1 Coordination Number 2 (3 geometries)

| Code | Name | Symmetry | Description |
|------|------|----------|-------------|
| L-2 | Linear | D∞h | 180° angle, two opposite positions |
| vT-2 | Divacant Tetrahedron | C2v | V-shaped, 109.47° angle |
| vOC-2 | Tetravacant Octahedron | C2v | L-shaped, 90° angle |

**Vertex Coordinates (normalized):**

```
L-2:   [1, 0, 0], [-1, 0, 0]
vT-2:  [0.802, 0.802, 0.267], [-0.802, -0.802, 0.267]
vOC-2: [0.894, -0.447, 0], [-0.447, 0.894, 0]
```

### 3.2 Coordination Number 3 (4 geometries)

| Code | Name | Symmetry | Angles |
|------|------|----------|--------|
| TP-3 | Trigonal Planar | D3h | 120°, 120°, 120° |
| vT-3 | Vacant Tetrahedron | C3v | ~106.7° |
| fac-vOC-3 | fac-Trivacant Octahedron | C3v | 90°, 90°, 90° |
| mer-vOC-3 | mer-Trivacant Octahedron | C2v | T-shaped, 90°, 90°, 180° |

### 3.3 Coordination Number 4 (4 geometries)

| Code | Name | Symmetry | Common Examples |
|------|------|----------|-----------------|
| T-4 | Tetrahedral | Td | [ZnCl₄]²⁻, [NiCl₄]²⁻ |
| SP-4 | Square Planar | D4h | [PtCl₄]²⁻, [Ni(CN)₄]²⁻ |
| SS-4 | Seesaw | C2v | SF₄, [TeCl₄]²⁻ |
| vTBPY-4 | Axially Vacant TBP | C3v | Distorted tetrahedral |

**Tetrahedral coordinates:**
```javascript
T-4: [
  [ 0.000,  0.913, -0.645],
  [ 0.000, -0.913, -0.645],
  [ 0.913,  0.000,  0.645],
  [-0.913,  0.000,  0.645]
]
// Ideal tetrahedral angle: arccos(-1/3) ≈ 109.47°
```

### 3.4 Coordination Number 5 (5 geometries)

| Code | Name | Symmetry | τ₅ Value |
|------|------|----------|----------|
| PP-5 | Planar Pentagon | D5h | N/A |
| vOC-5 | Vacant Octahedron | C4v | 0.00 |
| SPY-5 | Square Pyramid | C4v | 0.00 |
| TBPY-5 | Trigonal Bipyramid | D3h | 1.00 |
| JTBPY-5 | Johnson TBP (J12) | D3h | 1.00 |

**τ₅ Parameter (Addison):**
$$\tau_5 = \frac{\beta - \alpha}{60°}$$

Where α and β are the two largest angles. τ₅ = 0 for square pyramid, τ₅ = 1 for trigonal bipyramid.

### 3.5 Coordination Number 6 (5 geometries)

| Code | Name | Symmetry | Trans Angles |
|------|------|----------|--------------|
| HP-6 | Hexagonal Planar | D6h | 180° |
| PPY-6 | Pentagonal Pyramid | C5v | N/A |
| OC-6 | Octahedron | Oh | 180°, 180°, 180° |
| TPR-6 | Trigonal Prism | D3h | ~82° |
| JPPY-6 | Johnson Pentagonal Pyr. | C5v | N/A |

**Octahedral coordinates:**
```javascript
OC-6: [
  [ 0.000,  0.000, -1.080],  // -z (apical)
  [ 1.080,  0.000,  0.000],  // +x
  [ 0.000,  1.080,  0.000],  // +y
  [-1.080,  0.000,  0.000],  // -x
  [ 0.000, -1.080,  0.000],  // -y
  [ 0.000,  0.000,  1.080]   // +z (apical)
]
```

**Berry Pseudorotation Pathway:**
```
Square Pyramid (SPY-5) ⟷ Trigonal Bipyramid (TBPY-5)
         τ₅ = 0                    τ₅ = 1

For CN=6: Octahedron ⟷ Trigonal Prism (Bailar twist)
```

### 3.6 Coordination Number 7 (7 geometries)

| Code | Name | Symmetry |
|------|------|----------|
| HP-7 | Heptagonal Planar | D7h |
| HPY-7 | Hexagonal Pyramid | C6v |
| PBPY-7 | Pentagonal Bipyramid | D5h |
| COC-7 | Capped Octahedron | C3v |
| CTPR-7 | Capped Trigonal Prism | C2v |
| JPBPY-7 | Johnson Pentagonal Bipyramid | D5h |
| JETPY-7 | Johnson Elongated Triangular Pyramid | C3v |

### 3.7 Coordination Number 8 (13 geometries)

| Code | Name | Symmetry | Common in |
|------|------|----------|-----------|
| OP-8 | Octagonal Planar | D8h | Rare |
| HPY-8 | Heptagonal Pyramid | C7v | Rare |
| HBPY-8 | Hexagonal Bipyramid | D6h | Some U complexes |
| CU-8 | Cube | Oh | [UF₈]³⁻ |
| SAPR-8 | Square Antiprism | D4d | [Mo(CN)₈]⁴⁻ |
| TDD-8 | Triangular Dodecahedron | D2d | [Mo(CN)₈]³⁻ |
| JGBF-8 | Gyrobifastigium | D2d | Rare |
| JETBPY-8 | Johnson Elong. TBP | D3h | Rare |
| JBTPR-8 | Biaugmented Trigonal Prism | C2v | Rare |
| BTPR-8 | Bicapped Trigonal Prism | D3h | Rare |
| JSD-8 | Snub Disphenoid | D2d | Rare |
| TT-8 | Triakis Tetrahedron | Td | Rare |
| ETBPY-8 | Elongated TBP | D3h | Rare |

**Square Antiprism coordinates:**
```javascript
SAPR-8: [
  [ 0.645,  0.645, -0.542],   // Top square (rotated 45°)
  [-0.645,  0.645, -0.542],
  [-0.645, -0.645, -0.542],
  [ 0.645, -0.645, -0.542],
  [ 0.912,  0.000,  0.542],   // Bottom square
  [ 0.000,  0.912,  0.542],
  [-0.912,  0.000,  0.542],
  [ 0.000, -0.912,  0.542]
]
```

### 3.8 Coordination Number 9 (9 geometries)

| Code | Name | Symmetry |
|------|------|----------|
| EP-9 | Enneagonal Planar | D9h |
| OPY-9 | Octagonal Pyramid | C8v |
| HBPY-9 | Heptagonal Bipyramid | D7h |
| JTC-9 | Tricapped Trigonal Prism | D3h |
| JCSAPR-9 | Capped Square Antiprism | C4v |
| JCCU-9 | Capped Cube | C4v |
| CCU-9 | Spherical Capped Cube | C4v |
| JCSA-9 | Johnson Capped Square Antiprism | C4v |
| MFF-9 | Muffin | Cs |

### 3.9 Coordination Number 10 (9 geometries)

| Code | Name | Symmetry |
|------|------|----------|
| DP-10 | Decagonal Planar | D10h |
| EPY-10 | Enneagonal Pyramid | C9v |
| OBPY-10 | Octagonal Bipyramid | D8h |
| PPR-10 | Pentagonal Prism | D5h |
| PAPR-10 | Pentagonal Antiprism | D5d |
| JBCSAPR-10 | Bicapped Square Antiprism | D4d |
| JBCCU-10 | Bicapped Cube | D4h |
| JMBIC-10 | Metabidiminished Icosahedron | C2v |
| JSPC-10 | Sphenocorona | C2v |

### 3.10 Coordination Number 11 (7 geometries)

| Code | Name | Symmetry |
|------|------|----------|
| HP-11 | Hendecagonal Planar | D11h |
| DPY-11 | Decagonal Pyramid | C10v |
| EBPY-11 | Enneagonal Bipyramid | D9h |
| JCPAPR-11 | Capped Pentagonal Antiprism | C5v |
| JCPPR-11 | Capped Pentagonal Prism | C5v |
| JTCTPR-11 | Johnson Tricapped Trigonal Prism | D3h |
| JCSA-11 | Augmented Sphenocorona | Cs |

### 3.11 Coordination Number 12 (5 geometries)

| Code | Name | Symmetry | Common in |
|------|------|----------|-----------|
| HP-12 | Dodecagonal Planar | D12h | Rare |
| HPY-12 | Hendecagonal Pyramid | C11v | Rare |
| ICOSAHEDRON | Icosahedron | Ih | [Ce(NO₃)₆]³⁻ |
| CUBOCTAHEDRON | Cuboctahedron | Oh | Some f-block |
| ACOCO-12 | Anticuboctahedron | D3d | Rare |

**Icosahedral coordinates:**
```javascript
ICOSAHEDRON-12: [
  [     0,     1,   phi],
  [     0,    -1,   phi],
  [     0,     1,  -phi],
  [     0,    -1,  -phi],
  [     1,   phi,     0],
  [    -1,   phi,     0],
  [     1,  -phi,     0],
  [    -1,  -phi,     0],
  [   phi,     0,     1],
  [  -phi,     0,     1],
  [   phi,     0,    -1],
  [  -phi,     0,    -1]
]
// Where phi = (1 + √5)/2 ≈ 1.618 (golden ratio)
```

### 3.12 High Coordination Numbers (CoSyMlib)

| CN | Code | Name | Symmetry |
|----|------|------|----------|
| 20 | DODECAHEDRON-20 | Dodecahedron | Ih |
| 24 | TRUNCATED-OCTAHEDRON-24 | Truncated Octahedron | Oh |
| 48 | TRUNCATED-CUBOCTAHEDRON-48 | Truncated Cuboctahedron | Oh |
| 60 | TRUNCATED-ICOSAHEDRON-60 | Buckyball (C₆₀) | Ih |

## 4. Mathematical Formulation

### 4.1 Coordinate Normalization

All reference coordinates are normalized to the unit sphere:

$$\mathbf{p}_i^{norm} = \frac{\mathbf{p}_i}{||\mathbf{p}_i||}$$

This ensures:
1. Scale invariance in CShM comparison
2. Consistent comparison across different polyhedra
3. Simplified RMSD interpretation

### 4.2 Centering

Reference polyhedra are centered at the origin:

$$\sum_{i=1}^{N} \mathbf{p}_i = \mathbf{0}$$

### 4.3 Symmetry Considerations

For highly symmetric geometries, there are multiple equivalent orientations:

| Geometry | Point Group | Equivalent Orientations |
|----------|-------------|------------------------|
| Tetrahedron | Td | 12 |
| Octahedron | Oh | 24 |
| Icosahedron | Ih | 60 |
| Cube | Oh | 24 |

The Hungarian algorithm naturally handles these by finding the optimal atom-to-vertex mapping.

## 5. Geometry Generation Functions

### 5.1 Regular Polygon Generation

```javascript
function generateRegularPolygon(n) {
    const coords = [];
    for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}
```

### 5.2 Bipyramid Generation

```javascript
function generateBipyramid(n) {
    // Apical vertices
    const coords = [[0, 0, 1], [0, 0, -1]];

    // Equatorial vertices
    for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }

    return coords.map(normalize);
}
```

### 5.3 Antiprism Generation

```javascript
function generateAntiprism(n, twistAngle = Math.PI / n) {
    const coords = [];
    const h = 0.5;  // Height of each layer

    // Top layer
    for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
    }

    // Bottom layer (rotated)
    for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n + twistAngle;
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }

    return coords.map(normalize);
}
```

## 6. Quality Metrics for Geometry Assignment

### 6.1 Confidence Levels

| CShM Range | Confidence | Geometry Assignment |
|------------|------------|---------------------|
| 0 - 0.5 | Very High | Definitive match |
| 0.5 - 1.5 | High | Clear match with minor distortion |
| 1.5 - 3.0 | Moderate | Match with significant distortion |
| 3.0 - 7.5 | Low | Possible match, consider alternatives |
| > 7.5 | Very Low | Likely different geometry |

### 6.2 Distinguishing Similar Geometries

Some geometry pairs are closely related and may have similar CShM values:

| Pair | Relationship | Distinguishing Feature |
|------|--------------|------------------------|
| T-4 / SS-4 | Tetrahedral distortion | τ₄ parameter |
| SPY-5 / TBPY-5 | Berry pseudorotation | τ₅ = (β-α)/60° |
| OC-6 / TPR-6 | Bailar twist | Twist angle |
| SAPR-8 / TDD-8 | Ray-Dutt twist | Vertex arrangement |

## 7. Implementation Notes

### 7.1 Data Structure

```javascript
export const REFERENCE_GEOMETRIES = {
    2: {
        'linear': generateLinear(),
        'bent': generateVShape(),
        'L-shape': generateLShape()
    },
    3: {
        'trigonal-planar': generateTrigonalPlanar(),
        // ...
    },
    // ... CN 4-12
};
```

### 7.2 Accessing Geometries

```javascript
// Get all geometries for CN=6
const cn6Geometries = REFERENCE_GEOMETRIES[6];

// Get specific geometry
const octahedron = REFERENCE_GEOMETRIES[6]['octahedron'];

// Iterate over all geometries
for (const cn in REFERENCE_GEOMETRIES) {
    for (const name in REFERENCE_GEOMETRIES[cn]) {
        const coords = REFERENCE_GEOMETRIES[cn][name];
        // Process...
    }
}
```

## 8. References

1. Alvarez, S.; Alemany, P.; Casanova, D.; Cirera, J.; Llunell, M.; Avnir, D. *Coord. Chem. Rev.* **2005**, 249, 1693-1708.
2. Alvarez, S. *Dalton Trans.* **2005**, 2209-2233.
3. Casanova, D.; Cirera, J.; Llunell, M.; Alemany, P.; Avnir, D.; Alvarez, S. *J. Am. Chem. Soc.* **2004**, 126, 1755-1763.
4. Ruiz-Martínez, A.; Casanova, D.; Alvarez, S. *Chem. Eur. J.* **2008**, 14, 1291-1303.
5. Johnson, N. W. *Canad. J. Math.* **1966**, 18, 169-200. (Johnson solids)

---

*Previous: [Hungarian Algorithm](03-Hungarian-Algorithm.md)*

*Next: [Quality Metrics](05-Quality-Metrics.md)*

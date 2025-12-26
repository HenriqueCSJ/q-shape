# Quality Metrics for Coordination Geometry Analysis

## 1. Overview

Beyond the primary Continuous Shape Measure (CShM), Q-Shape computes a comprehensive suite of quality metrics to characterize coordination environments. These metrics provide:

1. **Bond length statistics** - Metal-ligand distance analysis
2. **Angular distribution analysis** - Inter-ligand angle statistics
3. **Angular distortion indices** - Deviation from ideal angles
4. **Bond length uniformity** - Consistency of metal-ligand bonds
5. **Overall quality scores** - Combined assessment metrics

## 2. Bond Length Statistics

### 2.1 Statistical Measures

For a coordination sphere with N ligands at distances {d₁, d₂, ..., dₙ}:

**Mean Bond Length:**
$$\bar{d} = \frac{1}{N} \sum_{i=1}^{N} d_i$$

**Variance:**
$$\sigma^2 = \frac{1}{N} \sum_{i=1}^{N} (d_i - \bar{d})^2$$

**Standard Deviation:**
$$\sigma = \sqrt{\sigma^2}$$

**Range:**
$$\Delta d = d_{max} - d_{min}$$

### 2.2 Implementation

```javascript
function calculateBondStatistics(coordAtoms) {
    const distances = coordAtoms.map(c => c.distance);
    const N = distances.length;

    const mean = distances.reduce((a, b) => a + b, 0) / N;

    const variance = distances.reduce(
        (acc, d) => acc + Math.pow(d - mean, 2), 0
    ) / N;

    return {
        meanBondLength: mean,
        bondLengthVariance: variance,
        stdDevBondLength: Math.sqrt(variance),
        minBondLength: Math.min(...distances),
        maxBondLength: Math.max(...distances)
    };
}
```

### 2.3 Interpretation

| σ/d̄ Ratio | Interpretation |
|-----------|----------------|
| < 0.02 | Highly uniform (homoleptic-like) |
| 0.02 - 0.05 | Uniform with minor variation |
| 0.05 - 0.10 | Moderate variation (mixed ligands) |
| > 0.10 | Significant variation (heteroleptic) |

## 3. Angular Distribution Analysis

### 3.1 Inter-Ligand Angles

For N ligands, there are C(N,2) = N(N-1)/2 unique inter-ligand angles. These are computed from the ligand position vectors:

$$\theta_{ij} = \arccos\left(\frac{\mathbf{v}_i \cdot \mathbf{v}_j}{|\mathbf{v}_i| |\mathbf{v}_j|}\right)$$

Where **v**ᵢ is the vector from metal center to ligand i.

### 3.2 Angular Statistics

```javascript
function calculateAngleStatistics(coordAtoms) {
    const angles = [];

    for (let i = 0; i < coordAtoms.length; i++) {
        for (let j = i + 1; j < coordAtoms.length; j++) {
            const angle = coordAtoms[i].vec.angleTo(coordAtoms[j].vec);
            angles.push(angle * (180 / Math.PI));  // Convert to degrees
        }
    }

    const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
    const angleVariance = angles.reduce(
        (acc, a) => acc + Math.pow(a - meanAngle, 2), 0
    ) / angles.length;

    return {
        count: angles.length,
        mean: meanAngle,
        stdDev: Math.sqrt(angleVariance),
        min: Math.min(...angles),
        max: Math.max(...angles)
    };
}
```

### 3.3 Expected Angles by Geometry

| Geometry | CN | Expected Angles |
|----------|-----|-----------------|
| Linear | 2 | 180° |
| Trigonal Planar | 3 | 120°, 120°, 120° |
| Tetrahedral | 4 | 109.47° (×6) |
| Square Planar | 4 | 90° (×4), 180° (×2) |
| TBP | 5 | 90° (×6), 120° (×3), 180° (×1) |
| Octahedral | 6 | 90° (×12), 180° (×3) |

## 4. Angular Distortion Index (ADI)

### 4.1 Definition

The Angular Distortion Index quantifies how much the observed inter-ligand angles deviate from ideal geometry:

$$ADI = \frac{1}{M} \sum_{k=1}^{M} |\theta_k^{actual} - \theta_k^{ideal}|$$

Where:
- M = number of angle pairs
- θₖᵃᶜᵗᵘᵃˡ = observed angle (sorted)
- θₖⁱᵈᵉᵃˡ = ideal angle (sorted)

### 4.2 Algorithm

```javascript
function calculateAngularDistortionIndex(coordAtoms, refGeometry) {
    // Calculate actual angles
    const actualAngles = [];
    for (let i = 0; i < coordAtoms.length; i++) {
        for (let j = i + 1; j < coordAtoms.length; j++) {
            actualAngles.push(
                coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI)
            );
        }
    }

    // Calculate ideal angles from reference
    const idealAngles = [];
    for (let i = 0; i < refGeometry.refCoords.length; i++) {
        for (let j = i + 1; j < refGeometry.refCoords.length; j++) {
            const v1 = new THREE.Vector3(...refGeometry.refCoords[i]);
            const v2 = new THREE.Vector3(...refGeometry.refCoords[j]);
            idealAngles.push(v1.angleTo(v2) * (180 / Math.PI));
        }
    }

    // Sort both arrays
    actualAngles.sort((a, b) => a - b);
    idealAngles.sort((a, b) => a - b);

    // Calculate mean absolute deviation
    if (actualAngles.length !== idealAngles.length) {
        return null;  // Mismatch in coordination number
    }

    const deviations = idealAngles.map((ideal, i) =>
        Math.abs(ideal - actualAngles[i])
    );

    return deviations.reduce((a, b) => a + b, 0) / deviations.length;
}
```

### 4.3 Interpretation

| ADI (degrees) | Quality |
|---------------|---------|
| < 2 | Excellent angular match |
| 2 - 5 | Good, minor distortions |
| 5 - 10 | Moderate distortion |
| 10 - 20 | Significant distortion |
| > 20 | Severe distortion or wrong geometry |

## 5. Bond Length Uniformity Index (BLUI)

### 5.1 Definition

The BLUI measures how uniform the metal-ligand bond lengths are:

$$BLUI = 100 \times \left(1 - \frac{1}{N} \sum_{i=1}^{N} \frac{|d_i - \bar{d}|}{\bar{d}}\right)$$

This gives a percentage (0-100) where 100 = perfectly uniform bonds.

### 5.2 Implementation

```javascript
function calculateBondLengthUniformity(coordAtoms) {
    const distances = coordAtoms.map(c => c.distance);
    const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;

    const relativeDeviations = distances.map(d =>
        Math.abs(d - meanDist) / meanDist
    );

    const averageDeviation = relativeDeviations.reduce((a, b) => a + b, 0)
        / relativeDeviations.length;

    return 100 * (1 - averageDeviation);
}
```

### 5.3 Interpretation

| BLUI (%) | Interpretation |
|----------|----------------|
| > 98 | Nearly identical bond lengths (homoleptic) |
| 95 - 98 | Very uniform |
| 90 - 95 | Uniform with minor variation |
| 80 - 90 | Moderate variation |
| < 80 | Significant variation (heteroleptic complex) |

## 6. Shape Deviation Parameter

### 6.1 Definition

The Shape Deviation Parameter (SDP) provides a normalized measure of deviation from ideal geometry:

$$SDP = \sqrt{\frac{CShM}{100}}$$

### 6.2 Physical Meaning

Since CShM = 100 × (mean squared displacement on unit sphere):

$$CShM = 100 \times \frac{1}{N} \sum_{i=1}^{N} |\mathbf{q}_i - \mathbf{p}_{\pi(i)}|^2$$

The SDP represents the root-mean-square deviation on the unit sphere:

$$SDP = \sqrt{\frac{1}{N} \sum_{i=1}^{N} |\mathbf{q}_i - \mathbf{p}_{\pi(i)}|^2}$$

### 6.3 Relationship to RMSD

**Important caveat**: The SDP is an approximate RMSD for unit-normalized coordinates only. It should not be directly compared with Cartesian RMSD values in Ångströms.

For publication, clearly state:
> "The approximate RMSD is derived from CShM for unit-normalized coordinates and reflects angular deviation from ideal geometry, not absolute Cartesian displacement."

### 6.4 References

- Pinsky, M.; Avnir, D. *Inorg. Chem.* **1998**, 37, 5575-5582.
- Alvarez, S. et al. *Coord. Chem. Rev.* **2005**, 249, 1693-1708.

## 7. Overall Quality Score (OQS)

### 7.1 Definition

The Overall Quality Score combines multiple metrics into a single 0-100 score:

$$OQS = 100 - (2 \times CShM) - (0.5 \times ADI) - (0.3 \times (100 - BLUI))$$

With bounds: 0 ≤ OQS ≤ 100

### 7.2 Weight Rationale

| Component | Weight | Rationale |
|-----------|--------|-----------|
| CShM | 2.0 | Primary shape measure |
| ADI | 0.5 | Angular distortion contribution |
| (100-BLUI) | 0.3 | Bond uniformity penalty |

### 7.3 Implementation

```javascript
function calculateOverallQualityScore(shapeMeasure, angularDistortion, bondUniformity) {
    const score = 100
        - (shapeMeasure * 2)
        - (angularDistortion * 0.5)
        - ((100 - bondUniformity) * 0.3);

    return Math.max(0, Math.min(100, score));
}
```

### 7.4 Interpretation

| OQS | Classification | Meaning |
|-----|----------------|---------|
| 95 - 100 | Exceptional | Near-perfect geometry |
| 85 - 95 | Excellent | Minor distortions only |
| 70 - 85 | Good | Clear geometry with moderate distortion |
| 50 - 70 | Fair | Significant distortion |
| < 50 | Poor | Severely distorted or misassigned |

## 8. CShM Interpretation Scale

### 8.1 Standard Classification

```javascript
function interpretShapeMeasure(value) {
    if (!isFinite(value)) return { text: "Invalid", confidence: 0 };
    if (value < 0.1)  return { text: "Perfect",    confidence: 100 };
    if (value < 0.5)  return { text: "Excellent",  confidence: 95 };
    if (value < 1.5)  return { text: "Very Good",  confidence: 90 };
    if (value < 3.0)  return { text: "Good",       confidence: 80 };
    if (value < 7.5)  return { text: "Moderate",   confidence: 60 };
    if (value < 15.0) return { text: "Poor",       confidence: 30 };
    return { text: "Very Poor / No Match", confidence: 10 };
}
```

### 8.2 Visual Color Scale

| CShM Range | Color | Hex Code |
|------------|-------|----------|
| < 0.1 | Deep Green | #059669 |
| 0.1 - 0.5 | Green | #10b981 |
| 0.5 - 1.5 | Light Green | #34d399 |
| 1.5 - 3.0 | Yellow | #fbbf24 |
| 3.0 - 7.5 | Orange | #f59e0b |
| 7.5 - 15.0 | Dark Orange | #f97316 |
| > 15.0 | Red | #ef4444 |

## 9. Polyhedral Volume Ratio

### 9.1 Concept

The polyhedral volume can be compared between actual and ideal geometries. However, since Q-Shape normalizes coordinates to unit sphere, the volume ratio is currently implemented as a placeholder (1.0).

### 9.2 Future Implementation

For absolute volume calculations:

$$V_{ratio} = \frac{V_{actual}}{V_{ideal}}$$

Where V is calculated using the convex hull of ligand positions.

## 10. Complete Quality Metrics Object

### 10.1 Output Structure

```javascript
{
    // From calculateQualityMetrics()
    angularDistortionIndex: 2.34,        // degrees
    bondLengthUniformityIndex: 96.5,     // percentage
    polyhedralVolumeRatio: 1.0,          // placeholder
    shapeDeviationParameter: 0.071,      // normalized RMSD
    overallQualityScore: 92.1,           // 0-100 score
    rmsd: 0.071,                         // approximate RMSD
    _rmsdNote: 'Approximate RMSD derived from CShM for unit-normalized coordinates',

    // From calculateAdditionalMetrics()
    bondLengthVariance: 0.0034,          // Å²
    meanBondLength: 2.045,               // Å
    stdDevBondLength: 0.058,             // Å
    minBondLength: 1.987,                // Å
    maxBondLength: 2.121,                // Å
    angleStats: {
        count: 15,                       // number of angle pairs
        mean: 90.2,                      // degrees
        stdDev: 3.4,                     // degrees
        min: 85.3,                       // degrees
        max: 94.8                        // degrees
    }
}
```

## 11. Statistical Significance

### 11.1 Error Propagation

For crystallographic data with positional uncertainties σₓ:

$$\sigma_{CShM} \approx \frac{200 \times \sigma_x}{d_{mean}}$$

Example: For σₓ = 0.01 Å and d = 2.0 Å, σ_CShM ≈ 1.0

### 11.2 Distinguishing Geometries

Two CShM values are significantly different if:

$$|CShM_1 - CShM_2| > 3 \times \sigma_{CShM}$$

## 12. References

1. Pinsky, M.; Avnir, D. *Inorg. Chem.* **1998**, 37, 5575-5582.
2. Casanova, D.; Alemany, P.; Bofill, J. M.; Alvarez, S. *Chem. Eur. J.* **2003**, 9, 1281-1295.
3. Cirera, J.; Ruiz, E.; Alvarez, S. *Organometallics* **2005**, 24, 1556-1562.
4. Alvarez, S. *Chem. Rev.* **2015**, 115, 13447-13483.

---

*Previous: [Reference Geometries](04-Reference-Geometries.md)*

*Next: [Ring Detection & Hapticity](06-Ring-Detection-Hapticity.md)*

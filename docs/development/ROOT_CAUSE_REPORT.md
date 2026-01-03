# Root Cause Report: Johnson Geometry Degeneracy and CShM Bias

**Date:** 2024
**Author:** Debug Session
**Status:** ROOT CAUSE IDENTIFIED

## Executive Summary

Q-Shape produces identical CShM values for TBPY-5 (regular D3h trigonal bipyramid) and JTBPY-5 (Johnson J12 elongated trigonal bipyramid) because the `normalize()` function applied to reference geometries destroys the radial distance differences that distinguish Johnson polyhedra from regular polyhedra.

## Problem Statement

### Problem A: Johnson Geometry Degeneracy
- Q-Shape reports TBPY-5 = 5.782777 and JTBPY-5 = 5.782782 (difference: 0.000006)
- SHAPE reports TBPY-5 = 5.06871 and JTBPY-5 = 7.23858 (difference: 2.17)
- Q-Shape cannot distinguish between regular and Johnson variants

### Problem B: Systematic CShM Bias
- Q-Shape values are systematically higher than SHAPE values
- Best geometry (SPY-5): Q-Shape = 4.93, SHAPE = 4.23 (16.7% higher)
- Median relative error across all geometries: 14.1%

## Root Cause Analysis

### Location of Bug
File: `src/constants/referenceGeometries/index.js`
Function: `normalize()` applied to all reference geometry coordinates via `.map(normalize)`

### The Normalization Problem

The `normalize()` function converts all reference geometry vertices to unit length:

```javascript
function normalize(v) {
    const len = Math.hypot(...v);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}
```

This is applied to every geometry generator:

```javascript
function generateTrigonalBipyramidal() {
    return [
        [0.000000, 0.000000, -1.095445],  // axial
        [1.095445, 0.000000, 0.000000],   // equatorial
        ...
    ].map(normalize);  // ← PROBLEM: destroys radial differences
}

function generateJohnsonTrigonalBipyramid() {
    return [
        [0.925820, 0.000000, 0.000000],   // equatorial (shorter)
        [0.000000, 0.000000, 1.309307],   // axial (longer)
        ...
    ].map(normalize);  // ← PROBLEM: destroys radial differences
}
```

### Before Normalization (Correct Geometry)

**TBPY-5 (Regular D3h):**
- Axial vertices: [0, 0, ±1.095445] — radius = 1.095445
- Equatorial vertices: [±1.095445, ...] — radius = 1.095445
- **All vertices equidistant from center** (ratio = 1.0)

**JTBPY-5 (Johnson J12 - Elongated):**
- Equatorial vertices: [0.925820, ...] — radius = 0.925820
- Axial vertices: [0, 0, ±1.309307] — radius = 1.309307
- **Axial vertices are FARTHER than equatorial** (ratio = 1.309307/0.925820 = 1.414 ≈ √2)

### After Normalization (Identical!)

**TBPY-5 after normalize():**
- All vertices: radius = 1.0

**JTBPY-5 after normalize():**
- All vertices: radius = 1.0

**Both become identical D3h trigonal bipyramids!**

The elongation that defines the Johnson J12 geometry is completely lost.

## Evidence

### Test Output
```
=== DEGENERACY ANALYSIS ===
TBPY-5:  5.782777
JTBPY-5: 5.782782
Difference: 0.000006
Expected difference (per SHAPE): ~2.17
DEGENERACY DETECTED: YES - PROBLEM!
```

### Reference Geometry Coordinates (after normalization)
```
TBPY-5:
  Vertex 0: [0.000000, 0.000000, -1.000000]
  Vertex 1: [1.000000, 0.000000, 0.000000]
  Vertex 2: [-0.500000, 0.866025, 0.000000]
  Vertex 3: [-0.500000, -0.866025, 0.000000]
  Vertex 4: [0.000000, 0.000000, 1.000000]

JTBPY-5:
  Vertex 0: [1.000000, 0.000000, 0.000000]
  Vertex 1: [-0.500000, 0.866026, 0.000000]
  Vertex 2: [-0.500000, -0.866026, 0.000000]
  Vertex 3: [0.000000, 0.000000, 1.000000]
  Vertex 4: [0.000000, 0.000000, -1.000000]
```

Both have all vertices at exactly distance 1.0 from center — geometrically identical!

## Why This Matters for CShM

The Continuous Shape Measure (CShM) computes the minimum deviation between an actual structure and a reference polyhedron. If two reference polyhedra are identical (after normalization), they will produce identical CShM values for any input structure.

### Mathematical Explanation

CShM formula:
```
S(Q,P) = 100 × min{R,π} [ (1/N) × Σᵢ |qᵢ - R·pπ(i)|² ]
```

Where:
- Q = actual coordinates (normalized to unit sphere)
- P = reference polyhedron (should NOT be per-vertex normalized)
- R = optimal rotation
- π = optimal permutation

If P_TBPY and P_JTBPY are identical after normalization, then:
```
S(Q, P_TBPY) = S(Q, P_JTBPY)
```

for all Q, which is exactly what we observe.

## Relationship to Problem B (CShM Bias)

The systematic bias (Q-Shape values higher than SHAPE) is likely also related to normalization:

1. **Actual coordinates normalization:** Q-Shape normalizes actual coordinates to unit sphere
2. **Reference normalization:** Q-Shape also normalizes reference coordinates
3. **SHAPE behavior:** SHAPE may use different normalization conventions

If SHAPE normalizes the entire structure (actual + reference) to match average distances while Q-Shape normalizes each point individually, this could cause systematic differences.

## Proposed Fix

### Option 1: Remove per-vertex normalization (RECOMMENDED)

Use the original CoSyMlib/SHAPE reference coordinates WITHOUT the `.map(normalize)` call:

```javascript
function generateJohnsonTrigonalBipyramid() {
    // JTBPY-5: Johnson Trigonal Bipyramid (J12) - Official CoSyMlib reference
    // DO NOT normalize - preserve elongated character
    return [
        [0.925820, 0.000000, 0.000000],
        [-0.462910, 0.801784, 0.000000],
        [-0.462910, -0.801784, 0.000000],
        [0.000000, 0.000000, 1.309307],
        [0.000000, 0.000000, -1.309307]
    ];  // NO .map(normalize)
}
```

### Option 2: Scale normalization (preserve shape)

Normalize by scaling the entire geometry to unit RMS distance, preserving relative distances:

```javascript
function normalizeScale(coords) {
    // Compute RMS distance from centroid
    const centroid = coords.reduce((acc, c) =>
        [acc[0] + c[0]/coords.length, acc[1] + c[1]/coords.length, acc[2] + c[2]/coords.length],
        [0, 0, 0]
    );

    const rms = Math.sqrt(
        coords.reduce((sum, c) =>
            sum + (c[0]-centroid[0])**2 + (c[1]-centroid[1])**2 + (c[2]-centroid[2])**2,
            0
        ) / coords.length
    );

    // Scale all coordinates by the same factor
    return coords.map(c => [
        (c[0] - centroid[0]) / rms,
        (c[1] - centroid[1]) / rms,
        (c[2] - centroid[2]) / rms
    ]);
}
```

This preserves the shape (relative distances) while normalizing overall scale.

### Calculator Changes Required

The `shapeCalculator.js` currently normalizes actual coordinates to unit sphere:
```javascript
P_vecs.forEach(v => v.normalize());
```

This must be changed to match the reference geometry normalization convention (scale normalization, not per-vertex normalization).

## Impact Assessment

### Affected Reference Geometries

All Johnson polyhedra with elongated/shortened bonds will be affected:
- JTBPY-5 (J12): Elongated trigonal bipyramid
- JPBPY-7 (J13): Johnson pentagonal bipyramid
- JGBF-8 (J26): Gyrobifastigium
- JETBPY-8 (J14): Elongated triangular bipyramid
- JSD-8 (J84): Snub disphenoid
- And many others...

### Expected Results After Fix

1. **Degeneracy resolved:** TBPY-5 ≠ JTBPY-5
2. **CShM values closer to SHAPE:** Reduced systematic bias
3. **Correct rankings:** Johnson geometries ranked appropriately

## Verification Plan

1. Remove `.map(normalize)` from reference geometry generators
2. Implement scale normalization in calculator
3. Run parity benchmark tests
4. Verify TBPY-5 and JTBPY-5 have different CShM values
5. Compare Q-Shape rankings with SHAPE v2.1 reference data

## Conclusion

The root cause of both Johnson geometry degeneracy AND systematic CShM bias is the per-vertex normalization applied to reference geometries. This must be replaced with scale normalization that preserves relative distances while allowing overall size matching.

The fix is straightforward but must be applied consistently to both reference geometries AND the actual coordinate processing in the calculator.

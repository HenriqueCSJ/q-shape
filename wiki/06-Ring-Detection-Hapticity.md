# Ring Detection and Hapticity Analysis

## 1. Introduction

### 1.1 The Problem with π-Coordinated Ligands

Traditional coordination geometry analysis treats each atom as an individual ligand position. This approach fails for:

- **Sandwich compounds** (ferrocene, bis-benzene chromium)
- **Half-sandwich complexes** (piano-stool)
- **π-allyl complexes**
- **Cyclopentadienyl (Cp) ligands**

In these systems, the metal interacts with the π-electron system of an aromatic or conjugated ring, not individual atoms.

### 1.2 Hapticity Notation

**Hapticity** (η, "eta") describes the number of contiguous atoms in a ligand coordinated to a metal:

| Notation | Name | Example |
|----------|------|---------|
| η¹ | Monohapto | σ-bonded ligand |
| η² | Dihapto | Olefin complexes |
| η³ | Trihapto | π-allyl |
| η⁴ | Tetrahapto | Cyclobutadiene |
| η⁵ | Pentahapto | Cyclopentadienyl (Cp) |
| η⁶ | Hexahapto | Benzene |
| η⁷ | Heptahapto | Cycloheptatrienyl |
| η⁸ | Octahapto | Cyclooctatetraene |

### 1.3 Solution: Centroid Representation

For η^n coordination, the ring is represented by its **centroid** (geometric center):

```
    Original:                     Centroid Model:

       C---C
      /     \                          ●  (centroid)
     C       C                         |
      \     /                          |
       C---C                          Fe
         |                             |
        Fe                             ●  (centroid)
         |
       C---C
      /     \
     C       C
      \     /
       C---C
```

## 2. Ring Detection Algorithm

### 2.1 Overview

The ring detection process consists of:

1. **Bond Network Construction** - Build adjacency graph
2. **Cycle Finding** - DFS-based ring enumeration
3. **Planarity Checking** - Validate aromatic character
4. **Hapticity Determination** - Assign η mode

### 2.2 Bond Network Construction

Atoms are considered bonded if their distance is below a threshold:

```javascript
const BOND_THRESHOLD = 1.60;  // Ångströms (typical C-C = 1.40 Å)

function buildAdjacencyList(atoms, coordIndices) {
    const adjList = new Map();
    coordIndices.forEach(i => adjList.set(i, []));

    for (let i = 0; i < coordIndices.length; i++) {
        for (let j = i + 1; j < coordIndices.length; j++) {
            const idx1 = coordIndices[i];
            const idx2 = coordIndices[j];
            const dist = distance(atoms[idx1], atoms[idx2]);

            if (dist < BOND_THRESHOLD) {
                adjList.get(idx1).push(idx2);
                adjList.get(idx2).push(idx1);
            }
        }
    }

    return adjList;
}
```

### 2.3 Bond Distance Reference

| Bond Type | Typical Length (Å) |
|-----------|-------------------|
| C-C (single) | 1.54 |
| C=C (double) | 1.34 |
| C-C (aromatic) | 1.40 |
| C-N (single) | 1.47 |
| C-N (aromatic) | 1.34 |
| C-O (single) | 1.43 |
| C-O (double) | 1.23 |

The threshold of 1.60 Å captures most organic bonding interactions.

### 2.4 Depth-First Search for Cycles

```javascript
function findRings(adjList, coordIndices, maxRingSize = 8) {
    const rings = [];
    const visited = new Set();

    function dfs(start, current, path, depth) {
        if (depth > maxRingSize) return;

        // Check if ring can be closed
        if (path.length >= 3 && path.length <= maxRingSize) {
            const neighbors = adjList.get(current);
            if (neighbors.includes(start)) {
                // Found a ring - verify uniqueness
                const ring = [...path];
                if (!isDuplicate(rings, ring)) {
                    rings.push(ring);
                }
            }
        }

        visited.add(current);

        for (const next of adjList.get(current) || []) {
            if (!visited.has(next) && !path.includes(next)) {
                dfs(start, next, [...path, next], depth + 1);
            }
        }

        visited.delete(current);
    }

    // Start from each atom
    coordIndices.forEach(start => {
        visited.clear();
        dfs(start, start, [start], 1);
    });

    return rings;
}
```

### 2.5 Complexity Analysis

| Component | Complexity | Notes |
|-----------|------------|-------|
| Adjacency construction | O(N²) | Distance comparisons |
| DFS per starting atom | O(N × maxRingSize!) | Worst case |
| Total (pruned) | O(N² × k) | k = typical ring count |

## 3. Planarity Verification

### 3.1 Algorithm

A ring is considered aromatic/planar if all atoms lie within a tolerance of a common plane:

```javascript
const PLANARITY_TOLERANCE = 0.15;  // Ångströms

function isPlanar(atoms, tolerance = PLANARITY_TOLERANCE) {
    if (atoms.length < 3) return false;

    // Define plane from first 3 atoms
    const v1 = subtract(atoms[1], atoms[0]);
    const v2 = subtract(atoms[2], atoms[0]);
    const normal = normalize(cross(v1, v2));

    if (magnitude(normal) < 1e-6) return false;  // Collinear

    // Check all atoms against plane
    for (const atom of atoms) {
        const toAtom = subtract(atom, atoms[0]);
        const dist = Math.abs(dot(toAtom, normal));

        if (dist > tolerance) return false;
    }

    return true;
}
```

### 3.2 Plane Equation

The plane is defined by:

$$ax + by + cz = d$$

Where **(a, b, c)** is the unit normal vector and **d** is the distance from origin.

The distance from point P to the plane:

$$\text{dist}(P) = |a \cdot P_x + b \cdot P_y + c \cdot P_z - d|$$

## 4. Hapticity Determination

### 4.1 Ring Size to Hapticity Mapping

```javascript
function detectHapticity(ringSize, ringAtoms, metalPosition) {
    const centroid = calculateCentroid(ringAtoms);
    const metalDist = distance(centroid, metalPosition);

    // Classify based on ring size
    switch (ringSize) {
        case 3: return { mode: 'η³', type: 'allyl' };
        case 4: return { mode: 'η⁴', type: 'cyclobutadiene' };
        case 5: return { mode: 'η⁵', type: 'cyclopentadienyl' };
        case 6: return { mode: 'η⁶', type: 'benzene' };
        case 7: return { mode: 'η⁷', type: 'cycloheptatrienyl' };
        case 8: return { mode: 'η⁸', type: 'cyclooctatetraene' };
        default: return { mode: `η${ringSize}`, type: 'general' };
    }
}
```

### 4.2 Common π-Coordinated Ligands

| Ring Size | Ligand | Common Complexes |
|-----------|--------|------------------|
| 3 | π-allyl | Pd(allyl) catalysts |
| 4 | Cyclobutadiene | Cyclobutadieneiron tricarbonyl |
| 5 | Cp (cyclopentadienyl) | Ferrocene, metallocenes |
| 5 | Cp* (pentamethyl-Cp) | [Cp*RhCl₂]₂ |
| 6 | Benzene | Cr(C₆H₆)₂ |
| 6 | p-cymene | Ru(p-cymene) catalysts |
| 7 | Tropylium | [Mo(C₇H₇)(CO)₃]⁺ |
| 8 | COT | U(COT)₂ (uranocene) |

## 5. Centroid Calculation

### 5.1 Geometric Centroid

For N atoms at positions {r₁, r₂, ..., rₙ}:

$$\mathbf{C} = \frac{1}{N} \sum_{i=1}^{N} \mathbf{r}_i$$

```javascript
function calculateCentroid(atoms) {
    const N = atoms.length;
    const sum = atoms.reduce(
        (acc, atom) => ({
            x: acc.x + atom.x,
            y: acc.y + atom.y,
            z: acc.z + atom.z
        }),
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: sum.x / N,
        y: sum.y / N,
        z: sum.z / N
    };
}
```

### 5.2 Ring Normal Vector

The normal to the ring plane (useful for determining slip distortions):

```javascript
function calculateRingNormal(atoms) {
    // Cross product of two in-plane vectors
    const v1 = subtract(atoms[1], atoms[0]);
    const v2 = subtract(atoms[2], atoms[0]);
    const normal = cross(v1, v2);

    return normalize(normal);
}
```

### 5.3 Tilt Angle

The angle between ring plane and metal-centroid vector:

$$\theta_{tilt} = 90° - \arccos\left(\frac{\mathbf{n} \cdot \mathbf{v}_{M-C}}{|\mathbf{n}| |\mathbf{v}_{M-C}|}\right)$$

Where **n** is the ring normal and **v**ₘ₋ᴄ is metal-to-centroid vector.

## 6. Sandwich Complex Detection

### 6.1 Criteria

A sandwich complex is detected when:
1. Two or more rings are present
2. Rings are parallel (normal vectors aligned)
3. Metal is positioned between rings

```javascript
function detectSandwichStructure(rings, metal) {
    if (rings.length < 2) return false;

    // Check for parallel rings on opposite sides of metal
    for (let i = 0; i < rings.length; i++) {
        for (let j = i + 1; j < rings.length; j++) {
            const n1 = calculateRingNormal(rings[i].atoms);
            const n2 = calculateRingNormal(rings[j].atoms);

            const parallelism = Math.abs(dot(n1, n2));

            // Rings parallel if dot product near ±1
            if (parallelism > 0.95) {
                const c1 = rings[i].centroid;
                const c2 = rings[j].centroid;

                // Metal between centroids?
                const v1 = subtract(metal, c1);
                const v2 = subtract(metal, c2);

                if (dot(v1, v2) < 0) {
                    // Opposite sides = sandwich!
                    return true;
                }
            }
        }
    }

    return false;
}
```

### 6.2 Example: Ferrocene

```
Structure:          Detection Output:

    Cp ring 1           Ring 1: η⁵-Cp
       ●                  centroid: (0, 0, 1.66)
      /|\                 indices: [0,1,2,3,4]
      ●
       |               Metal: Fe at (0, 0, 0)
      Fe
       |               Ring 2: η⁵-Cp
      ●                  centroid: (0, 0, -1.66)
     /|\                 indices: [5,6,7,8,9]
      ●
    Cp ring 2         Sandwich: true
```

## 7. Ligand Group Classification

### 7.1 Output Structure

```javascript
{
    rings: [
        {
            indices: [0, 1, 2, 3, 4],     // Atom indices in ring
            atoms: [...],                  // Atom objects
            centroid: { x, y, z },        // Ring center
            normal: { x, y, z },          // Plane normal
            size: 5,                       // Ring size
            hapticity: 'η⁵',              // Hapticity mode
            type: 'cyclopentadienyl',     // Ligand type
            metalDist: 1.66               // Metal-centroid distance (Å)
        },
        // ... more rings
    ],
    monodentate: [5, 6, 7],              // Non-ring coordinating atoms
    totalGroups: 3,                       // Rings + monodentate count
    ringCount: 2,                         // Number of rings detected
    summary: '2×η⁵-Cp + 3 monodentate',  // Human-readable summary
    hasSandwichStructure: true,           // Sandwich detection
    detectedHapticities: ['η⁵', 'η⁵']    // List of all hapticities
}
```

### 7.2 Effective Coordination Number

For geometry analysis, rings can be represented by their centroids:

| Structure | Atom Count | Effective CN |
|-----------|------------|--------------|
| Ferrocene | 10 (2×Cp) | 2 (centroids) |
| [Ru(η⁶-benzene)Cl₂(P)]₂ | 6 + 2 + 2 | 4 (centroid + 2Cl + P) |
| [Fe(η⁵-Cp)(CO)₃]⁺ | 5 + 3 | 4 (centroid + 3×CO) |

## 8. Integration with CShM

### 8.1 Centroid-Based Analysis

When rings are detected, Q-Shape provides two analysis modes:

1. **All-Atom Mode**: Standard CShM on all coordinating atoms
2. **Centroid Mode**: Replace rings with centroids, then CShM

```javascript
function analyzeWithCentroids(atoms, metalIndex, rings) {
    const coordPoints = [];

    // Add ring centroids
    rings.forEach(ring => {
        coordPoints.push(ring.centroid);
    });

    // Add monodentate atoms
    ligandGroups.monodentate.forEach(idx => {
        coordPoints.push(atoms[idx]);
    });

    // Calculate CShM on effective coordination sphere
    return calculateShapeMeasure(coordPoints, referenceGeometry);
}
```

### 8.2 Geometry Matching for Sandwich Compounds

| Complex Type | All-Atom CN | Effective CN | Best Match |
|--------------|-------------|--------------|------------|
| Ferrocene | 10 | 2 | Linear |
| Bis-benzene Cr | 12 | 2 | Linear |
| Half-sandwich + 3L | 5 + 3 = 8 | 4 | Tetrahedral/See-saw |

## 9. Algorithm Parameters

### 9.1 Configurable Constants

```javascript
const RING_DETECTION = {
    BOND_THRESHOLD: 1.60,         // Max C-C distance (Å)
    MAX_RING_SIZE: 8,             // Largest ring to detect
    MIN_RING_SIZE: 3,             // Smallest ring (allyl)
    PLANARITY_TOLERANCE: 0.15,    // Max out-of-plane deviation (Å)
    CENTROID_METAL_MAX_DIST: 3.0  // Max metal-centroid distance (Å)
};
```

### 9.2 Performance Considerations

For structures with many coordinating atoms (CN > 12):
- Ring detection adds ~O(N²) overhead
- DFS pruning limits ring enumeration
- Results are cached for repeated analysis

## 10. References

1. Cotton, F. A.; Wilkinson, G.; Murillo, C. A.; Bochmann, M. *Advanced Inorganic Chemistry*, 6th ed.; Wiley: New York, 1999.
2. Huheey, J. E.; Keiter, E. A.; Keiter, R. L. *Inorganic Chemistry: Principles of Structure and Reactivity*, 4th ed.; Harper Collins: New York, 1993.
3. Elschenbroich, C. *Organometallics*, 3rd ed.; Wiley-VCH: Weinheim, 2006.
4. Alvarez, S. *Coord. Chem. Rev.* **2005**, 249, 1693-1708.

---

*Previous: [Quality Metrics](05-Quality-Metrics.md)*

*Next: [Home](Home.md)*

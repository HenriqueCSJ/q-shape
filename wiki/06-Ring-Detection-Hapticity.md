# Heuristic Planar-Cycle Descriptors

> **Current boundary:** this feature is an informational geometric heuristic.
> It does not establish chemical hapticity, ligand identity, sandwich topology,
> or a centroid-based CShM representation.

## 1. Introduction

### 1.1 The Problem with π-Coordinated Ligands

π-coordinated systems require care because an atom-based coordination sphere
and a ligand-site chemical interpretation are not equivalent. Examples include:

- **Sandwich compounds** (ferrocene, bis-benzene chromium)
- **Half-sandwich complexes** (piano-stool)
- **π-allyl complexes**
- **Cyclopentadienyl (Cp) ligands**

Q-Shape currently performs its CShM calculation on the individual atoms inside
the selected radius. Its separate cycle heuristic can flag planar cycles for
inspection, but it does not solve the chemical assignment problem.

### 1.2 Hapticity Notation

**Hapticity** (η, "eta") is a chemical description of the number of contiguous
atoms in a ligand coordinated to a metal. The table is background terminology,
not a list of assignments made or validated by Q-Shape:

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

### 1.3 Current implementation boundary

Q-Shape detects candidate cycles and computes their centroids and
metal-centroid distances as **informational descriptors**.
The production CShM calculation does not replace a ring with its centroid: it
uses every individual coordinating atom selected by the coordination radius.
Consequently, an informational centroid must not be interpreted as a second
"centroid mode" or as an effective coordination number used by CShM.

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
3. **Planarity Checking** - Apply a fixed coplanarity tolerance
4. **Candidate Labeling** - Report cycle size/composition as a heuristic descriptor

### 2.2 Bond Network Construction

Atoms are considered bonded if their distance is below a threshold:

```javascript
const BOND_THRESHOLD = 1.80;  // Å; uniform heuristic, not a bond assignment

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

The fixed 1.80 Å threshold creates a candidate adjacency graph. It does not use
element-pair covalent radii or establish a chemical bond/aromaticity model.

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

A cycle candidate passes the coplanarity screen if all atoms lie within a fixed
tolerance of a plane derived from its first three atoms:

```javascript
const PLANARITY_TOLERANCE = 0.30;  // Ångströms

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

## 4. Candidate cycle-size labeling

For each planar cycle found by the fixed-distance graph heuristic, Q-Shape
records its atom count and whether all members are carbon. Example labels are
“5-membered carbon cycle candidate” and “6-membered carbon cycle candidate.”

Cycle size and composition alone do not establish ligand identity or hapticity.
The implementation does not evaluate bonding, electron count, contiguous
metal-ligand interactions, crystallographic disorder, or an independent
chemical model. Therefore it must not convert these labels to η assignments.

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

### 5.2 Planarity-screen boundary

The current heuristic uses a plane derived from the first three cycle atoms and
a fixed tolerance to screen candidate cycles. It records a centroid and a
metal-centroid distance. It does not expose a validated ring normal, slip
distortion, or tilt-angle analysis.

## 6. Multiple-large-cycle annotation

The implementation sets `hasMultipleLargeRings` when it finds at least two
planar-cycle candidates and every candidate contains at least five atoms. This
is only a size/count flag. It does **not** calculate inter-ring parallelism,
verify that the metal lies between cycles, or assign a sandwich topology.

## 7. Heuristic output structure

### 7.1 Output Structure

```javascript
{
    rings: [
        {
            indices: [0, 1, 2, 3, 4],     // Atom indices in ring
            atoms: [...],                  // Atom objects
            centroid: { x, y, z },        // Ring center
            size: 5,                       // Ring size
            ringSizeLabel: '5-membered carbon cycle candidate',
            distanceToMetal: 1.66          // Metal-centroid distance (Å)
        },
        // ... more rings
    ],
    monodentate: [...],                    // Legacy field: other coordinating atoms
    totalGroups: 3,
    ringCount: 2,
    summary: '2 planar-cycle candidate(s) + 3 other coordinating atom(s)',
    hasMultipleLargeRings: true,           // Size/count flag only
    candidateRingSizeLabels: ['5-membered carbon cycle candidate']
}
```

### 7.2 Coordination number used by CShM

The CShM coordination number is the number of individual coordinating atoms
inside the selected radius. Rings are not collapsed to one site. For example,
a bis-cyclopentadienyl coordination sphere contributes ten carbon sites, not
two centroid sites, to the current calculation.

## 8. Integration with CShM

### 8.1 All-atom analysis

Ring detection is reported alongside the CShM results, but it does not alter
the coordinate array passed to the shape calculation. Q-Shape currently has one
production representation for this calculation: the individual coordinating
atoms. A centroid-replacement method would be a distinct scientific method and
would require its own implementation, reference definitions, and validation.

### 8.2 No topology inference

Q-Shape reports candidate cycles for inspection. It does not label a structure
as sandwich, piano-stool, macrocyclic, or haptic from this heuristic, and it
does not reduce the CShM coordination number.

## 9. Algorithm Parameters

### 9.1 Configurable Constants

```javascript
const RING_DETECTION = {
    BOND_THRESHOLD: 1.80,         // Uniform adjacency threshold (Å)
    MAX_RING_SIZE: 8,             // Largest ring to detect
    MIN_RING_SIZE: 3,             // Smallest ring (allyl)
    PLANARITY_TOLERANCE: 0.30     // Max out-of-plane deviation (Å)
};
```

### 9.2 Performance Considerations

For structures with many coordinating atoms (CN > 12):
- Ring detection adds ~O(N²) overhead
- DFS pruning limits ring enumeration
- No production caching guarantee is currently claimed

## 10. References

1. Cotton, F. A.; Wilkinson, G.; Murillo, C. A.; Bochmann, M. *Advanced Inorganic Chemistry*, 6th ed.; Wiley: New York, 1999.
2. Huheey, J. E.; Keiter, E. A.; Keiter, R. L. *Inorganic Chemistry: Principles of Structure and Reactivity*, 4th ed.; Harper Collins: New York, 1993.
3. Elschenbroich, C. *Organometallics*, 3rd ed.; Wiley-VCH: Weinheim, 2006.
4. Alvarez, S. *Coord. Chem. Rev.* **2005**, 249, 1693-1708.

---

*Previous: [Structural Summary Statistics](05-Structural-Summaries.md)*

*Next: [Home](Home.md)*

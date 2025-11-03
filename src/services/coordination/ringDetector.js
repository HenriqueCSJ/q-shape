/**
 * Ring and Hapticity Detection Service
 *
 * Detects cyclic ligands (η³, η⁵, η⁶, etc.) in coordination complexes
 * and calculates their centroids for accurate geometry analysis.
 *
 * This is essential for analyzing sandwich compounds (ferrocene, benzene complexes)
 * and other π-coordinated ligands that traditional point-based algorithms fail to handle.
 */

/**
 * Calculate distance between two 3D points
 */
function distance(atom1, atom2) {
    return Math.hypot(
        atom1.x - atom2.x,
        atom1.y - atom2.y,
        atom1.z - atom2.z
    );
}

/**
 * Calculate centroid of a group of atoms
 */
function calculateCentroid(atoms) {
    if (!atoms || atoms.length === 0) return null;

    const sum = atoms.reduce(
        (acc, atom) => ({
            x: acc.x + atom.x,
            y: acc.y + atom.y,
            z: acc.z + atom.z
        }),
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: sum.x / atoms.length,
        y: sum.y / atoms.length,
        z: sum.z / atoms.length
    };
}

/**
 * Calculate cross product of two vectors
 */
function cross(v1, v2) {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
}

/**
 * Calculate magnitude of a vector
 */
function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Check if a group of atoms forms a planar ring
 * @param {Array} atoms - Group of atoms to check
 * @param {number} tolerance - Maximum deviation from plane (Å)
 * @returns {boolean} True if atoms are coplanar within tolerance
 */
function isPlanar(atoms, tolerance = 0.3) {
    if (atoms.length < 3) return false;

    // Use first three atoms to define plane
    const v1 = {
        x: atoms[1].x - atoms[0].x,
        y: atoms[1].y - atoms[0].y,
        z: atoms[1].z - atoms[0].z
    };

    const v2 = {
        x: atoms[2].x - atoms[0].x,
        y: atoms[2].y - atoms[0].y,
        z: atoms[2].z - atoms[0].z
    };

    // Normal vector to plane
    const normal = cross(v1, v2);
    const normMag = magnitude(normal);

    if (normMag < 1e-6) return false; // Collinear points

    // Normalize
    normal.x /= normMag;
    normal.y /= normMag;
    normal.z /= normMag;

    // Check distance of each atom from plane
    for (const atom of atoms) {
        const toAtom = {
            x: atom.x - atoms[0].x,
            y: atom.y - atoms[0].y,
            z: atom.z - atoms[0].z
        };

        const dist = Math.abs(
            toAtom.x * normal.x +
            toAtom.y * normal.y +
            toAtom.z * normal.z
        );

        if (dist > tolerance) return false;
    }

    return true;
}

/**
 * Find rings of coordinated atoms using depth-first search
 * @param {Array} atoms - All atoms in structure
 * @param {Array} coordIndices - Indices of atoms in coordination sphere
 * @param {number} maxRingSize - Maximum ring size to detect (default: 8)
 * @returns {Array<Array<number>>} Array of rings (each ring is array of atom indices)
 */
function findRings(atoms, coordIndices, maxRingSize = 8) {
    const rings = [];
    const bondThreshold = 1.8; // Å - typical C-C bond length + tolerance

    // Build adjacency list for coordinated atoms only
    const adjList = new Map();
    coordIndices.forEach(i => adjList.set(i, []));

    for (let i = 0; i < coordIndices.length; i++) {
        for (let j = i + 1; j < coordIndices.length; j++) {
            const idx1 = coordIndices[i];
            const idx2 = coordIndices[j];
            const dist = distance(atoms[idx1], atoms[idx2]);

            if (dist < bondThreshold) {
                adjList.get(idx1).push(idx2);
                adjList.get(idx2).push(idx1);
            }
        }
    }

    // Find simple cycles using DFS
    const visited = new Set();

    function dfs(start, current, path, depth) {
        if (depth > maxRingSize) return;

        if (path.length >= 3 && path.length <= maxRingSize) {
            // Check if we can close the ring
            const neighbors = adjList.get(current) || [];
            if (neighbors.includes(start)) {
                // Found a ring!
                const ring = [...path];

                // Check if this ring is planar
                const ringAtoms = ring.map(idx => atoms[idx]);
                if (isPlanar(ringAtoms)) {
                    // Check if ring is unique (not a duplicate)
                    const ringSet = new Set(ring);
                    const isDuplicate = rings.some(existingRing => {
                        if (existingRing.length !== ring.length) return false;
                        return existingRing.every(idx => ringSet.has(idx));
                    });

                    if (!isDuplicate) {
                        rings.push(ring);
                    }
                }
            }
        }

        visited.add(current);

        const neighbors = adjList.get(current) || [];
        for (const next of neighbors) {
            if (!visited.has(next) && !path.includes(next)) {
                dfs(start, next, [...path, next], depth + 1);
            }
        }

        visited.delete(current);
    }

    // Start DFS from each coordinated atom
    coordIndices.forEach(start => {
        visited.clear();
        dfs(start, start, [start], 1);
    });

    return rings;
}

/**
 * Detect hapticity mode based on ring size and geometry
 * @param {number} ringSize - Number of atoms in ring
 * @param {Array} ringAtoms - Atoms in the ring
 * @returns {string} Hapticity notation (e.g., 'η5', 'η6')
 */
function detectHapticity(ringSize, ringAtoms) {
    // Check if all atoms are carbon (common for organic ligands)
    const allCarbon = ringAtoms.every(atom => atom.element === 'C');

    if (ringSize === 5 && allCarbon) {
        return 'η⁵-Cp'; // Cyclopentadienyl
    } else if (ringSize === 6 && allCarbon) {
        return 'η⁶-C₆'; // Benzene or similar
    } else if (ringSize === 4 && allCarbon) {
        return 'η⁴-C₄'; // Butadiene
    } else if (ringSize === 3) {
        return 'η³-allyl'; // Allyl or similar
    } else if (ringSize === 7) {
        return 'η⁷-C₇'; // Cycloheptatrienyl (tropylium)
    } else {
        return `η${ringSize}`; // Generic hapticity notation
    }
}

/**
 * Group coordinated atoms by ring membership
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of metal center
 * @param {Array} coordIndices - Indices of coordinated atoms
 * @param {number} minRingSize - Minimum ring size to detect (default: 3)
 * @returns {Object} Detected ligand groups with rings and centroids
 */
export function detectLigandGroups(atoms, metalIndex, coordIndices, minRingSize = 3) {
    const rings = findRings(atoms, coordIndices);

    // Filter by minimum ring size
    const validRings = rings.filter(ring => ring.length >= minRingSize);

    // Calculate centroids and hapticity for each ring
    const ligandGroups = validRings.map(ring => {
        const ringAtoms = ring.map(idx => atoms[idx]);
        const centroid = calculateCentroid(ringAtoms);
        const hapticity = detectHapticity(ring.length, ringAtoms);

        // Calculate distance from metal to centroid
        const distToMetal = distance(atoms[metalIndex], centroid);

        return {
            type: 'ring',
            indices: ring,
            atoms: ringAtoms,
            centroid,
            hapticity,
            distanceToMetal: distToMetal,
            size: ring.length
        };
    });

    // Find atoms not in any ring (monodentate ligands)
    const atomsInRings = new Set(validRings.flat());
    const monodentate = coordIndices
        .filter(idx => !atomsInRings.has(idx))
        .map(idx => ({
            type: 'monodentate',
            indices: [idx],
            atoms: [atoms[idx]],
            centroid: atoms[idx], // Atom itself is the "centroid"
            hapticity: 'η¹',
            distanceToMetal: distance(atoms[metalIndex], atoms[idx]),
            size: 1
        }));

    return {
        rings: ligandGroups,
        monodentate,
        totalGroups: ligandGroups.length + monodentate.length,
        ringCount: ligandGroups.length,
        summary: {
            hasSandwichStructure: ligandGroups.length >= 2 &&
                                  ligandGroups.every(g => g.size >= 5),
            detectedHapticities: [...new Set(ligandGroups.map(g => g.hapticity))]
        }
    };
}

/**
 * Create centroid-based pseudo-atoms for CShM analysis
 * @param {Object} ligandGroups - Output from detectLigandGroups
 * @returns {Array} Array of centroid "atoms" for analysis
 */
export function createCentroidAtoms(ligandGroups) {
    const centroidAtoms = [];

    // Add ring centroids
    ligandGroups.rings.forEach((group, idx) => {
        centroidAtoms.push({
            element: `${group.hapticity}`, // Label with hapticity
            x: group.centroid.x,
            y: group.centroid.y,
            z: group.centroid.z,
            isRingCentroid: true,
            originalIndices: group.indices,
            ringSize: group.size
        });
    });

    // Add monodentate atoms as-is
    ligandGroups.monodentate.forEach(group => {
        const atom = group.atoms[0];
        centroidAtoms.push({
            element: atom.element,
            x: atom.x,
            y: atom.y,
            z: atom.z,
            isRingCentroid: false,
            originalIndices: group.indices,
            ringSize: 1
        });
    });

    return centroidAtoms;
}

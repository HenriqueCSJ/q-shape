/**
 * Heuristic Planar-Cycle Descriptor Service
 *
 * Flags planar cycles using a fixed-distance graph and calculates informational
 * centroids. It does not assign ligand identity, chemical hapticity, or
 * sandwich/piano-stool topology, and it does not alter production CShM inputs.
 */

import { RING_DETECTION } from '../../constants/algorithmConstants.js';

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
function isPlanar(atoms, tolerance = RING_DETECTION.PLANARITY_TOLERANCE) {
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

    const MIN_MAGNITUDE = 1e-6; // From KABSCH.MIN_MAGNITUDE - collinear points detection
    if (normMag < MIN_MAGNITUDE) return false; // Collinear points

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
function findRings(atoms, coordIndices, maxRingSize = RING_DETECTION.MAX_RING_SIZE) {
    const rings = [];
    const bondThreshold = RING_DETECTION.BOND_THRESHOLD;

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
 * Describe a planar-cycle candidate from ring size and composition.
 * This is a heuristic label, not a chemical hapticity assignment.
 * @param {number} ringSize - Number of atoms in ring
 * @param {Array} ringAtoms - Atoms in the ring
 * @returns {string} Informational ring-size label
 */
function describeRingSizeCandidate(ringSize, ringAtoms) {
    const allCarbon = ringAtoms.every(atom => atom.element === 'C');

    if (ringSize === 5 && allCarbon) {
        return '5-membered carbon cycle candidate';
    } else if (ringSize === 6 && allCarbon) {
        return '6-membered carbon cycle candidate';
    } else if (ringSize === 4 && allCarbon) {
        return '4-membered carbon cycle candidate';
    }
    return `${ringSize}-membered cycle candidate`;
}

/**
 * Group coordinated atoms by ring membership
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of metal center
 * @param {Array} coordIndices - Indices of coordinated atoms
 * @param {number} minRingSize - Minimum ring size to detect (default: 3)
 * @returns {Object} Detected ligand groups with rings and centroids
 */
export function detectLigandGroups(atoms, metalIndex, coordIndices, minRingSize = RING_DETECTION.MIN_RING_SIZE) {
    const rings = findRings(atoms, coordIndices);

    // Filter by minimum ring size
    const validRings = rings.filter(ring => ring.length >= minRingSize);

    // Calculate informational descriptors for each planar-cycle candidate.
    const ligandGroups = validRings.map(ring => {
        const ringAtoms = ring.map(idx => atoms[idx]);
        const centroid = calculateCentroid(ringAtoms);
        const ringSizeLabel = describeRingSizeCandidate(ring.length, ringAtoms);

        // Calculate distance from metal to centroid
        const distToMetal = distance(atoms[metalIndex], centroid);

        return {
            type: 'ring',
            indices: ring,
            atoms: ringAtoms,
            centroid,
            ringSizeLabel,
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
            ringSizeLabel: 'single coordinating atom',
            distanceToMetal: distance(atoms[metalIndex], atoms[idx]),
            size: 1
        }));

    return {
        rings: ligandGroups,
        monodentate,
        totalGroups: ligandGroups.length + monodentate.length,
        ringCount: ligandGroups.length,
        summary: `${ligandGroups.length} planar-cycle candidate(s) + ${monodentate.length} other coordinating atom(s)`,
        hasMultipleLargeRings: ligandGroups.length >= 2 &&
                               ligandGroups.every(g => g.size >= 5),
        candidateRingSizeLabels: [...new Set(ligandGroups.map(g => g.ringSizeLabel))]
    };
}

/**
 * Create centroid pseudo-atoms for legacy callers and diagnostics.
 * The production CShM path does not call this helper.
 * @param {Object} ligandGroups - Output from detectLigandGroups
 * @returns {Array} Array of centroid "atoms" for analysis
 */
export function createCentroidAtoms(ligandGroups) {
    const centroidAtoms = [];

    // Add ring centroids
    ligandGroups.rings.forEach((group, idx) => {
        centroidAtoms.push({
            element: 'X',
            x: group.centroid.x,
            y: group.centroid.y,
            z: group.centroid.z,
            isRingCentroid: true,
            originalIndices: group.indices,
            ringSize: group.size,
            ringSizeLabel: group.ringSizeLabel
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

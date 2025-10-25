/**
 * Coordination Sphere Detection Service
 *
 * Identifies atoms within the coordination sphere of a metal center
 * based on distance criteria.
 */

import * as THREE from 'three';

/**
 * Gets all coordinating atoms within a specified radius of the metal center
 *
 * Filters atoms by distance from metal center, calculates position vectors,
 * and sorts by distance. Excludes the metal center itself and atoms too close
 * (< 0.1 Å, likely numerical artifacts).
 *
 * @param {Array<Object>} atoms - Array of all atoms with x, y, z, element properties
 * @param {number} metalIndex - Index of the metal center atom
 * @param {number} coordRadius - Coordination radius in Angstroms
 * @returns {Array<Object>} Array of coordinating atoms with properties:
 *   - atom: Original atom object
 *   - idx: Original index in atoms array
 *   - distance: Distance from metal center (Å)
 *   - vec: THREE.Vector3 from metal center to atom
 *
 * @example
 * const atoms = [
 *   { element: 'Fe', x: 0, y: 0, z: 0 },
 *   { element: 'N', x: 2.1, y: 0, z: 0 },
 *   { element: 'N', x: 0, y: 2.1, z: 0 },
 *   { element: 'C', x: 5.0, y: 0, z: 0 },  // Too far
 * ];
 * const coordAtoms = getCoordinatingAtoms(atoms, 0, 3.0);
 * // Returns: [
 * //   { atom: {N}, idx: 1, distance: 2.1, vec: Vector3(2.1, 0, 0) },
 * //   { atom: {N}, idx: 2, distance: 2.1, vec: Vector3(0, 2.1, 0) }
 * // ]
 */
export function getCoordinatingAtoms(atoms, metalIndex, coordRadius) {
    if (!atoms || atoms.length === 0) {
        console.warn("No atoms provided for coordination sphere detection");
        return [];
    }

    if (metalIndex == null || metalIndex < 0 || metalIndex >= atoms.length) {
        console.warn("Invalid metal index for coordination sphere detection");
        return [];
    }

    if (!coordRadius || coordRadius <= 0) {
        console.warn("Invalid coordination radius");
        return [];
    }

    const metal = atoms[metalIndex];
    const center = new THREE.Vector3(metal.x, metal.y, metal.z);

    const coordinating = atoms
        .map((atom, idx) => {
            if (idx === metalIndex) return null;
            const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
            const distance = pos.distanceTo(center);

            if (!isFinite(distance)) {
                console.warn(`Non-finite distance for atom ${idx}`);
                return null;
            }

            return { atom, idx, distance, vec: pos.sub(center) };
        })
        .filter((x) => x && x.distance <= coordRadius && x.distance > 0.1)
        .sort((a, b) => a.distance - b.distance);

    return coordinating;
}

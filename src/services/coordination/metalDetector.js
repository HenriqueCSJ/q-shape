/**
 * Metal Center Detection Service
 *
 * Identifies the central metal atom in a coordination complex by analyzing
 * atomic connectivity and element types.
 */

import { ALL_METALS } from '../../constants/atomicData';

/**
 * Elements that should NEVER be selected as coordination centers
 * Includes: H, He, noble gases, and other non-coordinating atoms
 */
const NON_COORDINATING_ATOMS = new Set([
    'H',   // Hydrogen - never a coordination center
    'He',  // Helium
    'Ne',  // Neon
    'Ar',  // Argon
    'Kr',  // Krypton
    'Xe',  // Xenon
    'Rn',  // Radon
]);

/**
 * Detects the metal center atom in a molecular structure
 *
 * Algorithm:
 * 1. Identifies all metal atoms in the structure
 * 2. If single metal found, returns that index
 * 3. If multiple metals or no metals, selects atom with most neighbors within 3.5 Å
 * 4. NEVER selects H, He, or noble gases as coordination centers
 * 5. Returns index of most highly coordinated metal (or suitable non-metal if no metals present)
 *
 * @param {Array<Object>} atoms - Array of atoms with element, x, y, z properties
 * @returns {number} Index of the central metal atom (default: 0)
 *
 * @example
 * const atoms = [
 *   { element: 'Fe', x: 0, y: 0, z: 0 },
 *   { element: 'N', x: 2.0, y: 0, z: 0 },
 *   { element: 'N', x: 0, y: 2.0, z: 0 },
 *   // ... more atoms
 * ];
 * const metalIndex = detectMetalCenter(atoms);
 * // Returns: 0 (the Fe atom)
 */
export function detectMetalCenter(atoms) {
    try {
        if (!atoms || atoms.length === 0) {
            throw new Error("No atoms provided for metal detection");
        }

        // Find all metal indices
        const metalIndices = atoms
            .map((a, i) => ALL_METALS.has(a.element) ? i : -1)
            .filter(i => i !== -1);

        if (metalIndices.length === 1) return metalIndices[0];

        // Filter out non-coordinating atoms (H, He, noble gases)
        const coordinatingIndices = atoms
            .map((a, i) => NON_COORDINATING_ATOMS.has(a.element) ? -1 : i)
            .filter(i => i !== -1);

        // Prefer metals if available, otherwise use any coordinating atom
        let targetIndices = metalIndices.length > 0 ? metalIndices : coordinatingIndices;

        // Safety: If no valid atoms (shouldn't happen), fall back to all non-H atoms
        if (targetIndices.length === 0) {
            console.warn("No suitable coordination center found - falling back to non-hydrogen atoms");
            targetIndices = atoms
                .map((a, i) => a.element !== 'H' ? i : -1)
                .filter(i => i !== -1);
        }

        // If still nothing (structure is all H?!), just use first atom
        if (targetIndices.length === 0) {
            console.warn("Structure contains only hydrogen atoms - using first atom");
            return 0;
        }

        let maxNeighbors = 0;
        let centralAtomIdx = targetIndices[0]; // Safe default

        targetIndices.forEach((idx) => {
            let neighbors = 0;
            const atom = atoms[idx];

            if (!atom || !isFinite(atom.x) || !isFinite(atom.y) || !isFinite(atom.z)) {
                console.warn(`Invalid atom data at index ${idx}`);
                return;
            }

            atoms.forEach((other, j) => {
                if (idx === j) return;
                const dist = Math.hypot(atom.x - other.x, atom.y - other.y, atom.z - other.z);
                if (isFinite(dist) && dist < 3.5) neighbors++;
            });

            if (neighbors > maxNeighbors) {
                maxNeighbors = neighbors;
                centralAtomIdx = idx;
            }
        });

        // Debug logging
        if (atoms[centralAtomIdx]) {
            console.log(`Metal center detected: ${atoms[centralAtomIdx].element} (index ${centralAtomIdx}, ${maxNeighbors} neighbors)`);
        }

        return centralAtomIdx;
    } catch (error) {
        console.error("Error in metal center detection:", error);
        return 0;
    }
}

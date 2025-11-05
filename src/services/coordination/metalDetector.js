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
 * 3. If multiple metals, selects the one with most neighbors (highest coordination)
 * 4. Metals get STRONG preference with base score of 1000 + neighbor count
 * 5. Non-metals only get neighbor count (0-100 range typically)
 * 6. NEVER selects H, He, or noble gases as coordination centers
 * 7. Returns index of highest-scoring atom
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

        // Fast path: single metal found
        if (metalIndices.length === 1) {
            const idx = metalIndices[0];
            console.log(`Metal center detected: ${atoms[idx].element} (index ${idx}, single metal - fast path)`);
            return idx;
        }

        // Filter out non-coordinating atoms (H, He, noble gases)
        const coordinatingIndices = atoms
            .map((a, i) => NON_COORDINATING_ATOMS.has(a.element) ? -1 : i)
            .filter(i => i !== -1);

        // Safety: If no valid atoms (shouldn't happen), fall back to all non-H atoms
        let candidates = coordinatingIndices.length > 0 ? coordinatingIndices : atoms
            .map((a, i) => a.element !== 'H' ? i : -1)
            .filter(i => i !== -1);

        // If still nothing (structure is all H?!), just use first atom
        if (candidates.length === 0) {
            console.warn("Structure contains only hydrogen atoms - using first atom");
            return 0;
        }

        // Score each candidate:
        // - Metals get base score of 1000 (strong preference)
        // - All candidates get +1 for each neighbor within 3.5 Å
        // This ensures metals always beat non-metals unless there are no metals
        let maxScore = -1;
        let centralAtomIdx = candidates[0]; // Safe default

        candidates.forEach((idx) => {
            const atom = atoms[idx];

            if (!atom || !isFinite(atom.x) || !isFinite(atom.y) || !isFinite(atom.z)) {
                console.warn(`Invalid atom data at index ${idx}`);
                return;
            }

            // Count neighbors within 3.5 Å
            let neighbors = 0;
            atoms.forEach((other, j) => {
                if (idx === j) return;
                const dist = Math.hypot(atom.x - other.x, atom.y - other.y, atom.z - other.z);
                if (isFinite(dist) && dist < 3.5) neighbors++;
            });

            // Calculate score:
            // Metal atoms: 1000 + neighbors (1000-1100 range typically)
            // Non-metal atoms: 0 + neighbors (0-100 range typically)
            const isMetal = ALL_METALS.has(atom.element);
            const score = (isMetal ? 1000 : 0) + neighbors;

            if (score > maxScore) {
                maxScore = score;
                centralAtomIdx = idx;
            }
        });

        // Debug logging
        const centerAtom = atoms[centralAtomIdx];
        const isMetal = ALL_METALS.has(centerAtom.element);
        const neighbors = maxScore - (isMetal ? 1000 : 0);

        console.log(`Metal center detected: ${centerAtom.element} (index ${centralAtomIdx}, ${neighbors} neighbors, ${isMetal ? 'METAL' : 'non-metal'}, score ${maxScore})`);

        if (!isMetal) {
            console.warn(`⚠️  WARNING: Selected non-metal ${centerAtom.element} as coordination center. No metals found in structure?`);
        }

        return centralAtomIdx;
    } catch (error) {
        console.error("Error in metal center detection:", error);
        return 0;
    }
}

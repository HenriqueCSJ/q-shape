/**
 * Gap Detection Algorithm Module (v1.1.0 Feature)
 *
 * This module contains the core algorithm for finding the optimal coordination
 * sphere radius for a target coordination number. It analyzes the distance
 * distribution of neighboring atoms and identifies natural gaps between
 * coordination shells.
 */

/**
 * Find optimal radius for a target coordination number
 *
 * Algorithm:
 * 1. Calculate distances from metal center to all neighboring atoms
 * 2. Sort neighbors by distance
 * 3. Identify the Nth nearest neighbor (where N = target CN)
 * 4. Find the gap between Nth and (N+1)th neighbors
 * 5. Set optimal radius at the midpoint of this gap
 *
 * This approach ensures that exactly N atoms fall within the coordination
 * sphere while maximizing separation from the next coordination shell.
 *
 * @param {Object} params - Parameters for gap detection
 * @param {Array<{x: number, y: number, z: number}>} params.atoms - All atoms in structure
 * @param {number} params.metalIndex - Index of the metal center atom
 * @param {number} params.targetCN - Target coordination number (2-60)
 * @param {Object} params.THREE - THREE.js library object (for Vector3)
 * @returns {{
 *   optimalRadius: number,
 *   gap: number|null,
 *   isLastAtom: boolean,
 *   neighborsFound: number,
 *   error: string|null
 * }} Result object with optimal radius and gap information
 *
 * @example
 * const result = findOptimalRadiusForCN({
 *   atoms: atomArray,
 *   metalIndex: 0,
 *   targetCN: 6,
 *   THREE: THREE
 * });
 *
 * if (!result.error) {
 *   console.log(`Optimal radius: ${result.optimalRadius.toFixed(3)} Å`);
 *   if (result.gap !== null) {
 *     console.log(`Gap to next shell: ${result.gap.toFixed(3)} Å`);
 *   }
 * }
 */
export default function findOptimalRadiusForCN({ atoms, metalIndex, targetCN, THREE }) {
    // Validate input
    if (!Number.isFinite(targetCN) || targetCN < 2 || targetCN > 60) {
        return {
            error: "Target CN must be between 2 and 60",
            optimalRadius: null,
            gap: null,
            isLastAtom: false,
            neighborsFound: 0
        };
    }

    if (metalIndex == null || !atoms.length) {
        return {
            error: "Invalid metal center or empty atom list",
            optimalRadius: null,
            gap: null,
            isLastAtom: false,
            neighborsFound: 0
        };
    }

    try {
        const metal = atoms[metalIndex];
        const center = new THREE.Vector3(metal.x, metal.y, metal.z);

        // Calculate distances to all neighbors
        const allNeighbors = atoms
            .map((atom, idx) => {
                if (idx === metalIndex) return null;
                const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
                const distance = pos.distanceTo(center);
                if (!isFinite(distance)) return null;
                return { atom, idx, distance, vec: pos.sub(center) };
            })
            .filter((x) => x && x.distance > 0.1) // Filter out very close atoms (likely overlapping)
            .sort((a, b) => a.distance - b.distance); // Sort by distance

        // Check if we have enough neighbors
        if (allNeighbors.length < targetCN) {
            return {
                error: `Not enough neighbors for CN=${targetCN}. Found only ${allNeighbors.length}.`,
                optimalRadius: null,
                gap: null,
                isLastAtom: false,
                neighborsFound: allNeighbors.length
            };
        }

        // Get the Nth nearest neighbor (last one to include)
        const lastIncluded = allNeighbors[targetCN - 1];
        let optimalRadius;
        let gap = null;
        let isLastAtom = false;

        // Check if there's a next neighbor to create a gap
        if (allNeighbors.length > targetCN) {
            const firstExcluded = allNeighbors[targetCN];
            // Set radius at midpoint between last included and first excluded
            optimalRadius = (lastIncluded.distance + firstExcluded.distance) / 2.0;
            gap = firstExcluded.distance - lastIncluded.distance;
        } else {
            // No more neighbors, add safety margin
            optimalRadius = lastIncluded.distance + 0.4;
            isLastAtom = true;
        }

        return {
            optimalRadius,
            gap,
            isLastAtom,
            neighborsFound: allNeighbors.length,
            error: null
        };

    } catch (error) {
        return {
            error: `Error in gap detection: ${error.message}`,
            optimalRadius: null,
            gap: null,
            isLastAtom: false,
            neighborsFound: 0
        };
    }
}

/**
 * Format gap detection result as a human-readable message
 * @param {Object} result - Result from findOptimalRadiusForCN
 * @param {number} targetCN - The target coordination number
 * @returns {string} Formatted message
 */
export function formatGapDetectionResult(result, targetCN) {
    if (result.error) {
        return result.error;
    }

    let message = `Set radius to ${result.optimalRadius.toFixed(3)} Å for CN=${targetCN}`;

    if (result.gap !== null) {
        message += ` (Gap to next atom: ${result.gap.toFixed(3)} Å)`;
    } else if (result.isLastAtom) {
        message += " (Last available atom)";
    }

    return message;
}

/**
 * Coordination Radius Detection Service
 *
 * Provides functionality for automatically detecting optimal coordination sphere radius
 * based on distance analysis between metal center and surrounding atoms.
 */

/**
 * Detects the optimal coordination radius for a metal center
 *
 * Algorithm:
 * 1. Calculates distances from metal to all other atoms
 * 2. Identifies the largest gap in distance distribution (up to 12 nearest atoms)
 * 3. Sets radius at the midpoint of the largest gap
 * 4. Constrains result between 1.8 and 5.5 Angstroms
 *
 * @param {Object} metal - Metal center atom with x, y, z coordinates
 * @param {Array<Object>} atoms - Array of all atoms in the structure
 * @returns {number} Optimal coordination radius in Angstroms (default: 3.0)
 *
 * @example
 * const metal = { x: 0, y: 0, z: 0, element: 'Fe' };
 * const atoms = [
 *   { x: 2.1, y: 0, z: 0, element: 'N' },
 *   { x: 0, y: 2.1, z: 0, element: 'N' },
 *   // ...
 * ];
 * const radius = detectOptimalRadius(metal, atoms);
 * // Returns: 2.5 (approximate, depends on gap analysis)
 */
export function detectOptimalRadius(metal, atoms) {
    try {
        if (!metal || !atoms || atoms.length === 0) {
            throw new Error("Invalid input for radius detection");
        }

        const distances = atoms
            .map((atom) => {
                if (atom === metal) return null;
                const dx = atom.x - metal.x;
                const dy = atom.y - metal.y;
                const dz = atom.z - metal.z;
                const dist = Math.hypot(dx, dy, dz);

                if (!isFinite(dist)) {
                    console.warn(`Non-finite distance detected for atom ${atom.element}`);
                    return null;
                }

                return dist;
            })
            .filter((d) => d !== null && d > 0.1)
            .sort((a, b) => a - b);

        if (distances.length === 0) {
            console.warn("No valid neighboring atoms found, using default radius");
            return 3.0;
        }

        let maxGap = 0;
        let optimalRadius = distances[Math.min(5, distances.length - 1)] + 0.4;

        for (let i = 1; i < Math.min(distances.length, 12); i++) {
            const gap = distances[i] - distances[i - 1];
            if (gap > maxGap && distances[i - 1] < 4.5) {
                maxGap = gap;
                optimalRadius = (distances[i - 1] + distances[i]) / 2;
            }
        }

        const finalRadius = Math.max(1.8, Math.min(5.5, optimalRadius));

        if (!isFinite(finalRadius)) {
            console.warn("Non-finite radius calculated, using default");
            return 3.0;
        }

        return finalRadius;
    } catch (error) {
        console.error("Error in radius detection:", error);
        return 3.0;
    }
}

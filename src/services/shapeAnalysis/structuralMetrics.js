/**
 * Structural summary metrics for a coordination sphere.
 *
 * These are direct descriptive statistics of the selected metal-ligand
 * distances and ligand-metal-ligand angles. They are not geometry-assignment
 * scores and are not combined into a synthetic quality metric.
 */

/**
 * Calculate descriptive bond-length and inter-ligand-angle statistics.
 *
 * @param {Array<Object>} coordAtoms - Coordinating atoms with distance and vec properties
 * @returns {Object|null} Complete bond-length and angle summaries, or null when unavailable
 */
export function calculateAdditionalMetrics(coordAtoms) {
    try {
        if (!Array.isArray(coordAtoms) || coordAtoms.length === 0) {
            return null;
        }

        const hasInvalidEntry = coordAtoms.some(entry => {
            if (!entry ||
                !Number.isFinite(entry.distance) ||
                entry.distance < 0 ||
                !entry.vec ||
                typeof entry.vec.angleTo !== 'function' ||
                !Number.isFinite(entry.vec.x) ||
                !Number.isFinite(entry.vec.y) ||
                !Number.isFinite(entry.vec.z)) {
                return true;
            }
            const normSquared = entry.vec.x * entry.vec.x +
                entry.vec.y * entry.vec.y + entry.vec.z * entry.vec.z;
            return !Number.isFinite(normSquared) || normSquared <= 0;
        });
        if (hasInvalidEntry) {
            return null;
        }

        const distances = coordAtoms.map(c => c.distance);
        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((acc, d) => acc + Math.pow(d - meanDist, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        const angles = [];
        for (let i = 0; i < coordAtoms.length; i++) {
            for (let j = i + 1; j < coordAtoms.length; j++) {
                const angle = coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI);
                if (!Number.isFinite(angle)) return null;
                angles.push(angle);
            }
        }

        const expectedAngleCount = coordAtoms.length * (coordAtoms.length - 1) / 2;
        if (angles.length !== expectedAngleCount) return null;

        let angleStats = { count: 0, mean: null, stdDev: null, min: null, max: null };
        if (angles.length > 0) {
            const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
            const angleVariance = angles.reduce((acc, a) => acc + Math.pow(a - meanAngle, 2), 0) / angles.length;
            angleStats = {
                count: angles.length,
                mean: meanAngle,
                stdDev: Math.sqrt(angleVariance),
                min: Math.min(...angles),
                max: Math.max(...angles)
            };
        }

        return {
            bondLengthVariance: variance,
            meanBondLength: meanDist,
            stdDevBondLength: stdDev,
            minBondLength: Math.min(...distances),
            maxBondLength: Math.max(...distances),
            angleStats
        };
    } catch (error) {
        console.error('Error calculating structural summary metrics:', error);
        return null;
    }
}

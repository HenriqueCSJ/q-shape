/**
 * Quality Metrics Service
 *
 * Provides comprehensive quality assessment for coordination geometries including:
 * - Bond length statistics
 * - Angular distribution analysis
 * - Angular distortion indices
 * - Bond length uniformity
 * - Overall quality scores
 */

import * as THREE from 'three';

/**
 * Calculates additional structural metrics for coordinating atoms
 *
 * Computes statistical measures of bond lengths and inter-ligand angles including:
 * - Mean, variance, standard deviation of bond lengths
 * - Minimum and maximum bond lengths
 * - Complete angular statistics between all ligand pairs
 *
 * @param {Array<Object>} coordAtoms - Array of coordinating atoms with distance and vec properties
 * @returns {Object} Metrics object containing:
 *   - bondLengthVariance: Variance in bond lengths
 *   - meanBondLength: Mean bond length (Å)
 *   - stdDevBondLength: Standard deviation of bond lengths
 *   - minBondLength: Minimum bond length (Å)
 *   - maxBondLength: Maximum bond length (Å)
 *   - angleStats: { count, mean, stdDev, min, max } for inter-ligand angles (degrees)
 *
 * @example
 * const coordAtoms = [
 *   { distance: 2.1, vec: new THREE.Vector3(2.1, 0, 0) },
 *   { distance: 2.0, vec: new THREE.Vector3(0, 2.0, 0) },
 *   { distance: 2.1, vec: new THREE.Vector3(0, 0, 2.1) },
 * ];
 * const metrics = calculateAdditionalMetrics(coordAtoms);
 * // Returns: {
 * //   meanBondLength: 2.067,
 * //   stdDevBondLength: 0.047,
 * //   angleStats: { mean: 90, ... },
 * //   ...
 * // }
 */
export function calculateAdditionalMetrics(coordAtoms) {
    try {
        if (!coordAtoms || coordAtoms.length === 0) {
            return {
                bondLengthVariance: 0,
                meanBondLength: 0,
                stdDevBondLength: 0,
                minBondLength: 0,
                maxBondLength: 0,
                angleStats: { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 }
            };
        }

        const distances = coordAtoms.map(c => c.distance).filter(d => isFinite(d));
        if (distances.length === 0) {
            throw new Error("No valid distances found");
        }

        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((acc, d) => acc + Math.pow(d - meanDist, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        const angles = [];
        for (let i = 0; i < coordAtoms.length; i++) {
            for (let j = i + 1; j < coordAtoms.length; j++) {
                const angle = coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI);
                if (isFinite(angle)) {
                    angles.push(angle);
                }
            }
        }

        let angleStats = { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 };
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
        console.error("Error calculating additional metrics:", error);
        return {
            bondLengthVariance: 0,
            meanBondLength: 0,
            stdDevBondLength: 0,
            minBondLength: 0,
            maxBondLength: 0,
            angleStats: { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 }
        };
    }
}

/**
 * Calculates comprehensive quality metrics for a coordination geometry
 *
 * Computes several quality indices comparing actual to ideal geometry:
 * - Angular distortion index: Mean absolute deviation of angles from ideal
 * - Bond length uniformity: Percentage uniformity of metal-ligand bonds
 * - Overall quality score: Combined metric (0-100, higher is better)
 *
 * @param {Array<Object>} coordAtoms - Coordinating atoms with distance and vec properties
 * @param {Object} bestGeometry - Best-fit geometry with refCoords array
 * @param {number} shapeMeasure - Continuous shape measure (CShM) value
 * @returns {Object|null} Quality metrics object containing:
 *   - angularDistortionIndex: Mean angular deviation from ideal (degrees)
 *   - bondLengthUniformityIndex: Percentage bond length uniformity (0-100)
 *   - polyhedralVolumeRatio: Volume ratio (currently 1.0 placeholder)
 *   - shapeDeviationParameter: Normalized shape deviation
 *   - overallQualityScore: Combined quality score (0-100)
 *   - rmsd: Root mean square deviation from ideal
 *
 * @example
 * const coordAtoms = [...]; // from getCoordinatingAtoms
 * const bestGeometry = {
 *   name: 'octahedron',
 *   shapeMeasure: 0.5,
 *   refCoords: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
 * };
 * const quality = calculateQualityMetrics(coordAtoms, bestGeometry, 0.5);
 * // Returns: {
 * //   angularDistortionIndex: 2.3,
 * //   bondLengthUniformityIndex: 95.6,
 * //   overallQualityScore: 92.1,
 * //   ...
 * // }
 */
export function calculateQualityMetrics(coordAtoms, bestGeometry, shapeMeasure) {
    try {
        if (!coordAtoms || coordAtoms.length === 0 || !bestGeometry) {
            return null;
        }

        const idealAngles = [];
        const actualAngles = [];

        if (bestGeometry.refCoords) {
            for (let i = 0; i < bestGeometry.refCoords.length; i++) {
                for (let j = i + 1; j < bestGeometry.refCoords.length; j++) {
                    const v1 = new THREE.Vector3(...bestGeometry.refCoords[i]);
                    const v2 = new THREE.Vector3(...bestGeometry.refCoords[j]);
                    idealAngles.push(v1.angleTo(v2) * (180 / Math.PI));
                }
            }
        }

        for (let i = 0; i < coordAtoms.length; i++) {
            for (let j = i + 1; j < coordAtoms.length; j++) {
                actualAngles.push(coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI));
            }
        }

        let angularDistortion = 0;
        if (idealAngles.length > 0 && actualAngles.length === idealAngles.length) {
            idealAngles.sort((a, b) => a - b);
            actualAngles.sort((a, b) => a - b);

            const deviations = idealAngles.map((ideal, i) => Math.abs(ideal - actualAngles[i]));
            angularDistortion = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        }

        const distances = coordAtoms.map(c => c.distance);
        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const relativeDeviations = distances.map(d => Math.abs(d - meanDist) / meanDist);
        const bondLengthUniformity = 100 * (1 - (relativeDeviations.reduce((a, b) => a + b, 0) / relativeDeviations.length));

        const volumeRatio = 1.0;

        /**
         * Shape Deviation Parameter
         *
         * Derived from CShM as: √(CShM/100)
         * This gives a normalized deviation value where:
         * - 0 = perfect match to ideal geometry
         * - 1 = severe distortion
         *
         * Reference: Pinsky & Avnir (1998), Inorg. Chem., 37, 5575-5582
         */
        const shapeDeviation = Math.sqrt(shapeMeasure / 100);

        const qualityScore = Math.max(0, Math.min(100,
            100 - (shapeMeasure * 2) - (angularDistortion * 0.5) - ((100 - bondLengthUniformity) * 0.3)
        ));

        /**
         * Approximate RMSD Calculation
         *
         * IMPORTANT: This is an APPROXIMATION derived from CShM, not a true RMSD.
         *
         * For normalized coordinates on the unit sphere, the relationship is:
         *   CShM = 100 × (1/N) × Σ|qi - pi|²
         *   approxRMSD = √(CShM/100) when coordinates are unit-normalized
         *
         * This approximation is valid because:
         * 1. Both actual and reference coordinates are normalized to unit sphere
         * 2. Optimal rotation and permutation have been applied by the CShM algorithm
         * 3. For unit-normalized structures, Σ|qi|² = N, so CShM/100 = mean squared deviation
         *
         * Limitations:
         * - Should not be directly compared with RMSD from other software using
         *   non-normalized coordinates (e.g., Cartesian RMSD in Å)
         * - Does not account for bond length variations (only angular arrangement)
         *
         * For publication: Clearly state this is a normalized RMSD on the unit sphere,
         * reflecting angular deviation from ideal geometry.
         *
         * References:
         * - Pinsky & Avnir (1998), Inorg. Chem., 37, 5575-5582
         * - Alvarez et al. (2002), Coord. Chem. Rev., 249, 1693-1708
         */
        const approximateRmsd = Math.sqrt(shapeMeasure / 100);

        return {
            angularDistortionIndex: angularDistortion,
            bondLengthUniformityIndex: bondLengthUniformity,
            polyhedralVolumeRatio: volumeRatio,
            shapeDeviationParameter: shapeDeviation,
            overallQualityScore: qualityScore,
            rmsd: approximateRmsd,
            // Note for developers: rmsd is derived from CShM, not computed directly
            _rmsdNote: 'Approximate RMSD derived from CShM for unit-normalized coordinates'
        };
    } catch (error) {
        console.error("Error calculating quality metrics:", error);
        return null;
    }
}

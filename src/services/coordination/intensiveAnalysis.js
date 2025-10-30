/**
 * Enhanced Intensive Analysis Service
 *
 * Provides chemically-intelligent coordination geometry analysis by:
 * 1. Detecting π-coordinated ligands (rings, hapticity)
 * 2. Running BOTH point-based AND centroid-based CShM analysis
 * 3. Recommending the most chemically reasonable interpretation
 *
 * This makes Q-Shape superior to SHAPE 2.1 for sandwich compounds,
 * ferrocenes, benzene complexes, and other π-coordinated systems.
 */

import { detectLigandGroups, createCentroidAtoms } from './ringDetector';
import calculateShapeMeasure from '../shapeAnalysis/shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';

/**
 * Get coordinated atom indices within specified radius of metal center
 */
function getCoordinatedAtoms(atoms, metalIndex, radius) {
    const metal = atoms[metalIndex];
    const coordinated = [];

    atoms.forEach((atom, idx) => {
        if (idx === metalIndex) return;

        const dist = Math.hypot(
            atom.x - metal.x,
            atom.y - metal.y,
            atom.z - metal.z
        );

        if (dist <= radius) {
            coordinated.push(idx);
        }
    });

    return coordinated;
}

/**
 * Run intensive analysis with ring detection and dual CShM calculation
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @returns {Object} Comprehensive analysis results
 */
export function runIntensiveAnalysis(atoms, metalIndex, radius) {
    console.log(`Starting intensive analysis for ${atoms[metalIndex].element}...`);

    // Step 1: Get coordinated atoms
    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);
    const coordAtoms = coordIndices.map(idx => atoms[idx]);

    console.log(`Found ${coordIndices.length} atoms in coordination sphere`);

    // Step 2: Detect ligand groups (rings and monodentate)
    const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);

    console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);

    // Step 3: Point-based analysis (traditional method)
    const pointBasedResults = analyzePointBased(atoms, metalIndex, coordIndices);

    // Step 4: Centroid-based analysis (new method)
    let centroidBasedResults = null;
    if (ligandGroups.ringCount > 0) {
        centroidBasedResults = analyzeCentroidBased(
            atoms,
            metalIndex,
            ligandGroups
        );
    }

    // Step 5: Determine best interpretation
    const recommendation = determineRecommendation(
        pointBasedResults,
        centroidBasedResults,
        ligandGroups
    );

    return {
        coordIndices,
        ligandGroups,
        pointBasedAnalysis: pointBasedResults,
        centroidBasedAnalysis: centroidBasedResults,
        recommendation,
        metadata: {
            metalElement: atoms[metalIndex].element,
            metalIndex,
            radius,
            timestamp: Date.now()
        }
    };
}

/**
 * Perform traditional point-based CShM analysis
 */
function analyzePointBased(atoms, metalIndex, coordIndices) {
    const CN = coordIndices.length;
    const metal = atoms[metalIndex];

    // Get all possible shapes for this CN
    const geometries = REFERENCE_GEOMETRIES[CN];

    if (!geometries) {
        return {
            coordinationNumber: CN,
            results: [],
            error: `No reference geometries defined for CN=${CN}`
        };
    }

    // Prepare coordinates (centered at origin, metal subtracted)
    const actualCoords = coordIndices.map(idx => {
        const atom = atoms[idx];
        return [
            atom.x - metal.x,
            atom.y - metal.y,
            atom.z - metal.z
        ];
    });

    // Calculate CShM for each shape
    const results = [];
    const geometryNames = Object.keys(geometries);

    for (const name of geometryNames) {
        const refCoords = geometries[name];

        try {
            const { measure } = calculateShapeMeasure(actualCoords, refCoords, 'intensive');

            results.push({
                shapeName: name,
                code: name,
                symmetry: '', // Would need to be added to reference geometries
                cshm: measure,
                quality: getCshmQuality(measure),
                qualityPercentage: getCshmPercentage(measure)
            });
        } catch (error) {
            console.warn(`Failed to calculate CShM for ${name}:`, error.message);
        }
    }

    // Sort by CShM (best first)
    results.sort((a, b) => a.cshm - b.cshm);

    return {
        coordinationNumber: CN,
        method: 'point-based',
        results: results.slice(0, 10), // Top 10 results
        bestMatch: results[0]
    };
}

/**
 * Perform centroid-based CShM analysis
 */
function analyzeCentroidBased(atoms, metalIndex, ligandGroups) {
    const metal = atoms[metalIndex];

    // Create pseudo-atoms from centroids
    const centroidAtoms = createCentroidAtoms(ligandGroups);
    const CN = centroidAtoms.length;

    console.log(`Centroid-based analysis: CN=${CN} (${ligandGroups.ringCount} ring centroids + ${ligandGroups.monodentate.length} monodentate)`);

    // Get possible shapes for centroid-based CN
    const geometries = REFERENCE_GEOMETRIES[CN];

    if (!geometries) {
        return {
            coordinationNumber: CN,
            ligandGroups,
            results: [],
            error: `No reference geometries defined for CN=${CN}`
        };
    }

    // Prepare coordinates (centered at origin, metal subtracted)
    const actualCoords = centroidAtoms.map(centroid => [
        centroid.x - metal.x,
        centroid.y - metal.y,
        centroid.z - metal.z
    ]);

    // Calculate CShM for each shape
    const results = [];
    const geometryNames = Object.keys(geometries);

    for (const name of geometryNames) {
        const refCoords = geometries[name];

        try {
            const { measure } = calculateShapeMeasure(actualCoords, refCoords, 'intensive');

            results.push({
                shapeName: name,
                code: name,
                symmetry: '',
                cshm: measure,
                quality: getCshmQuality(measure),
                qualityPercentage: getCshmPercentage(measure)
            });
        } catch (error) {
            console.warn(`Failed to calculate CShM for ${name}:`, error.message);
        }
    }

    // Sort by CShM (best first)
    results.sort((a, b) => a.cshm - b.cshm);

    return {
        coordinationNumber: CN,
        method: 'centroid-based',
        ligandGroups,
        centroidAtoms,
        results: results.slice(0, 10),
        bestMatch: results[0]
    };
}

/**
 * Determine which analysis method is most chemically reasonable
 */
function determineRecommendation(pointBased, centroidBased, ligandGroups) {
    // If no rings detected, point-based is the only option
    if (!centroidBased || ligandGroups.ringCount === 0) {
        return {
            method: 'point-based',
            reason: 'No π-coordinated rings detected - point-based analysis is appropriate',
            confidence: 'high',
            preferredResult: pointBased
        };
    }

    // If sandwich structure detected (2+ rings, both η5 or η6)
    if (ligandGroups.summary.hasSandwichStructure) {
        // Centroid-based should be MUCH better for sandwich compounds
        const improvement = pointBased.bestMatch.cshm - centroidBased.bestMatch.cshm;

        return {
            method: 'centroid-based',
            reason: `Sandwich structure detected (${ligandGroups.summary.detectedHapticities.join(', ')}) - centroid-based analysis is chemically correct`,
            confidence: 'very high',
            improvement: improvement.toFixed(3),
            preferredResult: centroidBased,
            note: `Point-based treats ${pointBased.coordinationNumber} carbons as independent ligands. ` +
                  `Centroid-based correctly treats ${ligandGroups.ringCount} ring(s) as ${centroidBased.coordinationNumber} coordination site(s).`
        };
    }

    // Mixed case: some rings + some monodentate
    if (ligandGroups.ringCount > 0 && ligandGroups.monodentate.length > 0) {
        const improvement = pointBased.bestMatch.cshm - centroidBased.bestMatch.cshm;

        if (improvement > 1.0) {
            return {
                method: 'centroid-based',
                reason: `Mixed coordination (${ligandGroups.ringCount} ring(s) + ${ligandGroups.monodentate.length} monodentate) - centroid-based significantly better`,
                confidence: 'high',
                improvement: improvement.toFixed(3),
                preferredResult: centroidBased,
                note: 'Centroid-based analysis treats π-coordinated rings as single coordination sites.'
            };
        } else {
            return {
                method: 'both',
                reason: 'Mixed coordination - both interpretations are valid',
                confidence: 'medium',
                improvement: improvement.toFixed(3),
                note: 'Consider chemical context to choose appropriate interpretation.',
                pointBasedResult: pointBased,
                centroidBasedResult: centroidBased
            };
        }
    }

    // Default: prefer centroid if rings detected
    return {
        method: 'centroid-based',
        reason: `π-coordinated rings detected (${ligandGroups.summary.detectedHapticities.join(', ')})`,
        confidence: 'medium',
        preferredResult: centroidBased
    };
}

/**
 * Convert CShM value to qualitative description
 */
function getCshmQuality(cshm) {
    if (cshm < 0.1) return 'Perfect Match';
    if (cshm < 0.5) return 'Excellent';
    if (cshm < 1.0) return 'Very Good';
    if (cshm < 2.0) return 'Good';
    if (cshm < 3.0) return 'Moderate';
    if (cshm < 5.0) return 'Fair';
    if (cshm < 10.0) return 'Poor';
    return 'Very Poor / No Match';
}

/**
 * Convert CShM value to percentage match
 */
function getCshmPercentage(cshm) {
    // Rough conversion: 0 = 100%, 10 = 0%
    const percentage = Math.max(0, Math.min(100, 100 - (cshm * 10)));
    return Math.round(percentage);
}

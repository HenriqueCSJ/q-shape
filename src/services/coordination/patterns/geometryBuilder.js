/**
 * Geometry Builder for Pattern-Based Analysis
 *
 * Constructs ideal reference geometries based on detected patterns
 * and calculates CShM against actual coordinates.
 */

import { REFERENCE_GEOMETRIES } from '../../../constants/referenceGeometries';
import calculateShapeMeasure from '../../shapeAnalysis/shapeCalculator';

/**
 * Calculate centroid of a set of coordinates
 */
function calculateCentroid(coords) {
    const sum = coords.reduce((acc, c) => [
        acc[0] + c[0],
        acc[1] + c[1],
        acc[2] + c[2]
    ], [0, 0, 0]);
    return [sum[0] / coords.length, sum[1] / coords.length, sum[2] / coords.length];
}

/**
 * Build geometry analysis for sandwich structures
 *
 * Sandwich structures use CENTROID-based analysis:
 * - 2 parallel rings → CN=2 (2 centroids)
 * - Evaluate against linear, bent geometries
 *
 * This correctly analyzes ferrocene as CN=2 instead of CN=10
 */
export function buildSandwichGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize, ring1Coords, ring2Coords, pointBasedCN } = pattern.metadata;

    console.log(`Building sandwich geometry for 2×η${ringSize} (point-based CN=${pointBasedCN}, centroid-based CN=${coordinationNumber})`);

    // Calculate centroids for each ring
    const centroid1 = calculateCentroid(ring1Coords);
    const centroid2 = calculateCentroid(ring2Coords);

    // Use centroid coordinates for analysis (CN=2)
    const centroidCoords = [centroid1, centroid2];

    console.log(`Using ${centroidCoords.length} ring centroids for analysis`);
    console.log(`  Ring 1 centroid: [${centroid1.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`  Ring 2 centroid: [${centroid2.map(v => v.toFixed(3)).join(', ')}]`);

    // Get all reference geometries for centroid-based CN
    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    const geometryNames = Object.keys(geometries);
    console.log(`Evaluating ${geometryNames.length} geometries for CN=${coordinationNumber}: ${geometryNames.join(', ')}`);

    // Calculate CShM for each geometry
    const results = [];
    for (const name of geometryNames) {
        const refCoords = geometries[name];

        const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
            centroidCoords,
            refCoords,
            mode,
            null
        );

        results.push({
            name,
            shapeMeasure: measure,
            alignedCoords,
            rotationMatrix,
            pattern: 'sandwich',
            usedCentroids: true,
            centroidCount: coordinationNumber,
            pointBasedCN: pointBasedCN
        });

        console.log(`  ${name}: CShM = ${measure.toFixed(4)}`);
    }

    // Sort by CShM
    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

    return results;
}

/**
 * Build geometry analysis for piano stool structures
 *
 * Half-sandwich + monodentate ligands use CENTROID-based analysis:
 * - 1 ring + N monodentate → CN = 1 + N (1 centroid + N atoms)
 * - Evaluate against appropriate geometries
 */
export function buildPianoStoolGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize, monodentateCount, ringCoords, monoCoords, pointBasedCN } = pattern.metadata;

    console.log(`Building piano stool geometry for η${ringSize} + ${monodentateCount} ligands (point-based CN=${pointBasedCN}, centroid-based CN=${coordinationNumber})`);

    // Calculate centroid for the ring
    const ringCentroid = calculateCentroid(ringCoords);

    // Combine ring centroid with monodentate coordinates
    const centroidCoords = [ringCentroid, ...monoCoords];

    console.log(`Using ${centroidCoords.length} coordinates (1 ring centroid + ${monoCoords.length} monodentate)`);
    console.log(`  Ring centroid: [${ringCentroid.map(v => v.toFixed(3)).join(', ')}]`);

    // Use general geometry analysis with centroid-based coordinates
    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    const geometryNames = Object.keys(geometries);
    console.log(`Evaluating ${geometryNames.length} geometries for CN=${coordinationNumber}`);

    const results = [];
    for (const name of geometryNames) {
        const refCoords = geometries[name];

        const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
            centroidCoords,
            refCoords,
            mode,
            null
        );

        results.push({
            name,
            shapeMeasure: measure,
            alignedCoords,
            rotationMatrix,
            pattern: 'piano_stool',
            usedCentroids: true,
            centroidCount: coordinationNumber,
            pointBasedCN: pointBasedCN
        });
    }

    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
    return results;
}

/**
 * Build geometry analysis for planar macrocycles
 *
 * Planar coordination (porphyrins, corrins) + optional axial ligands
 * - CN=4: Square planar
 * - CN=5: Square pyramidal
 * - CN=6: Octahedral (planar + 2 axial)
 */
export function buildMacrocycleGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize, axialCount } = pattern.metadata;

    console.log(`Building macrocycle geometry for CN=${coordinationNumber} (${ringSize} planar + ${axialCount} axial)`);

    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    // Filter to likely macrocycle geometries
    const macrocycleGeometries = Object.keys(geometries).filter(name => {
        const lower = name.toLowerCase();
        if (coordinationNumber === 4) return lower.includes('square') || lower.includes('sp-4');
        if (coordinationNumber === 5) return lower.includes('pyramid') || lower.includes('spy-5');
        if (coordinationNumber === 6) return lower.includes('octahed') || lower.includes('oc-6');
        return true;
    });

    if (macrocycleGeometries.length === 0) {
        return buildGeneralGeometry(actualCoords, coordinationNumber, mode);
    }

    console.log(`Evaluating ${macrocycleGeometries.length} macrocycle geometries: ${macrocycleGeometries.join(', ')}`);

    const results = [];
    for (const name of macrocycleGeometries) {
        const refCoords = geometries[name];

        const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
            actualCoords,
            refCoords,
            mode,
            null
        );

        results.push({
            name,
            shapeMeasure: measure,
            alignedCoords,
            rotationMatrix,
            pattern: 'macrocycle'
        });

        console.log(`  ${name}: CShM = ${measure.toFixed(4)}`);
    }

    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
    return results;
}

/**
 * Build general geometry analysis (fallback)
 *
 * Used when no specific pattern is detected
 * Evaluates all reference geometries for the CN
 */
export function buildGeneralGeometry(actualCoords, coordinationNumber, mode = 'intensive') {
    console.log(`Building general geometry for CN=${coordinationNumber}`);

    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    const geometryNames = Object.keys(geometries);
    console.log(`Evaluating ${geometryNames.length} geometries`);

    const results = [];
    for (const name of geometryNames) {
        const refCoords = geometries[name];

        const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
            actualCoords,
            refCoords,
            mode,
            null
        );

        results.push({
            name,
            shapeMeasure: measure,
            alignedCoords,
            rotationMatrix,
            pattern: 'general'
        });
    }

    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
    return results;
}

/**
 * Main entry point: build geometry based on detected pattern
 */
export function buildPatternGeometry(actualCoords, pattern, mode = 'intensive') {
    if (!pattern || !pattern.metadata) {
        throw new Error('Invalid pattern object');
    }

    switch (pattern.patternType) {
        case 'sandwich':
            return buildSandwichGeometry(actualCoords, pattern, mode);

        case 'piano_stool':
            return buildPianoStoolGeometry(actualCoords, pattern, mode);

        case 'macrocycle':
            return buildMacrocycleGeometry(actualCoords, pattern, mode);

        default:
            console.warn(`Unknown pattern type: ${pattern.patternType}, using general analysis`);
            return buildGeneralGeometry(actualCoords, pattern.metadata.coordinationNumber, mode);
    }
}

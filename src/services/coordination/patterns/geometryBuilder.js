/**
 * Geometry Builder for Pattern-Based Analysis
 *
 * Constructs ideal reference geometries based on detected patterns
 * and calculates CShM against actual coordinates.
 */

import { REFERENCE_GEOMETRIES } from '../../../constants/referenceGeometries';
import calculateShapeMeasure from '../../shapeAnalysis/shapeCalculator';

/**
 * Build geometry analysis for sandwich structures
 *
 * Sandwich structures (2 parallel rings) map to specific geometries:
 * - CN=10 (2×η⁵): PPR-10 (pentagonal prism), PAPR-10 (pentagonal antiprism)
 * - CN=12 (2×η⁶): Hexagonal prism/antiprism
 * - CN=14 (2×η⁷): Heptagonal prism/antiprism
 */
export function buildSandwichGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize } = pattern.metadata;

    console.log(`Building sandwich geometry for CN=${coordinationNumber} (2×η${ringSize})`);

    // Get all reference geometries for this CN
    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    // Filter to sandwich-like geometries (prisms, antiprisms)
    const sandwichGeometries = Object.keys(geometries).filter(name => {
        const lower = name.toLowerCase();
        return lower.includes('prism') ||
               lower.includes('antiprism') ||
               lower.includes('ppr') ||
               lower.includes('papr');
    });

    if (sandwichGeometries.length === 0) {
        console.warn(`No sandwich geometries found for CN=${coordinationNumber}, using all geometries`);
        return buildGeneralGeometry(actualCoords, coordinationNumber, mode);
    }

    console.log(`Evaluating ${sandwichGeometries.length} sandwich geometries: ${sandwichGeometries.join(', ')}`);

    // Calculate CShM for each sandwich geometry
    const results = [];
    for (const name of sandwichGeometries) {
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
            pattern: 'sandwich'
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
 * Half-sandwich + monodentate ligands
 * Maps to three-legged piano stool geometries
 */
export function buildPianoStoolGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize, monodentateCount } = pattern.metadata;

    console.log(`Building piano stool geometry for CN=${coordinationNumber} (η${ringSize} + ${monodentateCount} ligands)`);

    // For now, use all geometries for this CN
    // Could be refined to prefer specific geometries based on ring size
    return buildGeneralGeometry(actualCoords, coordinationNumber, mode);
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

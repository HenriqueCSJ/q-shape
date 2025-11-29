/**
 * Geometry Builder for Pattern-Based Analysis
 *
 * Constructs ideal reference geometries based on detected patterns
 * and calculates CShM against actual coordinates.
 */

import { REFERENCE_GEOMETRIES } from '../../../constants/referenceGeometries';
import { PATTERN_DETECTION } from '../../../constants/algorithmConstants';
import calculateShapeMeasure from '../../shapeAnalysis/shapeCalculator';

/**
 * Build geometry analysis for sandwich structures
 *
 * Sandwich structures (2 parallel rings) with centroid-based analysis:
 * - 2 ring centroids → CN=2 → L-2 (Linear) for perfect sandwich alignment
 *
 * For point-based analysis (not centroid), would be:
 * - CN=10 (2×η⁵): PPR-10 (pentagonal prism), PAPR-10 (pentagonal antiprism)
 * - CN=12 (2×η⁶): Hexagonal prism/antiprism
 */
export function buildSandwichGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize } = pattern.metadata;

    console.log(`Building sandwich geometry for CN=${coordinationNumber} (2×η${ringSize})`);

    // For centroid-based sandwich (2 ring centroids), use Linear geometry
    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    // For CN=2 (centroid-based), all geometries are sandwich-appropriate (L-2, vT-2, etc.)
    const sandwichGeometries = Object.keys(geometries);

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
            refCoords,  // ADD: Needed for polyhedron rendering
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
 *
 * Piano stool complexes (also called half-sandwich complexes) have a
 * characteristic structure:
 * - One hapto ligand (ring) at the "top" of the stool
 * - Multiple monodentate ligands forming the "legs" of the stool
 *
 * Examples:
 * - [CpMn(CO)₃]: η⁵-Cp + 3 CO → CN=4 → vTBPY-4 (vacant trigonal bipyramid)
 * - [CpFe(CO)₂I]: η⁵-Cp + 2 CO + I → CN=4 → vTBPY-4 or SS-4 (seesaw)
 * - [(η⁶-C₆H₆)Ru(en)Cl]⁺: η⁶-benzene + en + Cl → CN=5 → SPY-5 (square pyramidal)
 *
 * @param {Array<Array<number>>} actualCoords - Centered coordinates (ring centroid + ligands)
 * @param {Object} pattern - Pattern detection result with metadata
 * @param {string} mode - 'intensive' or 'default'
 * @returns {Array<Object>} Sorted geometry results with CShM values
 */
export function buildPianoStoolGeometry(actualCoords, pattern, mode = 'intensive') {
    const { coordinationNumber, ringSize, monodentateCount } = pattern.metadata;

    console.log(`Building piano stool geometry for CN=${coordinationNumber} (η${ringSize} + ${monodentateCount} ligands)`);

    const geometries = REFERENCE_GEOMETRIES[coordinationNumber];
    if (!geometries) {
        throw new Error(`No reference geometries for CN=${coordinationNumber}`);
    }

    // Get piano stool geometry mappings from constants
    const pianoStoolGeomNames = PATTERN_DETECTION.PIANO_STOOL_GEOMETRIES[coordinationNumber];

    if (!pianoStoolGeomNames || pianoStoolGeomNames.length === 0) {
        console.warn(`No piano stool geometries defined for CN=${coordinationNumber}, using all geometries`);
        return buildGeneralGeometry(actualCoords, coordinationNumber, mode);
    }

    // Filter to piano stool-appropriate geometries
    // Match geometry names case-insensitively and check for partial matches
    const pianoStoolGeometries = Object.keys(geometries).filter(name => {
        const nameLower = name.toLowerCase();
        return pianoStoolGeomNames.some(psName => {
            const psNameLower = psName.toLowerCase();
            // Match if the geometry name contains the piano stool geometry code
            // e.g., "vTBPY-4 (Vacant Trigonal Bipyramid)" matches "vTBPY-4"
            return nameLower.includes(psNameLower) || nameLower.startsWith(psNameLower);
        });
    });

    if (pianoStoolGeometries.length === 0) {
        console.warn(`No matching piano stool geometries found for CN=${coordinationNumber}, using all geometries`);
        console.warn(`  Expected one of: ${pianoStoolGeomNames.join(', ')}`);
        console.warn(`  Available geometries: ${Object.keys(geometries).join(', ')}`);
        return buildGeneralGeometry(actualCoords, coordinationNumber, mode);
    }

    console.log(`Evaluating ${pianoStoolGeometries.length} piano stool geometries: ${pianoStoolGeometries.join(', ')}`);

    // Calculate CShM for each piano stool geometry
    const results = [];
    for (const name of pianoStoolGeometries) {
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
            refCoords,
            alignedCoords,
            rotationMatrix,
            pattern: 'piano_stool'
        });

        console.log(`  ${name}: CShM = ${measure.toFixed(4)}`);
    }

    // Sort by CShM (best match first)
    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

    // Also evaluate all geometries for comparison (but sort piano stool matches first)
    if (mode === 'intensive') {
        console.log('Also evaluating all other geometries for comparison...');
        const otherGeometries = Object.keys(geometries).filter(
            name => !pianoStoolGeometries.includes(name)
        );

        for (const name of otherGeometries) {
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
                refCoords,
                alignedCoords,
                rotationMatrix,
                pattern: 'general'
            });
        }

        // Re-sort to get best overall match
        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
    }

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
            refCoords,  // ADD: Needed for polyhedron rendering
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
            refCoords,  // ADD: Needed for polyhedron rendering
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

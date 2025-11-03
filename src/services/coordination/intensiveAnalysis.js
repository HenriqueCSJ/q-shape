/**
 * Intensive Analysis Service
 *
 * Runs geometry detection with INTENSIVE CShM optimization (more steps, better results).
 * Also detects rings, ligand groups, and hapticity for coordination complexes.
 *
 * This provides TWO versions of CShM:
 * - Default: Fast, 18 grid steps, 6 restarts, 3000 optimization steps
 * - Intensive: Thorough, 30 grid steps, 12 restarts, 8000 optimization steps
 */

import { detectLigandGroups } from './ringDetector';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import calculateShapeMeasure from '../shapeAnalysis/shapeCalculator';

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
 * Extract and center coordinated atoms relative to metal
 */
function extractCoordinatedCoords(atoms, metalIndex, coordIndices) {
    const metal = atoms[metalIndex];
    return coordIndices.map(idx => [
        atoms[idx].x - metal.x,
        atoms[idx].y - metal.y,
        atoms[idx].z - metal.z
    ]);
}

/**
 * Run intensive analysis - calculates geometry with intensive CShM and detects rings
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} { geometryResults, ligandGroups, metadata }
 */
export async function runIntensiveAnalysisAsync(atoms, metalIndex, radius, onProgress = null) {
    const startTime = Date.now();

    console.log(`Starting intensive analysis with intensive CShM for ${atoms[metalIndex].element}...`);

    const reportProgress = (stage, progress, message) => {
        if (onProgress) {
            onProgress({ stage, progress, message });
        }
    };

    try {
        reportProgress('detecting', 0.1, 'Detecting coordination sphere...');

        const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);
        const CN = coordIndices.length;

        console.log(`Found ${CN} atoms in coordination sphere`);

        if (CN === 0) {
            throw new Error('No coordinated atoms found within radius');
        }

        reportProgress('rings', 0.2, 'Detecting rings and ligand groups...');

        const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);
        console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);

        reportProgress('geometry', 0.3, 'Calculating geometries with intensive CShM...');

        // Extract centered coordinates
        const actualCoords = extractCoordinatedCoords(atoms, metalIndex, coordIndices);

        // Get reference geometries for this CN
        const geometries = REFERENCE_GEOMETRIES[CN];
        if (!geometries) {
            throw new Error(`No reference geometries available for CN=${CN}`);
        }

        const geometryNames = Object.keys(geometries);
        console.log(`Running intensive CShM for ${geometryNames.length} geometries (CN=${CN})...`);

        const results = [];

        // Process geometries asynchronously to prevent UI freezing
        for (let i = 0; i < geometryNames.length; i++) {
            const shapeName = geometryNames[i];
            const refCoords = geometries[shapeName];

            reportProgress(
                'calculating',
                0.3 + (0.6 * i / geometryNames.length),
                `Calculating ${shapeName} (${i + 1}/${geometryNames.length})...`
            );

            console.log(`Running intensive CShM for ${shapeName}...`);

            // Allow UI to update by yielding to event loop
            await new Promise(resolve => setTimeout(resolve, 0));

            // *** KEY: Use 'intensive' mode for better optimization ***
            const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
                actualCoords,
                refCoords,
                'intensive',  // <-- INTENSIVE MODE: 30 grid steps, 12 restarts, 8000 steps/run
                null
            );

            results.push({
                name: shapeName,
                shapeMeasure: measure,
                alignedCoords,
                rotationMatrix
            });

            console.log(`  ${shapeName}: CShM = ${measure.toFixed(4)}`);
        }

        // Sort by CShM (best first)
        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

        reportProgress('complete', 1.0, 'Intensive analysis complete!');

        const elapsed = Date.now() - startTime;

        console.log(`Intensive analysis complete in ${elapsed / 1000}s. Best geometry: ${results[0].name} (CShM = ${results[0].shapeMeasure.toFixed(4)})`);

        return {
            geometryResults: results,
            ligandGroups,
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: CN,
                intensiveMode: true,
                geometryCount: results.length,
                bestGeometry: results[0].name,
                bestCShM: results[0].shapeMeasure,
                elapsedSeconds: elapsed / 1000,
                timestamp: Date.now()
            }
        };

    } catch (error) {
        console.error('Intensive analysis failed:', error);
        reportProgress('error', 0, `Error: ${error.message}`);

        return {
            geometryResults: [],
            ligandGroups: {
                rings: [],
                monodentate: [],
                totalGroups: 0,
                ringCount: 0,
                summary: 'Analysis failed',
                hasSandwichStructure: false,
                detectedHapticities: []
            },
            metadata: {
                metalElement: atoms[metalIndex]?.element || 'Unknown',
                metalIndex,
                radius,
                coordinationNumber: 0,
                intensiveMode: true,
                error: error.message,
                timestamp: Date.now()
            }
        };
    }
}

/**
 * Synchronous version (legacy compatibility)
 */
export function runIntensiveAnalysis(atoms, metalIndex, radius) {
    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);

    try {
        const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);

        return {
            ligandGroups,
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: coordIndices.length,
                intensiveMode: false,
                timestamp: Date.now()
            }
        };
    } catch (error) {
        return {
            ligandGroups: {
                rings: [],
                monodentate: coordIndices,
                totalGroups: 1,
                ringCount: 0,
                summary: `${coordIndices.length} ligand(s)`,
                hasSandwichStructure: false,
                detectedHapticities: []
            },
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: coordIndices.length,
                intensiveMode: false,
                error: error.message,
                timestamp: Date.now()
            }
        };
    }
}

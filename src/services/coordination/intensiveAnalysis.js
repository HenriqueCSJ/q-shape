/**
 * Enhanced Intensive Analysis Service
 *
 * Simple, reliable intensive analysis without complex property analysis
 * that was causing blank page crashes.
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
 * Run intensive analysis - simplified version without property analysis
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} { geometryResults, ligandGroups, metadata }
 */
export async function runIntensiveAnalysisAsync(atoms, metalIndex, radius, onProgress = null) {
    const startTime = Date.now();

    console.log(`Starting intensive analysis for ${atoms[metalIndex].element}...`);

    // Progress helper
    const reportProgress = (stage, progress, message) => {
        if (onProgress) {
            onProgress({ stage, progress, message });
        }
    };

    try {
        reportProgress('detecting', 0.05, 'Detecting coordination sphere...');

        // Step 1: Get coordinated atoms
        const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);
        const CN = coordIndices.length;

        console.log(`Found ${CN} atoms in coordination sphere`);

        if (CN === 0) {
            throw new Error('No coordinating atoms found within specified radius');
        }

        // Step 2: Prepare coordinates (centered at origin)
        const metal = atoms[metalIndex];
        const actualCoords = coordIndices.map(idx => {
            const atom = atoms[idx];
            return [
                atom.x - metal.x,
                atom.y - metal.y,
                atom.z - metal.z
            ];
        });

        reportProgress('rings', 0.15, 'Detecting rings and ligand groups...');

        // Step 3: Detect ligand groups (for metadata)
        const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);
        console.log(`Detected ${ligandGroups.ringCount} ring(s)`);

        // Step 4: Get reference geometries for this CN
        const geometries = REFERENCE_GEOMETRIES[CN];

        if (!geometries) {
            console.warn(`No reference geometries defined for CN=${CN}`);
            return {
                geometryResults: [],
                ligandGroups,
                metadata: {
                    metalElement: atoms[metalIndex].element,
                    metalIndex,
                    radius,
                    coordinationNumber: CN,
                    intensiveMode: true,
                    error: `No reference geometries for CN=${CN}`,
                    timestamp: Date.now()
                }
            };
        }

        const geometryNames = Object.keys(geometries);
        console.log(`Analyzing ${geometryNames.length} reference geometries for CN=${CN}`);

        reportProgress('calculating', 0.25, 'Starting CShM calculations...');

        // Step 5: Run CShM calculations for each geometry
        const results = [];

        for (let i = 0; i < geometryNames.length; i++) {
            const shapeName = geometryNames[i];
            const refCoords = geometries[shapeName];

            const progress = 0.25 + ((i / geometryNames.length) * 0.70);
            reportProgress('calculating', progress, `Calculating ${shapeName}... (${i + 1}/${geometryNames.length})`);

            try {
                const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
                    actualCoords,
                    refCoords,
                    'intensive',  // Use intensive mode for longer optimization
                    null
                );

                results.push({
                    name: shapeName,
                    shapeMeasure: measure,
                    alignedCoords,
                    rotationMatrix
                });

                // Small delay to prevent UI freeze
                await new Promise(resolve => setTimeout(resolve, 10));

            } catch (error) {
                console.warn(`Failed to calculate CShM for ${shapeName}:`, error.message);
                results.push({
                    name: shapeName,
                    shapeMeasure: Infinity,
                    error: error.message
                });
            }
        }

        // Sort by CShM (best first)
        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

        const elapsed = Date.now() - startTime;

        reportProgress('complete', 1.0, 'Analysis complete!');

        console.log(`Intensive analysis complete in ${(elapsed / 1000).toFixed(2)}s`);
        console.log(`Best result: ${results[0].name} = ${results[0].shapeMeasure.toFixed(4)}`);

        return {
            geometryResults: results,
            ligandGroups,
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: CN,
                intensiveMode: true,
                elapsedSeconds: elapsed / 1000,
                timestamp: Date.now()
            }
        };

    } catch (error) {
        console.error('Intensive analysis failed:', error);
        reportProgress('error', 0, `Error: ${error.message}`);

        // Return minimal valid structure to prevent crashes
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
    console.warn('runIntensiveAnalysis (sync) is deprecated - use runIntensiveAnalysisAsync instead');

    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);

    try {
        const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);

        return {
            geometryResults: [],
            ligandGroups,
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: coordIndices.length,
                intensiveMode: false,
                deprecationWarning: 'Use runIntensiveAnalysisAsync for full analysis',
                timestamp: Date.now()
            }
        };
    } catch (error) {
        return {
            geometryResults: [],
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

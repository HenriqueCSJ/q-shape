/**
 * Enhanced Intensive Analysis Service
 *
 * Provides chemically-intelligent coordination geometry analysis using:
 * 1. Property-based geometric analysis (PCA, symmetry, layers) - UNIVERSAL
 * 2. Smart alignment for better initial orientations
 * 3. Parallel Web Workers for smooth, non-blocking computation
 * 4. Ring detection for metadata (hapticity, ligand groups)
 *
 * Design principles:
 * - GENERAL: Works for ANY coordination complex (ferrocene, octahedral, etc.)
 * - NO hardcoding for specific compounds
 * - Smooth UI with comprehensive progress tracking
 * - Results compatible with standard analysis format
 */

import { detectLigandGroups } from './ringDetector';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import { analyzeGeometricProperties } from '../shapeAnalysis/propertyAnalysis';
import { generateSmartAlignments } from '../shapeAnalysis/smartAlignment';
import { getWorkerPool } from '../shapeAnalysis/workerPool';

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
 * Run intensive analysis with property-based optimization and parallel workers
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} { geometryResults, ligandGroups, properties, metadata }
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

    reportProgress('analyzing', 0.10, 'Analyzing geometric properties...');

    // Step 3: Analyze geometric properties (UNIVERSAL - works for any structure)
    let properties = null;
    try {
        properties = analyzeGeometricProperties(actualCoords);
        console.log(`Property analysis: ${properties.layers.length} layers, ${properties.symmetries.length} symmetries, ${properties.cycles.length} cycles`);
    } catch (error) {
        console.warn('Property analysis failed, continuing without it:', error);
        properties = { layers: [], symmetries: [], cycles: [], principalAxes: { axes: [], eigenvalues: [], anisotropy: 0 }, atomCount: CN };
    }

    reportProgress('rings', 0.15, 'Detecting rings and ligand groups...');

    // Step 4: Detect ligand groups (for metadata)
    let ligandGroups;
    try {
        ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);
        console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);
    } catch (error) {
        console.warn('Ligand detection failed, using fallback:', error);
        ligandGroups = {
            rings: [],
            monodentate: coordIndices,
            totalGroups: 1,
            ringCount: 0,
            summary: `${CN} monodentate ligand(s)`,
            hasSandwichStructure: false,
            detectedHapticities: []
        };
    }

    // Step 5: Get reference geometries for this CN
    const geometries = REFERENCE_GEOMETRIES[CN];

    if (!geometries) {
        console.warn(`No reference geometries defined for CN=${CN}`);
        return {
            geometryResults: [],
            ligandGroups,
            properties,
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

    reportProgress('aligning', 0.20, 'Preparing analysis...');

    // Step 6: Prepare tasks for worker pool
    const tasks = [];

    for (const shapeName of geometryNames) {
        const refCoords = geometries[shapeName];

        // Generate smart alignments for this specific geometry (optional - skip if it fails)
        let smartAlignments = [];
        try {
            smartAlignments = generateSmartAlignments(actualCoords, refCoords);
            console.log(`Generated ${smartAlignments.length} smart alignments for ${shapeName}`);
        } catch (error) {
            console.warn(`Smart alignment failed for ${shapeName}, using default:`, error);
        }

        tasks.push({
            shapeName,
            actualCoords,
            referenceCoords: refCoords,
            mode: 'intensive',
            smartAlignments: smartAlignments.map(R => ({ elements: R.elements }))
        });
    }

    reportProgress('calculating', 0.25, 'Starting CShM calculations...');

    // Step 7: Try to initialize worker pool, but always fall back if it fails
    // NOTE: Workers are currently disabled due to initialization issues
    // TODO: Re-enable workers once path resolution is fixed
    const useWorkers = false; // Set to true to enable workers

    if (useWorkers) {
        const workerPool = getWorkerPool();

        try {
            await workerPool.initialize();

            console.log(`Worker pool initialized with ${workerPool.workers.length} workers`);

        } catch (error) {
            console.error('Failed to initialize worker pool:', error);
            console.log('Falling back to single-threaded calculation...');

            // Fallback: run sequentially without workers
            return runIntensiveAnalysisFallback(atoms, metalIndex, coordIndices, actualCoords, geometries, ligandGroups, properties, reportProgress);
        }

        // Run parallel calculations
        return new Promise((resolve, reject) => {
        const workerProgress = (progressData) => {
            // Map worker progress to overall progress (0.25 to 0.95)
            const workerProgressFraction = progressData.overallProgress;
            const overallProgress = 0.25 + (workerProgressFraction * 0.70);

            const message = `Processing geometries... ${progressData.completedCount}/${progressData.totalCount} complete`;

            reportProgress('calculating', overallProgress, message);

            // Also report detailed worker progress
            if (onProgress) {
                onProgress({
                    stage: 'calculating',
                    progress: overallProgress,
                    message,
                    workerDetails: progressData
                });
            }
        };

        const workerComplete = (completionData) => {
            reportProgress('finalizing', 0.95, 'Finalizing results...');

            const geometryResults = completionData.results.map(r => ({
                name: r.name,
                shapeMeasure: r.shapeMeasure,
                alignedCoords: r.alignedCoords,
                rotationMatrix: r.rotationMatrix
            }));

            const elapsed = Date.now() - startTime;

            console.log(`Intensive analysis complete in ${(elapsed / 1000).toFixed(2)}s`);
            console.log(`Best result: ${geometryResults[0].name} = ${geometryResults[0].shapeMeasure.toFixed(4)}`);

            reportProgress('complete', 1.0, 'Analysis complete!');

            resolve({
                geometryResults,
                ligandGroups,
                properties,
                metadata: {
                    metalElement: atoms[metalIndex].element,
                    metalIndex,
                    radius,
                    coordinationNumber: CN,
                    intensiveMode: true,
                    workerCount: completionData.workerCount,
                    elapsedSeconds: elapsed / 1000,
                    timestamp: Date.now()
                }
            });
        };

        workerPool.calculateBatch(tasks, workerProgress, workerComplete);
        });
    } else {
        // Workers disabled - use fallback mode
        console.log('Workers disabled, using single-threaded calculation...');
        return runIntensiveAnalysisFallback(atoms, metalIndex, coordIndices, actualCoords, geometries, ligandGroups, properties, reportProgress);
    }
}

/**
 * Fallback: Single-threaded intensive analysis (if workers fail)
 * Uses the existing calculateShapeMeasure from shapeCalculator
 */
async function runIntensiveAnalysisFallback(atoms, metalIndex, coordIndices, actualCoords, geometries, ligandGroups, properties, reportProgress) {
    // Import dynamically to avoid circular dependency
    const calculateShapeMeasure = (await import('../shapeAnalysis/shapeCalculator')).default;

    const geometryNames = Object.keys(geometries);
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
                'intensive',
                null  // No progress callback for individual shapes
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

    // Sort by CShM
    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

    reportProgress('complete', 1.0, 'Analysis complete!');

    return {
        geometryResults: results,
        ligandGroups,
        properties,
        metadata: {
            metalElement: atoms[metalIndex].element,
            metalIndex,
            radius: 3.0,
            coordinationNumber: coordIndices.length,
            intensiveMode: true,
            fallbackMode: true,
            timestamp: Date.now()
        }
    };
}

/**
 * Synchronous version (legacy compatibility)
 * Note: This will still block the UI - use Async version instead!
 */
export function runIntensiveAnalysis(atoms, metalIndex, radius) {
    console.warn('runIntensiveAnalysis (sync) is deprecated - use runIntensiveAnalysisAsync instead');

    // Just detect ligands and return basic metadata
    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);
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
}

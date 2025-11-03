/**
 * Enhanced Intensive Analysis Service
 *
 * Provides chemically-intelligent coordination geometry analysis using:
 * 1. Property-based geometric analysis (PCA, symmetry, layers) - UNIVERSAL
 * 2. Smart alignment for better initial orientations
 * 3. Ring detection for metadata (hapticity, ligand groups)
 *
 * Design principles:
 * - GENERAL: Works for ANY coordination complex (ferrocene, octahedral, etc.)
 * - NO hardcoding for specific compounds
 * - Uses geometric properties to guide optimization
 */

import * as THREE from 'three';
import { detectLigandGroups } from './ringDetector';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import calculateShapeMeasure from '../shapeAnalysis/shapeCalculator';
import { analyzeGeometricProperties } from '../shapeAnalysis/propertyAnalysis';
import { generateSmartAlignments } from '../shapeAnalysis/smartAlignment';

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

        reportProgress('analyzing', 0.10, 'Analyzing geometric properties...');

        // Step 3: Analyze geometric properties (UNIVERSAL - works for any structure)
        let properties = null;
        try {
            properties = analyzeGeometricProperties(actualCoords);
            console.log(`Property analysis: ${properties.layers.length} layers, ${properties.symmetries.length} symmetries, ${properties.cycles.length} cycles`);
        } catch (error) {
            console.warn('Property analysis failed:', error);
            properties = { layers: [], symmetries: [], cycles: [], principalAxes: { axes: [], eigenvalues: [], anisotropy: 0 }, atomCount: CN };
        }

        reportProgress('rings', 0.15, 'Detecting rings and ligand groups...');

        // Step 4: Detect ligand groups (for metadata)
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

        reportProgress('calculating', 0.25, 'Starting CShM calculations with smart alignment...');

        // Step 5: Run CShM calculations for each geometry with smart alignments
        const results = [];

        for (let i = 0; i < geometryNames.length; i++) {
            const shapeName = geometryNames[i];
            const refCoords = geometries[shapeName];

            const progress = 0.25 + ((i / geometryNames.length) * 0.70);
            reportProgress('calculating', progress, `Calculating ${shapeName}... (${i + 1}/${geometryNames.length})`);

            try {
                // Generate smart alignments for this geometry
                let smartAlignments = [];
                try {
                    smartAlignments = generateSmartAlignments(actualCoords, refCoords);
                    console.log(`Generated ${smartAlignments.length} smart alignments for ${shapeName}`);
                } catch (error) {
                    console.warn(`Smart alignment failed for ${shapeName}:`, error);
                }

                // Try each smart alignment and keep the best result
                let bestMeasure = Infinity;
                let bestAligned = null;
                let bestRotation = null;

                // First try without smart alignment (baseline)
                const baselineResult = calculateShapeMeasure(
                    actualCoords,
                    refCoords,
                    'intensive',
                    null
                );

                bestMeasure = baselineResult.measure;
                bestAligned = baselineResult.alignedCoords;
                bestRotation = baselineResult.rotationMatrix;

                // Then try with each smart alignment if available
                if (smartAlignments.length > 0) {
                    // Try up to 3 best smart alignments to save time
                    const alignmentsToTry = smartAlignments.slice(0, 3);

                    for (const alignment of alignmentsToTry) {
                        // Pre-rotate the coordinates using the smart alignment
                        const preRotatedCoords = actualCoords.map(coord => {
                            const v = new THREE.Vector3(...coord);
                            v.applyMatrix4(alignment);
                            return [v.x, v.y, v.z];
                        });

                        const result = calculateShapeMeasure(
                            preRotatedCoords,
                            refCoords,
                            'intensive',
                            null
                        );

                        if (result.measure < bestMeasure) {
                            bestMeasure = result.measure;
                            bestAligned = result.alignedCoords;
                            bestRotation = result.rotationMatrix;
                            console.log(`Smart alignment improved ${shapeName}: ${bestMeasure.toFixed(4)}`);
                        }
                    }
                }

                const { measure, alignedCoords, rotationMatrix } = {
                    measure: bestMeasure,
                    alignedCoords: bestAligned,
                    rotationMatrix: bestRotation
                };

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
            properties,
            metadata: {
                metalElement: atoms[metalIndex].element,
                metalIndex,
                radius,
                coordinationNumber: CN,
                intensiveMode: true,
                elapsedSeconds: elapsed / 1000,
                propertyAnalysisUsed: properties !== null,
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

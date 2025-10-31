/**
 * Enhanced Intensive Analysis Service
 *
 * Provides chemically-intelligent coordination geometry analysis by:
 * 1. Detecting π-coordinated ligands (rings, hapticity) as metadata
 * 2. Running enhanced CShM analysis on ALL coordinating atoms (maintains correct CN)
 * 3. Returns results in standard format plus ligand metadata
 *
 * For ferrocene: Detects 2 η⁵-Cp rings as metadata, but analyzes all 10 C atoms
 * to correctly identify PAPR-10 or PPR-10 geometry.
 */

import { detectLigandGroups } from './ringDetector';
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
 * Run intensive analysis with ring detection and improved CShM calculation
 * Returns geometry results in same format as standard analysis, plus metadata
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @returns {Object} { geometryResults, ligandGroups, metadata }
 */
export function runIntensiveAnalysis(atoms, metalIndex, radius) {
    console.log(`Starting intensive analysis for ${atoms[metalIndex].element}...`);

    // Step 1: Get coordinated atoms
    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);

    console.log(`Found ${coordIndices.length} atoms in coordination sphere`);

    // Step 2: Detect ligand groups (rings and monodentate) - for metadata only
    const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);

    console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);

    // Step 3: Run enhanced CShM analysis on all coordinating atoms
    // This maintains the correct CN (e.g., CN=10 for ferrocene)
    const geometryResults = analyzeGeometry(atoms, metalIndex, coordIndices);

    return {
        geometryResults,  // Results in standard format (array of {name, shapeMeasure})
        ligandGroups,     // Metadata about ring detection
        metadata: {
            metalElement: atoms[metalIndex].element,
            metalIndex,
            radius,
            coordinationNumber: coordIndices.length,
            intensiveMode: true,
            timestamp: Date.now()
        }
    };
}

/**
 * Perform enhanced geometry analysis with intensive mode
 * Returns results in standard format compatible with useShapeAnalysis
 */
function analyzeGeometry(atoms, metalIndex, coordIndices) {
    const CN = coordIndices.length;
    const metal = atoms[metalIndex];

    // Get all possible shapes for this CN
    const geometries = REFERENCE_GEOMETRIES[CN];

    if (!geometries) {
        console.warn(`No reference geometries defined for CN=${CN}`);
        return [];
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

    // Calculate CShM for each shape using intensive mode
    const results = [];
    const geometryNames = Object.keys(geometries);

    for (const name of geometryNames) {
        const refCoords = geometries[name];

        try {
            const { measure } = calculateShapeMeasure(actualCoords, refCoords, 'intensive');

            results.push({
                name,              // Standard format expects 'name' not 'shapeName'
                shapeMeasure: measure  // Standard format expects 'shapeMeasure' not 'cshm'
            });
        } catch (error) {
            console.warn(`Failed to calculate CShM for ${name}:`, error.message);
        }
    }

    // Sort by CShM (best first)
    results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

    return results;
}

/**
 * Async wrapper for intensive analysis that yields to UI thread
 * Prevents browser freeze during heavy computation
 *
 * @param {Array} atoms - All atoms in structure
 * @param {number} metalIndex - Index of central metal atom
 * @param {number} radius - Coordination sphere radius (Å)
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} Comprehensive analysis results
 */
export async function runIntensiveAnalysisAsync(atoms, metalIndex, radius, onProgress = null) {
    // Yield to UI thread before starting
    await new Promise(resolve => setTimeout(resolve, 10));

    if (onProgress) onProgress({ stage: 'detecting', progress: 0.2, message: 'Detecting coordination sphere...' });

    // Step 1: Get coordinated atoms
    const coordIndices = getCoordinatedAtoms(atoms, metalIndex, radius);

    console.log(`Found ${coordIndices.length} atoms in coordination sphere`);

    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 10));
    if (onProgress) onProgress({ stage: 'rings', progress: 0.4, message: 'Detecting rings and ligand groups...' });

    // Step 2: Detect ligand groups
    const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);

    console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);

    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 10));
    if (onProgress) onProgress({ stage: 'analysis', progress: 0.6, message: 'Running enhanced CShM analysis...' });

    // Step 3: Run geometry analysis
    const geometryResults = analyzeGeometry(atoms, metalIndex, coordIndices);

    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 10));
    if (onProgress) onProgress({ stage: 'complete', progress: 1.0, message: 'Analysis complete!' });

    return {
        geometryResults,
        ligandGroups,
        metadata: {
            metalElement: atoms[metalIndex].element,
            metalIndex,
            radius,
            coordinationNumber: coordIndices.length,
            intensiveMode: true,
            timestamp: Date.now()
        }
    };
}

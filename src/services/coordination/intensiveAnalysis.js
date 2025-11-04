/**
 * Intensive Analysis Service
 *
 * Pattern-based geometry detection using chemical knowledge:
 * 1. Detects structural patterns (sandwich, piano stool, macrocycle, etc.)
 * 2. Applies pattern-specific geometry analysis
 * 3. Uses intensive CShM optimization for better results
 *
 * This provides TWO approaches:
 * - Default: Pure CShM (matches other software)
 * - Intensive: Pattern-aware analysis using structural information
 */

import { detectLigandGroups } from './ringDetector';
import { detectPattern } from './patterns/patternDetector';
import { buildPatternGeometry, buildGeneralGeometry } from './patterns/geometryBuilder';

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

        // Extract centered coordinates
        const actualCoords = extractCoordinatedCoords(atoms, metalIndex, coordIndices);

        reportProgress('pattern', 0.3, 'Analyzing structural patterns...');

        // *** PATTERN DETECTION: Use chemical knowledge to identify structure type ***
        const pattern = detectPattern(atoms, metalIndex, ligandGroups);

        let results = [];

        if (pattern && pattern.confidence > 0.7) {
            // High-confidence pattern detected - use pattern-based analysis
            console.log(`✓ Pattern detected: ${pattern.patternType} (${(pattern.confidence * 100).toFixed(1)}% confidence)`);

            reportProgress('geometry', 0.4, `Analyzing ${pattern.patternType} structure...`);

            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 0));

            // Build geometry using pattern-specific logic
            results = buildPatternGeometry(actualCoords, pattern, 'intensive');

        } else {
            // No pattern or low confidence - fall back to general analysis
            console.log('No high-confidence pattern, using general CShM analysis');

            reportProgress('geometry', 0.4, 'Calculating geometries with intensive CShM...');

            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 0));

            results = buildGeneralGeometry(actualCoords, CN, 'intensive');
        }

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
                patternDetected: pattern?.patternType || null,
                patternConfidence: pattern?.confidence || 0,
                geometryCount: results.length,
                bestGeometry: results[0].name,
                bestCShM: results[0].shapeMeasure,
                elapsedSeconds: elapsed / 1000,
                timestamp: Date.now()
            }
        };

    } catch (error) {
        console.error('=== INTENSIVE ANALYSIS FAILED ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        reportProgress('error', 0, `Error: ${error.message}`);

        // Alert the user with detailed error info
        alert(`Intensive Analysis Failed!\n\nError: ${error.message}\n\nStack: ${error.stack}\n\nCheck console (F12) for details.`);

        return {
            geometryResults: [],
            ligandGroups: {
                rings: [],
                monodentate: [],
                totalGroups: 0,
                ringCount: 0,
                summary: `Analysis failed: ${error.message}`,
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
                errorStack: error.stack,
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

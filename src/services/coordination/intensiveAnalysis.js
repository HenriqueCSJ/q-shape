/**
 * Intensive Analysis Service
 *
 * Ab initio geometry analysis using intensive CShM optimization:
 * 1. Identifies all coordinating atoms within radius
 * 2. Evaluates ALL reference geometries for that coordination number
 * 3. Uses intensive CShM optimization for accurate results
 *
 * This is a purely ab initio approach - no pattern matching, no geometry filtering,
 * no special cases. All atoms are treated equally and the best geometry is found
 * through comprehensive CShM evaluation.
 */

import { detectLigandGroups } from './ringDetector';
import { buildGeneralGeometry } from './patterns/geometryBuilder';

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

        reportProgress('rings', 0.2, 'Detecting ligand groups (for info only)...');

        // Detect ligand groups for informational purposes only
        // This doesn't affect the ab initio CShM calculation
        const ligandGroups = detectLigandGroups(atoms, metalIndex, coordIndices);
        console.log(`Detected ${ligandGroups.ringCount} ring(s) and ${ligandGroups.monodentate.length} monodentate ligand(s)`);

        reportProgress('geometry', 0.3, 'Starting ab initio CShM analysis...');

        // Extract centered coordinates - use ALL coordinating atoms
        const actualCoords = extractCoordinatedCoords(atoms, metalIndex, coordIndices);

        console.log(`Running ab initio analysis: evaluating ALL geometries for CN=${CN}`);

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));

        // *** AB INITIO APPROACH ***
        // Evaluate ALL reference geometries for this CN
        // No pattern detection, no geometry filtering, no special cases
        const results = buildGeneralGeometry(
            actualCoords,
            CN,
            'intensive',
            (progress) => {
                // Forward CShM calculation progress to UI
                reportProgress('geometry', 0.3 + (progress * 0.6), `Evaluating geometries... ${Math.round(progress * 100)}%`);
            }
        );

        reportProgress('complete', 1.0, 'Analysis complete!');

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
                abInitio: true, // Pure ab initio - no pattern matching
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

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
import { getCoordinatingAtoms } from './sphereDetector';
import { REFERENCE_GEOMETRIES } from '../../constants/referenceGeometries';
import { formatShapeMeasure } from '../../utils/geometry';
import {
    isShapeResultAvailable,
    isShapeResultRecord,
    prepareGeometryResults
} from '../../utils/shapeResults';

/**
 * Get coordinated atom indices within specified radius of metal center
 */
function getCoordinatedAtoms(atoms, metalIndex, radius) {
    return getCoordinatingAtoms(atoms, metalIndex, radius).map(item => item.idx);
}

export function validateIntensiveGeometryResults(results, coordinationNumber) {
    if (!Array.isArray(results) || results.length === 0) {
        throw new Error('Intensive analysis returned no geometry results');
    }
    const expectedNames = Object.keys(REFERENCE_GEOMETRIES[coordinationNumber] || {});
    if (expectedNames.length === 0) {
        throw new Error(`No reference geometries available for coordination number ${coordinationNumber}`);
    }
    if (results.length !== expectedNames.length) {
        throw new Error(
            `Intensive analysis returned ${results.length} geometries; expected ${expectedNames.length}`
        );
    }
    const observedNames = new Set();
    for (const [index, result] of results.entries()) {
        if (!result || typeof result.name !== 'string' || result.name.length === 0) {
            throw new Error(`Invalid intensive geometry result at index ${index}`);
        }
        if (observedNames.has(result.name)) {
            throw new Error(`Duplicate intensive geometry result: ${result.name}`);
        }
        observedNames.add(result.name);
    }
    const missing = expectedNames.filter(name => !observedNames.has(name));
    const extra = [...observedNames].filter(name => !expectedNames.includes(name));
    if (missing.length > 0 || extra.length > 0) {
        throw new Error(
            `Intensive geometry set mismatch; missing=[${missing.join(',')}], extra=[${extra.join(',')}]`
        );
    }
    const prepared = prepareGeometryResults(results);
    const malformedIndex = prepared.findIndex(result => !isShapeResultRecord(result));
    if (malformedIndex >= 0) {
        throw new Error(`Invalid intensive geometry result at index ${malformedIndex}`);
    }
    return prepared;
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

    const reportProgress = (stage, progress, message) => {
        if (onProgress) {
            onProgress({ stage, progress, message });
        }
    };

    try {
        if (!Array.isArray(atoms) || !atoms[metalIndex]) {
            throw new Error('Invalid atoms or metal index for intensive analysis');
        }
        console.log(`Starting intensive analysis with intensive CShM for ${atoms[metalIndex].element}...`);
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
        const results = validateIntensiveGeometryResults(await buildGeneralGeometry(
            actualCoords,
            CN,
            'intensive',
            (progress) => {
                // Forward CShM calculation progress to UI
                reportProgress('geometry', 0.3 + (progress * 0.6), `Evaluating geometries... ${Math.round(progress * 100)}%`);
            }
        ), CN);

        reportProgress('complete', 1.0, 'Analysis complete!');

        const elapsed = Date.now() - startTime;
        const availableResults = results.filter(isShapeResultAvailable);
        const bestResult = availableResults[0] || null;

        if (bestResult) {
            console.log(`Intensive analysis complete in ${elapsed / 1000}s. Best geometry: ${bestResult.name} (CShM = ${formatShapeMeasure(bestResult.shapeMeasure)})`);
        } else {
            console.warn(`Intensive analysis completed in ${elapsed / 1000}s with no available CShM result`);
        }

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
                bestGeometry: bestResult?.name || null,
                bestCShM: bestResult?.shapeMeasure ?? null,
                availableGeometryCount: availableResults.length,
                unavailableGeometryCount: results.length - availableResults.length,
                analysisComplete: availableResults.length === results.length,
                elapsedSeconds: elapsed / 1000,
                timestamp: Date.now()
            }
        };

    } catch (error) {
        console.error('Intensive analysis failed:', error);
        reportProgress('error', 0, `Error: ${error.message}`);

        throw error;
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

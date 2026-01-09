/**
 * useBatchAnalysis Hook
 *
 * Manages batch analysis of multiple structures.
 * Analyzes all loaded structures and stores results for each.
 *
 * @returns {Object} Batch analysis state and handlers
 */

import { useState, useCallback } from 'react';
import { detectMetalCenter } from '../services/coordination/metalDetector';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';
import { calculateShapeMeasures } from '../services/shapeAnalysis/shapeCalculator';
import { REFERENCE_GEOMETRIES } from '../constants/referenceGeometries';

/**
 * Get coordination atoms within radius of metal center
 */
function getCoordinationAtoms(atoms, metalIndex, radius) {
    if (!atoms || metalIndex == null || !atoms[metalIndex]) return [];

    const metal = atoms[metalIndex];
    const coordAtoms = [];

    atoms.forEach((atom, i) => {
        if (i === metalIndex) return;

        const dx = atom.x - metal.x;
        const dy = atom.y - metal.y;
        const dz = atom.z - metal.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance <= radius) {
            coordAtoms.push({ atom, index: i, distance });
        }
    });

    // Sort by distance
    coordAtoms.sort((a, b) => a.distance - b.distance);
    return coordAtoms;
}

/**
 * Analyze a single structure
 */
async function analyzeStructure(structure, onProgress) {
    const { atoms, name } = structure;

    // Detect metal center
    const metalIndex = detectMetalCenter(atoms);
    if (metalIndex == null) {
        return {
            structureName: name,
            error: 'No metal center detected',
            metalIndex: null,
            metalElement: null,
            coordinationNumber: 0,
            bestGeometry: null,
            bestCShM: null,
            geometryResults: []
        };
    }

    const metal = atoms[metalIndex];

    // Detect optimal radius
    const radius = detectOptimalRadius(metal, atoms);

    // Get coordination atoms
    const coordAtoms = getCoordinationAtoms(atoms, metalIndex, radius);
    const cn = coordAtoms.length;

    if (cn < 2) {
        return {
            structureName: name,
            error: `Insufficient coordination number (CN=${cn})`,
            metalIndex,
            metalElement: metal.element,
            coordinationNumber: cn,
            radius,
            bestGeometry: null,
            bestCShM: null,
            geometryResults: []
        };
    }

    // Get reference geometries for this CN
    const refGeometries = REFERENCE_GEOMETRIES[cn];
    if (!refGeometries || Object.keys(refGeometries).length === 0) {
        return {
            structureName: name,
            error: `No reference geometries for CN=${cn}`,
            metalIndex,
            metalElement: metal.element,
            coordinationNumber: cn,
            radius,
            bestGeometry: null,
            bestCShM: null,
            geometryResults: []
        };
    }

    // Calculate shape measures
    if (onProgress) {
        onProgress({ stage: 'analyzing', structure: name });
    }

    const geometryResults = await calculateShapeMeasures(coordAtoms, refGeometries);

    // Sort by shape measure (best first)
    geometryResults.sort((a, b) => a.shapeMeasure - b.shapeMeasure);

    const best = geometryResults[0];

    return {
        structureName: name,
        metalIndex,
        metalElement: metal.element,
        coordinationNumber: cn,
        radius,
        coordAtoms,
        bestGeometry: best?.name || null,
        bestCShM: best?.shapeMeasure ?? null,
        geometryResults,
        atoms
    };
}

export function useBatchAnalysis() {
    const [batchResults, setBatchResults] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);

    /**
     * Run batch analysis on all structures
     */
    const runBatchAnalysis = useCallback(async (structures) => {
        if (!structures || structures.length === 0) {
            setError('No structures to analyze');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setBatchResults([]);

        const results = [];
        const total = structures.length;

        try {
            for (let i = 0; i < structures.length; i++) {
                const structure = structures[i];

                setProgress({
                    current: i + 1,
                    total,
                    structureName: structure.name,
                    percentage: Math.round(((i + 1) / total) * 100)
                });

                const result = await analyzeStructure(structure, (p) => {
                    setProgress(prev => ({ ...prev, ...p }));
                });

                results.push(result);
            }

            setBatchResults(results);
            setProgress(null);

        } catch (err) {
            console.error('Batch analysis failed:', err);
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    /**
     * Clear batch results
     */
    const clearResults = useCallback(() => {
        setBatchResults([]);
        setError(null);
        setProgress(null);
    }, []);

    return {
        batchResults,
        isAnalyzing,
        progress,
        error,
        runBatchAnalysis,
        clearResults
    };
}

export default useBatchAnalysis;

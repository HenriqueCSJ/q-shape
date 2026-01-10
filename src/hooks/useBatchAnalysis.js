/**
 * useBatchAnalysis Hook - v1.5.0
 *
 * Manages batch analysis state and orchestrates analysis across multiple structures.
 * This is the SINGLE orchestrator for batch processing - no parallel pipelines.
 *
 * Features:
 * - Stores results per structure (Map<structureId, BatchAnalysisResult>)
 * - Progress tracking for batch operations
 * - Support for both default and intensive analysis modes
 * - State reset on new file upload
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { runIntensiveAnalysisAsync } from '../services/coordination/intensiveAnalysis';
import { detectMetalCenter } from '../services/coordination/metalDetector';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';

/**
 * @typedef {Object} StructureOverride
 * @property {number} [metalIndex] - Override metal center
 * @property {number} [radius] - Override coordination radius
 */

export function useBatchAnalysis({ structures, onWarning, onError }) {
    // Results storage: Map<structureIndex, results>
    const [batchResults, setBatchResults] = useState(new Map());

    // Override storage: Map<structureIndex, StructureOverride>
    const [structureOverrides, setStructureOverrides] = useState(new Map());

    // Batch operation state
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState(null);

    // Cancellation support
    const cancelRef = useRef(false);

    // Reset batch results when structures change (new file upload)
    useEffect(() => {
        setBatchResults(new Map());
        setStructureOverrides(new Map());
        setBatchProgress(null);
        setIsBatchRunning(false);
        cancelRef.current = false;
    }, [structures]);

    /**
     * Get effective metal index for a structure (with override support)
     */
    const getMetalIndex = useCallback((structureIndex) => {
        const override = structureOverrides.get(structureIndex);
        if (override && override.metalIndex !== undefined) {
            return override.metalIndex;
        }

        // Auto-detect
        if (structures[structureIndex]) {
            return detectMetalCenter(structures[structureIndex].atoms);
        }
        return null;
    }, [structures, structureOverrides]);

    /**
     * Get effective radius for a structure (with override support)
     */
    const getRadius = useCallback((structureIndex) => {
        const override = structureOverrides.get(structureIndex);
        if (override && override.radius !== undefined) {
            return override.radius;
        }

        // Auto-detect
        if (structures[structureIndex]) {
            const atoms = structures[structureIndex].atoms;
            const metalIdx = getMetalIndex(structureIndex);
            if (metalIdx !== null && atoms[metalIdx]) {
                return detectOptimalRadius(atoms[metalIdx], atoms);
            }
        }
        return 3.0; // default
    }, [structures, structureOverrides, getMetalIndex]);

    /**
     * Set override for a structure
     */
    const setStructureOverride = useCallback((structureIndex, override) => {
        setStructureOverrides(prev => {
            const next = new Map(prev);
            const existing = next.get(structureIndex) || {};
            next.set(structureIndex, { ...existing, ...override });
            return next;
        });

        // Clear results for this structure since parameters changed
        setBatchResults(prev => {
            const next = new Map(prev);
            next.delete(structureIndex);
            return next;
        });
    }, []);

    /**
     * Apply override to all structures
     */
    const applyOverrideToAll = useCallback((override) => {
        const newOverrides = new Map();
        structures.forEach((_, index) => {
            const existing = structureOverrides.get(index) || {};
            newOverrides.set(index, { ...existing, ...override });
        });
        setStructureOverrides(newOverrides);

        // Clear all results
        setBatchResults(new Map());
    }, [structures, structureOverrides]);

    /**
     * Store analysis result for a structure
     */
    const setStructureResult = useCallback((structureIndex, result) => {
        setBatchResults(prev => {
            const next = new Map(prev);
            next.set(structureIndex, {
                ...result,
                structureId: structures[structureIndex]?.id || `structure-${structureIndex}`,
                timestamp: Date.now()
            });
            return next;
        });
    }, [structures]);

    /**
     * Get result for a structure
     */
    const getStructureResult = useCallback((structureIndex) => {
        return batchResults.get(structureIndex) || null;
    }, [batchResults]);

    /**
     * Run intensive analysis for a single structure
     */
    const analyzeStructure = useCallback(async (structureIndex, onProgress) => {
        if (!structures[structureIndex]) {
            throw new Error(`Structure ${structureIndex} not found`);
        }

        const atoms = structures[structureIndex].atoms;
        const metalIndex = getMetalIndex(structureIndex);
        const radius = getRadius(structureIndex);

        if (metalIndex === null) {
            throw new Error(`No metal center detected for structure ${structureIndex}`);
        }

        const result = await runIntensiveAnalysisAsync(
            atoms,
            metalIndex,
            radius,
            onProgress
        );

        // Store result
        setStructureResult(structureIndex, {
            geometryResults: result.geometryResults,
            bestGeometry: result.geometryResults[0] || null,
            ligandGroups: result.ligandGroups,
            metadata: result.metadata,
            metalIndex,
            radius,
            coordinationNumber: result.geometryResults[0]?.coordAtoms?.length ||
                               result.metadata?.coordinationNumber || 0,
            analysisMode: 'intensive'
        });

        return result;
    }, [structures, getMetalIndex, getRadius, setStructureResult]);

    /**
     * Run batch analysis for all structures
     */
    const analyzeAllStructures = useCallback(async () => {

        if (structures.length === 0) {
            onWarning?.('No structures to analyze');
            return;
        }

        setIsBatchRunning(true);
        cancelRef.current = false;

        const totalStructures = structures.length;
        const results = [];

        try {
            for (let i = 0; i < totalStructures; i++) {
                // Check for cancellation
                if (cancelRef.current) {
                    setBatchProgress({
                        stage: 'cancelled',
                        currentStructure: i,
                        totalStructures,
                        structureId: structures[i]?.id,
                        progress: (i / totalStructures) * 100,
                        message: `Cancelled after ${i} structures`
                    });
                    break;
                }

                const structureId = structures[i]?.id || `structure-${i}`;

                setBatchProgress({
                    stage: 'analyzing',
                    currentStructure: i + 1,
                    totalStructures,
                    structureId,
                    progress: (i / totalStructures) * 100,
                    message: `Analyzing structure ${i + 1}/${totalStructures}: ${structureId}`
                });

                try {
                    const result = await analyzeStructure(i, (progress) => {
                        setBatchProgress({
                            stage: 'analyzing',
                            currentStructure: i + 1,
                            totalStructures,
                            structureId,
                            progress: ((i + (progress.progress / 100)) / totalStructures) * 100,
                            message: `${structureId}: ${progress.message || 'Processing...'}`
                        });
                    });
                    results.push({ structureIndex: i, structureId, success: true, result });
                } catch (err) {
                    console.error(`Error analyzing structure ${i}:`, err);
                    results.push({ structureIndex: i, structureId, success: false, error: err.message });
                    onWarning?.(`Structure ${structureId}: ${err.message}`);
                }
            }

            setBatchProgress({
                stage: 'complete',
                currentStructure: totalStructures,
                totalStructures,
                progress: 100,
                message: `Completed: ${results.filter(r => r.success).length}/${totalStructures} structures analyzed`
            });

        } catch (err) {
            console.error('Batch analysis failed:', err);
            onError?.(`Batch analysis failed: ${err.message}`);
            setBatchProgress({
                stage: 'error',
                message: err.message
            });
        } finally {
            setIsBatchRunning(false);
        }

        return results;
    }, [structures, analyzeStructure, onWarning, onError]);

    /**
     * Cancel running batch analysis
     */
    const cancelBatchAnalysis = useCallback(() => {
        cancelRef.current = true;
    }, []);

    /**
     * Clear all batch results
     */
    const clearBatchResults = useCallback(() => {
        setBatchResults(new Map());
        setBatchProgress(null);
    }, []);

    /**
     * Check if all structures have been analyzed
     */
    const isAllAnalyzed = structures.length > 0 &&
        structures.every((_, index) => batchResults.has(index));

    /**
     * Get summary of batch results
     */
    const getBatchSummary = useCallback(() => {
        if (batchResults.size === 0) return null;

        const summary = [];
        structures.forEach((structure, index) => {
            const result = batchResults.get(index);
            if (result) {
                summary.push({
                    index,
                    id: structure.id,
                    bestGeometry: result.bestGeometry?.name || 'N/A',
                    bestCShM: result.bestGeometry?.shapeMeasure ?? null,
                    coordinationNumber: result.coordinationNumber,
                    metalElement: structure.atoms[result.metalIndex]?.element || 'N/A',
                    analysisMode: result.analysisMode
                });
            }
        });

        return summary;
    }, [structures, batchResults]);

    /**
     * Export batch results in long format (all geometries for all structures)
     */
    const getLongFormatResults = useCallback(() => {
        const rows = [];

        structures.forEach((structure, index) => {
            const result = batchResults.get(index);
            if (result && result.geometryResults) {
                result.geometryResults.forEach((geom, geomIndex) => {
                    rows.push({
                        structureId: structure.id,
                        structureIndex: index,
                        geometryRank: geomIndex + 1,
                        geometryName: geom.name,
                        shapeMeasure: geom.shapeMeasure,
                        metalElement: structure.atoms[result.metalIndex]?.element || 'N/A',
                        coordinationNumber: result.coordinationNumber,
                        radius: result.radius,
                        analysisMode: result.analysisMode
                    });
                });
            }
        });

        return rows;
    }, [structures, batchResults]);

    return {
        // Results
        batchResults,
        getStructureResult,
        getBatchSummary,
        getLongFormatResults,
        isAllAnalyzed,

        // Overrides
        structureOverrides,
        setStructureOverride,
        applyOverrideToAll,
        getMetalIndex,
        getRadius,

        // Analysis actions
        analyzeStructure,
        analyzeAllStructures,
        cancelBatchAnalysis,
        clearBatchResults,
        setStructureResult,

        // Progress state
        isBatchRunning,
        batchProgress
    };
}

export default useBatchAnalysis;

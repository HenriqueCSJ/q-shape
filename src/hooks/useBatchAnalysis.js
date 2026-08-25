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
import { getCoordinatingAtoms } from '../services/coordination/sphereDetector';
import { isShapeResultAvailable, isShapeResultRecord } from '../utils/shapeResults';

export function normalizeProgressFraction(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function analysisInvalidatedError() {
    const error = new Error('Analysis invalidated by a newer input context');
    error.code = 'ANALYSIS_INVALIDATED';
    return error;
}

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

    // Monotonic ownership tokens prevent stale async work from mutating new state.
    const contextVersionRef = useRef(0);
    const batchRunIdRef = useRef(0);
    const activeBatchRef = useRef(null);

    const invalidateActiveContext = useCallback(() => {
        contextVersionRef.current += 1;
        batchRunIdRef.current += 1;
        activeBatchRef.current = null;
        setIsBatchRunning(false);
        setBatchProgress(null);
    }, []);

    const isAnalysisOwnershipCurrent = useCallback((ownership) => Boolean(ownership) &&
        ownership.contextVersion === contextVersionRef.current &&
        ownership.batchRunId === batchRunIdRef.current, []);

    // Claims the shared result store for one externally orchestrated structure run.
    // Starting a later single or batch run invalidates this ownership token.
    const beginStructureAnalysis = useCallback(() => {
        batchRunIdRef.current += 1;
        activeBatchRef.current = null;
        setIsBatchRunning(false);
        setBatchProgress(null);
        return {
            contextVersion: contextVersionRef.current,
            batchRunId: batchRunIdRef.current
        };
    }, []);

    // Reset batch results when structures change (new file upload)
    useEffect(() => {
        invalidateActiveContext();
        setBatchResults(new Map());
        setStructureOverrides(new Map());
    }, [structures, invalidateActiveContext]);

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
        invalidateActiveContext();
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
    }, [invalidateActiveContext]);

    /**
     * Apply override to all structures
     */
    const applyOverrideToAll = useCallback((override) => {
        invalidateActiveContext();
        const newOverrides = new Map();
        structures.forEach((_, index) => {
            const existing = structureOverrides.get(index) || {};
            newOverrides.set(index, { ...existing, ...override });
        });
        setStructureOverrides(newOverrides);

        // Clear all results
        setBatchResults(new Map());
    }, [structures, structureOverrides, invalidateActiveContext]);

    /**
     * Store analysis result for a structure
     */
    const setStructureResult = useCallback((structureIndex, result, ownership = {}) => {
        const expectedContextVersion = ownership.contextVersion ?? contextVersionRef.current;
        const expectedBatchRunId = ownership.batchRunId ?? null;
        const ownsState = () =>
            expectedContextVersion === contextVersionRef.current &&
            (expectedBatchRunId === null || expectedBatchRunId === batchRunIdRef.current);

        if (!ownsState()) return false;
        setBatchResults(prev => {
            if (!ownsState()) return prev;
            const next = new Map(prev);
            next.set(structureIndex, {
                ...result,
                structureId: structures[structureIndex]?.id || `structure-${structureIndex}`,
                timestamp: Date.now()
            });
            return next;
        });
        return true;
    }, [structures]);

    const clearStructureResult = useCallback((structureIndex, ownership = {}) => {
        const expectedContextVersion = ownership.contextVersion ?? contextVersionRef.current;
        const expectedBatchRunId = ownership.batchRunId ?? null;
        const ownsState = () =>
            expectedContextVersion === contextVersionRef.current &&
            (expectedBatchRunId === null || expectedBatchRunId === batchRunIdRef.current);

        if (!ownsState()) return false;
        setBatchResults(prev => {
            if (!ownsState() || !prev.has(structureIndex)) return prev;
            const next = new Map(prev);
            next.delete(structureIndex);
            return next;
        });
        return true;
    }, []);

    /**
     * Get result for a structure
     */
    const getStructureResult = useCallback((structureIndex) => {
        return batchResults.get(structureIndex) || null;
    }, [batchResults]);

    /**
     * Run intensive analysis for a single structure
     */
    const analyzeStructure = useCallback(async (structureIndex, onProgress, ownership = {}) => {
        const expectedContextVersion = ownership.contextVersion ?? contextVersionRef.current;
        const expectedBatchRunId = ownership.batchRunId ?? null;
        const ownsState = () =>
            expectedContextVersion === contextVersionRef.current &&
            (expectedBatchRunId === null || expectedBatchRunId === batchRunIdRef.current);

        if (!ownsState()) throw analysisInvalidatedError();
        if (!structures[structureIndex]) {
            throw new Error(`Structure ${structureIndex} not found`);
        }

        clearStructureResult(structureIndex, {
            contextVersion: expectedContextVersion,
            batchRunId: expectedBatchRunId
        });

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
            progress => {
                if (ownsState()) onProgress?.(progress);
            }
        );

        if (!ownsState()) throw analysisInvalidatedError();

        if (!result || !Array.isArray(result.geometryResults) ||
            result.geometryResults.length === 0 || result.metadata?.error ||
            result.geometryResults.some(item => !isShapeResultRecord(item))) {
            throw new Error(
                result?.metadata?.error || 'Intensive analysis returned no valid geometry results'
            );
        }

        const bestGeometry = result.geometryResults.find(isShapeResultAvailable) || null;

        // Compute coordinating atoms for this structure
        // This is needed for the batch report to show full details
        const coordAtoms = getCoordinatingAtoms(atoms, metalIndex, radius);

        // Store result with coordAtoms included
        setStructureResult(structureIndex, {
            geometryResults: result.geometryResults,
            bestGeometry,
            ligandGroups: result.ligandGroups,
            metadata: result.metadata,
            metalIndex,
            radius,
            coordAtoms, // Include coordAtoms for batch report
            coordinationNumber: coordAtoms.length || result.metadata?.coordinationNumber || 0,
            analysisMode: 'intensive'
        }, {
            contextVersion: expectedContextVersion,
            batchRunId: expectedBatchRunId
        });

        return result;
    }, [structures, getMetalIndex, getRadius, setStructureResult, clearStructureResult]);

    /**
     * Run batch analysis for all structures
     */
    const analyzeAllStructures = useCallback(async () => {

        if (structures.length === 0) {
            onWarning?.('No structures to analyze');
            return;
        }

        const totalStructures = structures.length;
        const results = [];
        const contextVersion = contextVersionRef.current;
        const batchRunId = batchRunIdRef.current + 1;
        batchRunIdRef.current = batchRunId;
        const ownsRun = () =>
            contextVersion === contextVersionRef.current &&
            batchRunId === batchRunIdRef.current;

        activeBatchRef.current = {
            batchRunId,
            contextVersion,
            currentStructure: 0,
            totalStructures,
            structureId: structures[0]?.id
        };
        setBatchResults(new Map());
        setBatchProgress(null);
        setIsBatchRunning(true);

        try {
            for (let i = 0; i < totalStructures; i++) {
                if (!ownsRun()) break;

                const structureId = structures[i]?.id || `structure-${i}`;
                activeBatchRef.current = {
                    batchRunId,
                    contextVersion,
                    currentStructure: i,
                    totalStructures,
                    structureId
                };

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
                        if (!ownsRun()) return;
                        setBatchProgress({
                            stage: 'analyzing',
                            currentStructure: i + 1,
                            totalStructures,
                            structureId,
                            progress: ((i + normalizeProgressFraction(progress.progress)) / totalStructures) * 100,
                            message: `${structureId}: ${progress.message || 'Processing...'}`
                        });
                    }, {
                        contextVersion,
                        batchRunId
                    });
                    if (!ownsRun()) break;
                    results.push({ structureIndex: i, structureId, success: true, result });
                } catch (err) {
                    if (!ownsRun() || err.code === 'ANALYSIS_INVALIDATED') break;
                    console.error(`Error analyzing structure ${i}:`, err);
                    clearStructureResult(i, { contextVersion, batchRunId });
                    results.push({ structureIndex: i, structureId, success: false, error: err.message });
                    onWarning?.(`Structure ${structureId}: ${err.message}`);
                }
            }

            if (ownsRun()) {
                setBatchProgress({
                    stage: 'complete',
                    currentStructure: totalStructures,
                    totalStructures,
                    progress: 100,
                    message: `Completed: ${results.filter(r => r.success).length}/${totalStructures} structures analyzed`
                });
            }

        } catch (err) {
            if (!ownsRun()) return results;
            console.error('Batch analysis failed:', err);
            onError?.(`Batch analysis failed: ${err.message}`);
            setBatchProgress({
                stage: 'error',
                message: err.message
            });
        } finally {
            if (ownsRun()) {
                activeBatchRef.current = null;
                setIsBatchRunning(false);
            }
        }

        return results;
    }, [structures, analyzeStructure, clearStructureResult, onWarning, onError]);

    /**
     * Cancel running batch analysis
     */
    const cancelBatchAnalysis = useCallback(() => {
        const activeBatch = activeBatchRef.current;
        batchRunIdRef.current += 1;
        activeBatchRef.current = null;
        setIsBatchRunning(false);
        if (activeBatch) {
            setBatchProgress({
                stage: 'cancelled',
                currentStructure: activeBatch.currentStructure,
                totalStructures: activeBatch.totalStructures,
                structureId: activeBatch.structureId,
                progress: (activeBatch.currentStructure / activeBatch.totalStructures) * 100,
                message: `Cancelled before structure ${activeBatch.currentStructure + 1} completed`
            });
        }
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
        beginStructureAnalysis,
        isAnalysisOwnershipCurrent,
        cancelBatchAnalysis,
        clearBatchResults,
        setStructureResult,
        clearStructureResult,

        // Progress state
        isBatchRunning,
        batchProgress
    };
}

export default useBatchAnalysis;

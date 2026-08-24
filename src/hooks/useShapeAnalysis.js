/**
 * useShapeAnalysis Hook
 *
 * Manages the complete shape analysis workflow including:
 * - Shape measure calculation for all reference geometries
 * - Results caching
 * - Progress tracking
 * - Quality metrics calculation
 * - Error handling
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.coordAtoms - Coordination sphere atoms
 * @param {Object} params.analysisParams - Analysis parameters {mode, key}
 * @param {Function} params.onWarning - Callback for warnings
 * @param {Function} params.onError - Callback for errors
 *
 * @returns {Object} Shape analysis state and methods
 *
 * @example
 * const {
 *   geometryResults,
 *   bestGeometry,
 *   additionalMetrics,
 *   qualityMetrics,
 *   isLoading,
 *   progress,
 *   clearCache
 * } = useShapeAnalysis({ coordAtoms, analysisParams, onWarning, onError });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { REFERENCE_GEOMETRIES } from '../constants/referenceGeometries';
import calculateShapeMeasure from '../services/shapeAnalysis/shapeCalculator';
import { calculateAdditionalMetrics, calculateQualityMetrics } from '../services/shapeAnalysis/qualityMetrics';

function exactNumberToken(value, context) {
    if (!Number.isFinite(value)) {
        throw new Error(`Non-finite ${context}`);
    }
    return Object.is(value, -0) ? '-0' : value.toPrecision(17);
}

export function makeShapeAnalysisCacheKey(atoms, mode = 'default') {
    if (!Array.isArray(atoms) || atoms.length === 0) return null;
    try {
        return JSON.stringify([
            String(mode),
            atoms.map((entry, position) => {
                const element = entry?.atom?.element;
                const vector = entry?.vec;
                if (typeof element !== 'string' || !vector) {
                    throw new Error(`Invalid coordination entry ${position}`);
                }
                return [
                    Number.isInteger(entry.idx) ? entry.idx : position,
                    element,
                    exactNumberToken(entry.distance, `distance at ${position}`),
                    exactNumberToken(vector.x, `x coordinate at ${position}`),
                    exactNumberToken(vector.y, `y coordinate at ${position}`),
                    exactNumberToken(vector.z, `z coordinate at ${position}`)
                ];
            })
        ]);
    } catch (error) {
        console.error('Error generating cache key:', error);
        return null;
    }
}

export function intensiveResultsMatchInput(analysisParams, atoms) {
    if (!Array.isArray(analysisParams?.intensiveResults) ||
        analysisParams.intensiveResults.length === 0) {
        return false;
    }
    const currentKey = makeShapeAnalysisCacheKey(atoms, 'intensive');
    return currentKey !== null && analysisParams.intensiveInputKey === currentKey;
}

export function useShapeAnalysis({
    coordAtoms = [],
    analysisParams = { mode: 'default', key: 0 },
    onWarning = null,
    onError = null
} = {}) {
    // Analysis results state
    const [geometryResults, setGeometryResults] = useState([]);
    const [bestGeometry, setBestGeometry] = useState(null);
    const [additionalMetrics, setAdditionalMetrics] = useState(null);
    const [qualityMetrics, setQualityMetrics] = useState(null);

    // Analysis progress state
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(null);

    // Results cache with LRU limit to prevent memory leaks
    // Maximum 10 cached results (typical use case: one structure at a time)
    const MAX_CACHE_SIZE = 10;
    const resultsCache = useRef(new Map());
    const cacheOrder = useRef([]); // Track insertion order for LRU

    // Generate cache key
    const getCacheKey = useCallback(makeShapeAnalysisCacheKey, []);

    // Add to cache with LRU eviction
    const addToCache = useCallback((key, value) => {
        if (!key) return;

        // Remove oldest entry if at capacity
        if (resultsCache.current.size >= MAX_CACHE_SIZE && !resultsCache.current.has(key)) {
            const oldestKey = cacheOrder.current.shift();
            if (oldestKey) {
                resultsCache.current.delete(oldestKey);
            }
        }

        // Update cache order (move to end if exists, add if new)
        const existingIndex = cacheOrder.current.indexOf(key);
        if (existingIndex !== -1) {
            cacheOrder.current.splice(existingIndex, 1);
        }
        cacheOrder.current.push(key);

        resultsCache.current.set(key, value);
    }, []);

    // Clear cache
    const clearCache = useCallback(() => {
        resultsCache.current.clear();
        cacheOrder.current = [];
    }, []);

    // Main analysis effect
    useEffect(() => {
        // Cancellation flag to prevent state updates after unmount or re-run
        let isCancelled = false;

        const hasIntensiveResults = Array.isArray(analysisParams.intensiveResults) &&
            analysisParams.intensiveResults.length > 0;
        const intensiveResultsAreCurrent = intensiveResultsMatchInput(analysisParams, coordAtoms);

        // Use service results only when they are bound to the current sphere.
        if (intensiveResultsAreCurrent) {
            const results = analysisParams.intensiveResults;
            setGeometryResults(results);
            const best = results[0];
            setBestGeometry(best);

            if (coordAtoms && coordAtoms.length > 0) {
                const metrics = calculateAdditionalMetrics(coordAtoms);
                setAdditionalMetrics(metrics);
                const quality = calculateQualityMetrics(coordAtoms, best, best.shapeMeasure);
                setQualityMetrics(quality);
            }

            setIsLoading(false);
            setProgress(null);
            return;
        }

        // A changed center/radius/sphere must never display an old intensive result.
        const effectiveMode = hasIntensiveResults ? 'default' : analysisParams.mode;

        // Early return if no coordinating atoms
        if (!coordAtoms || coordAtoms.length === 0) {
            setGeometryResults([]);
            setBestGeometry(null);
            setAdditionalMetrics(null);
            setQualityMetrics(null);
            setIsLoading(false);
            setProgress(null);
            return;
        }

        const cn = coordAtoms.length;
        const cacheKey = getCacheKey(coordAtoms, effectiveMode);

        // Check cache
        if (cacheKey && resultsCache.current.has(cacheKey)) {
            const cached = resultsCache.current.get(cacheKey);
            setGeometryResults(cached.results);
            setBestGeometry(cached.best);
            setAdditionalMetrics(cached.metrics);
            setQualityMetrics(cached.quality);
            setIsLoading(false);
            setProgress(null);
            return;
        }

        // Calculate additional metrics (bond stats)
        const metrics = calculateAdditionalMetrics(coordAtoms);
        setAdditionalMetrics(metrics);

        // Get reference geometries for this CN
        const geometries = REFERENCE_GEOMETRIES[cn];

        if (!geometries) {
            setGeometryResults([]);
            setBestGeometry(null);
            setQualityMetrics(null);
            setIsLoading(false);
            setProgress(null);
            if (cn > 0 && onWarning) {
                onWarning(`No reference geometries available for coordination number ${cn}`);
            }
            return;
        }

        // Start analysis
        setIsLoading(true);
        setProgress(null);

        const timeouts = []; // Track all timeouts for cleanup

        const timer = setTimeout(() => {
            if (isCancelled) return;

            try {
                const actualCoords = coordAtoms.map((c) => [c.vec.x, c.vec.y, c.vec.z]);
                const results = [];
                const geometryNames = Object.keys(geometries);

                // Recursive function to process geometries sequentially
                const processGeometry = (index) => {
                    if (isCancelled) return; // Stop processing if cancelled

                    if (index >= geometryNames.length) {
                        // All geometries processed
                        if (isCancelled) return;

                        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
                        const finiteResults = results.filter(r => isFinite(r.shapeMeasure));

                        if (finiteResults.length > 0) {
                            setGeometryResults(finiteResults);
                            const best = finiteResults[0];
                            setBestGeometry(best);

                            const quality = calculateQualityMetrics(coordAtoms, best, best.shapeMeasure);
                            setQualityMetrics(quality);

                            // Cache results with LRU eviction
                            addToCache(cacheKey, {
                                results: finiteResults,
                                best,
                                metrics,
                                quality
                            });
                        } else {
                            setGeometryResults([]);
                            setBestGeometry(null);
                            setQualityMetrics(null);
                            if (onError) {
                                onError("Analysis completed but no valid geometries found");
                            }
                        }

                        setIsLoading(false);
                        setProgress(null);
                        return;
                    }

                    const name = geometryNames[index];
                    const refCoords = geometries[name];

                    if (!isCancelled) {
                        setProgress({
                            geometry: name,
                            current: index + 1,
                            total: geometryNames.length,
                            stage: 'Initializing'
                        });
                    }

                    // Process geometry asynchronously
                    const timeout = setTimeout(() => {
                        if (isCancelled) return;

                        try {
                            const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
                                actualCoords,
                                refCoords,
                                effectiveMode,
                                (progressInfo) => {
                                    if (!isCancelled) {
                                        setProgress({
                                            geometry: name,
                                            current: index + 1,
                                            total: geometryNames.length,
                                            ...progressInfo
                                        });
                                    }
                                }
                            );

                            if (!isCancelled) {
                                results.push({
                                    name,
                                    shapeMeasure: measure,
                                    refCoords,
                                    alignedCoords,
                                    rotationMatrix
                                });

                                processGeometry(index + 1);
                            }
                        } catch (error) {
                            if (!isCancelled) {
                                console.error(`Error processing geometry ${name}:`, error);
                                if (onWarning) {
                                    onWarning(`Failed to analyze ${name}: ${error.message}`);
                                }
                                processGeometry(index + 1);
                            }
                        }
                    }, 10);

                    timeouts.push(timeout);
                };

                // Start processing
                processGeometry(0);

            } catch (error) {
                if (!isCancelled) {
                    console.error("Failed to perform geometry analysis:", error);
                    if (onError) {
                        onError(`Analysis failed: ${error.message}`);
                    }
                    setGeometryResults([]);
                    setBestGeometry(null);
                    setQualityMetrics(null);
                    setIsLoading(false);
                    setProgress(null);
                }
            }
        }, 20);

        timeouts.push(timer);

        // Cleanup function to cancel ongoing analysis
        return () => {
            isCancelled = true;
            timeouts.forEach(timeout => clearTimeout(timeout));
            // Don't reset loading state here - let the next effect run handle it
            // Otherwise we interrupt analysis when coordAtoms changes slightly
        };

    // Don't include onWarning/onError in dependencies - they're stable callbacks
    // Including them causes infinite loops when they're recreated
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coordAtoms, analysisParams, getCacheKey, addToCache]);

    return {
        // Results
        geometryResults,
        bestGeometry,
        additionalMetrics,
        qualityMetrics,

        // Progress
        isLoading,
        progress,

        // Methods
        clearCache,
        resultsCache: resultsCache.current
    };
}

export default useShapeAnalysis;

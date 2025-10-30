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
import { runIntensiveAnalysis } from '../services/coordination/intensiveAnalysis';

export function useShapeAnalysis({
    coordAtoms = [],
    analysisParams = { mode: 'default', key: 0 },
    atoms = null,
    selectedMetal = null,
    coordRadius = null,
    onWarning = null,
    onError = null
} = {}) {
    // Analysis results state
    const [geometryResults, setGeometryResults] = useState([]);
    const [bestGeometry, setBestGeometry] = useState(null);
    const [additionalMetrics, setAdditionalMetrics] = useState(null);
    const [qualityMetrics, setQualityMetrics] = useState(null);
    const [intensiveResults, setIntensiveResults] = useState(null);

    // Analysis progress state
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(null);

    // Results cache
    const resultsCache = useRef(new Map());

    // Generate cache key
    const getCacheKey = useCallback((atoms, mode) => {
        if (!atoms || atoms.length === 0) return null;
        try {
            const coordKey = atoms.map(c =>
                `${c.atom.element}${c.distance.toFixed(3)}`
            ).join('-');
            return `${mode}-cn${atoms.length}-${coordKey}`;
        } catch (error) {
            console.error("Error generating cache key:", error);
            return null;
        }
    }, []);

    // Clear cache
    const clearCache = useCallback(() => {
        resultsCache.current.clear();
    }, []);

    // Main analysis effect
    useEffect(() => {
        // Cancellation flag to prevent state updates after unmount or re-run
        let isCancelled = false;

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
        const cacheKey = getCacheKey(coordAtoms, analysisParams.mode);

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

                            // Cache results
                            if (cacheKey) {
                                resultsCache.current.set(cacheKey, {
                                    results: finiteResults,
                                    best,
                                    metrics,
                                    quality
                                });
                            }
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
                                analysisParams.mode,
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
    }, [coordAtoms, analysisParams, getCacheKey]);

    // Enhanced Intensive Analysis Effect
    useEffect(() => {
        console.log('[DEBUG] Intensive analysis effect triggered');
        console.log('[DEBUG] analysisParams.mode:', analysisParams?.mode);
        console.log('[DEBUG] atoms:', atoms ? atoms.length : 'null');
        console.log('[DEBUG] selectedMetal:', selectedMetal);
        console.log('[DEBUG] coordRadius:', coordRadius);
        console.log('[DEBUG] coordAtoms:', coordAtoms ? coordAtoms.length : 'null');

        // Only run intensive analysis if mode is 'intensive' and we have all required data
        if (analysisParams.mode !== 'intensive') {
            console.log('[DEBUG] Skipping: mode is not intensive');
            setIntensiveResults(null);
            return;
        }

        if (!atoms || selectedMetal == null || !coordRadius) {
            console.log('[DEBUG] Skipping: missing atoms, selectedMetal, or coordRadius');
            setIntensiveResults(null);
            return;
        }

        // Don't run if no coordinated atoms
        if (!coordAtoms || coordAtoms.length === 0) {
            console.log('[DEBUG] Skipping: no coordinated atoms');
            setIntensiveResults(null);
            return;
        }

        console.log('🔬 Running Enhanced Intensive Analysis...');
        console.log('   Atoms:', atoms.length, 'Metal index:', selectedMetal, 'Radius:', coordRadius);

        try {
            // Run intensive analysis with ring detection and centroid-based CShM
            const results = runIntensiveAnalysis(atoms, selectedMetal, coordRadius);

            console.log('✅ Intensive Analysis Complete:');
            console.log('  - Rings detected:', results.ligandGroups.ringCount);
            console.log('  - Monodentate:', results.ligandGroups.monodentate.length);
            console.log('  - Recommendation:', results.recommendation.method);

            setIntensiveResults(results);

            // If centroid-based analysis is recommended, log the improvement
            if (results.recommendation.preferredResult && results.recommendation.improvement) {
                console.log('  - CShM Improvement:', results.recommendation.improvement);
            }
        } catch (error) {
            console.error('❌ Error in intensive analysis:', error);
            console.error('Error stack:', error.stack);
            if (onError) {
                onError(`Intensive analysis failed: ${error.message}`);
            }
            setIntensiveResults(null);
        }
    }, [analysisParams, atoms, selectedMetal, coordRadius, coordAtoms, onError]);

    return {
        // Results
        geometryResults,
        bestGeometry,
        additionalMetrics,
        qualityMetrics,
        intensiveResults,

        // Progress
        isLoading,
        progress,

        // Methods
        clearCache,
        resultsCache: resultsCache.current
    };
}

export default useShapeAnalysis;

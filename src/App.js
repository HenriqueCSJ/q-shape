import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import './App.css';

// Constants
import {
    APP_VERSION,
    APP_BUILD_SHA,
    BUILD_DATE,
    APP_FULL_NAME,
    getCitationLink,
    getCitationString
} from './constants/appMetadata';

// Custom Hooks
import useFileUpload from './hooks/useFileUpload';
import useRadiusControl from './hooks/useRadiusControl';
import useCoordination from './hooks/useCoordination';
import useShapeAnalysis, { makeShapeAnalysisCacheKey } from './hooks/useShapeAnalysis';
import useBatchAnalysis from './hooks/useBatchAnalysis';
import { useThreeScene } from './hooks/useThreeScene';

// Services
import { runIntensiveAnalysisAsync } from './services/coordination/intensiveAnalysis';
import { generatePDFReport, generateCSVReport, generateBatchPDFReport, generateLongDetailedCSV } from './services/reportGenerator';
import { isShapeResultAvailable, isShapeResultRecord } from './utils/shapeResults';
import {
    BATCH_RESULT_STATUS,
    batchResultDetail,
    createBatchFailureResult
} from './utils/batchResults';

// Components
import FileUploadSection from './components/FileUploadSection';
import AnalysisControls from './components/AnalysisControls';
import CoordinationSummary from './components/CoordinationSummary';
import Visualization3D from './components/Visualization3D';
import ResultsDisplay from './components/ResultsDisplay';
import BatchModePanel from './components/BatchModePanel';
import BatchSummaryTable from './components/BatchSummaryTable';

// --- START: REACT COMPONENT ---
export default function CoordinationGeometryAnalyzer() {
    const citationLink = getCitationLink();
    const buildSourceLabel = APP_BUILD_SHA === 'unavailable-local-build'
        ? 'local checkout'
        : APP_BUILD_SHA.slice(0, 12);
    // UI State (managed locally)
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [analysisParams, setAnalysisParams] = useState({ mode: 'default', key: 0 });
    const [autoRotate, setAutoRotate] = useState(false);
    const [showIdeal, setShowIdeal] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [warnings, setWarnings] = useState([]);
    const [selectedGeometryIndex, setSelectedGeometryIndex] = useState(0);

    // Intensive Analysis State
    const [intensiveMetadata, setIntensiveMetadata] = useState(null);
    const [intensiveProgress, setIntensiveProgress] = useState(null);
    const [isRunningIntensive, setIsRunningIntensive] = useState(false);

    // Refs
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const intensiveContextVersionRef = useRef(0);
    const intensiveRunIdRef = useRef(0);

    // File Upload Hook - v1.5.0 with multi-structure support
    const {
        structures,
        atoms,
        currentStructure,
        selectedStructureIndex,
        fileName,
        fileFormat,
        error,
        uploadMetadata,
        handleFileUpload,
        selectStructure,
        batchMode,
        structureCount
    } = useFileUpload();

    // Warning and error handlers
    const handleWarning = useCallback((msg) => {
        setWarnings(prev => [...prev, msg]);
    }, []);

    const handleError = useCallback((msg) => {
        setWarnings(prev => [...prev, `Error: ${msg}`]);
    }, []);

    // Batch Analysis Hook
    const {
        batchResults,
        getBatchSummary,
        structureOverrides,
        setStructureOverride,
        applyOverrideToAll,
        analyzeAllStructures,
        beginStructureAnalysis,
        isAnalysisOwnershipCurrent,
        cancelBatchAnalysis,
        setStructureResult,
        clearStructureResult,
        isBatchRunning,
        batchProgress
    } = useBatchAnalysis({
        structures,
        onWarning: handleWarning,
        onError: handleError
    });

    // Get effective metal and radius (with override support)
    const effectiveMetal = useMemo(() => {
        const override = structureOverrides.get(selectedStructureIndex);
        if (override?.metalIndex !== undefined) {
            return override.metalIndex;
        }
        return selectedMetal;
    }, [selectedMetal, selectedStructureIndex, structureOverrides]);

    // Radius Control Hook
    const {
        coordRadius,
        autoRadius,
        radiusInput,
        radiusStep,
        targetCNInput,
        handleRadiusInputChange,
        handleRadiusStepChange,
        handleFindRadiusForCN,
        incrementRadius,
        decrementRadius,
        setCoordRadius,
        setAutoRadius,
        setTargetCNInput
    } = useRadiusControl({
        atoms,
        selectedMetal: effectiveMetal,
        onRadiusChange: useCallback(() => {}, []),
        onWarning: handleWarning
    });

    // Coordination Hook
    const { coordAtoms } = useCoordination({
        atoms,
        selectedMetal: effectiveMetal,
        coordRadius
    });

    const intensiveInputKey = useMemo(
        () => makeShapeAnalysisCacheKey(coordAtoms, 'intensive'),
        [coordAtoms]
    );
    const intensiveContextKey = useMemo(() => JSON.stringify([
        currentStructure?.id || null,
        selectedStructureIndex,
        effectiveMetal,
        Number.isFinite(coordRadius) ? coordRadius.toPrecision(17) : null,
        intensiveInputKey
    ]), [
        currentStructure?.id,
        selectedStructureIndex,
        effectiveMetal,
        coordRadius,
        intensiveInputKey
    ]);

    // Any changed structure/center/radius/sphere invalidates prior intensive data.
    useEffect(() => {
        intensiveContextVersionRef.current += 1;
        intensiveRunIdRef.current += 1;
        setIsRunningIntensive(false);
        setAnalysisParams(previous =>
            previous.mode === 'intensive' || previous.intensiveResults
                ? { mode: 'default', key: (Number(previous.key) || 0) + 1 }
                : previous
        );
        setIntensiveMetadata(null);
        setIntensiveProgress(null);
    }, [intensiveContextKey]);

    // Intensive Analysis Handler
    const handleIntensiveAnalysis = useCallback(async () => {
        if (!atoms || effectiveMetal === null || !coordRadius || !intensiveInputKey) {
            handleWarning('Cannot run extended search: missing required data');
            return;
        }

        const contextVersion = intensiveContextVersionRef.current;
        const runId = intensiveRunIdRef.current + 1;
        intensiveRunIdRef.current = runId;
        const batchOwnership = batchMode ? beginStructureAnalysis(selectedStructureIndex) : null;
        const ownsRun = () =>
            contextVersion === intensiveContextVersionRef.current &&
            runId === intensiveRunIdRef.current &&
            (!batchMode || isAnalysisOwnershipCurrent(batchOwnership));
        setAnalysisParams(previous =>
            previous.mode === 'intensive' || previous.intensiveResults
                ? { mode: 'default', key: (Number(previous.key) || 0) + 1 }
                : previous
        );
        setIntensiveMetadata(null);
        if (batchMode) clearStructureResult(selectedStructureIndex, batchOwnership);
        setIsRunningIntensive(true);
        setIntensiveProgress({ stage: 'starting', progress: 0, message: 'Starting extended search...' });

        try {
            const results = await runIntensiveAnalysisAsync(
                atoms,
                effectiveMetal,
                coordRadius,
                (progress) => {
                    if (ownsRun()) {
                        setIntensiveProgress(progress);
                    }
                }
            );

            if (!ownsRun()) return;

            const serviceError = results?.metadata?.error;
            if (!results || !Array.isArray(results.geometryResults) ||
                results.geometryResults.length === 0 ||
                results.geometryResults.some(item => !isShapeResultRecord(item)) ||
                !results.ligandGroups || !results.metadata || serviceError) {
                throw new Error(serviceError || 'Extended search returned no valid geometry results');
            }

            const bestIntensiveGeometry =
                results.geometryResults.find(isShapeResultAvailable) || null;

            setIntensiveMetadata({
                ligandGroups: results.ligandGroups,
                metadata: results.metadata
            });

            setAnalysisParams({
                mode: 'intensive',
                key: Date.now(),
                intensiveResults: results.geometryResults,
                intensiveInputKey,
                intensiveContextKey
            });

            // Store result in batch results if in batch mode
            if (batchMode) {
                setStructureResult(selectedStructureIndex, {
                    geometryResults: results.geometryResults,
                    bestGeometry: bestIntensiveGeometry,
                    ligandGroups: results.ligandGroups,
                    metadata: results.metadata,
                    metalIndex: effectiveMetal,
                    radius: coordRadius,
                    coordinationNumber: results.metadata?.coordinationNumber || 0,
                    analysisMode: 'intensive',
                    status: bestIntensiveGeometry
                        ? BATCH_RESULT_STATUS.AVAILABLE
                        : BATCH_RESULT_STATUS.UNAVAILABLE,
                    error: bestIntensiveGeometry
                        ? null
                        : batchResultDetail({ geometryResults: results.geometryResults })
                }, batchOwnership);
            }

            setIntensiveProgress(null);

        } catch (error) {
            if (!ownsRun()) return;
            console.error('Intensive analysis failed:', error);
            const failure = createBatchFailureResult(error, {
                metalIndex: effectiveMetal,
                radius: coordRadius,
                coordinationNumber: coordAtoms.length || null
            });
            if (batchMode) {
                setStructureResult(selectedStructureIndex, failure, batchOwnership);
            }
            handleError(`Extended search failed: ${failure.error}`);
            setIntensiveProgress(null);
        } finally {
            if (runId === intensiveRunIdRef.current) {
                setIsRunningIntensive(false);
            }
        }
    }, [atoms, effectiveMetal, coordRadius, coordAtoms, intensiveInputKey, intensiveContextKey,
        handleWarning, handleError, batchMode, selectedStructureIndex,
        setStructureResult, clearStructureResult, beginStructureAnalysis,
        isAnalysisOwnershipCurrent]);

    // Shape Analysis Hook
    const {
        geometryResults,
        bestGeometry,
        additionalMetrics,
        isLoading,
        progress
    } = useShapeAnalysis({
        coordAtoms,
        analysisParams,
        onWarning: handleWarning,
        onError: handleError
    });

    // Scene key for forcing 3D re-render when selection changes
    const sceneKey = useMemo(() => {
        return `${currentStructure?.id || 'none'}-${effectiveMetal}-${coordRadius?.toFixed(2) || '0'}-${selectedGeometryIndex}`;
    }, [currentStructure?.id, effectiveMetal, coordRadius, selectedGeometryIndex]);

    // Reset selected geometry to best match when new results arrive
    useEffect(() => {
        if (geometryResults && geometryResults.length > 0) {
            setSelectedGeometryIndex(0);
        }
    }, [geometryResults]);

    // Determine which geometry to visualize based on user selection
    const selectedDisplayGeometry = geometryResults && geometryResults.length > selectedGeometryIndex
        ? geometryResults[selectedGeometryIndex]
        : bestGeometry;
    const displayGeometry = isShapeResultAvailable(selectedDisplayGeometry)
        ? selectedDisplayGeometry
        : bestGeometry;

    // Three.js Scene Hook with scene key for proper re-rendering
    const { sceneRef, rendererRef, cameraRef } = useThreeScene({
        canvasRef,
        atoms,
        selectedMetal: effectiveMetal,
        coordAtoms,
        bestGeometry: displayGeometry,
        autoRotate,
        showIdeal,
        showLabels,
        sceneKey // Pass scene key to trigger re-renders
    });

    // Sync upload metadata with state on new file upload
    const processedUploadTime = useRef(null);

    useEffect(() => {
        if (uploadMetadata && uploadMetadata.uploadTime !== processedUploadTime.current) {
            processedUploadTime.current = uploadMetadata.uploadTime;

            // Reset all state for new upload
            setWarnings([]);
            setSelectedMetal(null);
            setAnalysisParams({ mode: 'default', key: 0 });
            setIntensiveMetadata(null);
            setIntensiveProgress(null);
            setSelectedGeometryIndex(0);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Set values from uploaded file
            if (uploadMetadata.detectedMetalIndex != null) {
                setSelectedMetal(uploadMetadata.detectedMetalIndex);
            }
            if (uploadMetadata.suggestedRadius) {
                setCoordRadius(uploadMetadata.suggestedRadius, true);
            }
            setAnalysisParams({ mode: 'default', key: Date.now() });
        }
    }, [uploadMetadata, setCoordRadius]);

    // Update analysis when structure selection changes in batch mode
    useEffect(() => {
        if (batchMode && uploadMetadata?.structureMetadata) {
            const metadata = uploadMetadata.structureMetadata[selectedStructureIndex];
            if (metadata) {
                // Check if we have an override for this structure
                const override = structureOverrides.get(selectedStructureIndex);

                if (override?.metalIndex !== undefined) {
                    setSelectedMetal(override.metalIndex);
                } else if (metadata.detectedMetalIndex != null) {
                    setSelectedMetal(metadata.detectedMetalIndex);
                }

                if (override?.radius !== undefined) {
                    setCoordRadius(override.radius, false);
                } else if (metadata.suggestedRadius) {
                    setCoordRadius(metadata.suggestedRadius, true);
                }

                // Reset to default analysis for new structure
                setAnalysisParams({ mode: 'default', key: Date.now() });
                setIntensiveMetadata(null);
                setSelectedGeometryIndex(0);
            }
        }
    }, [selectedStructureIndex, batchMode, uploadMetadata, setCoordRadius, structureOverrides]);

    // Handle structure selection
    const handleSelectStructure = useCallback((index) => {
        selectStructure(index);
    }, [selectStructure]);

    // Handle metal change with override storage
    const handleMetalChange = useCallback((metalIndex) => {
        setSelectedMetal(metalIndex);
        if (batchMode) {
            setStructureOverride(selectedStructureIndex, { metalIndex });
        }
    }, [batchMode, selectedStructureIndex, setStructureOverride]);

    const storeRadiusOverride = useCallback((radius) => {
        if (batchMode && Number.isFinite(radius) && radius > 0) {
            setStructureOverride(selectedStructureIndex, { radius });
        }
    }, [batchMode, selectedStructureIndex, setStructureOverride]);

    // Every manual radius control edits only the selected structure in batch mode.
    const handleRadiusChangeWithOverride = useCallback((radius) => {
        setCoordRadius(radius, false);
        storeRadiusOverride(radius);
    }, [setCoordRadius, storeRadiusOverride]);

    const handleRadiusInputChangeWithOverride = useCallback((event) => {
        handleRadiusInputChange(event);
        storeRadiusOverride(parseFloat(event.target.value));
    }, [handleRadiusInputChange, storeRadiusOverride]);

    const handleIncrementRadiusWithOverride = useCallback(() => {
        const nextRadius = coordRadius + radiusStep;
        incrementRadius();
        storeRadiusOverride(nextRadius);
    }, [coordRadius, radiusStep, incrementRadius, storeRadiusOverride]);

    const handleDecrementRadiusWithOverride = useCallback(() => {
        const nextRadius = Math.max(1.5, coordRadius - radiusStep);
        decrementRadius();
        storeRadiusOverride(nextRadius);
    }, [coordRadius, radiusStep, decrementRadius, storeRadiusOverride]);

    const handleFindRadiusForCNWithOverride = useCallback(() => {
        const nextRadius = handleFindRadiusForCN();
        storeRadiusOverride(nextRadius);
    }, [handleFindRadiusForCN, storeRadiusOverride]);

    const handleAutoRadiusChange = useCallback((enabled) => {
        setAutoRadius(enabled);
        if (batchMode) {
            setStructureOverride(selectedStructureIndex, {
                radius: enabled ? undefined : coordRadius
            });
        }
    }, [batchMode, coordRadius, selectedStructureIndex, setAutoRadius, setStructureOverride]);

    const handleApplyRadiusToAll = useCallback((radius) => {
        setAutoRadius(false);
        applyOverrideToAll({ radius });
    }, [applyOverrideToAll, setAutoRadius]);

    // Report generation using service
    const handleGenerateReport = useCallback(() => {
        if (!atoms.length || effectiveMetal == null || !bestGeometry) return;

        try {
            const canvas = canvasRef.current;
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;

            rendererRef.current.setSize(1920, 1440, false);
            cameraRef.current.aspect = 1920 / 1440;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            const imgData = canvas.toDataURL('image/png');

            rendererRef.current.setSize(oldWidth, oldHeight, false);
            cameraRef.current.aspect = oldWidth / oldHeight;
            cameraRef.current.updateProjectionMatrix();

            generatePDFReport({
                atoms,
                selectedMetal: effectiveMetal,
                bestGeometry,
                coordAtoms,
                coordRadius,
                geometryResults,
                additionalMetrics,
                warnings,
                fileName,
                fileFormat,
                analysisMode: analysisParams.mode,
                intensiveMetadata,
                imgData,
                structureId: currentStructure?.id
            });
        } catch (err) {
            console.error("Report generation failed:", err);
            setWarnings(prev => [...prev, `Report generation failed: ${err.message}`]);
        }
    }, [atoms, effectiveMetal, bestGeometry, fileName, fileFormat, analysisParams.mode, coordRadius, coordAtoms, geometryResults, additionalMetrics, warnings, intensiveMetadata, currentStructure, rendererRef, cameraRef, sceneRef]);

    // Batch print-ready report
    const handleGenerateBatchReport = useCallback(() => {
        if (!batchMode || batchResults.size === 0) {
            handleWarning('No batch results available for report generation');
            return;
        }

        try {
            generateBatchPDFReport({
                structures,
                batchResults,
                fileName,
                fileFormat
            });
        } catch (err) {
            console.error("Batch report generation failed:", err);
            setWarnings(prev => [...prev, `Batch report generation failed: ${err.message}`]);
        }
    }, [batchMode, batchResults, structures, fileName, fileFormat, handleWarning]);

    // CSV Export - Single structure (all geometries)
    const handleGenerateCSV = useCallback(() => {
        if (!geometryResults || geometryResults.length === 0) return;

        try {
            generateCSVReport({
                geometryResults,
                fileName: currentStructure?.id || fileName
            });
        } catch (err) {
            console.error("CSV generation failed:", err);
            setWarnings(prev => [...prev, `CSV export failed: ${err.message}`]);
        }
    }, [geometryResults, fileName, currentStructure]);

    // CSV Export - Long detailed (batch mode, all geometries)
    const handleGenerateLongDetailedCSV = useCallback(() => {
        if (!batchMode || batchResults.size === 0) {
            handleWarning('No batch results available for CSV export');
            return;
        }

        try {
            generateLongDetailedCSV({
                structures,
                batchResults,
                fileName
            });
        } catch (err) {
            console.error("Long CSV generation failed:", err);
            setWarnings(prev => [...prev, `Long CSV export failed: ${err.message}`]);
        }
    }, [batchMode, batchResults, structures, fileName, handleWarning]);

    return (
    <div className="app-container">
      <div className="app-content">
      <header className="app-header">
        <h1>
            🔬 {APP_FULL_NAME}
        </h1>
        <p>
            <strong>Advanced Coordination Geometry Analysis</strong>
        </p>
        <p style={{
            fontSize: '0.9rem',
            color: '#64748b',
            marginTop: '0.5rem',
            fontFamily: 'monospace'
        }}>
            Version {APP_VERSION} | Build: {BUILD_DATE} | Source:{' '}
            <span title={APP_BUILD_SHA}>{buildSourceLabel}</span>
        </p>
        <p style={{fontStyle: 'italic', marginTop: '1rem', fontSize: '0.9rem'}}>
            Cite this: {getCitationString()}{' '}
            <a
                href={citationLink.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{color: '#4f46e5'}}
            >
                {citationLink.label}
            </a>
        </p>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="alert alert-warning">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <strong>⚠️ Warnings:</strong>
            <button
              onClick={() => setWarnings([])}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <FileUploadSection
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
        batchMode={batchMode}
        structureCount={structureCount}
        fileFormat={fileFormat}
        currentStructureId={currentStructure?.id}
      />

      {atoms.length > 0 && (
      <>
        {/* Batch Mode Panel - structure selector (shown when multiple structures detected) */}
        {batchMode && (
          <BatchModePanel
            structures={structures}
            selectedStructureIndex={selectedStructureIndex}
            onSelectStructure={handleSelectStructure}
            batchResults={batchResults}
          />
        )}

        <AnalysisControls
          atoms={atoms}
          selectedMetal={effectiveMetal}
          onMetalChange={handleMetalChange}
          coordRadius={coordRadius}
          autoRadius={autoRadius}
          radiusInput={radiusInput}
          radiusStep={radiusStep}
          targetCNInput={targetCNInput}
          onRadiusInputChange={handleRadiusInputChangeWithOverride}
          onRadiusStepChange={handleRadiusStepChange}
          onFindRadiusForCN={handleFindRadiusForCNWithOverride}
          onIncrementRadius={handleIncrementRadiusWithOverride}
          onDecrementRadius={handleDecrementRadiusWithOverride}
          onCoordRadiusChange={handleRadiusChangeWithOverride}
          onAutoRadiusChange={handleAutoRadiusChange}
          onTargetCNInputChange={setTargetCNInput}
          batchMode={batchMode}
          onApplyMetalToAll={(metalIndex) => applyOverrideToAll({ metalIndex })}
          onApplyRadiusToAll={handleApplyRadiusToAll}
          currentStructureId={currentStructure?.id}
          selectedStructureIndex={selectedStructureIndex}
          structureCount={structureCount}
        />

        <CoordinationSummary
          atoms={atoms}
          selectedMetal={effectiveMetal}
          coordAtoms={coordAtoms}
          additionalMetrics={additionalMetrics}
          progress={progress}
          intensiveProgress={intensiveProgress}
          intensiveMetadata={intensiveMetadata}
          analysisParams={analysisParams}
          isLoading={isLoading}
          isRunningIntensive={isRunningIntensive}
          bestGeometry={bestGeometry}
          geometryResults={geometryResults}
          selectedGeometryIndex={selectedGeometryIndex}
          onIntensiveAnalysis={handleIntensiveAnalysis}
          onGenerateReport={batchMode && batchResults.size > 0 ? handleGenerateBatchReport : handleGenerateReport}
          onGenerateCSV={batchMode && batchResults.size > 0 ? handleGenerateLongDetailedCSV : handleGenerateCSV}
          batchMode={batchMode}
          batchResults={batchResults}
          isBatchRunning={isBatchRunning}
          onAnalyzeAll={analyzeAllStructures}
          onCancelBatch={cancelBatchAnalysis}
          structureId={currentStructure?.id}
        />

        {/* Batch Summary Table - positioned below action buttons, close to 3D viewer */}
        {batchMode && (
          <BatchSummaryTable
            structures={structures}
            selectedStructureIndex={selectedStructureIndex}
            onSelectStructure={handleSelectStructure}
            batchResults={batchResults}
            batchProgress={batchProgress}
            getBatchSummary={getBatchSummary}
          />
        )}

        <div className="main-layout">
          <Visualization3D
            key={sceneKey}
            canvasRef={canvasRef}
            showIdeal={showIdeal}
            showLabels={showLabels}
            autoRotate={autoRotate}
            onShowIdealChange={setShowIdeal}
            onShowLabelsChange={setShowLabels}
            onAutoRotateChange={setAutoRotate}
          />

          <ResultsDisplay
            isLoading={isLoading}
            geometryResults={geometryResults}
            analysisParams={analysisParams}
            progress={progress}
            selectedMetal={effectiveMetal}
            selectedGeometryIndex={selectedGeometryIndex}
            onGeometrySelect={setSelectedGeometryIndex}
            structureId={currentStructure?.id}
            batchMode={batchMode}
          />
        </div>
      </>
      )}

      <footer style={{
        marginTop: '3rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #e2e8f0',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <img src={`${process.env.PUBLIC_URL}/UFRRJ.png`} alt="UFRRJ Logo" style={{ width: 80, height: 80 }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
            <p style={{ margin: 0 }}>Departamento de Química Fundamental</p>
            <p style={{ margin: 0 }}>Prof. Dr. Henrique C. S. Junior</p>
          </div>
        </div>
      </footer>


    </div>
</div>
    );
}

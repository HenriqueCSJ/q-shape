import React, { useEffect, useRef, useState, useCallback } from "react";
import './App.css';

// Custom Hooks
import useFileUpload from './hooks/useFileUpload';
import useRadiusControl from './hooks/useRadiusControl';
import useCoordination from './hooks/useCoordination';
import useShapeAnalysis from './hooks/useShapeAnalysis';
import { useThreeScene } from './hooks/useThreeScene';

// Services
import { runIntensiveAnalysisAsync } from './services/coordination/intensiveAnalysis';
import { generatePDFReport, generateCSVReport } from './services/reportGenerator';

// Components
import FileUploadSection from './components/FileUploadSection';
import AnalysisControls from './components/AnalysisControls';
import CoordinationSummary from './components/CoordinationSummary';
import Visualization3D from './components/Visualization3D';
import ResultsDisplay from './components/ResultsDisplay';

// --- START: REACT COMPONENT ---
export default function CoordinationGeometryAnalyzer() {
    // UI State (managed locally)
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [analysisParams, setAnalysisParams] = useState({ mode: 'default', key: 0 });
    const [autoRotate, setAutoRotate] = useState(false);
    const [showIdeal, setShowIdeal] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [warnings, setWarnings] = useState([]);

    // Intensive Analysis State
    const [intensiveMetadata, setIntensiveMetadata] = useState(null);
    const [intensiveProgress, setIntensiveProgress] = useState(null);
    const [isRunningIntensive, setIsRunningIntensive] = useState(false);

    // Refs
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    // File Upload Hook
    const { atoms, fileName, error, uploadMetadata, handleFileUpload } = useFileUpload();

    // Stable callback for radius changes
    const handleRadiusChange = useCallback((radius, isAuto) => {
        // Analysis will trigger automatically via coordAtoms dependency in useShapeAnalysis
        // No need to manually set analysisParams.key here
    }, []);

    const handleWarning = useCallback((msg) => {
        setWarnings(prev => [...prev, msg]);
    }, []);

    const handleError = useCallback((msg) => {
        setWarnings(prev => [...prev, `Error: ${msg}`]);
    }, []);

    // Radius Control Hook (v1.1.0) - defined before use
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
        selectedMetal,
        onRadiusChange: handleRadiusChange,
        onWarning: handleWarning
    });

    // Intensive Analysis Handler (after coordRadius is defined)
    const handleIntensiveAnalysis = useCallback(async () => {
        console.log('=== INTENSIVE ANALYSIS BUTTON CLICKED ===');

        if (!atoms || selectedMetal === null || !coordRadius) {
            handleWarning('Cannot run intensive analysis: Missing required data');
            return;
        }

        setIsRunningIntensive(true);
        setIntensiveProgress({ stage: 'starting', progress: 0, message: 'Starting intensive analysis...' });

        try {
            console.log('Calling runIntensiveAnalysisAsync...');

            const results = await runIntensiveAnalysisAsync(
                atoms,
                selectedMetal,
                coordRadius,
                (progress) => {
                    console.log('Progress update:', progress);
                    setIntensiveProgress(progress);
                }
            );

            console.log('=== INTENSIVE ANALYSIS RESULTS ===', results);
            console.log('geometryResults:', results?.geometryResults?.length || 0);
            console.log('ligandGroups:', results?.ligandGroups);
            console.log('metadata:', results?.metadata);

            // Validate results before setting state
            if (!results || !results.geometryResults || !results.ligandGroups || !results.metadata) {
                throw new Error('Invalid results structure from intensive analysis');
            }

            // Store metadata AND geometry results from intensive analysis
            console.log('Setting intensive metadata...');
            setIntensiveMetadata({
                ligandGroups: results.ligandGroups,
                metadata: results.metadata
            });

            // *** KEY: Use the intensive geometry results instead of running default analysis ***
            // This ensures the UI shows the improved CShM values from intensive mode
            console.log('Setting intensive results...');
            setAnalysisParams({
                mode: 'intensive',
                key: Date.now(),
                intensiveResults: results.geometryResults  // <-- Use intensive CShM results
            });

            console.log('Clearing progress...');
            setIntensiveProgress(null);

            console.log('=== INTENSIVE ANALYSIS COMPLETED SUCCESSFULLY ===');

        } catch (error) {
            console.error('=== INTENSIVE ANALYSIS ERROR ===', error);
            console.error('Error stack:', error.stack);
            handleError(`Intensive analysis failed: ${error.message}`);
            setIntensiveProgress(null);
            alert(`Intensive analysis crashed!\n\nError: ${error.message}\n\nCheck browser console (F12) for full error details.`);
        } finally {
            console.log('Setting isRunningIntensive to false');
            setIsRunningIntensive(false);
        }
    }, [atoms, selectedMetal, coordRadius, handleWarning, handleError]);

    // Coordination Hook
    const { coordAtoms } = useCoordination({
        atoms,
        selectedMetal,
        coordRadius
    });

    // Shape Analysis Hook
    const {
        geometryResults,
        bestGeometry,
        additionalMetrics,
        qualityMetrics,
        isLoading,
        progress
    } = useShapeAnalysis({
        coordAtoms,
        analysisParams,
        onWarning: handleWarning,
        onError: handleError
    });

    // Three.js Scene Hook
    const { sceneRef, rendererRef, cameraRef } = useThreeScene({
        canvasRef,
        atoms,
        selectedMetal,
        coordAtoms,
        bestGeometry,
        autoRotate,
        showIdeal,
        showLabels
    });

    // Sync upload metadata with state (set metal center and radius after upload)
    // Track processed uploads to prevent re-processing the same upload
    const processedUploadTime = useRef(null);

    useEffect(() => {
        if (uploadMetadata && uploadMetadata.uploadTime !== processedUploadTime.current) {
            // Mark this upload as processed
            processedUploadTime.current = uploadMetadata.uploadTime;

            // Reset all state to prevent lingering data from previous calculations
            setWarnings([]);
            setSelectedMetal(null);
            setAnalysisParams({ mode: 'default', key: 0 });
            setIntensiveMetadata(null);
            setIntensiveProgress(null);

            // Reset file input to allow re-uploading the same file
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Set new values from uploaded file
            if (uploadMetadata.detectedMetalIndex != null) {
                setSelectedMetal(uploadMetadata.detectedMetalIndex);
            }
            if (uploadMetadata.suggestedRadius) {
                setCoordRadius(uploadMetadata.suggestedRadius, true); // true = auto-detected
            }
            setAnalysisParams({ mode: 'default', key: Date.now() });
        }
    }, [uploadMetadata, setCoordRadius]);


    // Report generation using service
    const handleGenerateReport = useCallback(() => {
        if (!atoms.length || selectedMetal == null || !bestGeometry) return;

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
                selectedMetal,
                bestGeometry,
                coordAtoms,
                coordRadius,
                geometryResults,
                additionalMetrics,
                qualityMetrics,
                warnings,
                fileName,
                analysisMode: analysisParams.mode,
                intensiveMetadata,
                imgData
            });
        } catch (err) {
            console.error("Report generation failed:", err);
            setWarnings(prev => [...prev, `Report generation failed: ${err.message}`]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atoms, selectedMetal, bestGeometry, fileName, analysisParams.mode, coordRadius, coordAtoms, geometryResults, additionalMetrics, qualityMetrics, warnings, intensiveMetadata]);

    // CSV Export using service
    const handleGenerateCSV = useCallback(() => {
        if (!geometryResults || geometryResults.length === 0) return;

        try {
            generateCSVReport({ geometryResults, fileName });
        } catch (err) {
            console.error("CSV generation failed:", err);
            setWarnings(prev => [...prev, `CSV export failed: ${err.message}`]);
        }
    }, [geometryResults, fileName]);

//     const totalGeometries = useMemo(() => {
//         return Object.values(REFERENCE_GEOMETRIES).reduce((sum, geoms) => sum + Object.keys(geoms).length, 0);
//     }, []);

    return (
    <div className="app-container">
      <div className="app-content">
      <header className="app-header">
        <h1>
            🔬 Q-Shape (Quantitative Shape Analyzer)
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
            Version 1.4.0 | Built: November 25, 2025
        </p>
        <p style={{fontStyle: 'italic', marginTop: '1rem', fontSize: '0.9rem'}}>
            Cite this: Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.4.0). Zenodo. <a href="https://doi.org/10.5281/zenodo.17717110" target="_blank" rel="noopener noreferrer" style={{color: '#4f46e5'}}>https://doi.org/10.5281/zenodo.17717110</a>
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
      />

      {atoms.length > 0 && (
      <>
        <AnalysisControls
          atoms={atoms}
          selectedMetal={selectedMetal}
          onMetalChange={setSelectedMetal}
          coordRadius={coordRadius}
          autoRadius={autoRadius}
          radiusInput={radiusInput}
          radiusStep={radiusStep}
          targetCNInput={targetCNInput}
          onRadiusInputChange={handleRadiusInputChange}
          onRadiusStepChange={handleRadiusStepChange}
          onFindRadiusForCN={handleFindRadiusForCN}
          onIncrementRadius={incrementRadius}
          onDecrementRadius={decrementRadius}
          onCoordRadiusChange={setCoordRadius}
          onAutoRadiusChange={setAutoRadius}
          onTargetCNInputChange={setTargetCNInput}
        />

        <CoordinationSummary
          atoms={atoms}
          selectedMetal={selectedMetal}
          coordAtoms={coordAtoms}
          additionalMetrics={additionalMetrics}
          qualityMetrics={qualityMetrics}
          progress={progress}
          intensiveProgress={intensiveProgress}
          intensiveMetadata={intensiveMetadata}
          analysisParams={analysisParams}
          isLoading={isLoading}
          isRunningIntensive={isRunningIntensive}
          bestGeometry={bestGeometry}
          geometryResults={geometryResults}
          onIntensiveAnalysis={handleIntensiveAnalysis}
          onGenerateReport={handleGenerateReport}
          onGenerateCSV={handleGenerateCSV}
        />

        <div className="main-layout">
          <Visualization3D
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
            selectedMetal={selectedMetal}
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


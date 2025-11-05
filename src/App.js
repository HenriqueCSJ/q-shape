import React, { useEffect, useRef, useState, useCallback } from "react";
import './App.css';

// Constants
import { ALL_METALS } from './constants/atomicData';
import { REFERENCE_GEOMETRIES, POINT_GROUPS } from './constants/referenceGeometries';

// Utilities
import { interpretShapeMeasure } from './utils/geometry';

// Custom Hooks
import useFileUpload from './hooks/useFileUpload';
import useRadiusControl from './hooks/useRadiusControl';
import useCoordination from './hooks/useCoordination';
import useShapeAnalysis from './hooks/useShapeAnalysis';
import { useThreeScene } from './hooks/useThreeScene';

// Services
import { runIntensiveAnalysisAsync } from './services/coordination/intensiveAnalysis';

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


    // FIX 2: Ensure report uses current state values and clear dependency issues
    const generateReport = useCallback(() => {
        if (!atoms.length || selectedMetal == null || !bestGeometry) return;
        
        try {
            // Capture current state values at the time of report generation
            const currentCoordAtoms = coordAtoms;
            const currentCoordRadius = coordRadius;
            const currentBestGeometry = bestGeometry;
            const currentGeometryResults = geometryResults;
            const currentAdditionalMetrics = additionalMetrics;
            const currentQualityMetrics = qualityMetrics;
            const currentWarnings = warnings;
            const currentFileName = fileName;
            const currentAnalysisMode = analysisParams.mode;
            const currentIntensiveMetadata = intensiveMetadata;

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

            const metal = atoms[selectedMetal];
            const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
            const {name, shapeMeasure} = currentBestGeometry;
            const interpretation = interpretShapeMeasure(shapeMeasure);
            
            const totalAvailableGeometries = Object.values(REFERENCE_GEOMETRIES).reduce((sum, geoms) => sum + Object.keys(geoms).length, 0);
            const cnGeometries = currentCoordAtoms.length > 0 ? Object.keys(REFERENCE_GEOMETRIES[currentCoordAtoms.length] || {}).length : 0;

                        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Q-Shape Report: ${currentFileName}</title>
<style>
@media print {
  body { margin: 0; padding: 20px; background: white !important; }
  .no-print { display: none; }
  @page { size: A4; margin: 15mm; }
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: #1e293b;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  min-height: 100vh;
}

header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border-bottom: 3px solid #4f46e5;
  margin-bottom: 2rem;
}

h1 {
  margin: 0;
  color: #312e81;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}

header p {
  margin: 0.75rem 0 0;
  color: #475569;
  font-size: 1rem;
}

header p:first-of-type {
  margin-top: 1rem;
}

header p strong {
  color: #1e293b;
}

h2 {
  color: #312e81;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 2.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
}

h3 {
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
}

.info-box {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #93c5fd;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.info-box h3 {
  margin-top: 0;
  color: #1e40af;
}

.info-box p {
  margin: 0.5rem 0;
  color: #475569;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-item {
  padding: 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  border-left: 3px solid #4f46e5;
}

.summary-item strong {
  display: block;
  color: #64748b;
  font-size: 0.85em;
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-item span {
  font-size: 1.25em;
  font-weight: 700;
  color: #1e293b;
}

.quality-score {
  font-size: 2.5rem;
  font-weight: 800;
  text-align: center;
  padding: 2rem;
  border-radius: 12px;
  margin: 1.5rem 0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.metric-box {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #4f46e5;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.metric-box:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.metric-label {
  font-size: 0.85em;
  color: #64748b;
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.5em;
  font-weight: 700;
  color: #312e81;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  font-weight: 700;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

tbody tr {
  transition: background 0.2s;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr:nth-child(even) {
  background: #fafbfc;
}

tbody tr:nth-child(even):hover {
  background: #f1f5f9;
}

.best-result {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important;
  font-weight: 700;
  border-left: 4px solid #10b981;
}

.best-result:hover {
  background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%) !important;
}

img {
  max-width: 100%;
  height: auto;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  margin: 1rem 0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  display: block;
}

.warning-box {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.warning-box h3 {
  margin-top: 0;
  color: #92400e;
}

.warning-box ul {
  margin: 0.5rem 0 0;
  padding-left: 1.5rem;
  color: #78350f;
}

.download-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin: 1rem 0;
  display: inline-block;
  box-shadow: 0 4px 6px rgba(79, 70, 229, 0.4);
  transition: all 0.2s;
}

.download-btn:hover {
  background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(79, 70, 229, 0.5);
}

footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #e2e8f0;
  text-align: center;
  color: #64748b;
  font-size: 0.9em;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

footer p {
  margin: 0.5rem 0;
}

footer strong {
  color: #1e293b;
}

.university-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.university-section img {
  width: 60px;
  height: 60px;
  border: none;
  box-shadow: none;
  margin: 0;
}

.university-info {
  text-align: left;
}

.university-info p {
  margin: 0.25rem 0;
}

@media print {
  .quality-score,
  .metric-box {
    break-inside: avoid;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 2rem;">
  <button class="download-btn" onclick="window.print()">📄 Download as PDF</button>
</div>

<header>
  <h1>🔬 Q-Shape (Quantitative Shape Analyzer)</h1>
  <p><strong>Coordination Geometry Analysis Report</strong></p>
  <p><strong>File:</strong> ${currentFileName}.xyz</p>
  <p><strong>Generated on:</strong> ${date}</p>
  <p><strong>Analysis Mode:</strong> ${currentAnalysisMode === 'intensive' ? 'Intensive (High Precision) with Kabsch Alignment' : 'Standard with Improved Kabsch Alignment'}</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
    Cite this: Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.2.1). Zenodo.
    <a href="https://doi.org/10.5281/zenodo.17448252" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17448252</a>
  </p>
</header>

<main>
  <div class="info-box">
    <h3>🔬 Q-Shape Analysis Overview</h3>
    <p><strong>Q-Shape (Quantitative Shape Analyzer)</strong> provides advanced coordination geometry analysis using Continuous Shape Measures (CShM) methodology.</p>
    <p>This report analyzes your structure against <strong>${totalAvailableGeometries} reference geometries</strong> across all coordination numbers (CN=2-60).</p>
    <p>For CN=${currentCoordAtoms.length}, ${cnGeometries} reference geometries were evaluated using optimized Kabsch alignment and Hungarian algorithm.</p>
  </div>

  <h2>📊 Analysis Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <strong>Metal Center</strong>
      <span>${metal.element} (#${selectedMetal+1})</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Number</strong>
      <span>${currentCoordAtoms.length}</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Radius</strong>
      <span>${currentCoordRadius.toFixed(3)} Å</span>
    </div>
    <div class="summary-item">
      <strong>Best Match Geometry</strong>
      <span style="color:${interpretation.color};">${name}</span>
    </div>
    <div class="summary-item">
      <strong>Point Group</strong>
      <span style="color:#6366f1; font-family: monospace; font-weight: 600;">${POINT_GROUPS[name] || '—'}</span>
    </div>
    <div class="summary-item">
      <strong>CShM Value</strong>
      <span style="color:${interpretation.color};">${shapeMeasure.toFixed(4)}</span>
    </div>
    <div class="summary-item">
      <strong>Interpretation</strong>
      <span style="color:${interpretation.color};">${interpretation.text}</span>
    </div>
  </div>

  ${currentQualityMetrics ? `
  <h2>🎯 Quality Metrics</h2>
  <div class="quality-score" style="background: linear-gradient(135deg, ${currentQualityMetrics.overallQualityScore > 80 ? '#d1fae5' : currentQualityMetrics.overallQualityScore > 60 ? '#fef3c7' : '#fee2e2'}, transparent); color: ${currentQualityMetrics.overallQualityScore > 80 ? '#059669' : currentQualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626'};">
    Overall Quality Score: ${currentQualityMetrics.overallQualityScore.toFixed(1)}/100
  </div>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Angular Distortion Index</div>
      <div class="metric-value">${currentQualityMetrics.angularDistortionIndex.toFixed(3)}°</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Lower is better (ideal = 0)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Uniformity</div>
      <div class="metric-value">${currentQualityMetrics.bondLengthUniformityIndex.toFixed(1)}%</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Higher is better (ideal = 100)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Shape Deviation Parameter</div>
      <div class="metric-value">${currentQualityMetrics.shapeDeviationParameter.toFixed(4)}</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Normalized distortion measure</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">RMSD</div>
      <div class="metric-value">${currentQualityMetrics.rmsd.toFixed(4)} Å</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Root mean square deviation</div>
    </div>
  </div>
  ` : ''}

  ${currentAdditionalMetrics ? `
  <h2>📈 Bond Statistics</h2>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Mean Bond Length</div>
      <div class="metric-value">${currentAdditionalMetrics.meanBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Std Dev Bond Length</div>
      <div class="metric-value">${currentAdditionalMetrics.stdDevBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Range</div>
      <div class="metric-value">${currentAdditionalMetrics.minBondLength.toFixed(3)} - ${currentAdditionalMetrics.maxBondLength.toFixed(3)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Mean L-M-L Angle</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.mean.toFixed(2)}° ± ${currentAdditionalMetrics.angleStats.stdDev.toFixed(2)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Angle Range</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.min.toFixed(1)}° - ${currentAdditionalMetrics.angleStats.max.toFixed(1)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Number of L-M-L Angles</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.count}</div>
    </div>
  </div>
  ` : ''}

  ${currentIntensiveMetadata && currentIntensiveMetadata.metadata && currentIntensiveMetadata.ligandGroups ? `
  <h2>🔬 Pattern-Based Intensive Analysis</h2>
  <div class="info-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #10b981;">
    <h3 style="margin-top: 0; color: #15803d;">Detected Structural Pattern</h3>

    ${currentIntensiveMetadata.metadata.patternDetected ? `
    <div style="padding: 1rem; background: white; border-radius: 8px; margin: 1rem 0;">
      <p style="margin: 0.5rem 0;"><strong>Pattern:</strong> <span style="text-transform: capitalize;">${currentIntensiveMetadata.metadata.patternDetected.replace('_', ' ')}</span></p>
      <p style="margin: 0.5rem 0;"><strong>Confidence:</strong> ${Math.round(currentIntensiveMetadata.metadata.patternConfidence * 100)}%</p>
      <p style="margin: 0.5rem 0;"><strong>Coordination Number:</strong> ${currentIntensiveMetadata.metadata.coordinationNumber}</p>
    </div>
    ` : ''}

    <h4>Ligand Groups Analysis</h4>
    <p><strong>${currentIntensiveMetadata.ligandGroups.summary}</strong></p>

    ${currentIntensiveMetadata.ligandGroups.rings && currentIntensiveMetadata.ligandGroups.rings.length > 0 ? `
    <div style="margin-top: 1rem;">
      <p style="font-weight: 600; color: #15803d;">Detected Rings:</p>
      <ul style="list-style: none; padding-left: 1rem;">
        ${currentIntensiveMetadata.ligandGroups.rings.map((ring, i) => `
        <li style="margin: 0.5rem 0;">
          <strong>Ring ${i+1}:</strong> ${ring.hapticity || 'Unknown'} (${ring.size} atoms, ${ring.distanceToMetal ? ring.distanceToMetal.toFixed(3) + ' Å from metal' : ''})
        </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${currentIntensiveMetadata.ligandGroups.hasSandwichStructure ? `
    <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-weight: 700; color: #1e40af;">🥪 Sandwich Structure Detected</p>
      <p style="margin: 0.5rem 0 0; color: #1e3a8a; font-size: 0.9rem;">
        This complex features parallel π-coordinated rings characteristic of sandwich compounds like ferrocene.
        The intensive analysis treats ring centroids as coordination sites for accurate geometry determination.
      </p>
    </div>
    ` : ''}

    ${currentIntensiveMetadata.metadata.bestGeometry ? `
    <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
      <p style="margin: 0;"><strong>Best Geometry:</strong> ${currentIntensiveMetadata.metadata.bestGeometry}</p>
      <p style="margin: 0.5rem 0 0;"><strong>CShM Value:</strong> ${currentIntensiveMetadata.metadata.bestCShM ? currentIntensiveMetadata.metadata.bestCShM.toFixed(4) : 'N/A'}</p>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <h2>🎨 3D Visualization Snapshot</h2>
  <img src="${imgData}" alt="3D rendering of the coordination complex">

  <h2>📋 Geometry Analysis Results</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Geometry</th>
        <th>Point Group</th>
        <th>CShM</th>
        <th>Interpretation</th>
        <th>Confidence</th>
      </tr>
    </thead>
    <tbody>
      ${currentGeometryResults.map((r, i) => `
      <tr class="${i === 0 ? 'best-result' : ''}">
        <td>${i + 1}</td>
        <td><strong>${r.name}</strong></td>
        <td style="font-family: monospace; font-weight: 600; color: #6366f1;">${POINT_GROUPS[r.name] || '—'}</td>
        <td style="font-family: monospace; font-weight: 600;">${r.shapeMeasure.toFixed(4)}</td>
        <td style="color: ${interpretShapeMeasure(r.shapeMeasure).color}; font-weight: 600;">${interpretShapeMeasure(r.shapeMeasure).text}</td>
        <td style="font-weight: 600;">${interpretShapeMeasure(r.shapeMeasure).confidence}%</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>🔗 Coordinating Atoms</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Element</th>
        <th>Distance (Å)</th>
        <th>Coordinates (x, y, z)</th>
      </tr>
    </thead>
    <tbody>
      ${currentCoordAtoms.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.atom.element}</strong></td>
        <td style="font-family: monospace;">${c.distance.toFixed(4)}</td>
        <td style="font-family: monospace; font-size: 0.9em;">${c.atom.x.toFixed(4)}, ${c.atom.y.toFixed(4)}, ${c.atom.z.toFixed(4)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  ${currentWarnings.length > 0 ? `
  <div class="warning-box">
    <h3>⚠️ Warnings</h3>
    <ul>
      ${currentWarnings.map(w => `<li>${w}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
</main>

<footer>
  <p>Report generated by <strong>Q-Shape (Quantitative Shape Analyzer) v1.2.1</strong></p>
  <p style="margin-top: 1rem;">Comprehensive analysis with ${totalAvailableGeometries} reference geometries • Optimized Kabsch alignment with Jacobi SVD • Enhanced Hungarian algorithm</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">
    Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.2.1). Zenodo.
    <a href="https://doi.org/10.5281/zenodo.17448252" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17448252</a>
  </p>
  <p style="margin-top: 0.5rem; font-size: 0.85em; color: #64748b;">
    Based on Continuous Shape Measures methodology: Pinsky & Avnir (1998), Alvarez et al. (2002)
  </p>

  <div class="university-section">
    <img src="${process.env.PUBLIC_URL}/UFRRJ.png" alt="UFRRJ Logo" onerror="this.style.display='none'">
    <div class="university-info">
      <p style="font-weight: bold; color: #1e293b;">Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
      <p>Departamento de Química Fundamental</p>
      <p>Prof. Dr. Henrique C. S. Junior</p>
    </div>
  </div>
</footer>
</body>
</html>`;;
            
            const reportWindow = window.open("", "_blank");
            if (reportWindow) {
                reportWindow.document.write(html);
                reportWindow.document.close();
            } else {
                setWarnings(prev => [...prev, "Popup blocked. Please allow popups for this site to view the report."]);
            }
        } catch (err) {
            console.error("Report generation failed:", err);
            setWarnings(prev => [...prev, `Report generation failed: ${err.message}`]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atoms, selectedMetal, bestGeometry, fileName, analysisParams, coordRadius, coordAtoms, geometryResults, additionalMetrics, qualityMetrics, warnings, intensiveMetadata]);

    // CSV Export functionality
    const generateCSV = useCallback(() => {
        if (!geometryResults || geometryResults.length === 0) return;

        try {
            // CSV Header
            const headers = ['Rank', 'Geometry', 'Point Group', 'CShM', 'Interpretation', 'Confidence %'];

            // CSV Rows
            const rows = geometryResults.map((result, index) => {
                const interpretation = interpretShapeMeasure(result.shapeMeasure);
                const pointGroup = POINT_GROUPS[result.name] || '';

                return [
                    index + 1,
                    `"${result.name}"`, // Quote to handle commas in names
                    pointGroup,
                    result.shapeMeasure.toFixed(4),
                    `"${interpretation.text}"`,
                    interpretation.confidence
                ];
            });

            // Combine into CSV string
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Create download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `${fileName || 'shape-analysis'}_results.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

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
            Version 1.2.1 | Built: October 26, 2025
        </p>
        <p style={{fontStyle: 'italic', marginTop: '1rem', fontSize: '0.9rem'}}>
            Cite this: Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.2.1). Zenodo. <a href="https://doi.org/10.5281/zenodo.17448252" target="_blank" rel="noopener noreferrer" style={{color: '#4f46e5'}}>https://doi.org/10.5281/zenodo.17448252</a>
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
      
      <div className="card">
        <label className="control-label">
          📁 Load Molecular Structure (.xyz)
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xyz"
            onChange={handleFileUpload}
            className="file-upload-input"
          />
        </div>
      </div>

      {atoms.length > 0 && (
      <>
        <div className="controls-section">
          <div className="card">
            <label className="control-label">
              🎯 Metal Center
            </label>
            <select 
              value={selectedMetal ?? ''} 
              onChange={(e) => setSelectedMetal(Number(e.target.value))} 
              className="select-input"
            >
              <option value="">Select central atom</option>
              {atoms.map((a, i) => ( 
                <option key={i} value={i}> 
                  #{i + 1}: {a.element}{ALL_METALS.has(a.element) ? ' ⭐' : ''} 
                </option> 
              ))}
            </select>
          </div>
          
          <div className="card">
            <div className="slider-header">
              <label className="control-label">
                📏 Coordination Radius: {coordRadius.toFixed(2)} Å
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoRadius}
                  onChange={(e) => setAutoRadius(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Auto
              </label>
            </div>

            {/* Precise Radius Control - v1.1.0 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={radiusInput}
                  onChange={handleRadiusInputChange}
                  disabled={autoRadius}
                  placeholder="3.000"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace'
                  }}
                />
                <select
                  value={radiusStep}
                  onChange={handleRadiusStepChange}
                  disabled={autoRadius}
                  className="select-input"
                  style={{ width: 'auto', padding: '0.5rem' }}
                >
                  <option value={0.50}>±0.50 Å</option>
                  <option value={0.10}>±0.10 Å</option>
                  <option value={0.05}>±0.05 Å</option>
                  <option value={0.01}>±0.01 Å</option>
                </select>
                <button
                  onClick={incrementRadius}
                  disabled={autoRadius}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: autoRadius ? '#e2e8f0' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoRadius ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  +
                </button>
                <button
                  onClick={decrementRadius}
                  disabled={autoRadius}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: autoRadius ? '#e2e8f0' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoRadius ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  −
                </button>
              </div>
            </div>

            <input
              type="range"
              min="1.5"
              max="6.0"
              step="0.05"
              value={coordRadius}
              onChange={(e) => {
                setCoordRadius(parseFloat(e.target.value), false);
              }}
              style={{
                width: '100%',
                accentColor: '#4f46e5'
              }}
            />
          </div>

          {/* Find Radius by CN - v1.1.0 */}
          <div className="card">
            <label className="control-label">
              🎯 Find Radius by Coordination Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <input
                type="text"
                value={targetCNInput}
                onChange={(e) => setTargetCNInput(e.target.value)}
                placeholder="Target CN (2-60)"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
              />
              <button
                onClick={handleFindRadiusForCN}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                Find Radius
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
              Automatically finds optimal radius for target CN using gap detection
            </div>
          </div>
        </div>

        {selectedMetal != null && (
        <div style={{ 
          padding: '1.5rem', 
          background: '#fff', 
          border: '2px solid #e2e8f0', 
          borderRadius: '12px', 
          marginBottom: '2rem', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
        }}>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.5rem'
            }}>
                <div>
                    <h3 style={{ 
                        margin: '0 0 1rem', 
                        color: '#1e293b',
                        fontSize: '1.25rem',
                        fontWeight: 700
                    }}>
                        📊 Coordination Summary
                    </h3>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'auto 1fr', 
                        gap: '0.5rem 1rem',
                        fontSize: '0.95rem',
                        color: '#475569'
                    }}>
                        <strong>Metal:</strong> 
                        <span>{atoms[selectedMetal].element}</span>
                        
                        <strong>CN:</strong> 
                        <span>{coordAtoms.length}</span>
                        
                        <strong>Ligands:</strong> 
                        <span>{coordAtoms.map(c=>c.atom.element).join(', ') || 'None'}</span>
                    </div>
                    
                    {additionalMetrics && (
                        <div style={{ 
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            fontSize: '0.9rem'
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>📏 Bond Statistics</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><strong>Mean:</strong> {additionalMetrics.meanBondLength.toFixed(3)} Å</div>
                                <div><strong>Std Dev:</strong> {additionalMetrics.stdDevBondLength.toFixed(3)} Å</div>
                                <div><strong>Min:</strong> {additionalMetrics.minBondLength.toFixed(3)} Å</div>
                                <div><strong>Max:</strong> {additionalMetrics.maxBondLength.toFixed(3)} Å</div>
                            </div>
                        </div>
                    )}
                </div>
                
                {qualityMetrics && (
                    <div style={{ 
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        borderRadius: '12px',
                        border: '2px solid #86efac'
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#15803d', fontSize: '1.1rem' }}>
                            🎯 Quality Score
                        </div>
                        <div style={{ 
                            fontSize: '2.5rem', 
                            fontWeight: 800, 
                            color: qualityMetrics.overallQualityScore > 80 ? '#059669' : qualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626',
                            textAlign: 'center',
                            margin: '0.5rem 0'
                        }}>
                            {qualityMetrics.overallQualityScore.toFixed(1)}
                        </div>
                        <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>
                            out of 100
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div><strong>RMSD:</strong> {qualityMetrics.rmsd.toFixed(4)}</div>
                                <div><strong>Ang. Dist:</strong> {qualityMetrics.angularDistortionIndex.toFixed(2)}°</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
                          
            <div style={{ 
              display: 'flex', 
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
                <button
                    onClick={handleIntensiveAnalysis}
                    disabled={isLoading || isRunningIntensive}
                    style={{
                        padding: '1rem 2rem',
                        background: (isLoading || isRunningIntensive) ? '#d1d5db' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: (isLoading || isRunningIntensive) ? 'not-allowed' : 'pointer',
                        boxShadow: (isLoading || isRunningIntensive) ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.4)',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => !(isLoading || isRunningIntensive) && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    {isRunningIntensive ? '⚡ Running...' : '⚡ Intensive Analysis'}
                </button>
                
                <button
                    onClick={generateReport}
                    disabled={!bestGeometry || isLoading}
                    style={{
                        padding: '1rem 2rem',
                        background: bestGeometry && !isLoading
                            ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                            : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: bestGeometry && !isLoading ? 'pointer' : 'not-allowed',
                        boxShadow: bestGeometry && !isLoading ? '0 4px 6px rgba(79, 70, 229, 0.4)' : 'none',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => bestGeometry && !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    📄 Generate Report
                </button>

                <button
                    onClick={generateCSV}
                    disabled={!geometryResults || geometryResults.length === 0 || isLoading}
                    style={{
                        padding: '1rem 2rem',
                        background: geometryResults && geometryResults.length > 0 && !isLoading
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: geometryResults && geometryResults.length > 0 && !isLoading ? 'pointer' : 'not-allowed',
                        boxShadow: geometryResults && geometryResults.length > 0 && !isLoading ? '0 4px 6px rgba(16, 185, 129, 0.4)' : 'none',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => geometryResults && geometryResults.length > 0 && !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    📊 Download CSV
                </button>
            </div>
            
            {progress && (
                <div style={{ 
                    marginTop: '1.5rem', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', 
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '0.75rem',
                        alignItems: 'center'
                    }}>
                        <span style={{ 
                            fontWeight: 700, 
                            color: '#1e293b',
                            fontSize: '0.95rem'
                        }}>
                            Analyzing: {progress.geometry} ({progress.current}/{progress.total})
                        </span>
                        <span style={{ 
                            fontWeight: 700, 
                            color: analysisParams.mode === 'intensive' ? '#16a34a' : '#4f46e5',
                            fontSize: '1.1rem'
                        }}>
                            {progress.percentage}%
                        </span>
                    </div>
                    <div style={{ 
                        width: '100%', 
                        height: '12px', 
                        background: '#e2e8f0', 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ 
                            width: `${progress.percentage}%`, 
                            height: '100%', 
                            background: analysisParams.mode === 'intensive' 
                                ? 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)' 
                                : 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)', 
                            transition: 'width 0.3s ease',
                            borderRadius: '6px'
                        }} />
                    </div>
                    <div style={{ 
                        marginTop: '0.75rem', 
                        color: '#64748b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span><strong>Stage:</strong> {progress.stage}</span>
                        {progress.extra && <span style={{ fontStyle: 'italic' }}>{progress.extra}</span>}
                    </div>
                </div>
            )}
        </div>
        )}

        <div className="main-layout">
          <div className="visualization-card">
           <div className="visualization-header">
              <h3 className="card-title">
                  🎨 3D Visualization
              </h3>
              <div className="visualization-controls">
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={showIdeal} 
                          onChange={(e) => setShowIdeal(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Show Ideal
                  </label>
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={showLabels} 
                          onChange={(e) => setShowLabels(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Labels
                  </label>
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={autoRotate} 
                          onChange={(e) => setAutoRotate(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Rotate
                  </label>
              </div>
           </div>
           <div className="canvas-container">
             <canvas 
               ref={canvasRef} 
               style={{ 
                 width: '100%', 
                 height: '100%', 
                 display: 'block',
                 borderRadius: '8px'
               }} 
             />
           </div>
           <p style={{ 
             marginTop: '1rem', 
             color: '#64748b', 
             fontSize: '0.85rem',
             textAlign: 'center',
             fontStyle: 'italic'
           }}>
             💡 Mouse: rotate • Scroll: zoom • Right-click: pan
           </p>
          </div>

          <div>
            {/* Intensive Analysis Progress */}
            {intensiveProgress && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '2px solid #86efac',
              borderRadius: '8px'
            }}>
              {/* Main Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem' }}>⚡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>
                    {intensiveProgress.message}
                  </div>
                  <div style={{
                    background: '#fff',
                    height: '8px',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                      height: '100%',
                      width: `${intensiveProgress.progress * 100}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#15803d', minWidth: '50px', textAlign: 'right' }}>
                  {Math.round(intensiveProgress.progress * 100)}%
                </div>
              </div>

              {/* Worker Details (if available) */}
              {intensiveProgress.workerDetails && (
                <div style={{ marginTop: '1rem' }}>
                  {/* Time Estimate */}
                  {intensiveProgress.workerDetails.estimatedRemaining > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#16a34a', marginBottom: '0.75rem' }}>
                      ⏱️ Estimated time remaining: {intensiveProgress.workerDetails.estimatedRemaining}s
                      {' | '}
                      Elapsed: {intensiveProgress.workerDetails.elapsed}s
                    </div>
                  )}

                  {/* Completed Shapes Preview */}
                  {intensiveProgress.workerDetails.results && intensiveProgress.workerDetails.results.length > 0 && (
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.25rem' }}>
                        ✅ Top Results So Far:
                      </div>
                      <div style={{ color: '#166534' }}>
                        {intensiveProgress.workerDetails.results.slice(0, 3).map((r, i) => (
                          <div key={i}>
                            {i + 1}. {r.name}: {r.shapeMeasure.toFixed(4)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worker Status Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {intensiveProgress.workerDetails.workers && intensiveProgress.workerDetails.workers.map((worker) => (
                      <div key={worker.id} style={{
                        padding: '0.5rem',
                        background: worker.busy ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        border: `1px solid ${worker.busy ? '#86efac' : '#cbd5e1'}`,
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ fontWeight: 600, color: worker.busy ? '#15803d' : '#64748b', marginBottom: '0.25rem' }}>
                          Worker {worker.id + 1}
                          {worker.error && ' ❌'}
                        </div>
                        {worker.busy && worker.shape && (
                          <div style={{ color: '#166534', fontSize: '0.75rem' }}>
                            {worker.shape}
                            <div style={{ marginTop: '0.25rem' }}>
                              <div style={{
                                background: '#fff',
                                height: '3px',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  background: '#22c55e',
                                  height: '100%',
                                  width: `${worker.progress}%`,
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {!worker.busy && !worker.error && (
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {worker.stage === 'idle' ? 'Waiting...' : 'Complete'}
                          </div>
                        )}
                        {worker.error && (
                          <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>
                            Error
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Intensive Analysis Metadata */}
          {intensiveMetadata && intensiveMetadata.metadata && intensiveMetadata.ligandGroups && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '2px solid #10b981',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔬</span> Pattern-Based Analysis Applied (CN={intensiveMetadata.metadata?.coordinationNumber || 'N/A'})
              </div>

              {/* Pattern Detection Info */}
              {intensiveMetadata.metadata?.patternDetected && (
                <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '0.5rem' }}>
                  ✓ Detected: <span style={{ textTransform: 'capitalize' }}>
                    {intensiveMetadata.metadata.patternDetected.replace('_', ' ')}
                  </span> structure ({Math.round(intensiveMetadata.metadata.patternConfidence * 100)}% confidence)
                </div>
              )}

              {/* Ligand Groups Summary */}
              <div style={{ color: '#166534' }}>
                {intensiveMetadata.ligandGroups?.summary || 'Ligand information not available'}
              </div>

              {/* Ring Details */}
              {intensiveMetadata.ligandGroups?.rings?.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#16a34a' }}>
                  {intensiveMetadata.ligandGroups.rings.map((ring, i) => (
                    <div key={i}>• Ring {i+1}: {ring?.hapticity || 'Unknown'} ({ring?.size || 0} atoms)</div>
                  ))}
                </div>
              )}

              {/* Best Geometry */}
              {intensiveMetadata.metadata?.bestGeometry && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                  → Best fit: {intensiveMetadata.metadata.bestGeometry} (CShM = {intensiveMetadata.metadata.bestCShM?.toFixed(3)})
                </div>
              )}
            </div>
          )}

            <h3 style={{ 
                margin: '0 0 1rem 0', 
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📈 Geometry Analysis Results
            </h3>
            {isLoading ? (
                <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center', 
                    color: '#475569', 
                    background: '#fff', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '12px', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ 
                        fontSize: '3rem', 
                        marginBottom: '1rem',
                        animation: 'pulse 2s infinite'
                    }}>
                        🔬
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        Running {analysisParams.mode === 'intensive' ? 'Intensive' : 'Standard'} Analysis
                    </div>
                    {progress && (
                        <div style={{ 
                            marginTop: '1rem', 
                            fontSize: '0.9rem',
                            color: '#64748b'
                        }}>
                            <div style={{ fontWeight: 600 }}>{progress.geometry}</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                {progress.stage} • {progress.percentage}%
                            </div>
                        </div>
                    )}
                </div>
            ) : geometryResults.length > 0 ? (
                <div className="results-container">
                    {geometryResults.slice(0, 15).map((r, i) => {
                        const inter = interpretShapeMeasure(r.shapeMeasure);
                        return (
                        <div 
                            key={i} 
                            style={{ 
                                padding: '1rem', 
                                background: i === 0 
                                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' 
                                    : i % 2 === 0 ? '#f9fafb' : '#fff', 
                                borderBottom: i < 14 ? '1px solid #e2e8f0' : 'none', 
                                borderLeft: i === 0 ? '4px solid #10b981' : '4px solid transparent',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = i === 0 ? 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)' : '#f1f5f9'}
                            onMouseOut={(e) => e.currentTarget.style.background = i === 0 ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : i % 2 === 0 ? '#f9fafb' : '#fff'}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <strong style={{
                                        fontSize: '0.95rem',
                                        color: i === 0 ? '#15803d' : '#1e293b',
                                        display: 'block'
                                    }}>
                                        {i + 1}. {r.name}
                                    </strong>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#6366f1',
                                        fontFamily: 'monospace',
                                        fontWeight: 600
                                    }}>
                                        {POINT_GROUPS[r.name] || ''}
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 800,
                                    color: inter.color,
                                    fontFamily: 'monospace'
                                }}>
                                    {r.shapeMeasure.toFixed(4)}
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.8rem'
                            }}>
                                <span style={{ color: '#64748b' }}>
                                    <strong style={{ color: inter.color }}>{inter.text}</strong>
                                </span>
                                <span style={{ 
                                    color: inter.confidence > 80 ? '#059669' : inter.confidence > 50 ? '#f59e0b' : '#dc2626',
                                    fontWeight: 600
                                }}>
                                    {inter.confidence}%
                                </span>
                            </div>
                        </div>
                        );
                    })}
                    {geometryResults.length > 15 && (
                        <div style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center', 
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: '0.85rem',
                            fontStyle: 'italic'
                        }}>
                            + {geometryResults.length - 15} more (see report)
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center', 
                    color: '#64748b', 
                    background: '#fff', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    {selectedMetal == null 
                        ? 'Select a metal center to begin analysis' 
                        : 'No reference geometries for this coordination number'}
                </div>
            )}
          </div>
        </div>

        <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <h3 style={{
                margin: '0 0 1rem 0',
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📚 References
            </h3>
            <ul style={{ listStyle: 'decimal inside', paddingLeft: '0', color: '#475569', fontSize: '0.9rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                    Pinsky, M.; Avnir, D. <em>Inorg. Chem.</em> <strong>1998</strong>, 37, 5575–5582.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                    Alvarez, S. et al. <em>Coord. Chem. Rev.</em> <strong>2005</strong>, 249, 1693–1708.
                </li>
                <li>
                    Llunell, M. et al. SHAPE 2.1, Universitat de Barcelona, 2013.
                </li>
            </ul>
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


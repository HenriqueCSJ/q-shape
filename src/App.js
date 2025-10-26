import React, { useEffect, useRef, useState, useCallback } from "react";
import './App.css';

// Constants
import { ALL_METALS } from './constants/atomicData';
import { REFERENCE_GEOMETRIES } from './constants/referenceGeometries';

// Utilities
import { interpretShapeMeasure } from './utils/geometry';

// Custom Hooks
import useFileUpload from './hooks/useFileUpload';
import useRadiusControl from './hooks/useRadiusControl';
import useCoordination from './hooks/useCoordination';
import useShapeAnalysis from './hooks/useShapeAnalysis';
import { useThreeScene } from './hooks/useThreeScene';

// --- START: REACT COMPONENT ---
export default function CoordinationGeometryAnalyzer() {
    // UI State (managed locally)
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [analysisParams, setAnalysisParams] = useState({ mode: 'default', key: 0 });
    const [autoRotate, setAutoRotate] = useState(false);
    const [showIdeal, setShowIdeal] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [warnings, setWarnings] = useState([]);

    // Refs
    const canvasRef = useRef(null);

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

    // Radius Control Hook (v1.1.0)
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
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">Cite this: Junior, H. C. S. Q-Shape (Quantitative Shape Analyzer). 2025.</p>
</header>

<main>
  <div class="info-box">
    <h3>📐 SHAPE 2.1 Complete Coverage</h3>
    <p>This analysis uses the <strong>complete SHAPE 2.1 reference geometry library</strong> with ${totalAvailableGeometries} geometries across all coordination numbers (CN=2-12).</p>
    <p>For CN=${currentCoordAtoms.length}, ${cnGeometries} reference geometries were analyzed.</p>
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

  <h2>🎨 3D Visualization Snapshot</h2>
  <img src="${imgData}" alt="3D rendering of the coordination complex">

  <h2>📋 Geometry Analysis Results</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Geometry</th>
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
  <p>Report generated by <strong>Q-Shape (Quantitative Shape Analyzer)</strong></p>
  <p style="margin-top: 1rem;">Complete SHAPE 2.1 coverage with ${totalAvailableGeometries} reference geometries • Improved Kabsch alignment with Jacobi SVD • Optimized Hungarian algorithm</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">For citation: Llunell, M.; Casanova, D.; Cirera, J.; Alemany, P.; Alvarez, S. SHAPE, version 2.1; Universitat de Barcelona: Barcelona, Spain, 2013.</p>

  <div class="university-section">
    <img src="https://raw.githubusercontent.com/HenriqueCSJ/NomenclaturaQuimica/refs/heads/main/UFRRJ.png" alt="UFRRJ Logo">
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
    }, [atoms, selectedMetal, bestGeometry, fileName, analysisParams, coordRadius, coordAtoms, geometryResults, additionalMetrics, qualityMetrics, warnings]);

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
        <p style={{fontStyle: 'italic'}}>
            Cite this: Junior, H. C. S. Q-Shape (Quantitative Shape Analyzer). 2025.
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
                placeholder="Target CN (2-24)"
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
                    onClick={() => setAnalysisParams({ mode: 'intensive', key: Date.now() })} 
                    disabled={isLoading} 
                    style={{ 
                        padding: '1rem 2rem', 
                        background: isLoading ? '#d1d5db' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 700, 
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        boxShadow: isLoading ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.4)',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    {isLoading && analysisParams.mode === 'intensive' ? '⚡ Running...' : '⚡ Intensive Analysis'}
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
                                <strong style={{ 
                                    fontSize: '0.95rem', 
                                    color: i === 0 ? '#15803d' : '#1e293b',
                                    flex: 1
                                }}>
                                    {i + 1}. {r.name}
                                </strong>
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
          <img src="https://raw.githubusercontent.com/HenriqueCSJ/NomenclaturaQuimica/refs/heads/main/UFRRJ.png" alt="UFRRJ Logo" style={{ width: 80, height: 80 }} />
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


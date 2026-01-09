/**
 * Report Generation Services
 *
 * Handles PDF (HTML) and CSV report generation for Q-Shape analysis results.
 * Extracted from App.js to improve maintainability and separation of concerns.
 */

import { REFERENCE_GEOMETRIES, POINT_GROUPS } from '../constants/referenceGeometries';
import { interpretShapeMeasure } from '../utils/geometry';

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generate PDF report (opens in new window)
 *
 * @param {Object} params - Report generation parameters
 * @param {Array} params.atoms - All atoms in structure
 * @param {number} params.selectedMetal - Index of metal center
 * @param {Object} params.bestGeometry - Best geometry match
 * @param {Array} params.coordAtoms - Coordinating atoms
 * @param {number} params.coordRadius - Coordination radius
 * @param {Array} params.geometryResults - All geometry analysis results
 * @param {Object} params.additionalMetrics - Bond statistics
 * @param {Object} params.qualityMetrics - Quality metrics
 * @param {Array} params.warnings - Analysis warnings
 * @param {string} params.fileName - Structure file name
 * @param {string} params.analysisMode - 'default' or 'intensive'
 * @param {Object} params.intensiveMetadata - Intensive analysis metadata
 * @param {string} params.imgData - Base64 encoded 3D visualization image
 * @param {string} params.structureName - Name of the structure (for multi-structure files)
 * @param {string} params.fileFormat - File format ('xyz' or 'cif')
 * @returns {void} Opens report in new window
 */
export function generatePDFReport({
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
    analysisMode,
    intensiveMetadata,
    imgData,
    structureName = null,
    fileFormat = 'xyz'
}) {
    if (!atoms.length || selectedMetal == null || !bestGeometry) {
        throw new Error('Missing required data for report generation');
    }

    const metal = atoms[selectedMetal];
    const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
    const { name, shapeMeasure } = bestGeometry;
    const interpretation = interpretShapeMeasure(shapeMeasure);

    const totalAvailableGeometries = Object.values(REFERENCE_GEOMETRIES).reduce(
        (sum, geoms) => sum + Object.keys(geoms).length,
        0
    );
    const cnGeometries = coordAtoms.length > 0
        ? Object.keys(REFERENCE_GEOMETRIES[coordAtoms.length] || {}).length
        : 0;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Q-Shape Report: ${escapeHtml(fileName)}</title>
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
  <p><strong>File:</strong> ${escapeHtml(fileName)}.${fileFormat}</p>
  ${structureName ? `<p><strong>Structure:</strong> ${escapeHtml(structureName)}</p>` : ''}
  <p><strong>Generated on:</strong> ${date}</p>
  <p><strong>Analysis Mode:</strong> ${analysisMode === 'intensive' ? 'Intensive (High Precision) with Kabsch Alignment' : 'Standard with Improved Kabsch Alignment'}</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
    Cite this: Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.5.0). Zenodo.
    <a href="https://doi.org/10.5281/zenodo.17717110" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17717110</a>
  </p>
</header>

<main>
  <div class="info-box">
    <h3>🔬 Q-Shape Analysis Overview</h3>
    <p><strong>Q-Shape (Quantitative Shape Analyzer)</strong> provides advanced coordination geometry analysis using Continuous Shape Measures (CShM) methodology.</p>
    <p>This report analyzes your structure against <strong>${totalAvailableGeometries} reference geometries</strong> across all coordination numbers (CN=2-60).</p>
    <p>For CN=${coordAtoms.length}, ${cnGeometries} reference geometries were evaluated using optimized Kabsch alignment and Hungarian algorithm.</p>
  </div>

  <h2>📊 Analysis Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <strong>Metal Center</strong>
      <span>${metal.element} (#${selectedMetal + 1})</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Number</strong>
      <span>${coordAtoms.length}</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Radius</strong>
      <span>${coordRadius.toFixed(3)} Å</span>
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

  ${qualityMetrics ? `
  <h2>🎯 Quality Metrics</h2>
  <div class="quality-score" style="background: linear-gradient(135deg, ${qualityMetrics.overallQualityScore > 80 ? '#d1fae5' : qualityMetrics.overallQualityScore > 60 ? '#fef3c7' : '#fee2e2'}, transparent); color: ${qualityMetrics.overallQualityScore > 80 ? '#059669' : qualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626'};">
    Overall Quality Score: ${qualityMetrics.overallQualityScore.toFixed(1)}/100
  </div>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Angular Distortion Index</div>
      <div class="metric-value">${qualityMetrics.angularDistortionIndex.toFixed(3)}°</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Lower is better (ideal = 0)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Uniformity</div>
      <div class="metric-value">${qualityMetrics.bondLengthUniformityIndex.toFixed(1)}%</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Higher is better (ideal = 100)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Shape Deviation Parameter</div>
      <div class="metric-value">${qualityMetrics.shapeDeviationParameter.toFixed(4)}</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Normalized distortion measure</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">RMSD</div>
      <div class="metric-value">${qualityMetrics.rmsd.toFixed(4)} Å</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Root mean square deviation</div>
    </div>
  </div>
  ` : ''}

  ${additionalMetrics ? `
  <h2>📈 Bond Statistics</h2>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Mean Bond Length</div>
      <div class="metric-value">${additionalMetrics.meanBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Std Dev Bond Length</div>
      <div class="metric-value">${additionalMetrics.stdDevBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Range</div>
      <div class="metric-value">${additionalMetrics.minBondLength.toFixed(3)} - ${additionalMetrics.maxBondLength.toFixed(3)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Mean L-M-L Angle</div>
      <div class="metric-value">${additionalMetrics.angleStats.mean.toFixed(2)}° ± ${additionalMetrics.angleStats.stdDev.toFixed(2)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Angle Range</div>
      <div class="metric-value">${additionalMetrics.angleStats.min.toFixed(1)}° - ${additionalMetrics.angleStats.max.toFixed(1)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Number of L-M-L Angles</div>
      <div class="metric-value">${additionalMetrics.angleStats.count}</div>
    </div>
  </div>
  ` : ''}

  ${intensiveMetadata && intensiveMetadata.metadata && intensiveMetadata.ligandGroups ? `
  <h2>🔬 Pattern-Based Intensive Analysis</h2>
  <div class="info-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #10b981;">
    <h3 style="margin-top: 0; color: #15803d;">Detected Structural Pattern</h3>

    ${intensiveMetadata.metadata.patternDetected ? `
    <div style="padding: 1rem; background: white; border-radius: 8px; margin: 1rem 0;">
      <p style="margin: 0.5rem 0;"><strong>Pattern:</strong> <span style="text-transform: capitalize;">${intensiveMetadata.metadata.patternDetected.replace('_', ' ')}</span></p>
      <p style="margin: 0.5rem 0;"><strong>Confidence:</strong> ${Math.round(intensiveMetadata.metadata.patternConfidence * 100)}%</p>
      <p style="margin: 0.5rem 0;"><strong>Coordination Number:</strong> ${intensiveMetadata.metadata.coordinationNumber}</p>
    </div>
    ` : ''}

    <h4>Ligand Groups Analysis</h4>
    <p><strong>${intensiveMetadata.ligandGroups.summary}</strong></p>

    ${intensiveMetadata.ligandGroups.rings && intensiveMetadata.ligandGroups.rings.length > 0 ? `
    <div style="margin-top: 1rem;">
      <p style="font-weight: 600; color: #15803d;">Detected Rings:</p>
      <ul style="list-style: none; padding-left: 1rem;">
        ${intensiveMetadata.ligandGroups.rings.map((ring, i) => `
        <li style="margin: 0.5rem 0;">
          <strong>Ring ${i + 1}:</strong> ${ring.hapticity || 'Unknown'} (${ring.size} atoms, ${ring.distanceToMetal ? ring.distanceToMetal.toFixed(3) + ' Å from metal' : ''})
        </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${intensiveMetadata.ligandGroups.hasSandwichStructure ? `
    <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-weight: 700; color: #1e40af;">🥪 Sandwich Structure Detected</p>
      <p style="margin: 0.5rem 0 0; color: #1e3a8a; font-size: 0.9rem;">
        This complex features parallel π-coordinated rings characteristic of sandwich compounds like ferrocene.
        The intensive analysis treats ring centroids as coordination sites for accurate geometry determination.
      </p>
    </div>
    ` : ''}

    ${intensiveMetadata.metadata.bestGeometry ? `
    <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
      <p style="margin: 0;"><strong>Best Geometry:</strong> ${intensiveMetadata.metadata.bestGeometry}</p>
      <p style="margin: 0.5rem 0 0;"><strong>CShM Value:</strong> ${intensiveMetadata.metadata.bestCShM ? intensiveMetadata.metadata.bestCShM.toFixed(4) : 'N/A'}</p>
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
      ${geometryResults.map((r, i) => `
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
      ${coordAtoms.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.atom.element}</strong></td>
        <td style="font-family: monospace;">${c.distance.toFixed(4)}</td>
        <td style="font-family: monospace; font-size: 0.9em;">${c.atom.x.toFixed(4)}, ${c.atom.y.toFixed(4)}, ${c.atom.z.toFixed(4)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  ${warnings.length > 0 ? `
  <div class="warning-box">
    <h3>⚠️ Warnings</h3>
    <ul>
      ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
</main>

<footer>
  <p>Report generated by <strong>Q-Shape (Quantitative Shape Analyzer) v1.5.0</strong></p>
  <p style="margin-top: 1rem;">Comprehensive analysis with ${totalAvailableGeometries} reference geometries • Optimized Kabsch alignment with Jacobi SVD • Enhanced Hungarian algorithm</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">
    Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer (v1.5.0). Zenodo.
    <a href="https://doi.org/10.5281/zenodo.17717110" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17717110</a>
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
</html>`;

    const reportWindow = window.open("", "_blank");
    if (reportWindow) {
        reportWindow.document.write(html);
        reportWindow.document.close();
    } else {
        throw new Error("Popup blocked. Please allow popups for this site to view the report.");
    }
}

/**
 * Generate CSV export file
 *
 * @param {Object} params - CSV generation parameters
 * @param {Array} params.geometryResults - All geometry analysis results
 * @param {string} params.fileName - Structure file name
 * @param {string} params.structureName - Name of the structure (for multi-structure files)
 * @returns {void} Downloads CSV file
 */
export function generateCSVReport({ geometryResults, fileName, structureName = null }) {
    if (!geometryResults || geometryResults.length === 0) {
        throw new Error('No geometry results available for CSV export');
    }

    // CSV Header - include Structure column if structure name is provided
    const headers = structureName
        ? ['Structure', 'Rank', 'Geometry', 'Point Group', 'CShM', 'Interpretation', 'Confidence %']
        : ['Rank', 'Geometry', 'Point Group', 'CShM', 'Interpretation', 'Confidence %'];

    // CSV Rows
    const rows = geometryResults.map((result, index) => {
        const interpretation = interpretShapeMeasure(result.shapeMeasure);
        const pointGroup = POINT_GROUPS[result.name] || '';

        const baseRow = [
            index + 1,
            `"${result.name}"`, // Quote to handle commas in names
            pointGroup,
            result.shapeMeasure.toFixed(4),
            `"${interpretation.text}"`,
            interpretation.confidence
        ];

        // Add structure name as first column if provided
        return structureName
            ? [`"${structureName}"`, ...baseRow]
            : baseRow;
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
    // Sanitize filename for download (remove potentially dangerous characters)
    const baseName = structureName || fileName || 'shape-analysis';
    const safeFileName = baseName.replace(/[<>:"/\\|?*]/g, '_');
    link.setAttribute('download', `${safeFileName}_results.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Generate batch PDF report for multiple structures
 *
 * @param {Object} params - Batch report generation parameters
 * @param {Array} params.batchResults - Array of analysis results for each structure
 * @param {string} params.fileName - Source file name(s)
 * @returns {void} Opens report in new window
 */
export function generateBatchPDFReport({ batchResults, fileName }) {
    if (!batchResults || batchResults.length === 0) {
        throw new Error('No batch results available for report generation');
    }

    const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
    const successfulResults = batchResults.filter(r => !r.error && r.bestGeometry);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Q-Shape Batch Report: ${escapeHtml(fileName)}</title>
<style>
@media print {
  body { margin: 0; padding: 20px; background: white !important; }
  .no-print { display: none; }
  @page { size: A4; margin: 15mm; }
  .structure-details { page-break-inside: avoid; }
}

* { box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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

h1 { margin: 0; color: #312e81; font-size: 2rem; font-weight: 800; }
h2 { color: #312e81; font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; }
h3 { color: #1e293b; font-size: 1.1rem; font-weight: 700; margin: 1rem 0 0.5rem; }

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
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-box {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-value { font-size: 2.5rem; font-weight: 800; }
.stat-label { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin: 1rem 0;
}

th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
th { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: white; font-weight: 600; font-size: 0.9em; }
tbody tr:nth-child(even) { background: #f9fafb; }
tbody tr:hover { background: #f1f5f9; }

.best-match { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important; font-weight: 700; }
.error-row { background: #fef2f2 !important; }

.structure-details {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  border-left: 4px solid #4f46e5;
}

.structure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

.quality-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

footer {
  margin-top: 3rem;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  text-align: center;
  color: #64748b;
  font-size: 0.9em;
}
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 2rem;">
  <button class="download-btn" onclick="window.print()">📄 Download as PDF</button>
</div>

<header>
  <h1>🔬 Q-Shape Batch Analysis Report</h1>
  <p style="margin: 0.5rem 0;"><strong>File(s):</strong> ${escapeHtml(fileName)}</p>
  <p style="margin: 0.5rem 0;"><strong>Generated:</strong> ${date}</p>
  <p style="margin: 0.5rem 0;"><strong>Structures Analyzed:</strong> ${batchResults.length}</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
    Cite: Castro Silva Junior, H. (2025). Q-Shape v1.5.0. Zenodo.
    <a href="https://doi.org/10.5281/zenodo.17717110" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17717110</a>
  </p>
</header>

<main>
  <h2>📊 Summary Statistics</h2>
  <div class="summary-stats">
    <div class="stat-box">
      <div class="stat-value" style="color: #059669;">${successfulResults.length}</div>
      <div class="stat-label">Successfully Analyzed</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #dc2626;">${batchResults.filter(r => r.error).length}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #4f46e5;">${batchResults.length}</div>
      <div class="stat-label">Total Structures</div>
    </div>
    ${successfulResults.length > 0 ? `
    <div class="stat-box">
      <div class="stat-value" style="color: #7c3aed;">${(successfulResults.reduce((sum, r) => sum + (r.bestCShM || 0), 0) / successfulResults.length).toFixed(3)}</div>
      <div class="stat-label">Avg. Best CShM</div>
    </div>
    ` : ''}
  </div>

  <h2>📋 Summary Table</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Structure</th>
        <th>Metal</th>
        <th style="text-align: center;">CN</th>
        <th>Best Geometry</th>
        <th style="text-align: right;">CShM</th>
        <th style="text-align: center;">Quality</th>
      </tr>
    </thead>
    <tbody>
      ${batchResults.map((result, index) => {
          const interpretation = result.bestCShM != null ? interpretShapeMeasure(result.bestCShM) : null;
          return `
          <tr class="${result.error ? 'error-row' : index === 0 ? '' : ''}">
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(result.structureName)}</strong></td>
            <td style="font-family: monospace;">${result.error ? '—' : `${result.metalElement} #${result.metalIndex + 1}`}</td>
            <td style="text-align: center; font-weight: 600;">${result.error ? '—' : result.coordinationNumber}</td>
            <td>${result.error ? `<span style="color: #dc2626;">⚠️ ${escapeHtml(result.error)}</span>` : `<strong>${result.bestGeometry}</strong> <span style="color: #6366f1; font-family: monospace;">${POINT_GROUPS[result.bestGeometry] || ''}</span>`}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700; color: ${interpretation?.color || '#64748b'};">${result.bestCShM != null ? result.bestCShM.toFixed(4) : '—'}</td>
            <td style="text-align: center;">${interpretation ? `<span class="quality-badge" style="background: ${interpretation.confidence > 80 ? '#d1fae5' : interpretation.confidence > 50 ? '#fef3c7' : '#fee2e2'}; color: ${interpretation.confidence > 80 ? '#059669' : interpretation.confidence > 50 ? '#d97706' : '#dc2626'};">${interpretation.text}</span>` : '—'}</td>
          </tr>
          `;
      }).join('')}
    </tbody>
  </table>

  <h2>📈 Detailed Results</h2>
  ${successfulResults.map((result, index) => {
      const interpretation = interpretShapeMeasure(result.bestCShM);
      return `
      <div class="structure-details">
        <div class="structure-header">
          <div>
            <h3 style="margin: 0;">${index + 1}. ${escapeHtml(result.structureName)}</h3>
            <span style="color: #64748b; font-size: 0.9rem;">
              ${result.metalElement} center • CN=${result.coordinationNumber} • Radius: ${result.radius.toFixed(3)} Å
            </span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: 800; color: ${interpretation.color};">${result.bestCShM.toFixed(4)}</div>
            <span class="quality-badge" style="background: ${interpretation.confidence > 80 ? '#d1fae5' : interpretation.confidence > 50 ? '#fef3c7' : '#fee2e2'}; color: ${interpretation.confidence > 80 ? '#059669' : interpretation.confidence > 50 ? '#d97706' : '#dc2626'};">${interpretation.text}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Geometry</th>
              <th>Point Group</th>
              <th style="text-align: right;">CShM</th>
              <th style="text-align: center;">Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${result.geometryResults.slice(0, 10).map((geom, gIdx) => {
                const geomInterp = interpretShapeMeasure(geom.shapeMeasure);
                return `
                <tr class="${gIdx === 0 ? 'best-match' : ''}">
                  <td>${gIdx + 1}</td>
                  <td><strong>${geom.name}</strong></td>
                  <td style="font-family: monospace; color: #6366f1;">${POINT_GROUPS[geom.name] || '—'}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 600; color: ${geomInterp.color};">${geom.shapeMeasure.toFixed(4)}</td>
                  <td style="text-align: center; font-weight: 600;">${geomInterp.confidence}%</td>
                </tr>
                `;
            }).join('')}
          </tbody>
        </table>
        ${result.geometryResults.length > 10 ? `<p style="color: #64748b; font-size: 0.85rem; font-style: italic;">+ ${result.geometryResults.length - 10} more geometries</p>` : ''}
      </div>
      `;
  }).join('')}
</main>

<footer>
  <p>Report generated by <strong>Q-Shape v1.5.0</strong></p>
  <p style="margin-top: 0.5rem;">Castro Silva Junior, H. (2025). Q-Shape - Quantitative Shape Analyzer. Zenodo. <a href="https://doi.org/10.5281/zenodo.17717110" style="color: #4f46e5;">https://doi.org/10.5281/zenodo.17717110</a></p>
  <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
    <p style="font-weight: bold; color: #1e293b;">Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
    <p>Departamento de Química Fundamental • Prof. Dr. Henrique C. S. Junior</p>
  </div>
</footer>
</body>
</html>`;

    const reportWindow = window.open("", "_blank");
    if (reportWindow) {
        reportWindow.document.write(html);
        reportWindow.document.close();
    } else {
        throw new Error("Popup blocked. Please allow popups for this site.");
    }
}

/**
 * Generate batch CSV report for multiple structures
 *
 * @param {Object} params - Batch CSV generation parameters
 * @param {Array} params.batchResults - Array of analysis results for each structure
 * @param {string} params.fileName - Source file name(s)
 * @returns {void} Downloads CSV file
 */
export function generateBatchCSVReport({ batchResults, fileName }) {
    if (!batchResults || batchResults.length === 0) {
        throw new Error('No batch results available for CSV export');
    }

    // CSV Header
    const headers = ['Structure', 'Metal', 'Metal Index', 'CN', 'Radius (Å)', 'Best Geometry', 'Point Group', 'Best CShM', 'Quality', 'Confidence %', 'Error'];

    // CSV Rows - one row per structure with best result
    const summaryRows = batchResults.map(result => {
        if (result.error) {
            return [
                `"${result.structureName}"`,
                '—',
                '—',
                '—',
                '—',
                '—',
                '—',
                '—',
                '—',
                '—',
                `"${result.error}"`
            ];
        }

        const interpretation = interpretShapeMeasure(result.bestCShM);
        return [
            `"${result.structureName}"`,
            result.metalElement,
            result.metalIndex + 1,
            result.coordinationNumber,
            result.radius.toFixed(4),
            `"${result.bestGeometry}"`,
            POINT_GROUPS[result.bestGeometry] || '',
            result.bestCShM.toFixed(4),
            `"${interpretation.text}"`,
            interpretation.confidence,
            ''
        ];
    });

    // Detailed rows - all geometry results for each structure
    const detailHeaders = ['Structure', 'Rank', 'Geometry', 'Point Group', 'CShM', 'Interpretation', 'Confidence %'];

    const detailRows = [];
    batchResults.forEach(result => {
        if (!result.error && result.geometryResults) {
            result.geometryResults.forEach((geom, index) => {
                const interp = interpretShapeMeasure(geom.shapeMeasure);
                detailRows.push([
                    `"${result.structureName}"`,
                    index + 1,
                    `"${geom.name}"`,
                    POINT_GROUPS[geom.name] || '',
                    geom.shapeMeasure.toFixed(4),
                    `"${interp.text}"`,
                    interp.confidence
                ]);
            });
        }
    });

    // Combine into CSV string with two sections
    const csvContent = [
        '# SUMMARY - Best match for each structure',
        headers.join(','),
        ...summaryRows.map(row => row.join(',')),
        '',
        '# DETAILED - All geometry results',
        detailHeaders.join(','),
        ...detailRows.map(row => row.join(','))
    ].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    const safeFileName = (fileName || 'batch-analysis').replace(/[<>:"/\\|?*]/g, '_');
    link.setAttribute('download', `${safeFileName}_batch_results.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

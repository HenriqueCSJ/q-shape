/**
 * Report Generation Services
 *
 * Handles print-ready HTML and CSV report generation for Q-Shape analysis results.
 * Extracted from App.js to improve maintainability and separation of concerns.
 */

import { REFERENCE_GEOMETRIES, POINT_GROUPS } from '../constants/referenceGeometries';
import { formatShapeMeasure } from '../utils/geometry';
import {
    isShapeResultAvailable,
    shapeResultDetail,
    shapeResultStatusLabel
} from '../utils/shapeResults';
import {
    batchResultDetail,
    batchResultStatusLabel
} from '../utils/batchResults';
import { calculateAdditionalMetrics } from './shapeAnalysis/structuralMetrics';
import { APP_VERSION, APP_BUILD_SHA, APP_FULL_NAME, getCitationString, CITATION } from '../constants/appMetadata';

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(value) {
    const text = value == null ? '' : String(value);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeRasterDataUrl(value) {
    const text = value == null ? '' : String(value);
    return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(text)
        ? text
        : '';
}

function safeFileFormat(value) {
    const normalized = String(value || '').toLowerCase();
    return normalized === 'xyz' || normalized === 'cif' ? normalized : 'unknown';
}

function csvField(value) {
    const text = value == null ? '' : String(value);
    const spreadsheetSafe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

/**
 * Generate a print-ready report (opens in a new window)
 *
 * @param {Object} params - Report generation parameters
 * @param {Array} params.atoms - All atoms in structure
 * @param {number} params.selectedMetal - Index of metal center
 * @param {Object} params.bestGeometry - Best geometry match
 * @param {Array} params.coordAtoms - Coordinating atoms
 * @param {number} params.coordRadius - Coordination radius
 * @param {Array} params.geometryResults - All geometry analysis results
 * @param {Object} params.additionalMetrics - Bond statistics
 * @param {Array} params.warnings - Analysis warnings
 * @param {string} params.fileName - Source file base name
 * @param {string} params.fileFormat - Source format
 * @param {string} params.structureId - Structure/frame identifier
 * @param {string} params.analysisMode - 'default' or 'intensive'
 * @param {Object} params.intensiveMetadata - Intensive analysis metadata
 * @param {string} params.imgData - Base64 encoded 3D visualization image
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
    warnings,
    fileName,
    fileFormat,
    analysisMode,
    intensiveMetadata,
    imgData,
    structureId
}) {
    if (!atoms.length || selectedMetal == null || !bestGeometry) {
        throw new Error('Missing required data for report generation');
    }

    const metal = atoms[selectedMetal];
    const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
    const { name, shapeMeasure } = bestGeometry;

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
  <button class="download-btn" onclick="window.print()">📄 Print / Save as PDF</button>
</div>

<header>
  <h1>🔬 ${escapeHtml(APP_FULL_NAME)}</h1>
  <p><strong>Coordination Geometry Analysis Report</strong></p>
  <p><strong>Source file:</strong> ${escapeHtml(fileName)}${fileFormat ? `.${safeFileFormat(fileFormat)}` : ''}</p>
  <p><strong>Structure:</strong> ${escapeHtml(structureId || fileName)}</p>
  <p><strong>Generated on:</strong> ${date}</p>
  <p><strong>Source commit:</strong> ${escapeHtml(APP_BUILD_SHA)}</p>
  <p><strong>Analysis Mode:</strong> ${analysisMode === 'intensive' ? 'Extended Search with Kabsch Alignment' : 'Standard Search with Kabsch Alignment'}</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
    Cite this: ${escapeHtml(getCitationString())}
    <a href="${escapeHtml(CITATION.url)}" style="color: #4f46e5;">${escapeHtml(CITATION.url)}</a>
  </p>
</header>

<main>
  <div class="info-box">
    <h3>🔬 Q-Shape Analysis Overview</h3>
    <p><strong>${escapeHtml(APP_FULL_NAME)}</strong> provides advanced coordination geometry analysis using Continuous Shape Measures (CShM) methodology.</p>
    <p>The installed Q-Shape inventory contains <strong>${totalAvailableGeometries} reference geometries</strong> across its supported coordination numbers.</p>
    <p>This analysis evaluated <strong>${cnGeometries} same-CN reference geometries</strong> for CN=${coordAtoms.length} using Kabsch alignment and assignment optimization.</p>
  </div>

  <h2>📊 Analysis Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <strong>Metal Center</strong>
      <span>${escapeHtml(metal.element)} (#${selectedMetal + 1})</span>
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
      <span>${escapeHtml(name)}</span>
    </div>
    <div class="summary-item">
      <strong>Point Group</strong>
      <span style="color:#6366f1; font-family: monospace; font-weight: 600;">${escapeHtml(POINT_GROUPS[name] || '—')}</span>
    </div>
    <div class="summary-item">
      <strong>CShM Value</strong>
      <span>${formatShapeMeasure(shapeMeasure)}</span>
    </div>
  </div>

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
    ${additionalMetrics.angleStats?.count > 0 ? `
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
    ` : ''}
  </div>
  ` : ''}

  ${intensiveMetadata && intensiveMetadata.metadata && intensiveMetadata.ligandGroups ? `
  <h2>🔬 Extended-Search Analysis</h2>
  <div class="info-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #10b981;">
    <h3 style="margin-top: 0; color: #15803d;">Heuristic descriptor summary</h3>
    <p><strong>Coordination Number:</strong> ${escapeHtml(intensiveMetadata.metadata.coordinationNumber)}</p>

    <h4>Heuristic Planar-Cycle Summary</h4>
    <p><em>Informational only. These descriptors do not change the coordinating atoms used in the CShM calculation and are not validated chemical hapticity assignments.</em></p>
    <p><strong>${escapeHtml(intensiveMetadata.ligandGroups.summary)}</strong></p>

    ${intensiveMetadata.ligandGroups.rings && intensiveMetadata.ligandGroups.rings.length > 0 ? `
    <div style="margin-top: 1rem;">
      <p style="font-weight: 600; color: #15803d;">Planar-cycle candidates:</p>
      <ul style="list-style: none; padding-left: 1rem;">
        ${intensiveMetadata.ligandGroups.rings.map((ring, i) => `
        <li style="margin: 0.5rem 0;">
          <strong>Candidate ${i + 1}:</strong> ${escapeHtml(ring.ringSizeLabel || `${ring.size}-membered cycle candidate`)} (${escapeHtml(ring.size)} atoms, ${ring.distanceToMetal ? ring.distanceToMetal.toFixed(3) + ' Å from metal' : ''})
        </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${intensiveMetadata.ligandGroups.hasMultipleLargeRings ? `
    <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-weight: 700; color: #1e40af;">Multiple large planar-cycle candidates</p>
      <p style="margin: 0.5rem 0 0; color: #1e3a8a; font-size: 0.9rem;">
        This size-based annotation does not verify ring parallelism, the position of the metal between rings,
        or chemical hapticity. The CShM calculation uses the individual coordinating atoms selected by the
        coordination radius, not ring centroids.
      </p>
    </div>
    ` : ''}

    ${intensiveMetadata.metadata.bestGeometry ? `
    <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
      <p style="margin: 0;"><strong>Best Geometry:</strong> ${escapeHtml(intensiveMetadata.metadata.bestGeometry)}</p>
      <p style="margin: 0.5rem 0 0;"><strong>CShM Value:</strong> ${formatShapeMeasure(intensiveMetadata.metadata.bestCShM)}</p>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <h2>🎨 3D Visualization Snapshot</h2>
  <img src="${escapeHtml(safeRasterDataUrl(imgData))}" alt="3D rendering of the coordination complex">

  <h2>📋 Geometry Analysis Results</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Geometry</th>
        <th>Point Group</th>
        <th>CShM</th>
        <th>Status</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${geometryResults.map((r, i) => `
      <tr class="${i === 0 && isShapeResultAvailable(r) ? 'best-result' : ''}">
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td style="font-family: monospace; font-weight: 600; color: #6366f1;">${escapeHtml(POINT_GROUPS[r.name] || '—')}</td>
        <td style="font-family: monospace; font-weight: 600;">${formatShapeMeasure(r.shapeMeasure)}</td>
        <td>${escapeHtml(shapeResultStatusLabel(r))}</td>
        <td>${escapeHtml(shapeResultDetail(r))}</td>
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
        <td><strong>${escapeHtml(c.atom.element)}</strong></td>
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
  <p>Report generated by <strong>${escapeHtml(APP_FULL_NAME)} v${escapeHtml(APP_VERSION)}</strong></p>
  <p>Source commit: <strong>${escapeHtml(APP_BUILD_SHA)}</strong></p>
  <p style="margin-top: 1rem;">Same-CN evaluation of ${cnGeometries} reference geometries • Kabsch alignment • Assignment optimization</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">
    ${escapeHtml(getCitationString())}
    <a href="${escapeHtml(CITATION.url)}" style="color: #4f46e5;">${escapeHtml(CITATION.url)}</a>
  </p>
  <p style="margin-top: 0.5rem; font-size: 0.85em; color: #64748b;">
    Based on Continuous Shape Measures methodology: Pinsky & Avnir (1998), Alvarez et al. (2002)
  </p>

  <div class="university-section">
    <img src="${escapeHtml(process.env.PUBLIC_URL || '')}/UFRRJ.png" alt="UFRRJ Logo" onerror="this.style.display='none'">
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
        reportWindow.opener = null;
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
 * @returns {void} Downloads CSV file
 */
export function generateCSVReport({ geometryResults, fileName }) {
    if (!geometryResults || geometryResults.length === 0) {
        throw new Error('No geometry results available for CSV export');
    }

    // CSV Header
    const headers = ['Rank', 'Geometry', 'Point Group', 'CShM', 'Status', 'Details'];

    // CSV Rows
    const rows = geometryResults.map((result, index) => {
        const pointGroup = POINT_GROUPS[result.name] || '';

        return [
            index + 1,
            csvField(result.name),
            pointGroup,
            formatShapeMeasure(result.shapeMeasure),
            shapeResultStatusLabel(result),
            csvField(shapeResultDetail(result))
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
    // Sanitize filename for download (remove potentially dangerous characters)
    const safeFileName = (fileName || 'shape-analysis').replace(/[<>:"/\\|?*]/g, '_');
    link.setAttribute('download', `${safeFileName}_results.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

/**
 * Generate Batch Print Report
 *
 * Creates a comprehensive print-ready HTML report for multiple structures with:
 * - Batch summary table
 * - Per-structure detail sections with full geometry lists
 *
 * @param {Object} params - Report parameters
 * @param {Array} params.structures - Array of Structure objects
 * @param {Map} params.batchResults - Map of structureIndex -> results
 * @param {string} params.fileName - Base filename
 * @param {string} params.fileFormat - File format (xyz/cif)
 */
export function generateBatchPDFReport({ structures, batchResults, fileName, fileFormat }) {
    if (!structures || structures.length === 0) {
        throw new Error('No structures available for batch report');
    }

    if (!batchResults || batchResults.size === 0) {
        throw new Error('No batch results available for report');
    }

    const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
    const processedCount = batchResults.size;

    // Build summary table rows
    const summaryRows = [];
    structures.forEach((structure, index) => {
        const result = batchResults.get(index);
        if (result) {
            const bestGeometry = isShapeResultAvailable(result.bestGeometry)
                ? result.bestGeometry
                : null;
            const status = batchResultStatusLabel(result);
            const details = batchResultDetail(result);
            summaryRows.push(`
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(structure.id)}</strong></td>
                    <td>${escapeHtml(structure.atoms[result.metalIndex]?.element || 'N/A')}</td>
                    <td style="text-align: center;">${escapeHtml(result.coordinationNumber ?? 'N/A')}</td>
                    <td>${bestGeometry ? escapeHtml(bestGeometry.name) : 'N/A'}</td>
                    <td style="font-family: monospace;">${formatShapeMeasure(bestGeometry?.shapeMeasure)}</td>
                    <td>${escapeHtml(status)}</td>
                    <td>${escapeHtml(details || '—')}</td>
                </tr>
            `);
        }
    });

    // Build per-structure detail sections with full metrics
    const detailSections = [];
    structures.forEach((structure, index) => {
        const result = batchResults.get(index);
        if (result && Array.isArray(result.geometryResults)) {
            // Get coordAtoms from the result (stored during batch analysis)
            const coordAtoms = result.coordAtoms || [];
            const structureStatus = batchResultStatusLabel(result);
            const structureDetails = batchResultDetail(result);
            const bestGeometry = isShapeResultAvailable(result.bestGeometry)
                ? result.bestGeometry
                : null;

            // Calculate descriptive structural summaries
            const additionalMetrics = calculateAdditionalMetrics(coordAtoms);

            const geomRows = result.geometryResults.map((r, i) => {
                return `
                    <tr class="${i === 0 && isShapeResultAvailable(r) ? 'best-result' : ''}">
                        <td>${i + 1}</td>
                        <td><strong>${escapeHtml(r.name)}</strong></td>
                        <td style="font-family: monospace;">${escapeHtml(POINT_GROUPS[r.name] || '—')}</td>
                        <td style="font-family: monospace;">${formatShapeMeasure(r.shapeMeasure)}</td>
                        <td>${escapeHtml(shapeResultStatusLabel(r))}</td>
                        <td>${escapeHtml(shapeResultDetail(r))}</td>
                    </tr>
                `;
            }).join('') || `
                <tr>
                    <td>—</td>
                    <td><strong>N/A</strong></td>
                    <td style="font-family: monospace;">—</td>
                    <td style="font-family: monospace;">N/A</td>
                    <td>${escapeHtml(structureStatus)}</td>
                    <td>${escapeHtml(structureDetails)}</td>
                </tr>
            `;

            // Get ligand elements
            const ligandElements = coordAtoms.length > 0
                ? coordAtoms.map(c => c.atom?.element || '?').join(', ')
                : 'N/A';

            // Calculate total available geometries
            const totalAvailableGeometries = Object.values(REFERENCE_GEOMETRIES).reduce(
                (sum, geoms) => sum + Object.keys(geoms).length, 0
            );
            const cnGeometries = coordAtoms.length > 0
                ? Object.keys(REFERENCE_GEOMETRIES[coordAtoms.length] || {}).length
                : 0;

            detailSections.push(`
                <div class="structure-section" style="page-break-before: always; margin-top: 2rem;">
                    <h3 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; font-size: 1.3rem;">
                        📄 Structure: ${escapeHtml(structure.id)}
                    </h3>

                    ${structureStatus === 'Error' ? `
                    <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <p style="margin: 0 0 0.5rem 0;"><strong>Analysis status:</strong> Error</p>
                        <p style="margin: 0;"><strong>Details:</strong> ${escapeHtml(structureDetails)}</p>
                    </div>
                    ` : `
                    <!-- Q-Shape Analysis Info Box -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #93c5fd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <p style="margin: 0 0 0.5rem 0;">The installed Q-Shape inventory contains <strong>${totalAvailableGeometries} reference geometries</strong>.</p>
                        <p style="margin: 0;">This structure was evaluated against <strong>${cnGeometries} same-CN reference geometries</strong> for CN=${coordAtoms.length} using Kabsch alignment and assignment optimization.</p>
                    </div>
                    `}

                    <!-- Analysis Summary -->
                    <div style="background: #f8fafc; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #374151;">📊 Analysis Summary</h4>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <strong>Metal Center</strong>
                                <span>${Number.isInteger(result.metalIndex)
                                    ? `${escapeHtml(structure.atoms[result.metalIndex]?.element || 'N/A')} (#${result.metalIndex + 1})`
                                    : 'N/A'}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Coordination Number</strong>
                                <span>${escapeHtml(result.coordinationNumber || coordAtoms.length || 'N/A')}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Coordination Radius</strong>
                                <span>${result.radius?.toFixed(3) || 'N/A'} Å</span>
                            </div>
                            <div class="summary-item">
                                <strong>Best Match Geometry</strong>
                                <span>${escapeHtml(bestGeometry?.name || 'N/A')}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Point Group</strong>
                                <span>${escapeHtml(POINT_GROUPS[bestGeometry?.name] || '—')}</span>
                            </div>
                            <div class="summary-item">
                                <strong>CShM Value</strong>
                                <span>${formatShapeMeasure(bestGeometry?.shapeMeasure)}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Status</strong>
                                <span>${escapeHtml(structureStatus)}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Details</strong>
                                <span>${escapeHtml(structureDetails || '—')}</span>
                            </div>
                            <div class="summary-item">
                                <strong>Ligands</strong>
                                <span>${escapeHtml(ligandElements)}</span>
                            </div>
                        </div>
                    </div>

                    ${additionalMetrics && additionalMetrics.meanBondLength > 0 ? `
                    <!-- Bond Statistics -->
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #374151;">📈 Bond Statistics</h4>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <strong>Mean Bond Length</strong>
                                <span>${additionalMetrics.meanBondLength.toFixed(4)} Å</span>
                            </div>
                            <div class="summary-item">
                                <strong>Std Dev Bond Length</strong>
                                <span>${additionalMetrics.stdDevBondLength.toFixed(4)} Å</span>
                            </div>
                            <div class="summary-item">
                                <strong>Bond Length Range</strong>
                                <span>${additionalMetrics.minBondLength.toFixed(3)} - ${additionalMetrics.maxBondLength.toFixed(3)} Å</span>
                            </div>
                            ${additionalMetrics.angleStats && additionalMetrics.angleStats.count > 0 ? `
                            <div class="summary-item">
                                <strong>Mean L-M-L Angle</strong>
                                <span>${additionalMetrics.angleStats.mean.toFixed(2)}° ± ${additionalMetrics.angleStats.stdDev.toFixed(2)}°</span>
                            </div>
                            <div class="summary-item">
                                <strong>Angle Range</strong>
                                <span>${additionalMetrics.angleStats.min.toFixed(1)}° - ${additionalMetrics.angleStats.max.toFixed(1)}°</span>
                            </div>
                            <div class="summary-item">
                                <strong>Number of L-M-L Angles</strong>
                                <span>${additionalMetrics.angleStats.count}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    ${result.ligandGroups && (result.ligandGroups.ringCount > 0 || result.ligandGroups.hasMultipleLargeRings) ? `
                    <!-- Ligand Groups Analysis -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #1e40af;">🔬 Heuristic Planar-Cycle Summary</h4>
                        <p style="margin: 0 0 0.5rem 0;"><em>Informational only; not a validated chemical hapticity or sandwich assignment.</em></p>
                        <p style="margin: 0 0 0.5rem 0;"><strong>${escapeHtml(result.ligandGroups.summary)}</strong></p>
                        ${result.ligandGroups.rings && result.ligandGroups.rings.length > 0 ? `
                        <div style="margin-top: 0.5rem;">
                            <p style="font-weight: 600; color: #1e40af; margin: 0 0 0.25rem 0;">Planar-cycle candidates:</p>
                            <ul style="list-style: none; padding-left: 1rem; margin: 0;">
                                ${result.ligandGroups.rings.map((ring, i) => `
                                <li style="margin: 0.25rem 0;">
                                    <strong>Candidate ${i + 1}:</strong> ${escapeHtml(ring.ringSizeLabel || `${ring.size}-membered cycle candidate`)} (${escapeHtml(ring.size)} atoms${ring.distanceToMetal ? ', ' + ring.distanceToMetal.toFixed(3) + ' Å from metal' : ''})
                                </li>
                                `).join('')}
                            </ul>
                        </div>
                        ` : ''}
                        ${result.ligandGroups.hasMultipleLargeRings ? `
                        <div style="margin-top: 0.5rem; padding: 0.5rem; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 6px; border-left: 3px solid #10b981;">
                            <p style="margin: 0; font-weight: 700; color: #15803d;">Multiple large planar-cycle candidates; sandwich topology not verified</p>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    ${coordAtoms.length > 0 ? `
                    <!-- Coordinating Atoms Table -->
                    <h4 style="margin: 1rem 0 0.5rem 0; color: #374151;">🔗 Coordinating Atoms</h4>
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
                                <td><strong>${escapeHtml(c.atom?.element || '?')}</strong></td>
                                <td style="font-family: monospace;">${c.distance?.toFixed(4) || 'N/A'}</td>
                                <td style="font-family: monospace; font-size: 0.9em;">${c.atom?.x?.toFixed(4) || '?'}, ${c.atom?.y?.toFixed(4) || '?'}, ${c.atom?.z?.toFixed(4) || '?'}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : ''}

                    <!-- All Geometries Table -->
                    <h4 style="margin: 1rem 0 0.5rem 0; color: #374151;">📋 All Geometry Comparisons</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Geometry</th>
                                <th>Point Group</th>
                                <th>CShM</th>
                                <th>Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${geomRows}
                        </tbody>
                    </table>
                </div>
            `);
        }
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Q-Shape Batch Report: ${escapeHtml(fileName)}</title>
<style>
${getBatchReportStyles()}
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 2rem;">
  <button class="download-btn" onclick="window.print()">📄 Print / Save as PDF</button>
</div>

<header>
  <h1>🔬 Q-Shape Batch Analysis Report</h1>
  <p><strong>Coordination Geometry Analysis - Multi-Structure Report</strong></p>
  <p><strong>File:</strong> ${escapeHtml(fileName)}.${safeFileFormat(fileFormat)}</p>
  <p><strong>Generated:</strong> ${date}</p>
  <p><strong>Source commit:</strong> ${escapeHtml(APP_BUILD_SHA)}</p>
  <p><strong>Structures Processed:</strong> ${processedCount} of ${structures.length}</p>
  <p><strong>Analysis Mode:</strong> Extended Search with Kabsch Alignment</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
    Cite this: ${escapeHtml(getCitationString())}
    <a href="${escapeHtml(CITATION.url)}" style="color: #4f46e5;">${escapeHtml(CITATION.url)}</a>
  </p>
</header>

<main>
  <h2>📊 Batch Summary</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Structure ID</th>
        <th>Metal</th>
        <th>CN</th>
        <th>Best Geometry</th>
        <th>CShM</th>
        <th>Status</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows.join('')}
    </tbody>
  </table>

  <h2 style="margin-top: 3rem;">📋 Detailed Results by Structure</h2>
  ${detailSections.join('')}
</main>

<footer>
  <p>Report generated by <strong>${escapeHtml(APP_FULL_NAME)} v${escapeHtml(APP_VERSION)}</strong></p>
  <p>Source commit: <strong>${escapeHtml(APP_BUILD_SHA)}</strong></p>
  <p style="margin-top: 1rem;">Same-CN CShM evaluations • Kabsch alignment • Assignment optimization</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">
    ${escapeHtml(getCitationString())}
    <a href="${escapeHtml(CITATION.url)}" style="color: #4f46e5;">${escapeHtml(CITATION.url)}</a>
  </p>
  <p style="margin-top: 0.5rem; font-size: 0.85em; color: #64748b;">
    Based on Continuous Shape Measures methodology: Pinsky & Avnir (1998), Alvarez et al. (2002)
  </p>

  <div class="university-section" style="display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
    <img src="${escapeHtml(process.env.PUBLIC_URL || '')}/UFRRJ.png" alt="UFRRJ Logo" style="width: 60px; height: 60px;" onerror="this.style.display='none'">
    <div style="text-align: left;">
      <p style="margin: 0.25rem 0; font-weight: bold; color: #1e293b;">Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
      <p style="margin: 0.25rem 0;">Departamento de Química Fundamental</p>
      <p style="margin: 0.25rem 0;">Prof. Dr. Henrique C. S. Junior</p>
    </div>
  </div>
</footer>
</body>
</html>`;

    const reportWindow = window.open("", "_blank");
    if (reportWindow) {
        reportWindow.opener = null;
        reportWindow.document.write(html);
        reportWindow.document.close();
    } else {
        throw new Error("Popup blocked. Please allow popups for this site.");
    }
}

/**
 * Generate Wide Summary CSV
 *
 * Creates a CSV with one row per structure (best match + key metrics)
 *
 * @param {Object} params
 * @param {Array} params.structures
 * @param {Map} params.batchResults
 * @param {string} params.fileName
 */
export function generateWideSummaryCSV({ structures, batchResults, fileName }) {
    if (!structures || !batchResults || batchResults.size === 0) {
        throw new Error('No batch results available for CSV export');
    }

    const headers = [
        'Structure_ID',
        'Metal_Element',
        'Coordination_Number',
        'Radius_Å',
        'Best_Geometry',
        'Point_Group',
        'CShM',
        'Status',
        'Details',
        'Analysis_Mode'
    ];

    const rows = [];
    structures.forEach((structure, index) => {
        const result = batchResults.get(index);
        if (result) {
            const bestGeometry = isShapeResultAvailable(result.bestGeometry)
                ? result.bestGeometry
                : null;
            rows.push([
                csvField(structure.id),
                csvField(structure.atoms[result.metalIndex]?.element || ''),
                result.coordinationNumber ?? '',
                result.radius?.toFixed(3) || '',
                csvField(bestGeometry?.name || 'N/A'),
                csvField(bestGeometry ? POINT_GROUPS[bestGeometry.name] || '' : ''),
                formatShapeMeasure(bestGeometry?.shapeMeasure),
                csvField(batchResultStatusLabel(result)),
                csvField(batchResultDetail(result)),
                csvField(result.analysisMode || 'default')
            ]);
        }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(csvContent, `${fileName}_batch_summary.csv`);
}

/**
 * Generate Long Detailed CSV
 *
 * Creates a CSV with one row per (structure, geometry) pair - all results for all geometries
 *
 * @param {Object} params
 * @param {Array} params.structures
 * @param {Map} params.batchResults
 * @param {string} params.fileName
 */
export function generateLongDetailedCSV({ structures, batchResults, fileName }) {
    if (!structures || !batchResults || batchResults.size === 0) {
        throw new Error('No batch results available for CSV export');
    }

    const headers = [
        'Structure_ID',
        'Metal_Element',
        'Coordination_Number',
        'Geometry_Rank',
        'Geometry_Name',
        'Point_Group',
        'CShM',
        'Status',
        'Details',
        'Is_Best_Match'
    ];

    const rows = [];
    structures.forEach((structure, index) => {
        const result = batchResults.get(index);
        if (result && Array.isArray(result.geometryResults) && result.geometryResults.length > 0) {
            result.geometryResults.forEach((geom, geomIndex) => {
                rows.push([
                    csvField(structure.id),
                    csvField(structure.atoms[result.metalIndex]?.element || ''),
                    result.coordinationNumber ?? '',
                    geomIndex + 1,
                    csvField(geom.name),
                    csvField(POINT_GROUPS[geom.name] || ''),
                    formatShapeMeasure(geom.shapeMeasure),
                    csvField(shapeResultStatusLabel(geom)),
                    csvField(shapeResultDetail(geom)),
                    csvField(geomIndex === 0 && isShapeResultAvailable(geom) ? 'Yes' : 'No')
                ]);
            });
        } else if (result) {
            rows.push([
                csvField(structure.id),
                csvField(structure.atoms[result.metalIndex]?.element || ''),
                result.coordinationNumber ?? '',
                '',
                csvField('N/A'),
                csvField(''),
                'N/A',
                csvField(batchResultStatusLabel(result)),
                csvField(batchResultDetail(result)),
                csvField('No')
            ]);
        }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(csvContent, `${fileName}_all_geometries.csv`);
}

/**
 * Helper: Download CSV content
 */
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename.replace(/[<>:"/\\|?*]/g, '_');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

/**
 * Helper: Get batch report CSS styles
 */
function getBatchReportStyles() {
    return `
@media print {
  body { margin: 0; padding: 20px; background: white !important; }
  .no-print { display: none; }
  @page { size: A4; margin: 15mm; }
}
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  color: #1e293b;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}
header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}
h1 { margin: 0; color: #312e81; font-size: 2rem; }
h2 { color: #312e81; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
h3 { color: #1e293b; }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
}
.summary-item {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border-left: 3px solid #4f46e5;
}
.summary-item strong {
  display: block;
  font-size: 0.75em;
  color: #64748b;
  text-transform: uppercase;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
th { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: white; font-size: 0.85em; }
.best-result { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important; font-weight: 600; }
.download-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #e2e8f0;
  text-align: center;
  color: #64748b;
}
    `;
}

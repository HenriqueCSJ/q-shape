/**
 * @fileoverview Reference Geometries for SHAPE Analysis
 *
 * This module contains reference geometries from SHAPE 2.1 and CoSyMlib used for
 * continuous shape measure calculations in coordination chemistry.
 *
 * The module provides:
 * - normalize(): Helper function to normalize 3D coordinate vectors
 * - REFERENCE_GEOMETRIES: Library of 92 ideal polyhedra:
 *   - 87 geometries for CN 2-12 (SHAPE 2.1)
 *   - 5 high-coordination geometries for CN 20, 24, 48, 60 (CoSyMlib)
 *
 * Each geometry is defined by normalized 3D coordinates representing the ideal
 * vertices of the polyhedron. These reference structures are used to calculate
 * shape deviations for molecular coordination environments.
 *
 * @module constants/referenceGeometries
 * @see {@link http://www.ee.ub.edu/index.php?option=com_content&view=article&id=575:shape-available&catid=80:software&Itemid=466|SHAPE 2.1}
 */

// --- START: COMPLETE SHAPE 2.1 GEOMETRY DEFINITIONS ---

/**
 * Normalizes a 3D vector to unit length
 * @param {number[]} v - A 3D coordinate vector [x, y, z]
 * @returns {number[]} Normalized vector with length 1
 * @deprecated Use normalizeScale for reference geometries to preserve shape
 */
function normalize(v) {
    const len = Math.hypot(...v);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Scale-normalizes a set of coordinates to have unit RMS distance from centroid.
 * This preserves the SHAPE of the polyhedron (relative distances) while
 * normalizing the overall scale.
 *
 * CRITICAL: This is the correct normalization for CShM calculations.
 * Per-vertex normalization (the old `normalize`) destroys shape differences
 * between regular and Johnson polyhedra, causing them to appear identical.
 *
 * NOTE: For CN>=4, this function works correctly because higher CN polyhedra
 * have their centroid at or near the metal position. For CN=3 pyramidal
 * geometries (like vT-3), use normalizeScaleFromOrigin instead.
 *
 * @param {number[][]} coords - Array of 3D coordinate vectors
 * @returns {number[][]} Coordinates centered at origin with unit RMS distance
 */
function normalizeScale(coords) {
    if (!coords || coords.length === 0) return coords;

    const n = coords.length;

    // Compute centroid
    const centroid = [0, 0, 0];
    for (const c of coords) {
        centroid[0] += c[0] / n;
        centroid[1] += c[1] / n;
        centroid[2] += c[2] / n;
    }

    // Center coordinates
    const centered = coords.map(c => [
        c[0] - centroid[0],
        c[1] - centroid[1],
        c[2] - centroid[2]
    ]);

    // Compute RMS distance from centroid (which is now origin)
    let sumSq = 0;
    for (const c of centered) {
        sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
    }
    const rms = Math.sqrt(sumSq / n);

    // Scale to unit RMS (preserves relative distances)
    if (rms === 0) return centered;
    return centered.map(c => [c[0] / rms, c[1] / rms, c[2] / rms]);
}

/**
 * Scale-normalizes coordinates to have unit RMS distance FROM ORIGIN.
 * Unlike normalizeScale, this does NOT center coordinates on ligand centroid.
 *
 * CRITICAL for pyramidal CN=3 geometries:
 * - The metal is at origin
 * - Ligand positions encode angular information relative to the metal
 * - Centering on ligand centroid destroys this angular information
 *
 * For vT-3 (vacant tetrahedron / trigonal pyramid):
 * - L-M-L angle = 109.47° (tetrahedral angle)
 * - Centering would collapse this to 120° (planar)
 *
 * @param {number[][]} coords - Array of 3D coordinate vectors (metal at origin)
 * @returns {number[][]} Coordinates with unit RMS distance from origin
 */
function normalizeScaleFromOrigin(coords) {
    if (!coords || coords.length === 0) return coords;

    const n = coords.length;

    // Compute RMS distance from origin (metal position)
    let sumSq = 0;
    for (const c of coords) {
        sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
    }
    const rms = Math.sqrt(sumSq / n);

    // Scale to unit RMS (preserves angular relationships to metal)
    if (rms === 0) return coords;
    return coords.map(c => [c[0] / rms, c[1] / rms, c[2] / rms]);
}

// CN=2 Geometries (3 total from SHAPE 2.1)
function generateLinear() {
    return [[1, 0, 0], [-1, 0, 0]].map(normalize);
}

function generateVShape() {
    // vT-2: Divacant Tetrahedron (V-shape, 109.47°) - Official CoSyMlib reference (normalized)
    return [
        [0.801784, 0.801784, 0.267261],
        [-0.801784, -0.801784, 0.267261]
    ].map(normalize);
}

function generateLShape() {
    // vOC-2: Tetravacant Octahedron (L-shape, 90°) - Official CoSyMlib reference (normalized)
    return [
        [1.000000, -0.500000, 0.000000],
        [-0.500000, 1.000000, 0.000000]
    ].map(normalize);
}

// CN=3 Geometries (4 total from SHAPE 2.1)
// CRITICAL: CN=3 geometries INCLUDE the central atom (4 points total)
// This is how SHAPE/cosymlib/cshm-cc work - they include the metal in the calculation.
// Including the metal preserves pyramidal character under centroid-based normalization.
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateTrigonalPlanar() {
    // TP-3: Trigonal Planar (D3h) - from cosymlib
    // 3 ligands + central atom at origin
    // Already centered and normalized to unit RMS
    return [
        [1.154700538379, 0.0, 0.0],
        [-0.577350269190, 1.0, 0.0],
        [-0.577350269190, -1.0, 0.0],
        [0.0, 0.0, 0.0]  // central atom
    ];
}

function generatePyramid() {
    // vT-3: Vacant Tetrahedron (Trigonal Pyramid, C3v) - from cosymlib
    // 3 ligands at z=0.1 + central atom at z=-0.302
    // Already centered and normalized to unit RMS
    return [
        [1.137070487230, 0.0, 0.100503781526],
        [-0.568535243615, 0.984731927835, 0.100503781526],
        [-0.568535243615, -0.984731927835, 0.100503781526],
        [0.0, 0.0, -0.301511344578]  // central atom
    ];
}

function generateFacTrivacantOctahedron() {
    // fac-vOC-3: fac-Trivacant Octahedron (C3v) - from cosymlib
    // 3 ligands + central atom
    // Already centered and normalized to unit RMS
    return [
        [1.0, -0.333333333333, -0.333333333333],
        [-0.333333333333, 1.0, -0.333333333333],
        [-0.333333333333, -0.333333333333, 1.0],
        [-0.333333333333, -0.333333333333, -0.333333333333]  // central atom
    ];
}

function generateTShaped() {
    // mer-vOC-3: mer-Trivacant Octahedron (T-shaped, C2v) - from cosymlib
    // 3 ligands + central atom
    // Already centered and normalized to unit RMS
    return [
        [1.206045378311, -0.301511344578, 0.0],
        [0.0, 0.904534033733, 0.0],
        [-1.206045378311, -0.301511344578, 0.0],
        [0.0, -0.301511344578, 0.0]  // central atom
    ];
}

// CN=4 Geometries (4 total from SHAPE 2.1)
// CRITICAL: CN=4 geometries INCLUDE the central atom (5 points total)
// This matches SHAPE/cosymlib/cshm-cc methodology
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateTetrahedral() {
    // T-4: Tetrahedral (Td) - from cosymlib
    // 4 ligands + central atom at origin
    return [
        [0.000000000000, 0.912870929175, -0.645497224368],
        [0.000000000000, -0.912870929175, -0.645497224368],
        [0.912870929175, 0.000000000000, 0.645497224368],
        [-0.912870929175, 0.000000000000, 0.645497224368],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateSquarePlanar() {
    // SP-4: Square Planar (D4h) - from cosymlib
    // 4 ligands + central atom at origin
    return [
        [1.118033988750, 0.000000000000, 0.000000000000],
        [0.000000000000, 1.118033988750, 0.000000000000],
        [-1.118033988750, 0.000000000000, 0.000000000000],
        [0.000000000000, -1.118033988750, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateSeesaw() {
    // SS-4: Seesaw (C2v) - from cosymlib
    // 4 ligands + central atom (NOT at origin for seesaw!)
    return [
        [-0.235702260396, -0.235702260396, -1.178511301978],
        [0.942809041582, -0.235702260396, 0.000000000000],
        [-0.235702260396, 0.942809041582, 0.000000000000],
        [-0.235702260396, -0.235702260396, 1.178511301978],
        [-0.235702260396, -0.235702260396, 0.000000000000]  // central atom
    ];
}

function generateAxialVacantTBPY() {
    // vTBPY-4: Axially Vacant Trigonal Bipyramid (C3v) - from cosymlib
    // 4 ligands + central atom
    return [
        [0.000000000000, 0.000000000000, -0.917662935482],
        [1.147078669353, 0.000000000000, 0.229415733871],
        [-0.573539334676, 0.993399267799, 0.229415733871],
        [-0.573539334676, -0.993399267799, 0.229415733871],
        [0.000000000000, 0.000000000000, 0.229415733871]  // central atom
    ];
}

// CN=5 Geometries (5 total from SHAPE 2.1)
// CRITICAL: CN=5 geometries INCLUDE the central atom (6 points total)
// This is how SHAPE/cosymlib/cshm-cc work - they include the metal in the calculation.
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generatePentagon() {
    // PP-5: Planar pentagon (D5h) - from cosymlib
    // 5 ligands + central atom at origin
    return [
        [1.095445115010, 0.000000000000, 0.000000000000],
        [0.338511156943, 1.041830214874, 0.000000000000],
        [-0.886233714448, 0.643886483299, 0.000000000000],
        [-0.886233714448, -0.643886483299, 0.000000000000],
        [0.338511156943, -1.041830214874, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateSquarePyramid() {
    // vOC-5: Vacant Octahedron (Johnson Square Pyramid J1, C4v) - from cosymlib
    // 5 ligands + central atom (NOT at origin - at basal plane level)
    return [
        [0.000000000000, 0.000000000000, -0.928476690885],
        [1.114172029062, 0.000000000000, 0.185695338177],
        [0.000000000000, 1.114172029062, 0.185695338177],
        [-1.114172029062, 0.000000000000, 0.185695338177],
        [0.000000000000, -1.114172029062, 0.185695338177],
        [0.000000000000, 0.000000000000, 0.185695338177]  // central atom
    ];
}

function generateTrigonalBipyramidal() {
    // TBPY-5: Trigonal Bipyramidal (D3h) - from cosymlib
    // 5 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, -1.095445115010],
        [1.095445115010, 0.000000000000, 0.000000000000],
        [-0.547722557505, 0.948683298051, 0.000000000000],
        [-0.547722557505, -0.948683298051, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.095445115010],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateJohnsonTrigonalBipyramid() {
    // JTBPY-5: Johnson Trigonal Bipyramid (J12, D3h) - from cosymlib
    // CRITICAL: Axial vertices (z=±1.309) are FARTHER than equatorial (r=0.926)
    // 5 ligands + central atom at origin
    return [
        [0.925820099773, 0.000000000000, 0.000000000000],
        [-0.462910049886, 0.801783725737, 0.000000000000],
        [-0.462910049886, -0.801783725737, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.309307341416],
        [0.000000000000, 0.000000000000, -1.309307341416],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateSquarePyramidal() {
    // SPY-5: Square Pyramidal (C4v) - from cosymlib
    // 5 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, 1.095445115010],
        [1.060660171780, 0.000000000000, -0.273861278753],
        [0.000000000000, 1.060660171780, -0.273861278753],
        [-1.060660171780, 0.000000000000, -0.273861278753],
        [0.000000000000, -1.060660171780, -0.273861278753],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

// CN=6 Geometries (5 total from SHAPE 2.1)
// CRITICAL: CN=6 geometries INCLUDE the central atom (7 points total)
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateHexagon() {
    // HP-6: Planar hexagon (D6h) - from cosymlib
    // 6 ligands + central atom at origin
    return [
        [1.080123449735, 0.000000000000, 0.000000000000],
        [0.540061724867, 0.935414346693, 0.000000000000],
        [-0.540061724867, 0.935414346693, 0.000000000000],
        [-1.080123449735, 0.000000000000, 0.000000000000],
        [-0.540061724867, -0.935414346693, 0.000000000000],
        [0.540061724867, -0.935414346693, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generatePentagonalPyramid() {
    // PPY-6: Pentagonal Pyramid (C5v) - from cosymlib
    // 6 ligands + central atom (NOT at origin for pyramid!)
    return [
        [0.000000000000, 0.000000000000, -0.937042571332],
        [1.093216333220, 0.000000000000, 0.156173761889],
        [0.337822425493, 1.039710517429, 0.156173761889],
        [-0.884430592103, 0.642576438232, 0.156173761889],
        [-0.884430592103, -0.642576438232, 0.156173761889],
        [0.337822425493, -1.039710517429, 0.156173761889],
        [0.000000000000, 0.000000000000, 0.156173761889]  // central atom
    ];
}

function generateOctahedral() {
    // OC-6: Octahedral (Oh) - from cosymlib
    // 6 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, -1.080123449735],
        [1.080123449735, 0.000000000000, 0.000000000000],
        [0.000000000000, 1.080123449735, 0.000000000000],
        [-1.080123449735, 0.000000000000, 0.000000000000],
        [0.000000000000, -1.080123449735, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.080123449735],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateTrigonalPrism() {
    // TPR-6: Trigonal Prism (D3h) - from cosymlib
    // 6 ligands + central atom at origin
    return [
        [0.816496580928, 0.000000000000, -0.707106781187],
        [-0.408248290464, 0.707106781187, -0.707106781187],
        [-0.408248290464, -0.707106781187, -0.707106781187],
        [0.816496580928, 0.000000000000, 0.707106781187],
        [-0.408248290464, 0.707106781187, 0.707106781187],
        [-0.408248290464, -0.707106781187, 0.707106781187],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateJohnsonPentagonalPyramid6() {
    // JPPY-6: Johnson Pentagonal Pyramid (J2, C5v) - from cosymlib
    // 6 ligands + central atom (NOT at origin for pyramid!)
    return [
        [1.146281780821, 0.000000000000, 0.101205871605],
        [0.354220550616, 1.090178757161, 0.101205871605],
        [-0.927361441027, 0.673767525738, 0.101205871605],
        [-0.927361441027, -0.673767525738, 0.101205871605],
        [0.354220550616, -1.090178757161, 0.101205871605],
        [0.000000000000, 0.000000000000, -0.607235229628],
        [0.000000000000, 0.000000000000, 0.101205871605]  // central atom
    ];
}

// CN=7 Geometries (7 total from SHAPE 2.1)
// CRITICAL: CN=7 geometries INCLUDE the central atom (8 points total)
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateHeptagon() {
    // HP-7: Planar heptagon (D7h) - from cosymlib
    // 7 ligands + central atom at origin
    return [
        [1.069044967650, 0.000000000000, 0.000000000000],
        [0.666538635058, 0.835813011883, 0.000000000000],
        [-0.237884884643, 1.042241778339, 0.000000000000],
        [-0.963176234240, 0.463841227849, 0.000000000000],
        [-0.963176234240, -0.463841227849, 0.000000000000],
        [-0.237884884643, -1.042241778339, 0.000000000000],
        [0.666538635058, -0.835813011883, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateHexagonalPyramid() {
    // HPY-7: Hexagonal Pyramid (C6v) - from cosymlib
    // 7 ligands + central atom (NOT at origin for pyramid!)
    return [
        [0.000000000000, 0.000000000000, -0.943879807449],
        [1.078719779941, 0.000000000000, 0.134839972493],
        [0.539359889971, 0.934198732994, 0.134839972493],
        [-0.539359889971, 0.934198732994, 0.134839972493],
        [-1.078719779941, 0.000000000000, 0.134839972493],
        [-0.539359889971, -0.934198732994, 0.134839972493],
        [0.539359889971, -0.934198732994, 0.134839972493],
        [0.000000000000, 0.000000000000, 0.134839972493]  // central atom
    ];
}

function generatePentagonalBipyramid() {
    // PBPY-7: Pentagonal Bipyramid (D5h) - from cosymlib
    // 7 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, -1.069044967650],
        [1.069044967650, 0.000000000000, 0.000000000000],
        [0.330353062755, 1.016722182696, 0.000000000000],
        [-0.864875546580, 0.628368866022, 0.000000000000],
        [-0.864875546580, -0.628368866022, 0.000000000000],
        [0.330353062755, -1.016722182696, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.069044967650],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateCappedOctahedron() {
    // COC-7: Capped Octahedron (C3v) - from cosymlib
    // 7 ligands + central atom (NOT at origin!)
    return [
        [0.000000000000, 0.000000000000, 1.128906708829],
        [0.000000000000, -1.046937018035, 0.283078548570],
        [0.906674032650, 0.523468509017, 0.283078548570],
        [-0.906674032650, 0.523468509017, 0.283078548570],
        [0.672964536915, -0.388536257092, -0.678734552207],
        [-0.672964536915, -0.388536257092, -0.678734552207],
        [0.000000000000, 0.777072514184, -0.678734552207],
        [0.000000000000, 0.000000000000, 0.058061302083]  // central atom
    ];
}

function generateCappedTrigonalPrism() {
    // CTPR-7: Capped Trigonal Prism (C2v) - from cosymlib
    // 7 ligands + central atom (NOT at origin!)
    return [
        [0.000000000000, 0.000000000000, 1.020027096827],
        [0.735247575071, 0.735247575071, 0.203750780644],
        [-0.735247575071, 0.735247575071, 0.203750780644],
        [0.735247575071, -0.735247575071, 0.203750780644],
        [-0.735247575071, -0.735247575071, 0.203750780644],
        [0.660960557032, 0.000000000000, -0.892328424325],
        [-0.660960557032, 0.000000000000, -0.892328424325],
        [0.000000000000, 0.000000000000, -0.050373370753]  // central atom
    ];
}

function generateJohnsonPentagonalBipyramid() {
    // JPBPY-7: Johnson Pentagonal Bipyramid (J13, D5h) - from cosymlib
    // 7 ligands + central atom at origin
    return [
        [1.178109256681, 0.000000000000, 0.000000000000],
        [0.364055781545, 1.120448485474, 0.000000000000],
        [-0.953110409886, 0.692475246666, 0.000000000000],
        [-0.953110409886, -0.692475246666, 0.000000000000],
        [0.364055781545, -1.120448485474, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.728111563090],
        [0.000000000000, 0.000000000000, -0.728111563090],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateElongatedTriangularPyramid() {
    // JETPY-7: Elongated Triangular Pyramid (J7, C3v) - from cosymlib
    // 7 ligands + central atom (NOT at origin!)
    return [
        [0.729093431342, 0.000000000000, 0.423600026760],
        [0.729093431342, 0.000000000000, -0.839226839789],
        [-0.364546715671, 0.631413433275, 0.423600026760],
        [-0.364546715671, 0.631413433275, -0.839226839789],
        [-0.364546715671, -0.631413433275, 0.423600026760],
        [-0.364546715671, -0.631413433275, -0.839226839789],
        [0.000000000000, 0.000000000000, 1.454693845602],
        [0.000000000000, 0.000000000000, -0.207813406515]  // central atom
    ];
}

// CN=8 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
// CRITICAL: CN=8 geometries INCLUDE the central atom (9 points total)
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateOctagon() {
    // OP-8: Planar octagon (D8h) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [1.060660171780, 0.000000000000, 0.000000000000],
        [0.750000000000, 0.750000000000, 0.000000000000],
        [0.000000000000, 1.060660171780, 0.000000000000],
        [-0.750000000000, 0.750000000000, 0.000000000000],
        [-1.060660171780, 0.000000000000, 0.000000000000],
        [-0.750000000000, -0.750000000000, 0.000000000000],
        [0.000000000000, -1.060660171780, 0.000000000000],
        [0.750000000000, -0.750000000000, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateHeptagonalPyramid() {
    // HPY-8: Heptagonal Pyramid (C7v) - from cosymlib
    // 8 ligands + central atom (NOT at origin for pyramid!)
    return [
        [0.000000000000, 0.000000000000, -0.949425326555],
        [1.068103492374, 0.000000000000, 0.118678165819],
        [0.665951634825, 0.835076936872, 0.118678165819],
        [-0.237675386685, 1.041323907815, 0.118678165819],
        [-0.962327994327, 0.463432737036, 0.118678165819],
        [-0.962327994327, -0.463432737036, 0.118678165819],
        [-0.237675386685, -1.041323907815, 0.118678165819],
        [0.665951634825, -0.835076936872, 0.118678165819],
        [0.000000000000, 0.000000000000, 0.118678165819]  // central atom
    ];
}

function generateHexagonalBipyramid() {
    // HBPY-8: Hexagonal Bipyramid (D6h) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, -1.060660171780],
        [1.060660171780, 0.000000000000, 0.000000000000],
        [0.530330085890, 0.918558653544, 0.000000000000],
        [-0.530330085890, 0.918558653544, 0.000000000000],
        [-1.060660171780, 0.000000000000, 0.000000000000],
        [-0.530330085890, -0.918558653544, 0.000000000000],
        [0.530330085890, -0.918558653544, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.060660171780],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateCube() {
    // CU-8: Cube (Oh) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.866025403784, 0.000000000000, -0.612372435696],
        [0.000000000000, 0.866025403784, -0.612372435696],
        [-0.866025403784, 0.000000000000, -0.612372435696],
        [0.000000000000, -0.866025403784, -0.612372435696],
        [0.866025403784, 0.000000000000, 0.612372435696],
        [0.000000000000, 0.866025403784, 0.612372435696],
        [-0.866025403784, 0.000000000000, 0.612372435696],
        [0.000000000000, -0.866025403784, 0.612372435696],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateSquareAntiprism() {
    // SAPR-8: Square Antiprism (D4d) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.644649377827, 0.644649377827, -0.542083350910],
        [-0.644649377827, 0.644649377827, -0.542083350910],
        [-0.644649377827, -0.644649377827, -0.542083350910],
        [0.644649377827, -0.644649377827, -0.542083350910],
        [0.911671893098, 0.000000000000, 0.542083350910],
        [0.000000000000, 0.911671893098, 0.542083350910],
        [-0.911671893098, 0.000000000000, 0.542083350910],
        [0.000000000000, -0.911671893098, 0.542083350910],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateTriangularDodecahedron() {
    // TDD-8: Triangular Dodecahedron (D2d) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [-0.636106245143, 0.000000000000, 0.848768388024],
        [-0.000000009579, -0.993210924257, 0.372146720241],
        [0.636106254722, 0.000000000000, 0.848768388024],
        [-0.000000009579, 0.993210924257, 0.372146720241],
        [-0.993210876363, 0.000000000000, -0.372146742591],
        [-0.000000009579, -0.636106206828, -0.848768374454],
        [0.993210914678, 0.000000000000, -0.372146742591],
        [-0.000000009579, 0.636106206828, -0.848768374454],
        [-0.000000009579, 0.000000000000, 0.000000017561]  // central atom
    ];
}

function generateGyrobifastigium() {
    // JGBF-8: Gyrobifastigium (J26, D2d) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.612372435696, 0.000000000000, 1.060660171780],
        [-0.612372435696, 0.000000000000, 1.060660171780],
        [0.612372435696, 0.612372435696, 0.000000000000],
        [0.612372435696, -0.612372435696, 0.000000000000],
        [-0.612372435696, -0.612372435696, 0.000000000000],
        [-0.612372435696, 0.612372435696, 0.000000000000],
        [0.000000000000, 0.612372435696, -1.060660171780],
        [0.000000000000, -0.612372435696, -1.060660171780],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateElongatedTriangularBipyramid() {
    // JETBPY-8: Johnson Elongated Trigonal Bipyramid (J14, D3h) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.656233980527, 0.000000000000, 0.568315297963],
        [0.656233980527, 0.000000000000, -0.568315297963],
        [-0.328116990263, 0.568315297963, 0.568315297963],
        [-0.328116990263, 0.568315297963, -0.568315297963],
        [-0.328116990263, -0.568315297963, 0.568315297963],
        [-0.328116990263, -0.568315297963, -0.568315297963],
        [0.000000000000, 0.000000000000, 1.496370293314],
        [0.000000000000, 0.000000000000, -1.496370293314],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateBiaugmentedTrigonalPrism() {
    // JBTPR-8: Johnson Biaugmented Trigonal Prism (J50, C2v) - from cosymlib
    // 8 ligands + central atom (NOT at origin!)
    return [
        [0.647117793293, 0.000000000000, 0.604029879248],
        [-0.647117793293, 0.000000000000, 0.604029879248],
        [0.647117793293, 0.647117793293, -0.516811012319],
        [-0.647117793293, 0.647117793293, -0.516811012319],
        [0.647117793293, -0.647117793293, -0.516811012319],
        [-0.647117793293, -0.647117793293, -0.516811012319],
        [0.000000000000, 1.116113113681, 0.501190825503],
        [0.000000000000, -1.116113113681, 0.501190825503],
        [0.000000000000, 0.000000000000, -0.143197360226]  // central atom
    ];
}

function generateSphericalBiaugmentedTrigonalPrism() {
    // BTPR-8: Biaugmented Trigonal Prism (C2v) - from cosymlib
    // 8 ligands + central atom (NOT at origin!)
    return [
        [0.699237877649, 0.000000000000, 0.688732178156],
        [-0.699237877649, 0.000000000000, 0.688732178156],
        [0.699237877649, 0.699237877649, -0.522383347216],
        [-0.699237877649, 0.699237877649, -0.522383347216],
        [0.699237877649, -0.699237877649, -0.522383347216],
        [-0.699237877649, -0.699237877649, -0.522383347216],
        [0.000000000000, 0.925004726938, 0.415373590668],
        [0.000000000000, -0.925004726938, 0.415373590668],
        [0.000000000000, 0.000000000000, -0.118678148784]  // central atom
    ];
}

function generateSnubDisphenoid() {
    // JSD-8: Johnson Snub Disphenoid (J84, D2d) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [-0.652225622594, 0.000000000000, -1.022598826988],
        [0.652225622594, 0.000000000000, -1.022598826988],
        [0.840828401428, 0.000000000000, 0.268145244516],
        [-0.840828401428, 0.000000000000, 0.268145244516],
        [0.000000000000, -0.652225622594, 1.022598102293],
        [0.000000000000, 0.652225622594, 1.022598102293],
        [0.000000000000, -0.840828401428, -0.268144664760],
        [0.000000000000, 0.840828401428, -0.268144664760],
        [0.000000000000, 0.000000000000, 0.000000289878]  // central atom
    ];
}

function generateTriakisTetrahedron() {
    // TT-8: Triakis Tetrahedron (Td) - from cosymlib
    // 8 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, 0.951989349863],
        [-0.897415499947, 0.000000000000, -0.317824238862],
        [0.448707702372, -0.777184634355, -0.317824238862],
        [0.448707702372, 0.777184634355, -0.317824238862],
        [0.000000000000, 0.000000000000, -1.159193629094],
        [1.092673129412, 0.000000000000, 0.386903234355],
        [-0.546336517105, 0.946282696936, 0.386903234355],
        [-0.546336517105, -0.946282696936, 0.386903234355],
        [0.000000000000, 0.000000000000, -0.000032707247]  // central atom
    ];
}

// CN=9 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
// CRITICAL: CN=9 geometries INCLUDE the central atom (10 points total)
// Reference coordinates from cosymlib ideal_structures_center.yaml (already normalized)

function generateEnneagon() {
    // EP-9: Planar enneagon (D9h) - from cosymlib
    // 9 ligands + central atom at origin
    return [
        [1.054092553389, 0.000000000000, 0.000000000000],
        [0.807481743057, 0.677557632782, 0.000000000000],
        [0.183041250988, 1.038078518970, 0.000000000000],
        [-0.527046276695, 0.912870929175, 0.000000000000],
        [-0.990522994045, 0.360520886189, 0.000000000000],
        [-0.990522994045, -0.360520886189, 0.000000000000],
        [-0.527046276695, -0.912870929175, 0.000000000000],
        [0.183041250988, -1.038078518970, 0.000000000000],
        [0.807481743057, -0.677557632782, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateOctagonalPyramid() {
    // OPY-9: Octagonal Pyramid (C8v) - from cosymlib
    // 9 ligands + central atom (NOT at origin for pyramid!)
    return [
        [0.000000000000, 0.000000000000, -0.953998092006],
        [1.059997880006, 0.000000000000, 0.105999788001],
        [0.749531688996, 0.749531688996, 0.105999788001],
        [0.000000000000, 1.059997880006, 0.105999788001],
        [-0.749531688996, 0.749531688996, 0.105999788001],
        [-1.059997880006, 0.000000000000, 0.105999788001],
        [-0.749531688996, -0.749531688996, 0.105999788001],
        [0.000000000000, -1.059997880006, 0.105999788001],
        [0.749531688996, -0.749531688996, 0.105999788001],
        [0.000000000000, 0.000000000000, 0.105999788001]  // central atom
    ];
}

function generateHeptagonalBipyramid() {
    // HBPY-9: Heptagonal Bipyramid (D7h) - from cosymlib
    // 9 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, -1.054092553389],
        [1.054092553389, 0.000000000000, 0.000000000000],
        [0.657215957254, 0.824122743675, 0.000000000000],
        [-0.234557659457, 1.027664252322, 0.000000000000],
        [-0.949704574492, 0.457353618441, 0.000000000000],
        [-0.949704574492, -0.457353618441, 0.000000000000],
        [-0.234557659457, -1.027664252322, 0.000000000000],
        [0.657215957254, -0.824122743675, 0.000000000000],
        [0.000000000000, 0.000000000000, 1.054092553389],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateTriangularCupola() {
    // JTC-9: Johnson Triangular Cupola (J3, C3v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [1.091089451180, 0.000000000000, 0.267261241912],
        [0.545544725590, 0.944911182523, 0.267261241912],
        [-0.545544725590, 0.944911182523, 0.267261241912],
        [-1.091089451180, 0.000000000000, 0.267261241912],
        [-0.545544725590, -0.944911182523, 0.267261241912],
        [0.545544725590, -0.944911182523, 0.267261241912],
        [0.545544725590, 0.314970394174, -0.623609564462],
        [-0.545544725590, 0.314970394174, -0.623609564462],
        [0.000000000000, -0.629940788349, -0.623609564462],
        [0.000000000000, 0.000000000000, 0.267261241912]  // central atom
    ];
}

function generateCappedCube() {
    // JCCU-9: Johnson Capped Cube (J8, C4v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [0.826960652050, 0.000000000000, 0.443578471150],
        [0.826960652050, 0.000000000000, -0.725920498528],
        [0.000000000000, 0.826960652050, 0.443578471150],
        [0.000000000000, 0.826960652050, -0.725920498528],
        [-0.826960652050, 0.000000000000, 0.443578471150],
        [-0.826960652050, 0.000000000000, -0.725920498528],
        [0.000000000000, -0.826960652050, 0.443578471150],
        [0.000000000000, -0.826960652050, -0.725920498528],
        [0.000000000000, 0.000000000000, 1.270539123200],
        [0.000000000000, 0.000000000000, -0.141171013689]  // central atom
    ];
}

function generateCappedCubeAlt() {
    // CCU-9: Capped Cube (C4v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [0.676580145336, 0.676580145336, 0.433150734305],
        [0.676580145336, -0.676580145336, 0.433150734305],
        [-0.676580145336, 0.676580145336, 0.433150734305],
        [-0.676580145336, -0.676580145336, 0.433150734305],
        [0.567844822329, 0.567844822329, -0.692079759449],
        [0.567844822329, -0.567844822329, -0.692079759449],
        [-0.567844822329, 0.567844822329, -0.692079759449],
        [-0.567844822329, -0.567844822329, -0.692079759449],
        [0.000000000000, 0.000000000000, 1.044926731187],
        [0.000000000000, 0.000000000000, -0.009210630612]  // central atom
    ];
}

function generateCappedSquareAntiprism() {
    // JCSAPR-9: Johnson Capped Square Antiprism (J10, C4v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [0.873140643490, 0.000000000000, 0.658403850449],
        [0.617403669941, 0.617403669941, -0.379941215187],
        [0.000000000000, 0.873140643490, 0.658403850449],
        [-0.617403669941, 0.617403669941, -0.379941215187],
        [-0.873140643490, 0.000000000000, 0.658403850449],
        [-0.617403669941, -0.617403669941, -0.379941215187],
        [0.000000000000, -0.873140643490, 0.658403850449],
        [0.617403669941, -0.617403669941, -0.379941215187],
        [0.000000000000, 0.000000000000, -1.253081858677],
        [0.000000000000, 0.000000000000, 0.139231317631]  // central atom
    ];
}

function generateCappedSquareAntiprismAlt() {
    // CSAPR-9: Capped Square Antiprism (C4v) - from cosymlib
    // 9 ligands + central atom at origin
    return [
        [0.000000000000, 0.000000000000, 1.053083142672],
        [0.982653581851, 0.000000000000, 0.380440156580],
        [0.000000000000, 0.982653581851, 0.380440156580],
        [-0.982653581851, 0.000000000000, 0.380440156580],
        [0.000000000000, -0.982653581851, 0.380440156580],
        [0.590919690170, 0.590919690170, -0.643458455172],
        [-0.590919690170, 0.590919690170, -0.643458455172],
        [-0.590919690170, -0.590919690170, -0.643458455172],
        [0.590919690170, -0.590919690170, -0.643458455172],
        [0.000000000000, 0.000000000000, -0.001009948303]  // central atom
    ];
}

function generateTricappedTrigonalPrism() {
    // JTCTPR-9: Johnson Tricapped Trigonal Prism (J51, D3h) - from cosymlib
    // 9 ligands + central atom at origin
    return [
        [0.621382007554, 0.621382007554, 0.358755069151],
        [-0.621382007554, 0.621382007554, 0.358755069151],
        [0.621382007554, -0.621382007554, 0.358755069151],
        [-0.621382007554, -0.621382007554, 0.358755069151],
        [0.000000000000, 0.621382007554, -0.717510138861],
        [0.000000000000, -0.621382007554, -0.717510138861],
        [1.071725432946, 0.000000000000, -0.618760966112],
        [-1.071725432946, 0.000000000000, -0.618760966112],
        [0.000000000000, 0.000000000000, 1.237521933529],
        [0.000000000000, 0.000000000000, -0.000000000186]  // central atom
    ];
}

function generateTricappedTrigonalPrismAlt() {
    // TCTPR-9: Tricapped Trigonal Prism (D3h) - from cosymlib
    // 9 ligands + central atom at origin
    return [
        [0.702728368926, 0.000000000000, 0.785674201318],
        [-0.351364184463, 0.608580619450, 0.785674201318],
        [-0.351364184463, -0.608580619450, 0.785674201318],
        [0.702728368926, 0.000000000000, -0.785674201318],
        [-0.351364184463, 0.608580619450, -0.785674201318],
        [-0.351364184463, -0.608580619450, -0.785674201318],
        [-1.054092553389, 0.000000000000, 0.000000000000],
        [0.527046276695, 0.912870929175, 0.000000000000],
        [0.527046276695, -0.912870929175, 0.000000000000],
        [0.000000000000, 0.000000000000, 0.000000000000]  // central atom
    ];
}

function generateTridiminishedIcosahedron() {
    // JTDIC-9: Johnson Tridiminished Icosahedron (J63, C3v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [-0.262672206048, 0.919451307875, -0.425012557285],
        [-0.915286548850, 0.021204725402, -0.425012557285],
        [-0.262672206048, -0.877041857071, -0.425012557285],
        [0.793279982152, -0.533942192845, -0.425012557285],
        [0.973658150194, 0.021204725402, 0.519459792237],
        [0.321043807391, 0.919451307875, 0.519459792237],
        [-0.734908380808, -0.533942192845, 0.519459792237],
        [0.029185800672, 0.021204725402, -1.008728570724],
        [0.029185800672, 0.021204725402, 1.103175805676],
        [0.029185800672, 0.021204725402, 0.047223617476]  // central atom
    ];
}

function generateHulaHoop() {
    // HH-9: Hula-hoop (C2v) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [1.057244898055, 0.000000000000, 0.077395698145],
        [0.528622449027, 0.915600935736, 0.077395698145],
        [-0.528622449027, 0.915600935736, 0.077395698145],
        [-1.057244898055, 0.000000000000, 0.077395698145],
        [-0.528622449027, -0.915600935736, 0.077395698145],
        [0.528622449027, -0.915600935736, 0.077395698145],
        [0.000000000000, 0.000000000000, 1.134640596200],
        [0.528622449027, 0.000000000000, -0.838205241608],
        [-0.528622449027, 0.000000000000, -0.838205241608],
        [0.000000000000, 0.000000000000, 0.077395698145]  // central atom
    ];
}

function generateMuffin() {
    // MFF-9: Muffin (Cs) - from cosymlib
    // 9 ligands + central atom (NOT at origin!)
    return [
        [0.000000000000, 1.042109568232, 0.212992870476],
        [0.990863900028, 0.322171619609, 0.212992870476],
        [0.612400432650, -0.842614003292, 0.212992870476],
        [-0.612400432650, -0.842614003292, 0.212992870476],
        [-0.990863900028, 0.322171619609, 0.212992870476],
        [-0.612400432650, -0.354163418210, -0.737452600997],
        [0.612400432650, -0.354163418210, -0.737452600997],
        [0.000000000000, 0.706514131140, -0.737452600997],
        [0.000000000000, 0.000293952208, 1.100973497819],
        [0.000000000000, 0.000293952208, 0.046419952795]  // central atom
    ];
}

// CN=10 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
function generateDecagon() {
    // DP-10: Planar 10-gon
    const coords = [];
    for (let i = 0; i < 10; i++) {
        const angle = (i * 2 * Math.PI) / 10;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateEnneagonalPyramid() {
    // EPY-10: Enneagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.957826],
        [1.053609, -0.000000, 0.095783],
        [0.807111, 0.677247, 0.095783],
        [0.182957, 1.037602, 0.095783],
        [-0.526804, 0.912452, 0.095783],
        [-0.990069, 0.360355, 0.095783],
        [-0.990069, -0.360355, 0.095783],
        [-0.526804, -0.912452, 0.095783],
        [0.182957, -1.037602, 0.095783],
        [0.807111, -0.677247, 0.095783]
    ].map(normalize);
}

function generateOctagonalBipyramid() {
    // OBPY-10: Octagonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, -1.048809],
        [1.048809, 0.000000, 0.000000],
        [0.741620, 0.741620, 0.000000],
        [0.000000, 1.048809, 0.000000],
        [-0.741620, 0.741620, 0.000000],
        [-1.048809, 0.000000, 0.000000],
        [-0.741620, -0.741620, 0.000000],
        [-0.000000, -1.048809, 0.000000],
        [0.741620, -0.741620, 0.000000],
        [0.000000, 0.000000, 1.048809]
    ].map(normalize);
}

function generatePentagonalPrism() {
    // PPR-10: Pentagonal Prism - ECLIPSED - Official CoSyMlib reference (normalized)
    return [
        [0.904182, -0.000000, -0.531465],
        [0.279408, 0.859928, -0.531465],
        [-0.731499, 0.531465, -0.531465],
        [-0.731499, -0.531465, -0.531465],
        [0.279408, -0.859928, -0.531465],
        [0.904182, -0.000000, 0.531465],
        [0.279408, 0.859928, 0.531465],
        [-0.731499, 0.531465, 0.531465],
        [-0.731499, -0.531465, 0.531465],
        [0.279408, -0.859928, 0.531465]
    ].map(normalize);
}

function generatePentagonalAntiprism() {
    // PAPR-10: Pentagonal Antiprism - STAGGERED - Official CoSyMlib reference (normalized)
    return [
        [0.758925, 0.551391, -0.469042],
        [-0.289884, 0.892170, -0.469042],
        [-0.938083, 0.000000, -0.469042],
        [-0.289884, -0.892170, -0.469042],
        [0.758925, -0.551391, -0.469042],
        [0.938083, -0.000000, 0.469042],
        [0.289884, 0.892170, 0.469042],
        [-0.758925, 0.551391, 0.469042],
        [-0.758925, -0.551391, 0.469042],
        [0.289884, -0.892170, 0.469042]
    ].map(normalize);
}

function generateBicappedCube() {
    // JBCCU-10: Bicapped Cube (J15) - Official CoSyMlib reference (normalized)
    return [
        [0.785488, 0.000000, 0.555424],
        [0.785488, 0.000000, -0.555424],
        [0.000000, 0.785488, 0.555424],
        [0.000000, 0.785488, -0.555424],
        [-0.785488, 0.000000, 0.555424],
        [-0.785488, 0.000000, -0.555424],
        [-0.000000, -0.785488, 0.555424],
        [-0.000000, -0.785488, -0.555424],
        [0.000000, 0.000000, 1.340913],
        [0.000000, 0.000000, -1.340913]
    ].map(normalize);
}

function generateBicappedSquareAntiprism() {
    // JBCSAPR-10: Bicapped Square Antiprism (J17) - Official CoSyMlib reference (normalized)
    return [
        [0.831395, 0.000000, 0.494350],
        [0.587885, 0.587885, -0.494350],
        [0.000000, 0.831395, 0.494350],
        [-0.587885, 0.587885, -0.494350],
        [-0.831395, 0.000000, 0.494350],
        [-0.587885, -0.587885, -0.494350],
        [-0.000000, -0.831395, 0.494350],
        [0.587885, -0.587885, -0.494350],
        [0.000000, 0.000000, 1.325745],
        [0.000000, 0.000000, -1.325745]
    ].map(normalize);
}

function generateMetabidiminishedIcosahedron() {
    // JMBIC-10: Metabidiminished Icosahedron (J62) - Official CoSyMlib reference (normalized)
    return [
        [-0.797541, -0.588213, -0.373113],
        [-0.917507, 0.299842, 0.279142],
        [-0.042218, 0.961291, 0.121562],
        [0.151860, -0.475674, -0.933829],
        [0.548711, -0.584891, 0.811695],
        [-0.085441, 0.301899, 1.011328],
        [0.108597, -1.135033, -0.043961],
        [0.863981, 0.414498, 0.450639],
        [-0.482332, 0.411183, -0.734149],
        [0.618676, 0.482007, -0.628091]
    ].map(normalize);
}

function generateAugmentedTridiminishedIcosahedron() {
    // JATDI-10: Augmented Tridiminished Icosahedron (J64) - Official CoSyMlib reference (normalized)
    return [
        [-0.001380, -0.287820, -0.953537],
        [-0.508204, -0.874651, -0.286524],
        [0.005406, -0.863863, 0.597917],
        [0.829615, -0.270393, 0.477497],
        [0.508402, 0.681753, 0.286910],
        [-0.005208, 0.670964, -0.597531],
        [-0.825215, -0.278511, 0.481717],
        [0.514536, -0.869597, -0.289125],
        [-0.514338, 0.676698, 0.289511],
        [-0.003712, 1.511869, -0.007028]
    ].map(normalize);
}

function generateSphenocorona() {
    // JSPC-10: Sphenocorona (J87) - Official CoSyMlib reference (normalized)
    return [
        [-1.001872, -0.083830, -0.581156],
        [-1.002035, -0.076631, 0.581869],
        [-0.516334, 0.802168, -0.005029],
        [0.028693, 0.335227, -0.920231],
        [-0.064316, -0.772041, -0.576760],
        [-0.064478, -0.764830, 0.586265],
        [0.028438, 0.346602, 0.916012],
        [0.642643, 0.705054, -0.004284],
        [0.974705, -0.249460, -0.579854],
        [0.974554, -0.242261, 0.583171]
    ].map(normalize);
}

function generateStaggeredDodecahedron() {
    // SDD-10: Staggered Dodecahedron 2:6:2 - Official CoSyMlib reference (normalized)
    return [
        [-0.524414, 0.908285, 0.000000],
        [0.524414, 0.908285, 0.000000],
        [-1.048828, 0.000000, 0.000000],
        [1.048828, 0.000000, 0.000000],
        [-0.524414, -0.908285, 0.000000],
        [0.524414, -0.908285, 0.000000],
        [-0.524414, 0.000000, 0.908285],
        [0.524414, 0.000000, 0.908285],
        [0.262207, 0.454143, -0.908285],
        [-0.262207, -0.454143, -0.908285]
    ].map(normalize);
}

function generateTetradecahedron() {
    // TD-10: Tetradecahedron 2:6:2 - Official CoSyMlib reference (normalized)
    return [
        [-0.524414, 0.908284, 0.000000],
        [0.524414, 0.908284, 0.000000],
        [-1.048827, 0.000000, 0.000000],
        [1.048827, 0.000000, 0.000000],
        [-0.524414, -0.908284, 0.000000],
        [0.524414, -0.908284, 0.000000],
        [-0.524414, 0.000000, 0.908284],
        [0.524414, 0.000000, 0.908284],
        [0.000000, 0.524414, -0.908284],
        [0.000000, -0.524414, -0.908284]
    ].map(normalize);
}

function generateHexadecahedron() {
    // HD-10: Hexadecahedron 2:6:2 - Official CoSyMlib reference (normalized)
    return [
        [-0.524414, 0.908284, 0.000000],
        [0.524414, 0.908284, 0.000000],
        [-1.048827, 0.000000, 0.000000],
        [1.048827, 0.000000, 0.000000],
        [-0.524414, -0.908284, 0.000000],
        [0.524414, -0.908284, 0.000000],
        [-0.524414, 0.000000, 0.908284],
        [0.524414, 0.000000, 0.908284],
        [-0.524414, 0.000000, -0.908284],
        [0.524414, 0.000000, -0.908284]
    ].map(normalize);
}

// CN=11 Geometries (7 total from SHAPE 2.1) - COMPLETE SET
function generateHendecagon() {
    // HP-11: Planar 11-gon
    const coords = [];
    for (let i = 0; i < 11; i++) {
        const angle = (i * 2 * Math.PI) / 11;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateDecagonalPyramid() {
    // DPY-11: Decagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.961074],
        [1.048445, -0.000000, 0.087370],
        [0.848210, 0.616260, 0.087370],
        [0.323987, 0.997130, 0.087370],
        [-0.323987, 0.997130, 0.087370],
        [-0.848210, 0.616260, 0.087370],
        [-1.048445, 0.000000, 0.087370],
        [-0.848210, -0.616260, 0.087370],
        [-0.323987, -0.997130, 0.087370],
        [0.323987, -0.997130, 0.087370],
        [0.848210, -0.616260, 0.087370]
    ].map(normalize);
}

function generateEnneagonalBipyramid() {
    // EBPY-11: Enneagonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -1.044466],
        [1.044466, -0.000000, 0.000000],
        [0.800107, 0.671370, 0.000000],
        [0.181370, 1.028598, 0.000000],
        [-0.522233, 0.904534, 0.000000],
        [-0.981477, 0.357228, 0.000000],
        [-0.981477, -0.357228, 0.000000],
        [-0.522233, -0.904534, 0.000000],
        [0.181370, -1.028598, 0.000000],
        [0.800107, -0.671370, 0.000000],
        [0.000000, -0.000000, 1.044466]
    ].map(normalize);
}

function generateCappedPentagonalPrism() {
    // JCPPR-11: Capped Pentagonal Prism (J9) - Official CoSyMlib reference (normalized)
    return [
        [0.900823, -0.000000, 0.438971],
        [0.900823, -0.000000, -0.620010],
        [0.278370, 0.856734, 0.438971],
        [0.278370, 0.856734, -0.620010],
        [-0.728781, 0.529491, 0.438971],
        [-0.728781, 0.529491, -0.620010],
        [-0.728781, -0.529491, 0.438971],
        [-0.728781, -0.529491, -0.620010],
        [0.278370, -0.856734, 0.438971],
        [0.278370, -0.856734, -0.620010],
        [0.000000, -0.000000, 0.995711]
    ].map(normalize);
}

function generateCappedPentagonalAntiprism() {
    // JCPAPR-11: Capped Pentagonal Antiprism (J11) - Official CoSyMlib reference (normalized)
    return [
        [0.937758, -0.000000, 0.556249],
        [0.758662, 0.551200, -0.381508],
        [0.289783, 0.891860, 0.556249],
        [-0.289783, 0.891860, -0.381508],
        [-0.758662, 0.551200, 0.556249],
        [-0.937758, 0.000000, -0.381508],
        [-0.758662, -0.551200, 0.556249],
        [-0.289783, -0.891860, -0.381508],
        [0.289783, -0.891860, 0.556249],
        [0.758662, -0.551200, -0.381508],
        [0.000000, -0.000000, -0.961074]
    ].map(normalize);
}

function generateAugmentedPentagonalPrism() {
    // JAPPR-11: Augmented Pentagonal Prism (J52) - Official CoSyMlib reference (normalized)
    return [
        [-0.000000, -1.305264, 0.000000],
        [-0.000000, 0.986976, 0.510294],
        [0.825655, 0.386871, 0.510294],
        [0.510294, -0.583708, 0.510294],
        [-0.510294, -0.583708, 0.510294],
        [-0.825655, 0.386871, 0.510294],
        [-0.000000, 0.986976, -0.510294],
        [0.825655, 0.386871, -0.510294],
        [0.510294, -0.583708, -0.510294],
        [-0.510294, -0.583708, -0.510294],
        [-0.825655, 0.386871, -0.510294]
    ].map(normalize);
}

function generateAugmentedSphenocorona() {
    // JASPC-11: Augmented Sphenocorona (J87) - Official CoSyMlib reference (normalized)
    return [
        [-0.549649, -0.001864, 0.864507],
        [0.549649, -0.001864, 0.864507],
        [-0.000000, 0.867614, 0.476754],
        [-0.867816, 0.476159, -0.072895],
        [-0.549649, -0.576090, -0.072895],
        [0.549649, -0.576090, -0.072895],
        [0.867816, 0.476159, -0.072895],
        [-0.000000, 0.867614, -0.622545],
        [-0.549649, -0.001864, -1.010297],
        [0.549649, -0.001864, -1.010297],
        [-0.000000, -0.951821, 0.801846]
    ].map(normalize);
}

// CN=12 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
function generateDodecagon() {
    // DP-12: Planar 12-gon
    const coords = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i * 2 * Math.PI) / 12;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateHendecagonalPyramid() {
    // HPY-12: Hendecagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.963863],
        [1.044185, -0.000000, 0.080322],
        [0.878424, 0.564529, 0.080322],
        [0.433770, 0.949824, 0.080322],
        [-0.148603, 1.033557, 0.080322],
        [-0.683796, 0.789142, 0.080322],
        [-1.001888, 0.294181, 0.080322],
        [-1.001888, -0.294181, 0.080322],
        [-0.683796, -0.789142, 0.080322],
        [-0.148603, -1.033557, 0.080322],
        [0.433770, -0.949824, 0.080322],
        [0.878424, -0.564529, 0.080322]
    ].map(normalize);
}

function generateDecagonalBipyramid() {
    // DBPY-12: Decagonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -1.040833],
        [1.040833, -0.000000, 0.000000],
        [0.842052, 0.611786, 0.000000],
        [0.321635, 0.989891, 0.000000],
        [-0.321635, 0.989891, 0.000000],
        [-0.842052, 0.611786, 0.000000],
        [-1.040833, 0.000000, 0.000000],
        [-0.842052, -0.611786, 0.000000],
        [-0.321635, -0.989891, 0.000000],
        [0.321635, -0.989891, 0.000000],
        [0.842052, -0.611786, 0.000000],
        [0.000000, -0.000000, 1.040833]
    ].map(normalize);
}

function generateHexagonalPrism() {
    // HPR-12: Hexagonal Prism - Official CoSyMlib reference (normalized)
    return [
        [0.930949, -0.000000, -0.465475],
        [0.465475, 0.806226, -0.465475],
        [-0.465475, 0.806226, -0.465475],
        [-0.930949, 0.000000, -0.465475],
        [-0.465475, -0.806226, -0.465475],
        [0.465475, -0.806226, -0.465475],
        [0.930949, -0.000000, 0.465475],
        [0.465475, 0.806226, 0.465475],
        [-0.465475, 0.806226, 0.465475],
        [-0.930949, 0.000000, 0.465475],
        [-0.465475, -0.806226, 0.465475],
        [0.465475, -0.806226, 0.465475]
    ].map(normalize);
}

function generateHexagonalAntiprism() {
    // HAPR-12: Hexagonal Antiprism - Official CoSyMlib reference (normalized)
    return [
        [0.828737, 0.478472, -0.409380],
        [0.000000, 0.956944, -0.409380],
        [-0.828737, 0.478472, -0.409380],
        [-0.828737, -0.478472, -0.409380],
        [-0.000000, -0.956944, -0.409380],
        [0.828737, -0.478472, -0.409380],
        [0.956944, -0.000000, 0.409380],
        [0.478472, 0.828737, 0.409380],
        [-0.478472, 0.828737, 0.409380],
        [-0.956944, 0.000000, 0.409380],
        [-0.478472, -0.828737, 0.409380],
        [0.478472, -0.828737, 0.409380]
    ].map(normalize);
}

function generateTruncatedTetrahedron() {
    // TT-12: Truncated Tetrahedron - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.443813, -0.941469],
        [0.443813, 0.887625, -0.313823],
        [-0.443813, 0.887625, -0.313823],
        [-0.000000, -0.443813, -0.941469],
        [0.443813, -0.887625, -0.313823],
        [-0.443813, -0.887625, -0.313823],
        [0.887625, 0.443813, 0.313823],
        [0.887625, -0.443813, 0.313823],
        [0.443813, 0.000000, 0.941469],
        [-0.887625, 0.443813, 0.313823],
        [-0.887625, -0.443813, 0.313823],
        [-0.443813, 0.000000, 0.941469]
    ].map(normalize);
}

function generateCuboctahedron() {
    // COC-12: Cuboctahedral - Official CoSyMlib reference (normalized)
    return [
        [0.520416, 0.520416, -0.735980],
        [0.520416, -0.520416, -0.735980],
        [1.040833, -0.000000, 0.000000],
        [-0.520416, 0.520416, -0.735980],
        [0.000000, 1.040833, 0.000000],
        [-0.520416, -0.520416, -0.735980],
        [-1.040833, 0.000000, 0.000000],
        [-0.000000, -1.040833, 0.000000],
        [0.520416, 0.520416, 0.735980],
        [0.520416, -0.520416, 0.735980],
        [-0.520416, 0.520416, 0.735980],
        [-0.520416, -0.520416, 0.735980]
    ].map(normalize);
}

function generateAnticuboctahedron() {
    // ACOC-12: Anticuboctahedron (J27) - Official CoSyMlib reference (normalized)
    return [
        [0.600925, -0.000000, -0.849837],
        [-0.300463, 0.520416, -0.849837],
        [-0.300463, -0.520416, -0.849837],
        [0.901388, 0.520416, -0.000000],
        [0.000000, 1.040833, -0.000000],
        [-0.901388, 0.520416, -0.000000],
        [-0.901388, -0.520416, -0.000000],
        [-0.000000, -1.040833, -0.000000],
        [0.901388, -0.520416, -0.000000],
        [0.600925, -0.000000, 0.849837],
        [-0.300463, 0.520416, 0.849837],
        [-0.300463, -0.520416, 0.849837]
    ].map(normalize);
}

function generateIcosahedron() {
    // IC-12: Icosahedral - Official CoSyMlib reference (normalized)
    return [
        [0.753154, 0.547198, -0.465475],
        [-0.287679, 0.885385, -0.465475],
        [-0.930949, 0.000000, -0.465475],
        [-0.287679, -0.885385, -0.465475],
        [0.753154, -0.547198, -0.465475],
        [0.930949, -0.000000, 0.465475],
        [0.287679, 0.885385, 0.465475],
        [-0.753154, 0.547198, 0.465475],
        [-0.753154, -0.547198, 0.465475],
        [0.287679, -0.885385, 0.465475],
        [0.000000, -0.000000, -1.040833],
        [0.000000, -0.000000, 1.040833]
    ].map(normalize);
}

function generateSquareCupola() {
    // JSC-12: Square Cupola (J4) - Official CoSyMlib reference (normalized)
    return [
        [1.141165, 0.000000, 0.190029],
        [0.806926, 0.806926, 0.190029],
        [0.000000, 1.141165, 0.190029],
        [-0.806926, 0.806926, 0.190029],
        [-1.141165, 0.000000, 0.190029],
        [-0.806926, -0.806926, 0.190029],
        [-0.000000, -1.141165, 0.190029],
        [0.806926, -0.806926, 0.190029],
        [0.570583, 0.236343, -0.427565],
        [-0.236343, 0.570583, -0.427565],
        [-0.570583, -0.236343, -0.427565],
        [0.236343, -0.570583, -0.427565]
    ].map(normalize);
}

function generateElongatedPentagonalBipyramid() {
    // JEPBPY-12: Elongated Pentagonal Bipyramid (J16) - Official CoSyMlib reference (normalized)
    return [
        [0.891336, -0.000000, 0.523914],
        [0.891336, -0.000000, -0.523914],
        [0.275438, 0.847711, 0.523914],
        [0.275438, 0.847711, -0.523914],
        [-0.721106, 0.523914, 0.523914],
        [-0.721106, 0.523914, -0.523914],
        [-0.721106, -0.523914, 0.523914],
        [-0.721106, -0.523914, -0.523914],
        [0.275438, -0.847711, 0.523914],
        [0.275438, -0.847711, -0.523914],
        [0.000000, -0.000000, 1.074790],
        [0.000000, -0.000000, -1.074790]
    ].map(normalize);
}

function generateBiaugmentedPentagonalPrism() {
    // JBAPPR-12: Biaugmented Pentagonal Prism (J53) - Official CoSyMlib reference (normalized)
    return [
        [0.852576, 0.489340, -0.061742],
        [0.277323, 0.489340, 0.730026],
        [-0.653457, 0.489340, 0.427597],
        [-0.653457, 0.489340, -0.551082],
        [0.277323, 0.489340, -0.853511],
        [0.852576, -0.489340, -0.061742],
        [0.277323, -0.489340, 0.730026],
        [-0.653457, -0.489340, 0.427597],
        [-0.653457, -0.489340, -0.551082],
        [0.277323, -0.489340, -0.853511],
        [-1.345488, 0.000000, -0.061742],
        [1.124814, 0.000000, 0.740907]
    ].map(normalize);
}

function generateSphenomegacorona() {
    // JSPMC-12: Sphenomegacorona (J88) - Official CoSyMlib reference (normalized)
    return [
        [-0.506162, -0.030252, -0.601961],
        [-0.865277, 0.700144, 0.000000],
        [0.000000, 0.841196, -0.506162],
        [-1.298915, -0.214600, 0.000000],
        [0.506162, -0.030252, -0.601961],
        [-0.506162, -0.844158, 0.000000],
        [0.000000, 0.841196, 0.506162],
        [-0.506162, -0.030252, 0.601961],
        [0.865277, 0.700144, 0.000000],
        [0.506162, -0.844158, 0.000000],
        [0.506162, -0.030252, 0.601961],
        [1.298915, -0.214600, 0.000000]
    ].map(normalize);
}

// CN=20 Geometries (1 geometry from CoSyMlib)
function generateDodecahedron20() {
    // DD-20: Dodecahedron - Official CoSyMlib reference (normalized)
    return [
        [0.814279, 0.591608, -0.192225],
        [-0.311027, 0.957242, -0.192225],
        [-1.006504, -0.000000, -0.192225],
        [-0.311027, -0.957242, -0.192225],
        [0.814279, -0.591608, -0.192225],
        [0.311027, 0.957242, 0.192225],
        [-0.814279, 0.591608, 0.192225],
        [-0.814279, -0.591608, 0.192225],
        [0.311027, -0.957242, 0.192225],
        [1.006504, -0.000000, 0.192225],
        [0.503252, 0.365634, -0.814279],
        [-0.192225, 0.591608, -0.814279],
        [-0.622053, -0.000000, -0.814279],
        [-0.192225, -0.591608, -0.814279],
        [0.503252, -0.365634, -0.814279],
        [0.192225, 0.591608, 0.814279],
        [-0.503252, 0.365634, 0.814279],
        [-0.503252, -0.365634, 0.814279],
        [0.192225, -0.591608, 0.814279],
        [0.622053, -0.000000, 0.814279]
    ].map(normalize);
}

// CN=24 Geometries (2 geometries from CoSyMlib)
function generateTruncatedCube() {
    // TCU-24: Truncated Cube - Official CoSyMlib reference (normalized)
    return [
        [0.286881, 0.692592, 0.692592],
        [-0.286881, -0.692592, -0.692592],
        [0.286881, -0.692592, -0.692592],
        [-0.286881, 0.692592, -0.692592],
        [-0.286881, -0.692592, 0.692592],
        [0.286881, 0.692592, -0.692592],
        [-0.286881, 0.692592, 0.692592],
        [0.286881, -0.692592, 0.692592],
        [0.692592, 0.286881, 0.692592],
        [-0.692592, -0.286881, -0.692592],
        [0.692592, -0.286881, -0.692592],
        [-0.692592, 0.286881, -0.692592],
        [-0.692592, -0.286881, 0.692592],
        [0.692592, 0.286881, -0.692592],
        [-0.692592, 0.286881, 0.692592],
        [0.692592, -0.286881, 0.692592],
        [0.692592, 0.692592, 0.286881],
        [-0.692592, -0.692592, -0.286881],
        [0.692592, -0.692592, -0.286881],
        [-0.692592, 0.692592, -0.286881],
        [-0.692592, -0.692592, 0.286881],
        [0.692592, 0.692592, -0.286881],
        [-0.692592, 0.692592, 0.286881],
        [0.692592, -0.692592, 0.286881]
    ].map(normalize);
}

function generateTruncatedOctahedron() {
    // TOC-24: Truncated Octahedron - Official CoSyMlib reference (normalized)
    return [
        [0.912871, 0.456435, 0.000000],
        [-0.912871, -0.456435, 0.000000],
        [0.912871, -0.456435, 0.000000],
        [-0.912871, 0.456435, 0.000000],
        [0.000000, 0.912871, 0.456435],
        [0.000000, -0.912871, -0.456435],
        [0.000000, 0.912871, -0.456435],
        [0.000000, -0.912871, 0.456435],
        [0.456435, 0.000000, 0.912871],
        [-0.456435, 0.000000, -0.912871],
        [0.456435, 0.000000, -0.912871],
        [-0.456435, 0.000000, 0.912871],
        [0.456435, 0.912871, 0.000000],
        [-0.456435, -0.912871, 0.000000],
        [0.456435, -0.912871, 0.000000],
        [-0.456435, 0.912871, 0.000000],
        [0.000000, 0.456435, 0.912871],
        [0.000000, -0.456435, -0.912871],
        [0.000000, 0.456435, -0.912871],
        [0.000000, -0.456435, 0.912871],
        [0.912871, 0.000000, 0.456435],
        [-0.912871, 0.000000, -0.456435],
        [0.912871, 0.000000, -0.456435],
        [-0.912871, 0.000000, 0.456435]
    ].map(normalize);
}

// CN=48 Geometries (1 geometry from CoSyMlib)
function generateTruncatedCuboctahedron() {
    // TCOC-48: Truncated Cuboctahedron - Official CoSyMlib reference (normalized)
    return [
        [0.217975, 0.526238, 0.834502],
        [-0.217975, -0.526238, -0.834502],
        [0.217975, -0.526238, -0.834502],
        [-0.217975, 0.526238, -0.834502],
        [-0.217975, -0.526238, 0.834502],
        [0.217975, 0.526238, -0.834502],
        [-0.217975, 0.526238, 0.834502],
        [0.217975, -0.526238, 0.834502],
        [0.217975, 0.834502, 0.526238],
        [-0.217975, -0.834502, -0.526238],
        [0.217975, -0.834502, -0.526238],
        [-0.217975, 0.834502, -0.526238],
        [-0.217975, -0.834502, 0.526238],
        [0.217975, 0.834502, -0.526238],
        [-0.217975, 0.834502, 0.526238],
        [0.217975, -0.834502, 0.526238],
        [0.526238, 0.217975, 0.834502],
        [-0.526238, -0.217975, -0.834502],
        [0.526238, -0.217975, -0.834502],
        [-0.526238, 0.217975, -0.834502],
        [-0.526238, -0.217975, 0.834502],
        [0.526238, 0.217975, -0.834502],
        [-0.526238, 0.217975, 0.834502],
        [0.526238, -0.217975, 0.834502],
        [0.526238, 0.834502, 0.217975],
        [-0.526238, -0.834502, -0.217975],
        [0.526238, -0.834502, -0.217975],
        [-0.526238, 0.834502, -0.217975],
        [-0.526238, -0.834502, 0.217975],
        [0.526238, 0.834502, -0.217975],
        [-0.526238, 0.834502, 0.217975],
        [0.526238, -0.834502, 0.217975],
        [0.834502, 0.526238, 0.217975],
        [-0.834502, -0.526238, -0.217975],
        [0.834502, -0.526238, -0.217975],
        [-0.834502, 0.526238, -0.217975],
        [-0.834502, -0.526238, 0.217975],
        [0.834502, 0.526238, -0.217975],
        [-0.834502, 0.526238, 0.217975],
        [0.834502, -0.526238, 0.217975],
        [0.834502, 0.217975, 0.526238],
        [-0.834502, -0.217975, -0.526238],
        [0.834502, -0.217975, -0.526238],
        [-0.834502, 0.217975, -0.526238],
        [-0.834502, -0.217975, 0.526238],
        [0.834502, 0.217975, -0.526238],
        [-0.834502, 0.217975, 0.526238],
        [0.834502, -0.217975, 0.526238]
    ].map(normalize);
}

// CN=60 Geometries (1 geometry from CoSyMlib)
function generateTruncatedIcosahedron() {
    // TIC-60: Truncated Icosahedron - Official CoSyMlib reference (normalized)
    // Famous "soccer ball" or "buckyball" geometry, used for fullerenes like C60
    return [
        [0.799214169418, 0.329186766636, -0.519191166048],
        [0.560045966052, 0.658373533272, -0.519191166048],
        [-0.066104440661, 0.861822142285, -0.519191166048],
        [-0.453086725387, 0.736083984662, -0.519191166048],
        [-0.840068969422, 0.203448609013, -0.519191166048],
        [-0.840068969422, -0.203448609013, -0.519191166048],
        [-0.453086725387, -0.736083984662, -0.519191166048],
        [-0.066104440661, -0.861822142285, -0.519191166048],
        [0.560045966052, -0.658373533272, -0.519191166048],
        [0.799214169418, -0.329186766636, -0.519191166048],
        [0.453086725387, 0.736083984662, 0.519191166048],
        [0.066104440661, 0.861822142285, 0.519191166048],
        [-0.560045966052, 0.658373533272, 0.519191166048],
        [-0.799214169418, 0.329186766636, 0.519191166048],
        [-0.799214169418, -0.329186766636, 0.519191166048],
        [-0.560045966052, -0.658373533272, 0.519191166048],
        [0.066104440661, -0.861822142285, 0.519191166048],
        [0.453086725387, -0.736083984662, 0.519191166048],
        [0.840068969422, -0.203448609013, 0.519191166048],
        [0.840068969422, 0.203448609013, 0.519191166048],
        [0.972277891434, 0.203448609013, -0.173063722016],
        [0.906173410083, 0.406897218026, 0.173063722016],
        [0.667005247406, 0.736083984662, 0.173063722016],
        [0.493941525391, 0.861822142285, -0.173063722016],
        [0.106959281355, 0.987560299908, -0.173063722016],
        [-0.106959281355, 0.987560299908, 0.173063722016],
        [-0.493941525391, 0.861822142285, 0.173063722016],
        [-0.667005247406, 0.736083984662, -0.173063722016],
        [-0.906173410083, 0.406897218026, -0.173063722016],
        [-0.972277891434, 0.203448609013, 0.173063722016],
        [-0.972277891434, -0.203448609013, 0.173063722016],
        [-0.906173410083, -0.406897218026, -0.173063722016],
        [-0.667005247406, -0.736083984662, -0.173063722016],
        [-0.493941525391, -0.861822142285, 0.173063722016],
        [-0.106959281355, -0.987560299908, 0.173063722016],
        [0.106959281355, -0.987560299908, -0.173063722016],
        [0.493941525391, -0.861822142285, -0.173063722016],
        [0.667005247406, -0.736083984662, 0.173063722016],
        [0.906173410083, -0.406897218026, 0.173063722016],
        [0.972277891434, -0.203448609013, -0.173063722016],
        [0.692254888064, 0.000000000000, -0.733109688067],
        [0.346127444032, 0.000000000000, -0.947028210087],
        [0.213918522020, 0.658373533272, -0.733109688067],
        [0.106959281355, 0.329186766636, -0.947028210087],
        [-0.560045966052, 0.406897218026, -0.733109688067],
        [-0.280023003371, 0.203448609013, -0.947028210087],
        [-0.560045966052, -0.406897218026, -0.733109688067],
        [-0.280023003371, -0.203448609013, -0.947028210087],
        [0.213918522020, -0.658373533272, -0.733109688067],
        [0.106959281355, -0.329186766636, -0.947028210087],
        [0.560045966052, 0.406897218026, 0.733109688067],
        [0.280023003371, 0.203448609013, 0.947028210087],
        [-0.213918522020, 0.658373533272, 0.733109688067],
        [-0.106959281355, 0.329186766636, 0.947028210087],
        [-0.692254888064, 0.000000000000, 0.733109688067],
        [-0.346127444032, 0.000000000000, 0.947028210087],
        [-0.213918522020, -0.658373533272, 0.733109688067],
        [-0.106959281355, -0.329186766636, 0.947028210087],
        [0.560045966052, -0.406897218026, 0.733109688067],
        [0.280023003371, -0.203448609013, 0.947028210087]
    ].map(normalize);
}

// COMPLETE SHAPE 2.1 REFERENCE GEOMETRY LIBRARY
const REFERENCE_GEOMETRIES = {
    2: {
        "L-2 (Linear)": generateLinear(),
        "vT-2 (V-shape, 109.47°)": generateVShape(),
        "vOC-2 (L-shape, 90°)": generateLShape()
    },
    3: {
        "TP-3 (Trigonal Planar)": generateTrigonalPlanar(),
        "vT-3 (Pyramid)": generatePyramid(),
        "fac-vOC-3 (fac-Trivacant Octahedron)": generateFacTrivacantOctahedron(),
        "mer-vOC-3 (T-shaped)": generateTShaped()
    },
    4: {
        "SP-4 (Square Planar)": generateSquarePlanar(),
        "T-4 (Tetrahedral)": generateTetrahedral(),
        "SS-4 (Seesaw)": generateSeesaw(),
        "vTBPY-4 (Axially Vacant Trigonal Bipyramid)": generateAxialVacantTBPY()
    },
    5: {
        "PP-5 (Pentagon)": generatePentagon(),
        "vOC-5 (Square Pyramid, J1)": generateSquarePyramid(),
        "TBPY-5 (Trigonal Bipyramidal)": generateTrigonalBipyramidal(),
        "SPY-5 (Square Pyramidal)": generateSquarePyramidal(),
        "JTBPY-5 (Johnson Trigonal Bipyramid, J12)": generateJohnsonTrigonalBipyramid()
    },
    6: {
        "HP-6 (Hexagon)": generateHexagon(),
        "PPY-6 (Pentagonal Pyramid)": generatePentagonalPyramid(),
        "OC-6 (Octahedral)": generateOctahedral(),
        "TPR-6 (Trigonal Prism)": generateTrigonalPrism(),
        "JPPY-6 (Johnson Pentagonal Pyramid, J2)": generateJohnsonPentagonalPyramid6()
    },
    7: {
        "HP-7 (Heptagon)": generateHeptagon(),
        "HPY-7 (Hexagonal Pyramid)": generateHexagonalPyramid(),
        "PBPY-7 (Pentagonal Bipyramidal)": generatePentagonalBipyramid(),
        "COC-7 (Capped Octahedral)": generateCappedOctahedron(),
        "CTPR-7 (Capped Trigonal Prism)": generateCappedTrigonalPrism(),
        "JPBPY-7 (Johnson Pentagonal Bipyramid, J13)": generateJohnsonPentagonalBipyramid(),
        "JETPY-7 (Elongated Triangular Pyramid, J7)": generateElongatedTriangularPyramid()
    },
    8: {
        "OP-8 (Octagon)": generateOctagon(),
        "HPY-8 (Heptagonal Pyramid)": generateHeptagonalPyramid(),
        "HBPY-8 (Hexagonal Bipyramid)": generateHexagonalBipyramid(),
        "CU-8 (Cube)": generateCube(),
        "SAPR-8 (Square Antiprism)": generateSquareAntiprism(),
        "TDD-8 (Triangular Dodecahedron)": generateTriangularDodecahedron(),
        "JGBF-8 (Gyrobifastigium, J26)": generateGyrobifastigium(),
        "JETBPY-8 (Elongated Triangular Bipyramid, J14)": generateElongatedTriangularBipyramid(),
        "JBTP-8 (Biaugmented Trigonal Prism, J50)": generateBiaugmentedTrigonalPrism(),
        "BTPR-8 (Biaugmented Trigonal Prism)": generateSphericalBiaugmentedTrigonalPrism(),
        "JSD-8 (Snub Disphenoid, J84)": generateSnubDisphenoid(),
        "TT-8 (Triakis Tetrahedron)": generateTriakisTetrahedron(),
        "ETBPY-8 (Elongated Trigonal Bipyramid)": generateElongatedTriangularBipyramid()
    },
    9: {
        "EP-9 (Enneagon)": generateEnneagon(),
        "OPY-9 (Octagonal Pyramid)": generateOctagonalPyramid(),
        "HBPY-9 (Heptagonal Bipyramid)": generateHeptagonalBipyramid(),
        "JTC-9 (Triangular Cupola, J3)": generateTriangularCupola(),
        "JCCU-9 (Capped Cube, J8)": generateCappedCube(),
        "CCU-9 (Capped Cube)": generateCappedCubeAlt(),
        "JCSAPR-9 (Capped Square Antiprism, J10)": generateCappedSquareAntiprism(),
        "CSAPR-9 (Capped Square Antiprism)": generateCappedSquareAntiprismAlt(),
        "JTCTPR-9 (Tricapped Trigonal Prism, J51)": generateTricappedTrigonalPrism(),
        "TCTPR-9 (Tricapped Trigonal Prism)": generateTricappedTrigonalPrismAlt(),
        "JTDIC-9 (Tridiminished Icosahedron, J63)": generateTridiminishedIcosahedron(),
        "HH-9 (Hula-hoop)": generateHulaHoop(),
        "MFF-9 (Muffin)": generateMuffin()
    },
    10: {
        "DP-10 (Decagon)": generateDecagon(),
        "EPY-10 (Enneagonal Pyramid)": generateEnneagonalPyramid(),
        "OBPY-10 (Octagonal Bipyramid)": generateOctagonalBipyramid(),
        "PPR-10 (Pentagonal Prism - ECLIPSED)": generatePentagonalPrism(),
        "PAPR-10 (Pentagonal Antiprism - STAGGERED)": generatePentagonalAntiprism(),
        "JBCCU-10 (Bicapped Cube, J15)": generateBicappedCube(),
        "JBCSAPR-10 (Bicapped Square Antiprism, J17)": generateBicappedSquareAntiprism(),
        "JMBIC-10 (Metabidiminished Icosahedron, J62)": generateMetabidiminishedIcosahedron(),
        "JATDI-10 (Augmented Tridiminished Icosahedron, J64)": generateAugmentedTridiminishedIcosahedron(),
        "JSPC-10 (Sphenocorona, J87)": generateSphenocorona(),
        "SDD-10 (Staggered Dodecahedron 2:6:2)": generateStaggeredDodecahedron(),
        "TD-10 (Tetradecahedron 2:6:2)": generateTetradecahedron(),
        "HD-10 (Hexadecahedron 2:6:2)": generateHexadecahedron()
    },
    11: {
        "HP-11 (Hendecagon)": generateHendecagon(),
        "DPY-11 (Decagonal Pyramid)": generateDecagonalPyramid(),
        "EBPY-11 (Enneagonal Bipyramid)": generateEnneagonalBipyramid(),
        "JCPPR-11 (Capped Pentagonal Prism, J9)": generateCappedPentagonalPrism(),
        "JCPAPR-11 (Capped Pentagonal Antiprism, J11)": generateCappedPentagonalAntiprism(),
        "JAPPR-11 (Augmented Pentagonal Prism, J52)": generateAugmentedPentagonalPrism(),
        "JASPC-11 (Augmented Sphenocorona, J87)": generateAugmentedSphenocorona()
    },
    12: {
        "DP-12 (Dodecagon)": generateDodecagon(),
        "HPY-12 (Hendecagonal Pyramid)": generateHendecagonalPyramid(),
        "DBPY-12 (Decagonal Bipyramid)": generateDecagonalBipyramid(),
        "HPR-12 (Hexagonal Prism)": generateHexagonalPrism(),
        "HAPR-12 (Hexagonal Antiprism)": generateHexagonalAntiprism(),
        "TT-12 (Truncated Tetrahedron)": generateTruncatedTetrahedron(),
        "COC-12 (Cuboctahedral)": generateCuboctahedron(),
        "ACOC-12 (Anticuboctahedron, J27)": generateAnticuboctahedron(),
        "IC-12 (Icosahedral)": generateIcosahedron(),
        "JSC-12 (Square Cupola, J4)": generateSquareCupola(),
        "JEPBPY-12 (Elongated Pentagonal Bipyramid, J16)": generateElongatedPentagonalBipyramid(),
        "JBAPPR-12 (Biaugmented Pentagonal Prism, J53)": generateBiaugmentedPentagonalPrism(),
        "JSPMC-12 (Sphenomegacorona, J88)": generateSphenomegacorona()
    },
    20: {
        "DD-20 (Dodecahedron)": generateDodecahedron20()
    },
    24: {
        "TCU-24 (Truncated Cube)": generateTruncatedCube(),
        "TOC-24 (Truncated Octahedron)": generateTruncatedOctahedron()
    },
    48: {
        "TCOC-48 (Truncated Cuboctahedron)": generateTruncatedCuboctahedron()
    },
    60: {
        "TIC-60 (Truncated Icosahedron)": generateTruncatedIcosahedron()
    }
};

// --- END: COMPLETE SHAPE 2.1 GEOMETRY DEFINITIONS ---

// Point Group Symmetries for all Reference Geometries
// Based on official CoSyMlib/SHAPE 2.1 documentation
const POINT_GROUPS = {
    // CN=2
    "L-2 (Linear)": "D∞h",
    "vT-2 (V-shape, 109.47°)": "C2v",
    "vOC-2 (L-shape, 90°)": "C2v",

    // CN=3
    "TP-3 (Trigonal Planar)": "D3h",
    "vT-3 (Pyramid)": "C3v",
    "fac-vOC-3 (fac-Trivacant Octahedron)": "C3v",
    "mer-vOC-3 (T-shaped)": "C2v",

    // CN=4
    "SP-4 (Square Planar)": "D4h",
    "T-4 (Tetrahedral)": "Td",
    "SS-4 (Seesaw)": "C2v",
    "vTBPY-4 (Axially Vacant Trigonal Bipyramid)": "C3v",

    // CN=5
    "PP-5 (Pentagon)": "D5h",
    "vOC-5 (Square Pyramid, J1)": "C4v",
    "TBPY-5 (Trigonal Bipyramidal)": "D3h",
    "SPY-5 (Square Pyramidal)": "C4v",
    "JTBPY-5 (Johnson Trigonal Bipyramid, J12)": "D3h",

    // CN=6
    "HP-6 (Hexagon)": "D6h",
    "PPY-6 (Pentagonal Pyramid)": "C5v",
    "OC-6 (Octahedral)": "Oh",
    "TPR-6 (Trigonal Prism)": "D3h",
    "JPPY-6 (Johnson Pentagonal Pyramid, J2)": "C5v",

    // CN=7
    "HP-7 (Heptagon)": "D7h",
    "HPY-7 (Hexagonal Pyramid)": "C6v",
    "PBPY-7 (Pentagonal Bipyramidal)": "D5h",
    "COC-7 (Capped Octahedral)": "C3v",
    "CTPR-7 (Capped Trigonal Prism)": "C2v",
    "JPBPY-7 (Johnson Pentagonal Bipyramid, J13)": "D5h",
    "JETPY-7 (Elongated Triangular Pyramid, J7)": "C3v",

    // CN=8
    "OP-8 (Octagon)": "D8h",
    "HPY-8 (Heptagonal Pyramid)": "C7v",
    "HBPY-8 (Hexagonal Bipyramid)": "D6h",
    "CU-8 (Cube)": "Oh",
    "SAPR-8 (Square Antiprism)": "D4d",
    "TDD-8 (Triangular Dodecahedron)": "D2d",
    "JGBF-8 (Gyrobifastigium, J26)": "D2d",
    "JETBPY-8 (Elongated Triangular Bipyramid, J14)": "D3h",
    "JBTP-8 (Biaugmented Trigonal Prism, J50)": "C2v",
    "BTPR-8 (Biaugmented Trigonal Prism)": "C2v",
    "JSD-8 (Snub Disphenoid, J84)": "D2d",
    "TT-8 (Triakis Tetrahedron)": "Td",
    "ETBPY-8 (Elongated Trigonal Bipyramid)": "D3h",

    // CN=9
    "EP-9 (Enneagon)": "D9h",
    "OPY-9 (Octagonal Pyramid)": "C8v",
    "HBPY-9 (Heptagonal Bipyramid)": "D7h",
    "JTC-9 (Triangular Cupola, J3)": "C3v",
    "JCCU-9 (Capped Cube, J8)": "C4v",
    "CCU-9 (Capped Cube)": "C4v",
    "JCSAPR-9 (Capped Square Antiprism, J10)": "C4v",
    "CSAPR-9 (Capped Square Antiprism)": "C4v",
    "JTCTPR-9 (Tricapped Trigonal Prism, J51)": "D3h",
    "TCTPR-9 (Tricapped Trigonal Prism)": "D3h",
    "JTDIC-9 (Tridiminished Icosahedron, J63)": "C3v",
    "HH-9 (Hula-hoop)": "C2v",
    "MFF-9 (Muffin)": "Cs",

    // CN=10
    "DP-10 (Decagon)": "D10h",
    "EPY-10 (Enneagonal Pyramid)": "C9v",
    "OBPY-10 (Octagonal Bipyramid)": "D8h",
    "PPR-10 (Pentagonal Prism - ECLIPSED)": "D5h",
    "PAPR-10 (Pentagonal Antiprism - STAGGERED)": "D5d",
    "JBCCU-10 (Bicapped Cube, J15)": "D4h",
    "JBCSAPR-10 (Bicapped Square Antiprism, J17)": "D4d",
    "JMBIC-10 (Metabidiminished Icosahedron, J62)": "C2v",
    "JATDI-10 (Augmented Tridiminished Icosahedron, J64)": "C3v",
    "JSPC-10 (Sphenocorona, J87)": "C2v",
    "SDD-10 (Staggered Dodecahedron 2:6:2)": "D2",
    "TD-10 (Tetradecahedron 2:6:2)": "C2v",
    "HD-10 (Hexadecahedron 2:6:2)": "D4h",

    // CN=11
    "HP-11 (Hendecagon)": "D11h",
    "DPY-11 (Decagonal Pyramid)": "C10v",
    "EBPY-11 (Enneagonal Bipyramid)": "D9h",
    "JCPPR-11 (Capped Pentagonal Prism, J9)": "C5v",
    "JCPAPR-11 (Capped Pentagonal Antiprism, J11)": "C5v",
    "JAPPR-11 (Augmented Pentagonal Prism, J52)": "C2v",
    "JASPC-11 (Augmented Sphenocorona, J87)": "Cs",

    // CN=12
    "DP-12 (Dodecagon)": "D12h",
    "HPY-12 (Hendecagonal Pyramid)": "C11v",
    "DBPY-12 (Decagonal Bipyramid)": "D10h",
    "HPR-12 (Hexagonal Prism)": "D6h",
    "HAPR-12 (Hexagonal Antiprism)": "D6d",
    "TT-12 (Truncated Tetrahedron)": "Td",
    "COC-12 (Cuboctahedral)": "Oh",
    "ACOC-12 (Anticuboctahedron, J27)": "D3h",
    "IC-12 (Icosahedral)": "Ih",
    "JSC-12 (Square Cupola, J4)": "C4v",
    "JEPBPY-12 (Elongated Pentagonal Bipyramid, J16)": "D5h",
    "JBAPPR-12 (Biaugmented Pentagonal Prism, J53)": "C2v",
    "JSPMC-12 (Sphenomegacorona, J88)": "Cs",

    // CN=20
    "DD-20 (Dodecahedron)": "Ih",

    // CN=24
    "TCU-24 (Truncated Cube)": "Oh",
    "TOC-24 (Truncated Octahedron)": "Oh",

    // CN=48
    "TCOC-48 (Truncated Cuboctahedron)": "Oh",

    // CN=60
    "TIC-60 (Truncated Icosahedron)": "Ih"
};

export { normalize, REFERENCE_GEOMETRIES, POINT_GROUPS };

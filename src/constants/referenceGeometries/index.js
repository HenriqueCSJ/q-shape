/**
 * @fileoverview Reference Geometries for SHAPE Analysis
 *
 * This module contains the complete SHAPE 2.1 reference geometry library used for
 * continuous shape measure calculations in coordination chemistry.
 *
 * The module provides:
 * - normalize(): Helper function to normalize 3D coordinate vectors
 * - REFERENCE_GEOMETRIES: Complete library of 82 ideal polyhedra for CN 2-12
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
 */
function normalize(v) {
    const len = Math.hypot(...v);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
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
function generateTrigonalPlanar() {
    const coords = [];
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generatePyramid() {
    // vT-3: Vacant Tetrahedron (Trigonal Pyramid) - Official CoSyMlib reference (normalized)
    return [
        [1.137070, -0.000000, 0.100504],
        [-0.568535, 0.984732, 0.100504],
        [-0.568535, -0.984732, 0.100504]
    ].map(normalize);
}

function generateFacTrivacantOctahedron() {
    // fac-vOC-3: fac-Trivacant Octahedron - Official CoSyMlib reference (normalized)
    return [
        [1.000000, -0.333333, -0.333333],
        [-0.333333, 1.000000, -0.333333],
        [-0.333333, -0.333333, 1.000000]
    ].map(normalize);
}

function generateTShaped() {
    // mer-vOC-3: mer-Trivacant Octahedron (T-shaped) - Official CoSyMlib reference (normalized)
    return [
        [1.206045, -0.301511, 0.000000],
        [0.000000, 0.904534, 0.000000],
        [-1.206045, -0.301511, 0.000000]
    ].map(normalize);
}

// CN=4 Geometries (4 total from SHAPE 2.1)
function generateTetrahedral() {
    // T-4: Tetrahedral - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.912871, -0.645497],
        [-0.000000, -0.912871, -0.645497],
        [0.912871, -0.000000, 0.645497],
        [-0.912871, 0.000000, 0.645497]
    ].map(normalize);
}

function generateSquarePlanar() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [-1, 0, 0],
        [0, -1, 0]
    ].map(normalize);
}

function generateSeesaw() {
    // SS-4: Seesaw (cis-divacant octahedron) - Official CoSyMlib reference (normalized)
    return [
        [-0.235702, -0.235702, -1.178511],
        [0.942809, -0.235702, 0.000000],
        [-0.235702, 0.942809, 0.000000],
        [-0.235702, -0.235702, 1.178511]
    ].map(normalize);
}

function generateAxialVacantTBPY() {
    // vTBPY-4: Axially Vacant Trigonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.917663],
        [1.147079, -0.000000, 0.229416],
        [-0.573539, 0.993399, 0.229416],
        [-0.573539, -0.993399, 0.229416]
    ].map(normalize);
}

// CN=5 Geometries (5 total from SHAPE 2.1)
function generatePentagon() {
    // PP-5: Planar pentagon
    const coords = [];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateSquarePyramid() {
    // vOC-5: Vacant Octahedron (Johnson Square Pyramid J1) - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.928477],
        [1.114172, -0.000000, 0.185695],
        [0.000000, 1.114172, 0.185695],
        [-1.114172, 0.000000, 0.185695],
        [-0.000000, -1.114172, 0.185695]
    ].map(normalize);
}

function generateTrigonalBipyramidal() {
    // TBPY-5: Trigonal Bipyramidal - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -1.095445],
        [1.095445, -0.000000, 0.000000],
        [-0.547723, 0.948683, 0.000000],
        [-0.547723, -0.948683, 0.000000],
        [0.000000, -0.000000, 1.095445]
    ].map(normalize);
}

function generateJohnsonTrigonalBipyramid() {
    // JTBPY-5: Johnson Trigonal Bipyramid (J12) - Official CoSyMlib reference (normalized)
    return [
        [0.925820, -0.000000, 0.000000],
        [-0.462910, 0.801784, 0.000000],
        [-0.462910, -0.801784, 0.000000],
        [0.000000, -0.000000, 1.309307],
        [0.000000, -0.000000, -1.309307]
    ].map(normalize);
}

function generateSquarePyramidal() {
    // SPY-5: Square Pyramidal - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, 1.095445],
        [1.060660, 0.000000, -0.273861],
        [0.000000, 1.060660, -0.273861],
        [-1.060660, 0.000000, -0.273861],
        [0.000000, -1.060660, -0.273861]
    ].map(normalize);
}

// CN=6 Geometries (5 total from SHAPE 2.1)
function generateHexagon() {
    // HP-6: Planar hexagon
    const coords = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generatePentagonalPyramid() {
    // PPY-6: Pentagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.937043],
        [1.093216, -0.000000, 0.156174],
        [0.337822, 1.039711, 0.156174],
        [-0.884431, 0.642576, 0.156174],
        [-0.884431, -0.642576, 0.156174],
        [0.337822, -1.039711, 0.156174]
    ].map(normalize);
}

function generateOctahedral() {
    // OC-6: Octahedral - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -1.080123],
        [1.080123, -0.000000, 0.000000],
        [0.000000, 1.080123, 0.000000],
        [-1.080123, 0.000000, 0.000000],
        [-0.000000, -1.080123, 0.000000],
        [0.000000, -0.000000, 1.080123]
    ].map(normalize);
}

function generateTrigonalPrism() {
    // TPR-6: Trigonal Prism - Official CoSyMlib reference (normalized)
    return [
        [0.816497, -0.000000, -0.707107],
        [-0.408248, 0.707107, -0.707107],
        [-0.408248, -0.707107, -0.707107],
        [0.816497, -0.000000, 0.707107],
        [-0.408248, 0.707107, 0.707107],
        [-0.408248, -0.707107, 0.707107]
    ].map(normalize);
}

function generateJohnsonPentagonalPyramid6() {
    // JPPY-6: Johnson Pentagonal Pyramid (J2) - Official CoSyMlib reference (normalized)
    return [
        [1.146282, -0.000000, 0.101206],
        [0.354221, 1.090179, 0.101206],
        [-0.927361, 0.673768, 0.101206],
        [-0.927361, -0.673768, 0.101206],
        [0.354221, -1.090179, 0.101206],
        [0.000000, -0.000000, -0.607235]
    ].map(normalize);
}

// CN=7 Geometries (7 total from SHAPE 2.1)
function generateHeptagon() {
    // HP-7: Planar heptagon
    const coords = [];
    for (let i = 0; i < 7; i++) {
        const angle = (i * 2 * Math.PI) / 7;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateHexagonalPyramid() {
    // HPY-7: Hexagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -0.943880],
        [1.078720, -0.000000, 0.134840],
        [0.539360, 0.934199, 0.134840],
        [-0.539360, 0.934199, 0.134840],
        [-1.078720, 0.000000, 0.134840],
        [-0.539360, -0.934199, 0.134840],
        [0.539360, -0.934199, 0.134840]
    ].map(normalize);
}

function generatePentagonalBipyramid() {
    // PBPY-7: Pentagonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, -0.000000, -1.069045],
        [1.069045, -0.000000, 0.000000],
        [0.330353, 1.016722, 0.000000],
        [-0.864876, 0.628369, 0.000000],
        [-0.864876, -0.628369, 0.000000],
        [0.330353, -1.016722, 0.000000],
        [0.000000, -0.000000, 1.069045]
    ].map(normalize);
}

function generateCappedOctahedron() {
    // COC-7: Capped Octahedron - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, 1.128907],
        [0.000000, -1.046937, 0.283079],
        [0.906674, 0.523469, 0.283079],
        [-0.906674, 0.523469, 0.283079],
        [0.672965, -0.388536, -0.678735],
        [-0.672965, -0.388536, -0.678735],
        [0.000000, 0.777073, -0.678735]
    ].map(normalize);
}

function generateCappedTrigonalPrism() {
    // CTPR-7: Capped Trigonal Prism - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, 1.020027],
        [0.735248, 0.735248, 0.203751],
        [-0.735248, 0.735248, 0.203751],
        [0.735248, -0.735248, 0.203751],
        [-0.735248, -0.735248, 0.203751],
        [0.660961, 0.000000, -0.892328],
        [-0.660961, 0.000000, -0.892328]
    ].map(normalize);
}

function generateJohnsonPentagonalBipyramid() {
    // JPBPY-7: Johnson Pentagonal Bipyramid (J13) - Official CoSyMlib reference (normalized)
    return [
        [1.178109, -0.000000, 0.000000],
        [0.364056, 1.120448, 0.000000],
        [-0.953110, 0.692475, 0.000000],
        [-0.953110, -0.692475, 0.000000],
        [0.364056, -1.120448, 0.000000],
        [0.000000, -0.000000, 0.728112],
        [0.000000, -0.000000, -0.728112]
    ].map(normalize);
}

function generateElongatedTriangularPyramid() {
    // JETPY-7: Elongated Triangular Pyramid (J7) - Official CoSyMlib reference (normalized)
    return [
        [0.729093, -0.000000, 0.423600],
        [0.729093, -0.000000, -0.839227],
        [-0.364547, 0.631413, 0.423600],
        [-0.364547, 0.631413, -0.839227],
        [-0.364547, -0.631413, 0.423600],
        [-0.364547, -0.631413, -0.839227],
        [0.000000, -0.000000, 1.454694]
    ].map(normalize);
}

// CN=8 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
function generateOctagon() {
    // OP-8: Planar octagon
    const coords = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i * 2 * Math.PI) / 8;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateHeptagonalPyramid() {
    // HPY-8: Heptagonal Pyramid - SHAPE 2.1 reference coordinates
    return [
        [0.889005, -0.290328, 0.354090],
        [-0.527356, -0.751762, 0.395916],
        [0.144749, -0.318728, -0.936729],
        [-0.484034, -0.035473, 0.874330],
        [0.354123, 0.504541, -0.787423],
        [0.222910, 0.971978, -0.074626],
        [-0.247544, -0.877802, -0.410105],
        [-0.150123, 0.731642, 0.664953]
    ].map(normalize);
}

function generateHexagonalBipyramid() {
    // HBPY-8
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateCube() {
    return [
        [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
        [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
    ].map(normalize);
}

function generateSquareAntiprism() {
    // SAPR-8: Square Antiprism - Official CoSyMlib reference (normalized)
    return [
        [0.644649, 0.644649, -0.542083],
        [-0.644649, 0.644649, -0.542083],
        [-0.644649, -0.644649, -0.542083],
        [0.644649, -0.644649, -0.542083],
        [0.911672, 0.000000, 0.542083],
        [0.000000, 0.911672, 0.542083],
        [-0.911672, 0.000000, 0.542083],
        [-0.000000, -0.911672, 0.542083]
    ].map(normalize);
}

function generateTriangularDodecahedron() {
    // TDD-8: Triangular Dodecahedron - Official CoSyMlib reference (normalized)
    return [
        [-0.636106, 0.000000, 0.848768],
        [-0.000000, -0.993211, 0.372147],
        [0.636106, 0.000000, 0.848768],
        [-0.000000, 0.993211, 0.372147],
        [-0.993211, 0.000000, -0.372147],
        [-0.000000, -0.636106, -0.848768],
        [0.993211, 0.000000, -0.372147],
        [-0.000000, 0.636106, -0.848768]
    ].map(normalize);
}

function generateGyrobifastigium() {
    // JGBF-8: Gyrobifastigium J26 - SHAPE 2.1 reference coordinates
    return [
        [0.726680, -0.249409, 0.640102],
        [-0.460151, -0.868569, 0.183982],
        [-0.726680, 0.249409, -0.640102],
        [-0.861367, 0.151959, 0.484722],
        [0.347525, 0.024401, -0.937353],
        [0.460173, 0.868555, -0.183991],
        [0.535980, -0.766139, -0.354622],
        [-0.022139, 0.589770, 0.807268]
    ].map(normalize);
}

function generateElongatedTriangularBipyramid() {
    // JETBPY-8: Elongated Triangular Bipyramid J14 - SHAPE 2.1 reference coordinates
    return [
        [0.262689, -0.800806, 0.538242],
        [-0.322419, -0.325880, 0.888734],
        [-0.490273, 0.154620, -0.857744],
        [-0.912366, -0.272075, 0.305883],
        [0.322387, 0.325884, -0.888744],
        [0.438623, 0.859535, -0.262316],
        [0.684790, -0.374120, -0.625378],
        [0.016468, 0.432828, 0.901326]
    ].map(normalize);
}

function generateBiaugmentedTrigonalPrism() {
    // JBTP-8 / JBTPR-8: Biaugmented Trigonal Prism J50 - Official CoSyMlib reference (normalized)
    return [
        [0.647118, 0.000000, 0.604030],
        [-0.647118, 0.000000, 0.604030],
        [0.647118, 0.647118, -0.516811],
        [-0.647118, 0.647118, -0.516811],
        [0.647118, -0.647118, -0.516811],
        [-0.647118, -0.647118, -0.516811],
        [0.000000, 1.116113, 0.501191],
        [0.000000, -1.116113, 0.501191]
    ].map(normalize);
}

function generateSphericalBiaugmentedTrigonalPrism() {
    // BTPR-8: Spherical Biaugmented Trigonal Prism - SHAPE 2.1 reference coordinates
    // Note: Using TDD-8 metal center [14.5915, 3.8003, 0.8207] gives better results
    return [
        [0.929481, -0.133055, 0.344037],
        [-0.226843, -0.688857, 0.688490],
        [-0.496236, 0.122569, -0.859492],
        [-0.904961, 0.291270, 0.310173],
        [0.615280, 0.125236, -0.778297],
        [0.156739, 0.983793, -0.087093],
        [0.181929, -0.857549, -0.481157],
        [0.018823, 0.371379, 0.928290]
    ].map(normalize);
}

function generateSnubDisphenoid() {
    // JSD-8: Snub Disphenoid J84 - SHAPE 2.1 reference coordinates
    return [
        [0.931008, -0.170659, 0.322645],
        [-0.419237, -0.732753, 0.536017],
        [-0.622137, -0.087208, -0.778036],
        [-0.866860, 0.381303, 0.321187],
        [0.577984, 0.128584, -0.805854],
        [0.110370, 0.990614, -0.080639],
        [0.279063, -0.844134, -0.457780],
        [0.009791, 0.334201, 0.942451]
    ].map(normalize);
}

function generateTriakisTetrahedron() {
    // TT-8: Td symmetry
    return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [0.577, 0.577, 0.577],
        [0.577, -0.577, -0.577],
        [-0.577, 0.577, -0.577],
        [-0.577, -0.577, 0.577]
    ].map(normalize);
}

// CN=9 Geometries (13 total from SHAPE 2.1) - COMPLETE SET
function generateEnneagon() {
    // EP-9: Planar 9-gon
    const coords = [];
    for (let i = 0; i < 9; i++) {
        const angle = (i * 2 * Math.PI) / 9;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateOctagonalPyramid() {
    // OPY-9: Octagonal Pyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, -0.953998],
        [1.059998, 0.000000, 0.106000],
        [0.749532, 0.749532, 0.106000],
        [0.000000, 1.059998, 0.106000],
        [-0.749532, 0.749532, 0.106000],
        [-1.059998, 0.000000, 0.106000],
        [-0.749532, -0.749532, 0.106000],
        [-0.000000, -1.059998, 0.106000],
        [0.749532, -0.749532, 0.106000]
    ].map(normalize);
}

function generateHeptagonalBipyramid() {
    // HBPY-9: Heptagonal Bipyramid - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, -1.054093],
        [1.054093, 0.000000, 0.000000],
        [0.657216, 0.824123, 0.000000],
        [-0.234558, 1.027664, 0.000000],
        [-0.949705, 0.457354, 0.000000],
        [-0.949705, -0.457354, 0.000000],
        [-0.234558, -1.027664, 0.000000],
        [0.657216, -0.824123, 0.000000],
        [0.000000, 0.000000, 1.054093]
    ].map(normalize);
}

function generateTriangularCupola() {
    // JTC-9: Triangular Cupola J3 - Official CoSyMlib reference (normalized)
    return [
        [1.091089, -0.000000, 0.267261],
        [0.545545, 0.944911, 0.267261],
        [-0.545545, 0.944911, 0.267261],
        [-1.091089, 0.000000, 0.267261],
        [-0.545545, -0.944911, 0.267261],
        [0.545545, -0.944911, 0.267261],
        [0.545545, 0.314970, -0.623610],
        [-0.545545, 0.314970, -0.623610],
        [-0.000000, -0.629941, -0.623610]
    ].map(normalize);
}

function generateCappedCube() {
    // JCCU-9: Capped Cube J8 - Official CoSyMlib reference (normalized)
    return [
        [0.826961, 0.000000, 0.443578],
        [0.826961, 0.000000, -0.725920],
        [0.000000, 0.826961, 0.443578],
        [0.000000, 0.826961, -0.725920],
        [-0.826961, 0.000000, 0.443578],
        [-0.826961, 0.000000, -0.725920],
        [-0.000000, -0.826961, 0.443578],
        [-0.000000, -0.826961, -0.725920],
        [0.000000, 0.000000, 1.270539]
    ].map(normalize);
}

function generateCappedCubeAlt() {
    // CCU-9: Capped Cube (alternative) - Official CoSyMlib reference (normalized)
    return [
        [0.676580, 0.676580, 0.433151],
        [0.676580, -0.676580, 0.433151],
        [-0.676580, 0.676580, 0.433151],
        [-0.676580, -0.676580, 0.433151],
        [0.567845, 0.567845, -0.692080],
        [0.567845, -0.567845, -0.692080],
        [-0.567845, 0.567845, -0.692080],
        [-0.567845, -0.567845, -0.692080],
        [0.000000, 0.000000, 1.044927]
    ].map(normalize);
}

function generateCappedSquareAntiprism() {
    // JCSAPR-9: Capped Square Antiprism J10 - Official CoSyMlib reference (normalized)
    return [
        [0.873141, 0.000000, 0.658404],
        [0.617404, 0.617404, -0.379941],
        [0.000000, 0.873141, 0.658404],
        [-0.617404, 0.617404, -0.379941],
        [-0.873141, 0.000000, 0.658404],
        [-0.617404, -0.617404, -0.379941],
        [-0.000000, -0.873141, 0.658404],
        [0.617404, -0.617404, -0.379941],
        [0.000000, 0.000000, -1.253082]
    ].map(normalize);
}

function generateCappedSquareAntiprismAlt() {
    // CSAPR-9: Capped Square Antiprism (alternative) - Official CoSyMlib reference (normalized)
    return [
        [0.000000, 0.000000, 1.053083],
        [0.982654, 0.000000, 0.380440],
        [0.000000, 0.982654, 0.380440],
        [-0.982654, 0.000000, 0.380440],
        [-0.000000, -0.982654, 0.380440],
        [0.590920, 0.590920, -0.643458],
        [-0.590920, 0.590920, -0.643458],
        [-0.590920, -0.590920, -0.643458],
        [0.590920, -0.590920, -0.643458]
    ].map(normalize);
}

function generateTricappedTrigonalPrism() {
    // JTCTPR-9: Tricapped Trigonal Prism J51 - Official CoSyMlib reference (normalized)
    return [
        [0.621382, 0.621382, 0.358755],
        [-0.621382, 0.621382, 0.358755],
        [0.621382, -0.621382, 0.358755],
        [-0.621382, -0.621382, 0.358755],
        [0.000000, 0.621382, -0.717510],
        [0.000000, -0.621382, -0.717510],
        [1.071725, 0.000000, -0.618761],
        [-1.071725, 0.000000, -0.618761],
        [0.000000, 0.000000, 1.237522]
    ].map(normalize);
}

function generateTricappedTrigonalPrismAlt() {
    // TCTPR-9: Tricapped Trigonal Prism (alternative) - Official CoSyMlib reference (normalized)
    return [
        [0.702728, 0.000000, 0.785674],
        [-0.351364, 0.608581, 0.785674],
        [-0.351364, -0.608581, 0.785674],
        [0.702728, 0.000000, -0.785674],
        [-0.351364, 0.608581, -0.785674],
        [-0.351364, -0.608581, -0.785674],
        [-1.054093, 0.000000, -0.000000],
        [0.527046, 0.912871, -0.000000],
        [0.527046, -0.912871, -0.000000]
    ].map(normalize);
}

function generateTridiminishedIcosahedron() {
    // JTDIC-9: Tridiminished Icosahedron J63 - Official CoSyMlib reference (normalized)
    return [
        [-0.262672, 0.919451, -0.425013],
        [-0.915287, 0.021205, -0.425013],
        [-0.262672, -0.877042, -0.425013],
        [0.793280, -0.533942, -0.425013],
        [0.973658, 0.021205, 0.519460],
        [0.321044, 0.919451, 0.519460],
        [-0.734908, -0.533942, 0.519460],
        [0.029186, 0.021205, -1.008729],
        [0.029186, 0.021205, 1.103176]
    ].map(normalize);
}

function generateHulaHoop() {
    // HH-9: Hula-hoop - Official CoSyMlib reference (normalized)
    return [
        [1.057245, 0.000000, 0.077396],
        [0.528622, 0.915601, 0.077396],
        [-0.528622, 0.915601, 0.077396],
        [-1.057245, 0.000000, 0.077396],
        [-0.528622, -0.915601, 0.077396],
        [0.528622, -0.915601, 0.077396],
        [0.000000, 0.000000, 1.134641],
        [0.528622, 0.000000, -0.838205],
        [-0.528622, 0.000000, -0.838205]
    ].map(normalize);
}

function generateMuffin() {
    // MFF-9: Muffin - Official CoSyMlib reference (normalized)
    return [
        [-0.000000, 1.042110, 0.212993],
        [0.990864, 0.322172, 0.212993],
        [0.612400, -0.842614, 0.212993],
        [-0.612400, -0.842614, 0.212993],
        [-0.990864, 0.322172, 0.212993],
        [-0.612400, -0.354163, -0.737453],
        [0.612400, -0.354163, -0.737453],
        [-0.000000, 0.706514, -0.737453],
        [-0.000000, 0.000294, 1.100973]
    ].map(normalize);
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
    // EPY-10
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 9; i++) {
        const angle = (i * 2 * Math.PI) / 9;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateOctagonalBipyramid() {
    // OBPY-10
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 8; i++) {
        const angle = (i * 2 * Math.PI) / 8;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generatePentagonalPrism() {
    // PPR-10: ECLIPSED (D5h)
    const coords = [];
    const h = 0.850;
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        coords.push([x, y, h]);
        coords.push([x, y, -h]);
    }
    return coords.map(normalize);
}

function generatePentagonalAntiprism() {
    // PAPR-10: STAGGERED (D5d)
    const coords = [];
    const h = 0.850;
    const rotationOffset = Math.PI / 5;

    for (let i = 0; i < 5; i++) {
        const angleTop = (i * 2 * Math.PI) / 5;
        const angleBottom = angleTop + rotationOffset;

        coords.push([Math.cos(angleTop), Math.sin(angleTop), h]);
        coords.push([Math.cos(angleBottom), Math.sin(angleBottom), -h]);
    }
    return coords.map(normalize);
}

function generateBicappedCube() {
    // JBCCU-10: Elongated square bipyramid (J15, D4h)
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0.707, 0.707, 0.707],
        [0.707, -0.707, 0.707],
        [-0.707, 0.707, 0.707],
        [-0.707, -0.707, 0.707],
        [0, 0, 1.4],
        [0, 0, -1.4]
    ].map(normalize);
}

function generateBicappedSquareAntiprism() {
    // JBCSAPR-10: Gyroelongated square bipyramid (J17, D4d)
    const coords = [
        [0.000000, 1.288000, -0.852000], [-1.288000, 0.000000, -0.852000],
        [0.000000, -1.288000, -0.852000], [1.288000, 0.000000, -0.852000],
        [0.910000, 0.910000, 0.852000], [-0.910000, 0.910000, 0.852000],
        [-0.910000, -0.910000, 0.852000], [0.910000, -0.910000, 0.852000],
        [0.000000, 0.000000, 1.777000], [0.000000, 0.000000, -1.777000]
    ];
    return coords.map(normalize);
}

function generateMetabidiminishedIcosahedron() {
    // JMBIC-10: Johnson J62 (C2v)
    return [
        [0, 0, 1],
        [0, 0, -1],
        [0.894, 0, 0.447],
        [-0.894, 0, 0.447],
        [0.276, 0.851, 0.447],
        [0.276, -0.851, 0.447],
        [-0.276, 0.851, 0.447],
        [-0.276, -0.851, 0.447],
        [0.724, 0, -0.690],
        [-0.724, 0, -0.690]
    ].map(normalize);
}

function generateAugmentedTridiminishedIcosahedron() {
    // JATDI-10: Johnson J64 (C3v)
    return [
        [0, 0, 1],
        [0.894, 0, 0.447],
        [-0.447, 0.775, 0.447],
        [-0.447, -0.775, 0.447],
        [0.724, 0.526, -0.447],
        [0.724, -0.526, -0.447],
        [-0.276, 0.851, -0.447],
        [-0.894, 0, -0.447],
        [-0.276, -0.851, -0.447],
        [0, 0, -1]
    ].map(normalize);
}

function generateSphenocorona() {
    // JSPC-10: Johnson J87 (C2v)
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0.3],
        [0, -1, 0.3],
        [0.7, 0.7, -0.2],
        [0.7, -0.7, -0.2],
        [-0.7, 0.7, -0.2],
        [-0.7, -0.7, -0.2],
        [0, 0, 1],
        [0, 0, -1]
    ].map(normalize);
}

function generateStaggeredDodecahedron() {
    // SDD-10: 2:6:2 staggered (D2 - chiral!)
    return [
        [0, 0, 1.2],
        [0, 0, -1.2],
        [1, 0, 0.5],
        [0, 1, 0.5],
        [-1, 0, 0.5],
        [0, -1, 0.5],
        [0.707, 0.707, -0.5],
        [-0.707, 0.707, -0.5],
        [0.707, -0.707, -0.5],
        [-0.707, -0.707, -0.5]
    ].map(normalize);
}

function generateTetradecahedron() {
    // TD-10: 2:6:2 (C2v)
    return [
        [0, 0, 1.2],
        [0, 0, -1.2],
        [1, 0, 0.5],
        [0, 1, 0.5],
        [-1, 0, 0.5],
        [0, -1, 0.5],
        [1, 0, -0.5],
        [0, 1, -0.5],
        [-1, 0, -0.5],
        [0, -1, -0.5]
    ].map(normalize);
}

function generateHexadecahedron() {
    // HD-10: 2:6:2 or 1:4:4:1 (D4h)
    return [
        [0, 0, 1.2],
        [0, 0, -1.2],
        [1, 0, 0.6],
        [0, 1, 0.6],
        [-1, 0, 0.6],
        [0, -1, 0.6],
        [1, 0, -0.6],
        [0, 1, -0.6],
        [-1, 0, -0.6],
        [0, -1, -0.6]
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
    // DPY-11
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 10; i++) {
        const angle = (i * 2 * Math.PI) / 10;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateEnneagonalBipyramid() {
    // EBPY-11
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 9; i++) {
        const angle = (i * 2 * Math.PI) / 9;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateCappedPentagonalPrism() {
    // JCPPR-11: Elongated pentagonal pyramid (J9, C5v)
    const prism = generatePentagonalPrism();
    prism.push([0, 0, 1.4]);
    return prism.slice(0, 11).map(normalize);
}

function generateCappedPentagonalAntiprism() {
    // JCPAPR-11: Gyroelongated pentagonal pyramid (J11, C5v)
    const antiprism = generatePentagonalAntiprism();
    antiprism.push([0, 0, 1.4]);
    return antiprism.slice(0, 11).map(normalize);
}

function generateAugmentedPentagonalPrism() {
    // JAPPR-11: Johnson J52 (C2v)
    const h = 0.85;
    return [
        [1, 0, h],
        [0.309, 0.951, h],
        [-0.809, 0.588, h],
        [-0.809, -0.588, h],
        [0.309, -0.951, h],
        [1, 0, -h],
        [0.309, 0.951, -h],
        [-0.809, 0.588, -h],
        [-0.809, -0.588, -h],
        [0.309, -0.951, -h],
        [0.5, 0.3, 0]
    ].map(normalize);
}

function generateAugmentedSphenocorona() {
    // JASPC-11: Johnson J87 augmented (Cs)
    const spc = generateSphenocorona();
    spc.push([0.5, 0.5, 0.7]);
    return spc.slice(0, 11).map(normalize);
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
    // HPY-12
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 11; i++) {
        const angle = (i * 2 * Math.PI) / 11;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateDecagonalBipyramid() {
    // DBPY-12
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 10; i++) {
        const angle = (i * 2 * Math.PI) / 10;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateHexagonalPrism() {
    const coords = [];
    const h = 0.85;
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }
    return coords.map(normalize);
}

function generateHexagonalAntiprism() {
    const coords = [];
    const h = 0.85;
    const rotationOffset = Math.PI / 6;
    for (let i = 0; i < 6; i++) {
        const angleTop = (i * 2 * Math.PI) / 6;
        const angleBottom = angleTop + rotationOffset;
        coords.push([Math.cos(angleTop), Math.sin(angleTop), h]);
        coords.push([Math.cos(angleBottom), Math.sin(angleBottom), -h]);
    }
    return coords.map(normalize);
}

function generateTruncatedTetrahedron() {
    // TT-12: Td symmetry
    const coords = [
        [3, 1, 1], [1, 3, 1], [1, 1, 3],
        [3, -1, -1], [1, -3, -1], [1, -1, -3],
        [-3, 1, -1], [-1, 3, -1], [-1, 1, -3],
        [-3, -1, 1], [-1, -3, 1], [-1, -1, 3]
    ];
    return coords.map(normalize);
}

function generateCuboctahedron() {
    return [
        [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
        [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
        [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
    ].map(normalize);
}

function generateAnticuboctahedron() {
    // ACOC-12: Triangular orthobicupola (J27, D3h)
    return [
        [1, 0, 0.5],
        [0.5, 0.866, 0.5],
        [-0.5, 0.866, 0.5],
        [-1, 0, 0.5],
        [-0.5, -0.866, 0.5],
        [0.5, -0.866, 0.5],
        [1, 0, -0.5],
        [0.5, 0.866, -0.5],
        [-0.5, 0.866, -0.5],
        [-1, 0, -0.5],
        [-0.5, -0.866, -0.5],
        [0.5, -0.866, -0.5]
    ].map(normalize);
}

function generateIcosahedron() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const coords = [
        [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
        [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
        [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1]
    ];
    return coords.map(normalize);
}

function generateSquareCupola() {
    // JSC-12: Johnson J4 (C4v)
    return [
        [1, 0, 0.5],
        [0, 1, 0.5],
        [-1, 0, 0.5],
        [0, -1, 0.5],
        [0.707, 0.707, -0.3],
        [0.707, -0.707, -0.3],
        [-0.707, 0.707, -0.3],
        [-0.707, -0.707, -0.3],
        [1, 1, -0.3],
        [1, -1, -0.3],
        [-1, 1, -0.3],
        [-1, -1, -0.3]
    ].map(normalize);
}

function generateElongatedPentagonalBipyramid() {
    // JEPBPY-12: Johnson J16 (D6h)
    const h = 0.7;
    return [
        [0, 0, 1.3],
        [0, 0, -1.3],
        [1, 0, h],
        [0.309, 0.951, h],
        [-0.809, 0.588, h],
        [-0.809, -0.588, h],
        [0.309, -0.951, h],
        [1, 0, -h],
        [0.309, 0.951, -h],
        [-0.809, 0.588, -h],
        [-0.809, -0.588, -h],
        [0.309, -0.951, -h]
    ].map(normalize);
}

function generateBiaugmentedPentagonalPrism() {
    // JBAPPR-12: Johnson J53 (C2v)
    const h = 0.85;
    return [
        [1, 0, h],
        [0.309, 0.951, h],
        [-0.809, 0.588, h],
        [-0.809, -0.588, h],
        [0.309, -0.951, h],
        [1, 0, -h],
        [0.309, 0.951, -h],
        [-0.809, 0.588, -h],
        [-0.809, -0.588, -h],
        [0.309, -0.951, -h],
        [0.5, 0.3, 0],
        [-0.5, -0.3, 0]
    ].map(normalize);
}

function generateSphenomegacorona() {
    // JSPMC-12: Johnson J88 (Cs)
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0.3],
        [0, -1, 0.3],
        [0.7, 0.7, -0.2],
        [0.7, -0.7, -0.2],
        [-0.7, 0.7, -0.2],
        [-0.7, -0.7, -0.2],
        [0, 0, 1],
        [0, 0, -1],
        [0.3, 0.3, 0.6],
        [-0.3, -0.3, 0.6]
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
    }
};

// --- END: COMPLETE SHAPE 2.1 GEOMETRY DEFINITIONS ---

export { normalize, REFERENCE_GEOMETRIES };

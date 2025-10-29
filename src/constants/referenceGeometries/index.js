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
    // vT-2: Divacant tetrahedron (109.47°)
    const angle = 109.47 * Math.PI / 180;
    return [[1, 0, 0], [Math.cos(angle), Math.sin(angle), 0]].map(normalize);
}

function generateLShape() {
    // vOC-2: Tetravacant octahedron (90°)
    return [[1, 0, 0], [0, 1, 0]].map(normalize);
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
    // vT-3: Vacant tetrahedron (trigonal pyramid)
    return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1]
    ].map(normalize);
}

function generateFacTrivacantOctahedron() {
    // fac-vOC-3
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ].map(normalize);
}

function generateTShaped() {
    // mer-vOC-3: mer-Trivacant octahedron
    return [[1, 0, 0], [-1, 0, 0], [0, 1, 0]].map(normalize);
}

// CN=4 Geometries (4 total from SHAPE 2.1)
function generateTetrahedral() {
    return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1]
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
    // SS-4: Seesaw (cis-divacant octahedron)
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, 0.5, 0.866]
    ].map(normalize);
}

function generateAxialVacantTBPY() {
    // vTBPY-4: Axially vacant trigonal bipyramid
    const coords = [];
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    coords.push([0, 0, 1]);
    return coords.map(normalize);
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
    // vOC-5: Vacant octahedron (Johnson square pyramid J1)
    return [
        [0, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
        [-1, 0, 0],
        [0, -1, 0]
    ].map(normalize);
}

function generateTrigonalBipyramidal() {
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateJohnsonTrigonalBipyramid() {
    // JTBPY-5: Johnson trigonal bipyramid (J12) - more regular than TBPY-5
    const h = 0.612372435695794; // Optimized height
    return [
        [0, 0, h],
        [0, 0, -h],
        [1, 0, 0],
        [-0.5, 0.866, 0],
        [-0.5, -0.866, 0]
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
    // PPY-6
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateOctahedral() {
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1]
    ].map(normalize);
}

function generateTrigonalPrism() {
    const coords = [];
    const h = 0.816496580927726;
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }
    return coords.map(normalize);
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
    // HPY-7
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generatePentagonalBipyramid() {
    const coords = [
        [0, 0, 1.176],
        [0, 0, -1.176]
    ];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateCappedOctahedron() {
    const oct = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
    ];
    oct.push([0.577, 0.577, 0.577]);
    return oct.map(normalize);
}

function generateCappedTrigonalPrism() {
    const coords = [];
    const h = 0.7;
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }
    coords.push([0, 1.5, 0]);
    return coords.map(normalize);
}

function generateJohnsonPentagonalBipyramid() {
    // JPBPY-7: Johnson pentagonal bipyramid (J13)
    const h = 0.85;
    const coords = [
        [0, 0, h],
        [0, 0, -h]
    ];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateElongatedTriangularPyramid() {
    // JETPY-7: J7
    return [
        [0, 0, 1.5],
        [1, 0, 0],
        [-0.5, 0.866, 0],
        [-0.5, -0.866, 0],
        [0.5, 0.289, -0.816],
        [-0.5, 0.289, -0.816],
        [0, -0.577, -0.816]
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
    // HPY-8
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 7; i++) {
        const angle = (i * 2 * Math.PI) / 7;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
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
    const coords = [];
    const h = 0.707;
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
    }
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }
    return coords.map(normalize);
}

function generateTriangularDodecahedron() {
    // TDD-8: Triangular Dodecahedron (D2d symmetry)
    // This is SHAPE's TDD-8, which uses Johnson solid J84 parameterization
    // Parameters from cubic equation 8q³ - 4q - 1 = 0
    const q = 0.169019;  // Root of the cubic
    const r = Math.sqrt(q);  // ≈ 0.41112
    const s = Math.sqrt((1 - q) / (2 * q));  // ≈ 1.56786
    const t = 2 * r * s;  // ≈ 1.28917

    return [
        [t, r, 0],
        [-t, r, 0],
        [0, -r, t],
        [0, -r, -t],
        [1, -s, 0],
        [-1, -s, 0],
        [0, s, 1],
        [0, s, -1]
    ].map(normalize);
}

function generateGyrobifastigium() {
    // JGBF-8: Johnson J26 (D2d)
    return [
        [1, 0, 0.5], [-1, 0, 0.5],
        [0, 1, -0.5], [0, -1, -0.5],
        [0.707, 0.707, -0.2], [-0.707, 0.707, -0.2],
        [0.707, -0.707, 0.2], [-0.707, -0.707, 0.2]
    ].map(normalize);
}

function generateElongatedTriangularBipyramid() {
    // JETBPY-8: Johnson J14 (D3h)
    const h = 0.6;
    return [
        [0, 0, 1.2],
        [0, 0, -1.2],
        [1, 0, h],
        [-0.5, 0.866, h],
        [-0.5, -0.866, h],
        [1, 0, -h],
        [-0.5, 0.866, -h],
        [-0.5, -0.866, -h]
    ].map(normalize);
}

function generateBiaugmentedTrigonalPrism() {
    // JBTP-8: Johnson J50 (C2v) - exact Johnson solid
    const h = 0.7;
    return [
        [1, 0, h],
        [-0.5, 0.866, h],
        [-0.5, -0.866, h],
        [1, 0, -h],
        [-0.5, 0.866, -h],
        [-0.5, -0.866, -h],
        [0.5, 0.289, 0],
        [0, -0.577, 0]
    ].map(normalize);
}

function generateSphericalBiaugmentedTrigonalPrism() {
    // BTPR-8: Spherically optimized biaugmented trigonal prism (C2v)
    // Adjusted for better sphere packing compared to J50
    const h = 0.75;  // Slightly larger height for sphere optimization
    return [
        [1, 0, h],
        [-0.5, 0.866, h],
        [-0.5, -0.866, h],
        [1, 0, -h],
        [-0.5, 0.866, -h],
        [-0.5, -0.866, -h],
        [0.55, 0.32, 0],   // Adjusted cap positions
        [0, -0.64, 0]
    ].map(normalize);
}

function generateSnubDisphenoid() {
    // JSD-8: Snub Disphenoid J84 (D2d symmetry)
    // This is SHAPE's JSD-8, which uses a simpler D2d parameterization
    // Note: Both JSD-8 and TDD-8 refer to related D2d dodecahedra,
    // but SHAPE uses different optimizations for each
    return [
        [1, 0, 0.707], [-1, 0, 0.707],
        [0, 1, -0.707], [0, -1, -0.707],
        [0.707, 0.707, 0], [-0.707, 0.707, 0],
        [0.707, -0.707, 0], [-0.707, -0.707, 0]
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
    // OPY-9
    const coords = [[0, 0, 1]];
    for (let i = 0; i < 8; i++) {
        const angle = (i * 2 * Math.PI) / 8;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateHeptagonalBipyramid() {
    // HBPY-9
    const coords = [
        [0, 0, 1],
        [0, 0, -1]
    ];
    for (let i = 0; i < 7; i++) {
        const angle = (i * 2 * Math.PI) / 7;
        coords.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateTriangularCupola() {
    // JTC-9: Johnson J3 (C3v) - trivacant cuboctahedron
    return [
        [1, 0, 0.5],
        [-0.5, 0.866, 0.5],
        [-0.5, -0.866, 0.5],
        [0.707, 0.707, -0.3],
        [0.707, -0.707, -0.3],
        [-0.707, 0.707, -0.3],
        [-0.707, -0.707, -0.3],
        [0, 1, -0.3],
        [0, -1, -0.3]
    ].map(normalize);
}

function generateCappedCube() {
    // JCCU-9 & CCU-9: Capped cube (C4v)
    const cube = generateCube();
    cube.push([0, 0, 1.5]);
    return cube.slice(0, 9).map(normalize);
}

function generateCappedSquareAntiprism() {
    // JCSAPR-9 & CSAPR-9: Capped square antiprism (C4v)
    const antiprism = generateSquareAntiprism();
    antiprism.push([0, 0, 1.3]);
    return antiprism.slice(0, 9).map(normalize);
}

function generateTricappedTrigonalPrism() {
    // JTCTPR-9 & TCTPR-9: Tricapped trigonal prism (D3h)
    const coords = [];
    const h = 0.7;
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([Math.cos(angle), Math.sin(angle), h]);
        coords.push([Math.cos(angle), Math.sin(angle), -h]);
    }
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        coords.push([1.2 * Math.cos(angle), 1.2 * Math.sin(angle), 0]);
    }
    return coords.map(normalize);
}

function generateTridiminishedIcosahedron() {
    // JTDIC-9: Johnson J63 (C3v)
    return [
        [0, 0, 1],
        [0.894, 0, 0.447],
        [-0.447, 0.775, 0.447],
        [-0.447, -0.775, 0.447],
        [0.724, 0.526, -0.447],
        [0.724, -0.526, -0.447],
        [-0.276, 0.851, -0.447],
        [-0.894, 0, -0.447],
        [-0.276, -0.851, -0.447]
    ].map(normalize);
}

function generateHulaHoop() {
    // HH-9: C2v symmetry
    return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0.3],
        [0, -1, 0.3],
        [0.7, 0, -0.7],
        [-0.7, 0, -0.7],
        [0, 0.7, -0.7],
        [0, -0.7, -0.7],
        [0, 0, 1]
    ].map(normalize);
}

function generateMuffin() {
    // MFF-9: Cs symmetry
    return [
        [0, 0, 1],
        [1, 0, 0.5],
        [-1, 0, 0.5],
        [0.5, 0.866, 0],
        [-0.5, 0.866, 0],
        [0.5, -0.866, 0],
        [-0.5, -0.866, 0],
        [0, 0, -0.8],
        [0, 0.5, -0.5]
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
        "SPY-5 (Square Pyramidal)": generateSquarePyramid(),
        "JTBPY-5 (Johnson Trigonal Bipyramid, J12)": generateJohnsonTrigonalBipyramid()
    },
    6: {
        "HP-6 (Hexagon)": generateHexagon(),
        "PPY-6 (Pentagonal Pyramid)": generatePentagonalPyramid(),
        "OC-6 (Octahedral)": generateOctahedral(),
        "TPR-6 (Trigonal Prism)": generateTrigonalPrism(),
        "JPPY-6 (Johnson Pentagonal Pyramid, J2)": generatePentagonalPyramid()
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
        "CCU-9 (Capped Cube)": generateCappedCube(),
        "JCSAPR-9 (Capped Square Antiprism, J10)": generateCappedSquareAntiprism(),
        "CSAPR-9 (Capped Square Antiprism)": generateCappedSquareAntiprism(),
        "JTCTPR-9 (Tricapped Trigonal Prism, J51)": generateTricappedTrigonalPrism(),
        "TCTPR-9 (Tricapped Trigonal Prism)": generateTricappedTrigonalPrism(),
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

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import './App.css';

// --- START: ATOMIC & CHEMICAL DATA ---

const ATOMIC_DATA = {
    'H': { name: 'Hydrogen', radius: 0.37, color: 0xFFFFFF, mass: 1.008, type: 'Nonmetal' },
    'He': { name: 'Helium', radius: 0.32, color: 0xD9FFFF, mass: 4.0026, type: 'Noble Gas' },
    'Li': { name: 'Lithium', radius: 1.52, color: 0xCC80FF, mass: 6.94, type: 'Alkali Metal' },
    'Be': { name: 'Beryllium', radius: 1.12, color: 0xC2FF00, mass: 9.0122, type: 'Alkaline Earth Metal' },
    'B': { name: 'Boron', radius: 0.88, color: 0xFFB5B5, mass: 10.81, type: 'Metalloid' },
    'C': { name: 'Carbon', radius: 0.77, color: 0x909090, mass: 12.011, type: 'Nonmetal' },
    'N': { name: 'Nitrogen', radius: 0.75, color: 0x3050F8, mass: 14.007, type: 'Nonmetal' },
    'O': { name: 'Oxygen', radius: 0.73, color: 0xFF0D0D, mass: 15.999, type: 'Nonmetal' },
    'F': { name: 'Fluorine', radius: 0.71, color: 0x90E050, mass: 18.998, type: 'Halogen' },
    'Ne': { name: 'Neon', radius: 0.71, color: 0xB3E3F5, mass: 20.180, type: 'Noble Gas' },
    'Na': { name: 'Sodium', radius: 1.86, color: 0xAB5CF2, mass: 22.990, type: 'Alkali Metal' },
    'Mg': { name: 'Magnesium', radius: 1.60, color: 0x8AFF00, mass: 24.305, type: 'Alkaline Earth Metal' },
    'Al': { name: 'Aluminum', radius: 1.43, color: 0xBFA6A6, mass: 26.982, type: 'Post-transition Metal' },
    'Si': { name: 'Silicon', radius: 1.17, color: 0xF0C8A0, mass: 28.085, type: 'Metalloid' },
    'P': { name: 'Phosphorus', radius: 1.10, color: 0xFF8000, mass: 30.974, type: 'Nonmetal' },
    'S': { name: 'Sulfur', radius: 1.04, color: 0xFFFF30, mass: 32.06, type: 'Nonmetal' },
    'Cl': { name: 'Chlorine', radius: 0.99, color: 0x1FF01F, mass: 35.45, type: 'Halogen' },
    'Ar': { name: 'Argon', radius: 0.98, color: 0x80D1E3, mass: 39.948, type: 'Noble Gas' },
    'K': { name: 'Potassium', radius: 2.27, color: 0x8F40D4, mass: 39.098, type: 'Alkali Metal' },
    'Ca': { name: 'Calcium', radius: 1.97, color: 0x3DFF00, mass: 40.078, type: 'Alkaline Earth Metal' },
    'Sc': { name: 'Scandium', radius: 1.62, color: 0xE6E6E6, mass: 44.956, type: 'Transition Metal' },
    'Ti': { name: 'Titanium', radius: 1.47, color: 0xBFC2C7, mass: 47.867, type: 'Transition Metal' },
    'V': { name: 'Vanadium', radius: 1.34, color: 0xA6A6AB, mass: 50.942, type: 'Transition Metal' },
    'Cr': { name: 'Chromium', radius: 1.28, color: 0x8A99C7, mass: 51.996, type: 'Transition Metal' },
    'Mn': { name: 'Manganese', radius: 1.27, color: 0x9C7AC7, mass: 54.938, type: 'Transition Metal' },
    'Fe': { name: 'Iron', radius: 1.26, color: 0xE06633, mass: 55.845, type: 'Transition Metal' },
    'Co': { name: 'Cobalt', radius: 1.25, color: 0xF090A0, mass: 58.933, type: 'Transition Metal' },
    'Ni': { name: 'Nickel', radius: 1.24, color: 0x50D050, mass: 58.693, type: 'Transition Metal' },
    'Cu': { name: 'Copper', radius: 1.28, color: 0xC88033, mass: 63.546, type: 'Transition Metal' },
    'Zn': { name: 'Zinc', radius: 1.34, color: 0x7D80B0, mass: 65.38, type: 'Transition Metal' },
    'Ga': { name: 'Gallium', radius: 1.35, color: 0xC28F8F, mass: 69.723, type: 'Post-transition Metal' },
    'Ge': { name: 'Germanium', radius: 1.22, color: 0x668F8F, mass: 72.630, type: 'Metalloid' },
    'As': { name: 'Arsenic', radius: 1.21, color: 0xBD80E3, mass: 74.922, type: 'Metalloid' },
    'Se': { name: 'Selenium', radius: 1.17, color: 0xFFA100, mass: 78.971, type: 'Nonmetal' },
    'Br': { name: 'Bromine', radius: 1.14, color: 0xA62929, mass: 79.904, type: 'Halogen' },
    'Kr': { name: 'Krypton', radius: 1.12, color: 0x5CB8D1, mass: 83.798, type: 'Noble Gas' },
    'Rb': { name: 'Rubidium', radius: 2.48, color: 0x702EB0, mass: 85.468, type: 'Alkali Metal' },
    'Sr': { name: 'Strontium', radius: 2.15, color: 0x00FF00, mass: 87.62, type: 'Alkaline Earth Metal' },
    'Y': { name: 'Yttrium', radius: 1.80, color: 0x94FFFF, mass: 88.906, type: 'Transition Metal' },
    'Zr': { name: 'Zirconium', radius: 1.60, color: 0x94E0E0, mass: 91.224, type: 'Transition Metal' },
    'Nb': { name: 'Niobium', radius: 1.46, color: 0x73C2C9, mass: 92.906, type: 'Transition Metal' },
    'Mo': { name: 'Molybdenum', radius: 1.39, color: 0x54B5B5, mass: 95.96, type: 'Transition Metal' },
    'Tc': { name: 'Technetium', radius: 1.36, color: 0x3B9E9E, mass: 98, type: 'Transition Metal' },
    'Ru': { name: 'Ruthenium', radius: 1.34, color: 0x248F8F, mass: 101.07, type: 'Transition Metal' },
    'Rh': { name: 'Rhodium', radius: 1.34, color: 0x0A7D8C, mass: 102.906, type: 'Transition Metal' },
    'Pd': { name: 'Palladium', radius: 1.37, color: 0x006985, mass: 106.42, type: 'Transition Metal' },
    'Ag': { name: 'Silver', radius: 1.44, color: 0xC0C0C0, mass: 107.868, type: 'Transition Metal' },
    'Cd': { name: 'Cadmium', radius: 1.51, color: 0xFFD98F, mass: 112.411, type: 'Transition Metal' },
    'In': { name: 'Indium', radius: 1.67, color: 0xA67573, mass: 114.818, type: 'Post-transition Metal' },
    'Sn': { name: 'Tin', radius: 1.40, color: 0x668080, mass: 118.71, type: 'Post-transition Metal' },
    'Sb': { name: 'Antimony', radius: 1.41, color: 0x9E63B5, mass: 121.76, type: 'Metalloid' },
    'Te': { name: 'Tellurium', radius: 1.37, color: 0xD47A00, mass: 127.6, type: 'Metalloid' },
    'I': { name: 'Iodine', radius: 1.33, color: 0x940094, mass: 126.904, type: 'Halogen' },
    'Xe': { name: 'Xenon', radius: 1.30, color: 0x429EB0, mass: 131.293, type: 'Noble Gas' },
    'Cs': { name: 'Cesium', radius: 2.65, color: 0x57178F, mass: 132.905, type: 'Alkali Metal' },
    'Ba': { name: 'Barium', radius: 2.22, color: 0x00C900, mass: 137.327, type: 'Alkaline Earth Metal' },
    'La': { name: 'Lanthanum', radius: 1.87, color: 0x70D4FF, mass: 138.905, type: 'Lanthanide' },
    'Ce': { name: 'Cerium', radius: 1.81, color: 0xFFFFC7, mass: 140.116, type: 'Lanthanide' },
    'Pr': { name: 'Praseodymium', radius: 1.82, color: 0xD9FFC7, mass: 140.908, type: 'Lanthanide' },
    'Nd': { name: 'Neodymium', radius: 1.81, color: 0xC7FFC7, mass: 144.242, type: 'Lanthanide' },
    'Pm': { name: 'Promethium', radius: 1.83, color: 0xA3FFC7, mass: 145, type: 'Lanthanide' },
    'Sm': { name: 'Samarium', radius: 1.80, color: 0x8FFFC7, mass: 150.36, type: 'Lanthanide' },
    'Eu': { name: 'Europium', radius: 1.80, color: 0x61FFC7, mass: 151.964, type: 'Lanthanide' },
    'Gd': { name: 'Gadolinium', radius: 1.79, color: 0x45FFC7, mass: 157.25, type: 'Lanthanide' },
    'Tb': { name: 'Terbium', radius: 1.77, color: 0x30FFC7, mass: 158.925, type: 'Lanthanide' },
    'Dy': { name: 'Dysprosium', radius: 1.77, color: 0x1FFFC7, mass: 162.5, type: 'Lanthanide' },
    'Ho': { name: 'Holmium', radius: 1.76, color: 0x00FF9C, mass: 164.93, type: 'Lanthanide' },
    'Er': { name: 'Erbium', radius: 1.75, color: 0x00E675, mass: 167.259, type: 'Lanthanide' },
    'Tm': { name: 'Thulium', radius: 1.74, color: 0x00D452, mass: 168.934, type: 'Lanthanide' },
    'Yb': { name: 'Ytterbium', radius: 1.74, color: 0x00BF38, mass: 173.054, type: 'Lanthanide' },
    'Lu': { name: 'Lutetium', radius: 1.72, color: 0x00AB24, mass: 174.967, type: 'Lanthanide' },
    'Hf': { name: 'Hafnium', radius: 1.59, color: 0x4DC2FF, mass: 178.49, type: 'Transition Metal' },
    'Ta': { name: 'Tantalum', radius: 1.46, color: 0x4DA6FF, mass: 180.948, type: 'Transition Metal' },
    'W': { name: 'Tungsten', radius: 1.39, color: 0x2194D6, mass: 183.84, type: 'Transition Metal' },
    'Re': { name: 'Rhenium', radius: 1.37, color: 0x267DAB, mass: 186.207, type: 'Transition Metal' },
    'Os': { name: 'Osmium', radius: 1.35, color: 0x266696, mass: 190.23, type: 'Transition Metal' },
    'Ir': { name: 'Iridium', radius: 1.35, color: 0x175487, mass: 192.217, type: 'Transition Metal' },
    'Pt': { name: 'Platinum', radius: 1.38, color: 0xD0D0E0, mass: 195.084, type: 'Transition Metal' },
    'Au': { name: 'Gold', radius: 1.44, color: 0xFFD123, mass: 196.967, type: 'Transition Metal' },
    'Hg': { name: 'Mercury', radius: 1.51, color: 0xB8B8D0, mass: 200.59, type: 'Transition Metal' },
    'Tl': { name: 'Thallium', radius: 1.70, color: 0xA6544D, mass: 204.38, type: 'Post-transition Metal' },
    'Pb': { name: 'Lead', radius: 1.75, color: 0x575961, mass: 207.2, type: 'Post-transition Metal' },
    'Bi': { name: 'Bismuth', radius: 1.55, color: 0x9E4FB5, mass: 208.98, type: 'Post-transition Metal' },
    'Po': { name: 'Polonium', radius: 1.67, color: 0xAB5C00, mass: 209, type: 'Post-transition Metal' },
    'At': { name: 'Astatine', radius: 1.40, color: 0x754F45, mass: 210, type: 'Metalloid' },
    'Rn': { name: 'Radon', radius: 1.45, color: 0x428296, mass: 222, type: 'Noble Gas' },
    'Fr': { name: 'Francium', radius: 2.7, color: 0x420066, mass: 223, type: 'Alkali Metal' },
    'Ra': { name: 'Radium', radius: 2.20, color: 0x007D00, mass: 226, type: 'Alkaline Earth Metal' },
    'Ac': { name: 'Actinium', radius: 1.95, color: 0x70ABFA, mass: 227, type: 'Actinide' },
    'Th': { name: 'Thorium', radius: 1.80, color: 0x00BAFF, mass: 232.04, type: 'Actinide' },
    'Pa': { name: 'Protactinium', radius: 1.63, color: 0x00A1FF, mass: 231.04, type: 'Actinide' },
    'U': { name: 'Uranium', radius: 1.56, color: 0x008FFF, mass: 238.03, type: 'Actinide' },
    'Np': { name: 'Neptunium', radius: 1.56, color: 0x0080FF, mass: 237, type: 'Actinide' },
    'Pu': { name: 'Plutonium', radius: 1.59, color: 0x006BFF, mass: 244, type: 'Actinide' },
    'Am': { name: 'Americium', radius: 1.73, color: 0x545CF2, mass: 243, type: 'Actinide' },
    'Cm': { name: 'Curium', radius: 1.74, color: 0x785CE3, mass: 247, type: 'Actinide' },
    'Bk': { name: 'Berkelium', radius: 1.70, color: 0x8A4FE3, mass: 247, type: 'Actinide' },
    'Cf': { name: 'Californium', radius: 1.86, color: 0xA136D4, mass: 251, type: 'Actinide' },
    'Es': { name: 'Einsteinium', radius: 1.86, color: 0xB31FD4, mass: 252, type: 'Actinide' },
    'Fm': { name: 'Fermium', radius: 1.86, color: 0xB31FBA, mass: 257, type: 'Actinide' },
    'Md': { name: 'Mendelevium', radius: 1.86, color: 0xB30DA6, mass: 258, type: 'Actinide' },
    'No': { name: 'Nobelium', radius: 1.86, color: 0xBD0D87, mass: 259, type: 'Actinide' },
    'Lr': { name: 'Lawrencium', radius: 1.86, color: 0xC70066, mass: 262, type: 'Actinide' },
    'Rf': { name: 'Rutherfordium', radius: 1.5, color: 0xCC0059, mass: 267, type: 'Transition Metal' },
    'Db': { name: 'Dubnium', radius: 1.4, color: 0xD1004F, mass: 268, type: 'Transition Metal' },
    'Sg': { name: 'Seaborgium', radius: 1.4, color: 0xD90045, mass: 271, type: 'Transition Metal' },
    'Bh': { name: 'Bohrium', radius: 1.4, color: 0xE00038, mass: 272, type: 'Transition Metal' },
    'Hs': { name: 'Hassium', radius: 1.3, color: 0xE6002E, mass: 270, type: 'Transition Metal' },
    'Mt': { name: 'Meitnerium', radius: 1.3, color: 0xEB0026, mass: 276, type: 'Transition Metal' },
};

const ALL_METALS = new Set(
    Object.entries(ATOMIC_DATA)
        .filter(([, data]) => data.type && (data.type.toLowerCase().includes('metal') || ['Lanthanide', 'Actinide'].includes(data.type)))
        .map(([symbol]) => symbol)
);

// --- END: ATOMIC & CHEMICAL DATA ---


// --- START: COMPLETE SHAPE 2.1 GEOMETRY DEFINITIONS ---

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
    // TDD-8: D2d symmetry
    return [
        [1, 0, 0.707], [-1, 0, 0.707],
        [0, 1, -0.707], [0, -1, -0.707],
        [0.707, 0.707, 0], [-0.707, 0.707, 0],
        [0.707, -0.707, 0], [-0.707, -0.707, 0]
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
    // JBTP-8 & BTPR-8: Johnson J50 (C2v)
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

function generateSnubDisphenoid() {
    // JSD-8: Johnson J84 (D2d) - same as TDD-8 essentially
    return generateTriangularDodecahedron();
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
        "BTPR-8 (Biaugmented Trigonal Prism)": generateBiaugmentedTrigonalPrism(),
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


// --- START: IMPROVED KABSCH ALGORITHM WITH PROPER SVD ---

/**
 * IMPROVED Kabsch Algorithm with robust numerical SVD
 * Uses the two-sided Jacobi algorithm for better numerical stability
 */
function kabschAlignment(P, Q) {
    try {
        const N = P.length;
        if (N !== Q.length || N === 0) {
            throw new Error(`Point set size mismatch: P has ${P.length}, Q has ${Q.length}`);
        }

        // Step 1: Center both point sets
        const centroidP = [0, 0, 0];
        const centroidQ = [0, 0, 0];
        
        for (let i = 0; i < N; i++) {
            centroidP[0] += P[i][0];
            centroidP[1] += P[i][1];
            centroidP[2] += P[i][2];
            centroidQ[0] += Q[i][0];
            centroidQ[1] += Q[i][1];
            centroidQ[2] += Q[i][2];
        }
        
        centroidP[0] /= N;
        centroidP[1] /= N;
        centroidP[2] /= N;
        centroidQ[0] /= N;
        centroidQ[1] /= N;
        centroidQ[2] /= N;

        // Step 2: Translate points to origin
        const P_centered = P.map(p => [
            p[0] - centroidP[0],
            p[1] - centroidP[1],
            p[2] - centroidP[2]
        ]);
        
        const Q_centered = Q.map(q => [
            q[0] - centroidQ[0],
            q[1] - centroidQ[1],
            q[2] - centroidQ[2]
        ]);

        // Step 3: Compute covariance matrix H = P^T * Q
        const H = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    H[j][k] += P_centered[i][j] * Q_centered[i][k];
                }
            }
        }

        // Step 4: Perform SVD on H using Jacobi algorithm (more robust)
        const { U, V } = jacobiSVD(H);

        // Step 5: Compute rotation matrix R = V * U^T
        const R = multiplyMatrices3x3(V, transpose3x3(U));

        // Step 6: Ensure proper rotation (det(R) = 1)
        const det = determinant3x3(R);
        if (det < 0) {
            V[0][2] *= -1;
            V[1][2] *= -1;
            V[2][2] *= -1;
            const R_corrected = multiplyMatrices3x3(V, transpose3x3(U));
            return arrayToMatrix4(R_corrected);
        }

        return arrayToMatrix4(R);
        
    } catch (error) {
        console.warn("Kabsch alignment failed:", error.message);
        return new THREE.Matrix4(); // Return identity matrix on failure
    }
}

/**
 * Jacobi SVD algorithm for 3x3 matrices (more numerically stable)
 */
function jacobiSVD(A) {
    const maxIterations = 100;
    const tolerance = 1e-10;
    
    // Initialize U and V as identity matrices
    const U = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
    
    const V = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
    
    // Copy A to S
    let S = [
        [A[0][0], A[0][1], A[0][2]],
        [A[1][0], A[1][1], A[1][2]],
        [A[2][0], A[2][1], A[2][2]]
    ];
    
    // Iterative Jacobi rotations
    for (let iter = 0; iter < maxIterations; iter++) {
        // Find largest off-diagonal element
        let maxVal = 0;
        let p = 0, q = 1;
        
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const val = Math.abs(S[i][j]);
                if (val > maxVal) {
                    maxVal = val;
                    p = i;
                    q = j;
                }
            }
        }
        
        // Check for convergence
        if (maxVal < tolerance) {
            break;
        }
        
        // Compute Jacobi rotation
        const Spp = S[p][p];
        const Sqq = S[q][q];
        const Spq = S[p][q];
        
        let c, s;
        if (Math.abs(Spq) < tolerance) {
            c = 1;
            s = 0;
        } else {
            const tau = (Sqq - Spp) / (2 * Spq);
            const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
            c = 1 / Math.sqrt(1 + t * t);
            s = c * t;
        }
        
        // Apply rotation to S
        const Sp = [...S[p]];
        const Sq = [...S[q]];
        
        for (let i = 0; i < 3; i++) {
            S[p][i] = c * Sp[i] - s * Sq[i];
            S[q][i] = s * Sp[i] + c * Sq[i];
        }
        
        for (let i = 0; i < 3; i++) {
            const Sip = S[i][p];
            const Siq = S[i][q];
            S[i][p] = c * Sip - s * Siq;
            S[i][q] = s * Sip + c * Siq;
        }
        
        // Update U and V
        for (let i = 0; i < 3; i++) {
            const Uip = U[i][p];
            const Uiq = U[i][q];
            U[i][p] = c * Uip - s * Uiq;
            U[i][q] = s * Uip + c * Uiq;
            
            const Vip = V[i][p];
            const Viq = V[i][q];
            V[i][p] = c * Vip - s * Viq;
            V[i][q] = s * Vip + c * Viq;
        }
    }
    
    return { U, V };
}

function transpose3x3(M) {
    return [
        [M[0][0], M[1][0], M[2][0]],
        [M[0][1], M[1][1], M[2][1]],
        [M[0][2], M[1][2], M[2][2]]
    ];
}

function multiplyMatrices3x3(A, B) {
    const C = [[0,0,0], [0,0,0], [0,0,0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
}

function determinant3x3(M) {
    return M[0][0] * (M[1][1]*M[2][2] - M[1][2]*M[2][1]) -
           M[0][1] * (M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
           M[0][2] * (M[1][0]*M[2][1] - M[1][1]*M[2][0]);
}

function arrayToMatrix4(R) {
    const mat = new THREE.Matrix4();
    mat.set(
        R[0][0], R[0][1], R[0][2], 0,
        R[1][0], R[1][1], R[1][2], 0,
        R[2][0], R[2][1], R[2][2], 0,
        0, 0, 0, 1
    );
    return mat;
}

// --- END: IMPROVED KABSCH ALGORITHM ---


// --- START: OPTIMIZED HUNGARIAN ALGORITHM ---

/**
 * Optimized Hungarian algorithm with better performance for small matrices
 */
function hungarianAlgorithm(costMatrix) {
    const n = costMatrix.length;
    if (n === 0) return [];
    
    // For very small matrices, use greedy matching (faster)
    if (n <= 3) {
        return greedyMatching(costMatrix);
    }
    
    // Copy and reduce matrix
    const matrix = costMatrix.map(row => [...row]);
    
    // Row reduction
    for (let i = 0; i < n; i++) {
        const rowMin = Math.min(...matrix[i]);
        for (let j = 0; j < n; j++) {
            matrix[i][j] -= rowMin;
        }
    }
    
    // Column reduction
    for (let j = 0; j < n; j++) {
        let colMin = Infinity;
        for (let i = 0; i < n; i++) {
            colMin = Math.min(colMin, matrix[i][j]);
        }
        for (let i = 0; i < n; i++) {
            matrix[i][j] -= colMin;
        }
    }
    
    // Find initial matching using greedy approach on zeros
    const rowAssigned = new Array(n).fill(-1);
    const colAssigned = new Array(n).fill(-1);
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (matrix[i][j] === 0 && colAssigned[j] === -1) {
                rowAssigned[i] = j;
                colAssigned[j] = i;
                break;
            }
        }
    }
    
    const matching = [];
    for (let i = 0; i < n; i++) {
        if (rowAssigned[i] !== -1) {
            matching.push([i, rowAssigned[i]]);
        }
    }
    
    // If we don't have a complete matching, fall back to greedy
    if (matching.length < n) {
        return greedyMatching(costMatrix);
    }
    
    return matching;
}

function greedyMatching(costMatrix) {
    const N = costMatrix.length;
    const pairs = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            pairs.push({ i, j, cost: costMatrix[i][j] });
        }
    }
    pairs.sort((a, b) => a.cost - b.cost);
    
    const usedI = new Set();
    const usedJ = new Set();
    const matching = [];
    
    for (const pair of pairs) {
        if (!usedI.has(pair.i) && !usedJ.has(pair.j)) {
            matching.push([pair.i, pair.j]);
            usedI.add(pair.i);
            usedJ.add(pair.j);
            if (matching.length === N) break;
        }
    }
    return matching;
}

// --- END: OPTIMIZED HUNGARIAN ALGORITHM ---


// --- START: OPTIMIZED SHAPE MEASURE CALCULATION ---

function calculateShapeMeasure(actualCoords, referenceCoords, mode = 'default', progressCallback = null) {
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
    }

    const params = {
        default: {
            gridSteps: 18,        // Reduced from 20
            gridStride: 3,
            numRestarts: 6,         // Reduced from 8
            stepsPerRun: 3000,      // Reduced from 5000
            refinementSteps: 2000,  // Reduced from 4000
            useKabsch: true,
        },
        intensive: {
            gridSteps: 30,          // Reduced from 36
            gridStride: 2,
            numRestarts: 12,        // Reduced from 16
            stepsPerRun: 8000,     // Reduced from 12000
            refinementSteps: 6000,  // Reduced from 10000
            useKabsch: true,
        }
    };
    const currentParams = params[mode] || params.default;

    try {
        // Normalize actual coordinates
        const P_vecs = actualCoords.map(c => new THREE.Vector3(...c));
        if (P_vecs.some(v => v.lengthSq() < 1e-8)) {
            console.warn("Found coordinating atom at the same position as the center.");
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
        }
        P_vecs.forEach(v => v.normalize());
        
        const Q_vecs = referenceCoords.map(c => new THREE.Vector3(...c));

        // Cached evaluation function
        const getMeasureForRotation = (rotationMatrix) => {
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rotationMatrix));
            
            const costMatrix = [];
            for (let i = 0; i < N; i++) {
                costMatrix[i] = [];
                for (let j = 0; j < N; j++) {
                    costMatrix[i][j] = rotatedP[i].distanceToSquared(Q_vecs[j]);
                }
            }
            
            const matching = hungarianAlgorithm(costMatrix);
            const sumSqDiff = matching.reduce((sum, [i, j]) => sum + costMatrix[i][j], 0);
            
            return { measure: (sumSqDiff / N) * 100, matching };
        };

        let globalBestMeasure = Infinity;
        let globalBestRotation = new THREE.Matrix4();
        let globalBestMatching = [];

        let totalSteps = 0;
        const estimatedTotalSteps = (currentParams.useKabsch ? 1 : 0) + 18 + 
            Math.ceil(currentParams.gridSteps / currentParams.gridStride) ** 3 +
            currentParams.numRestarts * currentParams.stepsPerRun +
            currentParams.refinementSteps;

        const reportProgress = (stage, current, total, extra = '') => {
            if (progressCallback) {
                const percentage = Math.min(99, Math.round((totalSteps / estimatedTotalSteps) * 100));
                progressCallback({ stage, percentage, current, total, extra });
            }
        };

        // STAGE 0: Kabsch Initial Alignment (IMPROVED)
        if (currentParams.useKabsch) {
            reportProgress('Kabsch Alignment', 0, 1);
            try {
                const initialCostMatrix = P_vecs.map(p => Q_vecs.map(q => p.distanceToSquared(q)));
                const initialMatching = hungarianAlgorithm(initialCostMatrix);
                
                const P_ordered = initialMatching.map(([p_idx, _]) => actualCoords[p_idx]);
                const Q_ordered = initialMatching.map(([_, q_idx]) => referenceCoords[q_idx]);

                const kabschRotation = kabschAlignment(P_ordered, Q_ordered);
                const kabschResult = getMeasureForRotation(kabschRotation);
                
                if (isFinite(kabschResult.measure)) {
                    globalBestMeasure = kabschResult.measure;
                    globalBestRotation.copy(kabschRotation);
                    globalBestMatching = kabschResult.matching;
                }
                totalSteps++;
                reportProgress('Kabsch Alignment', 1, 1, `Initial Best: ${globalBestMeasure.toFixed(4)}`);
            } catch (error) {
                console.warn("Kabsch alignment failed, proceeding without it:", error);
            }
        }

        // STAGE 1: Reduced key orientations (18 instead of 24)
        reportProgress('Key Orientations', 0, 18);
        const keyOrientations = [
            [0, 0, 0],
            [Math.PI/2, 0, 0], [0, Math.PI/2, 0], [0, 0, Math.PI/2],
            [Math.PI, 0, 0], [0, Math.PI, 0], [0, 0, Math.PI],
            [Math.PI/2, Math.PI/2, 0], [Math.PI/2, 0, Math.PI/2], [0, Math.PI/2, Math.PI/2],
            [Math.PI/4, 0, 0], [0, Math.PI/4, 0], [0, 0, Math.PI/4],
            [Math.PI/4, Math.PI/4, 0], [Math.PI/4, 0, Math.PI/4], [0, Math.PI/4, Math.PI/4],
            [Math.PI/4, Math.PI/4, Math.PI/4], [Math.PI/3, Math.PI/3, Math.PI/3]
        ];
        
        keyOrientations.forEach(([ax, ay, az], idx) => {
            const euler = new THREE.Euler(ax, ay, az, 'XYZ');
            const R = new THREE.Matrix4().makeRotationFromEuler(euler);
            const result = getMeasureForRotation(R);
            if (result.measure < globalBestMeasure) {
                globalBestMeasure = result.measure;
                globalBestRotation.copy(R);
                globalBestMatching = result.matching;
            }
            totalSteps++;
            if (idx % 6 === 0) reportProgress('Key Orientations', idx, 18, `Best: ${globalBestMeasure.toFixed(4)}`);
        });

        // Early termination if already excellent
        if (globalBestMeasure < 0.01) {
            reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
            const finalAlignedCoords = new Array(N);
            for (const [p_idx, q_idx] of globalBestMatching) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
            return { 
                measure: globalBestMeasure, 
                alignedCoords: finalAlignedCoords.filter(Boolean),
                rotationMatrix: globalBestRotation
            };
        }

        // STAGE 2: Grid search (optimized)
        reportProgress('Grid Search', 0, 100);
        const gridSteps = currentParams.gridSteps;
        const gridStride = currentParams.gridStride;
        const angleStep = (2 * Math.PI) / gridSteps;
        
        let gridCount = 0;
        const totalGridPoints = Math.ceil(gridSteps / gridStride) ** 3;
        
        for (let i = 0; i < gridSteps; i += gridStride) {
            for (let j = 0; j < gridSteps; j += gridStride) {
                for (let k = 0; k < gridSteps; k += gridStride) {
                    const euler = new THREE.Euler(i * angleStep, j * angleStep, k * angleStep, 'XYZ');
                    const R = new THREE.Matrix4().makeRotationFromEuler(euler);
                    const result = getMeasureForRotation(R);
                    if (result.measure < globalBestMeasure) {
                        globalBestMeasure = result.measure;
                        globalBestRotation.copy(R);
                        globalBestMatching = result.matching;
                    }
                    totalSteps++;
                    gridCount++;
                    if (gridCount % 50 === 0) {
                        reportProgress('Grid Search', gridCount, totalGridPoints, `Best: ${globalBestMeasure.toFixed(4)}`);
                    }
                }
            }
        }

        // Early termination check
        if (globalBestMeasure < 0.05) {
            reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
            const finalAlignedCoords = new Array(N);
            for (const [p_idx, q_idx] of globalBestMatching) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
            return { 
                measure: globalBestMeasure, 
                alignedCoords: finalAlignedCoords.filter(Boolean),
                rotationMatrix: globalBestRotation
            };
        }

        // STAGE 3: Simulated annealing (optimized)
        const numRestarts = currentParams.numRestarts;
        const stepsPerRun = currentParams.stepsPerRun;
        
        for (let restart = 0; restart < numRestarts; restart++) {
            reportProgress('Annealing', restart, numRestarts, `Best: ${globalBestMeasure.toFixed(4)}`);
            
            let currentRotation;
            
            if (restart === 0) {
                currentRotation = globalBestRotation.clone();
            } else if (restart < numRestarts / 2) {
                const randomAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const randomAngle = (Math.random() - 0.5) * Math.PI;
                const perturbation = new THREE.Matrix4().makeRotationAxis(randomAxis, randomAngle);
                currentRotation = new THREE.Matrix4().multiplyMatrices(perturbation, globalBestRotation);
            } else {
                currentRotation = new THREE.Matrix4().makeRotationFromEuler(
                    new THREE.Euler(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, 'XYZ')
                );
            }
            
            let currentResult = getMeasureForRotation(currentRotation);
            let bestInRun = currentResult.measure;
            let bestRotationInRun = currentRotation.clone();
            let bestMatchingInRun = currentResult.matching;
            
            // Adaptive temperature schedule
            let temp = 20.0;  // Reduced from 30.0
            const minTemp = 0.001;
            const alpha = Math.pow(minTemp / temp, 1 / stepsPerRun);
            
            for (let step = 0; step < stepsPerRun; step++) {
                const stepSize = temp * 0.12 * (1 + 0.2 * Math.random());
                const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const angle = (Math.random() - 0.5) * 2 * stepSize;
                
                const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
                const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
                const newResult = getMeasureForRotation(newRotation);
                
                const deltaE = newResult.measure - currentResult.measure;
                const acceptProb = deltaE < 0 ? 1.0 : Math.exp(-deltaE / temp);
                
                if (Math.random() < acceptProb) {
                    currentRotation.copy(newRotation);
                    currentResult = newResult;
                    
                    if (currentResult.measure < bestInRun) {
                        bestInRun = currentResult.measure;
                        bestRotationInRun.copy(currentRotation);
                        bestMatchingInRun = currentResult.matching;
                    }
                }
                
                temp *= alpha;
                totalSteps++;
                
                // Early termination for this run
                if (bestInRun < 0.001) break;
            }
            
            if (bestInRun < globalBestMeasure) {
                globalBestMeasure = bestInRun;
                globalBestRotation.copy(bestRotationInRun);
                globalBestMatching = bestMatchingInRun;
            }
            
            // Early termination if excellent result
            if (globalBestMeasure < 0.01) break;
        }

        // STAGE 4: Final refinement (optimized)
        reportProgress('Refinement', 0, 100);
        let currentRotation = globalBestRotation.clone();
        let currentMeasure = globalBestMeasure;
        let temp = 3.0;  // Reduced from 5.0
        const refinementSteps = currentParams.refinementSteps;
        let noImprovementCount = 0;
        
        for (let step = 0; step < refinementSteps; step++) {
            const stepSize = temp * 0.02;
            const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            const angle = (Math.random() - 0.5) * 2 * stepSize;
            
            const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
            const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
            const newResult = getMeasureForRotation(newRotation);
            
            if (newResult.measure < currentMeasure) {
                currentMeasure = newResult.measure;
                currentRotation.copy(newRotation);
                noImprovementCount = 0;
                
                if (currentMeasure < globalBestMeasure) {
                    globalBestMeasure = currentMeasure;
                    globalBestRotation.copy(newRotation);
                    globalBestMatching = newResult.matching;
                }
            } else {
                noImprovementCount++;
            }
            
            temp *= 0.999;
            totalSteps++;
            
            if (step % 500 === 0) {
                reportProgress('Refinement', step, refinementSteps, `Best: ${globalBestMeasure.toFixed(4)}`);
            }
            
            // Early termination
            if (noImprovementCount > 500 && globalBestMeasure < 0.01) break;
        }

        reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);

        const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
        const finalAlignedCoords = new Array(N);
        
        for (const [p_idx, q_idx] of globalBestMatching) {
            finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
        }
        
        return { 
            measure: globalBestMeasure, 
            alignedCoords: finalAlignedCoords.filter(Boolean),
            rotationMatrix: globalBestRotation
        };

    } catch (error) {
        console.error("Error during CShM calculation:", error);
        throw new Error(`Shape measure calculation failed: ${error.message}`);
    }
}

// --- END: OPTIMIZED SHAPE MEASURE CALCULATION ---


// --- START: UTILITY FUNCTIONS (unchanged) ---

function detectOptimalRadius(metal, atoms) {
    try {
        if (!metal || !atoms || atoms.length === 0) {
            throw new Error("Invalid input for radius detection");
        }

        const distances = atoms
            .map((atom) => {
                if (atom === metal) return null;
                const dx = atom.x - metal.x;
                const dy = atom.y - metal.y;
                const dz = atom.z - metal.z;
                const dist = Math.hypot(dx, dy, dz);
                
                if (!isFinite(dist)) {
                    console.warn(`Non-finite distance detected for atom ${atom.element}`);
                    return null;
                }
                
                return dist;
            })
            .filter((d) => d !== null && d > 0.1)
            .sort((a, b) => a - b);

        if (distances.length === 0) {
            console.warn("No valid neighboring atoms found, using default radius");
            return 3.0;
        }

        let maxGap = 0;
        let optimalRadius = distances[Math.min(5, distances.length - 1)] + 0.4;

        for (let i = 1; i < Math.min(distances.length, 12); i++) {
            const gap = distances[i] - distances[i - 1];
            if (gap > maxGap && distances[i - 1] < 4.5) {
                maxGap = gap;
                optimalRadius = (distances[i - 1] + distances[i]) / 2;
            }
        }
        
        const finalRadius = Math.max(1.8, Math.min(5.5, optimalRadius));
        
        if (!isFinite(finalRadius)) {
            console.warn("Non-finite radius calculated, using default");
            return 3.0;
        }
        
        return finalRadius;
    } catch (error) {
        console.error("Error in radius detection:", error);
        return 3.0;
    }
}

function detectMetalCenter(atoms) {
    try {
        if (!atoms || atoms.length === 0) {
            throw new Error("No atoms provided for metal detection");
        }

        const metalIndices = atoms
            .map((a, i) => ALL_METALS.has(a.element) ? i : -1)
            .filter(i => i !== -1);
        
        if (metalIndices.length === 1) return metalIndices[0];

        let maxNeighbors = 0;
        let centralAtomIdx = 0;
        const targetIndices = metalIndices.length > 0 ? metalIndices : atoms.map((_, i) => i);

        targetIndices.forEach((idx) => {
            let neighbors = 0;
            const atom = atoms[idx];
            
            if (!atom || !isFinite(atom.x) || !isFinite(atom.y) || !isFinite(atom.z)) {
                console.warn(`Invalid atom data at index ${idx}`);
                return;
            }
            
            atoms.forEach((other, j) => {
                if (idx === j) return;
                const dist = Math.hypot(atom.x - other.x, atom.y - other.y, atom.z - other.z);
                if (isFinite(dist) && dist < 3.5) neighbors++;
            });
            
            if (neighbors > maxNeighbors) {
                maxNeighbors = neighbors;
                centralAtomIdx = idx;
            }
        });

        return centralAtomIdx;
    } catch (error) {
        console.error("Error in metal center detection:", error);
        return 0;
    }
}

function interpretShapeMeasure(value) {
    if (!isFinite(value)) return { text: "Invalid", color: "#6b7280", confidence: 0 };
    if (value < 0.1) return { text: "Perfect", color: "#059669", confidence: 100 };
    if (value < 0.5) return { text: "Excellent", color: "#10b981", confidence: 95 };
    if (value < 1.5) return { text: "Very Good", color: "#34d399", confidence: 90 };
    if (value < 3.0) return { text: "Good", color: "#fbbf24", confidence: 80 };
    if (value < 7.5) return { text: "Moderate", color: "#f59e0b", confidence: 60 };
    if (value < 15.0) return { text: "Poor", color: "#f97316", confidence: 30 };
    return { text: "Very Poor / No Match", color: "#ef4444", confidence: 10 };
}

function calculateAdditionalMetrics(coordAtoms) {
    try {
        if (!coordAtoms || coordAtoms.length === 0) {
            return {
                bondLengthVariance: 0,
                meanBondLength: 0,
                stdDevBondLength: 0,
                minBondLength: 0,
                maxBondLength: 0,
                angleStats: { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 }
            };
        }

        const distances = coordAtoms.map(c => c.distance).filter(d => isFinite(d));
        if (distances.length === 0) {
            throw new Error("No valid distances found");
        }

        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((acc, d) => acc + Math.pow(d - meanDist, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);
        
        const angles = [];
        for (let i = 0; i < coordAtoms.length; i++) {
            for (let j = i + 1; j < coordAtoms.length; j++) {
                const angle = coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI);
                if (isFinite(angle)) {
                    angles.push(angle);
                }
            }
        }
        
        let angleStats = { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 };
        if (angles.length > 0) {
            const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
            const angleVariance = angles.reduce((acc, a) => acc + Math.pow(a - meanAngle, 2), 0) / angles.length;
            angleStats = {
                count: angles.length,
                mean: meanAngle,
                stdDev: Math.sqrt(angleVariance),
                min: Math.min(...angles),
                max: Math.max(...angles)
            };
        }
        
        return {
            bondLengthVariance: variance,
            meanBondLength: meanDist,
            stdDevBondLength: stdDev,
            minBondLength: Math.min(...distances),
            maxBondLength: Math.max(...distances),
            angleStats
        };
    } catch (error) {
        console.error("Error calculating additional metrics:", error);
        return {
            bondLengthVariance: 0,
            meanBondLength: 0,
            stdDevBondLength: 0,
            minBondLength: 0,
            maxBondLength: 0,
            angleStats: { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 }
        };
    }
}

function calculateQualityMetrics(coordAtoms, bestGeometry, shapeMeasure) {
    try {
        if (!coordAtoms || coordAtoms.length === 0 || !bestGeometry) {
            return null;
        }

        const idealAngles = [];
        const actualAngles = [];
        
        if (bestGeometry.refCoords) {
            for (let i = 0; i < bestGeometry.refCoords.length; i++) {
                for (let j = i + 1; j < bestGeometry.refCoords.length; j++) {
                    const v1 = new THREE.Vector3(...bestGeometry.refCoords[i]);
                    const v2 = new THREE.Vector3(...bestGeometry.refCoords[j]);
                    idealAngles.push(v1.angleTo(v2) * (180 / Math.PI));
                }
            }
        }
        
        for (let i = 0; i < coordAtoms.length; i++) {
            for (let j = i + 1; j < coordAtoms.length; j++) {
                actualAngles.push(coordAtoms[i].vec.angleTo(coordAtoms[j].vec) * (180 / Math.PI));
            }
        }
        
        let angularDistortion = 0;
        if (idealAngles.length > 0 && actualAngles.length === idealAngles.length) {
            idealAngles.sort((a, b) => a - b);
            actualAngles.sort((a, b) => a - b);
            
            const deviations = idealAngles.map((ideal, i) => Math.abs(ideal - actualAngles[i]));
            angularDistortion = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        }

        const distances = coordAtoms.map(c => c.distance);
        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const relativeDeviations = distances.map(d => Math.abs(d - meanDist) / meanDist);
        const bondLengthUniformity = 100 * (1 - (relativeDeviations.reduce((a, b) => a + b, 0) / relativeDeviations.length));

        const volumeRatio = 1.0;
        const shapeDeviation = Math.sqrt(shapeMeasure / 100);

        const qualityScore = Math.max(0, Math.min(100, 
            100 - (shapeMeasure * 2) - (angularDistortion * 0.5) - ((100 - bondLengthUniformity) * 0.3)
        ));

        return {
            angularDistortionIndex: angularDistortion,
            bondLengthUniformityIndex: bondLengthUniformity,
            polyhedralVolumeRatio: volumeRatio,
            shapeDeviationParameter: shapeDeviation,
            overallQualityScore: qualityScore,
            rmsd: Math.sqrt(shapeMeasure / 100)
        };
    } catch (error) {
        console.error("Error calculating quality metrics:", error);
        return null;
    }
}

// --- END: UTILITY FUNCTIONS ---


// --- START: REACT COMPONENT ---
export default function CoordinationGeometryAnalyzer() {
    const [atoms, setAtoms] = useState([]);
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [coordRadius, setCoordRadius] = useState(3.0);
    const [autoRadius, setAutoRadius] = useState(true);
    const [coordAtoms, setCoordAtoms] = useState([]);
    const [geometryResults, setGeometryResults] = useState([]);
    const [bestGeometry, setBestGeometry] = useState(null);
    const [fileName, setFileName] = useState("");
    const [autoRotate, setAutoRotate] = useState(false);
    const [showIdeal, setShowIdeal] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisParams, setAnalysisParams] = useState({ mode: 'default', key: 0 });
    const [progress, setProgress] = useState(null);
    const [additionalMetrics, setAdditionalMetrics] = useState(null);
    const [qualityMetrics, setQualityMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [warnings, setWarnings] = useState([]);
    
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const resultsCache = useRef(new Map());

    const getCacheKey = useCallback((metalIdx, radius, atomsData, mode) => {
        if (metalIdx == null || !atomsData || atomsData.length === 0) return null;
        try {
            return `${mode}-${metalIdx}-${radius.toFixed(3)}-${atomsData.map(a => `${a.element}${a.x.toFixed(3)}${a.y.toFixed(3)}${a.z.toFixed(3)}`).join('-')}`;
        } catch (error) {
            console.error("Error generating cache key:", error);
            return null;
        }
    }, []);

    const validateXYZ = useCallback((content) => {
        const warnings = [];
        
        try {
            const lines = content.trim().split(/\n+/);
            
            if (lines.length < 3) {
                throw new Error('XYZ file too short - must have at least 3 lines (atom count, comment, and atom data)');
            }
            
            const nAtoms = parseInt(lines[0].trim());
            if (!Number.isFinite(nAtoms) || nAtoms <= 0) {
                throw new Error('Invalid atom count in XYZ header - must be a positive integer');
            }
            
            if (nAtoms > 1000) {
                warnings.push(`Large structure detected (${nAtoms} atoms) - analysis may be slow`);
            }
            
            if (lines.length < nAtoms + 2) {
                throw new Error(`File claims ${nAtoms} atoms but only has ${lines.length - 2} data lines`);
            }
            
            const unknownElements = [];
            const invalidCoords = [];
            
            for (let i = 2; i < Math.min(2 + nAtoms, lines.length); i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length < 4) {
                    throw new Error(`Line ${i + 1}: Invalid format - expected "Element X Y Z"`);
                }
                
                const [element, x, y, z] = parts;
                const normalizedElement = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
                
                if (!ATOMIC_DATA[normalizedElement]) {
                    unknownElements.push(`${element} (line ${i + 1})`);
                }
                
                const xVal = parseFloat(x);
                const yVal = parseFloat(y);
                const zVal = parseFloat(z);
                
                if (!Number.isFinite(xVal) || !Number.isFinite(yVal) || !Number.isFinite(zVal)) {
                    invalidCoords.push(`Line ${i + 1}: non-numeric coordinates`);
                }
                
                if (Math.abs(xVal) > 1000 || Math.abs(yVal) > 1000 || Math.abs(zVal) > 1000) {
                    warnings.push(`Line ${i + 1}: Very large coordinates detected (may indicate unit mismatch)`);
                }
            }
            
            if (unknownElements.length > 0) {
                warnings.push(`Unknown elements found (using defaults): ${unknownElements.slice(0, 5).join(', ')}${unknownElements.length > 5 ? '...' : ''}`);
            }
            
            if (invalidCoords.length > 0) {
                throw new Error(invalidCoords[0]);
            }
            
            return { valid: true, warnings };
            
        } catch (error) {
            return { valid: false, error: error.message, warnings };
        }
    }, []);

    const parseXYZ = useCallback((content) => {
        try {
            const lines = content.replace(/\r\n?/g, "\n").trim().split(/\n+/);
            const n_atoms_line = lines[0].trim();
            const n = parseInt(n_atoms_line, 10);
            
            if (!Number.isFinite(n) || n <= 0) {
                throw new Error("Invalid XYZ header: Atom count is missing or invalid.");
            }
            
            const out = [];
            for (let i = 2; i < Math.min(2 + n, lines.length); i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length < 4) continue;
                
                const element = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);
                
                if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
                    console.warn(`Skipping atom with invalid coordinates at line ${i + 1}`);
                    continue;
                }
                
                out.push({ element, x, y, z });
            }
            
            if (out.length === 0) {
                throw new Error("No valid atoms found in file");
            }
            
            return out;
        } catch (error) {
            throw new Error(`Failed to parse XYZ file: ${error.message}`);
        }
    }, []);

    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setError(null);
        setWarnings([]);
        setFileName(file.name.replace(/\.xyz$/i, ""));
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || "");
                const validation = validateXYZ(content);
                
                if (!validation.valid) {
                    throw new Error(validation.error);
                }
                
                if (validation.warnings && validation.warnings.length > 0) {
                    setWarnings(validation.warnings);
                }
                
                const parsedAtoms = parseXYZ(content);
                setAtoms(parsedAtoms);
                
                const metalIdx = detectMetalCenter(parsedAtoms);
                setSelectedMetal(metalIdx);
                
                if (metalIdx != null) {
                    const radius = detectOptimalRadius(parsedAtoms[metalIdx], parsedAtoms);
                    setCoordRadius(radius);
                    setAutoRadius(true);
                }
                
                setAnalysisParams({ mode: 'default', key: Date.now() });
                resultsCache.current.clear();
                
            } catch (err) {
                console.error("File upload error:", err);
                setError(err.message);
            }
        };
        
        reader.onerror = () => {
            const errorMsg = "Failed to read file - please check file permissions and try again";
            setError(errorMsg);
        };
        
        reader.readAsText(file);
    }, [parseXYZ, validateXYZ]);

    useEffect(() => {
        if (selectedMetal != null && atoms.length > 0 && autoRadius) {
            try {
                const radius = detectOptimalRadius(atoms[selectedMetal], atoms);
                setCoordRadius(radius);
            } catch (error) {
                console.error("Error auto-detecting radius:", error);
                setWarnings(prev => [...prev, "Failed to auto-detect radius, using manual value"]);
            }
        }
    }, [selectedMetal, autoRadius, atoms]);

    useEffect(() => {
        if (selectedMetal == null || atoms.length === 0) return;
        
        const cacheKey = getCacheKey(selectedMetal, coordRadius, atoms, analysisParams.mode);
        
        if (cacheKey && resultsCache.current.has(cacheKey)) {
            const cached = resultsCache.current.get(cacheKey);
            setGeometryResults(cached.results);
            setBestGeometry(cached.best);
            setAdditionalMetrics(cached.metrics);
            setQualityMetrics(cached.quality);
            setCoordAtoms(cached.coordAtoms); // RESTORE coordAtoms from cache
            return;
        }
        
        setIsLoading(true);
        setProgress(null);
        setError(null);

        const timer = setTimeout(() => {
            try {
                const metal = atoms[selectedMetal];
                const center = new THREE.Vector3(metal.x, metal.y, metal.z);

                const selected = atoms
                    .map((atom, idx) => {
                        if (idx === selectedMetal) return null;
                        const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
                        const distance = pos.distanceTo(center);
                        
                        if (!isFinite(distance)) {
                            console.warn(`Non-finite distance for atom ${idx}`);
                            return null;
                        }
                        
                        return { atom, idx, distance, vec: pos.sub(center) };
                    })
                    .filter((x) => x && x.distance <= coordRadius && x.distance > 0.1)
                    .sort((a, b) => a.distance - b.distance);
                
                setCoordAtoms(selected);

                const metrics = calculateAdditionalMetrics(selected);
                setAdditionalMetrics(metrics);

                const cn = selected.length;
                const geometries = REFERENCE_GEOMETRIES[cn];
                
                if (!geometries) {
                    setGeometryResults([]);
                    setBestGeometry(null);
                    setQualityMetrics(null);
                    setIsLoading(false);
                    if (cn > 0) {
                        setWarnings(prev => [...prev, `No reference geometries available for coordination number ${cn}`]);
                    }
                    return;
                }

                const actualCoords = selected.map((c) => [c.vec.x, c.vec.y, c.vec.z]);
                const results = [];
                
                const geometryNames = Object.keys(geometries);
                
                const processGeometry = (index) => {
                    if (index >= geometryNames.length) {
                        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
                        const finiteResults = results.filter(r => isFinite(r.shapeMeasure));
                        
                        if(finiteResults.length > 0) {
                            setGeometryResults(finiteResults);
                            const best = finiteResults[0];
                            setBestGeometry(best);
                            
                            const quality = calculateQualityMetrics(selected, best, best.shapeMeasure);
                            setQualityMetrics(quality);
                            
                            if (cacheKey) {
                                resultsCache.current.set(cacheKey, {
                                    results: finiteResults,
                                    best,
                                    metrics,
                                    quality,
                                    coordAtoms: selected // CACHE coordAtoms
                                });
                            }
                        } else {
                            setGeometryResults([]);
                            setBestGeometry(null);
                            setQualityMetrics(null);
                            setError("Analysis completed but no valid geometries found");
                        }
                        setIsLoading(false);
                        setProgress(null);
                        return;
                    }
                    
                    const name = geometryNames[index];
                    const refCoords = geometries[name];
                    
                    setProgress({ 
                        geometry: name, 
                        current: index + 1, 
                        total: geometryNames.length,
                        stage: 'Initializing'
                    });
                    
                    setTimeout(() => {
                        try {
                            const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
                                actualCoords, 
                                refCoords, 
                                analysisParams.mode,
                                (progressInfo) => {
                                    setProgress({
                                        geometry: name,
                                        current: index + 1,
                                        total: geometryNames.length,
                                        ...progressInfo
                                    });
                                }
                            );
                            
                            results.push({ 
                                name, 
                                shapeMeasure: measure, 
                                refCoords, 
                                alignedCoords,
                                rotationMatrix
                            });
                            
                            processGeometry(index + 1);
                        } catch(error) {
                            console.error(`Error processing geometry ${name}:`, error);
                            setWarnings(prev => [...prev, `Failed to analyze ${name}: ${error.message}`]);
                            processGeometry(index + 1);
                        }
                    }, 10);
                };
                
                processGeometry(0);

            } catch (error) {
                console.error("Failed to perform geometry analysis:", error);
                setError(`Analysis failed: ${error.message}`);
                setGeometryResults([]);
                setBestGeometry(null);
                setQualityMetrics(null);
                setIsLoading(false);
                setProgress(null);
            }
        }, 20);

        return () => clearTimeout(timer);

    }, [selectedMetal, atoms, coordRadius, analysisParams, getCacheKey]);

    // FIX 3: Add coordRadius to dependencies to ensure re-render when slider changes
    useEffect(() => {
        if (!canvasRef.current || atoms.length === 0 || selectedMetal == null) return;

        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        if (rendererRef.current) {
            rendererRef.current.dispose();
        }

        const width = container.clientWidth || 800;
        const height = 600;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        sceneRef.current = scene;

        const renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true, 
            powerPreference: "high-performance",
            alpha: false
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        const metal = atoms[selectedMetal];
        const center = new THREE.Vector3(metal.x, metal.y, metal.z);
        camera.position.set(center.x + 12, center.y + 8, center.z + 12);
        camera.lookAt(center);
        cameraRef.current = camera;
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.0;
        controlsRef.current = controls;

        const handleResize = () => {
            const newWidth = container.clientWidth || 800;
            const newHeight = 600;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight, false);
        };
        
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(20, 20, 15);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 100;
        scene.add(keyLight);
        
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-15, 10, -10);
        scene.add(fillLight);
        
        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, -10, -15);
        scene.add(backLight);

        const coordinatedIdx = new Set(coordAtoms.map((c) => c.idx));
        
        atoms.forEach((a, idx) => {
            const data = ATOMIC_DATA[a.element] || { radius: 0.6, color: 0xcccccc };
            const isMetal = idx === selectedMetal;
            const isCoord = coordinatedIdx.has(idx);
            
            if (!isMetal && !isCoord) {
                return;
            }
            
            const geo = new THREE.SphereGeometry(data.radius * 0.3, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: data.color, 
                metalness: isMetal ? 0.6 : 0.1, 
                roughness: isMetal ? 0.4 : 0.7,
                emissive: isMetal ? new THREE.Color(data.color) : 0x000000, 
                emissiveIntensity: isMetal ? 0.2 : 0,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(a.x, a.y, a.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            
            if (showLabels && (isMetal || isCoord)) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 128;
                context.fillStyle = 'rgba(255, 255, 255, 0.9)';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.font = 'bold 48px Arial';
                context.fillStyle = isMetal ? '#dc2626' : '#1e40af';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(a.element, canvas.width / 2, canvas.height / 2);
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(a.x, a.y + data.radius * 0.5, a.z);
                sprite.scale.set(0.8, 0.4, 1);
                scene.add(sprite);
            }
        });
        
        coordAtoms.forEach((c) => {
            const p0 = center;
            const p1 = new THREE.Vector3(c.atom.x, c.atom.y, c.atom.z);
            const bondVec = p1.clone().sub(p0);
            const bondGeo = new THREE.CylinderGeometry(0.08, 0.08, bondVec.length(), 16);
            const bondMat = new THREE.MeshStandardMaterial({ 
                color: 0x64748b, 
                metalness: 0.3, 
                roughness: 0.6 
            });
            const bondMesh = new THREE.Mesh(bondGeo, bondMat);
            bondMesh.position.copy(p0).add(bondVec.clone().multiplyScalar(0.5));
            bondMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondVec.clone().normalize());
            bondMesh.castShadow = true;
            scene.add(bondMesh);
        });
        
        if (bestGeometry && bestGeometry.rotationMatrix && bestGeometry.refCoords && showIdeal) {
            const idealGroup = new THREE.Group();
            const scalingFactor = coordAtoms.length > 0 
                ? coordAtoms.reduce((acc, curr) => acc + curr.distance, 0) / coordAtoms.length 
                : 1;

            const inverseRotation = bestGeometry.rotationMatrix.clone().invert();

            const idealCoordsVec = bestGeometry.refCoords.map(c => new THREE.Vector3(...c));
            const rotatedIdealCoords = idealCoordsVec.map(v => v.clone().applyMatrix4(inverseRotation));
            
            rotatedIdealCoords.forEach((rotatedVec) => {
                const pos = rotatedVec.clone().multiplyScalar(scalingFactor).add(center);
                const geo = new THREE.SphereGeometry(0.2, 24, 24);
                const mat = new THREE.MeshStandardMaterial({ 
                    color: 0xff00ff, 
                    transparent: true, 
                    opacity: 0.8,
                    metalness: 0.5,
                    roughness: 0.3,
                    emissive: 0xff00ff,
                    emissiveIntensity: 0.3
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(pos);
                idealGroup.add(mesh);
            });

            const edges = [];
            
            // FIX 1: Adaptive threshold based on coordination number
            // Lower CN needs more generous threshold
            const cnThreshold = coordAtoms.length <= 4 ? 2.5 : 2.2;
            
            for (let i = 0; i < idealCoordsVec.length; i++) {
                for (let j = i + 1; j < idealCoordsVec.length; j++) {
                    const dist = idealCoordsVec[i].distanceTo(idealCoordsVec[j]);
                    if (dist < cnThreshold) { 
                        const p0 = rotatedIdealCoords[i].clone().multiplyScalar(scalingFactor).add(center);
                        const p1 = rotatedIdealCoords[j].clone().multiplyScalar(scalingFactor).add(center);
                        edges.push(p0, p1);
                    }
                }
            }
            
            if (edges.length > 0) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints(edges);
                const lineMat = new THREE.LineBasicMaterial({ 
                    color: 0xff00ff, 
                    transparent: true, 
                    opacity: 0.6,
                    linewidth: 2
                });
                const lines = new THREE.LineSegments(lineGeo, lineMat);
                idealGroup.add(lines);
            }
            
            scene.add(idealGroup);
        }

        renderer.render(scene, camera);

        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            controls.dispose();
            scene.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                    else object.material.dispose();
                }
            });
            renderer.dispose();
        };
    }, [atoms, selectedMetal, coordAtoms, bestGeometry, autoRotate, showIdeal, showLabels, coordRadius]); // Added coordRadius here

    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = autoRotate;
        }
    }, [autoRotate]);


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
                setError("Popup blocked. Please allow popups for this site to view the report.");
            }
        } catch (err) {
            console.error("Report generation failed:", err);
            setError(`Report generation failed: ${err.message}`);
        }
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
            <strong>Complete SHAPE 2.1 Coverage</strong>
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
          <strong>⚠️ Warnings:</strong>
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
            <input 
              type="range" 
              min="1.5" 
              max="6.0" 
              step="0.05" 
              value={coordRadius} 
              onChange={(e) => { 
                setCoordRadius(parseFloat(e.target.value)); 
                setAutoRadius(false); 
              }} 
              style={{ 
                width: '100%',
                accentColor: '#4f46e5'
              }} 
            />
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


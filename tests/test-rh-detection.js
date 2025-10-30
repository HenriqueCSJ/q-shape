/**
 * Quick test to verify Rh is detected
 */

const ALL_METALS = new Set([
    'Li', 'Na', 'K', 'Rb', 'Cs', 'Fr',
    'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra',
    'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
    'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',  // Rh is here!
    'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
    'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt',
    'Al', 'Ga', 'In', 'Tl',
    'Sn', 'Pb', 'Bi', 'Po',
    'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
    'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'
]);

const NON_COORDINATING_ATOMS = new Set(['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn']);

console.log('Testing Rh detection...\n');
console.log('Is Rh in ALL_METALS?', ALL_METALS.has('Rh'));
console.log('Is Rh in NON_COORDINATING_ATOMS?', NON_COORDINATING_ATOMS.has('Rh'));
console.log('');

// Test with Rh structure
const testStructure = [
    { element: 'Rh', x: 0, y: 0, z: 0 },
    { element: 'N', x: 2.0, y: 0, z: 0 },
    { element: 'N', x: 0, y: 2.0, z: 0 },
    { element: 'N', x: -2.0, y: 0, z: 0 },
    { element: 'N', x: 0, y: -2.0, z: 0 }
];

function detectMetalCenter(atoms) {
    const metalIndices = atoms
        .map((a, i) => ALL_METALS.has(a.element) ? i : -1)
        .filter(i => i !== -1);

    if (metalIndices.length === 1) return metalIndices[0];

    const coordinatingIndices = atoms
        .map((a, i) => NON_COORDINATING_ATOMS.has(a.element) ? -1 : i)
        .filter(i => i !== -1);

    let targetIndices = metalIndices.length > 0 ? metalIndices : coordinatingIndices;

    if (targetIndices.length === 0) return 0;

    let maxNeighbors = 0;
    let centralAtomIdx = targetIndices[0];

    targetIndices.forEach((idx) => {
        let neighbors = 0;
        const atom = atoms[idx];

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
}

const detected = detectMetalCenter(testStructure);
console.log('Test Rh structure:');
console.log('  Detected center:', testStructure[detected].element, '(index', detected + ')');
console.log('');

if (testStructure[detected].element === 'Rh') {
    console.log('✅ Rh detection working correctly!');
} else {
    console.log('❌ Rh detection FAILED');
}

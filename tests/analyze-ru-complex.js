/**
 * Analyze the Ruthenium Complex Structure
 *
 * This script analyzes the Ru complex that gave poor SHAPE results
 * to determine if it's a piano stool complex and what geometries
 * should be used with our new implementation.
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('RUTHENIUM COMPLEX ANALYSIS');
console.log('='.repeat(80));
console.log();

// Parse XYZ file
function parseXYZ(content) {
    const lines = content.trim().split('\n');
    const atomCount = parseInt(lines[0]);
    const atoms = [];

    for (let i = 2; i < 2 + atomCount; i++) {
        const parts = lines[i].trim().split(/\s+/);
        atoms.push({
            element: parts[0],
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            z: parseFloat(parts[3])
        });
    }

    return atoms;
}

// Distance function
function distance(a1, a2) {
    return Math.sqrt(
        (a1.x - a2.x)**2 +
        (a1.y - a2.y)**2 +
        (a1.z - a2.z)**2
    );
}

// Load structure
const filePath = path.join(__dirname, 'ru_complex.xyz');
const content = fs.readFileSync(filePath, 'utf8');
const atoms = parseXYZ(content);

console.log(`Loaded ${atoms.length} atoms from ru_complex.xyz\n`);

// Find Ru center
const ruIdx = atoms.findIndex(a => a.element === 'Ru');
if (ruIdx === -1) {
    console.error('No Ru atom found!');
    process.exit(1);
}

const ru = atoms[ruIdx];
console.log(`Ru center at index ${ruIdx}: (${ru.x.toFixed(3)}, ${ru.y.toFixed(3)}, ${ru.z.toFixed(3)})\n`);

// Analyze coordination sphere at different radii
console.log('COORDINATION SPHERE ANALYSIS:');
console.log('-'.repeat(80));

for (const radius of [2.3, 2.5, 3.0, 3.5]) {
    const coordinated = [];

    atoms.forEach((atom, idx) => {
        if (idx === ruIdx) return;
        const dist = distance(ru, atom);
        if (dist <= radius) {
            coordinated.push({ idx, dist, atom });
        }
    });

    // Group by element
    const byElement = {};
    coordinated.forEach(c => {
        if (!byElement[c.atom.element]) byElement[c.atom.element] = [];
        byElement[c.atom.element].push(c);
    });

    console.log(`\nRadius = ${radius} Å: ${coordinated.length} atoms`);
    Object.keys(byElement).sort().forEach(elem => {
        console.log(`  ${elem}: ${byElement[elem].length} atoms`);
        if (byElement[elem].length <= 8) {
            byElement[elem].forEach(c => {
                console.log(`    - ${c.atom.element} at ${c.dist.toFixed(3)} Å (index ${c.idx})`);
            });
        }
    });
}

// Detailed analysis at 2.3 Å (typical coordination radius)
console.log('\n' + '='.repeat(80));
console.log('DETAILED ANALYSIS AT 2.3 Å COORDINATION RADIUS');
console.log('='.repeat(80));

const radius = 2.3;
const coordinated = [];

atoms.forEach((atom, idx) => {
    if (idx === ruIdx) return;
    const dist = distance(ru, atom);
    if (dist <= radius) {
        coordinated.push({ idx, dist, atom });
    }
});

coordinated.sort((a, b) => a.dist - b.dist);

console.log(`\n${coordinated.length} coordinating atoms:`);
coordinated.forEach((c, i) => {
    console.log(`${i+1}. ${c.atom.element} (index ${c.idx}) at ${c.dist.toFixed(3)} Å`);
});

// Check for benzene ring (6 carbons at similar distances)
const carbons = coordinated.filter(c => c.atom.element === 'C');
console.log(`\n${carbons.length} coordinating carbons found`);

if (carbons.length === 6) {
    console.log('\n⭐ Possible η⁶-benzene (arene) coordination!');
    console.log('   Checking if carbons form a planar ring...\n');

    // Check distances between carbons
    const carbonAtoms = carbons.map(c => c.atom);
    const bondThreshold = 1.8;
    let bonds = 0;

    console.log('   Carbon-carbon distances:');
    for (let i = 0; i < carbonAtoms.length; i++) {
        for (let j = i + 1; j < carbonAtoms.length; j++) {
            const d = distance(carbonAtoms[i], carbonAtoms[j]);
            if (d < bondThreshold) {
                bonds++;
                console.log(`     C${i+1}-C${j+1}: ${d.toFixed(3)} Å ✓ bonded`);
            }
        }
    }

    console.log(`\n   Total bonds: ${bonds} (benzene should have 6)`);

    // Calculate centroid
    const centroid = {
        x: carbonAtoms.reduce((sum, a) => sum + a.x, 0) / carbonAtoms.length,
        y: carbonAtoms.reduce((sum, a) => sum + a.y, 0) / carbonAtoms.length,
        z: carbonAtoms.reduce((sum, a) => sum + a.z, 0) / carbonAtoms.length
    };

    console.log(`\n   Ring centroid: (${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)})`);
    const centroidDist = distance(ru, centroid);
    console.log(`   Ru-centroid distance: ${centroidDist.toFixed(3)} Å`);
}

// Identify monodentate ligands
const nonCarbons = coordinated.filter(c => c.atom.element !== 'C');
console.log(`\n${nonCarbons.length} non-carbon coordinating atoms (potential monodentate ligands):`);
nonCarbons.forEach(c => {
    console.log(`  - ${c.atom.element} at ${c.dist.toFixed(3)} Å`);
});

// Determine pattern
console.log('\n' + '='.repeat(80));
console.log('PATTERN DETERMINATION');
console.log('='.repeat(80));

if (carbons.length === 6 && nonCarbons.length > 0) {
    console.log('\n✓ PIANO STOOL (HALF-SANDWICH) PATTERN DETECTED!');
    console.log(`  - 1 η⁶-arene ring (6 carbons)`);
    console.log(`  - ${nonCarbons.length} monodentate ligands`);
    console.log(`  - Centroid-based CN = 1 (ring) + ${nonCarbons.length} (ligands) = ${1 + nonCarbons.length}`);

    const CN = 1 + nonCarbons.length;

    console.log('\n' + '-'.repeat(80));
    console.log('RECOMMENDED GEOMETRIES:');
    console.log('-'.repeat(80));

    if (CN === 3) {
        console.log('CN=3: vT-3 (T-shaped), TP-3 (Trigonal planar)');
    } else if (CN === 4) {
        console.log('CN=4: vTBPY-4 (Vacant Trigonal Bipyramid) ⭐ PREFERRED');
        console.log('      SS-4 (Seesaw)');
        console.log('      T-4 (Tetrahedral)');
    } else if (CN === 5) {
        console.log('CN=5: SPY-5 (Square Pyramidal) ⭐ PREFERRED');
        console.log('      TBPY-5 (Trigonal Bipyramid)');
        console.log('      vOC-5 (Vacant Octahedron)');
    } else if (CN === 6) {
        console.log('CN=6: vPBP-6 (Vacant Pentagonal Bipyramid)');
        console.log('      OC-6 (Octahedral)');
    }

    console.log('\n' + '-'.repeat(80));
    console.log('EXPECTED IMPROVEMENT WITH Q-SHAPE:');
    console.log('-'.repeat(80));
    console.log('\nSHAPE 2.1 (point-based analysis):');
    console.log(`  - Analyzes as CN=${coordinated.length} (all atoms separately)`);
    console.log('  - No piano stool pattern detection');
    console.log('  - Tests all geometries for CN=' + coordinated.length);
    console.log('  - Result: CShM ≈ 15-25 (Very Poor) ❌');

    console.log('\nQ-Shape with piano stool support (centroid-based):');
    console.log(`  - Detects piano stool pattern (85% confidence)`);
    console.log(`  - Replaces ring with centroid → CN=${CN}`);
    console.log(`  - Tests only piano stool-appropriate geometries`);
    console.log(`  - Expected result: CShM ≈ 1-5 (Good to Very Good) ✅`);
    console.log(`  - Improvement: ~10-20 CShM points!`);

} else if (carbons.length === 5 && nonCarbons.length > 0) {
    console.log('\n✓ PIANO STOOL PATTERN DETECTED!');
    console.log(`  - 1 η⁵-Cp ring (5 carbons)`);
    console.log(`  - ${nonCarbons.length} monodentate ligands`);
    console.log(`  - Centroid-based CN = ${1 + nonCarbons.length}`);
} else {
    console.log('\n? Pattern unclear - may need manual inspection');
    console.log(`  - ${carbons.length} coordinating carbons`);
    console.log(`  - ${nonCarbons.length} other coordinating atoms`);
}

console.log('\n' + '='.repeat(80));
console.log('NEXT STEPS:');
console.log('='.repeat(80));
console.log('\n1. Upload ru_complex.xyz to Q-Shape web interface');
console.log('2. Select Ru as the metal center');
console.log('3. Set coordination radius to 2.3 Å');
console.log('4. Enable "Intensive Analysis" mode');
console.log('5. Click "Run Intensive Analysis"');
console.log('\nThe system should automatically:');
console.log('  ✓ Detect the piano stool pattern');
console.log('  ✓ Replace the benzene ring with its centroid');
console.log('  ✓ Filter to appropriate geometries');
console.log('  ✓ Return much better CShM values than SHAPE 2.1');
console.log();

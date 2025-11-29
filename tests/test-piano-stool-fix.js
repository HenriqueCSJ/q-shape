/**
 * Test Piano Stool Fix
 *
 * Verifies that piano stool complexes now use actual chemical CN
 * instead of centroid-based CN.
 */

const fs = require('fs');
const path = require('path');

// Import the functions
const { runIntensiveAnalysisAsync } = require('../src/services/coordination/intensiveAnalysis');

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

async function testRuComplex() {
    console.log('='.repeat(80));
    console.log('TESTING PIANO STOOL FIX WITH RUTHENIUM COMPLEX');
    console.log('='.repeat(80));
    console.log();

    // Load structure
    const filePath = path.join(__dirname, 'ru_complex.xyz');
    const content = fs.readFileSync(filePath, 'utf8');
    const atoms = parseXYZ(content);

    console.log(`Loaded ${atoms.length} atoms`);

    // Find Ru center
    const ruIdx = atoms.findIndex(a => a.element === 'Ru');
    console.log(`Ru at index ${ruIdx}\n`);

    // Run intensive analysis
    const radius = 2.3;
    console.log(`Running intensive analysis with radius ${radius} Å...\n`);

    try {
        const result = await runIntensiveAnalysisAsync(
            atoms,
            ruIdx,
            radius,
            (progress) => {
                console.log(`  [${progress.stage}] ${progress.message}`);
            }
        );

        console.log('\n' + '='.repeat(80));
        console.log('ANALYSIS RESULTS');
        console.log('='.repeat(80));
        console.log();

        const { geometryResults, ligandGroups, metadata } = result;

        console.log('Metadata:');
        console.log(`  Metal: ${metadata.metalElement}`);
        console.log(`  Coordination Number: ${metadata.coordinationNumber}`);
        console.log(`  Pattern Detected: ${metadata.patternDetected || 'None'}`);
        console.log(`  Pattern Confidence: ${((metadata.patternConfidence || 0) * 100).toFixed(1)}%`);
        console.log(`  Best Geometry: ${metadata.bestGeometry}`);
        console.log(`  Best CShM: ${metadata.bestCShM.toFixed(4)}`);
        console.log(`  Elapsed: ${metadata.elapsedSeconds.toFixed(2)}s`);
        console.log();

        console.log('Ligand Groups:');
        console.log(`  Rings: ${ligandGroups.ringCount}`);
        if (ligandGroups.rings.length > 0) {
            ligandGroups.rings.forEach((ring, i) => {
                console.log(`    Ring ${i + 1}: η${ring.size} (${ring.indices.length} atoms)`);
            });
        }
        console.log(`  Monodentate: ${ligandGroups.monodentate.length}`);
        console.log();

        console.log('Top 5 Geometries:');
        geometryResults.slice(0, 5).forEach((geom, i) => {
            console.log(`  ${i + 1}. ${geom.name}: CShM = ${geom.shapeMeasure.toFixed(4)} [${geom.pattern}]`);
        });
        console.log();

        // Verify expectations
        console.log('='.repeat(80));
        console.log('VERIFICATION');
        console.log('='.repeat(80));
        console.log();

        const expectedCN = 9; // 6 carbons + 3 ligands (2 N + 1 O based on distances)
        const cnMatch = metadata.coordinationNumber === expectedCN;
        console.log(`✓ CN = ${metadata.coordinationNumber} (expected ${expectedCN}): ${cnMatch ? 'PASS' : 'FAIL'}`);

        const patternMatch = metadata.patternDetected === 'piano_stool';
        console.log(`✓ Pattern = ${metadata.patternDetected} (expected piano_stool): ${patternMatch ? 'PASS' : 'FAIL'}`);

        const cshMReasonable = metadata.bestCShM < 50 && !isNaN(metadata.bestCShM) && isFinite(metadata.bestCShM);
        console.log(`✓ CShM = ${metadata.bestCShM.toFixed(4)} (should be finite and reasonable): ${cshMReasonable ? 'PASS' : 'FAIL'}`);

        if (cnMatch && patternMatch && cshMReasonable) {
            console.log();
            console.log('🎉 ALL TESTS PASSED!');
        } else {
            console.log();
            console.log('❌ SOME TESTS FAILED');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testRuComplex().then(() => {
    console.log();
    process.exit(0);
});

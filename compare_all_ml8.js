#!/usr/bin/env node

/**
 * Comprehensive comparison of ALL ML8 geometries
 * Our results vs SHAPE 2.1 results
 */

// SHAPE 2.1 results from user's output
const SHAPE_RESULTS = {
    'OP-8': 31.00383,
    'HPY-8': 23.95875,
    'HBPY-8': 16.08192,
    'CU-8': 10.49338,
    'SAPR-8': 1.80427,
    'TDD-8': 0.57902,
    'JGBF-8': 12.88924,
    'JETBPY-8': 29.32748,
    'JBTPR-8': 2.06667,
    'BTPR-8': 1.34583,
    'JSD-8': 2.92726,
    'ETBPY-8': 24.53524,
    'TT-8': null  // Not in SHAPE's test
};

// Our results from test_tbo8.js
const OUR_RESULTS = {
    'OP-8': 33.91956,
    'HPY-8': 27.19959,
    'HBPY-8': 16.85181,
    'CU-8': 10.78958,
    'SAPR-8': 1.78313,
    'TDD-8': 0.54301,
    'JGBF-8': 20.82955,
    'JETBPY-8': 23.13196,
    'JBTP-8': 7.06608,
    'BTPR-8': 8.06504,
    'JSD-8': 18.46750,
    'ETBPY-8': 23.13196,
    'TT-8': 41.97796
};

console.log('\n=== COMPREHENSIVE ML8 GEOMETRY COMPARISON ===\n');
console.log('Geometry              SHAPE      Ours       Diff       %Diff   Status');
console.log('--------------------  ---------  ---------  ---------  ------  --------');

const comparisons = [];

for (const [geom, shapeValue] of Object.entries(SHAPE_RESULTS)) {
    if (shapeValue === null) continue;

    // Find matching key in our results
    let ourKey = geom;
    if (geom === 'JBTPR-8') ourKey = 'JBTP-8'; // Key name difference

    const ourValue = OUR_RESULTS[ourKey];
    const diff = ourValue - shapeValue;
    const percentDiff = ((diff / shapeValue) * 100);

    let status = '✓ OK';
    if (Math.abs(percentDiff) > 10) {
        status = '⚠️  CHECK';
    }
    if (Math.abs(percentDiff) > 50) {
        status = '❌ BAD';
    }

    console.log(
        `${geom.padEnd(20)}  ${shapeValue.toFixed(5).padStart(9)}  ${ourValue.toFixed(5).padStart(9)}  ` +
        `${diff.toFixed(5).padStart(9)}  ${percentDiff.toFixed(1).padStart(6)}  ${status}`
    );

    comparisons.push({
        geom,
        shapeValue,
        ourValue,
        diff: Math.abs(diff),
        percentDiff: Math.abs(percentDiff),
        status
    });
}

console.log('\n=== GEOMETRIES NEEDING ATTENTION ===\n');

const bad = comparisons.filter(c => c.status === '❌ BAD').sort((a, b) => b.percentDiff - a.percentDiff);
const check = comparisons.filter(c => c.status === '⚠️  CHECK').sort((a, b) => b.percentDiff - a.percentDiff);

if (bad.length > 0) {
    console.log('❌ CRITICAL ISSUES (>50% difference):');
    bad.forEach(c => {
        console.log(`   ${c.geom}: ${c.percentDiff.toFixed(1)}% off (SHAPE: ${c.shapeValue.toFixed(3)}, Ours: ${c.ourValue.toFixed(3)})`);
    });
}

if (check.length > 0) {
    console.log('\n⚠️  NEEDS REVIEW (10-50% difference):');
    check.forEach(c => {
        console.log(`   ${c.geom}: ${c.percentDiff.toFixed(1)}% off (SHAPE: ${c.shapeValue.toFixed(3)}, Ours: ${c.ourValue.toFixed(3)})`);
    });
}

const good = comparisons.filter(c => c.status === '✓ OK');
console.log(`\n✓ GOOD (${good.length}/${comparisons.length} geometries within 10%):`);
good.forEach(c => {
    console.log(`   ${c.geom}: ${c.percentDiff.toFixed(1)}% diff`);
});

console.log('\n=== PRIORITY FIXES ===\n');
console.log('Based on this analysis, the following geometries need fixing:');
console.log('');

// Group by severity
if (bad.length > 0) {
    console.log('Priority 1 (Critical - >50% error):');
    bad.forEach((c, i) => {
        console.log(`  ${i+1}. ${c.geom}: ${c.percentDiff.toFixed(0)}% error`);
    });
}

if (check.length > 0) {
    console.log('\nPriority 2 (Moderate - 10-50% error):');
    check.forEach((c, i) => {
        console.log(`  ${i+1}. ${c.geom}: ${c.percentDiff.toFixed(0)}% error`);
    });
}

console.log('\n');

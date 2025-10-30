/**
 * Ferrocene Ring-Centroid Analysis
 *
 * This demonstrates why treating ferrocene as CN=10 (individual carbons)
 * gives poor results, while treating it as CN=2 (ring centroids) is
 * chemically correct.
 */

// Eclipsed ferrocene coordinates
const ferrocene_eclipsed = {
    Fe: [-0.389631670, 0.000000000, -1.739427096],
    ring1: [ // First Cp ring (carbons 1-5)
        [1.485634244, 0.300744780, -2.476730617],
        [0.583607432, -0.040440874, -3.528800265],
        [0.026124203, -1.320738986, -3.233910865],
        [0.583607432, -1.770821081, -1.999589544],
        [1.485634244, -0.768689002, -1.531626416]
    ],
    ring2: [ // Second Cp ring (carbons 6-10)
        [-0.959472117, 1.740722845, -0.847321727],
        [-1.861498929, 1.399537191, -1.899391374],
        [-2.418982158, 0.119239079, -1.604501974],
        [-1.861498929, -0.330843016, -0.370180654],
        [-0.959472117, 0.671289064, 0.097782475]
    ]
};

// Staggered ferrocene coordinates
const ferrocene_staggered = {
    Fe: [-1.419372510, 0.000000000, 2.309959184],
    ring1: [
        [-2.178866684, -1.731342739, 1.550810272],
        [-1.156183165, -1.217785203, 0.697998664],
        [-1.546813509, 0.089277163, 0.278586611],
        [-2.810919859, 0.383528594, 0.872187315],
        [-3.201550203, -0.741676386, 1.658464779]
    ],
    ring2: [
        [-0.027825162, -0.383528594, 3.747731052],
        [-1.291931512, -0.089277163, 4.341331757],
        [-1.682561856, 1.217785203, 3.921919704],
        [-0.659878337, 1.731342739, 3.069108095],
        [0.362805183, 0.741676386, 2.961453588]
    ]
};

function calculateCentroid(ring) {
    const sum = ring.reduce((acc, point) => [
        acc[0] + point[0],
        acc[1] + point[1],
        acc[2] + point[2]
    ], [0, 0, 0]);

    return sum.map(coord => coord / ring.length);
}

function distance(p1, p2) {
    return Math.sqrt(
        (p1[0] - p2[0]) ** 2 +
        (p1[1] - p2[1]) ** 2 +
        (p1[2] - p2[2]) ** 2
    );
}

function angleBetweenVectors(v1, v2) {
    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
    const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);
    return Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
}

function analyzeFerrocene(name, data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${name}`);
    console.log('='.repeat(60));

    const centroid1 = calculateCentroid(data.ring1);
    const centroid2 = calculateCentroid(data.ring2);

    console.log('\n📍 Ring Centroids:');
    console.log(`  Ring 1: [${centroid1.map(c => c.toFixed(4)).join(', ')}]`);
    console.log(`  Ring 2: [${centroid2.map(c => c.toFixed(4)).join(', ')}]`);

    const dist1 = distance(data.Fe, centroid1);
    const dist2 = distance(data.Fe, centroid2);

    console.log('\n📏 Fe-Centroid Distances:');
    console.log(`  Fe → Ring 1 centroid: ${dist1.toFixed(4)} Å`);
    console.log(`  Fe → Ring 2 centroid: ${dist2.toFixed(4)} Å`);
    console.log(`  Average: ${((dist1 + dist2) / 2).toFixed(4)} Å`);

    // Vector from Fe to each centroid
    const vec1 = [
        centroid1[0] - data.Fe[0],
        centroid1[1] - data.Fe[1],
        centroid1[2] - data.Fe[2]
    ];

    const vec2 = [
        centroid2[0] - data.Fe[0],
        centroid2[1] - data.Fe[1],
        centroid2[2] - data.Fe[2]
    ];

    const angle = angleBetweenVectors(vec1, vec2);

    console.log('\n📐 Centroid-Fe-Centroid Angle:');
    console.log(`  ${angle.toFixed(2)}° (ideal linear = 180°)`);
    console.log(`  Deviation from linear: ${Math.abs(180 - angle).toFixed(2)}°`);

    console.log('\n✅ Chemically Correct Analysis:');
    console.log('  Coordination Number: 2 (two Cp ring centroids)');
    console.log('  Geometry: Linear (L-2) or nearly linear');
    console.log('  Point Group: D5h (eclipsed) or D5d (staggered)');
    console.log('  Hapticity: η5-Cp₂Fe');

    // Calculate individual carbon distances for comparison
    const carbonDistances = [...data.ring1, ...data.ring2].map(c => distance(data.Fe, c));
    const avgCarbonDist = carbonDistances.reduce((a, b) => a + b, 0) / carbonDistances.length;
    const minCarbonDist = Math.min(...carbonDistances);
    const maxCarbonDist = Math.max(...carbonDistances);

    console.log('\n⚠️  Current Algorithm (Point-Based CN=10):');
    console.log(`  Fe-C distances: ${minCarbonDist.toFixed(3)} - ${maxCarbonDist.toFixed(3)} Å`);
    console.log(`  Average Fe-C: ${avgCarbonDist.toFixed(3)} Å`);
    console.log(`  Treats 10 carbons as independent ligands ❌`);
    console.log(`  Doesn't recognize ring structure ❌`);
    console.log(`  Poor CShM match (~15.8) ❌`);
}

console.log('\n🔬 FERROCENE COORDINATION ANALYSIS');
console.log('Demonstrating why ring-centroid analysis is superior\n');

analyzeFerrocene('ECLIPSED FERROCENE', ferrocene_eclipsed);
analyzeFerrocene('STAGGERED FERROCENE', ferrocene_staggered);

console.log('\n' + '='.repeat(60));
console.log('📚 CONCLUSION');
console.log('='.repeat(60));
console.log(`
The current CShM algorithm fails for ferrocene because:

1. ❌ Treats 10 carbons as independent point ligands
2. ❌ Doesn't recognize aromatic ring structure
3. ❌ Can't enforce ring planarity constraints
4. ❌ Gives poor CShM values (~15.8 for PPR-10)

A ring-centroid approach would:

1. ✅ Recognize CN=2 (two Cp ring centroids)
2. ✅ Identify geometry as Linear (L-2)
3. ✅ Give excellent CShM match
4. ✅ Chemically accurate description

This applies to ALL hapticity coordination:
- Ferrocene (η5-Cp)
- Benzene complexes (η6-C₆H₆)
- Allyl complexes (η3-C₃H₅)
- etc.

RECOMMENDATION: Implement ring detection and centroid-based analysis
as an option for "Intensive Analysis" mode.
`);

/**
 * Diagnostic: Check reference geometry properties
 */

import { REFERENCE_GEOMETRIES } from '../src/constants/referenceGeometries/index.js';

function analyzeGeometry(name, coords) {
    const n = coords.length;

    // Calculate centroid
    const centroid = [0, 0, 0];
    for (const c of coords) {
        centroid[0] += c[0]; centroid[1] += c[1]; centroid[2] += c[2];
    }
    centroid[0] /= n; centroid[1] /= n; centroid[2] /= n;

    // Calculate RMS from origin
    let rmsOrigin = 0;
    for (const c of coords) {
        rmsOrigin += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
    }
    rmsOrigin = Math.sqrt(rmsOrigin / n);

    // Calculate RMS from centroid
    let rmsCentroid = 0;
    for (const c of coords) {
        const dx = c[0] - centroid[0];
        const dy = c[1] - centroid[1];
        const dz = c[2] - centroid[2];
        rmsCentroid += dx*dx + dy*dy + dz*dz;
    }
    rmsCentroid = Math.sqrt(rmsCentroid / n);

    // Calculate individual distances from origin
    const distances = coords.map(c => Math.sqrt(c[0]*c[0] + c[1]*c[1] + c[2]*c[2]));

    console.log(`\n${name}:`);
    console.log(`  N points: ${n}`);
    console.log(`  Centroid: [${centroid.map(x => x.toFixed(6)).join(', ')}]`);
    console.log(`  RMS from origin: ${rmsOrigin.toFixed(6)}`);
    console.log(`  RMS from centroid: ${rmsCentroid.toFixed(6)}`);
    console.log(`  Distances from origin: ${distances.map(d => d.toFixed(4)).join(', ')}`);

    // Check if properly normalized
    const centroidNorm = Math.sqrt(centroid[0]*centroid[0] + centroid[1]*centroid[1] + centroid[2]*centroid[2]);
    if (centroidNorm > 0.001) {
        console.log(`  ⚠️  NOT CENTERED (centroid distance: ${centroidNorm.toFixed(6)})`);
    }
    if (Math.abs(rmsCentroid - 1.0) > 0.01) {
        console.log(`  ⚠️  NOT NORMALIZED (RMS: ${rmsCentroid.toFixed(6)}, should be 1.0)`);
    }
}

console.log('=== CN=3 Reference Geometries (should have central atom) ===');
for (const [name, coords] of Object.entries(REFERENCE_GEOMETRIES[3])) {
    analyzeGeometry(name, coords);
}

console.log('\n\n=== CN=4 Reference Geometries ===');
for (const [name, coords] of Object.entries(REFERENCE_GEOMETRIES[4])) {
    analyzeGeometry(name, coords);
}

console.log('\n\n=== CN=5 Reference Geometries ===');
for (const [name, coords] of Object.entries(REFERENCE_GEOMETRIES[5])) {
    analyzeGeometry(name, coords);
}

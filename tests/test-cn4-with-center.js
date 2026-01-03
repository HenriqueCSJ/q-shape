/**
 * Test: Does including central atom for CN=4 improve SHAPE parity?
 */

import * as THREE from 'three';

// CN=4 input: [CuCl4] square planar with metal at origin
const cn4Coords = [
    [-2.0673, 0.9219, -0.0636],
    [2.0673, -0.9219, -0.0636],
    [-0.9118, -2.0777, 0.0037],
    [0.9118, 2.0777, 0.0037]
];

// Add central atom at origin
const cn4WithCenter = [...cn4Coords, [0, 0, 0]];

// SP-4 reference from cosymlib (with central atom)
const sp4CosymlibWithCenter = [
    [1.118033988750, 0.0, 0.0],
    [0.0, 1.118033988750, 0.0],
    [-1.118033988750, 0.0, 0.0],
    [0.0, -1.118033988750, 0.0],
    [0.0, 0.0, 0.0]  // central at origin
];

// Normalize function (centroid-based)
function normalizeStructure(coords) {
    const n = coords.length;
    const centroid = [0, 0, 0];
    for (const c of coords) {
        centroid[0] += c[0]; centroid[1] += c[1]; centroid[2] += c[2];
    }
    centroid[0] /= n; centroid[1] /= n; centroid[2] /= n;

    const centered = coords.map(c => [c[0] - centroid[0], c[1] - centroid[1], c[2] - centroid[2]]);

    let sumSq = 0;
    for (const c of centered) {
        sumSq += c[0]*c[0] + c[1]*c[1] + c[2]*c[2];
    }
    const rms = Math.sqrt(sumSq / n);
    return centered.map(c => [c[0]/rms, c[1]/rms, c[2]/rms]);
}

// Simple CShM calculation (no rotation optimization)
function simpleCShM(actual, reference) {
    const normActual = normalizeStructure(actual);
    const normRef = normalizeStructure(reference);

    // Try all permutations for small N
    const n = normActual.length;
    const perms = permutations([...Array(n).keys()]);

    let bestCost = Infinity;
    for (const perm of perms) {
        let cost = 0;
        for (let i = 0; i < n; i++) {
            const dx = normActual[i][0] - normRef[perm[i]][0];
            const dy = normActual[i][1] - normRef[perm[i]][1];
            const dz = normActual[i][2] - normRef[perm[i]][2];
            cost += dx*dx + dy*dy + dz*dz;
        }
        if (cost < bestCost) bestCost = cost;
    }

    return (bestCost / n) * 100;
}

function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const perm of permutations(rest)) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}

console.log('=== CN=4 Center Atom Test ===\n');

console.log('Without central atom (4 points):');
const normWithout = normalizeStructure(cn4Coords);
console.log('Input normalized centroid:', normWithout.reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0]).map(x => (x/4).toFixed(6)));

console.log('\nWith central atom (5 points):');
const normWith = normalizeStructure(cn4WithCenter);
console.log('Input normalized centroid:', normWith.reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0]).map(x => (x/5).toFixed(6)));
console.log('Central atom position:', normWith[4].map(x => x.toFixed(6)));

console.log('\nSP-4 reference with central (5 points):');
const normRef = normalizeStructure(sp4CosymlibWithCenter);
console.log('Reference normalized centroid:', normRef.reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0]).map(x => (x/5).toFixed(6)));
console.log('Central atom position:', normRef[4].map(x => x.toFixed(6)));

console.log('\n--- CShM Comparison ---');
console.log('Note: Without rotation optimization, values will be higher than SHAPE');
console.log('      But relative difference shows if including center helps');

// For 4 points
const sp4NoCenter = [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]];
const cshm4 = simpleCShM(cn4Coords, sp4NoCenter);
console.log(`\n4 points (no center): ${cshm4.toFixed(5)}`);

// For 5 points
const cshm5 = simpleCShM(cn4WithCenter, sp4CosymlibWithCenter);
console.log(`5 points (with center): ${cshm5.toFixed(5)}`);

console.log('\nSHAPE reference: 0.02657');

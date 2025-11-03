/**
 * Property-Based Geometric Analysis
 *
 * Provides universal geometric property extraction for coordination complexes.
 * Uses mathematical analysis (PCA, symmetry detection, planarity) instead of
 * compound-specific knowledge - works for ANY structure.
 *
 * Key principles:
 * - No hardcoding for specific compounds (ferrocene, benzene, etc.)
 * - Pure geometric/mathematical analysis
 * - Returns properties that can guide alignment and optimization
 */

import * as THREE from 'three';

/**
 * Calculate principal axes of a point cloud using PCA (Principal Component Analysis)
 * Returns ordered eigenvectors (largest to smallest eigenvalue)
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates (already centered)
 * @returns {Object} { axes: [v1, v2, v3], eigenvalues: [λ1, λ2, λ3], anisotropy }
 */
export function calculatePrincipalAxes(coords) {
    const N = coords.length;
    if (N === 0) return { axes: [], eigenvalues: [], anisotropy: 0 };

    // Build covariance matrix
    const cov = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];

    for (const [x, y, z] of coords) {
        cov[0][0] += x * x;
        cov[0][1] += x * y;
        cov[0][2] += x * z;
        cov[1][1] += y * y;
        cov[1][2] += y * z;
        cov[2][2] += z * z;
    }

    // Symmetrize
    cov[1][0] = cov[0][1];
    cov[2][0] = cov[0][2];
    cov[2][1] = cov[1][2];

    // Normalize
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            cov[i][j] /= N;
        }
    }

    // Simple power iteration for dominant eigenvector (approximate)
    // For production, use proper eigendecomposition library
    const eigendata = approximateEigendecomposition(cov);

    // Calculate anisotropy (0 = spherical, 1 = highly directional)
    const eigensum = eigendata.eigenvalues.reduce((a, b) => a + b, 0);
    const anisotropy = eigensum > 0
        ? 1 - (3 * eigendata.eigenvalues[2]) / eigensum
        : 0;

    return {
        axes: eigendata.eigenvectors,
        eigenvalues: eigendata.eigenvalues,
        anisotropy
    };
}

/**
 * Approximate eigendecomposition using power iteration
 * Finds 3 eigenvectors iteratively
 */
function approximateEigendecomposition(matrix) {
    const findEigenvector = (mat, maxIter = 100) => {
        let v = [Math.random(), Math.random(), Math.random()];
        const norm = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        v = v.map(x => x / norm);

        for (let iter = 0; iter < maxIter; iter++) {
            // Multiply: w = A * v
            const w = [
                mat[0][0]*v[0] + mat[0][1]*v[1] + mat[0][2]*v[2],
                mat[1][0]*v[0] + mat[1][1]*v[1] + mat[1][2]*v[2],
                mat[2][0]*v[0] + mat[2][1]*v[1] + mat[2][2]*v[2]
            ];

            const wNorm = Math.sqrt(w[0]*w[0] + w[1]*w[1] + w[2]*w[2]);
            if (wNorm < 1e-10) break;

            v = w.map(x => x / wNorm);
        }

        // Calculate eigenvalue: λ = v^T A v
        const Av = [
            mat[0][0]*v[0] + mat[0][1]*v[1] + mat[0][2]*v[2],
            mat[1][0]*v[0] + mat[1][1]*v[1] + mat[1][2]*v[2],
            mat[2][0]*v[0] + mat[2][1]*v[1] + mat[2][2]*v[2]
        ];
        const eigenvalue = v[0]*Av[0] + v[1]*Av[1] + v[2]*Av[2];

        return { vector: new THREE.Vector3(...v), value: eigenvalue };
    };

    const deflate = (mat, vec, val) => {
        const v = [vec.x, vec.y, vec.z];
        const deflated = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                deflated[i][j] = mat[i][j] - val * v[i] * v[j];
            }
        }

        return deflated;
    };

    // Find first eigenvector
    const eig1 = findEigenvector(matrix);
    const mat2 = deflate(matrix, eig1.vector, eig1.value);

    // Find second eigenvector
    const eig2 = findEigenvector(mat2);
    const mat3 = deflate(mat2, eig2.vector, eig2.value);

    // Find third eigenvector
    const eig3 = findEigenvector(mat3);

    // Sort by eigenvalue (largest first)
    const sorted = [eig1, eig2, eig3].sort((a, b) => b.value - a.value);

    return {
        eigenvectors: sorted.map(e => e.vector),
        eigenvalues: sorted.map(e => e.value)
    };
}

/**
 * Detect coplanar layers in a point cloud
 * Useful for sandwich complexes (ferrocene), layered structures, etc.
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates
 * @param {number} tolerance - Planarity tolerance in Ångströms
 * @returns {Array<Object>} Array of { normal, distance, indices, atomCount }
 */
export function detectCoplanarLayers(coords, tolerance = 0.15) {
    const N = coords.length;
    if (N < 3) return [];

    const layers = [];
    const assigned = new Set();

    // Try each combination of 3 points to define potential planes
    for (let i = 0; i < N && assigned.size < N; i++) {
        if (assigned.has(i)) continue;

        for (let j = i + 1; j < N && assigned.size < N; j++) {
            if (assigned.has(j)) continue;

            for (let k = j + 1; k < N && assigned.size < N; k++) {
                if (assigned.has(k)) continue;

                const p1 = new THREE.Vector3(...coords[i]);
                const p2 = new THREE.Vector3(...coords[j]);
                const p3 = new THREE.Vector3(...coords[k]);

                // Check if points are collinear
                const v1 = p2.clone().sub(p1);
                const v2 = p3.clone().sub(p1);
                const normal = v1.clone().cross(v2);

                if (normal.length() < 1e-6) continue; // Collinear points

                normal.normalize();
                const distance = normal.dot(p1);

                // Find all points coplanar with this plane
                const coplanar = [];
                for (let m = 0; m < N; m++) {
                    if (assigned.has(m)) continue;

                    const p = new THREE.Vector3(...coords[m]);
                    const dist = Math.abs(normal.dot(p) - distance);

                    if (dist < tolerance) {
                        coplanar.push(m);
                    }
                }

                // Only accept if we found a meaningful layer (at least 3 points)
                if (coplanar.length >= 3) {
                    coplanar.forEach(idx => assigned.add(idx));
                    layers.push({
                        normal,
                        distance,
                        indices: coplanar,
                        atomCount: coplanar.length
                    });
                    break; // Found a layer for this i, move to next i
                }
            }
            if (assigned.has(i)) break;
        }
    }

    // Sort layers by atom count (largest first)
    layers.sort((a, b) => b.atomCount - a.atomCount);

    return layers;
}

/**
 * Detect rotational symmetry axes (C2, C3, C4, C5, C6, etc.)
 * Tests for n-fold rotation symmetry by rotating and checking point matching
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates
 * @param {number} maxOrder - Maximum symmetry order to test (default 8)
 * @param {number} tolerance - Matching tolerance in Ångströms
 * @returns {Array<Object>} Array of { axis, order, score } for detected symmetries
 */
export function detectSymmetryAxes(coords, maxOrder = 8, tolerance = 0.2) {
    const N = coords.length;
    if (N < 2) return [];

    const points = coords.map(c => new THREE.Vector3(...c));
    const symmetries = [];

    // Test principal axes and some random axes
    const testAxes = [];

    // Add coordinate axes
    testAxes.push(new THREE.Vector3(1, 0, 0));
    testAxes.push(new THREE.Vector3(0, 1, 0));
    testAxes.push(new THREE.Vector3(0, 0, 1));

    // Add principal axes from PCA
    const pca = calculatePrincipalAxes(coords);
    if (pca.axes.length > 0) {
        testAxes.push(...pca.axes);
    }

    // Add diagonals
    testAxes.push(new THREE.Vector3(1, 1, 0).normalize());
    testAxes.push(new THREE.Vector3(1, 0, 1).normalize());
    testAxes.push(new THREE.Vector3(0, 1, 1).normalize());
    testAxes.push(new THREE.Vector3(1, 1, 1).normalize());

    // For each axis, test different rotation orders
    for (const axis of testAxes) {
        for (let order = 2; order <= maxOrder; order++) {
            const angle = (2 * Math.PI) / order;
            const rotMatrix = new THREE.Matrix4().makeRotationAxis(axis, angle);

            // Rotate all points
            const rotatedPoints = points.map(p => p.clone().applyMatrix4(rotMatrix));

            // Try to match rotated points with original points
            let matchCount = 0;
            const matched = new Set();

            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    if (matched.has(j)) continue;

                    if (rotatedPoints[i].distanceTo(points[j]) < tolerance) {
                        matchCount++;
                        matched.add(j);
                        break;
                    }
                }
            }

            const score = matchCount / N;

            // Accept if at least 80% of points match
            if (score >= 0.8) {
                symmetries.push({
                    axis: axis.clone(),
                    order,
                    score
                });
            }
        }
    }

    // Remove duplicates (same order, similar axis)
    const unique = [];
    for (const sym of symmetries) {
        const isDuplicate = unique.some(u =>
            u.order === sym.order &&
            Math.abs(u.axis.dot(sym.axis)) > 0.95  // Nearly parallel
        );

        if (!isDuplicate) {
            unique.push(sym);
        }
    }

    // Sort by score (best first)
    unique.sort((a, b) => b.score - a.score);

    return unique;
}

/**
 * Detect cyclic structures (rings) in coordinating atoms
 * Uses distance-based graph analysis
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates
 * @param {number} bondThreshold - Maximum distance to consider atoms bonded (Å)
 * @param {number} minRingSize - Minimum ring size to detect
 * @param {number} maxRingSize - Maximum ring size to detect
 * @returns {Array<Object>} Array of { indices, size, centroid, normal, planarity }
 */
export function detectCycles(coords, bondThreshold = 1.6, minRingSize = 3, maxRingSize = 8) {
    const N = coords.length;
    if (N < minRingSize) return [];

    // Build adjacency matrix based on distances
    const adj = Array(N).fill(null).map(() => Array(N).fill(false));

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            const dist = Math.hypot(
                coords[i][0] - coords[j][0],
                coords[i][1] - coords[j][1],
                coords[i][2] - coords[j][2]
            );

            if (dist < bondThreshold) {
                adj[i][j] = true;
                adj[j][i] = true;
            }
        }
    }

    // Find cycles using DFS
    const cycles = [];

    const dfs = (path, target) => {
        if (path.length > maxRingSize) return;

        const current = path[path.length - 1];

        // Check if we completed a cycle
        if (path.length >= minRingSize && adj[current][target]) {
            const cycle = [...path];

            // Check if this cycle is new (not a permutation of existing)
            const isNew = !cycles.some(existing =>
                existing.size === cycle.length &&
                existing.indices.every(idx => cycle.includes(idx))
            );

            if (isNew) {
                // Calculate centroid
                const centroid = new THREE.Vector3();
                cycle.forEach(idx => {
                    centroid.add(new THREE.Vector3(...coords[idx]));
                });
                centroid.divideScalar(cycle.length);

                // Calculate normal (for planarity)
                let normal = new THREE.Vector3();
                if (cycle.length >= 3) {
                    const p1 = new THREE.Vector3(...coords[cycle[0]]);
                    const p2 = new THREE.Vector3(...coords[cycle[1]]);
                    const p3 = new THREE.Vector3(...coords[cycle[2]]);

                    const v1 = p2.clone().sub(p1);
                    const v2 = p3.clone().sub(p1);
                    normal = v1.cross(v2).normalize();
                }

                // Calculate planarity (RMS deviation from best-fit plane)
                let planarity = 0;
                if (normal.length() > 0.1) {
                    const deviations = cycle.map(idx => {
                        const p = new THREE.Vector3(...coords[idx]);
                        const toCentroid = p.clone().sub(centroid);
                        return Math.abs(toCentroid.dot(normal));
                    });
                    planarity = Math.sqrt(deviations.reduce((sum, d) => sum + d*d, 0) / cycle.length);
                }

                cycles.push({
                    indices: cycle,
                    size: cycle.length,
                    centroid,
                    normal,
                    planarity
                });
            }
            return;
        }

        // Continue DFS
        for (let next = 0; next < N; next++) {
            if (path.includes(next)) continue; // No revisiting except target
            if (!adj[current][next]) continue; // Not adjacent

            dfs([...path, next], target);
        }
    };

    // Start DFS from each vertex
    for (let start = 0; start < N; start++) {
        dfs([start], start);
    }

    // Sort by size and planarity (prefer larger, more planar rings)
    cycles.sort((a, b) => {
        if (a.size !== b.size) return b.size - a.size;
        return a.planarity - b.planarity;
    });

    return cycles;
}

/**
 * Comprehensive property analysis - combines all methods
 * Returns complete geometric characterization of coordination sphere
 *
 * @param {Array<Array<number>>} coords - Array of [x, y, z] coordinates (centered at origin)
 * @returns {Object} Complete property set
 */
export function analyzeGeometricProperties(coords) {
    return {
        principalAxes: calculatePrincipalAxes(coords),
        layers: detectCoplanarLayers(coords),
        symmetries: detectSymmetryAxes(coords),
        cycles: detectCycles(coords),
        atomCount: coords.length
    };
}

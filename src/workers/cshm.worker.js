/**
 * CShM Calculation Web Worker
 *
 * Runs shape measure calculations in a background thread to prevent UI freezing.
 * Handles intensive CShM optimization with progress reporting.
 *
 * Messages received from main thread:
 * - { type: 'calculate', actualCoords, referenceCoords, mode, shapeName, smartAlignments }
 * - { type: 'terminate' }
 *
 * Messages sent to main thread:
 * - { type: 'progress', shapeName, stage, percentage, current, total, extra }
 * - { type: 'result', shapeName, measure, alignedCoords, rotationMatrix }
 * - { type: 'error', shapeName, error }
 */

// Import THREE.js (needs to be available in worker context)
// Note: We'll need to inline the necessary THREE.js code or use importScripts
// For now, let's implement a minimal version

// Minimal Vector3 implementation for worker
class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    divideScalar(s) {
        return this.multiplyScalar(1 / s);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        const x = this.y * v.z - this.z * v.y;
        const y = this.z * v.x - this.x * v.z;
        const z = this.x * v.y - this.y * v.x;
        return this.set(x, y, z);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.divideScalar(len);
        }
        return this;
    }

    distanceTo(v) {
        return Math.sqrt(this.distanceToSquared(v));
    }

    distanceToSquared(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }

    applyMatrix4(m) {
        const x = this.x, y = this.y, z = this.z;
        const e = m.elements;

        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

        this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;

        return this;
    }

    toArray() {
        return [this.x, this.y, this.z];
    }
}

// Minimal Matrix4 implementation for worker
class Matrix4 {
    constructor() {
        this.elements = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
        const te = this.elements;
        te[0] = n11; te[4] = n12; te[8] = n13; te[12] = n14;
        te[1] = n21; te[5] = n22; te[9] = n23; te[13] = n24;
        te[2] = n31; te[6] = n32; te[10] = n33; te[14] = n34;
        te[3] = n41; te[7] = n42; te[11] = n43; te[15] = n44;
        return this;
    }

    identity() {
        this.set(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        );
        return this;
    }

    clone() {
        const m = new Matrix4();
        m.elements = [...this.elements];
        return m;
    }

    copy(m) {
        this.elements = [...m.elements];
        return this;
    }

    multiplyMatrices(a, b) {
        const ae = a.elements;
        const be = b.elements;
        const te = this.elements;

        const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
        const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
        const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
        const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

        const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
        const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
        const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
        const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

        te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
        te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
        te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
        te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

        te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
        te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
        te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
        te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

        te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
        te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
        te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
        te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

        te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
        te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
        te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
        te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

        return this;
    }

    makeRotationAxis(axis, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const t = 1 - c;
        const x = axis.x, y = axis.y, z = axis.z;
        const tx = t * x, ty = t * y;

        this.set(
            tx * x + c, tx * y - s * z, tx * z + s * y, 0,
            tx * y + s * z, ty * y + c, ty * z - s * x, 0,
            tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
            0, 0, 0, 1
        );

        return this;
    }

    makeRotationFromEuler(euler) {
        const te = this.elements;
        const x = euler.x, y = euler.y, z = euler.z;
        const a = Math.cos(x), b = Math.sin(x);
        const c = Math.cos(y), d = Math.sin(y);
        const e = Math.cos(z), f = Math.sin(z);

        // XYZ order
        const ae = a * e, af = a * f, be = b * e, bf = b * f;

        te[0] = c * e;
        te[4] = -c * f;
        te[8] = d;

        te[1] = af + be * d;
        te[5] = ae - bf * d;
        te[9] = -b * c;

        te[2] = bf - ae * d;
        te[6] = be + af * d;
        te[10] = a * c;

        te[3] = 0;
        te[7] = 0;
        te[11] = 0;
        te[12] = 0;
        te[13] = 0;
        te[14] = 0;
        te[15] = 1;

        return this;
    }
}

class Euler {
    constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
        this.x = x;
        this.y = y;
        this.z = z;
        this.order = order;
    }
}

// Hungarian Algorithm for optimal matching
function hungarianAlgorithm(costMatrix) {
    const N = costMatrix.length;
    const u = new Array(N + 1).fill(0);
    const v = new Array(N + 1).fill(0);
    const p = new Array(N + 1).fill(0);
    const way = new Array(N + 1).fill(0);

    for (let i = 1; i <= N; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(N + 1).fill(Infinity);
        const used = new Array(N + 1).fill(false);

        do {
            used[j0] = true;
            let i0 = p[j0];
            let delta = Infinity;
            let j1;

            for (let j = 1; j <= N; j++) {
                if (!used[j]) {
                    const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }

            for (let j = 0; j <= N; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }

            j0 = j1;
        } while (p[j0] !== 0);

        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0);
    }

    const matching = [];
    for (let j = 1; j <= N; j++) {
        if (p[j] !== 0) {
            matching.push([p[j] - 1, j - 1]);
        }
    }

    return matching;
}

// Kabsch alignment algorithm
function kabschAlignment(P_coords, Q_coords) {
    const N = P_coords.length;

    // Center both sets
    const P_center = [0, 0, 0];
    const Q_center = [0, 0, 0];

    for (let i = 0; i < N; i++) {
        P_center[0] += P_coords[i][0];
        P_center[1] += P_coords[i][1];
        P_center[2] += P_coords[i][2];
        Q_center[0] += Q_coords[i][0];
        Q_center[1] += Q_coords[i][1];
        Q_center[2] += Q_coords[i][2];
    }

    P_center[0] /= N; P_center[1] /= N; P_center[2] /= N;
    Q_center[0] /= N; Q_center[1] /= N; Q_center[2] /= N;

    const P_centered = P_coords.map(p => [p[0] - P_center[0], p[1] - P_center[1], p[2] - P_center[2]]);
    const Q_centered = Q_coords.map(q => [q[0] - Q_center[0], q[1] - Q_center[1], q[2] - Q_center[2]]);

    // Compute covariance matrix H = P^T * Q
    const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                H[j][k] += P_centered[i][j] * Q_centered[i][k];
            }
        }
    }

    // Simple approximation: use identity if we can't do proper SVD
    // In production, would use proper SVD library
    return new Matrix4(); // Return identity for now
}

// Main CShM calculation function (adapted for worker)
function calculateShapeMeasure(actualCoords, referenceCoords, mode, progressCallback, smartAlignments = []) {
    const N = actualCoords.length;
    if (N !== referenceCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new Matrix4() };
    }

    const params = {
        default: {
            gridSteps: 18,
            gridStride: 3,
            numRestarts: 6,
            stepsPerRun: 3000,
            refinementSteps: 2000,
        },
        intensive: {
            gridSteps: 24,          // Slightly more than default
            gridStride: 2,
            numRestarts: 10,        // More restarts for better exploration
            stepsPerRun: 6000,      // Longer annealing runs
            refinementSteps: 4000,
        }
    };
    const currentParams = params[mode] || params.default;

    try {
        // Normalize actual coordinates
        const P_vecs = actualCoords.map(c => new Vector3(...c));
        if (P_vecs.some(v => v.lengthSq() < 1e-8)) {
            console.warn("Found coordinating atom at the same position as the center.");
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new Matrix4() };
        }
        P_vecs.forEach(v => v.normalize());

        const Q_vecs = referenceCoords.map(c => new Vector3(...c));

        // Evaluation function
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
        let globalBestRotation = new Matrix4();
        let globalBestMatching = [];

        let totalSteps = 0;
        const estimatedTotalSteps = smartAlignments.length + 18 +
            Math.ceil(currentParams.gridSteps / currentParams.gridStride) ** 3 +
            currentParams.numRestarts * currentParams.stepsPerRun +
            currentParams.refinementSteps;

        const reportProgress = (stage, current, total, extra = '') => {
            if (progressCallback) {
                const percentage = Math.min(99, Math.round((totalSteps / estimatedTotalSteps) * 100));
                progressCallback({ stage, percentage, current, total, extra });
            }
        };

        // STAGE 0: Smart alignments (if provided)
        if (smartAlignments && smartAlignments.length > 0) {
            reportProgress('Smart Alignments', 0, smartAlignments.length);
            smartAlignments.forEach((alignment, idx) => {
                const R = new Matrix4();
                R.elements = alignment.elements;
                const result = getMeasureForRotation(R);
                if (result.measure < globalBestMeasure) {
                    globalBestMeasure = result.measure;
                    globalBestRotation.copy(R);
                    globalBestMatching = result.matching;
                }
                totalSteps++;
                if (idx % 5 === 0) reportProgress('Smart Alignments', idx, smartAlignments.length, `Best: ${globalBestMeasure.toFixed(4)}`);
            });
        }

        // STAGE 1: Key orientations
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
            const euler = new Euler(ax, ay, az, 'XYZ');
            const R = new Matrix4().makeRotationFromEuler(euler);
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

        // STAGE 2: Grid search
        reportProgress('Grid Search', 0, 100);
        const gridSteps = currentParams.gridSteps;
        const gridStride = currentParams.gridStride;
        const angleStep = (2 * Math.PI) / gridSteps;

        let gridCount = 0;
        const totalGridPoints = Math.ceil(gridSteps / gridStride) ** 3;

        for (let i = 0; i < gridSteps; i += gridStride) {
            for (let j = 0; j < gridSteps; j += gridStride) {
                for (let k = 0; k < gridSteps; k += gridStride) {
                    const euler = new Euler(i * angleStep, j * angleStep, k * angleStep, 'XYZ');
                    const R = new Matrix4().makeRotationFromEuler(euler);
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

        // STAGE 3: Simulated annealing
        const numRestarts = currentParams.numRestarts;
        const stepsPerRun = currentParams.stepsPerRun;

        for (let restart = 0; restart < numRestarts; restart++) {
            reportProgress('Annealing', restart, numRestarts, `Best: ${globalBestMeasure.toFixed(4)}`);

            let currentRotation;

            if (restart === 0) {
                currentRotation = globalBestRotation.clone();
            } else if (restart < numRestarts / 2) {
                const randomAxis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const randomAngle = (Math.random() - 0.5) * Math.PI;
                const perturbation = new Matrix4().makeRotationAxis(randomAxis, randomAngle);
                currentRotation = new Matrix4().multiplyMatrices(perturbation, globalBestRotation);
            } else {
                currentRotation = new Matrix4().makeRotationFromEuler(
                    new Euler(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, 'XYZ')
                );
            }

            let currentResult = getMeasureForRotation(currentRotation);
            let bestInRun = currentResult.measure;
            let bestRotationInRun = currentRotation.clone();
            let bestMatchingInRun = currentResult.matching;

            let temp = 20.0;
            const minTemp = 0.001;
            const alpha = Math.pow(minTemp / temp, 1 / stepsPerRun);

            for (let step = 0; step < stepsPerRun; step++) {
                const stepSize = temp * 0.12 * (1 + 0.2 * Math.random());
                const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const angle = (Math.random() - 0.5) * 2 * stepSize;

                const perturbation = new Matrix4().makeRotationAxis(axis, angle);
                const newRotation = new Matrix4().multiplyMatrices(perturbation, currentRotation);
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

                if (bestInRun < 0.001) break;
            }

            if (bestInRun < globalBestMeasure) {
                globalBestMeasure = bestInRun;
                globalBestRotation.copy(bestRotationInRun);
                globalBestMatching = bestMatchingInRun;
            }

            if (globalBestMeasure < 0.01) break;
        }

        // STAGE 4: Refinement
        reportProgress('Refinement', 0, 100);
        let currentRotation = globalBestRotation.clone();
        let currentMeasure = globalBestMeasure;
        let temp = 3.0;
        const refinementSteps = currentParams.refinementSteps;
        let noImprovementCount = 0;

        for (let step = 0; step < refinementSteps; step++) {
            const stepSize = temp * 0.02;
            const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            const angle = (Math.random() - 0.5) * 2 * stepSize;

            const perturbation = new Matrix4().makeRotationAxis(axis, angle);
            const newRotation = new Matrix4().multiplyMatrices(perturbation, currentRotation);
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

// Worker message handler
self.onmessage = function(e) {
    const { type, actualCoords, referenceCoords, mode, shapeName, smartAlignments } = e.data;

    if (type === 'terminate') {
        self.close();
        return;
    }

    if (type === 'calculate') {
        try {
            const progressCallback = (progressData) => {
                self.postMessage({
                    type: 'progress',
                    shapeName,
                    ...progressData
                });
            };

            const result = calculateShapeMeasure(
                actualCoords,
                referenceCoords,
                mode,
                progressCallback,
                smartAlignments
            );

            self.postMessage({
                type: 'result',
                shapeName,
                measure: result.measure,
                alignedCoords: result.alignedCoords,
                rotationMatrix: {
                    elements: result.rotationMatrix.elements
                }
            });

        } catch (error) {
            self.postMessage({
                type: 'error',
                shapeName,
                error: error.message
            });
        }
    }
};

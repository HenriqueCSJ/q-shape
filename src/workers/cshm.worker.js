/**
 * Handles intensive CShM optimization with progress reporting.
 *
 * TODO: This worker is currently disconnected from the main application flow (v1.4.0).
 * It was reverted due to memory issues but has been optimized.
 * Re-integrate in future versions for parallel processing.
 *
 * IMPORTANT: This worker contains inlined implementations of:
 * Runs shape measure calculations in a background thread.
 * Highly optimized for memory usage to prevent GC thrashing during annealing.
 *
 * Features:
 * - Object pooling for Vector3, Matrix4, and Arrays
 * - Zero-allocation loops for annealing and refinement
 * - Reusable buffers for Hungarian algorithm
 *
 * @version 1.4.1 (Optimized)
 */

// --- MATH CLASSES WITH POOLING SUPPORT ---

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    set(x, y, z) {
        this.x = x; this.y = y; this.z = z;
        return this;
    }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) {
        this.x = v.x; this.y = v.y; this.z = v.z;
        return this;
    }
    add(v) {
        this.x += v.x; this.y += v.y; this.z += v.z;
        return this;
    }
    sub(v) {
        this.x -= v.x; this.y -= v.y; this.z -= v.z;
        return this;
    }
    multiplyScalar(s) {
        this.x *= s; this.y *= s; this.z *= s;
        return this;
    }
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len > 0) this.multiplyScalar(1 / len);
        return this;
    }
    distanceToSquared(v) {
        const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }
    // Optimized: Apply matrix without creating new objects
    applyMatrix4(m) {
        const x = this.x, y = this.y, z = this.z;
        const e = m.elements;
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        return this;
    }
    toArray() { return [this.x, this.y, this.z]; }
}

class Matrix4 {
    constructor() {
        this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
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
        return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    }
    clone() {
        const m = new Matrix4();
        m.elements = [...this.elements];
        return m;
    }
    copy(m) {
        for (let i = 0; i < 16; i++) this.elements[i] = m.elements[i];
        return this;
    }
    multiplyMatrices(a, b) {
        const ae = a.elements, be = b.elements, te = this.elements;
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
        const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
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
        const x = euler.x, y = euler.y, z = euler.z;
        const a = Math.cos(x), b = Math.sin(x);
        const c = Math.cos(y), d = Math.sin(y);
        const e = Math.cos(z), f = Math.sin(z);
        const ae = a * e, af = a * f, be = b * e, bf = b * f;
        const te = this.elements;
        te[0] = c * e; te[4] = -c * f; te[8] = d;
        te[1] = af + be * d; te[5] = ae - bf * d; te[9] = -b * c;
        te[2] = bf - ae * d; te[6] = be + af * d; te[10] = a * c;
        te[3] = 0; te[7] = 0; te[11] = 0;
        te[12] = 0; te[13] = 0; te[14] = 0; te[15] = 1;
        return this;
    }
}

class Euler {
    constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

// --- HUNGARIAN ALGORITHM (OPTIMIZED W/ BUFFERS) ---

function hungarianAlgorithm(costMatrix, buffers) {
    const N = costMatrix.length;
    // Use recycled buffers from the pool
    const { u, v, p, way, minv, used } = buffers;

    // Reset buffers
    u.fill(0); v.fill(0); p.fill(0); way.fill(0);
    // minv and used are reset per iteration of i

    for (let i = 1; i <= N; i++) {
        p[0] = i;
        let j0 = 0;
        minv.fill(Infinity);
        used.fill(0); // 0 = false, 1 = true

        do {
            used[j0] = 1;
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

// --- SVD & MATH HELPERS ---

function jacobiSVD(A) {
    // SVD is not in the hot loop (only used for Kabsch), so modest allocation is fine.
    const TOLERANCE = 1e-10;
    const MAX_ITERATIONS = 100;
    const U = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const S = [[A[0][0], A[0][1], A[0][2]], [A[1][0], A[1][1], A[1][2]], [A[2][0], A[2][1], A[2][2]]];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let maxVal = 0, p = 0, q = 1;
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const val = Math.abs(S[i][j]);
                if (val > maxVal) { maxVal = val; p = i; q = j; }
            }
        }
        if (maxVal < TOLERANCE) break;

        const Spp = S[p][p], Sqq = S[q][q], Spq = S[p][q];
        let c, s;
        if (Math.abs(Spq) < TOLERANCE) { c = 1; s = 0; }
        else {
            const tau = (Sqq - Spp) / (2 * Spq);
            const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
            c = 1 / Math.sqrt(1 + t * t);
            s = c * t;
        }

        const Sp = [...S[p]], Sq = [...S[q]];
        for (let i = 0; i < 3; i++) {
            S[p][i] = c * Sp[i] - s * Sq[i];
            S[q][i] = s * Sp[i] + c * Sq[i];
        }
        for (let i = 0; i < 3; i++) {
            const Sip = S[i][p], Siq = S[i][q];
            S[i][p] = c * Sip - s * Siq;
            S[i][q] = s * Sip + c * Siq;
            const Uip = U[i][p], Uiq = U[i][q];
            U[i][p] = c * Uip - s * Uiq;
            U[i][q] = s * Uip + c * Uiq;
            const Vip = V[i][p], Viq = V[i][q];
            V[i][p] = c * Vip - s * Viq;
            V[i][q] = s * Vip + c * Viq;
        }
    }
    return { U, V };
}

function transpose3x3(M) {
    return [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
}
function multiplyMatrices3x3(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 3; k++) C[i][j] += A[i][k] * B[k][j];
    return C;
}
function determinant3x3(M) {
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}
function rotationToMatrix4(R) {
    return new Matrix4().set(
        R[0][0], R[0][1], R[0][2], 0,
        R[1][0], R[1][1], R[1][2], 0,
        R[2][0], R[2][1], R[2][2], 0,
        0, 0, 0, 1
    );
}

function kabschAlignment(P_coords, Q_coords) {
    try {
        const N = P_coords.length;
        if (N !== Q_coords.length || N === 0) return new Matrix4();
        const Pc = [0, 0, 0], Qc = [0, 0, 0];
        for (let i = 0; i < N; i++) {
            Pc[0] += P_coords[i][0]; Pc[1] += P_coords[i][1]; Pc[2] += P_coords[i][2];
            Qc[0] += Q_coords[i][0]; Qc[1] += Q_coords[i][1]; Qc[2] += Q_coords[i][2];
        }
        for (let i = 0; i < 3; i++) { Pc[i] /= N; Qc[i] /= N; }
        const P_cent = P_coords.map(p => [p[0] - Pc[0], p[1] - Pc[1], p[2] - Pc[2]]);
        const Q_cent = Q_coords.map(q => [q[0] - Qc[0], q[1] - Qc[1], q[2] - Qc[2]]);
        const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let i = 0; i < N; i++)
            for (let j = 0; j < 3; j++)
                for (let k = 0; k < 3; k++) H[j][k] += P_cent[i][j] * Q_cent[i][k];

        const { U, V } = jacobiSVD(H);
        const R = multiplyMatrices3x3(V, transpose3x3(U));
        const det = determinant3x3(R);
        if (det < 0) {
            V[0][2] *= -1; V[1][2] *= -1; V[2][2] *= -1;
            const R_corrected = multiplyMatrices3x3(V, transpose3x3(U));
            return rotationToMatrix4(R_corrected);
        }
        return rotationToMatrix4(R);
    } catch (e) { return new Matrix4(); }
}

// --- SCALE NORMALIZATION (CENTROID-BASED) ---

function scaleNormalize(vectors) {
    if (!vectors || vectors.length === 0) {
        return { normalized: [], scale: 1 };
    }
    const n = vectors.length;

    // Centroid-based normalization for all CNs (standard SHAPE/cosymlib approach)
    const centroid = new Vector3(0, 0, 0);
    for (const v of vectors) {
        centroid.add(v);
    }
    centroid.multiplyScalar(1 / n);

    const centered = vectors.map(v => v.clone().sub(centroid));

    let sumSq = 0;
    for (const v of centered) {
        sumSq += v.lengthSq();
    }
    const rms = Math.sqrt(sumSq / n);
    if (rms < 1e-10) {
        return { normalized: centered, scale: 1 };
    }
    const normalized = centered.map(v => v.clone().multiplyScalar(1 / rms));
    return { normalized, scale: rms };
}

// --- OPTIMIZED CSHM CALCULATION ---

function calculateShapeMeasure(actualCoords, referenceCoords, mode, progressCallback, smartAlignments = []) {
    let workingActualCoords = actualCoords;
    let workingRefCoords = referenceCoords;

    // CN=3 special handling: reference has 4 points (3 ligands + central atom)
    // Add central atom at origin to input if needed
    if (actualCoords.length === 3 && referenceCoords.length === 4) {
        workingActualCoords = [...actualCoords, [0, 0, 0]];
    }

    const N = workingActualCoords.length;
    if (N !== workingRefCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new Matrix4() };
    }

    // --- SETUP BUFFERS & POOLS ---
    // Zero-allocation hotspots: Pre-allocate everything needed for the loops

    // 1. Hungarian Buffers
    const hungarianBuffers = {
        u: new Float64Array(N + 1),
        v: new Float64Array(N + 1),
        p: new Int32Array(N + 1),
        way: new Int32Array(N + 1),
        minv: new Float64Array(N + 1),
        used: new Int8Array(N + 1)
    };

    // 2. Cost Matrix (NxN)
    const costMatrix = [];
    for (let i = 0; i < N; i++) costMatrix[i] = new Float64Array(N);

    // 3. Coordinate Buffers (N vectors)
    // P_vecs: Scale-normalized actual coordinates (centroid-based)
    const rawP = workingActualCoords.map(c => new Vector3(...c));
    const { normalized: P_vecs } = scaleNormalize(rawP);

    // Check for ligands at center (skip central atom for CN=3)
    const ligandsToCheck = (actualCoords.length === 3 && referenceCoords.length === 4)
        ? P_vecs.slice(0, -1)
        : P_vecs;
    if (ligandsToCheck.some(v => v.lengthSq() < 1e-8)) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new Matrix4() };
    }
    // Q_vecs: Immutable reference (already normalized)
    const Q_vecs = workingRefCoords.map(c => new Vector3(...c));
    // Rotated P: Reused buffer
    const rotatedP = Array(N).fill(null).map(() => new Vector3());

    // 4. Matrix/Vector Pools for Loops
    const tempMat1 = new Matrix4();
    const tempMat2 = new Matrix4();
    const tempVec = new Vector3();
    const tempEuler = new Euler();


    // --- EVALUATION FUNCTION (ZERO-ALLOCATION) ---
    const getMeasureForRotation = (rotationMatrix) => {
        // Rotate P_vecs into rotatedP buffer
        for (let i = 0; i < N; i++) {
            rotatedP[i].copy(P_vecs[i]).applyMatrix4(rotationMatrix);
        }

        // Fill cost matrix buffer
        for (let i = 0; i < N; i++) {
            const p = rotatedP[i]; // Accessing buffer directly
            const row = costMatrix[i];
            for (let j = 0; j < N; j++) {
                row[j] = p.distanceToSquared(Q_vecs[j]);
            }
        }

        // Run Hungarian with pre-allocated buffers
        const matching = hungarianAlgorithm(costMatrix, hungarianBuffers);
        let sumSqDiff = 0;
        for (let k = 0; k < matching.length; k++) {
            const [i, j] = matching[k];
            sumSqDiff += costMatrix[i][j];
        }

        return { measure: (sumSqDiff / N) * 100, matching };
    };

    // --- ALGORITHM PARAMETERS ---
    const params = {
        default: { gridSteps: 18, gridStride: 3, numRestarts: 6, stepsPerRun: 3000, refinementSteps: 2000, useKabsch: true },
        intensive: { gridSteps: 30, gridStride: 2, numRestarts: 12, stepsPerRun: 8000, refinementSteps: 6000, useKabsch: true }
    };
    const currentParams = params[mode] || params.default;

    // --- STATE ---
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

    // --- STAGE 0: SMART ALIGNMENTS / KABSCH ---
    if (smartAlignments.length > 0) {
        smartAlignments.forEach((ali, idx) => {
            tempMat1.elements = ali.elements;
            const res = getMeasureForRotation(tempMat1);
            if (res.measure < globalBestMeasure) {
                globalBestMeasure = res.measure;
                globalBestRotation.copy(tempMat1);
                globalBestMatching = res.matching;
            }
            totalSteps++;
        });
    } else if (currentParams.useKabsch) {
        // Run Kabsch (generates new Matrix, but only once so OK)
        const kabschR = kabschAlignment(actualCoords, referenceCoords);
        const res = getMeasureForRotation(kabschR);
        if (res.measure < globalBestMeasure) {
            globalBestMeasure = res.measure;
            globalBestRotation.copy(kabschR);
            globalBestMatching = res.matching;
        }
        totalSteps++;
    }

    // --- STAGE 1: KEY ORIENTATIONS ---
    const keyOrientations = [
        [0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0], [0, 0, Math.PI / 2], [Math.PI, 0, 0], [0, Math.PI, 0], [0, 0, Math.PI],
        [Math.PI / 2, Math.PI / 2, 0], [Math.PI / 2, 0, Math.PI / 2], [0, Math.PI / 2, Math.PI / 2],
        [Math.PI / 4, 0, 0], [0, Math.PI / 4, 0], [0, 0, Math.PI / 4], [Math.PI / 4, Math.PI / 4, 0], [Math.PI / 4, 0, Math.PI / 4], [0, Math.PI / 4, Math.PI / 4],
        [Math.PI / 4, Math.PI / 4, Math.PI / 4], [Math.PI / 3, Math.PI / 3, Math.PI / 3]
    ];

    reportProgress('Key Orientations', 0, 18);
    for (let i = 0; i < keyOrientations.length; i++) {
        const [x, y, z] = keyOrientations[i];
        tempEuler.set(x, y, z);
        tempMat1.makeRotationFromEuler(tempEuler);
        const res = getMeasureForRotation(tempMat1);
        if (res.measure < globalBestMeasure) {
            globalBestMeasure = res.measure;
            globalBestRotation.copy(tempMat1);
            globalBestMatching = res.matching;
        }
        totalSteps++;
    }
    if (globalBestMeasure < 0.01) return finish(P_vecs, globalBestRotation, globalBestMatching, globalBestMeasure, N);

    // --- STAGE 2: GRID SEARCH (OPTIMIZED) ---
    reportProgress('Grid Search', 0, 100);
    const { gridSteps, gridStride } = currentParams;
    const angleStep = (2 * Math.PI) / gridSteps;
    const totalGrid = Math.pow(Math.ceil(gridSteps / gridStride), 3);
    let gridCnt = 0;

    for (let i = 0; i < gridSteps; i += gridStride) {
        for (let j = 0; j < gridSteps; j += gridStride) {
            for (let k = 0; k < gridSteps; k += gridStride) {
                tempEuler.set(i * angleStep, j * angleStep, k * angleStep);
                tempMat1.makeRotationFromEuler(tempEuler);
                const res = getMeasureForRotation(tempMat1);
                if (res.measure < globalBestMeasure) {
                    globalBestMeasure = res.measure;
                    globalBestRotation.copy(tempMat1);
                    globalBestMatching = res.matching;
                }
                totalSteps++;
                gridCnt++;
                if (gridCnt % 100 === 0) reportProgress('Grid Search', gridCnt, totalGrid, `Best: ${globalBestMeasure.toFixed(4)}`);
            }
        }
    }
    if (globalBestMeasure < 0.05) return finish(P_vecs, globalBestRotation, globalBestMatching, globalBestMeasure, N);

    // --- STAGE 3: SIMULATED ANNEALING (ZERO-ALLOCATION LOOP) ---
    const { numRestarts, stepsPerRun } = currentParams;
    const currentRotation = new Matrix4(); // persistent across steps
    const bestRotInRun = new Matrix4();

    for (let restart = 0; restart < numRestarts; restart++) {
        reportProgress('Annealing', restart, numRestarts, `Best: ${globalBestMeasure.toFixed(4)}`);

        // Initialize currentRotation for this run
        if (restart === 0) {
            currentRotation.copy(globalBestRotation);
        } else if (restart < numRestarts / 2) {
            // Small perturbation
            tempVec.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            tempMat1.makeRotationAxis(tempVec, (Math.random() - 0.5) * Math.PI);
            currentRotation.multiplyMatrices(tempMat1, globalBestRotation);
        } else {
            // Random start
            tempEuler.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
            currentRotation.makeRotationFromEuler(tempEuler);
        }

        let res = getMeasureForRotation(currentRotation);
        let bestInRun = res.measure;
        let bestMatchInRun = res.matching; // matching is array of arrays, small allocation OK
        bestRotInRun.copy(currentRotation);

        let temp = (mode === 'intensive') ? 30.0 : 20.0;
        const alpha = Math.pow(0.001 / temp, 1 / stepsPerRun);

        for (let step = 0; step < stepsPerRun; step++) {
            // Generate perturbation
            const stepSize = temp * 0.12 * (1 + 0.2 * Math.random());
            tempVec.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

            // tempMat1 = perturbation
            tempMat1.makeRotationAxis(tempVec, (Math.random() - 0.5) * 2 * stepSize);

            // tempMat2 = newRotation = perturbation * current
            tempMat2.multiplyMatrices(tempMat1, currentRotation);

            const newRes = getMeasureForRotation(tempMat2);
            const deltaE = newRes.measure - res.measure;

            if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp)) {
                // Accept: copy newRotation to current
                currentRotation.copy(tempMat2);
                res = newRes;

                if (res.measure < bestInRun) {
                    bestInRun = res.measure;
                    bestRotInRun.copy(currentRotation);
                    bestMatchInRun = res.matching;
                }
            }
            temp *= alpha;
            totalSteps++;
        }

        if (bestInRun < globalBestMeasure) {
            globalBestMeasure = bestInRun;
            globalBestRotation.copy(bestRotInRun);
            globalBestMatching = bestMatchInRun;
        }
        if (globalBestMeasure < 0.01) break;
    }

    // --- STAGE 4: REFINEMENT ---
    reportProgress('Refinement', 0, 100);
    const { refinementSteps } = currentParams;
    let temp = 3.0;
    currentRotation.copy(globalBestRotation);
    let currentMeasure = globalBestMeasure;
    let noImprovement = 0;

    for (let step = 0; step < refinementSteps; step++) {
        const stepSize = temp * 0.02;
        tempVec.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        tempMat1.makeRotationAxis(tempVec, (Math.random() - 0.5) * 2 * stepSize);
        tempMat2.multiplyMatrices(tempMat1, currentRotation);

        const newRes = getMeasureForRotation(tempMat2);
        if (newRes.measure < currentMeasure) {
            currentMeasure = newRes.measure;
            currentRotation.copy(tempMat2);
            noImprovement = 0;
            if (currentMeasure < globalBestMeasure) {
                globalBestMeasure = currentMeasure;
                globalBestRotation.copy(tempMat2);
                globalBestMatching = newRes.matching;
            }
        } else {
            noImprovement++;
        }
        temp *= 0.999;
        totalSteps++;
        if (step % 500 === 0) reportProgress('Refinement', step, refinementSteps, `Best: ${globalBestMeasure.toFixed(4)}`);
        if (noImprovement > 500 && globalBestMeasure < 0.01) break;
    }

    return finish(P_vecs, globalBestRotation, globalBestMatching, globalBestMeasure, N);
}

function finish(P_vecs, rotation, matching, measure, N) {
    const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rotation));
    const finalCoords = new Array(N);
    for (const [p, q] of matching) finalCoords[q] = rotatedP[p].toArray();
    return { measure, alignedCoords: finalCoords.filter(Boolean), rotationMatrix: rotation };
}

// --- WORKER HANDLER ---

self.onmessage = function (e) {
    const { type, actualCoords, referenceCoords, mode, shapeName, smartAlignments } = e.data;
    if (type === 'terminate') { self.close(); return; }
    if (type === 'calculate') {
        try {
            const res = calculateShapeMeasure(
                actualCoords, referenceCoords, mode,
                (p) => self.postMessage({ type: 'progress', shapeName, ...p }),
                smartAlignments
            );
            self.postMessage({
                type: 'result', shapeName, measure: res.measure,
                alignedCoords: res.alignedCoords,
                rotationMatrix: { elements: res.rotationMatrix.elements }
            });
        } catch (err) {
            self.postMessage({ type: 'error', shapeName, error: err.message });
        }
    }
};

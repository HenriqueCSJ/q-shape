import * as THREE from 'three';
import kabschAlignment from '../algorithms/kabsch.js';
import hungarianAlgorithm from '../algorithms/hungarian.js';
import { SHAPE_MEASURE, KABSCH, PROGRESS } from '../../constants/algorithmConstants.js';

/**
 * Generate all permutations of an array (Heap's algorithm)
 * @param {number[]} arr - Array of indices to permute
 * @returns {Generator<number[]>} Generator yielding each permutation
 */
function* permutations(arr) {
    const n = arr.length;
    const c = new Array(n).fill(0);

    yield [...arr];

    let i = 0;
    while (i < n) {
        if (c[i] < i) {
            if (i % 2 === 0) {
                [arr[0], arr[i]] = [arr[i], arr[0]];
            } else {
                [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]];
            }
            yield [...arr];
            c[i]++;
            i = 0;
        } else {
            c[i] = 0;
            i++;
        }
    }
}

/**
 * Compute CShM using exhaustive permutation search (exact algorithm)
 *
 * For each permutation of ligand atoms:
 * 1. Apply Kabsch alignment to find optimal rotation
 * 2. Compute CShM using the overlap formula
 * 3. Track the minimum
 *
 * Central atom (last in array) is always mapped to central atom - not permuted.
 *
 * @param {THREE.Vector3[]} P_vecs - Normalized actual coordinates
 * @param {THREE.Vector3[]} Q_vecs - Normalized reference coordinates
 * @returns {Object} { measure, matching, rotation }
 */
function exhaustivePermutationSearch(P_vecs, Q_vecs) {
    const N = P_vecs.length;
    const numLigands = N - 1;

    let bestMeasure = Infinity;
    let bestMatching = null;
    let bestRotation = new THREE.Matrix4();

    // Helper function to compute overlap for a given rotation and matching
    const computeOverlap = (rotation, matching) => {
        let overlap = 0;
        for (const [p_idx, q_idx] of matching) {
            const rotatedP = P_vecs[p_idx].clone().applyMatrix4(rotation);
            overlap += rotatedP.dot(Q_vecs[q_idx]);
        }
        return overlap;
    };

    // Generate all permutations of reference vertices for each ligand
    // For each permutation, actual ligand i maps to reference vertex perm[i]
    const ligandIndices = Array.from({ length: numLigands }, (_, i) => i);

    for (const perm of permutations([...ligandIndices])) {
        // Build matching: actual ligand i → reference vertex perm[i]
        // Central atom (index N-1) always maps to itself
        const matching = [];
        for (let i = 0; i < numLigands; i++) {
            matching.push([i, perm[i]]);  // actual i → reference perm[i]
        }
        matching.push([N - 1, N - 1]);  // Central atom

        // Prepare ordered arrays for Kabsch: P_ordered[i] should match Q_ordered[i]
        const P_ordered = [];
        const Q_ordered = [];
        for (const [p_idx, q_idx] of matching) {
            P_ordered.push(P_vecs[p_idx].toArray());
            Q_ordered.push(Q_vecs[q_idx].toArray());
        }

        // Get initial rotation via Kabsch
        // Both P and Q are centroid-normalized, so skip recentering to avoid numerical drift
        const rotation = kabschAlignment(P_ordered, Q_ordered, true);

        // Compute CShM with this rotation and matching
        // Use SHAPE/cosymlib formula: CShM = 100 * (1 - (overlap/N)²)
        // where overlap = sum_i (Rp_i · q_i)
        const overlap = computeOverlap(rotation, matching);

        // SHAPE formula: CShM = 100 * (1 - (overlap/N)²)
        // Clamp overlapNorm to [-1, 1] to prevent floating-point errors from causing negative CShM
        const overlapNorm = Math.max(-1, Math.min(1, overlap / N));
        const measure = Math.max(0, 100 * (1 - overlapNorm * overlapNorm));

        if (measure < bestMeasure) {
            bestMeasure = measure;
            bestMatching = matching;
            bestRotation = rotation;
        }
    }

    return { measure: bestMeasure, matching: bestMatching, rotation: bestRotation };
}

/**
 * Scale-normalizes coordinates using centroid-based strategy.
 *
 * This is the standard normalization used by SHAPE/cosymlib/cshm-cc:
 * 1. Center coordinates on their centroid
 * 2. Scale to unit RMS distance from centroid
 *
 * For CN=3, the input should include the central atom (4 points total).
 * This preserves pyramidal character that would be lost with ligand-only centering.
 *
 * @param {THREE.Vector3[]} vectors - Array of Vector3 coordinates
 * @param {boolean} centerOnLast - If true, center on last point (central atom) instead of centroid
 * @returns {object} { normalized: THREE.Vector3[], scale: number, center: THREE.Vector3 }
 */
function scaleNormalize(vectors, centerOnLast = false) {
    if (!vectors || vectors.length === 0) {
        return { normalized: [], scale: 1, center: new THREE.Vector3() };
    }

    const n = vectors.length;

    // Determine center point
    let center;
    if (centerOnLast) {
        // Center on last point (central atom) - keeps metal at origin
        center = vectors[n - 1].clone();
    } else {
        // Centroid-based normalization
        center = new THREE.Vector3(0, 0, 0);
        for (const v of vectors) {
            center.add(v);
        }
        center.divideScalar(n);
    }

    const centered = vectors.map(v => v.clone().sub(center));

    let sumSq = 0;
    for (const v of centered) {
        sumSq += v.lengthSq();
    }
    const rms = Math.sqrt(sumSq / n);

    if (rms < 1e-10) {
        return { normalized: centered, scale: 1, center };
    }

    const normalized = centered.map(v => v.clone().divideScalar(rms));
    return { normalized, scale: rms, center };
}

/**
 * Build a proper rotation that maps the oriented frame defined by p1/p2 onto
 * the frame defined by q1/q2. Two non-collinear vectors determine a rotation;
 * enumerating candidate reference pairs therefore supplies exact seeds for a
 * rigidly rotated ideal polyhedron without relying on random sampling.
 */
function rotationFromVectorPairs(p1, p2, q1, q2) {
    const buildBasis = (first, second) => {
        const x = first.clone().normalize();
        const z = new THREE.Vector3().crossVectors(x, second);
        if (z.lengthSq() < KABSCH.MIN_VECTOR_LENGTH_SQ) return null;
        z.normalize();
        const y = new THREE.Vector3().crossVectors(z, x).normalize();
        return new THREE.Matrix4().makeBasis(x, y, z);
    };

    const pBasis = buildBasis(p1, p2);
    const qBasis = buildBasis(q1, q2);
    if (!pBasis || !qBasis) return null;

    return new THREE.Matrix4().multiplyMatrices(qBasis, pBasis.clone().transpose());
}

/**
 * Select a small deterministic set of well-conditioned ligand pairs. Pairs
 * with the largest cross products define the most stable local frames.
 */
function selectAnchorPairs(vectors, count, maxPairs = 6) {
    const pairs = [];
    for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
            const conditioning = new THREE.Vector3()
                .crossVectors(vectors[i], vectors[j])
                .lengthSq();
            if (conditioning >= KABSCH.MIN_VECTOR_LENGTH_SQ) {
                pairs.push({ i, j, conditioning });
            }
        }
    }

    pairs.sort((a, b) =>
        b.conditioning - a.conditioning || a.i - b.i || a.j - b.j
    );
    return pairs.slice(0, maxPairs);
}

/**
 * Canonicalize ligand order using only rotation-, translation-, scale-, and
 * permutation-invariant distances. Optimizer tie-breaking and anchor selection
 * must not depend on the atom order in an XYZ file.
 */
function canonicalizeLigandOrder(vectors, ligandCount) {
    const center = vectors[vectors.length - 1];
    const quantize = value => Math.round(value * 1e10);
    const decorated = vectors.slice(0, ligandCount).map((vector, index) => {
        const ligandDistances = vectors.slice(0, ligandCount)
            .filter((_, otherIndex) => otherIndex !== index)
            .map(other => quantize(vector.distanceToSquared(other)))
            .sort((a, b) => a - b);
        return {
            vector,
            index,
            signature: [
                quantize(vector.distanceToSquared(center)),
                ...ligandDistances
            ]
        };
    });

    decorated.sort((a, b) => {
        for (let i = 0; i < a.signature.length; i++) {
            if (a.signature[i] !== b.signature[i]) {
                return a.signature[i] - b.signature[i];
            }
        }
        // Exact symmetry can leave indistinguishable vertices. Their order is
        // immaterial to the physical point set; retain input order as a stable
        // final tie-breaker.
        return a.index - b.index;
    });

    return [...decorated.map(item => item.vector), center];
}

/**
 * Create a repeatable pseudo-random sequence from rotation- and
 * permutation-invariant pair-distance signatures. Annealing remains useful
 * for distorted structures, but identical inputs now produce identical CShM
 * values across runs and ligand orderings.
 */
function createDeterministicRandom(P_vecs, Q_vecs, mode, explicitSeed = null) {
    let hash = Number.isInteger(explicitSeed) ? explicitSeed >>> 0 : 2166136261;
    const updateHash = value => {
        hash ^= value;
        hash = Math.imul(hash, 16777619);
    };
    const addDistanceSignature = vectors => {
        const distances = [];
        for (let i = 0; i < vectors.length; i++) {
            for (let j = i + 1; j < vectors.length; j++) {
                distances.push(vectors[i].distanceToSquared(vectors[j]));
            }
        }
        distances.sort((a, b) => a - b);
        for (const distance of distances) {
            updateHash(Math.round(distance * 1e9));
        }
    };

    if (!Number.isInteger(explicitSeed)) {
        addDistanceSignature(P_vecs);
        addDistanceSignature(Q_vecs);
        updateHash(mode === 'intensive' ? 1 : 0);
    }

    let state = hash >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Calculates the shape measure between actual and reference coordinates using
 * a multi-stage optimization approach.
 *
 * This function implements the Continuous Shape Measure (CShM) algorithm, which:
 * 1. Normalizes coordinates to unit sphere
 * 2. Uses Kabsch algorithm for initial alignment
 * 3. Tests key orientations for coarse search
 * 4. Performs grid search over rotation space
 * 5. Applies simulated annealing for global optimization
 * 6. Refines the solution with local optimization
 *
 * The algorithm finds the optimal rotation and atom-to-vertex matching that
 * minimizes the root mean square deviation between the actual and reference
 * geometries.
 *
 * @param {Array<Array<number>>} actualCoords - Center-relative ligand [x, y, z]
 *   coordinates. Omit the central atom; it is added when the reference contains
 *   one more point than the actual structure.
 * @param {Array<Array<number>>} referenceCoords - Reference ligand vertices
 *   followed by the reference center
 * @param {string} [mode='default'] - Optimization mode: 'default' or 'intensive'
 *   - 'default': Faster computation with good accuracy (18 grid steps, 7 restarts, 3000 steps/run)
 *   - 'intensive': More thorough search with higher accuracy (30 grid steps, 12 restarts, 8000 steps/run)
 * @param {Function} [progressCallback=null] - Optional callback to report progress
 *   Called with: { stage, percentage, current, total, extra }
 *   - stage: Current optimization stage name
 *   - percentage: Overall progress (0-100)
 *   - current: Current step in stage
 *   - total: Total steps in stage
 *   - extra: Additional info (e.g., current best measure)
 * @param {object} [options={}] - Reproducibility options
 * @param {number} [options.seed] - Optional explicit 32-bit PRNG seed
 * @param {Function} [options.rng] - Optional injected random-number generator
 *
 * @returns {Object} Result object containing:
 *   - measure {number}: The shape measure (0 = perfect match, higher = worse)
 *   - alignedCoords {Array<Array<number>>}: Aligned coordinates in reference order
 *   - rotationMatrix {THREE.Matrix4}: The optimal rotation matrix found
 *
 * @throws {Error} If calculation fails due to invalid input or algorithm error
 *
 * @example
 * const result = calculateShapeMeasure(
 *   [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
 *   [[0.9, 0.1, 0], [0, 0.95, 0.05], [0.05, 0, 0.95]],
 *   'default',
 *   ({ stage, percentage }) => console.log(`${stage}: ${percentage}%`)
 * );
 * console.log(`Shape measure: ${result.measure}`);
 */
function calculateShapeMeasure(actualCoords, referenceCoords, mode = 'default', progressCallback = null, options = {}) {
    let workingActualCoords = actualCoords;
    let workingRefCoords = referenceCoords;

    // SHAPE/cosymlib include central atom in CShM calculations
    // Reference geometries have N+1 points (N ligands + 1 central atom)
    // Add central atom at origin to input coordinates when needed
    // This applies to ALL coordination numbers (CN=3 through CN=12)
    const needsCentralAtom = (referenceCoords.length === actualCoords.length + 1);
    if (needsCentralAtom) {
        workingActualCoords = [...actualCoords, [0, 0, 0]];
    }

    const N = workingActualCoords.length;
    if (N !== workingRefCoords.length || N === 0) {
        return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
    }

    // Load parameters from constants (documented with scientific justification)
    const currentParams = mode === 'intensive'
        ? SHAPE_MEASURE.INTENSIVE
        : SHAPE_MEASURE.DEFAULT;

    try {
        // Convert actual coordinates to Vector3
        const P_vecs_raw = workingActualCoords.map(c => new THREE.Vector3(...c));

        // Check for ligand atoms at center (would cause normalization issues)
        // Skip the last atom if we added a central atom
        const ligandsToCheck = needsCentralAtom
            ? P_vecs_raw.slice(0, -1)
            : P_vecs_raw;
        const ligandLengthSquares = ligandsToCheck.map(v => v.lengthSq());
        if (ligandLengthSquares.some(lengthSq => !Number.isFinite(lengthSq))) {
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
        }
        const maxLigandLengthSq = Math.max(...ligandLengthSquares);
        const hasDegenerateLigand = maxLigandLengthSq === 0 || ligandLengthSquares.some(
            lengthSq => lengthSq <= maxLigandLengthSq * KABSCH.MIN_VECTOR_LENGTH_SQ
        );
        if (hasDegenerateLigand) {
            console.warn("Found coordinating atom at the same position as the center.");
            return { measure: Infinity, alignedCoords: [], rotationMatrix: new THREE.Matrix4() };
        }

        // Use centroid-based scale normalization (standard for SHAPE/cosymlib)
        // Both P and Q are normalized the same way for consistency
        const { normalized: normalizedP } = scaleNormalize(P_vecs_raw, false);
        const P_vecs = needsCentralAtom
            ? canonicalizeLigandOrder(normalizedP, N - 1)
            : normalizedP;

        // Apply same centroid-based normalization to reference coordinates
        const Q_vecs_raw = workingRefCoords.map(c => new THREE.Vector3(...c));
        const { normalized: Q_vecs } = scaleNormalize(Q_vecs_raw, false);
        const random = typeof options.rng === 'function'
            ? options.rng
            : createDeterministicRandom(P_vecs, Q_vecs, mode, options.seed);

        // For low CN (2-4), some reference geometries from cosymlib have central atom
        // positions that are NOT at the origin (e.g., vT-2, vOC-2, SS-4). When we add
        // the actual central at origin, the positions don't match after centroid normalization.
        // The optimization approach with Hungarian algorithm can find better matchings
        // for these asymmetric geometries.
        //
        // For CN=5-7, use exhaustive permutation search for exact CShM.
        // For larger CNs (>7), fall back to optimization-based approach.
        const MIN_EXHAUSTIVE_N = 6; // CN=5+ (skip CN=2-4 which have asymmetric central atoms)
        const MAX_EXHAUSTIVE_N = 8; // 7! = 5040 permutations - manageable
        if (N >= MIN_EXHAUSTIVE_N && N <= MAX_EXHAUSTIVE_N && needsCentralAtom) {
            const result = exhaustivePermutationSearch(P_vecs, Q_vecs);
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(result.rotation));
            const finalAlignedCoords = new Array(N);
            for (const [p_idx, q_idx] of result.matching) {
                finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
            }
            return {
                measure: result.measure,
                alignedCoords: finalAlignedCoords.filter(Boolean),
                rotationMatrix: result.rotation
            };
        }

        // Cached evaluation function
        const getMeasureForRotation = (rotationMatrix) => {
            const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(rotationMatrix));

            // SHAPE fixes the central atom correspondence. Optimize only the
            // ligand-to-vertex assignment when a center is present.
            const assignableCount = needsCentralAtom ? N - 1 : N;

            // Build cost matrix for Hungarian algorithm
            // Use negative dot product as cost (minimize cost = maximize overlap)
            const costMatrix = [];
            for (let i = 0; i < assignableCount; i++) {
                costMatrix[i] = [];
                for (let j = 0; j < assignableCount; j++) {
                    // Use negative dot product for minimization
                    costMatrix[i][j] = -rotatedP[i].dot(Q_vecs[j]);
                }
            }

            const matching = hungarianAlgorithm(costMatrix);
            if (needsCentralAtom) {
                matching.push([N - 1, N - 1]);
            }

            // Compute overlap (sum of dot products) for the matching
            const overlap = matching.reduce((sum, [i, j]) => sum + rotatedP[i].dot(Q_vecs[j]), 0);

            // SHAPE formula: CShM = 100 * (1 - (overlap/N)²)
            // Clamp overlapNorm to [-1, 1] to prevent floating-point errors from causing negative CShM
            const overlapNorm = Math.max(-1, Math.min(1, overlap / N));
            const measure = Math.max(0, 100 * (1 - overlapNorm * overlapNorm));

            return { measure, matching };
        };

        /**
         * Alternate the optimal assignment for a rotation with the optimal
         * proper rotation for that fixed assignment. This deterministic local
         * polish terminates on a stable/cycling assignment or negligible gain.
         */
        const polishAssignmentRotation = (initialRotation) => {
            let rotation = initialRotation.clone();
            let bestResult = getMeasureForRotation(rotation);
            let bestRotation = rotation.clone();
            let steps = 0;
            const seenMatchings = new Set();

            for (
                let iteration = 0;
                iteration < SHAPE_MEASURE.ANCHOR_SEARCH.MAX_ASSIGNMENT_ITERATIONS;
                iteration++
            ) {
                const current = getMeasureForRotation(rotation);
                const matchingKey = current.matching
                    .map(([pIndex, qIndex]) => `${pIndex}:${qIndex}`)
                    .join(',');
                if (seenMatchings.has(matchingKey)) break;
                seenMatchings.add(matchingKey);

                const P_ordered = current.matching.map(([pIndex]) =>
                    P_vecs[pIndex].toArray()
                );
                const Q_ordered = current.matching.map(([, qIndex]) =>
                    Q_vecs[qIndex].toArray()
                );
                const polishedRotation = kabschAlignment(P_ordered, Q_ordered, true);
                const polished = getMeasureForRotation(polishedRotation);
                steps++;

                if (polished.measure < bestResult.measure) {
                    bestResult = polished;
                    bestRotation = polishedRotation.clone();
                }

                const improvement = current.measure - polished.measure;
                if (
                    polished.measure > current.measure +
                        SHAPE_MEASURE.ANCHOR_SEARCH.IMPROVEMENT_TOLERANCE ||
                    improvement <= SHAPE_MEASURE.ANCHOR_SEARCH.IMPROVEMENT_TOLERANCE
                ) {
                    break;
                }
                rotation = polishedRotation;
            }

            return {
                measure: bestResult.measure,
                matching: bestResult.matching,
                rotation: bestRotation,
                steps
            };
        };

        let globalBestMeasure = Infinity;
        let globalBestRotation = new THREE.Matrix4();
        let globalBestMatching = [];

        const numLigands = needsCentralAtom ? N - 1 : N;
        // The pair-frame enumeration is bounded to the SHAPE-supported
        // coordination range. For fullerene-scale references, m(m-1)
        // assignments would dominate runtime and the legacy path is retained.
        const usePairFrameSearch = needsCentralAtom &&
            N > MAX_EXHAUSTIVE_N &&
            numLigands <= 12;
        const anchorPairs = usePairFrameSearch
            ? selectAnchorPairs(
                P_vecs,
                numLigands,
                SHAPE_MEASURE.ANCHOR_SEARCH.MAX_ACTUAL_PAIRS
            )
            : [];
        const pairFrameCandidates = anchorPairs.length * numLigands * Math.max(0, numLigands - 1);
        const pairFrameCandidateGroups = anchorPairs.length > 1 ? 2 : 1;
        const maxPairFramePolishSteps = pairFrameCandidates > 0
            ? pairFrameCandidateGroups * SHAPE_MEASURE.ANCHOR_SEARCH.TOP_CANDIDATES *
                SHAPE_MEASURE.ANCHOR_SEARCH.MAX_ASSIGNMENT_ITERATIONS
            : 0;

        // Additional anchor pairs broaden deterministic basin coverage, but
        // their result is held aside until the historical single-anchor
        // optimization has completed. This makes the expansion monotonic: it
        // can improve the returned CShM without replacing or perturbing any
        // trajectory that previously established permutation invariance.
        let supplementalBestMeasure = Infinity;
        let supplementalBestRotation = new THREE.Matrix4();
        let supplementalBestMatching = [];
        const acceptSupplementalBest = () => {
            if (supplementalBestMeasure < globalBestMeasure) {
                globalBestMeasure = supplementalBestMeasure;
                globalBestRotation.copy(supplementalBestRotation);
                globalBestMatching = supplementalBestMatching;
            }
        };

        let totalSteps = 0;
        const estimatedTotalSteps = (currentParams.USE_KABSCH ? 1 : 0) +
            pairFrameCandidates +
            maxPairFramePolishSteps +
            SHAPE_MEASURE.ANCHOR_SEARCH.MAX_ASSIGNMENT_ITERATIONS +
            SHAPE_MEASURE.NUM_KEY_ORIENTATIONS +
            Math.ceil(currentParams.GRID_STEPS / currentParams.GRID_STRIDE) ** 3 +
            currentParams.NUM_RESTARTS * currentParams.STEPS_PER_RUN +
            currentParams.REFINEMENT_STEPS;

        const reportProgress = (stage, current, total, extra = '') => {
            if (progressCallback) {
                const percentage = stage === 'Complete'
                    ? 100
                    : Math.min(99, Math.round((totalSteps / estimatedTotalSteps) * 100));
                progressCallback({ stage, percentage, current, total, extra });
            }
        };

        // STAGE 0: Kabsch Initial Alignment (IMPROVED)
        if (currentParams.USE_KABSCH) {
            reportProgress('Kabsch Alignment', 0, 1);
            try {
                const initialAssignableCount = needsCentralAtom ? N - 1 : N;
                const initialCostMatrix = P_vecs.slice(0, initialAssignableCount).map(p =>
                    Q_vecs.slice(0, initialAssignableCount).map(q => p.distanceToSquared(q))
                );
                const initialMatching = hungarianAlgorithm(initialCostMatrix);
                if (needsCentralAtom) {
                    initialMatching.push([N - 1, N - 1]);
                }

                const P_ordered = initialMatching.map(([p_idx]) => P_vecs[p_idx].toArray());
                const Q_ordered = initialMatching.map(([, q_idx]) => Q_vecs[q_idx].toArray());

                const kabschRotation = kabschAlignment(P_ordered, Q_ordered, true);
                const kabschResult = getMeasureForRotation(kabschRotation);

                if (isFinite(kabschResult.measure)) {
                    globalBestMeasure = kabschResult.measure;
                    globalBestRotation.copy(kabschRotation);
                    globalBestMatching = kabschResult.matching;
                }
                totalSteps++;
                reportProgress('Kabsch Alignment', 1, 1, `Initial Best: ${globalBestMeasure.toFixed(4)}`);
            } catch (error) {
                console.warn("Kabsch alignment failed, proceeding without it:", error);
            }
        }

        // STAGE 1: deterministic pair-frame seeds for high coordination
        // numbers. This closes narrow rotational basins that a coarse Euler
        // grid or a finite stochastic annealing run can miss.
        if (pairFrameCandidates > 0) {
            let pairFrameCount = 0;
            const topCandidates = [];
            const supplementalCandidates = [];
            const retainCandidate = (candidates, candidate) => {
                const duplicateIndex = candidates.findIndex(
                    current => current.matchingKey === candidate.matchingKey
                );
                if (duplicateIndex < 0) {
                    candidates.push(candidate);
                } else if (candidate.measure < candidates[duplicateIndex].measure) {
                    candidates[duplicateIndex] = candidate;
                }
                candidates.sort((a, b) => a.measure - b.measure);
                if (candidates.length > SHAPE_MEASURE.ANCHOR_SEARCH.TOP_CANDIDATES) {
                    candidates.pop();
                }
            };
            reportProgress('Pair-frame Search', 0, pairFrameCandidates);
            for (let anchorIndex = 0; anchorIndex < anchorPairs.length; anchorIndex++) {
                const { i, j } = anchorPairs[anchorIndex];
                const isSupplemental = anchorIndex > 0;
                for (let q1 = 0; q1 < numLigands; q1++) {
                    for (let q2 = 0; q2 < numLigands; q2++) {
                        if (q1 === q2) continue;
                        const rotation = rotationFromVectorPairs(
                            P_vecs[i], P_vecs[j], Q_vecs[q1], Q_vecs[q2]
                        );
                        if (rotation) {
                            const result = getMeasureForRotation(rotation);
                            const matchingKey = result.matching
                                .map(([pIndex, qIndex]) => `${pIndex}:${qIndex}`)
                                .join(',');
                            const pairFrameCandidate = {
                                measure: result.measure,
                                rotation: rotation.clone(),
                                matchingKey
                            };
                            retainCandidate(
                                isSupplemental ? supplementalCandidates : topCandidates,
                                pairFrameCandidate
                            );
                            if (!isSupplemental && result.measure < globalBestMeasure) {
                                globalBestMeasure = result.measure;
                                globalBestRotation.copy(rotation);
                                globalBestMatching = result.matching;
                            } else if (isSupplemental && result.measure < supplementalBestMeasure) {
                                supplementalBestMeasure = result.measure;
                                supplementalBestRotation.copy(rotation);
                                supplementalBestMatching = result.matching;
                            }
                        }
                        pairFrameCount++;
                        totalSteps++;
                    }
                }
            }
            reportProgress(
                'Pair-frame Search',
                pairFrameCount,
                pairFrameCandidates,
                `Best: ${globalBestMeasure.toFixed(4)}`
            );

            // Alternate optimal assignment (Hungarian) and optimal proper
            // rotation for that assignment (Kabsch). Retaining several pair-
            // frame seeds protects distorted structures from a single local
            // assignment basin while keeping this stage bounded and repeatable.
            let polishCount = 0;
            reportProgress('Assignment/rotation Polish', 0, maxPairFramePolishSteps);
            for (const candidate of topCandidates) {
                const polished = polishAssignmentRotation(candidate.rotation);
                if (polished.measure < globalBestMeasure) {
                    globalBestMeasure = polished.measure;
                    globalBestRotation.copy(polished.rotation);
                    globalBestMatching = polished.matching;
                }
                polishCount += polished.steps;
                totalSteps += polished.steps;
            }
            for (const candidate of supplementalCandidates) {
                const polished = polishAssignmentRotation(candidate.rotation);
                if (polished.measure < supplementalBestMeasure) {
                    supplementalBestMeasure = polished.measure;
                    supplementalBestRotation.copy(polished.rotation);
                    supplementalBestMatching = polished.matching;
                }
                polishCount += polished.steps;
                totalSteps += polished.steps;
            }
            reportProgress(
                'Assignment/rotation Polish',
                polishCount,
                maxPairFramePolishSteps,
                `Best: ${globalBestMeasure.toFixed(4)}`
            );

            if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_KEY_ORIENTATIONS) {
                acceptSupplementalBest();
                const rotatedP = P_vecs.map(p => p.clone().applyMatrix4(globalBestRotation));
                const finalAlignedCoords = new Array(N);
                for (const [p_idx, q_idx] of globalBestMatching) {
                    finalAlignedCoords[q_idx] = rotatedP[p_idx].toArray();
                }
                reportProgress('Complete', 100, 100, `Final: ${globalBestMeasure.toFixed(4)}`);
                return {
                    measure: globalBestMeasure,
                    alignedCoords: finalAlignedCoords.filter(Boolean),
                    rotationMatrix: globalBestRotation
                };
            }
        }

        // STAGE 2: Key orientations test
        const numKeyOrientations = SHAPE_MEASURE.NUM_KEY_ORIENTATIONS;
        reportProgress('Key Orientations', 0, numKeyOrientations);
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
            const euler = new THREE.Euler(ax, ay, az, 'XYZ');
            const R = new THREE.Matrix4().makeRotationFromEuler(euler);
            const result = getMeasureForRotation(R);
            if (result.measure < globalBestMeasure) {
                globalBestMeasure = result.measure;
                globalBestRotation.copy(R);
                globalBestMatching = result.matching;
            }
            totalSteps++;
            if (idx % PROGRESS.KEY_ORIENTATIONS_UPDATE_FREQUENCY === 0) {
                reportProgress('Key Orientations', idx, numKeyOrientations, `Best: ${globalBestMeasure.toFixed(4)}`);
            }
        });

        // Early termination if already excellent
        if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_KEY_ORIENTATIONS) {
            acceptSupplementalBest();
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

        // STAGE 3: Grid search (optimized)
        reportProgress('Grid Search', 0, 100);
        const gridSteps = currentParams.GRID_STEPS;
        const gridStride = currentParams.GRID_STRIDE;
        const angleStep = (2 * Math.PI) / gridSteps;

        let gridCount = 0;
        const totalGridPoints = Math.ceil(gridSteps / gridStride) ** 3;

        for (let i = 0; i < gridSteps; i += gridStride) {
            for (let j = 0; j < gridSteps; j += gridStride) {
                for (let k = 0; k < gridSteps; k += gridStride) {
                    const euler = new THREE.Euler(i * angleStep, j * angleStep, k * angleStep, 'XYZ');
                    const R = new THREE.Matrix4().makeRotationFromEuler(euler);
                    const result = getMeasureForRotation(R);
                    if (result.measure < globalBestMeasure) {
                        globalBestMeasure = result.measure;
                        globalBestRotation.copy(R);
                        globalBestMatching = result.matching;
                    }
                    totalSteps++;
                    gridCount++;
                    if (gridCount % PROGRESS.GRID_UPDATE_FREQUENCY === 0) {
                        reportProgress('Grid Search', gridCount, totalGridPoints, `Best: ${globalBestMeasure.toFixed(4)}`);
                    }
                }
            }
        }

        // The grid often locates the correct assignment basin even when its
        // sampled Euler rotation is coarse. Solve that basin exactly before
        // annealing instead of relying on random perturbations to rediscover it.
        const gridPolished = polishAssignmentRotation(globalBestRotation);
        if (gridPolished.measure < globalBestMeasure) {
            globalBestMeasure = gridPolished.measure;
            globalBestRotation.copy(gridPolished.rotation);
            globalBestMatching = gridPolished.matching;
        }
        totalSteps += gridPolished.steps;
        reportProgress(
            'Post-grid Assignment/rotation Polish',
            gridPolished.steps,
            SHAPE_MEASURE.ANCHOR_SEARCH.MAX_ASSIGNMENT_ITERATIONS,
            `Best: ${globalBestMeasure.toFixed(4)}`
        );

        // Early termination check
        if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_GRID_SEARCH) {
            acceptSupplementalBest();
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

        // STAGE 4: Simulated annealing (deterministic sequence)
        const numRestarts = currentParams.NUM_RESTARTS;
        const stepsPerRun = currentParams.STEPS_PER_RUN;

        for (let restart = 0; restart < numRestarts; restart++) {
            reportProgress('Annealing', restart, numRestarts, `Best: ${globalBestMeasure.toFixed(4)}`);

            let currentRotation;

            if (restart === 0) {
                currentRotation = globalBestRotation.clone();
            } else if (restart <= currentParams.PERTURBED_RESTARTS) {
                const randomAxis = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
                const randomAngle = (random() - 0.5) * Math.PI;
                const perturbation = new THREE.Matrix4().makeRotationAxis(randomAxis, randomAngle);
                currentRotation = new THREE.Matrix4().multiplyMatrices(perturbation, globalBestRotation);
            } else {
                currentRotation = new THREE.Matrix4().makeRotationFromEuler(
                    new THREE.Euler(random() * 2 * Math.PI, random() * 2 * Math.PI, random() * 2 * Math.PI, 'XYZ')
                );
            }

            let currentResult = getMeasureForRotation(currentRotation);
            let bestInRun = currentResult.measure;
            let bestRotationInRun = currentRotation.clone();
            let bestMatchingInRun = currentResult.matching;

            // Adaptive temperature schedule
            const initialTemp = mode === 'intensive'
                ? SHAPE_MEASURE.ANNEALING.INITIAL_TEMP_INTENSIVE
                : SHAPE_MEASURE.ANNEALING.INITIAL_TEMP_DEFAULT;
            let temp = initialTemp;
            const minTemp = SHAPE_MEASURE.ANNEALING.MIN_TEMP;
            const alpha = Math.pow(minTemp / temp, 1 / stepsPerRun);

            for (let step = 0; step < stepsPerRun; step++) {
                const stepSize = temp * SHAPE_MEASURE.ANNEALING.STEP_SIZE_FACTOR *
                    (1 + SHAPE_MEASURE.ANNEALING.STEP_SIZE_RANDOMNESS * random());
                const axis = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
                const angle = (random() - 0.5) * 2 * stepSize;

                const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
                const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
                const newResult = getMeasureForRotation(newRotation);

                const deltaE = newResult.measure - currentResult.measure;
                const acceptProb = deltaE < 0 ? 1.0 : Math.exp(-deltaE / temp);

                if (random() < acceptProb) {
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

                // Early termination for this run
                if (bestInRun < SHAPE_MEASURE.EARLY_STOP.DURING_ANNEALING_RUN) break;
            }

            if (bestInRun < globalBestMeasure) {
                globalBestMeasure = bestInRun;
                globalBestRotation.copy(bestRotationInRun);
                globalBestMatching = bestMatchingInRun;
            }

            // Early termination if excellent result
            if (globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.AFTER_ANNEALING) break;
        }

        // STAGE 5: Final refinement (deterministic sequence)
        reportProgress('Refinement', 0, 100);
        let currentRotation = globalBestRotation.clone();
        let currentMeasure = globalBestMeasure;
        let temp = SHAPE_MEASURE.REFINEMENT.INITIAL_TEMP;
        const refinementSteps = currentParams.REFINEMENT_STEPS;
        let noImprovementCount = 0;

        for (let step = 0; step < refinementSteps; step++) {
            const stepSize = temp * SHAPE_MEASURE.REFINEMENT.STEP_SIZE_FACTOR;
            const axis = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
            const angle = (random() - 0.5) * 2 * stepSize;

            const perturbation = new THREE.Matrix4().makeRotationAxis(axis, angle);
            const newRotation = new THREE.Matrix4().multiplyMatrices(perturbation, currentRotation);
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

            temp *= SHAPE_MEASURE.REFINEMENT.TEMP_DECAY;
            totalSteps++;

            if (step % PROGRESS.REFINEMENT_UPDATE_FREQUENCY === 0) {
                reportProgress('Refinement', step, refinementSteps, `Best: ${globalBestMeasure.toFixed(4)}`);
            }

            // Early termination
            if (noImprovementCount > SHAPE_MEASURE.REFINEMENT.NO_IMPROVEMENT_LIMIT &&
                globalBestMeasure < SHAPE_MEASURE.EARLY_STOP.DURING_REFINEMENT) {
                break;
            }
        }

        acceptSupplementalBest();
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

export default calculateShapeMeasure;

/**
 * Debug Instrumentation for CShM Calculation
 *
 * This module provides diagnostic tools to identify why Q-Shape may produce
 * different results than SHAPE v2.1, particularly for:
 * - Johnson geometry degeneracy issues
 * - Systematic CShM bias
 *
 * Enable by setting DEBUG_CSHM = true
 */

// Global debug flag - set to true to enable instrumentation
export const DEBUG_CSHM = false;

// High-precision logging for numerical comparison
const HP_DECIMALS = 12;

/**
 * Generate a hash fingerprint for coordinate arrays
 * Used to detect if reference geometries are collapsing to identical values
 */
export function coordFingerprint(coords, precision = 8) {
    if (!coords || !Array.isArray(coords)) return 'INVALID';

    const sorted = coords
        .map(c => c.map(x => x.toFixed(precision)).join(','))
        .sort()
        .join(';');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
        const char = sorted.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return `FP:${hash.toString(16)}`;
}

/**
 * Compute geometric properties for diagnostic comparison
 */
export function computeGeometricStats(coords) {
    if (!coords || coords.length === 0) return null;

    // Compute centroid
    const centroid = coords.reduce(
        (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
        [0, 0, 0]
    ).map(x => x / coords.length);

    // Compute distances from centroid
    const distances = coords.map(c =>
        Math.sqrt(
            (c[0] - centroid[0]) ** 2 +
            (c[1] - centroid[1]) ** 2 +
            (c[2] - centroid[2]) ** 2
        )
    );

    // Compute vertex-to-vertex distance matrix signature
    const distMatrix = [];
    for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
            const d = Math.sqrt(
                (coords[i][0] - coords[j][0]) ** 2 +
                (coords[i][1] - coords[j][1]) ** 2 +
                (coords[i][2] - coords[j][2]) ** 2
            );
            distMatrix.push(d);
        }
    }
    distMatrix.sort((a, b) => a - b);

    return {
        centroid,
        meanRadius: distances.reduce((a, b) => a + b, 0) / distances.length,
        minRadius: Math.min(...distances),
        maxRadius: Math.max(...distances),
        distanceSignature: distMatrix.map(d => d.toFixed(6)).join(',')
    };
}

/**
 * Debug log entry for a single CShM calculation
 */
export class CShMDebugLog {
    constructor(geometryName) {
        this.geometryName = geometryName;
        this.timestamp = new Date().toISOString();
        this.stages = [];
        this.finalResult = null;
    }

    logReferenceCoords(coords) {
        this.referenceCoords = {
            fingerprint: coordFingerprint(coords),
            stats: computeGeometricStats(coords),
            raw: coords.map(c => c.map(x => x.toFixed(HP_DECIMALS)))
        };
    }

    logActualCoords(coords, preprocessed = false) {
        const key = preprocessed ? 'actualCoordsPreprocessed' : 'actualCoordsRaw';
        this[key] = {
            fingerprint: coordFingerprint(coords),
            stats: computeGeometricStats(coords),
            raw: coords.map(c => c.map(x => x.toFixed(HP_DECIMALS)))
        };
    }

    logNormalization(originalCoords, normalizedCoords) {
        this.normalization = {
            originalFingerprint: coordFingerprint(originalCoords),
            normalizedFingerprint: coordFingerprint(normalizedCoords),
            scales: originalCoords.map((c, i) => {
                const origLen = Math.sqrt(c[0]**2 + c[1]**2 + c[2]**2);
                const normLen = Math.sqrt(
                    normalizedCoords[i][0]**2 +
                    normalizedCoords[i][1]**2 +
                    normalizedCoords[i][2]**2
                );
                return { index: i, originalLength: origLen, normalizedLength: normLen };
            })
        };
    }

    logStage(stageName, data) {
        this.stages.push({
            stage: stageName,
            ...data
        });
    }

    logKabschAlignment(matching, rotation, measure) {
        this.kabsch = {
            matching: matching.map(([p, q]) => `P${p}→Q${q}`),
            rotationDeterminant: rotation ? rotation.determinant() : null,
            measure: measure.toFixed(HP_DECIMALS)
        };
    }

    logBestResult(measure, matching, rotation) {
        this.finalResult = {
            measure: measure.toFixed(HP_DECIMALS),
            measureRaw: measure,
            matching: matching ? matching.map(([p, q]) => `P${p}→Q${q}`) : null,
            rotationDeterminant: rotation ? rotation.determinant() : null
        };
    }

    toJSON() {
        return {
            geometry: this.geometryName,
            timestamp: this.timestamp,
            referenceCoords: this.referenceCoords,
            actualCoordsRaw: this.actualCoordsRaw,
            actualCoordsPreprocessed: this.actualCoordsPreprocessed,
            normalization: this.normalization,
            kabsch: this.kabsch,
            stages: this.stages,
            finalResult: this.finalResult
        };
    }

    print() {
        console.log('\n' + '='.repeat(80));
        console.log(`DEBUG LOG: ${this.geometryName}`);
        console.log('='.repeat(80));

        if (this.referenceCoords) {
            console.log('\n--- Reference Geometry ---');
            console.log(`Fingerprint: ${this.referenceCoords.fingerprint}`);
            console.log(`Distance signature: ${this.referenceCoords.stats?.distanceSignature}`);
        }

        if (this.actualCoordsRaw) {
            console.log('\n--- Actual Coords (Raw) ---');
            console.log(`Fingerprint: ${this.actualCoordsRaw.fingerprint}`);
        }

        if (this.actualCoordsPreprocessed) {
            console.log('\n--- Actual Coords (After Preprocessing) ---');
            console.log(`Fingerprint: ${this.actualCoordsPreprocessed.fingerprint}`);
        }

        if (this.kabsch) {
            console.log('\n--- Kabsch Alignment ---');
            console.log(`Matching: ${this.kabsch.matching.join(', ')}`);
            console.log(`Initial measure: ${this.kabsch.measure}`);
        }

        if (this.finalResult) {
            console.log('\n--- Final Result ---');
            console.log(`Measure: ${this.finalResult.measure}`);
            console.log(`Matching: ${this.finalResult.matching?.join(', ')}`);
        }

        console.log('='.repeat(80) + '\n');
    }
}

/**
 * Store for collecting debug logs across multiple geometry calculations
 */
export class CShMDebugSession {
    constructor(sessionName = 'default') {
        this.sessionName = sessionName;
        this.logs = [];
        this.startTime = Date.now();
    }

    createLog(geometryName) {
        const log = new CShMDebugLog(geometryName);
        this.logs.push(log);
        return log;
    }

    getSummary() {
        const results = this.logs.map(log => ({
            geometry: log.geometryName,
            measure: log.finalResult?.measureRaw,
            refFingerprint: log.referenceCoords?.fingerprint
        }));

        // Sort by measure
        results.sort((a, b) => (a.measure || Infinity) - (b.measure || Infinity));

        return {
            session: this.sessionName,
            duration: Date.now() - this.startTime,
            results
        };
    }

    printComparison() {
        console.log('\n' + '═'.repeat(80));
        console.log(`DEBUG SESSION: ${this.sessionName}`);
        console.log('═'.repeat(80));

        // Group by reference fingerprint to detect collisions
        const byFingerprint = new Map();
        for (const log of this.logs) {
            const fp = log.referenceCoords?.fingerprint || 'UNKNOWN';
            if (!byFingerprint.has(fp)) {
                byFingerprint.set(fp, []);
            }
            byFingerprint.get(fp).push(log.geometryName);
        }

        console.log('\n--- Reference Geometry Fingerprints ---');
        for (const [fp, geoms] of byFingerprint.entries()) {
            if (geoms.length > 1) {
                console.log(`⚠️  COLLISION: ${fp} → [${geoms.join(', ')}]`);
            } else {
                console.log(`   ${fp} → ${geoms[0]}`);
            }
        }

        console.log('\n--- CShM Results (sorted) ---');
        const summary = this.getSummary();
        for (const r of summary.results) {
            console.log(`${r.measure?.toFixed(6)?.padStart(12)} │ ${r.geometry}`);
        }

        // Check for degeneracy
        console.log('\n--- Degeneracy Check ---');
        const measures = summary.results.map(r => r.measure).filter(m => m !== undefined);
        for (let i = 0; i < measures.length - 1; i++) {
            const diff = Math.abs(measures[i] - measures[i + 1]);
            if (diff < 1e-6) {
                console.log(`⚠️  DEGENERACY: ${summary.results[i].geometry} ≈ ${summary.results[i+1].geometry} (diff: ${diff.toExponential(3)})`);
            }
        }

        console.log('═'.repeat(80) + '\n');
    }
}

// Global session for tests
let globalDebugSession = null;

export function startDebugSession(name) {
    globalDebugSession = new CShMDebugSession(name);
    return globalDebugSession;
}

export function getDebugSession() {
    return globalDebugSession;
}

export function endDebugSession() {
    if (globalDebugSession) {
        globalDebugSession.printComparison();
    }
    const session = globalDebugSession;
    globalDebugSession = null;
    return session;
}

/**
 * Compare two geometry reference coordinates and report differences
 */
export function compareReferenceGeometries(name1, coords1, name2, coords2) {
    console.log('\n' + '─'.repeat(60));
    console.log(`COMPARING: ${name1} vs ${name2}`);
    console.log('─'.repeat(60));

    const fp1 = coordFingerprint(coords1);
    const fp2 = coordFingerprint(coords2);

    console.log(`${name1} fingerprint: ${fp1}`);
    console.log(`${name2} fingerprint: ${fp2}`);
    console.log(`Fingerprints match: ${fp1 === fp2 ? '⚠️ YES (PROBLEM!)' : '✓ No (expected)'}`);

    const stats1 = computeGeometricStats(coords1);
    const stats2 = computeGeometricStats(coords2);

    console.log(`\n${name1} distance signature: ${stats1.distanceSignature}`);
    console.log(`${name2} distance signature: ${stats2.distanceSignature}`);
    console.log(`Distance signatures match: ${stats1.distanceSignature === stats2.distanceSignature ? '⚠️ YES' : '✓ No'}`);

    // Compute pairwise vertex differences
    console.log('\nVertex-by-vertex comparison:');
    for (let i = 0; i < Math.min(coords1.length, coords2.length); i++) {
        const diff = Math.sqrt(
            (coords1[i][0] - coords2[i][0]) ** 2 +
            (coords1[i][1] - coords2[i][1]) ** 2 +
            (coords1[i][2] - coords2[i][2]) ** 2
        );
        console.log(`  Vertex ${i}: diff = ${diff.toFixed(8)}`);
    }

    console.log('─'.repeat(60) + '\n');
}

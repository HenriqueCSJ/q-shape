/**
 * Pattern Detection System
 *
 * Detects structural patterns in coordination complexes based on:
 * - Ring topology
 * - Ligand connectivity
 * - Spatial arrangement (parallel, coplanar, etc.)
 *
 * Each pattern detector returns:
 * {
 *   confidence: 0-1,        // How well this pattern matches
 *   patternType: string,    // Pattern identifier
 *   metadata: object        // Pattern-specific data for geometry construction
 * }
 */

import * as vec3 from '../../../utils/vec3';

/**
 * Detect if two rings are parallel within tolerance
 */
function areRingsParallel(ring1Coords, ring2Coords, tolerance = 0.2) {
    // Calculate normal vectors for each ring using first 3 non-collinear points
    const normal1 = calculateRingNormal(ring1Coords);
    const normal2 = calculateRingNormal(ring2Coords);

    if (!normal1 || !normal2) return false;

    // Check if normals are parallel (dot product close to ±1)
    const dot = Math.abs(vec3.dot(normal1, normal2));
    return dot > (1 - tolerance);
}

/**
 * Calculate normal vector for a ring of coordinates
 */
function calculateRingNormal(coords) {
    if (coords.length < 3) return null;

    // Use first 3 points to define plane
    const v1 = vec3.subtract(coords[1], coords[0]);
    const v2 = vec3.subtract(coords[2], coords[0]);

    const normal = vec3.cross(v1, v2);
    return vec3.normalize(normal);
}

/**
 * Check if ring coordinates are approximately coplanar
 */
function areCoplanar(coords, tolerance = 0.15) {
    if (coords.length < 4) return true; // 3 or fewer points always coplanar

    const normal = calculateRingNormal(coords);
    if (!normal) return false;

    // Check distance of all points to plane defined by first 3 points
    const planePoint = coords[0];

    for (let i = 3; i < coords.length; i++) {
        const toPoint = vec3.subtract(coords[i], planePoint);
        const distance = Math.abs(vec3.dot(toPoint, normal));

        if (distance > tolerance) return false;
    }

    return true;
}

/**
 * Calculate centroid of a set of coordinates
 */
function calculateCentroid(coords) {
    const sum = coords.reduce((acc, c) => vec3.add(acc, c), [0, 0, 0]);
    return vec3.scale(sum, 1 / coords.length);
}

/**
 * Calculate distance between two centroids
 */
function ringDistance(ring1Coords, ring2Coords) {
    const c1 = calculateCentroid(ring1Coords);
    const c2 = calculateCentroid(ring2Coords);
    return vec3.distance(c1, c2);
}

/**
 * Detect sandwich structure pattern
 * - Two rings of equal size
 * - Parallel to each other
 * - Reasonable distance apart
 */
export function detectSandwichPattern(atoms, metalIndex, ligandGroups) {
    const { rings } = ligandGroups;

    if (rings.length !== 2) {
        return { confidence: 0, patternType: 'sandwich', metadata: null };
    }

    const ring1 = rings[0];
    const ring2 = rings[1];

    // Must be same size
    if (ring1.size !== ring2.size) {
        return { confidence: 0, patternType: 'sandwich', metadata: null };
    }

    // Get coordinates for each ring
    const ring1Coords = ring1.atomIndices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    const ring2Coords = ring2.atomIndices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    // Check if parallel
    const parallel = areRingsParallel(ring1Coords, ring2Coords);
    if (!parallel) {
        return { confidence: 0.3, patternType: 'sandwich', metadata: null };
    }

    // Check reasonable distance (not too close, not too far)
    const dist = ringDistance(ring1Coords, ring2Coords);
    if (dist < 2.0 || dist > 5.0) {
        return { confidence: 0.5, patternType: 'sandwich', metadata: null };
    }

    // High confidence sandwich structure
    return {
        confidence: 0.95,
        patternType: 'sandwich',
        metadata: {
            ringSize: ring1.size,
            coordinationNumber: ring1.size + ring2.size,
            ring1,
            ring2,
            ring1Coords,
            ring2Coords,
            distance: dist
        }
    };
}

/**
 * Detect piano stool (half-sandwich) pattern
 * - One ring
 * - Multiple monodentate ligands
 */
export function detectPianoStoolPattern(atoms, metalIndex, ligandGroups) {
    const { rings, monodentate } = ligandGroups;

    if (rings.length !== 1 || monodentate.length === 0) {
        return { confidence: 0, patternType: 'piano_stool', metadata: null };
    }

    const ring = rings[0];

    // Typical piano stool: η5-Cp (5) + 3 CO or η6-benzene (6) + 3 ligands
    const totalCN = ring.size + monodentate.length;

    // Get ring coordinates
    const ringCoords = ring.atomIndices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    // Get monodentate coordinates
    const monoCoords = monodentate.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    return {
        confidence: 0.85,
        patternType: 'piano_stool',
        metadata: {
            ringSize: ring.size,
            monodentateCount: monodentate.length,
            coordinationNumber: totalCN,
            ring,
            ringCoords,
            monoCoords
        }
    };
}

/**
 * Detect planar macrocycle pattern (porphyrins, etc.)
 * - Single large ring (typically 4+ donors in plane)
 * - Coplanar coordination
 * - Optional axial ligands
 */
export function detectMacrocyclePattern(atoms, metalIndex, ligandGroups) {
    const { rings, monodentate } = ligandGroups;

    if (rings.length !== 1) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    const ring = rings[0];

    // Macrocycle typically has 4+ donors (porphyrin = 4N)
    if (ring.size < 4) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    // Get ring coordinates
    const ringCoords = ring.atomIndices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    // Must be coplanar
    if (!areCoplanar(ringCoords)) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    // Get axial ligands (monodentate perpendicular to plane)
    const axialLigands = monodentate.filter(idx => {
        const coord = [
            atoms[idx].x - atoms[metalIndex].x,
            atoms[idx].y - atoms[metalIndex].y,
            atoms[idx].z - atoms[metalIndex].z
        ];

        const normal = calculateRingNormal(ringCoords);
        if (!normal) return false;

        const normalized = vec3.normalize(coord);
        const dot = Math.abs(vec3.dot(normalized, normal));

        // Axial if aligned with normal (dot product > 0.7)
        return dot > 0.7;
    });

    return {
        confidence: 0.90,
        patternType: 'macrocycle',
        metadata: {
            ringSize: ring.size,
            axialCount: axialLigands.length,
            coordinationNumber: ring.size + axialLigands.length,
            ring,
            ringCoords,
            axialLigands
        }
    };
}

/**
 * Run all pattern detectors and return best match
 */
export function detectPattern(atoms, metalIndex, ligandGroups) {
    const patterns = [
        detectSandwichPattern(atoms, metalIndex, ligandGroups),
        detectPianoStoolPattern(atoms, metalIndex, ligandGroups),
        detectMacrocyclePattern(atoms, metalIndex, ligandGroups)
    ];

    // Sort by confidence
    patterns.sort((a, b) => b.confidence - a.confidence);

    const best = patterns[0];

    console.log('Pattern detection results:');
    patterns.forEach(p => {
        console.log(`  ${p.patternType}: ${(p.confidence * 100).toFixed(1)}% confidence`);
    });

    // Only use pattern if confidence > 0.7
    if (best.confidence > 0.7) {
        console.log(`✓ Selected pattern: ${best.patternType} (${(best.confidence * 100).toFixed(1)}%)`);
        return best;
    }

    console.log('✗ No high-confidence pattern detected, falling back to standard CShM');
    return null;
}

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
import { PATTERN_DETECTION } from '../../../constants/algorithmConstants';

/**
 * Detect if two rings are parallel within tolerance
 */
function areRingsParallel(ring1Coords, ring2Coords, tolerance = PATTERN_DETECTION.PARALLELISM_TOLERANCE) {
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
function areCoplanar(coords, tolerance = PATTERN_DETECTION.COPLANARITY_TOLERANCE) {
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
    const ring1Coords = ring1.indices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    const ring2Coords = ring2.indices.map(idx => [
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
    if (dist < PATTERN_DETECTION.MIN_SANDWICH_DISTANCE || dist > PATTERN_DETECTION.MAX_SANDWICH_DISTANCE) {
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
    const ringCoords = ring.indices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    // Get monodentate coordinates
    const monoCoords = monodentate.map(group => {
        const atom = group.atoms[0]; // Each monodentate group has one atom
        return [
            atom.x - atoms[metalIndex].x,
            atom.y - atoms[metalIndex].y,
            atom.z - atoms[metalIndex].z
        ];
    });

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
 *
 * NOTE: Small aromatic rings (η5-Cp, η6-benzene) with multiple monodentate
 * ligands are piano stool complexes, NOT macrocycles!
 */
export function detectMacrocyclePattern(atoms, metalIndex, ligandGroups) {
    const { rings, monodentate } = ligandGroups;

    if (rings.length !== 1) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    const ring = rings[0];

    // Macrocycle typically has 4+ donors (porphyrin = 4N)
    if (ring.size < PATTERN_DETECTION.MIN_MACROCYCLE_SIZE) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    // If ring is small (≤7 atoms, like Cp or benzene) AND has multiple monodentate ligands,
    // this is a piano stool complex, NOT a macrocycle!
    // Macrocycles are large chelating ligands (porphyrins, corrins, crown ethers)
    if (ring.size <= 7 && monodentate.length > 0) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    // Get ring coordinates
    const ringCoords = ring.indices.map(idx => [
        atoms[idx].x - atoms[metalIndex].x,
        atoms[idx].y - atoms[metalIndex].y,
        atoms[idx].z - atoms[metalIndex].z
    ]);

    // Must be coplanar
    if (!areCoplanar(ringCoords)) {
        return { confidence: 0, patternType: 'macrocycle', metadata: null };
    }

    // Get axial ligands (monodentate perpendicular to plane)
    const axialLigands = monodentate.filter(group => {
        const atom = group.atoms[0]; // Each monodentate group has one atom
        const coord = [
            atom.x - atoms[metalIndex].x,
            atom.y - atoms[metalIndex].y,
            atom.z - atoms[metalIndex].z
        ];

        const normal = calculateRingNormal(ringCoords);
        if (!normal) return false;

        const normalized = vec3.normalize(coord);
        const dot = Math.abs(vec3.dot(normalized, normal));

        // Axial if aligned with normal (dot product > threshold)
        return dot > PATTERN_DETECTION.AXIAL_ALIGNMENT_THRESHOLD;
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

    // Only use pattern if confidence exceeds minimum threshold
    if (best.confidence > PATTERN_DETECTION.MIN_PATTERN_CONFIDENCE) {
        console.log(`✓ Selected pattern: ${best.patternType} (${(best.confidence * 100).toFixed(1)}%)`);
        return best;
    }

    console.log('✗ No high-confidence pattern detected, falling back to standard CShM');
    return null;
}

/**
 * Unified Structure Data Model for Q-Shape v1.5.0
 *
 * This file defines the canonical in-memory model for molecular structures.
 * All parsers must return data conforming to these structures.
 *
 * Design Principles:
 * - Single source of truth: structures[] is the only representation
 * - Single mode: structures.length === 1
 * - Batch mode: structures.length > 1
 * - No competing representations (no separate 'frames', 'models', 'selectedStructure')
 */

/**
 * @typedef {Object} Atom
 * @property {string} element - Element symbol (normalized: first letter uppercase, rest lowercase)
 * @property {number} x - X coordinate in Ångströms (Cartesian)
 * @property {number} y - Y coordinate in Ångströms (Cartesian)
 * @property {number} z - Z coordinate in Ångströms (Cartesian)
 */

/**
 * @typedef {Object} UnitCell
 * @property {number} a - Cell parameter a (Å)
 * @property {number} b - Cell parameter b (Å)
 * @property {number} c - Cell parameter c (Å)
 * @property {number} alpha - Cell angle alpha (degrees)
 * @property {number} beta - Cell angle beta (degrees)
 * @property {number} gamma - Cell angle gamma (degrees)
 */

/**
 * @typedef {Object} StructureMetadata
 * @property {UnitCell} [unitCell] - Unit cell parameters (CIF only)
 * @property {string} [spaceGroup] - Space group symbol (CIF only)
 * @property {string} [comment] - Comment line (XYZ) or CIF metadata
 * @property {string} [parseProvenance] - How this structure was parsed
 * @property {Array<string>} [warnings] - Structure-specific warnings
 */

/**
 * @typedef {Object} Structure
 * @property {string} id - Unique identifier for UI display (e.g., "LMMPa", "CIF:block1", "file:frame-001")
 * @property {string} source - Source file name or CIF block name
 * @property {Array<Atom>} atoms - Array of atoms with Cartesian coordinates
 * @property {StructureMetadata} [metadata] - Optional metadata
 */

/**
 * @typedef {Object} ParseResult
 * @property {Array<Structure>} structures - Array of parsed structures
 * @property {Array<string>} warnings - Global warnings from parsing
 * @property {'xyz'|'cif'|'unknown'} format - Detected file format
 * @property {number} frameCount - Number of structures/frames parsed
 * @property {boolean} valid - Whether parsing was successful
 * @property {string} [error] - Error message if valid === false
 */

/**
 * @typedef {Object} StructureOverride
 * @property {number} [metalIndex] - Override metal center index
 * @property {number} [radius] - Override coordination radius
 * @property {number} [targetCN] - Target coordination number
 */

/**
 * @typedef {Object} BatchAnalysisResult
 * @property {string} structureId - ID of the structure this result belongs to
 * @property {Array<Object>} geometryResults - All geometry analysis results (sorted by CShM)
 * @property {Object} bestGeometry - Best matching geometry
 * @property {Object} additionalMetrics - Bond statistics
 * @property {Object} qualityMetrics - Quality scores
 * @property {Object} [intensiveMetadata] - Intensive analysis metadata if applicable
 * @property {number} metalIndex - Metal center used for analysis
 * @property {number} radius - Coordination radius used
 * @property {number} coordinationNumber - Number of coordinating atoms
 * @property {string} analysisMode - 'default' or 'intensive'
 */

/**
 * Creates an empty parse result with error
 * @param {string} error - Error message
 * @returns {ParseResult}
 */
export function createErrorResult(error) {
    return {
        structures: [],
        warnings: [],
        format: 'unknown',
        frameCount: 0,
        valid: false,
        error
    };
}

/**
 * Creates a successful parse result
 * @param {Array<Structure>} structures - Parsed structures
 * @param {'xyz'|'cif'} format - File format
 * @param {Array<string>} [warnings=[]] - Parse warnings
 * @returns {ParseResult}
 */
export function createSuccessResult(structures, format, warnings = []) {
    return {
        structures,
        warnings,
        format,
        frameCount: structures.length,
        valid: true
    };
}

/**
 * Creates a Structure object
 * @param {string} id - Unique identifier
 * @param {string} source - Source file/block name
 * @param {Array<Atom>} atoms - Atom array
 * @param {StructureMetadata} [metadata={}] - Optional metadata
 * @returns {Structure}
 */
export function createStructure(id, source, atoms, metadata = {}) {
    return {
        id,
        source,
        atoms,
        metadata
    };
}

/**
 * Generates a stable structure ID
 * @param {string} filename - Source filename
 * @param {number} frameIndex - Frame index (0-based)
 * @param {string} [comment] - Optional comment line to extract ID from
 * @returns {string}
 */
export function generateStructureId(filename, frameIndex, comment = null) {
    // Try to extract identifier from comment line
    if (comment) {
        const trimmed = comment.trim();
        // Use comment as ID if it's short and looks like an identifier
        if (trimmed.length > 0 && trimmed.length <= 50 && !trimmed.includes('\n')) {
            // Remove common prefixes and clean up
            const cleaned = trimmed
                .replace(/^(frame|structure|model|#)\s*/i, '')
                .trim();
            if (cleaned.length > 0) {
                return cleaned;
            }
        }
    }

    // Fallback: filename + frame index
    const baseName = filename.replace(/\.(xyz|cif)$/i, '');
    return frameIndex === 0 ? baseName : `${baseName}:frame-${String(frameIndex + 1).padStart(3, '0')}`;
}

/**
 * Determines if batch mode should be active
 * @param {Array<Structure>} structures - Array of structures
 * @returns {boolean} - True if batch mode should be enabled
 */
export function isBatchMode(structures) {
    return Array.isArray(structures) && structures.length > 1;
}

/**
 * Validates a Structure object
 * @param {Structure} structure - Structure to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateStructure(structure) {
    const errors = [];

    if (!structure) {
        return { valid: false, errors: ['Structure is null or undefined'] };
    }

    if (!structure.id || typeof structure.id !== 'string') {
        errors.push('Structure must have a string id');
    }

    if (!structure.source || typeof structure.source !== 'string') {
        errors.push('Structure must have a string source');
    }

    if (!Array.isArray(structure.atoms)) {
        errors.push('Structure must have an atoms array');
    } else if (structure.atoms.length === 0) {
        errors.push('Structure must have at least one atom');
    } else {
        // Validate first few atoms
        for (let i = 0; i < Math.min(3, structure.atoms.length); i++) {
            const atom = structure.atoms[i];
            if (!atom.element || typeof atom.element !== 'string') {
                errors.push(`Atom ${i} must have a string element`);
            }
            if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) {
                errors.push(`Atom ${i} must have finite x, y, z coordinates`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// Export constants for configuration
export const PARSE_CONFIG = {
    // XYZ parsing
    MAX_COORD_MAGNITUDE: 1000, // Warn if coordinates exceed this (possible unit mismatch)
    LARGE_STRUCTURE_WARNING: 500, // Warn if atom count exceeds this

    // Multi-frame parsing
    STRICT_MODE: false, // If true, fail on first malformed frame; if false, stop at last valid frame

    // CIF parsing
    EXPAND_SYMMETRY: false, // If true, expand asymmetric unit to full cell (default: conservative)

    // ID generation
    MAX_ID_LENGTH: 50 // Maximum length for generated structure IDs
};

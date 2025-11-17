/**
 * XYZ File Parser Utilities
 *
 * Provides functionality for parsing and validating XYZ molecular structure files.
 * XYZ format: First line = atom count, second line = comment, subsequent lines = atom data.
 */

import { ATOMIC_DATA } from '../constants/atomicData';
import { FILE_PARSING } from '../constants/algorithmConstants';

/**
 * Validates XYZ file content before parsing
 *
 * Performs comprehensive validation including:
 * - File structure (minimum 3 lines)
 * - Valid atom count header
 * - Correct number of data lines
 * - Element recognition
 * - Coordinate validity (finite numbers)
 * - Large coordinate warnings (unit mismatch detection)
 *
 * @param {string} content - Raw XYZ file content
 * @returns {Object} Validation result:
 *   - valid: boolean - Whether file is valid
 *   - error: string - Error message if invalid
 *   - warnings: Array<string> - Non-fatal warnings
 *
 * @example
 * const content = `3
 * Water molecule
 * O  0.000  0.000  0.000
 * H  0.757  0.586  0.000
 * H -0.757  0.586  0.000`;
 * const result = validateXYZ(content);
 * // Returns: { valid: true, warnings: [] }
 */
export function validateXYZ(content) {
    const warnings = [];

    try {
        const lines = content.trim().split(/\n+/);

        if (lines.length < 3) {
            throw new Error('XYZ file too short - must have at least 3 lines (atom count, comment, and atom data)');
        }

        const nAtoms = parseInt(lines[0].trim());
        if (!Number.isFinite(nAtoms) || nAtoms <= 0) {
            throw new Error('Invalid atom count in XYZ header - must be a positive integer');
        }

        if (nAtoms > FILE_PARSING.LARGE_STRUCTURE_WARNING) {
            warnings.push(`Large structure detected (${nAtoms} atoms) - analysis may be slow`);
        }

        if (lines.length < nAtoms + 2) {
            throw new Error(`File claims ${nAtoms} atoms but only has ${lines.length - 2} data lines`);
        }

        const unknownElements = [];
        const invalidCoords = [];

        for (let i = 2; i < Math.min(2 + nAtoms, lines.length); i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 4) {
                throw new Error(`Line ${i + 1}: Invalid format - expected "Element X Y Z"`);
            }

            const [element, x, y, z] = parts;
            const normalizedElement = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();

            if (!ATOMIC_DATA[normalizedElement]) {
                unknownElements.push(`${element} (line ${i + 1})`);
            }

            const xVal = parseFloat(x);
            const yVal = parseFloat(y);
            const zVal = parseFloat(z);

            if (!Number.isFinite(xVal) || !Number.isFinite(yVal) || !Number.isFinite(zVal)) {
                invalidCoords.push(`Line ${i + 1}: non-numeric coordinates`);
            }

            const maxCoord = FILE_PARSING.MAX_COORD_MAGNITUDE;
            if (Math.abs(xVal) > maxCoord || Math.abs(yVal) > maxCoord || Math.abs(zVal) > maxCoord) {
                warnings.push(`Line ${i + 1}: Very large coordinates detected (may indicate unit mismatch)`);
            }
        }

        if (unknownElements.length > 0) {
            warnings.push(`Unknown elements found (using defaults): ${unknownElements.slice(0, 5).join(', ')}${unknownElements.length > 5 ? '...' : ''}`);
        }

        if (invalidCoords.length > 0) {
            throw new Error(invalidCoords[0]);
        }

        return { valid: true, warnings };

    } catch (error) {
        return { valid: false, error: error.message, warnings };
    }
}

/**
 * Parses XYZ file content into atom objects
 *
 * Extracts atomic coordinates and element symbols from XYZ format.
 * Automatically normalizes element symbols (first letter uppercase, rest lowercase).
 * Skips invalid atoms with warnings rather than failing completely.
 *
 * @param {string} content - Raw XYZ file content
 * @returns {Array<Object>} Array of atom objects with properties:
 *   - element: string - Element symbol (normalized)
 *   - x: number - X coordinate (Å)
 *   - y: number - Y coordinate (Å)
 *   - z: number - Z coordinate (Å)
 * @throws {Error} If file format is invalid or no valid atoms found
 *
 * @example
 * const content = `2
 * Example
 * Fe  0.0  0.0  0.0
 * N   2.1  0.0  0.0`;
 * const atoms = parseXYZ(content);
 * // Returns: [
 * //   { element: 'Fe', x: 0.0, y: 0.0, z: 0.0 },
 * //   { element: 'N', x: 2.1, y: 0.0, z: 0.0 }
 * // ]
 */
export function parseXYZ(content) {
    try {
        const lines = content.replace(/\r\n?/g, "\n").trim().split(/\n+/);
        const n_atoms_line = lines[0].trim();
        const n = parseInt(n_atoms_line, 10);

        if (!Number.isFinite(n) || n <= 0) {
            throw new Error("Invalid XYZ header: Atom count is missing or invalid.");
        }

        const out = [];
        for (let i = 2; i < Math.min(2 + n, lines.length); i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 4) continue;

            const element = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);

            if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
                console.warn(`Skipping atom with invalid coordinates at line ${i + 1}`);
                continue;
            }

            out.push({ element, x, y, z });
        }

        if (out.length === 0) {
            throw new Error("No valid atoms found in file");
        }

        return out;
    } catch (error) {
        throw new Error(`Failed to parse XYZ file: ${error.message}`);
    }
}

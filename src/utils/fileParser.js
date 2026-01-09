/**
 * XYZ File Parser Utilities
 *
 * Provides functionality for parsing and validating XYZ molecular structure files.
 * Supports both single-structure and multi-frame XYZ files.
 * XYZ format: First line = atom count, second line = comment, subsequent lines = atom data.
 *
 * Multi-frame XYZ files contain multiple structures concatenated:
 * 87
 * Structure1
 * C 0.0 0.0 0.0
 * ...
 * 90
 * Structure2
 * C 1.0 1.0 1.0
 * ...
 */

import { ATOMIC_DATA } from '../constants/atomicData.js';
import { FILE_PARSING } from '../constants/algorithmConstants.js';

/**
 * Structure object representing a parsed molecular structure
 * @typedef {Object} Structure
 * @property {string} name - Structure name (from comment line or generated)
 * @property {Array<{element: string, x: number, y: number, z: number}>} atoms - Array of atoms
 * @property {string} format - File format ('xyz' or 'cif')
 * @property {number} [frameIndex] - Index in multi-frame file (0-based)
 */

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

/**
 * Detects if XYZ content contains multiple frames/structures
 *
 * Checks if there are additional atom count headers after the first structure,
 * indicating a multi-frame XYZ file (trajectory or multiple conformations).
 *
 * @param {string} content - Raw XYZ file content
 * @returns {boolean} True if file contains multiple structures
 *
 * @example
 * const singleFrame = `3\nWater\nO 0 0 0\nH 1 0 0\nH 0 1 0`;
 * isMultiFrameXYZ(singleFrame); // false
 *
 * const multiFrame = `3\nFrame1\nO 0 0 0\nH 1 0 0\nH 0 1 0\n3\nFrame2\nO 0 0 0\nH 1 0 0\nH 0 1 0`;
 * isMultiFrameXYZ(multiFrame); // true
 */
export function isMultiFrameXYZ(content) {
    try {
        const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
        if (lines.length < 3) return false;

        const firstAtomCount = parseInt(lines[0].trim(), 10);
        if (!Number.isFinite(firstAtomCount) || firstAtomCount <= 0) return false;

        // Check if there's content after the first structure
        const nextFrameStart = 2 + firstAtomCount; // header + comment + atoms
        if (nextFrameStart >= lines.length) return false;

        // Check if next line looks like an atom count
        const potentialNextCount = parseInt(lines[nextFrameStart].trim(), 10);
        return Number.isFinite(potentialNextCount) && potentialNextCount > 0;
    } catch {
        return false;
    }
}

/**
 * Counts the number of structures in a multi-frame XYZ file
 *
 * @param {string} content - Raw XYZ file content
 * @returns {number} Number of structures (frames) in the file
 */
export function countXYZFrames(content) {
    try {
        const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
        let count = 0;
        let i = 0;

        while (i < lines.length) {
            const atomCount = parseInt(lines[i].trim(), 10);
            if (!Number.isFinite(atomCount) || atomCount <= 0) break;
            count++;
            i += 2 + atomCount; // Skip header + comment + atoms
        }

        return count;
    } catch {
        return 0;
    }
}

/**
 * Validates multi-frame XYZ file content
 *
 * Validates each frame in a multi-frame XYZ file, collecting warnings
 * and errors for each structure.
 *
 * @param {string} content - Raw XYZ file content
 * @returns {Object} Validation result:
 *   - valid: boolean - Whether all frames are valid
 *   - frameCount: number - Number of frames detected
 *   - warnings: Array<string> - Non-fatal warnings (may include frame index)
 *   - errors: Array<{frame: number, error: string}> - Per-frame errors
 *
 * @example
 * const result = validateMultiXYZ(multiFrameContent);
 * // Returns: { valid: true, frameCount: 4, warnings: [], errors: [] }
 */
export function validateMultiXYZ(content) {
    const warnings = [];
    const errors = [];
    let frameCount = 0;

    try {
        const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
        let lineIndex = 0;

        while (lineIndex < lines.length) {
            // Check for atom count header
            const headerLine = lines[lineIndex]?.trim();
            if (!headerLine) break;

            const nAtoms = parseInt(headerLine, 10);
            if (!Number.isFinite(nAtoms) || nAtoms <= 0) {
                // Could be end of file or invalid content
                if (frameCount === 0) {
                    return {
                        valid: false,
                        frameCount: 0,
                        error: 'Invalid atom count in XYZ header - must be a positive integer',
                        warnings,
                        errors
                    };
                }
                break; // End of valid frames
            }

            frameCount++;
            const frameLabel = `Frame ${frameCount}`;

            // Check for comment line
            if (lineIndex + 1 >= lines.length) {
                errors.push({ frame: frameCount, error: `${frameLabel}: Missing comment line` });
                break;
            }

            // Check atom data lines
            const expectedEnd = lineIndex + 2 + nAtoms;
            if (expectedEnd > lines.length) {
                errors.push({
                    frame: frameCount,
                    error: `${frameLabel}: Claims ${nAtoms} atoms but file ends prematurely`
                });
                break;
            }

            // Validate atom lines for this frame
            const unknownElements = [];
            for (let i = lineIndex + 2; i < expectedEnd; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length < 4) {
                    errors.push({
                        frame: frameCount,
                        error: `${frameLabel}, Line ${i + 1}: Invalid format - expected "Element X Y Z"`
                    });
                    continue;
                }

                const [element, x, y, z] = parts;
                const normalizedElement = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();

                if (!ATOMIC_DATA[normalizedElement]) {
                    unknownElements.push(element);
                }

                const xVal = parseFloat(x);
                const yVal = parseFloat(y);
                const zVal = parseFloat(z);

                if (!Number.isFinite(xVal) || !Number.isFinite(yVal) || !Number.isFinite(zVal)) {
                    errors.push({
                        frame: frameCount,
                        error: `${frameLabel}, Line ${i + 1}: Non-numeric coordinates`
                    });
                }

                const maxCoord = FILE_PARSING.MAX_COORD_MAGNITUDE;
                if (Math.abs(xVal) > maxCoord || Math.abs(yVal) > maxCoord || Math.abs(zVal) > maxCoord) {
                    warnings.push(`${frameLabel}, Line ${i + 1}: Very large coordinates detected`);
                }
            }

            if (unknownElements.length > 0) {
                const unique = [...new Set(unknownElements)];
                warnings.push(`${frameLabel}: Unknown elements (using defaults): ${unique.slice(0, 3).join(', ')}${unique.length > 3 ? '...' : ''}`);
            }

            if (nAtoms > FILE_PARSING.LARGE_STRUCTURE_WARNING) {
                warnings.push(`${frameLabel}: Large structure (${nAtoms} atoms) - analysis may be slow`);
            }

            lineIndex = expectedEnd;
        }

        return {
            valid: errors.length === 0,
            frameCount,
            warnings,
            errors
        };

    } catch (error) {
        return {
            valid: false,
            frameCount,
            error: error.message,
            warnings,
            errors
        };
    }
}

/**
 * Parses multi-frame XYZ file content into an array of Structure objects
 *
 * Handles XYZ files containing multiple structures (trajectories, conformations).
 * Each structure includes the name from the comment line and frame index.
 *
 * @param {string} content - Raw XYZ file content
 * @param {string} [sourceName='unknown'] - Source filename for reference
 * @returns {Array<Structure>} Array of Structure objects
 * @throws {Error} If file format is invalid or no valid structures found
 *
 * @example
 * const content = `3
 * Water_conf1
 * O 0 0 0
 * H 0.96 0 0
 * H -0.24 0.93 0
 * 3
 * Water_conf2
 * O 0 0 0
 * H 0.96 0.1 0
 * H -0.24 0.93 0.1`;
 *
 * const structures = parseMultiXYZ(content, 'water.xyz');
 * // Returns: [
 * //   { name: 'Water_conf1', atoms: [...], format: 'xyz', frameIndex: 0, source: 'water.xyz' },
 * //   { name: 'Water_conf2', atoms: [...], format: 'xyz', frameIndex: 1, source: 'water.xyz' }
 * // ]
 */
export function parseMultiXYZ(content, sourceName = 'unknown') {
    const structures = [];

    try {
        const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
        let lineIndex = 0;
        let frameIndex = 0;

        while (lineIndex < lines.length) {
            // Parse atom count header
            const headerLine = lines[lineIndex]?.trim();
            if (!headerLine) break;

            const nAtoms = parseInt(headerLine, 10);
            if (!Number.isFinite(nAtoms) || nAtoms <= 0) {
                if (structures.length === 0) {
                    throw new Error("Invalid XYZ header: Atom count is missing or invalid.");
                }
                break; // End of valid frames
            }

            // Parse comment line (structure name)
            const commentLine = lines[lineIndex + 1]?.trim() || '';
            const name = commentLine || `Structure_${frameIndex + 1}`;

            // Parse atoms
            const atoms = [];
            const atomEndLine = Math.min(lineIndex + 2 + nAtoms, lines.length);

            for (let i = lineIndex + 2; i < atomEndLine; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length < 4) continue;

                const element = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);

                if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
                    console.warn(`Frame ${frameIndex + 1}: Skipping atom with invalid coordinates at line ${i + 1}`);
                    continue;
                }

                atoms.push({ element, x, y, z });
            }

            if (atoms.length > 0) {
                structures.push({
                    name,
                    atoms,
                    format: 'xyz',
                    frameIndex,
                    source: sourceName
                });
            }

            lineIndex = lineIndex + 2 + nAtoms;
            frameIndex++;
        }

        if (structures.length === 0) {
            throw new Error("No valid structures found in file");
        }

        return structures;

    } catch (error) {
        throw new Error(`Failed to parse multi-frame XYZ file: ${error.message}`);
    }
}

/**
 * Smart XYZ parser that handles both single and multi-frame files
 *
 * Automatically detects the file type and returns appropriate format.
 * For single-frame files, returns array with one structure for consistency.
 *
 * @param {string} content - Raw XYZ file content
 * @param {string} [sourceName='unknown'] - Source filename
 * @returns {Array<Structure>} Array of Structure objects (always array for consistency)
 */
export function parseXYZAuto(content, sourceName = 'unknown') {
    if (isMultiFrameXYZ(content)) {
        return parseMultiXYZ(content, sourceName);
    }

    // Single frame - wrap in structure format for consistency
    const atoms = parseXYZ(content);
    const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
    const name = lines[1]?.trim() || sourceName;

    return [{
        name,
        atoms,
        format: 'xyz',
        frameIndex: 0,
        source: sourceName
    }];
}

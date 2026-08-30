/**
 * Unified Input Parser for Q-Shape v1.5.0
 *
 * Parses XYZ (single/multi-frame) and CIF files into a unified Structure format.
 * This is the SINGLE entry point for all file parsing.
 *
 * Contract:
 * - Returns a ParseResult with structures[], warnings[], format, frameCount, valid
 * - Never throws exceptions - errors are captured in the result
 * - Correctly routes to XYZ or CIF parser based on file content/extension
 */

import { ATOMIC_DATA } from '../constants/atomicData.js';
import {
    createErrorResult,
    createSuccessResult,
    createStructure,
    generateStructureId,
    PARSE_CONFIG
} from '../types/structureTypes.js';

const FINITE_NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseFiniteNumberToken(value, allowCifUncertainty = false) {
    if (typeof value !== 'string') return NaN;
    let token = value.trim();
    if (allowCifUncertainty) token = token.replace(/\(\d+\)$/, '');
    if (!FINITE_NUMBER_TOKEN.test(token)) return NaN;
    const parsed = Number(token);
    return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Main entry point for file parsing
 *
 * @param {string} content - Raw file content
 * @param {string} filename - Original filename (used for format detection and IDs)
 * @returns {ParseResult} - Unified parse result
 */
export function parseInput(content, filename) {
    if (!content || typeof content !== 'string') {
        return createErrorResult('No file content provided');
    }

    if (!filename || typeof filename !== 'string') {
        return createErrorResult('No filename provided');
    }

    // Detect format based on extension and content
    const format = detectFormat(content, filename);

    if (format === 'cif') {
        return parseCIF(content, filename);
    } else if (format === 'xyz') {
        return parseXYZMultiFrame(content, filename);
    } else {
        return createErrorResult(`Unknown file format. Expected .xyz or .cif file.`);
    }
}

/**
 * Detect file format from content and filename
 *
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @returns {'xyz'|'cif'|'unknown'}
 */
export function detectFormat(content, filename) {
    const ext = filename.toLowerCase().split('.').pop();

    // Extension-based detection first
    if (ext === 'cif') {
        return 'cif';
    }
    if (ext === 'xyz') {
        return 'xyz';
    }

    // Content-based detection as fallback
    const trimmed = content.trim();

    // CIF files start with data_ or have characteristic CIF patterns
    if (trimmed.startsWith('data_') ||
        trimmed.includes('_cell_length_a') ||
        trimmed.includes('_atom_site_')) {
        return 'cif';
    }

    // XYZ files start with a number (atom count)
    const firstLine = trimmed.split('\n')[0].trim();
    if (/^\d+$/.test(firstLine)) {
        return 'xyz';
    }

    return 'unknown';
}

/**
 * Parse multi-frame XYZ content
 *
 * XYZ Format:
 * - Line 1: Atom count (positive integer)
 * - Line 2: Comment (can be anything, used for structure ID)
 * - Lines 3+: Element X Y Z [optional extra columns]
 * - Repeat for multiple frames
 *
 * @param {string} content - Raw XYZ content
 * @param {string} filename - Source filename
 * @returns {ParseResult}
 */
export function parseXYZMultiFrame(content, filename) {
    const structures = [];
    const warnings = [];

    try {
        // Normalize line endings and split
        const lines = content.replace(/\r\n?/g, '\n').split('\n');
        let lineIndex = 0;
        let frameIndex = 0;

        while (lineIndex < lines.length) {
            // Skip empty lines between frames
            while (lineIndex < lines.length && lines[lineIndex].trim() === '') {
                lineIndex++;
            }

            if (lineIndex >= lines.length) {
                break; // End of file
            }

            // Parse atom count
            const countLine = lines[lineIndex].trim();
            const atomCount = /^[1-9]\d*$/.test(countLine) ? Number(countLine) : NaN;

            if (!Number.isSafeInteger(atomCount) || atomCount <= 0) {
                if (structures.length === 0) {
                    // First frame must be valid
                    return createErrorResult(
                        `Invalid atom count in XYZ header at line ${lineIndex + 1}: "${countLine}". ` +
                        `Expected a positive integer.`
                    );
                } else {
                    // Subsequent frames: stop at last valid frame (tolerant mode)
                    if (!PARSE_CONFIG.STRICT_MODE) {
                        warnings.push(
                            `Stopped parsing at line ${lineIndex + 1}: invalid frame header. ` +
                            `${structures.length} frame(s) successfully parsed.`
                        );
                        break;
                    } else {
                        return createErrorResult(
                            `Invalid atom count at line ${lineIndex + 1} (frame ${frameIndex + 1})`
                        );
                    }
                }
            }

            lineIndex++;

            // Parse comment line
            if (lineIndex >= lines.length) {
                if (structures.length === 0) {
                    return createErrorResult('XYZ file missing comment line');
                }
                break;
            }
            const comment = lines[lineIndex].trim();
            lineIndex++;

            // Check if we have enough lines for atoms
            if (lineIndex + atomCount > lines.length) {
                if (structures.length === 0) {
                    return createErrorResult(
                        `XYZ file claims ${atomCount} atoms but only has ${lines.length - lineIndex} data lines remaining`
                    );
                } else {
                    warnings.push(
                        `Frame ${frameIndex + 1} incomplete: expected ${atomCount} atoms, ` +
                        `but only ${lines.length - lineIndex} lines remaining. Frame skipped.`
                    );
                    break;
                }
            }

            // Parse atoms
            const atoms = [];
            const frameWarnings = [];
            let hasLargeCoords = false;

            for (let i = 0; i < atomCount; i++) {
                const atomLine = lines[lineIndex + i].trim();
                const parts = atomLine.split(/\s+/);

                if (parts.length < 4) {
                    frameWarnings.push(
                        `Line ${lineIndex + i + 1}: Invalid format "${atomLine}" - expected "Element X Y Z"`
                    );
                    continue;
                }

                const [elementRaw, xStr, yStr, zStr] = parts;
                const element = normalizeElement(elementRaw);
                const x = parseFiniteNumberToken(xStr);
                const y = parseFiniteNumberToken(yStr);
                const z = parseFiniteNumberToken(zStr);

                if (!element) {
                    frameWarnings.push(
                        `Line ${lineIndex + i + 1}: Invalid element token "${elementRaw}"`
                    );
                    continue;
                }

                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                    frameWarnings.push(
                        `Line ${lineIndex + i + 1}: Non-numeric coordinates for ${elementRaw}`
                    );
                    continue;
                }

                // Check for unknown elements
                if (!ATOMIC_DATA[element]) {
                    frameWarnings.push(
                        `Line ${lineIndex + i + 1}: Unknown element "${elementRaw}" (will use defaults)`
                    );
                }

                // Check for large coordinates (unit mismatch warning)
                if (!hasLargeCoords &&
                    (Math.abs(x) > PARSE_CONFIG.MAX_COORD_MAGNITUDE ||
                     Math.abs(y) > PARSE_CONFIG.MAX_COORD_MAGNITUDE ||
                     Math.abs(z) > PARSE_CONFIG.MAX_COORD_MAGNITUDE)) {
                    hasLargeCoords = true;
                }

                atoms.push({ element, x, y, z });
            }

            lineIndex += atomCount;

            // Validate we got atoms
            if (atoms.length !== atomCount) {
                const invalidAtomCount = atomCount - atoms.length;
                const rejection = `Frame ${frameIndex + 1} rejected: ${invalidAtomCount} of ` +
                    `${atomCount} atom lines were invalid`;
                if (structures.length === 0) {
                    return createErrorResult(rejection);
                }
                warnings.push(...frameWarnings, `${rejection}. Frame skipped.`);
                frameIndex++;
                continue;
            }

            // Large structure warning (only once per file)
            if (atoms.length > PARSE_CONFIG.LARGE_STRUCTURE_WARNING && structures.length === 0) {
                warnings.push(
                    `Large structure detected (${atoms.length} atoms) - analysis may be slow`
                );
            }

            // Large coordinates warning
            if (hasLargeCoords) {
                frameWarnings.push(
                    `Frame ${frameIndex + 1}: Very large coordinates detected (may indicate unit mismatch)`
                );
            }

            // Generate structure ID
            const id = generateStructureId(filename, frameIndex, comment);

            // Create structure
            const structure = createStructure(id, filename, atoms, {
                comment,
                parseProvenance: 'xyz',
                warnings: frameWarnings.length > 0 ? frameWarnings : undefined
            });

            structures.push(structure);

            // Add frame warnings to global warnings
            if (frameWarnings.length > 0) {
                warnings.push(...frameWarnings);
            }

            frameIndex++;
        }

        if (structures.length === 0) {
            return createErrorResult('No valid structures found in XYZ file');
        }

        return createSuccessResult(structures, 'xyz', warnings);

    } catch (error) {
        return createErrorResult(`XYZ parsing failed: ${error.message}`);
    }
}

/**
 * Parse CIF content
 *
 * This basic importer accepts explicit Cartesian atom-site loops and converts
 * fractional atom-site coordinates with the CIF unit-cell matrix. Coordinates
 * are used as listed; crystallographic symmetry and periodic images are not
 * expanded.
 *
 * @param {string} content - Raw CIF content
 * @param {string} filename - Source filename
 * @returns {ParseResult}
 */
export function parseCIF(content, filename) {
    const structures = [];
    const warnings = [];

    try {
        // Split into data blocks
        const blocks = splitCIFBlocks(content);

        if (blocks.length === 0) {
            return createErrorResult('No valid data blocks found in CIF file');
        }

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
            const block = blocks[blockIndex];
            const blockResult = parseCIFBlock(block, filename, blockIndex);

            if (blockResult.valid) {
                structures.push(blockResult.structure);
                if (blockResult.warnings.length > 0) {
                    for (const warning of blockResult.warnings) {
                        if (!warnings.includes(warning)) warnings.push(warning);
                    }
                }
            } else {
                warnings.push(`Block ${blockIndex + 1} (${block.name}): ${blockResult.error}`);
            }
        }

        if (structures.length === 0) {
            return createErrorResult(
                'No valid structures found in CIF file. ' +
                'Ensure the file contains valid atom coordinates. ' +
                warnings.join('; ')
            );
        }

        return createSuccessResult(structures, 'cif', warnings);

    } catch (error) {
        return createErrorResult(`CIF parsing failed: ${error.message}`);
    }
}

/**
 * Split CIF content into data blocks
 *
 * @param {string} content - Raw CIF content
 * @returns {Array<{name: string, content: string}>}
 */
function splitCIFBlocks(content) {
    const blocks = [];
    const lines = content.split('\n');
    let currentBlock = null;
    let currentLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.toLowerCase().startsWith('data_')) {
            // Save previous block
            if (currentBlock !== null) {
                blocks.push({
                    name: currentBlock,
                    content: currentLines.join('\n')
                });
            }
            // Start new block
            currentBlock = trimmed.substring(5).trim() || `block_${blocks.length + 1}`;
            currentLines = [];
        } else if (currentBlock !== null) {
            currentLines.push(line);
        }
    }

    // Save last block
    if (currentBlock !== null) {
        blocks.push({
            name: currentBlock,
            content: currentLines.join('\n')
        });
    }

    return blocks;
}

/**
 * Parse a single CIF data block
 *
 * @param {{name: string, content: string}} block - CIF block
 * @param {string} filename - Source filename
 * @param {number} blockIndex - Block index
 * @returns {{valid: boolean, structure?: Structure, warnings: string[], error?: string}}
 */
function parseCIFBlock(block, filename, blockIndex) {
    const warnings = [];

    try {
        const lines = block.content.split('\n');

        // Extract unit cell parameters
        const unitCell = extractUnitCell(lines);

        const cartesianResult = extractCartesianAtoms(lines);
        const fractionalResult = extractFractionalAtoms(lines);

        let atoms;
        let parseProvenance;

        // Prefer explicit Cartesian coordinates when a CIF supplies both forms.
        if (cartesianResult.foundCoordinateLoop) {
            if (cartesianResult.invalidRows.length > 0) {
                return {
                    valid: false,
                    warnings,
                    error: `Cartesian atom-site loop rejected: ${cartesianResult.invalidRows.length} invalid row(s): ` +
                        cartesianResult.invalidRows.join('; ')
                };
            }

            if (cartesianResult.atoms.length === 0) {
                return {
                    valid: false,
                    warnings,
                    error: 'Cartesian atom-site loop contains no atom rows'
                };
            }

            atoms = cartesianResult.atoms;
            parseProvenance = 'cif-cartesian';
            warnings.push(
                'Basic Cartesian-coordinate CIF import: coordinates are used exactly as listed; crystallographic symmetry and periodic images are not expanded.'
            );
        } else if (fractionalResult.foundCoordinateLoop) {
            if (fractionalResult.invalidRows.length > 0) {
                return {
                    valid: false,
                    warnings,
                    error: `Fractional atom-site loop rejected: ${fractionalResult.invalidRows.length} invalid row(s): ` +
                        fractionalResult.invalidRows.join('; ')
                };
            }

            if (fractionalResult.atoms.length === 0) {
                return {
                    valid: false,
                    warnings,
                    error: 'Fractional atom-site loop contains no atom rows'
                };
            }

            if (!unitCell) {
                return {
                    valid: false,
                    warnings,
                    error: 'Fractional atom-site coordinates require complete, valid unit-cell lengths and angles'
                };
            }

            atoms = convertFractionalToCartesian(fractionalResult.atoms, unitCell);
            parseProvenance = 'cif-fractional-to-cartesian';
            warnings.push(
                'Fractional CIF coordinates were converted to Cartesian coordinates from the unit cell; crystallographic symmetry and periodic images are not expanded.'
            );
        } else {
            return {
                valid: false,
                warnings,
                error: 'No atom coordinates found in block'
            };
        }

        // Generate structure ID
        const id = blockIndex === 0 && block.name
            ? block.name
            : `${filename.replace(/\.cif$/i, '')}:${block.name || `block-${blockIndex + 1}`}`;

        // Extract space group if available
        const spaceGroup = extractValue(lines, '_symmetry_space_group_name_H-M') ||
                          extractValue(lines, '_space_group_name_H-M_alt');

        const structure = createStructure(id, filename, atoms, {
            unitCell,
            spaceGroup: spaceGroup || undefined,
            parseProvenance,
            warnings: warnings.length > 0 ? warnings : undefined
        });

        return {
            valid: true,
            structure,
            warnings
        };

    } catch (error) {
        return {
            valid: false,
            warnings,
            error: error.message
        };
    }
}

/**
 * Extract unit cell parameters from CIF lines
 *
 * @param {string[]} lines - CIF content lines
 * @returns {UnitCell|null}
 */
function extractUnitCell(lines) {
    const a = parseFiniteNumberToken(extractValue(lines, '_cell_length_a'), true);
    const b = parseFiniteNumberToken(extractValue(lines, '_cell_length_b'), true);
    const c = parseFiniteNumberToken(extractValue(lines, '_cell_length_c'), true);
    const alpha = parseFiniteNumberToken(extractValue(lines, '_cell_angle_alpha'), true);
    const beta = parseFiniteNumberToken(extractValue(lines, '_cell_angle_beta'), true);
    const gamma = parseFiniteNumberToken(extractValue(lines, '_cell_angle_gamma'), true);

    if ([a, b, c, alpha, beta, gamma].every(Number.isFinite)) {
        return {
            a, b, c,
            alpha,
            beta,
            gamma
        };
    }

    return null;
}

/**
 * Extract a simple CIF value
 *
 * @param {string[]} lines - CIF lines
 * @param {string} key - CIF key to find
 * @returns {string|null}
 */
function extractValue(lines, key) {
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith(key.toLowerCase())) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                return parts[1];
            }
        }
    }
    return null;
}

/**
 * Extract fractional coordinates from CIF loop
 *
 * @param {string[]} lines - CIF lines
 * @returns {{atoms: Array<{element: string, x: number, y: number, z: number}>, foundCoordinateLoop: boolean, invalidRows: string[]}}
 */
function extractFractionalAtoms(lines) {
    return extractAtomLoop(lines, [
        '_atom_site_fract_x',
        '_atom_site_fract_y',
        '_atom_site_fract_z'
    ]);
}

/**
 * Extract Cartesian coordinates from CIF loop
 *
 * @param {string[]} lines - CIF lines
 * @returns {{atoms: Array<{element: string, x: number, y: number, z: number}>, foundCoordinateLoop: boolean, invalidRows: string[]}}
 */
function extractCartesianAtoms(lines) {
    return extractAtomLoop(lines, [
        '_atom_site_Cartn_x',
        '_atom_site_Cartn_y',
        '_atom_site_Cartn_z'
    ]);
}

/**
 * Extract atoms from a CIF loop with specified coordinate columns
 *
 * @param {string[]} lines - CIF lines
 * @param {string[]} coordKeys - Keys for x, y, z coordinates
 * @returns {{atoms: Array<{element: string, x: number, y: number, z: number}>, foundCoordinateLoop: boolean, invalidRows: string[]}}
 */
function extractAtomLoop(lines, coordKeys) {
    const atoms = [];
    const invalidRows = [];
    let foundCoordinateLoop = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.toLowerCase() !== 'loop_') continue;

        const columns = [];
        let cursor = i + 1;
        while (cursor < lines.length && lines[cursor].trim().startsWith('_')) {
            columns.push(lines[cursor].trim().split(/\s+/)[0].toLowerCase());
            cursor++;
        }

        const symbolCol = columns.indexOf('_atom_site_type_symbol');
        const elementCol = columns.indexOf('_atom_site_label');
        const xCol = columns.indexOf(coordKeys[0].toLowerCase());
        const yCol = columns.indexOf(coordKeys[1].toLowerCase());
        const zCol = columns.indexOf(coordKeys[2].toLowerCase());

        if (xCol === -1 || yCol === -1 || zCol === -1) {
            i = cursor - 1;
            continue;
        }

        foundCoordinateLoop = true;
        for (; cursor < lines.length; cursor++) {
            const row = lines[cursor].trim();
            const lowerRow = row.toLowerCase();
            if (row === '' || row.startsWith('#')) continue;
            if (row.startsWith('_') || lowerRow === 'loop_' || lowerRow === 'stop_' ||
                lowerRow.startsWith('data_') || lowerRow.startsWith('save_')) {
                break;
            }

            const parts = parseLoopLine(row);
            if (parts.length !== columns.length) {
                invalidRows.push(`line ${cursor + 1} has ${parts.length} fields; expected ${columns.length}`);
                continue;
            }

            let element = '';
            if (symbolCol >= 0 && parts[symbolCol]) {
                element = normalizeElement(parts[symbolCol]);
            } else if (elementCol >= 0 && parts[elementCol]) {
                const match = parts[elementCol].match(/^([A-Za-z]+)/);
                if (match) element = normalizeElement(match[1]);
            }

            const x = parseFiniteNumberToken(parts[xCol], true);
            const y = parseFiniteNumberToken(parts[yCol], true);
            const z = parseFiniteNumberToken(parts[zCol], true);

            if (!element || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                invalidRows.push(`line ${cursor + 1} has an invalid element or coordinate token`);
                continue;
            }

            atoms.push({ element, x, y, z });
        }

        i = cursor - 1;
    }

    return { atoms, foundCoordinateLoop, invalidRows };
}

/**
 * Parse a CIF loop data line, handling quoted strings
 *
 * @param {string} line - Data line
 * @returns {string[]} - Parsed values
 */
function parseLoopLine(line) {
    const parts = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (!inQuote && (char === '"' || char === "'")) {
            inQuote = true;
            quoteChar = char;
        } else if (inQuote && char === quoteChar) {
            inQuote = false;
            parts.push(current);
            current = '';
        } else if (!inQuote && /\s/.test(char)) {
            if (current.length > 0) {
                parts.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        parts.push(current);
    }

    return parts;
}

/**
 * Convert fractional atom-site coordinates to Cartesian coordinates.
 *
 * Uses the standard crystallographic unit-cell transformation matrix. This
 * conversion does not apply symmetry operators or generate periodic images.
 *
 * @param {Array<{element: string, x: number, y: number, z: number}>} fractionalAtoms
 * @param {UnitCell} cell
 * @returns {Array<{element: string, x: number, y: number, z: number}>}
 */
function convertFractionalToCartesian(fractionalAtoms, cell) {
    const { a, b, c, alpha, beta, gamma } = cell;
    if (![a, b, c].every(length => Number.isFinite(length) && length > 0) ||
        ![alpha, beta, gamma].every(angle => Number.isFinite(angle) && angle > 0 && angle < 180)) {
        throw new Error('Unit-cell lengths and angles are invalid');
    }

    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;
    const gammaRad = gamma * Math.PI / 180;
    const cosAlpha = Math.cos(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const cosGamma = Math.cos(gammaRad);
    const sinGamma = Math.sin(gammaRad);
    const volumeFactorSquared = 1 - cosAlpha * cosAlpha - cosBeta * cosBeta -
        cosGamma * cosGamma + 2 * cosAlpha * cosBeta * cosGamma;

    if (Math.abs(sinGamma) < 1e-12 || volumeFactorSquared <= 1e-12) {
        throw new Error('Unit-cell angles define a degenerate cell');
    }

    const volumeFactor = Math.sqrt(volumeFactorSquared);
    const m11 = a;
    const m12 = b * cosGamma;
    const m13 = c * cosBeta;
    const m22 = b * sinGamma;
    const m23 = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
    const m33 = c * volumeFactor / sinGamma;

    return fractionalAtoms.map(atom => ({
        element: atom.element,
        x: m11 * atom.x + m12 * atom.y + m13 * atom.z,
        y: m22 * atom.y + m23 * atom.z,
        z: m33 * atom.z
    }));
}

/**
 * Normalize element symbol
 *
 * @param {string} element - Raw element string
 * @returns {string} - Normalized element (e.g., "FE" -> "Fe")
 */
function normalizeElement(element) {
    if (!element || typeof element !== 'string') {
        return '';
    }
    // Accept only a bounded chemical-symbol token, optionally followed by one
    // conventional charge suffix such as Fe2+, N3-, Na+, or Cu+2. Arbitrary
    // markup, control syntax, and repeated/mixed signs are rejected.
    const match = element.match(/^([A-Za-z]{1,3})(?:(?:[0-9]+[+-])|(?:[+-][0-9]*))?$/);
    if (!match) return '';
    const cleaned = match[1];
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

// Re-export legacy functions for backwards compatibility
export { parseXYZMultiFrame as parseXYZ };

/**
 * CIF File Parser Utilities
 *
 * Provides functionality for parsing Crystallographic Information Files (CIF).
 * Uses crystcif-parse library for parsing and coordinate conversion.
 *
 * CIF format is a standard file format for crystallographic data, containing
 * unit cell parameters, space group information, and atomic coordinates
 * (either fractional or Cartesian).
 */

import { parseCifStructures } from 'crystcif-parse';

/**
 * Validates CIF file content before parsing
 *
 * Performs basic validation to ensure the content appears to be valid CIF format.
 * More detailed validation happens during parsing.
 *
 * @param {string} content - Raw CIF file content
 * @returns {Object} Validation result:
 *   - valid: boolean - Whether file appears to be valid CIF
 *   - error: string - Error message if invalid
 *   - warnings: Array<string> - Non-fatal warnings
 *   - blockCount: number - Number of data blocks detected
 */
export function validateCIF(content) {
    const warnings = [];

    try {
        // Basic CIF format checks
        if (!content || typeof content !== 'string') {
            throw new Error('CIF content is empty or invalid');
        }

        const trimmedContent = content.trim();

        // CIF files should start with data_ or have data_ blocks
        if (!trimmedContent.includes('data_')) {
            throw new Error('Invalid CIF format: No data_ block found');
        }

        // Count data blocks
        const dataBlockMatches = trimmedContent.match(/^data_/gm);
        const blockCount = dataBlockMatches ? dataBlockMatches.length : 0;

        if (blockCount === 0) {
            throw new Error('Invalid CIF format: No valid data blocks found');
        }

        // Check for atom site data (required for structure)
        const hasAtomSite = trimmedContent.includes('_atom_site_');
        if (!hasAtomSite) {
            warnings.push('No _atom_site_ tags found - file may not contain atomic coordinates');
        }

        // Check for cell parameters
        const hasCellParams = trimmedContent.includes('_cell_length_');
        if (!hasCellParams && hasAtomSite) {
            warnings.push('No cell parameters found - fractional coordinates may not convert correctly');
        }

        // Try to parse to catch any format errors
        try {
            const structures = parseCifStructures(trimmedContent);
            const structureCount = Object.keys(structures).length;

            if (structureCount === 0) {
                throw new Error('No valid structures could be extracted from CIF file');
            }

            if (structureCount !== blockCount) {
                warnings.push(`Found ${blockCount} data blocks but only ${structureCount} contain valid structures`);
            }

        } catch (parseError) {
            throw new Error(`CIF parsing failed: ${parseError.message}`);
        }

        return {
            valid: true,
            warnings,
            blockCount
        };

    } catch (error) {
        return {
            valid: false,
            error: error.message,
            warnings,
            blockCount: 0
        };
    }
}

/**
 * Parses CIF file content into an array of Structure objects
 *
 * Extracts atomic coordinates from CIF files, automatically converting
 * fractional coordinates to Cartesian using unit cell parameters.
 * Handles multiple data blocks in a single CIF file.
 *
 * @param {string} content - Raw CIF file content
 * @param {string} [sourceName='unknown'] - Source filename for reference
 * @returns {Array<Structure>} Array of Structure objects with properties:
 *   - name: string - Data block name from CIF
 *   - atoms: Array<{element, x, y, z}> - Atoms with Cartesian coordinates (Å)
 *   - format: 'cif' - File format identifier
 *   - source: string - Source filename
 *   - metadata: Object - Additional CIF metadata (cell params, space group)
 * @throws {Error} If file format is invalid or no valid structures found
 *
 * @example
 * const cifContent = `data_example
 * _cell_length_a 10.0
 * _cell_length_b 10.0
 * _cell_length_c 10.0
 * ...`;
 *
 * const structures = parseCIF(cifContent, 'example.cif');
 * // Returns array of Structure objects with Cartesian coordinates
 */
export function parseCIF(content, sourceName = 'unknown') {
    try {
        // Parse using crystcif-parse
        const parsedStructures = parseCifStructures(content);
        const blockNames = Object.keys(parsedStructures);

        if (blockNames.length === 0) {
            throw new Error('No valid structures found in CIF file');
        }

        const structures = [];

        for (let i = 0; i < blockNames.length; i++) {
            const blockName = blockNames[i];
            const atomsObj = parsedStructures[blockName];

            try {
                // Get Cartesian coordinates (crystcif-parse handles conversion)
                const positions = atomsObj.get_positions();
                const elements = atomsObj.get_chemical_symbols();

                if (!positions || !elements || positions.length === 0) {
                    console.warn(`CIF block "${blockName}": No atomic positions found, skipping`);
                    continue;
                }

                // Build atoms array
                const atoms = [];
                for (let j = 0; j < elements.length; j++) {
                    const element = normalizeElement(elements[j]);
                    const [x, y, z] = positions[j];

                    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
                        console.warn(`CIF block "${blockName}": Skipping atom ${j + 1} with invalid coordinates`);
                        continue;
                    }

                    atoms.push({ element, x, y, z });
                }

                if (atoms.length === 0) {
                    console.warn(`CIF block "${blockName}": No valid atoms after parsing, skipping`);
                    continue;
                }

                // Extract metadata if available
                const metadata = extractCIFMetadata(atomsObj);

                structures.push({
                    name: blockName,
                    atoms,
                    format: 'cif',
                    frameIndex: i,
                    source: sourceName,
                    metadata
                });

            } catch (blockError) {
                console.warn(`CIF block "${blockName}": Failed to parse - ${blockError.message}`);
                continue;
            }
        }

        if (structures.length === 0) {
            throw new Error('No valid structures could be extracted from CIF file');
        }

        return structures;

    } catch (error) {
        throw new Error(`Failed to parse CIF file: ${error.message}`);
    }
}

/**
 * Normalizes element symbol to proper case (Fe, not FE or fe)
 *
 * @param {string} element - Element symbol
 * @returns {string} Normalized element symbol
 */
function normalizeElement(element) {
    if (!element || typeof element !== 'string') return 'X';
    // Handle common variations and strip numbers (e.g., "Fe1" -> "Fe")
    const cleaned = element.replace(/[0-9+-]/g, '').trim();
    if (cleaned.length === 0) return 'X';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/**
 * Extracts metadata from parsed CIF structure
 *
 * @param {Object} atomsObj - Parsed atoms object from crystcif-parse
 * @returns {Object} Metadata object with available properties
 */
function extractCIFMetadata(atomsObj) {
    const metadata = {};

    try {
        // Try to get cell parameters
        if (atomsObj.get_cell) {
            const cell = atomsObj.get_cell();
            if (cell) {
                metadata.cell = cell;
            }
        }

        // Try to get cell lengths and angles
        if (atomsObj.get_cell_lengths_and_angles) {
            const cellParams = atomsObj.get_cell_lengths_and_angles();
            if (cellParams) {
                metadata.cellLengths = cellParams.slice(0, 3);
                metadata.cellAngles = cellParams.slice(3, 6);
            }
        }

        // Try to get space group info
        if (atomsObj.info) {
            if (atomsObj.info.spacegroup) {
                metadata.spacegroup = atomsObj.info.spacegroup;
            }
        }

    } catch (e) {
        // Metadata extraction is optional, don't fail
        console.debug('Could not extract all CIF metadata:', e.message);
    }

    return metadata;
}

/**
 * Detects if content is likely a CIF file
 *
 * @param {string} content - File content
 * @returns {boolean} True if content appears to be CIF format
 */
export function isCIFContent(content) {
    if (!content || typeof content !== 'string') return false;

    const trimmed = content.trim();

    // CIF files typically start with data_ or have it early
    if (trimmed.startsWith('data_')) return true;

    // Check first 500 chars for data_ block
    const header = trimmed.slice(0, 500);
    return header.includes('data_') && header.includes('_');
}

/**
 * Gets information about CIF file without full parsing
 *
 * @param {string} content - CIF file content
 * @returns {Object} Quick info about the CIF file
 */
export function getCIFInfo(content) {
    const info = {
        blockCount: 0,
        blockNames: [],
        hasAtomSites: false,
        hasCellParams: false
    };

    try {
        // Count and extract data block names
        const blockMatches = content.match(/data_(\S+)/g);
        if (blockMatches) {
            info.blockNames = blockMatches.map(m => m.replace('data_', ''));
            info.blockCount = info.blockNames.length;
        }

        info.hasAtomSites = content.includes('_atom_site_');
        info.hasCellParams = content.includes('_cell_length_');

    } catch (e) {
        // Silent fail for info extraction
    }

    return info;
}

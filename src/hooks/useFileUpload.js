/**
 * useFileUpload Hook
 *
 * Manages file upload, validation, and parsing for molecular structure files.
 * Supports XYZ (single and multi-frame) and CIF file formats.
 * Handles multiple file uploads simultaneously.
 *
 * @returns {Object} File upload state and handlers
 * @returns {Array} structures - Array of parsed Structure objects
 * @returns {Array} atoms - Atoms from currently selected structure (backwards compatible)
 * @returns {number} selectedStructureIndex - Index of currently selected structure
 * @returns {String} fileName - Name(s) of uploaded file(s)
 * @returns {String|null} error - Error message if upload/parsing failed
 * @returns {Array} warnings - Array of warning messages
 * @returns {Object} uploadMetadata - Metadata about the upload
 * @returns {Function} handleFileUpload - File upload event handler
 * @returns {Function} selectStructure - Select a structure by index
 * @returns {Function} resetFileState - Reset all file-related state
 *
 * @example
 * const { structures, atoms, handleFileUpload, selectStructure } = useFileUpload();
 *
 * // In JSX - supports multiple files and both formats:
 * <input type="file" accept=".xyz,.cif" multiple onChange={handleFileUpload} />
 */

import { useState, useCallback, useMemo } from 'react';
import {
    parseXYZ,
    validateXYZ,
    parseXYZAuto,
    isMultiFrameXYZ,
    validateMultiXYZ
} from '../utils/fileParser';
import { parseCIF, validateCIF, isCIFContent } from '../utils/cifParser';
import { detectMetalCenter } from '../services/coordination/metalDetector';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';

/**
 * Determines file format from filename extension
 * @param {string} filename - Filename with extension
 * @returns {'xyz'|'cif'|'unknown'} File format
 */
function getFileFormat(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'xyz') return 'xyz';
    if (ext === 'cif') return 'cif';
    return 'unknown';
}

export function useFileUpload() {
    // Multi-structure state
    const [structures, setStructures] = useState([]);
    const [selectedStructureIndex, setSelectedStructureIndex] = useState(0);

    // Legacy state (maintained for backwards compatibility)
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [uploadMetadata, setUploadMetadata] = useState(null);

    // Computed: atoms from currently selected structure (backwards compatible)
    const atoms = useMemo(() => {
        if (structures.length === 0) return [];
        const selected = structures[selectedStructureIndex];
        return selected?.atoms || [];
    }, [structures, selectedStructureIndex]);

    // Computed: current structure info
    const currentStructure = useMemo(() => {
        if (structures.length === 0) return null;
        return structures[selectedStructureIndex] || null;
    }, [structures, selectedStructureIndex]);

    /**
     * Process a single file content
     */
    const processFileContent = useCallback((content, filename) => {
        const format = getFileFormat(filename);
        const sourceName = filename.replace(/\.(xyz|cif)$/i, "");
        const fileWarnings = [];

        // Auto-detect format if unknown
        let detectedFormat = format;
        if (format === 'unknown') {
            if (isCIFContent(content)) {
                detectedFormat = 'cif';
            } else {
                detectedFormat = 'xyz'; // Default to XYZ
            }
            fileWarnings.push(`Unknown file extension, detected as ${detectedFormat.toUpperCase()}`);
        }

        if (detectedFormat === 'cif') {
            // Validate and parse CIF
            const validation = validateCIF(content);
            if (!validation.valid) {
                throw new Error(`${filename}: ${validation.error}`);
            }
            if (validation.warnings) {
                fileWarnings.push(...validation.warnings.map(w => `${filename}: ${w}`));
            }

            const cifStructures = parseCIF(content, sourceName);
            return { structures: cifStructures, warnings: fileWarnings };

        } else {
            // XYZ format - check for multi-frame
            if (isMultiFrameXYZ(content)) {
                const validation = validateMultiXYZ(content);
                if (!validation.valid) {
                    throw new Error(`${filename}: ${validation.error || validation.errors?.[0]?.error}`);
                }
                if (validation.warnings) {
                    fileWarnings.push(...validation.warnings.map(w => `${filename}: ${w}`));
                }

                const xyzStructures = parseXYZAuto(content, sourceName);
                return { structures: xyzStructures, warnings: fileWarnings };

            } else {
                // Single-frame XYZ
                const validation = validateXYZ(content);
                if (!validation.valid) {
                    throw new Error(`${filename}: ${validation.error}`);
                }
                if (validation.warnings) {
                    fileWarnings.push(...validation.warnings.map(w => `${filename}: ${w}`));
                }

                const xyzStructures = parseXYZAuto(content, sourceName);
                return { structures: xyzStructures, warnings: fileWarnings };
            }
        }
    }, []);

    /**
     * Handle file upload - supports single or multiple files
     */
    const handleFileUpload = useCallback((e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Reset state
        setError(null);
        setWarnings([]);
        setStructures([]);
        setSelectedStructureIndex(0);

        // Build filename string
        const fileNames = Array.from(files).map(f => f.name.replace(/\.(xyz|cif)$/i, ""));
        setFileName(fileNames.join(', '));

        // Process all files
        const allStructures = [];
        const allWarnings = [];
        const readPromises = [];

        Array.from(files).forEach((file) => {
            const promise = new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = (ev) => {
                    try {
                        const content = String(ev.target?.result || "");
                        const result = processFileContent(content, file.name);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                };

                reader.onerror = () => {
                    reject(new Error(`Failed to read ${file.name}`));
                };

                reader.readAsText(file);
            });

            readPromises.push(promise);
        });

        // Wait for all files to be processed
        Promise.all(readPromises)
            .then((results) => {
                results.forEach(result => {
                    allStructures.push(...result.structures);
                    allWarnings.push(...result.warnings);
                });

                if (allStructures.length === 0) {
                    throw new Error("No valid structures found in uploaded files");
                }

                setStructures(allStructures);
                setWarnings(allWarnings);
                setSelectedStructureIndex(0);

                // Auto-detect metal for first structure
                const firstStructure = allStructures[0];
                const metalIdx = detectMetalCenter(firstStructure.atoms);

                let optimalRadius = 3.0;
                if (metalIdx != null && firstStructure.atoms[metalIdx]) {
                    optimalRadius = detectOptimalRadius(firstStructure.atoms[metalIdx], firstStructure.atoms);
                }

                setUploadMetadata({
                    detectedMetalIndex: metalIdx,
                    suggestedRadius: optimalRadius,
                    atomCount: firstStructure.atoms.length,
                    structureCount: allStructures.length,
                    uploadTime: Date.now(),
                    fileCount: files.length,
                    formats: [...new Set(allStructures.map(s => s.format))]
                });

            })
            .catch((err) => {
                console.error("File upload error:", err);
                setError(err.message);
                setStructures([]);
                setUploadMetadata(null);
            });

    }, [processFileContent]);

    /**
     * Select a structure by index
     */
    const selectStructure = useCallback((index) => {
        if (index < 0 || index >= structures.length) {
            console.warn(`Invalid structure index: ${index}`);
            return;
        }

        setSelectedStructureIndex(index);

        // Update metadata for the newly selected structure
        const selected = structures[index];
        if (selected) {
            const metalIdx = detectMetalCenter(selected.atoms);
            let optimalRadius = 3.0;
            if (metalIdx != null && selected.atoms[metalIdx]) {
                optimalRadius = detectOptimalRadius(selected.atoms[metalIdx], selected.atoms);
            }

            setUploadMetadata(prev => ({
                ...prev,
                detectedMetalIndex: metalIdx,
                suggestedRadius: optimalRadius,
                atomCount: selected.atoms.length,
                currentStructureName: selected.name,
                currentStructureFormat: selected.format
            }));
        }
    }, [structures]);

    /**
     * Reset all file-related state
     */
    const resetFileState = useCallback(() => {
        setStructures([]);
        setSelectedStructureIndex(0);
        setFileName("");
        setError(null);
        setWarnings([]);
        setUploadMetadata(null);
    }, []);

    /**
     * Legacy single-file upload handler (for backwards compatibility)
     * Use handleFileUpload for new code
     */
    const handleSingleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset state
        setError(null);
        setWarnings([]);
        setFileName(file.name.replace(/\.(xyz|cif)$/i, ""));

        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || "");

                // Use legacy XYZ-only path for backwards compatibility
                const validation = validateXYZ(content);

                if (!validation.valid) {
                    throw new Error(validation.error);
                }

                if (validation.warnings && validation.warnings.length > 0) {
                    setWarnings(validation.warnings);
                }

                const parsedAtoms = parseXYZ(content);

                // Wrap in structure format
                setStructures([{
                    name: file.name.replace(/\.xyz$/i, ""),
                    atoms: parsedAtoms,
                    format: 'xyz',
                    frameIndex: 0,
                    source: file.name
                }]);
                setSelectedStructureIndex(0);

                const metalIdx = detectMetalCenter(parsedAtoms);
                let optimalRadius = 3.0;
                if (metalIdx != null && parsedAtoms[metalIdx]) {
                    optimalRadius = detectOptimalRadius(parsedAtoms[metalIdx], parsedAtoms);
                }

                setUploadMetadata({
                    detectedMetalIndex: metalIdx,
                    suggestedRadius: optimalRadius,
                    atomCount: parsedAtoms.length,
                    structureCount: 1,
                    uploadTime: Date.now()
                });

            } catch (err) {
                console.error("File upload error:", err);
                setError(err.message);
                setStructures([]);
                setUploadMetadata(null);
            }
        };

        reader.onerror = () => {
            const errorMsg = "Failed to read file - please check file permissions and try again";
            setError(errorMsg);
            setStructures([]);
            setUploadMetadata(null);
        };

        reader.readAsText(file);
    }, []);

    return {
        // Multi-structure API
        structures,
        selectedStructureIndex,
        currentStructure,
        selectStructure,

        // Backwards compatible API
        atoms,
        fileName,
        error,
        warnings,
        uploadMetadata,

        // Handlers
        handleFileUpload,
        handleSingleFileUpload, // Legacy handler
        resetFileState
    };
}

export default useFileUpload;

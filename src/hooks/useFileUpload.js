/**
 * useFileUpload Hook - v1.5.0
 *
 * Manages file upload, validation, and parsing for molecular structure files.
 * Supports XYZ (single/multi-frame) and CIF formats.
 *
 * v1.5.0 Changes:
 * - Uses unified parseInput API
 * - Supports multiple structures (batch mode)
 * - Returns structures[] instead of single atoms[]
 * - Auto-detects batch mode based on structure count
 *
 * @returns {Object} File upload state and handlers
 */

import { useState, useCallback } from 'react';
import { parseInput } from '../utils/parseInput';
import { detectMetalCenter } from '../services/coordination/metalDetector';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';
import { isBatchMode } from '../types/structureTypes';

export function useFileUpload() {
    // Core state
    const [structures, setStructures] = useState([]);
    const [selectedStructureIndex, setSelectedStructureIndex] = useState(0);
    const [fileName, setFileName] = useState("");
    const [fileFormat, setFileFormat] = useState(null);
    const [error, setError] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [uploadMetadata, setUploadMetadata] = useState(null);

    // Derived state helper
    const currentStructure = structures.length > 0 ? structures[selectedStructureIndex] : null;
    const atoms = currentStructure ? currentStructure.atoms : [];
    const batchMode = isBatchMode(structures);

    /**
     * Handle file upload event
     */
    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset all state for new upload
        setError(null);
        setWarnings([]);
        setStructures([]);
        setSelectedStructureIndex(0);
        setFileFormat(null);
        setUploadMetadata(null);

        // Store filename without extension
        const baseName = file.name.replace(/\.(xyz|cif)$/i, "");
        setFileName(baseName);

        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || "");

                // Use unified parser
                const result = parseInput(content, file.name);

                if (!result.valid) {
                    throw new Error(result.error);
                }

                // Set warnings from parsing
                if (result.warnings && result.warnings.length > 0) {
                    setWarnings(result.warnings);
                }

                // Store structures
                setStructures(result.structures);
                setFileFormat(result.format);

                // Auto-detect metal and radius for first structure
                const firstStructure = result.structures[0];
                const firstAtoms = firstStructure.atoms;

                const metalIdx = detectMetalCenter(firstAtoms);
                let optimalRadius = 3.0; // default

                if (metalIdx != null && firstAtoms[metalIdx]) {
                    optimalRadius = detectOptimalRadius(firstAtoms[metalIdx], firstAtoms);
                }

                // Calculate per-structure metadata
                const structureMetadata = result.structures.map((struct, index) => {
                    const structAtoms = struct.atoms;
                    const structMetal = detectMetalCenter(structAtoms);
                    let structRadius = 3.0;

                    if (structMetal != null && structAtoms[structMetal]) {
                        structRadius = detectOptimalRadius(structAtoms[structMetal], structAtoms);
                    }

                    return {
                        index,
                        id: struct.id,
                        detectedMetalIndex: structMetal,
                        suggestedRadius: structRadius,
                        atomCount: structAtoms.length
                    };
                });

                // Store upload metadata
                setUploadMetadata({
                    detectedMetalIndex: metalIdx,
                    suggestedRadius: optimalRadius,
                    atomCount: firstAtoms.length,
                    uploadTime: Date.now(),
                    format: result.format,
                    frameCount: result.frameCount,
                    isBatchMode: isBatchMode(result.structures),
                    structureMetadata
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

    /**
     * Select a structure by index (for batch mode)
     */
    const selectStructure = useCallback((index) => {
        if (index >= 0 && index < structures.length) {
            setSelectedStructureIndex(index);
        }
    }, [structures.length]);

    /**
     * Select a structure by ID
     */
    const selectStructureById = useCallback((id) => {
        const index = structures.findIndex(s => s.id === id);
        if (index >= 0) {
            setSelectedStructureIndex(index);
        }
    }, [structures]);

    /**
     * Reset all file-related state
     */
    const resetFileState = useCallback(() => {
        setStructures([]);
        setSelectedStructureIndex(0);
        setFileName("");
        setFileFormat(null);
        setError(null);
        setWarnings([]);
        setUploadMetadata(null);
    }, []);

    /**
     * Get metadata for a specific structure
     */
    const getStructureMetadata = useCallback((index) => {
        if (uploadMetadata && uploadMetadata.structureMetadata) {
            return uploadMetadata.structureMetadata[index];
        }
        return null;
    }, [uploadMetadata]);

    return {
        // Core data
        structures,
        atoms, // Current structure's atoms (for backwards compatibility)
        currentStructure,
        selectedStructureIndex,
        fileName,
        fileFormat,
        error,
        warnings,
        uploadMetadata,

        // Batch mode helpers
        batchMode,
        structureCount: structures.length,

        // Actions
        handleFileUpload,
        selectStructure,
        selectStructureById,
        resetFileState,
        getStructureMetadata,

        // Legacy compatibility
        setWarnings
    };
}

export default useFileUpload;

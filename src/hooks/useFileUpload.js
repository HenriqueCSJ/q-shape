/**
 * useFileUpload Hook
 *
 * Manages file upload, validation, and parsing for molecular structure files.
 * Handles XYZ file format with comprehensive validation and error handling.
 *
 * @returns {Object} File upload state and handlers
 * @returns {Array} atoms - Parsed molecular structure
 * @returns {String} fileName - Name of uploaded file (without .xyz extension)
 * @returns {String|null} error - Error message if upload/parsing failed
 * @returns {Array} warnings - Array of warning messages
 * @returns {Function} handleFileUpload - File upload event handler
 * @returns {Function} resetFileState - Reset all file-related state
 *
 * @example
 * const { atoms, fileName, error, warnings, handleFileUpload } = useFileUpload();
 *
 * // In JSX:
 * <input type="file" accept=".xyz" onChange={handleFileUpload} />
 */

import { useState, useCallback } from 'react';
import { parseXYZ, validateXYZ } from '../utils/fileParser';
import { detectMetalCenter } from '../services/coordination/metalDetector';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';

export function useFileUpload() {
    const [atoms, setAtoms] = useState([]);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [uploadMetadata, setUploadMetadata] = useState(null);

    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset state
        setError(null);
        setWarnings([]);
        setFileName(file.name.replace(/\.xyz$/i, ""));

        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || "");

                // Validate XYZ file
                const validation = validateXYZ(content);

                if (!validation.valid) {
                    throw new Error(validation.error);
                }

                if (validation.warnings && validation.warnings.length > 0) {
                    setWarnings(validation.warnings);
                }

                // Parse atoms
                const parsedAtoms = parseXYZ(content);
                setAtoms(parsedAtoms);

                // Auto-detect metal center
                const metalIdx = detectMetalCenter(parsedAtoms);

                // Calculate optimal radius if metal found
                let optimalRadius = 3.0; // default
                if (metalIdx != null && parsedAtoms[metalIdx]) {
                    optimalRadius = detectOptimalRadius(parsedAtoms[metalIdx], parsedAtoms);
                }

                // Store metadata for parent component
                setUploadMetadata({
                    detectedMetalIndex: metalIdx,
                    suggestedRadius: optimalRadius,
                    atomCount: parsedAtoms.length,
                    uploadTime: Date.now()
                });

            } catch (err) {
                console.error("File upload error:", err);
                setError(err.message);
                setAtoms([]);
                setUploadMetadata(null);
            }
        };

        reader.onerror = () => {
            const errorMsg = "Failed to read file - please check file permissions and try again";
            setError(errorMsg);
            setAtoms([]);
            setUploadMetadata(null);
        };

        reader.readAsText(file);
    }, []);

    const resetFileState = useCallback(() => {
        setAtoms([]);
        setFileName("");
        setError(null);
        setWarnings([]);
        setUploadMetadata(null);
    }, []);

    return {
        atoms,
        fileName,
        error,
        warnings,
        uploadMetadata,
        handleFileUpload,
        resetFileState
    };
}

export default useFileUpload;

/**
 * useRadiusControl Hook (v1.1.0)
 *
 * Manages coordination radius control state and provides handlers for:
 * - Precise radius input with text field
 * - Step-based radius adjustment
 * - Find optimal radius for target coordination number
 *
 * @param {Object} params - Hook parameters
 * @param {Number} params.initialRadius - Initial radius value (default: 3.0)
 * @param {Array} params.atoms - Molecular structure
 * @param {Number} params.selectedMetal - Selected metal center index
 * @param {Function} params.onRadiusChange - Callback when radius changes
 * @param {Function} params.onWarning - Callback for warning messages
 *
 * @returns {Object} Radius control state and handlers
 *
 * @example
 * const {
 *   coordRadius,
 *   autoRadius,
 *   radiusInput,
 *   radiusStep,
 *   targetCNInput,
 *   handleRadiusInputChange,
 *   handleRadiusStepChange,
 *   handleFindRadiusForCN,
 *   incrementRadius,
 *   decrementRadius,
 *   setCoordRadius,
 *   setAutoRadius
 * } = useRadiusControl({ atoms, selectedMetal, onRadiusChange, onWarning });
 */

import { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { detectOptimalRadius } from '../services/coordination/radiusDetector';

export function useRadiusControl({
    initialRadius = 3.0,
    atoms = [],
    selectedMetal = null,
    onRadiusChange = null,
    onWarning = null
} = {}) {
    // Core radius state
    const [coordRadius, setCoordRadius] = useState(initialRadius);
    const [autoRadius, setAutoRadius] = useState(true);

    // v1.1.0 features state
    const [radiusInput, setRadiusInput] = useState(initialRadius.toFixed(3));
    const [radiusStep, setRadiusStep] = useState(0.05);
    const [targetCNInput, setTargetCNInput] = useState("");

    // Sync radiusInput string with coordRadius number (v1.1.0)
    useEffect(() => {
        if (isFinite(coordRadius)) {
            setRadiusInput(coordRadius.toFixed(3));
        }
    }, [coordRadius]);

    // Auto-detect radius when metal or atoms change
    useEffect(() => {
        if (selectedMetal != null && atoms.length > 0 && autoRadius) {
            try {
                const radius = detectOptimalRadius(atoms[selectedMetal], atoms);
                setCoordRadius(radius);
                if (onRadiusChange) {
                    onRadiusChange(radius, true); // true = auto-detected
                }
            } catch (error) {
                console.error("Error auto-detecting radius:", error);
                if (onWarning) {
                    onWarning("Failed to auto-detect radius, using manual value");
                }
            }
        }
    }, [selectedMetal, atoms, autoRadius, onRadiusChange, onWarning]);

    // Handle text input change
    const handleRadiusInputChange = useCallback((e) => {
        const val = e.target.value;
        setRadiusInput(val);
        const parsed = parseFloat(val);
        if (Number.isFinite(parsed) && parsed > 0) {
            setCoordRadius(parsed);
            setAutoRadius(false);
            if (onRadiusChange) {
                onRadiusChange(parsed, false); // false = manual
            }
        }
    }, [onRadiusChange]);

    // Handle step size change
    const handleRadiusStepChange = useCallback((e) => {
        setRadiusStep(parseFloat(e.target.value));
    }, []);

    // Increment radius by step
    const incrementRadius = useCallback(() => {
        const newVal = coordRadius + radiusStep;
        setCoordRadius(newVal);
        setAutoRadius(false);
        if (onRadiusChange) {
            onRadiusChange(newVal, false);
        }
    }, [coordRadius, radiusStep, onRadiusChange]);

    // Decrement radius by step (minimum 1.5)
    const decrementRadius = useCallback(() => {
        const newVal = Math.max(1.5, coordRadius - radiusStep);
        setCoordRadius(newVal);
        setAutoRadius(false);
        if (onRadiusChange) {
            onRadiusChange(newVal, false);
        }
    }, [coordRadius, radiusStep, onRadiusChange]);

    // Find optimal radius for target coordination number (v1.1.0)
    const handleFindRadiusForCN = useCallback(() => {
        const cn = parseInt(targetCNInput, 10);

        // Validate CN input
        if (!Number.isFinite(cn) || cn < 2 || cn > 24) {
            if (onWarning) {
                onWarning("Please enter a valid Coordination Number (2-24)");
            }
            return;
        }

        // Validate prerequisites
        if (selectedMetal == null || !atoms.length) {
            if (onWarning) {
                onWarning("Please load a file and select a metal center first");
            }
            return;
        }

        try {
            const metal = atoms[selectedMetal];
            const center = new THREE.Vector3(metal.x, metal.y, metal.z);

            // Calculate distances to all neighbors
            const allNeighbors = atoms
                .map((atom, idx) => {
                    if (idx === selectedMetal) return null;
                    const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
                    const distance = pos.distanceTo(center);
                    if (!isFinite(distance)) return null;
                    return { atom, idx, distance, vec: pos.sub(center) };
                })
                .filter((x) => x && x.distance > 0.1)
                .sort((a, b) => a.distance - b.distance);

            // Check if enough neighbors
            if (allNeighbors.length < cn) {
                if (onWarning) {
                    onWarning(`Not enough neighbors for CN=${cn}. Found only ${allNeighbors.length}.`);
                }
                return;
            }

            // Find optimal radius using gap detection
            const lastIncluded = allNeighbors[cn - 1];
            let optimalRadius;
            let gapInfo = "";

            if (allNeighbors.length > cn) {
                const firstExcluded = allNeighbors[cn];
                optimalRadius = (lastIncluded.distance + firstExcluded.distance) / 2.0;
                const gap = firstExcluded.distance - lastIncluded.distance;
                gapInfo = ` (Gap to next atom: ${gap.toFixed(3)} Å)`;
            } else {
                optimalRadius = lastIncluded.distance + 0.4;
                gapInfo = " (Last available atom)";
            }

            setCoordRadius(optimalRadius);
            setAutoRadius(false);

            if (onRadiusChange) {
                onRadiusChange(optimalRadius, false);
            }

            if (onWarning) {
                onWarning(`✅ Set radius to ${optimalRadius.toFixed(3)} Å for CN=${cn}${gapInfo}`);
            }

        } catch (error) {
            console.error("Error in handleFindRadiusForCN:", error);
            if (onWarning) {
                onWarning(`Error finding radius: ${error.message}`);
            }
        }
    }, [targetCNInput, selectedMetal, atoms, onRadiusChange, onWarning]);

    // Manual radius setter (for external control)
    const updateRadius = useCallback((newRadius, isAuto = false) => {
        setCoordRadius(newRadius);
        setAutoRadius(isAuto);
        if (onRadiusChange) {
            onRadiusChange(newRadius, isAuto);
        }
    }, [onRadiusChange]);

    return {
        // State
        coordRadius,
        autoRadius,
        radiusInput,
        radiusStep,
        targetCNInput,

        // Setters
        setCoordRadius: updateRadius,
        setAutoRadius,
        setRadiusInput,
        setRadiusStep,
        setTargetCNInput,

        // Handlers
        handleRadiusInputChange,
        handleRadiusStepChange,
        handleFindRadiusForCN,
        incrementRadius,
        decrementRadius
    };
}

export default useRadiusControl;

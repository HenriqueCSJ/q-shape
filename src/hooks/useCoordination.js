/**
 * useCoordination Hook
 *
 * Manages coordination sphere detection and coordination atom state.
 * Automatically updates coordination sphere when metal center or radius changes.
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.atoms - Molecular structure
 * @param {Number} params.selectedMetal - Selected metal center index
 * @param {Number} params.coordRadius - Coordination sphere radius
 *
 * @returns {Object} Coordination state
 * @returns {Array} coordAtoms - Atoms within coordination sphere
 * @returns {Number} coordinationNumber - Number of coordinating atoms (CN)
 * @returns {Function} updateCoordination - Force update coordination sphere
 *
 * @example
 * const { coordAtoms, coordinationNumber } = useCoordination({
 *   atoms,
 *   selectedMetal,
 *   coordRadius
 * });
 */

import { useState, useEffect, useCallback } from 'react';
import { getCoordinatingAtoms } from '../services/coordination/sphereDetector';

export function useCoordination({
    atoms = [],
    selectedMetal = null,
    coordRadius = 3.0
} = {}) {
    const [coordAtoms, setCoordAtoms] = useState([]);

    // Update coordination sphere when parameters change
    useEffect(() => {
        if (selectedMetal == null || atoms.length === 0) {
            setCoordAtoms([]);
            return;
        }

        try {
            const selected = getCoordinatingAtoms(atoms, selectedMetal, coordRadius);
            setCoordAtoms(selected);
        } catch (error) {
            console.error("Error detecting coordination sphere:", error);
            setCoordAtoms([]);
        }
    }, [atoms, selectedMetal, coordRadius]);

    // Force update coordination sphere
    const updateCoordination = useCallback(() => {
        if (selectedMetal == null || atoms.length === 0) {
            setCoordAtoms([]);
            return;
        }

        try {
            const selected = getCoordinatingAtoms(atoms, selectedMetal, coordRadius);
            setCoordAtoms(selected);
        } catch (error) {
            console.error("Error updating coordination sphere:", error);
            setCoordAtoms([]);
        }
    }, [atoms, selectedMetal, coordRadius]);

    return {
        coordAtoms,
        coordinationNumber: coordAtoms.length,
        updateCoordination
    };
}

export default useCoordination;

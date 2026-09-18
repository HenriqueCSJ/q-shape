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

import { useState, useMemo, useCallback } from 'react';
import { getCoordinatingAtoms } from '../services/coordination/sphereDetector';

export function useCoordination({
    atoms = [],
    selectedMetal = null,
    coordRadius = 3.0
} = {}) {
    const [revision, setRevision] = useState(0);
    // Derive the sphere in the same render as its structure and parameters.
    const coordAtoms = useMemo(() => {
        if (selectedMetal == null || atoms.length === 0) {
            return [];
        }

        try {
            return getCoordinatingAtoms(atoms, selectedMetal, coordRadius);
        } catch (error) {
            console.error("Error detecting coordination sphere:", error);
            return [];
        }
    // revision intentionally supports the existing explicit refresh action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atoms, selectedMetal, coordRadius, revision]);

    // Force update coordination sphere
    const updateCoordination = useCallback(() => {
        setRevision(value => value + 1);
    }, []);

    return {
        coordAtoms,
        coordinationNumber: coordAtoms.length,
        updateCoordination
    };
}

export default useCoordination;

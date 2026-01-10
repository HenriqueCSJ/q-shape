/**
 * Manual Override Panel Component - v1.5.0
 *
 * Allows users to manually override:
 * - Metal center selection
 * - Coordination radius
 * - Target coordination number
 *
 * Supports applying overrides per structure or to all structures in batch mode.
 */

import React, { useState } from 'react';
import { ATOMIC_DATA, ALL_METALS } from '../constants/atomicData';

export default function ManualOverridePanel({
    atoms,
    currentMetal,
    currentRadius,
    currentCN,
    onMetalChange,
    onRadiusChange,
    onFindRadiusForCN,
    batchMode = false,
    onApplyToAll,
    structureId = null
}) {
    const [targetCN, setTargetCN] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Get all metal atoms in the structure
    const metalAtoms = atoms
        .map((atom, index) => ({ atom, index }))
        .filter(({ atom }) => ALL_METALS.has(atom.element));

    // Get all atoms for advanced selection
    const allAtoms = atoms.map((atom, index) => ({ atom, index }));

    const handleFindRadius = () => {
        const cn = parseInt(targetCN, 10);
        if (cn >= 2 && cn <= 12) {
            onFindRadiusForCN?.(cn);
        }
    };

    const handleApplyToAll = (type) => {
        if (!onApplyToAll) return;

        switch (type) {
            case 'metal':
                onApplyToAll({ metalIndex: currentMetal });
                break;
            case 'radius':
                onApplyToAll({ radius: currentRadius });
                break;
            default:
                break;
        }
    };

    return (
        <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <h3 style={{ margin: 0, color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🔧</span> Manual Override
                </h3>
                {structureId && (
                    <span style={{
                        fontSize: '0.85rem',
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px'
                    }}>
                        Structure: <strong>{structureId}</strong>
                    </span>
                )}
            </div>

            <p style={{
                fontSize: '0.85rem',
                color: '#64748b',
                marginBottom: '1rem',
                marginTop: 0
            }}>
                Use these controls when automatic detection fails or needs adjustment.
            </p>

            {/* Metal Center Selection */}
            <div style={{ marginBottom: '1rem' }}>
                <label style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                        Metal Center:
                    </span>
                    {batchMode && (
                        <button
                            onClick={() => handleApplyToAll('metal')}
                            style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#64748b'
                            }}
                        >
                            Apply to all
                        </button>
                    )}
                </label>
                <select
                    value={currentMetal ?? ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        onMetalChange?.(value === '' ? null : parseInt(value, 10));
                    }}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '2px solid #e2e8f0',
                        fontSize: '0.95rem',
                        background: 'white'
                    }}
                >
                    <option value="">Select metal center...</option>
                    <optgroup label="Detected Metals">
                        {metalAtoms.map(({ atom, index }) => (
                            <option key={index} value={index}>
                                {atom.element} (#{index + 1}) — {ATOMIC_DATA[atom.element]?.name || atom.element}
                            </option>
                        ))}
                    </optgroup>
                    {showAdvanced && (
                        <optgroup label="All Atoms (Advanced)">
                            {allAtoms
                                .filter(({ atom }) => !ALL_METALS.has(atom.element))
                                .map(({ atom, index }) => (
                                    <option key={index} value={index}>
                                        {atom.element} (#{index + 1})
                                    </option>
                                ))}
                        </optgroup>
                    )}
                </select>

                <div style={{ marginTop: '0.5rem' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        color: '#64748b',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={showAdvanced}
                            onChange={(e) => setShowAdvanced(e.target.checked)}
                        />
                        Show non-metal atoms (advanced)
                    </label>
                </div>

                {currentMetal !== null && atoms[currentMetal] && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: '#f0fdf4',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#166534',
                        border: '1px solid #22c55e'
                    }}>
                        Selected: <strong>{atoms[currentMetal].element}</strong> at position
                        ({atoms[currentMetal].x.toFixed(3)}, {atoms[currentMetal].y.toFixed(3)}, {atoms[currentMetal].z.toFixed(3)})
                    </div>
                )}
            </div>

            {/* Coordination Radius */}
            <div style={{ marginBottom: '1rem' }}>
                <label style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                        Coordination Radius (Å):
                    </span>
                    {batchMode && (
                        <button
                            onClick={() => handleApplyToAll('radius')}
                            style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#64748b'
                            }}
                        >
                            Apply to all
                        </button>
                    )}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="number"
                        value={currentRadius?.toFixed(2) || '3.00'}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (Number.isFinite(value) && value > 0) {
                                onRadiusChange?.(value);
                            }
                        }}
                        step="0.1"
                        min="1"
                        max="10"
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            fontSize: '0.95rem'
                        }}
                    />
                    <button
                        onClick={() => onRadiusChange?.(Math.max(1, (currentRadius || 3) - 0.1))}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        −
                    </button>
                    <button
                        onClick={() => onRadiusChange?.(Math.min(10, (currentRadius || 3) + 0.1))}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        +
                    </button>
                </div>

                {currentCN !== undefined && (
                    <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.85rem',
                        color: '#64748b'
                    }}>
                        Current coordination number: <strong>{currentCN}</strong>
                    </div>
                )}
            </div>

            {/* Find Radius for CN */}
            <div style={{
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
            }}>
                <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9rem'
                }}>
                    Find Radius for Target CN:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="number"
                        value={targetCN}
                        onChange={(e) => setTargetCN(e.target.value)}
                        placeholder="e.g., 6"
                        min="2"
                        max="12"
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            fontSize: '0.95rem'
                        }}
                    />
                    <button
                        onClick={handleFindRadius}
                        disabled={!targetCN || parseInt(targetCN, 10) < 2 || parseInt(targetCN, 10) > 12}
                        style={{
                            padding: '0.75rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                            color: 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: (!targetCN || parseInt(targetCN, 10) < 2 || parseInt(targetCN, 10) > 12) ? 0.5 : 1
                        }}
                    >
                        Find
                    </button>
                </div>
                <p style={{
                    marginTop: '0.5rem',
                    marginBottom: 0,
                    fontSize: '0.8rem',
                    color: '#64748b'
                }}>
                    Automatically adjusts the radius to achieve the target coordination number (CN 2-12).
                </p>
            </div>

            {/* Warning about re-analysis */}
            <div style={{
                marginTop: '1rem',
                padding: '0.5rem 0.75rem',
                background: '#fef3c7',
                borderRadius: '6px',
                border: '1px solid #f59e0b',
                fontSize: '0.8rem',
                color: '#92400e'
            }}>
                <strong>Note:</strong> Changing these settings will clear analysis results for this structure
                and require re-analysis.
            </div>
        </div>
    );
}

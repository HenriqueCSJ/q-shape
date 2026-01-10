/**
 * Batch Mode Panel Component - v1.5.0
 *
 * Provides UI for batch mode operations:
 * - Structure selector dropdown
 * - Visual cue for selected structure
 *
 * Note: Batch summary table is now in BatchSummaryTable component
 */

import React from 'react';

export default function BatchModePanel({
    structures,
    selectedStructureIndex,
    onSelectStructure,
    batchResults
}) {
    return (
        <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
            }}>
                <h3 style={{ margin: 0, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📚</span> Batch Mode ({structures.length} structures)
                </h3>
            </div>

            {/* Structure selector */}
            <div>
                <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9rem'
                }}>
                    Select Structure to View:
                </label>
                <select
                    value={selectedStructureIndex}
                    onChange={(e) => onSelectStructure(parseInt(e.target.value, 10))}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '2px solid #e2e8f0',
                        fontSize: '0.95rem',
                        background: 'white',
                        cursor: 'pointer'
                    }}
                >
                    {structures.map((structure, index) => {
                        const result = batchResults?.get(index);
                        const hasResult = !!result;
                        return (
                            <option key={structure.id || index} value={index}>
                                {structure.id}
                                {hasResult && result.bestGeometry
                                    ? ` — ${result.bestGeometry.name} (CShM: ${result.bestGeometry.shapeMeasure.toFixed(3)})`
                                    : ' — Not analyzed'
                                }
                            </option>
                        );
                    })}
                </select>
            </div>
        </div>
    );
}

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
import { formatShapeMeasure } from '../utils/geometry';
import { isShapeResultAvailable } from '../utils/shapeResults';
import {
    BATCH_RESULT_STATUS,
    batchResultDetail,
    getBatchResultStatus
} from '../utils/batchResults';

export default function BatchModePanel({
    structures,
    selectedStructureIndex,
    onSelectStructure,
    batchResults
}) {
    const structureCount = structures.length;
    const currentStructure = structures[selectedStructureIndex];
    const hasPrevious = selectedStructureIndex > 0;
    const hasNext = selectedStructureIndex < structureCount - 1;

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
                    <span>📚</span> Batch Mode ({structureCount} structures)
                </h3>
            </div>

            <div
                role="status"
                aria-live="polite"
                style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    color: '#1e3a8a'
                }}
            >
                <strong>Editing structure {selectedStructureIndex + 1} of {structureCount}:</strong>{' '}
                {currentStructure?.id || `Structure ${selectedStructureIndex + 1}`}
            </div>

            {/* Structure navigation and direct selector */}
            <div>
                <label htmlFor="batch-structure-select" style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9rem'
                }}>
                    Select structure to view and edit:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        aria-label="Previous structure"
                        onClick={() => onSelectStructure(selectedStructureIndex - 1)}
                        disabled={!hasPrevious}
                        style={{
                            padding: '0.7rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: hasPrevious ? 'white' : '#f1f5f9',
                            color: hasPrevious ? '#1e40af' : '#94a3b8',
                            cursor: hasPrevious ? 'pointer' : 'not-allowed',
                            fontWeight: 700
                        }}
                    >
                        ← Previous
                    </button>
                    <select
                        id="batch-structure-select"
                        value={selectedStructureIndex}
                        onChange={(e) => onSelectStructure(parseInt(e.target.value, 10))}
                        style={{
                            flex: 1,
                            minWidth: '12rem',
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
                            const resultStatus = getBatchResultStatus(result);
                            const resultDetail = result ? batchResultDetail(result) : '';
                            let resultLabel = ' — Not analyzed';
                            if (resultStatus === BATCH_RESULT_STATUS.ERROR) {
                                resultLabel = ` — Error: ${resultDetail}`;
                            } else if (isShapeResultAvailable(result?.bestGeometry)) {
                                resultLabel = ` — ${result.bestGeometry.name} (CShM: ${formatShapeMeasure(result.bestGeometry.shapeMeasure, 3)})`;
                            } else if (result) {
                                resultLabel = ` — N/A${resultDetail ? `: ${resultDetail}` : ''}`;
                            }
                            return (
                                <option key={structure.id || index} value={index}>
                                    {index + 1}. {structure.id}
                                    {resultLabel}
                                </option>
                            );
                        })}
                    </select>
                    <button
                        type="button"
                        aria-label="Next structure"
                        onClick={() => onSelectStructure(selectedStructureIndex + 1)}
                        disabled={!hasNext}
                        style={{
                            padding: '0.7rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: hasNext ? 'white' : '#f1f5f9',
                            color: hasNext ? '#1e40af' : '#94a3b8',
                            cursor: hasNext ? 'pointer' : 'not-allowed',
                            fontWeight: 700
                        }}
                    >
                        Next →
                    </button>
                </div>
                <div style={{ marginTop: '0.65rem', color: '#475569', fontSize: '0.85rem' }}>
                    Parameter changes below affect only this structure unless you explicitly apply them to all structures.
                </div>
            </div>
        </div>
    );
}

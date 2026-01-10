/**
 * Batch Mode Panel Component - v1.5.0
 *
 * Provides UI for batch mode operations:
 * - Structure selector dropdown/list
 * - "Analyze All Structures" button with progress
 * - Batch summary table with results
 * - Visual cue for selected structure
 */

import React from 'react';
import { interpretShapeMeasure } from '../utils/geometry';

export default function BatchModePanel({
    structures,
    selectedStructureIndex,
    onSelectStructure,
    batchResults,
    isBatchRunning,
    batchProgress,
    onAnalyzeAll,
    onCancelBatch,
    getBatchSummary
}) {
    const summary = getBatchSummary?.() || [];
    const hasResults = summary.length > 0;

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
                    <span>📚</span> Batch Analysis
                </h3>

                {/* Analyze All Button */}
                <button
                    onClick={isBatchRunning ? onCancelBatch : onAnalyzeAll}
                    disabled={structures.length === 0}
                    style={{
                        background: isBatchRunning
                            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                            : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: structures.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: structures.length === 0 ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s'
                    }}
                >
                    {isBatchRunning ? (
                        <>
                            <span>⏹️</span> Cancel Analysis
                        </>
                    ) : (
                        <>
                            <span>🚀</span> Analyze All Structures
                        </>
                    )}
                </button>
            </div>

            {/* Progress indicator */}
            {batchProgress && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: batchProgress.stage === 'error'
                        ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                        : batchProgress.stage === 'complete'
                        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: '8px',
                    border: batchProgress.stage === 'error'
                        ? '1px solid #ef4444'
                        : batchProgress.stage === 'complete'
                        ? '1px solid #22c55e'
                        : '1px solid #3b82f6'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                    }}>
                        <span style={{
                            fontWeight: 600,
                            color: batchProgress.stage === 'error' ? '#dc2626' :
                                   batchProgress.stage === 'complete' ? '#166534' : '#1e40af'
                        }}>
                            {batchProgress.message}
                        </span>
                        {batchProgress.progress !== undefined && (
                            <span style={{
                                fontFamily: 'monospace',
                                color: '#64748b'
                            }}>
                                {Math.round(batchProgress.progress)}%
                            </span>
                        )}
                    </div>
                    {batchProgress.stage === 'analyzing' && (
                        <div style={{
                            height: '6px',
                            background: '#e2e8f0',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${batchProgress.progress || 0}%`,
                                background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    )}
                </div>
            )}

            {/* Structure selector */}
            <div style={{ marginBottom: '1rem' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9rem'
                }}>
                    Select Structure:
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

            {/* Batch Summary Table */}
            {hasResults && (
                <div>
                    <h4 style={{
                        margin: '1.5rem 0 0.75rem 0',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>📑</span> Batch Analysis Summary
                    </h4>
                    <div style={{
                        overflowX: 'auto',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                                    color: 'white'
                                }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Structure ID</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Metal</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>CN</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Best Geometry</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>CShM</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Quality</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map((row, idx) => {
                                    const isSelected = row.index === selectedStructureIndex;
                                    const interpretation = row.bestCShM !== null
                                        ? interpretShapeMeasure(row.bestCShM)
                                        : null;

                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => onSelectStructure(row.index)}
                                            style={{
                                                cursor: 'pointer',
                                                background: isSelected
                                                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                                                    : idx % 2 === 0 ? '#f8fafc' : 'white',
                                                borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <td style={{
                                                padding: '0.75rem',
                                                fontWeight: isSelected ? 700 : 400
                                            }}>
                                                {idx + 1}
                                            </td>
                                            <td style={{
                                                padding: '0.75rem',
                                                fontWeight: isSelected ? 700 : 600,
                                                color: isSelected ? '#1e40af' : '#374151'
                                            }}>
                                                {row.id}
                                                {isSelected && (
                                                    <span style={{
                                                        marginLeft: '0.5rem',
                                                        fontSize: '0.8rem',
                                                        color: '#3b82f6'
                                                    }}>
                                                        ◀ Selected
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                                {row.metalElement}
                                            </td>
                                            <td style={{
                                                padding: '0.75rem',
                                                textAlign: 'center',
                                                fontFamily: 'monospace'
                                            }}>
                                                {row.coordinationNumber}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {row.bestGeometry}
                                            </td>
                                            <td style={{
                                                padding: '0.75rem',
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                fontWeight: 600,
                                                color: interpretation?.color || '#374151'
                                            }}>
                                                {row.bestCShM !== null ? row.bestCShM.toFixed(4) : '—'}
                                            </td>
                                            <td style={{
                                                padding: '0.75rem',
                                                textAlign: 'center'
                                            }}>
                                                {interpretation && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        background: interpretation.color + '20',
                                                        color: interpretation.color
                                                    }}>
                                                        {interpretation.confidence}%
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary stats */}
                    <div style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#64748b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        <span>
                            <strong>{summary.length}</strong> of <strong>{structures.length}</strong> structures analyzed
                        </span>
                        <span>
                            Click a row to view detailed results
                        </span>
                    </div>
                </div>
            )}

            {/* Empty state when no results yet */}
            {!hasResults && structures.length > 0 && !isBatchRunning && (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    color: '#64748b'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                        No batch results yet
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                        Click "Analyze All Structures" to process all {structures.length} structures,
                        or analyze them individually.
                    </div>
                </div>
            )}
        </div>
    );
}

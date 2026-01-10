/**
 * Batch Summary Table Component - v1.5.0
 *
 * Displays the batch analysis summary table and batch progress.
 * Positioned below action buttons, closer to the 3D viewer.
 */

import React from 'react';
import { interpretShapeMeasure } from '../utils/geometry';

export default function BatchSummaryTable({
    structures,
    selectedStructureIndex,
    onSelectStructure,
    batchResults,
    batchProgress,
    getBatchSummary
}) {
    const summary = getBatchSummary?.() || [];
    const hasResults = summary.length > 0;

    return (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
            {/* Batch Progress indicator */}
            {batchProgress && (
                <div style={{
                    marginBottom: hasResults ? '1.5rem' : 0,
                    padding: '0.75rem 1rem',
                    background: batchProgress.stage === 'error'
                        ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                        : batchProgress.stage === 'complete'
                        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                        : 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                    borderRadius: '8px',
                    border: batchProgress.stage === 'error'
                        ? '1px solid #ef4444'
                        : batchProgress.stage === 'complete'
                        ? '1px solid #22c55e'
                        : '1px solid #8b5cf6'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: batchProgress.stage === 'analyzing' ? '0.5rem' : 0
                    }}>
                        <span style={{
                            fontWeight: 600,
                            color: batchProgress.stage === 'error' ? '#dc2626' :
                                   batchProgress.stage === 'complete' ? '#166534' : '#6d28d9'
                        }}>
                            {batchProgress.message}
                        </span>
                        {batchProgress.progress !== undefined && batchProgress.stage === 'analyzing' && (
                            <span style={{
                                fontFamily: 'monospace',
                                color: '#6d28d9',
                                fontWeight: 600
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
                                background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    )}
                </div>
            )}

            {/* Batch Summary Table */}
            {hasResults && (
                <>
                    <h4 style={{
                        margin: '0 0 0.75rem 0',
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
                                                        ◀
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
                            Click a row to view details
                        </span>
                    </div>
                </>
            )}

            {/* Empty state when no results yet but batch progress exists */}
            {!hasResults && !batchProgress && structures.length > 0 && (
                <div style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    color: '#64748b'
                }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
                    <div style={{ fontSize: '0.9rem' }}>
                        Click <strong>"Analyze All Structures"</strong> to process all {structures.length} structures at once
                    </div>
                </div>
            )}
        </div>
    );
}

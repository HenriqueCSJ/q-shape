/**
 * Batch Results Display Component
 *
 * Displays batch analysis results with summary table and expandable details
 */

import React, { useState } from 'react';
import { POINT_GROUPS } from '../constants/referenceGeometries';
import { interpretShapeMeasure } from '../utils/geometry';

export default function BatchResultsDisplay({
    batchResults,
    isAnalyzing,
    progress,
    onRunAnalysis,
    structures
}) {
    const [expandedStructure, setExpandedStructure] = useState(null);

    // Toggle expanded state
    const toggleExpanded = (index) => {
        setExpandedStructure(expandedStructure === index ? null : index);
    };

    // Render loading state
    if (isAnalyzing) {
        return (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: '12px',
                border: '2px solid #93c5fd'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                    Running Batch Analysis
                </div>
                {progress && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{
                            background: '#e2e8f0',
                            borderRadius: '10px',
                            height: '20px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem'
                        }}>
                            <div style={{
                                background: 'linear-gradient(90deg, #4f46e5, #6366f1)',
                                height: '100%',
                                width: `${progress.percentage}%`,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            Analyzing {progress.current} of {progress.total}: <strong>{progress.structureName}</strong>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Render start analysis prompt
    if (batchResults.length === 0 && structures && structures.length > 0) {
        return (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: '#fff',
                borderRadius: '12px',
                border: '2px solid #e2e8f0'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
                    {structures.length} structure{structures.length > 1 ? 's' : ''} loaded
                </div>
                <button
                    onClick={() => onRunAnalysis(structures)}
                    style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(79, 70, 229, 0.3)'
                    }}
                >
                    🚀 Analyze All Structures
                </button>
            </div>
        );
    }

    // Render no results state
    if (batchResults.length === 0) {
        return (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#64748b',
                background: '#fff',
                borderRadius: '12px',
                border: '2px solid #e2e8f0'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                Upload structure files to begin batch analysis
            </div>
        );
    }

    // Count successful analyses
    const successfulResults = batchResults.filter(r => !r.error && r.bestGeometry);

    return (
        <div>
            <h3 style={{
                margin: '0 0 1rem 0',
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📊 Batch Analysis Results
            </h3>

            {/* Summary Statistics */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#059669' }}>
                        {successfulResults.length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#065f46' }}>Analyzed</div>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706' }}>
                        {batchResults.filter(r => r.error).length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#92400e' }}>Errors</div>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed' }}>
                        {batchResults.length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#5b21b6' }}>Total</div>
                </div>
            </div>

            {/* Summary Table */}
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                            color: 'white'
                        }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Structure</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Metal</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>CN</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Best Geometry</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>CShM</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Quality</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batchResults.map((result, index) => {
                            const interpretation = result.bestCShM != null
                                ? interpretShapeMeasure(result.bestCShM)
                                : null;
                            const isExpanded = expandedStructure === index;

                            return (
                                <React.Fragment key={index}>
                                    <tr
                                        onClick={() => !result.error && toggleExpanded(index)}
                                        style={{
                                            background: result.error
                                                ? '#fef2f2'
                                                : isExpanded
                                                ? '#eff6ff'
                                                : index % 2 === 0 ? '#fff' : '#f9fafb',
                                            cursor: result.error ? 'default' : 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            fontWeight: 600,
                                            borderBottom: '1px solid #e2e8f0'
                                        }}>
                                            {!result.error && (isExpanded ? '▼ ' : '▶ ')}
                                            {result.structureName}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontFamily: 'monospace'
                                        }}>
                                            {result.error ? '—' : `${result.metalElement} #${result.metalIndex + 1}`}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            textAlign: 'center',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: 600
                                        }}>
                                            {result.error ? '—' : result.coordinationNumber}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            borderBottom: '1px solid #e2e8f0'
                                        }}>
                                            {result.error ? (
                                                <span style={{ color: '#dc2626', fontSize: '0.9rem' }}>
                                                    ⚠️ {result.error}
                                                </span>
                                            ) : (
                                                <span style={{ fontWeight: 600 }}>
                                                    {result.bestGeometry}
                                                    <span style={{
                                                        marginLeft: '0.5rem',
                                                        color: '#6366f1',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {POINT_GROUPS[result.bestGeometry] || ''}
                                                    </span>
                                                </span>
                                            )}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            textAlign: 'right',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            color: interpretation?.color || '#64748b'
                                        }}>
                                            {result.bestCShM != null ? result.bestCShM.toFixed(4) : '—'}
                                        </td>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            textAlign: 'center',
                                            borderBottom: '1px solid #e2e8f0'
                                        }}>
                                            {interpretation ? (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    background: interpretation.confidence > 80
                                                        ? '#d1fae5'
                                                        : interpretation.confidence > 50
                                                        ? '#fef3c7'
                                                        : '#fee2e2',
                                                    color: interpretation.confidence > 80
                                                        ? '#059669'
                                                        : interpretation.confidence > 50
                                                        ? '#d97706'
                                                        : '#dc2626'
                                                }}>
                                                    {interpretation.text}
                                                </span>
                                            ) : '—'}
                                        </td>
                                    </tr>

                                    {/* Expanded Details */}
                                    {isExpanded && !result.error && (
                                        <tr>
                                            <td colSpan={6} style={{
                                                padding: '0',
                                                background: '#f8fafc',
                                                borderBottom: '2px solid #3b82f6'
                                            }}>
                                                <div style={{ padding: '1rem 1.5rem' }}>
                                                    <h4 style={{
                                                        margin: '0 0 1rem 0',
                                                        color: '#1e40af',
                                                        fontSize: '1rem'
                                                    }}>
                                                        All Geometries for {result.structureName}
                                                    </h4>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                        gap: '0.5rem'
                                                    }}>
                                                        {result.geometryResults.slice(0, 10).map((geom, gIdx) => {
                                                            const geomInterp = interpretShapeMeasure(geom.shapeMeasure);
                                                            return (
                                                                <div
                                                                    key={gIdx}
                                                                    style={{
                                                                        padding: '0.5rem 0.75rem',
                                                                        background: gIdx === 0
                                                                            ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                                                                            : '#fff',
                                                                        borderRadius: '6px',
                                                                        border: `1px solid ${gIdx === 0 ? '#10b981' : '#e2e8f0'}`,
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: gIdx === 0 ? 700 : 500 }}>
                                                                        {gIdx + 1}. {geom.name}
                                                                    </span>
                                                                    <span style={{
                                                                        fontFamily: 'monospace',
                                                                        fontWeight: 600,
                                                                        color: geomInterp.color
                                                                    }}>
                                                                        {geom.shapeMeasure.toFixed(4)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {result.geometryResults.length > 10 && (
                                                        <div style={{
                                                            marginTop: '0.5rem',
                                                            color: '#64748b',
                                                            fontSize: '0.85rem',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            + {result.geometryResults.length - 10} more geometries
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Re-analyze button */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button
                    onClick={() => onRunAnalysis(structures)}
                    style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    🔄 Re-analyze All Structures
                </button>
            </div>
        </div>
    );
}

/**
 * Results Display Component
 *
 * Displays geometry analysis results table and references
 */

import React from 'react';
import { POINT_GROUPS } from '../constants/referenceGeometries';
import { interpretShapeMeasure } from '../utils/geometry';

export default function ResultsDisplay({
    isLoading,
    geometryResults,
    analysisParams,
    progress,
    selectedMetal,
    selectedGeometryIndex = 0,
    onGeometrySelect
}) {
    return (
        <div>
            <h3 style={{
                margin: '0 0 0.5rem 0',
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📈 Geometry Analysis Results
            </h3>
            {geometryResults.length > 0 && (
                <p style={{
                    margin: '0 0 1rem 0',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                }}>
                    💡 Click on any geometry to visualize it in 3D
                </p>
            )}
            {isLoading ? (
                <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: '#475569',
                    background: '#fff',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{
                        fontSize: '3rem',
                        marginBottom: '1rem',
                        animation: 'pulse 2s infinite'
                    }}>
                        🔬
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        Running {analysisParams.mode === 'intensive' ? 'Intensive' : 'Standard'} Analysis
                    </div>
                    {progress && (
                        <div style={{
                            marginTop: '1rem',
                            fontSize: '0.9rem',
                            color: '#64748b'
                        }}>
                            <div style={{ fontWeight: 600 }}>{progress.geometry}</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                {progress.stage} • {progress.percentage}%
                            </div>
                        </div>
                    )}
                </div>
            ) : geometryResults.length > 0 ? (
                <div className="results-container">
                    {geometryResults.slice(0, 15).map((r, i) => {
                        const inter = interpretShapeMeasure(r.shapeMeasure);
                        const isSelected = i === selectedGeometryIndex;
                        const isBest = i === 0;
                        return (
                            <div
                                key={i}
                                onClick={() => onGeometrySelect && onGeometrySelect(i)}
                                style={{
                                    padding: '1rem',
                                    background: isSelected
                                        ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                                        : isBest
                                        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                                        : i % 2 === 0 ? '#f9fafb' : '#fff',
                                    borderBottom: i < 14 ? '1px solid #e2e8f0' : 'none',
                                    borderLeft: isSelected
                                        ? '4px solid #3b82f6'
                                        : isBest ? '4px solid #10b981' : '4px solid transparent',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                                onMouseOver={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = isBest ? 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)' : '#f1f5f9';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = isSelected
                                        ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                                        : isBest
                                        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                                        : i % 2 === 0 ? '#f9fafb' : '#fff';
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <strong style={{
                                            fontSize: '0.95rem',
                                            color: isSelected ? '#1e40af' : isBest ? '#15803d' : '#1e293b',
                                            display: 'block'
                                        }}>
                                            {isSelected && '👁️ '}
                                            {i + 1}. {r.name}
                                            {isBest && ' ⭐'}
                                        </strong>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: '#6366f1',
                                            fontFamily: 'monospace',
                                            fontWeight: 600
                                        }}>
                                            {POINT_GROUPS[r.name] || ''}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        color: inter.color,
                                        fontFamily: 'monospace'
                                    }}>
                                        {r.shapeMeasure.toFixed(4)}
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.8rem'
                                }}>
                                    <span style={{ color: '#64748b' }}>
                                        <strong style={{ color: inter.color }}>{inter.text}</strong>
                                    </span>
                                    <span style={{
                                        color: inter.confidence > 80 ? '#059669' : inter.confidence > 50 ? '#f59e0b' : '#dc2626',
                                        fontWeight: 600
                                    }}>
                                        {inter.confidence}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {geometryResults.length > 15 && (
                        <div style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: '0.85rem',
                            fontStyle: 'italic'
                        }}>
                            + {geometryResults.length - 15} more (see report)
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: '#64748b',
                    background: '#fff',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    {selectedMetal == null
                        ? 'Select a metal center to begin analysis'
                        : 'No reference geometries for this coordination number'}
                </div>
            )}

            {/* References Section */}
            <div style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <h3 style={{
                    margin: '0 0 1rem 0',
                    color: '#1e293b',
                    fontSize: '1.25rem',
                    fontWeight: 700
                }}>
                    📚 References
                </h3>
                <ul style={{ listStyle: 'decimal inside', paddingLeft: '0', color: '#475569', fontSize: '0.9rem' }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                        Pinsky, M.; Avnir, D. <em>Inorg. Chem.</em> <strong>1998</strong>, 37, 5575–5582.
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                        Alvarez, S. et al. <em>Coord. Chem. Rev.</em> <strong>2005</strong>, 249, 1693–1708.
                    </li>
                    <li>
                        Llunell, M. et al. SHAPE 2.1, Universitat de Barcelona, 2013.
                    </li>
                </ul>
            </div>
        </div>
    );
}

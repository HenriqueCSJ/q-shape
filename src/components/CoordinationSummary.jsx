/**
 * Coordination Summary Component - v1.5.0
 *
 * Displays coordination information, quality metrics, and action buttons.
 * Updated for batch mode with structure ID display and batch export options.
 */

import React from 'react';

export default function CoordinationSummary({
    atoms,
    selectedMetal,
    coordAtoms,
    additionalMetrics,
    qualityMetrics,
    progress,
    intensiveProgress,
    intensiveMetadata,
    analysisParams,
    isLoading,
    isRunningIntensive,
    bestGeometry,
    geometryResults,
    onIntensiveAnalysis,
    onGenerateReport,
    onGenerateCSV,
    // v1.5.0 batch mode props
    batchMode = false,
    batchResults,
    onGenerateBatchReport,
    onGenerateWideSummaryCSV,
    onGenerateLongDetailedCSV,
    structureId = null
}) {
    if (selectedMetal == null) {
        return null;
    }

    const hasBatchResults = batchResults && batchResults.size > 0;

    return (
        <div style={{
            padding: '1.5rem',
            background: '#fff',
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            marginBottom: '2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            {/* Structure ID indicator for batch mode */}
            {batchMode && structureId && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '1.1rem' }}>📄</span>
                    <span style={{ fontWeight: 600, color: '#1e40af' }}>
                        Structure: {structureId}
                    </span>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h3 style={{
                        margin: '0 0 1rem',
                        color: '#1e293b',
                        fontSize: '1.25rem',
                        fontWeight: 700
                    }}>
                        📊 Coordination Summary
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr',
                        gap: '0.5rem 1rem',
                        fontSize: '0.95rem',
                        color: '#475569'
                    }}>
                        <strong>Metal:</strong>
                        <span>{atoms[selectedMetal].element}</span>

                        <strong>CN:</strong>
                        <span>{coordAtoms.length}</span>

                        <strong>Ligands:</strong>
                        <span>{coordAtoms.map(c => c.atom.element).join(', ') || 'None'}</span>
                    </div>

                    {additionalMetrics && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            fontSize: '0.9rem'
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>📏 Bond Statistics</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><strong>Mean:</strong> {additionalMetrics.meanBondLength.toFixed(3)} Å</div>
                                <div><strong>Std Dev:</strong> {additionalMetrics.stdDevBondLength.toFixed(3)} Å</div>
                                <div><strong>Min:</strong> {additionalMetrics.minBondLength.toFixed(3)} Å</div>
                                <div><strong>Max:</strong> {additionalMetrics.maxBondLength.toFixed(3)} Å</div>
                            </div>
                        </div>
                    )}
                </div>

                {qualityMetrics && (
                    <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        borderRadius: '12px',
                        border: '2px solid #86efac'
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#15803d', fontSize: '1.1rem' }}>
                            🎯 Quality Score
                        </div>
                        <div style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            color: qualityMetrics.overallQualityScore > 80 ? '#059669' : qualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626',
                            textAlign: 'center',
                            margin: '0.5rem 0'
                        }}>
                            {qualityMetrics.overallQualityScore.toFixed(1)}
                        </div>
                        <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>
                            out of 100
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div><strong>RMSD:</strong> {qualityMetrics.rmsd.toFixed(4)}</div>
                                <div><strong>Ang. Dist:</strong> {qualityMetrics.angularDistortionIndex.toFixed(2)}°</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Single Structure Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                <button
                    onClick={onIntensiveAnalysis}
                    disabled={isLoading || isRunningIntensive}
                    style={{
                        padding: '1rem 2rem',
                        background: (isLoading || isRunningIntensive) ? '#d1d5db' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: (isLoading || isRunningIntensive) ? 'not-allowed' : 'pointer',
                        boxShadow: (isLoading || isRunningIntensive) ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.4)',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => !(isLoading || isRunningIntensive) && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    {isRunningIntensive ? '⚡ Running...' : '⚡ Intensive Analysis'}
                </button>

                <button
                    onClick={onGenerateReport}
                    disabled={!bestGeometry || isLoading}
                    style={{
                        padding: '1rem 2rem',
                        background: bestGeometry && !isLoading
                            ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                            : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: bestGeometry && !isLoading ? 'pointer' : 'not-allowed',
                        boxShadow: bestGeometry && !isLoading ? '0 4px 6px rgba(79, 70, 229, 0.4)' : 'none',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => bestGeometry && !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    📄 Generate Report
                </button>

                <button
                    onClick={onGenerateCSV}
                    disabled={!geometryResults || geometryResults.length === 0 || isLoading}
                    style={{
                        padding: '1rem 2rem',
                        background: geometryResults && geometryResults.length > 0 && !isLoading
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: geometryResults && geometryResults.length > 0 && !isLoading ? 'pointer' : 'not-allowed',
                        boxShadow: geometryResults && geometryResults.length > 0 && !isLoading ? '0 4px 6px rgba(16, 185, 129, 0.4)' : 'none',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => geometryResults && geometryResults.length > 0 && !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    📊 Download CSV
                </button>
            </div>

            {/* Batch Export Buttons - shown when in batch mode with results */}
            {batchMode && hasBatchResults && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{
                        fontWeight: 700,
                        color: '#374151',
                        marginBottom: '0.75rem',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>📚</span> Batch Export Options
                    </div>
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={onGenerateBatchReport}
                            style={{
                                padding: '0.75rem 1.25rem',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            📄 Batch PDF Report
                        </button>

                        <button
                            onClick={onGenerateWideSummaryCSV}
                            style={{
                                padding: '0.75rem 1.25rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            📊 Summary CSV (Wide)
                        </button>

                        <button
                            onClick={onGenerateLongDetailedCSV}
                            style={{
                                padding: '0.75rem 1.25rem',
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            📋 All Geometries CSV (Long)
                        </button>
                    </div>
                    <p style={{
                        marginTop: '0.5rem',
                        marginBottom: 0,
                        fontSize: '0.8rem',
                        color: '#64748b'
                    }}>
                        <strong>Wide:</strong> One row per structure (best match only) |
                        <strong> Long:</strong> One row per (structure, geometry) pair
                    </p>
                </div>
            )}

            {/* Progress Display */}
            {progress && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                        alignItems: 'center'
                    }}>
                        <span style={{
                            fontWeight: 700,
                            color: '#1e293b',
                            fontSize: '0.95rem'
                        }}>
                            Analyzing: {progress.geometry} ({progress.current}/{progress.total})
                        </span>
                        <span style={{
                            fontWeight: 700,
                            color: analysisParams.mode === 'intensive' ? '#16a34a' : '#4f46e5',
                            fontSize: '1.1rem'
                        }}>
                            {progress.percentage}%
                        </span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '12px',
                        background: '#e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{
                            width: `${progress.percentage}%`,
                            height: '100%',
                            background: analysisParams.mode === 'intensive'
                                ? 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)'
                                : 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
                            transition: 'width 0.3s ease',
                            borderRadius: '6px'
                        }} />
                    </div>
                    <div style={{
                        marginTop: '0.75rem',
                        color: '#64748b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span><strong>Stage:</strong> {progress.stage}</span>
                        {progress.extra && <span style={{ fontStyle: 'italic' }}>{progress.extra}</span>}
                    </div>
                </div>
            )}

            {/* Intensive Analysis Progress */}
            {intensiveProgress && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '2px solid #86efac',
                    borderRadius: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>⚡</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>
                                {intensiveProgress.message}
                            </div>
                            <div style={{
                                background: '#fff',
                                height: '8px',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                                    height: '100%',
                                    width: `${intensiveProgress.progress * 100}%`,
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#15803d', minWidth: '50px', textAlign: 'right' }}>
                            {Math.round(intensiveProgress.progress * 100)}%
                        </div>
                    </div>

                    {intensiveProgress.workerDetails && intensiveProgress.workerDetails.estimatedRemaining > 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#16a34a', marginBottom: '0.75rem' }}>
                            Estimated time remaining: {intensiveProgress.workerDetails.estimatedRemaining}s
                            {' | '}
                            Elapsed: {intensiveProgress.workerDetails.elapsed}s
                        </div>
                    )}
                </div>
            )}

            {/* Intensive Metadata Display */}
            {intensiveMetadata && intensiveMetadata.metadata && intensiveMetadata.ligandGroups && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '2px solid #10b981',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔬</span> Ab Initio Analysis (CN={intensiveMetadata.metadata?.coordinationNumber || 'N/A'})
                    </div>

                    {(() => {
                        const rings = intensiveMetadata.ligandGroups?.rings?.length || 0;
                        const mono = intensiveMetadata.ligandGroups?.monodentate?.length || 0;
                        let structureType = '';

                        if (rings === 1 && mono > 0) {
                            structureType = 'Piano Stool Structure';
                        } else if (rings === 2) {
                            structureType = 'Sandwich Structure';
                        } else if (rings === 1 && mono === 0) {
                            structureType = 'Macrocyclic Structure';
                        }

                        return structureType ? (
                            <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                {structureType}
                            </div>
                        ) : null;
                    })()}

                    <div style={{ color: '#166534', marginBottom: '0.5rem' }}>
                        {intensiveMetadata.ligandGroups?.summary || 'Ligand information not available'}
                    </div>

                    {intensiveMetadata.ligandGroups?.rings?.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#16a34a' }}>
                            {intensiveMetadata.ligandGroups.rings.map((ring, i) => (
                                <div key={i}>Ring {i + 1}: {ring?.hapticity || 'Unknown'} ({ring?.size || 0} atoms)</div>
                            ))}
                        </div>
                    )}

                    {intensiveMetadata.metadata?.bestGeometry && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                            Best fit: {intensiveMetadata.metadata.bestGeometry} (CShM = {intensiveMetadata.metadata.bestCShM?.toFixed(3)})
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * File Upload Section Component - v1.5.0
 *
 * Handles file upload interface for molecular structure files.
 * Supports XYZ (single/multi-frame) and CIF formats.
 *
 * v1.5.0 Changes:
 * - Updated to accept .xyz and .cif files
 * - Shows batch mode indicator when multiple structures detected
 * - Displays file format and structure count
 */

import React from 'react';

export default function FileUploadSection({
    fileInputRef,
    onFileUpload,
    batchMode = false,
    structureCount = 0,
    fileFormat = null,
    currentStructureId = null
}) {
    return (
        <div className="card">
            <label className="control-label">
                📁 Load Molecular Structure (.xyz, .cif)
            </label>
            <p style={{
                fontSize: '0.85rem',
                color: '#64748b',
                marginBottom: '0.75rem',
                marginTop: '0.25rem'
            }}>
                Supports single structures, multi-frame XYZ trajectories, and CIF files with multiple blocks
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xyz,.cif"
                    onChange={onFileUpload}
                    className="file-upload-input"
                />
            </div>

            {/* Batch mode indicator */}
            {structureCount > 0 && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: batchMode
                        ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                        : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '8px',
                    border: batchMode ? '1px solid #3b82f6' : '1px solid #22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}>
                    <span style={{
                        fontSize: '1.25rem'
                    }}>
                        {batchMode ? '📚' : '📄'}
                    </span>
                    <div>
                        <div style={{
                            fontWeight: 600,
                            color: batchMode ? '#1e40af' : '#166534',
                            fontSize: '0.95rem'
                        }}>
                            {batchMode
                                ? `Batch Mode: ${structureCount} structures detected`
                                : 'Single Structure Mode'
                            }
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: batchMode ? '#3b82f6' : '#22c55e',
                            marginTop: '0.25rem'
                        }}>
                            Format: {fileFormat?.toUpperCase() || 'Unknown'}
                            {currentStructureId && (
                                <span style={{ marginLeft: '0.75rem' }}>
                                    | Current: <strong>{currentStructureId}</strong>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Batch mode help text */}
            {batchMode && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#64748b'
                }}>
                    <strong>Tip:</strong> Use the structure selector below to switch between structures,
                    or click "Analyze All Structures" to process the entire batch.
                </div>
            )}
        </div>
    );
}

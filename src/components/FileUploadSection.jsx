/**
 * File Upload Section Component
 *
 * Handles XYZ and CIF file upload interface.
 * Supports multiple file upload and multi-frame XYZ files.
 * Includes structure selector when multiple structures are loaded.
 */

import React from 'react';

export default function FileUploadSection({
    fileInputRef,
    onFileUpload,
    structures = [],
    selectedStructureIndex = 0,
    onSelectStructure,
    uploadMetadata
}) {
    const hasMultipleStructures = structures.length > 1;

    return (
        <div className="card">
            <label className="control-label">
                📁 Load Molecular Structure(s)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xyz,.cif"
                    multiple
                    onChange={onFileUpload}
                    className="file-upload-input"
                />
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Supports .xyz (single/multi-frame) and .cif files
                </span>
            </div>

            {/* Structure count badge */}
            {uploadMetadata && uploadMetadata.structureCount > 1 && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontWeight: 600, color: '#1e40af' }}>
                        📊 {uploadMetadata.structureCount} structures loaded
                    </span>
                    {uploadMetadata.fileCount > 1 && (
                        <span style={{ color: '#3b82f6' }}>
                            from {uploadMetadata.fileCount} files
                        </span>
                    )}
                    {uploadMetadata.formats && uploadMetadata.formats.length > 1 && (
                        <span style={{ color: '#6366f1' }}>
                            ({uploadMetadata.formats.map(f => f.toUpperCase()).join(', ')})
                        </span>
                    )}
                </div>
            )}

            {/* Structure selector dropdown */}
            {hasMultipleStructures && (
                <div style={{ marginTop: '0.75rem' }}>
                    <label className="control-label" style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        🔍 Select Structure to Analyze
                    </label>
                    <select
                        value={selectedStructureIndex}
                        onChange={(e) => onSelectStructure?.(parseInt(e.target.value, 10))}
                        style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            background: 'white',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    >
                        {structures.map((structure, index) => (
                            <option key={index} value={index}>
                                {index + 1}. {structure.name}
                                {' '}({structure.atoms.length} atoms)
                                {structure.format !== 'xyz' && ` [${structure.format.toUpperCase()}]`}
                            </option>
                        ))}
                    </select>

                    {/* Quick navigation buttons for many structures */}
                    {structures.length > 5 && (
                        <div style={{
                            marginTop: '0.5rem',
                            display: 'flex',
                            gap: '0.25rem',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={() => onSelectStructure?.(0)}
                                disabled={selectedStructureIndex === 0}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    background: selectedStructureIndex === 0 ? '#e2e8f0' : 'white',
                                    cursor: selectedStructureIndex === 0 ? 'default' : 'pointer'
                                }}
                            >
                                ⏮ First
                            </button>
                            <button
                                onClick={() => onSelectStructure?.(Math.max(0, selectedStructureIndex - 1))}
                                disabled={selectedStructureIndex === 0}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    background: selectedStructureIndex === 0 ? '#e2e8f0' : 'white',
                                    cursor: selectedStructureIndex === 0 ? 'default' : 'pointer'
                                }}
                            >
                                ◀ Prev
                            </button>
                            <span style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                color: '#64748b'
                            }}>
                                {selectedStructureIndex + 1} / {structures.length}
                            </span>
                            <button
                                onClick={() => onSelectStructure?.(Math.min(structures.length - 1, selectedStructureIndex + 1))}
                                disabled={selectedStructureIndex === structures.length - 1}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    background: selectedStructureIndex === structures.length - 1 ? '#e2e8f0' : 'white',
                                    cursor: selectedStructureIndex === structures.length - 1 ? 'default' : 'pointer'
                                }}
                            >
                                Next ▶
                            </button>
                            <button
                                onClick={() => onSelectStructure?.(structures.length - 1)}
                                disabled={selectedStructureIndex === structures.length - 1}
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    background: selectedStructureIndex === structures.length - 1 ? '#e2e8f0' : 'white',
                                    cursor: selectedStructureIndex === structures.length - 1 ? 'default' : 'pointer'
                                }}
                            >
                                Last ⏭
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Current structure info */}
            {structures.length > 0 && structures[selectedStructureIndex] && (
                <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#475569'
                }}>
                    <strong>Current:</strong> {structures[selectedStructureIndex].name}
                    {structures[selectedStructureIndex].source && structures[selectedStructureIndex].source !== structures[selectedStructureIndex].name && (
                        <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>
                            (from {structures[selectedStructureIndex].source})
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

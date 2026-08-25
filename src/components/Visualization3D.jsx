/**
 * 3D Visualization Component
 *
 * Displays the Three.js canvas with controls for ideal geometry, labels, and rotation
 */

import React from 'react';

export default function Visualization3D({
    canvasRef,
    showIdeal,
    showLabels,
    autoRotate,
    onShowIdealChange,
    onShowLabelsChange,
    onAutoRotateChange
}) {
    return (
        <div className="visualization-card">
            <div className="visualization-header">
                <h3 className="card-title">
                    🎨 3D Visualization
                </h3>
                <div className="visualization-controls">
                    <label style={{
                        fontSize: '0.85rem',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}>
                        <input
                            type="checkbox"
                            checked={showIdeal}
                            onChange={(e) => onShowIdealChange(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        Show Ideal
                    </label>
                    <label style={{
                        fontSize: '0.85rem',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}>
                        <input
                            type="checkbox"
                            checked={showLabels}
                            onChange={(e) => onShowLabelsChange(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        Labels
                    </label>
                    <label style={{
                        fontSize: '0.85rem',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}>
                        <input
                            type="checkbox"
                            checked={autoRotate}
                            onChange={(e) => onAutoRotateChange(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        Rotate
                    </label>
                </div>
            </div>
            <div className="canvas-container">
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label="Interactive 3D molecular structure visualization"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        borderRadius: '8px'
                    }}
                />
            </div>
            <p style={{
                marginTop: '1rem',
                color: '#64748b',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontStyle: 'italic'
            }}>
                💡 Mouse: rotate • Scroll: zoom • Right-click: pan
            </p>
        </div>
    );
}

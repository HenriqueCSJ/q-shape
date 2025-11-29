/**
 * Analysis Controls Component
 *
 * Handles metal center selection and coordination radius controls
 */

import React from 'react';
import { ALL_METALS } from '../constants/atomicData';

export default function AnalysisControls({
    atoms,
    selectedMetal,
    onMetalChange,
    coordRadius,
    autoRadius,
    radiusInput,
    radiusStep,
    targetCNInput,
    onRadiusInputChange,
    onRadiusStepChange,
    onFindRadiusForCN,
    onIncrementRadius,
    onDecrementRadius,
    onCoordRadiusChange,
    onAutoRadiusChange,
    onTargetCNInputChange,
    flexibleMode,
    onFlexibleModeChange
}) {
    return (
        <div className="controls-section">
            {/* Metal Center Selector */}
            <div className="card">
                <label className="control-label">
                    🎯 Metal Center
                </label>
                <select
                    value={selectedMetal ?? ''}
                    onChange={(e) => onMetalChange(Number(e.target.value))}
                    className="select-input"
                >
                    <option value="">Select central atom</option>
                    {atoms.map((a, i) => (
                        <option key={i} value={i}>
                            #{i + 1}: {a.element}{ALL_METALS.has(a.element) ? ' ⭐' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {/* Flexible Geometry Matching Toggle */}
            <div className="card">
                <label className="control-label">
                    🔧 Geometry Matching Mode
                </label>
                <div style={{
                    padding: '0.75rem',
                    background: flexibleMode ? '#f0f9ff' : '#f9fafb',
                    border: flexibleMode ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={flexibleMode}
                            onChange={(e) => onFlexibleModeChange && onFlexibleModeChange(e.target.checked)}
                            style={{
                                cursor: 'pointer',
                                marginTop: '0.25rem',
                                width: '18px',
                                height: '18px',
                                flexShrink: 0
                            }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontWeight: 600,
                                color: flexibleMode ? '#1e40af' : '#475569',
                                fontSize: '0.95rem',
                                marginBottom: '0.25rem'
                            }}>
                                {flexibleMode ? '✨ Flexible (Anisotropic Scaling)' : '📐 Rigid (Standard)'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>
                                {flexibleMode
                                    ? 'Allows reference geometries to scale along principal axes'
                                    : 'Uses fixed reference geometries (traditional CShM)'}
                            </div>
                        </div>
                    </label>
                </div>
                <div style={{
                    fontSize: '0.8rem',
                    color: '#64748b',
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    lineHeight: '1.4'
                }}>
                    💡 <strong>Flexible mode</strong> helps identify distorted geometries (piano stools, compressed structures) by showing both rigid and flexible CShM values with delta.
                </div>
            </div>

            {/* Coordination Radius Control */}
            <div className="card">
                <div className="slider-header">
                    <label className="control-label">
                        📏 Coordination Radius: {coordRadius.toFixed(2)} Å
                    </label>
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={autoRadius}
                            onChange={(e) => onAutoRadiusChange(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        Auto
                    </label>
                </div>

                {/* Precise Radius Control */}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <input
                            type="text"
                            value={radiusInput}
                            onChange={onRadiusInputChange}
                            disabled={autoRadius}
                            placeholder="3.000"
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '2px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace'
                            }}
                        />
                        <select
                            value={radiusStep}
                            onChange={onRadiusStepChange}
                            disabled={autoRadius}
                            className="select-input"
                            style={{ width: 'auto', padding: '0.5rem' }}
                        >
                            <option value={0.50}>±0.50 Å</option>
                            <option value={0.10}>±0.10 Å</option>
                            <option value={0.05}>±0.05 Å</option>
                            <option value={0.01}>±0.01 Å</option>
                        </select>
                        <button
                            onClick={onIncrementRadius}
                            disabled={autoRadius}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: autoRadius ? '#e2e8f0' : '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: autoRadius ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            +
                        </button>
                        <button
                            onClick={onDecrementRadius}
                            disabled={autoRadius}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: autoRadius ? '#e2e8f0' : '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: autoRadius ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            −
                        </button>
                    </div>
                </div>

                {/* Slider */}
                <input
                    type="range"
                    min="1.5"
                    max="6.0"
                    step="0.05"
                    value={coordRadius}
                    onChange={(e) => onCoordRadiusChange(parseFloat(e.target.value), false)}
                    style={{
                        width: '100%',
                        accentColor: '#4f46e5'
                    }}
                />
            </div>

            {/* Find Radius by CN */}
            <div className="card">
                <label className="control-label">
                    🎯 Find Radius by Coordination Number
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <input
                        type="text"
                        value={targetCNInput}
                        onChange={(e) => onTargetCNInputChange(e.target.value)}
                        placeholder="Target CN (2-60)"
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '2px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.95rem'
                        }}
                    />
                    <button
                        onClick={onFindRadiusForCN}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Find Radius
                    </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Automatically finds optimal radius for target CN using gap detection
                </div>
            </div>
        </div>
    );
}

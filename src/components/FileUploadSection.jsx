/**
 * File Upload Section Component
 *
 * Handles XYZ file upload interface
 */

import React from 'react';

export default function FileUploadSection({ fileInputRef, onFileUpload }) {
    return (
        <div className="card">
            <label className="control-label">
                📁 Load Molecular Structure (.xyz)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xyz"
                    onChange={onFileUpload}
                    className="file-upload-input"
                />
            </div>
        </div>
    );
}

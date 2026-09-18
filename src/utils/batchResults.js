import {
    isShapeResultAvailable,
    shapeResultDetail
} from './shapeResults';

export const BATCH_RESULT_STATUS = Object.freeze({
    AVAILABLE: 'available',
    PARTIAL: 'partial',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
});

function diagnosticText(value) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    if (value instanceof Error && value.message.trim().length > 0) {
        return value.message.trim();
    }
    if (typeof value?.message === 'string' && value.message.trim().length > 0) {
        return value.message.trim();
    }
    if (value != null) {
        const text = String(value).trim();
        if (text.length > 0) return text;
    }
    return 'Batch analysis failed without a diagnostic message.';
}

export function getBatchResultStatus(result) {
    if (result?.status === BATCH_RESULT_STATUS.ERROR) {
        return BATCH_RESULT_STATUS.ERROR;
    }
    const geometries = Array.isArray(result?.geometryResults) ? result.geometryResults : [];
    if (isShapeResultAvailable(result?.bestGeometry) || geometries.some(isShapeResultAvailable)) {
        if (geometries.some(geometry => !isShapeResultAvailable(geometry)) ||
            result.status === BATCH_RESULT_STATUS.PARTIAL ||
            result.metadata?.analysisComplete === false ||
            result.metadata?.fullReferenceCensus === false ||
            result.metadata?.unavailableGeometryCount > 0 ||
            result.metadata?.geometryCount > geometries.length ||
            result.error || result.metadata?.error) {
            return BATCH_RESULT_STATUS.PARTIAL;
        }
        return BATCH_RESULT_STATUS.AVAILABLE;
    }
    return BATCH_RESULT_STATUS.UNAVAILABLE;
}

export function batchResultStatusLabel(result) {
    const status = getBatchResultStatus(result);
    if (status === BATCH_RESULT_STATUS.ERROR) return 'Error';
    if (status === BATCH_RESULT_STATUS.PARTIAL) return 'Partial';
    if (status === BATCH_RESULT_STATUS.AVAILABLE) return 'Available';
    return 'N/A';
}

export function batchResultDetail(result) {
    const geometries = Array.isArray(result?.geometryResults) ? result.geometryResults : [];
    const metadata = result?.metadata || {};
    const status = getBatchResultStatus(result);
    const diagnostics = [...new Set([
        result?.error,
        metadata.error,
        ...geometries.map(shapeResultDetail)
    ].filter(detail => typeof detail === 'string' && detail.trim()).map(detail => detail.trim()))];

    if (status === BATCH_RESULT_STATUS.ERROR || status === BATCH_RESULT_STATUS.UNAVAILABLE) {
        return diagnostics.join('; ') || (status === BATCH_RESULT_STATUS.ERROR
            ? 'Batch analysis failed without a diagnostic message.'
            : 'No usable geometry result was produced.');
    }

    const details = [];
    const radius = Number.isFinite(result?.radius) ? result.radius : metadata.radius;
    if (Number.isFinite(radius) && radius > 0) details.push(`Radius ${radius.toFixed(3)} Å`);

    if (geometries.length > 0) {
        const available = geometries.filter(isShapeResultAvailable).length;
        const total = Number.isInteger(metadata.geometryCount)
            ? Math.max(geometries.length, metadata.geometryCount)
            : geometries.length;
        details.push(`${available}/${total} geometries available`);
        if (total > geometries.length) details.push(`${total - geometries.length} missing result(s)`);
    } else {
        details.push('Geometry counts unavailable');
    }

    if (metadata.searchProfile === 'exact-permutation') {
        details.push('Exact permutation search');
    } else if (result.analysisMode === 'intensive' || metadata.intensiveMode === true) {
        details.push('Extended search requested');
    } else if (result.analysisMode === 'default' || metadata.intensiveMode === false) {
        details.push('Standard search');
    }
    if (Number.isFinite(metadata.elapsedSeconds) && metadata.elapsedSeconds >= 0) {
        details.push(`${metadata.elapsedSeconds.toFixed(1)} s`);
    }
    if (metadata.fullReferenceCensus === false) details.push('Reference census incomplete');
    if (status === BATCH_RESULT_STATUS.PARTIAL && diagnostics.length === 0) {
        details.push('Analysis incomplete');
    }
    details.push(...diagnostics);
    return details.join(' · ');
}

export function createBatchFailureResult(error, overrides = {}) {
    const detail = diagnosticText(error);
    return {
        geometryResults: [],
        bestGeometry: null,
        ligandGroups: null,
        metadata: { error: detail },
        metalIndex: null,
        radius: null,
        coordAtoms: [],
        coordinationNumber: null,
        analysisMode: 'intensive',
        ...overrides,
        status: BATCH_RESULT_STATUS.ERROR,
        error: detail
    };
}

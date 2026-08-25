import {
    isShapeResultAvailable,
    shapeResultDetail
} from './shapeResults';

export const BATCH_RESULT_STATUS = Object.freeze({
    AVAILABLE: 'available',
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
    if (result?.status === BATCH_RESULT_STATUS.AVAILABLE ||
        isShapeResultAvailable(result?.bestGeometry) ||
        (Array.isArray(result?.geometryResults) &&
            result.geometryResults.some(isShapeResultAvailable))) {
        return BATCH_RESULT_STATUS.AVAILABLE;
    }
    return BATCH_RESULT_STATUS.UNAVAILABLE;
}

export function batchResultStatusLabel(result) {
    const status = getBatchResultStatus(result);
    if (status === BATCH_RESULT_STATUS.ERROR) return 'Error';
    if (status === BATCH_RESULT_STATUS.AVAILABLE) return 'Available';
    return 'N/A';
}

export function batchResultDetail(result) {
    if (typeof result?.error === 'string' && result.error.trim().length > 0) {
        return result.error.trim();
    }

    if (getBatchResultStatus(result) === BATCH_RESULT_STATUS.UNAVAILABLE) {
        const details = (Array.isArray(result?.geometryResults) ? result.geometryResults : [])
            .map(shapeResultDetail)
            .filter(Boolean);
        const uniqueDetails = [...new Set(details)];
        return uniqueDetails.join('; ') || 'No usable geometry result was produced.';
    }

    return '';
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

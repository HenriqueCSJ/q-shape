import { isValidShapeMeasure } from './geometry';

export const SHAPE_RESULT_STATUS = Object.freeze({
    AVAILABLE: 'available',
    INVALID: 'invalid',
    ERROR: 'error'
});

export function isShapeResultAvailable(result) {
    return Boolean(result) &&
        result.status !== SHAPE_RESULT_STATUS.INVALID &&
        result.status !== SHAPE_RESULT_STATUS.ERROR &&
        isValidShapeMeasure(result.shapeMeasure);
}

/**
 * Accept only a complete reporting record: either a usable CShM result or an
 * explicitly retained unavailable row with a diagnostic.
 */
export function isShapeResultRecord(result) {
    if (!result || typeof result !== 'object' ||
        typeof result.name !== 'string' || result.name.length === 0) {
        return false;
    }
    if (isShapeResultAvailable(result)) return true;
    return (result.status === SHAPE_RESULT_STATUS.INVALID ||
        result.status === SHAPE_RESULT_STATUS.ERROR) &&
        typeof result.error === 'string' && result.error.trim().length > 0;
}

export function normalizeShapeResult(result, fallbackName = 'Unknown geometry') {
    const source = result && typeof result === 'object' ? result : {};
    const name = typeof source.name === 'string' && source.name.length > 0
        ? source.name
        : fallbackName;
    const available = isShapeResultAvailable(source);

    if (available) {
        return {
            ...source,
            name,
            status: SHAPE_RESULT_STATUS.AVAILABLE,
            error: null
        };
    }

    const explicitError = source.status === SHAPE_RESULT_STATUS.ERROR;
    return {
        ...source,
        name,
        status: explicitError ? SHAPE_RESULT_STATUS.ERROR : SHAPE_RESULT_STATUS.INVALID,
        error: typeof source.error === 'string' && source.error.trim().length > 0
            ? source.error.trim()
            : 'CShM is unavailable because the calculation did not return a finite value in [0, 100].'
    };
}

/**
 * Preserve every expected row while sorting usable CShM values first.
 * Unavailable rows keep their source order after the finite results.
 */
export function prepareGeometryResults(results) {
    if (!Array.isArray(results)) {
        throw new TypeError('Geometry results must be an array');
    }

    return results
        .map((result, sourceIndex) => ({
            result: normalizeShapeResult(result, `Geometry ${sourceIndex + 1}`),
            sourceIndex
        }))
        .sort((left, right) => {
            const leftAvailable = isShapeResultAvailable(left.result);
            const rightAvailable = isShapeResultAvailable(right.result);
            if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;
            if (leftAvailable) {
                return left.result.shapeMeasure - right.result.shapeMeasure ||
                    left.sourceIndex - right.sourceIndex;
            }
            return left.sourceIndex - right.sourceIndex;
        })
        .map(entry => entry.result);
}

export function summarizeGeometryResults(results) {
    const prepared = prepareGeometryResults(results);
    const availableResults = prepared.filter(isShapeResultAvailable);
    const unavailableResults = prepared.filter(result => !isShapeResultAvailable(result));
    return {
        results: prepared,
        best: availableResults[0] || null,
        availableResults,
        unavailableResults,
        isComplete: prepared.length > 0 && unavailableResults.length === 0
    };
}

export function shapeResultStatusLabel(result) {
    return isShapeResultAvailable(result) ? 'Available' : 'N/A';
}

export function shapeResultDetail(result) {
    if (isShapeResultAvailable(result)) return '';
    return normalizeShapeResult(result, result?.name).error;
}

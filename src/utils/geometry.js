/**
 * Geometry Utility Functions
 *
 * Provides geometric analysis utilities for coordination chemistry including
 * validation and formatting of shape measures.
 */

/**
 * Return whether a value belongs to the CShM reporting domain.
 *
 * Non-finite values and values outside the mathematical reporting domain
 * [0, 100] are invalid. JavaScript negative zero is accepted as numerical zero
 * and normalized by formatShapeMeasure().
 *
 * @param {*} value - Candidate CShM value
 * @returns {boolean}
 */
export function isValidShapeMeasure(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Format a CShM value consistently for UI and exported reports.
 *
 * @param {*} value - Candidate CShM value
 * @param {number} digits - Number of digits after the decimal point
 * @param {string} invalidLabel - Text used for invalid values
 * @returns {string}
 */
export function formatShapeMeasure(value, digits = 4, invalidLabel = 'N/A') {
    if (!Number.isInteger(digits) || digits < 0 || digits > 20) {
        throw new RangeError('CShM decimal digits must be an integer from 0 to 20');
    }
    if (!isValidShapeMeasure(value)) return invalidLabel;

    const normalized = Object.is(value, -0) ? 0 : value;
    return normalized.toFixed(digits);
}

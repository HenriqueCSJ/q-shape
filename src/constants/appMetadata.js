/**
 * Application Metadata Constants
 *
 * Centralized version and build information for Q-Shape.
 * Update these values when releasing a new version.
 */

export const APP_VERSION = '1.5.0';
export const BUILD_DATE = 'January 2025';
export const APP_NAME = 'Q-Shape';
export const APP_FULL_NAME = 'Q-Shape (Quantitative Shape Analyzer)';

// Citation information
export const CITATION = {
    author: 'Castro Silva Junior, H.',
    year: 2025,
    title: 'Q-Shape - Quantitative Shape Analyzer',
    doi: '10.5281/zenodo.17717110',
    url: 'https://doi.org/10.5281/zenodo.17717110'
};

// Format citation string
export const getCitationString = () =>
    `${CITATION.author} (${CITATION.year}). ${CITATION.title} (v${APP_VERSION}). Zenodo. ${CITATION.url}`;

// Version display string
export const getVersionString = () =>
    `Version ${APP_VERSION} | Built: ${BUILD_DATE}`;

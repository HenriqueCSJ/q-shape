/**
 * Application Metadata Constants
 *
 * Centralized version and build information for Q-Shape.
 * Update these values when releasing a new version.
 */

export const APP_VERSION = '1.6.0-rc.1';
export const BUILD_DATE = 'August 2026';
export const APP_NAME = 'Q-Shape';
export const APP_FULL_NAME = 'Q-Shape (Quantitative Shape Analyzer)';
export const RELEASE_STATUS = 'pre-release validation candidate';
const configuredBuildSha = process.env.REACT_APP_GIT_SHA || '';
export const APP_BUILD_SHA = /^[0-9a-f]{40}$/i.test(configuredBuildSha)
    ? configuredBuildSha.toLowerCase()
    : 'unavailable-local-build';

// Citation information
export const CITATION = {
    author: 'Castro Silva Junior, H.',
    year: 2026,
    title: 'Q-Shape - Quantitative Shape Analyzer',
    doi: null,
    url: 'https://github.com/HenriqueCSJ/q-shape',
    archiveStatus: 'archival DOI pending for this candidate'
};

// Format citation string
export const getCitationString = () =>
    `${CITATION.author} (${CITATION.year}). ${CITATION.title} ` +
    `(v${APP_VERSION}; ${RELEASE_STATUS}; ${CITATION.archiveStatus}).`;

// Version display string
export const getVersionString = () =>
    `Version ${APP_VERSION} | Built: ${BUILD_DATE} | Source: ${APP_BUILD_SHA}`;

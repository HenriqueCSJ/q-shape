/**
 * Application Metadata Constants
 *
 * Centralized version and build information for Q-Shape.
 * Update these values when releasing a new version.
 */

export const APP_VERSION = '1.6.0-rc.1';
export const APP_NAME = 'Q-Shape';
export const APP_FULL_NAME = 'Q-Shape (Quantitative Shape Analyzer)';
export const RELEASE_STATUS = 'pre-release validation candidate';

export const formatBuildTimestamp = (timestamp) => {
    if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
        return 'local development';
    }

    const iso = new Date(timestamp).toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

export const BUILD_DATE = formatBuildTimestamp(process.env.REACT_APP_BUILD_DATE);
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

const normalizedDoi = () => {
    if (!CITATION.doi) return null;
    return String(CITATION.doi)
        .trim()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
        .replace(/^doi:\s*/i, '');
};

export const getCitationLink = () => {
    const doi = normalizedDoi();
    if (doi) {
        return {
            href: `https://doi.org/${doi}`,
            label: `DOI: ${doi}`
        };
    }

    return {
        href: CITATION.url,
        label: 'Source repository'
    };
};

// Version display string
export const getVersionString = () =>
    `Version ${APP_VERSION} | Build: ${BUILD_DATE} | Source: ${APP_BUILD_SHA}`;

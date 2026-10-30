import packageMetadata from '../../package.json';
import zenodoMetadata from '../../.zenodo.json';
import {
    APP_VERSION,
    APP_BUILD_SHA,
    BUILD_DATE,
    CITATION,
    RELEASE_STATUS,
    formatBuildTimestamp,
    getCitationLink,
    getCitationString
} from './appMetadata';

describe('release identity metadata', () => {
    test('application package and archive metadata identify the same stable version', () => {
        expect(APP_VERSION).toBe('1.6.0');
        expect(packageMetadata.version).toBe(APP_VERSION);
        expect(zenodoMetadata.version).toBe(APP_VERSION);
        expect(zenodoMetadata.description).toContain('stable software release');
        expect(zenodoMetadata.description).not.toContain('quality metrics');
        expect(RELEASE_STATUS).toBe('stable software release');
        expect(APP_BUILD_SHA).toBe('unavailable-local-build');
        expect(BUILD_DATE).toBe('local development');
    });

    test('the stable version links the all-version archive without mislabelling the rc.2 DOI', () => {
        expect(CITATION.doi).toBe('10.5281/zenodo.17448251');
        expect(CITATION.url).toBe('https://github.com/HenriqueCSJ/q-shape');
        expect(getCitationString()).toContain('all-version archive; select the record for this software version');
        expect(getCitationString()).toContain('DOI: 10.5281/zenodo.17448251');
        expect(getCitationString()).not.toContain('pending');
        expect(getCitationString()).toContain('(v1.6.0; stable software release;');
        expect(getCitationString()).not.toContain('10.5281/zenodo.23806806');
        expect(getCitationString()).not.toContain('10.5281/zenodo.18209621');
        expect(getCitationLink()).toEqual({
            href: 'https://doi.org/10.5281/zenodo.17448251',
            label: 'DOI: 10.5281/zenodo.17448251'
        });
    });

    test('formats injected build timestamps instead of exposing a hardcoded month', () => {
        expect(formatBuildTimestamp('2026-08-30T14:27:00.000Z'))
            .toBe('2026-08-30 14:27 UTC');
        expect(formatBuildTimestamp('not-a-date')).toBe('local development');
    });
});

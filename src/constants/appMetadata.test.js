import packageMetadata from '../../package.json';
import zenodoMetadata from '../../.zenodo.json';
import {
    APP_VERSION,
    APP_BUILD_SHA,
    CITATION,
    RELEASE_STATUS,
    getCitationString
} from './appMetadata';

describe('release identity metadata', () => {
    test('application and package versions identify the same prerelease candidate', () => {
        expect(APP_VERSION).toBe('1.6.0-rc.1');
        expect(packageMetadata.version).toBe(APP_VERSION);
        expect(zenodoMetadata.version).toBe(APP_VERSION);
        expect(zenodoMetadata.description).toContain('pre-release validation candidate');
        expect(zenodoMetadata.description).not.toContain('quality metrics');
        expect(RELEASE_STATUS).toBe('pre-release validation candidate');
        expect(APP_BUILD_SHA).toBe('unavailable-local-build');
    });

    test('the candidate does not claim the archival DOI of v1.5.0', () => {
        expect(CITATION.doi).toBeNull();
        expect(CITATION.url).toBe('https://github.com/HenriqueCSJ/q-shape');
        expect(getCitationString()).toContain('archival DOI pending for this candidate');
        expect(getCitationString()).not.toContain('10.5281/zenodo.18209621');
    });
});

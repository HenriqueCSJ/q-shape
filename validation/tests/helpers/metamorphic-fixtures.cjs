'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    PREREGISTERED_DOCUMENT_SHA256,
    generateMetamorphicCases
} = require('../../scripts/metamorphic-cases.cjs');
const {
    DIRECT_REFERENCES_SHA256
} = require('../../scripts/prepare-metamorphic-references.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DIRECT_REFERENCES_PATH = path.resolve(
    __dirname,
    '..',
    'fixtures',
    'direct-parity-feec5b2-references.json'
);

let cachedCasesBytes = null;
let cachedCasesPath = null;

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function directReferencesPath() {
    const bytes = fs.readFileSync(DIRECT_REFERENCES_PATH);
    assert.equal(sha256(bytes), DIRECT_REFERENCES_SHA256);
    return DIRECT_REFERENCES_PATH;
}

function frozenCasesBytes() {
    if (!cachedCasesBytes) {
        const { document } = generateMetamorphicCases(REPO_ROOT);
        cachedCasesBytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
        assert.equal(sha256(cachedCasesBytes), PREREGISTERED_DOCUMENT_SHA256);
    }
    return Buffer.from(cachedCasesBytes);
}

function frozenCasesDocument() {
    return JSON.parse(frozenCasesBytes().toString('utf8'));
}

function frozenCasesPath() {
    if (!cachedCasesPath) {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-frozen-cases-'));
        cachedCasesPath = path.join(directory, 'cases.json');
        fs.writeFileSync(cachedCasesPath, frozenCasesBytes(), { flag: 'wx' });
    }
    return cachedCasesPath;
}

module.exports = {
    directReferencesPath,
    frozenCasesBytes,
    frozenCasesDocument,
    frozenCasesPath
};

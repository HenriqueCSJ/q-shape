'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const runner = require('../scripts/run-metamorphic-parity.cjs');
const worker = require('../scripts/qshape-metamorphic-worker.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CANDIDATE_COMMIT = '1'.repeat(40);
const CERTIFIED_DIRECT_REFERENCES_SHA256 =
    '170c444f035f4a67dc5388a03a23b27ba2ed1a96e3a1ec2e7f95c4d203f49787';
const CERTIFIED_DIRECT_PACKAGE_MANIFEST_SHA256 =
    '5ae614626fef9d60991d7c51804913e166d9b99c3163f10847a66f0b105260ca';

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    }
    return value;
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJsonFile(filePath) {
    const raw = fs.readFileSync(filePath);
    return {
        path: filePath,
        document: JSON.parse(raw.toString('utf8')),
        sha256: runner.sha256Buffer(raw)
    };
}

function expectedStatus(receipt) {
    return [
        '# Q-Shape metamorphic execution inputs',
        '',
        '- Status: preregistered input only.',
        '- Positive numerical execution started: no.',
        `- Source commit: \`${receipt.source_commit}\`.`,
        `- Positive cases SHA-256: \`${receipt.positive_cases.sha256}\`.`,
        `- Enhanced references SHA-256: \`${receipt.references.sha256}\`.`,
        `- Malformed controls SHA-256: \`${receipt.malformed_controls.sha256}\`.`,
        `- Bundle SHA-256: \`${receipt.bundle_sha256}\`.`,
        '- This directory must never receive SHAPE, Q-Shape, report, log, or verification outputs.',
        ''
    ].join('\n');
}

function inputBundleFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-provenance-'));
    const bundleRoot = path.join(root, 'frozen-input-bundle');
    fs.mkdirSync(bundleRoot);
    const casesPath = path.join(root, 'cases.json');
    const referencesPath = path.join(bundleRoot, 'references.json');
    const malformedPath = path.join(bundleRoot, 'malformed-controls.json');
    const receiptPath = path.join(bundleRoot, 'receipt.json');
    const cases = {
        schema_version: 1,
        campaign_id: 'qshape-metamorphic-adversarial-v1',
        count: 2,
        expected_matched_target_evaluations_per_program: 3,
        cases: []
    };
    const malformed = {
        schema_version: 1,
        campaign_id: 'qshape-metamorphic-malformed-v2',
        count: 2,
        controls: [
            { control_id: 'mal-a', expected_numeric_rows: 0 },
            { control_id: 'mal-b', expected_numeric_rows: 1 }
        ]
    };
    writeJson(casesPath, cases);
    writeJson(malformedPath, malformed);
    const casesFile = readJsonFile(casesPath);
    const references = {
        schema_version: 2,
        count: 1,
        source_cases_sha256: casesFile.sha256,
        metamorphic_binding: {
            campaign_id: cases.campaign_id,
            source_positive_cases_sha256: casesFile.sha256,
            source_direct_references_sha256: CERTIFIED_DIRECT_REFERENCES_SHA256,
            source_direct_package_manifest_sha256:
                CERTIFIED_DIRECT_PACKAGE_MANIFEST_SHA256
        },
        by_cn: []
    };
    writeJson(referencesPath, references);
    const referencesFile = readJsonFile(referencesPath);
    const malformedFile = readJsonFile(malformedPath);
    const contentContract = {
        schema_version: 2,
        receipt_kind: 'frozen-metamorphic-execution-input-bundle',
        campaign_id: 'qshape-metamorphic-execution-inputs-v1',
        source_commit: CANDIDATE_COMMIT,
        positive_cases: {
            campaign_id: cases.campaign_id,
            sha256: casesFile.sha256,
            count: cases.count,
            matched_target_evaluations_per_program:
                cases.expected_matched_target_evaluations_per_program
        },
        references: {
            sha256: referencesFile.sha256,
            count: references.count,
            source_direct_references_sha256:
                references.metamorphic_binding.source_direct_references_sha256,
            source_direct_package_manifest_sha256:
                references.metamorphic_binding.source_direct_package_manifest_sha256
        },
        malformed_controls: {
            campaign_id: malformed.campaign_id,
            sha256: malformedFile.sha256,
            count: malformed.count,
            expected_numeric_rows_contract: 'per-control',
            expected_numeric_rows_by_control: { 'mal-a': 0, 'mal-b': 1 },
            expected_numeric_rows_total: 1
        }
    };
    const bundleSha256 = runner.sha256Buffer(Buffer.from(
        JSON.stringify(stable(contentContract)), 'utf8'
    ));
    const receipt = {
        ...contentContract,
        status: 'preregistered_execution_inputs',
        positive_execution_started: false,
        output_policy: 'input-only directory; numerical outputs are forbidden',
        bundle_sha256: bundleSha256,
        files: {
            references: 'references.json',
            malformed_controls: 'malformed-controls.json',
            receipt: 'receipt.json',
            status: 'STATUS.md'
        }
    };
    fs.writeFileSync(receiptPath, `${JSON.stringify(stable(receipt), null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(bundleRoot, 'STATUS.md'), expectedStatus(receipt), 'utf8');
    return {
        root,
        bundleRoot,
        receipt,
        casesFile,
        referencesFile,
        malformedFile,
        receiptFile: readJsonFile(receiptPath)
    };
}

test('runner CLI requires the explicit frozen input-bundle receipt', () => {
    assert.throws(() => runner.parseArguments([
        '--output', 'out',
        '--cases', 'cases.json',
        '--references', 'references.json',
        '--malformed-controls', 'malformed.json'
    ]), error => error.code === 'USAGE' && /input-bundle-receipt/.test(error.message));
    assert.equal(runner.parseArguments([
        '--output', 'out',
        '--cases', 'cases.json',
        '--references', 'references.json',
        '--malformed-controls', 'malformed.json',
        '--input-bundle-receipt', 'receipt.json'
    ]).inputBundleReceipt, 'receipt.json');
});

test('runner reconstructs the exact receipt, source-commit, bundle, and four-file boundary', () => {
    const fixture = inputBundleFixture();
    try {
        const result = runner.validateInputBundleReceipt(
            fixture.receiptFile,
            fixture.casesFile,
            fixture.referencesFile,
            fixture.malformedFile,
            CANDIDATE_COMMIT
        );
        assert.equal(result.bundleSha256, fixture.receipt.bundle_sha256);
        assert.throws(() => runner.validateInputBundleReceipt(
            fixture.receiptFile,
            fixture.casesFile,
            fixture.referencesFile,
            fixture.malformedFile,
            '2'.repeat(40)
        ), error => error.code === 'INPUT_BUNDLE_RECEIPT_INVALID');

        fs.appendFileSync(fixture.receiptFile.path, ' ');
        assert.throws(() => runner.validateInputBundleReceipt(
            fixture.receiptFile,
            fixture.casesFile,
            fixture.referencesFile,
            fixture.malformedFile,
            CANDIDATE_COMMIT
        ), error => error.code === 'INPUT_BUNDLE_RECEIPT_INVALID' && /canonical/.test(error.message));
        fs.writeFileSync(
            fixture.receiptFile.path,
            `${JSON.stringify(stable(fixture.receipt), null, 2)}\n`,
            'utf8'
        );
        fs.writeFileSync(path.join(fixture.bundleRoot, 'unexpected-output.txt'), 'forbidden\n');
        assert.throws(() => runner.validateInputBundleReceipt(
            fixture.receiptFile,
            fixture.casesFile,
            fixture.referencesFile,
            fixture.malformedFile,
            CANDIDATE_COMMIT
        ), error => error.code === 'INPUT_BUNDLE_RECEIPT_INVALID');
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('runner and in-process worker independently capture one exact effective Node identity', () => {
    const lockSha256 = runner.sha256File(path.join(REPO_ROOT, 'package-lock.json'));
    const runnerRuntime = runner.captureRuntimeIdentity(REPO_ROOT, lockSha256);
    const workerRuntime = worker.captureWorkerRuntimeIdentity(REPO_ROOT, 'in_process_runner');
    assert.deepEqual(workerRuntime, runnerRuntime);
    assert.equal(runner.validateRuntimeIdentity(runnerRuntime.identity, lockSha256), true);
    assert.equal(runnerRuntime.identity.node_version, process.version);
    assert.equal(runnerRuntime.identity.node_versions_node, process.versions.node);
    assert.equal(runnerRuntime.identity.v8_version, process.versions.v8);
    assert.equal(runnerRuntime.identity.platform, process.platform);
    assert.equal(runnerRuntime.identity.arch, process.arch);
    assert.equal(runnerRuntime.identity.dependency_lockfile.sha256, lockSha256);
    assert.match(runnerRuntime.identity.node_executable_sha256, /^[0-9a-f]{64}$/);

    assert.throws(() => worker.runWorker({
        repo: REPO_ROOT,
        cases: path.join(REPO_ROOT, 'does-not-need-to-exist.json'),
        executionProcess: 'in_process_runner',
        runtimeIdentity: runnerRuntime.identity,
        runtimeIdentitySha256: '0'.repeat(64)
    }), /does not match the in-process runner identity/);
    assert.throws(() => runner.validateRuntimeIdentity(
        runnerRuntime.identity,
        '0'.repeat(64)
    ), error => error.code === 'RUNTIME_INVALID');
});

test('runtime identity distinguishes an unset locale variable from an explicit empty value', () => {
    const lockSha256 = runner.sha256File(path.join(REPO_ROOT, 'package-lock.json'));
    const hadLanguage = Object.prototype.hasOwnProperty.call(process.env, 'LANGUAGE');
    const previousLanguage = process.env.LANGUAGE;
    try {
        delete process.env.LANGUAGE;
        const unsetRunner = runner.captureRuntimeIdentity(REPO_ROOT, lockSha256);
        const unsetWorker = worker.captureWorkerRuntimeIdentity(REPO_ROOT, 'in_process_runner');
        assert.deepEqual(unsetWorker, unsetRunner);
        assert.equal(unsetRunner.identity.environment_locale.language, null);

        process.env.LANGUAGE = '';
        const emptyRunner = runner.captureRuntimeIdentity(REPO_ROOT, lockSha256);
        const emptyWorker = worker.captureWorkerRuntimeIdentity(REPO_ROOT, 'in_process_runner');
        assert.deepEqual(emptyWorker, emptyRunner);
        assert.equal(emptyRunner.identity.environment_locale.language, '');
        assert.equal(emptyRunner.identity.intl_locale, unsetRunner.identity.intl_locale);
        assert.equal(emptyRunner.identity.intl_time_zone, unsetRunner.identity.intl_time_zone);
        assert.notEqual(emptyRunner.identitySha256, unsetRunner.identitySha256);
    } finally {
        if (hadLanguage) process.env.LANGUAGE = previousLanguage;
        else delete process.env.LANGUAGE;
    }
});

#!/usr/bin/env node
'use strict';

/*
 * Fresh-output orchestrator for the preregistered metamorphic campaign.
 *
 * This file owns execution order and evidence placement.  Case generation,
 * SHAPE scheduling, Q-Shape calculation, analysis, and verification remain
 * separate components and can be injected in tests.  In particular, the
 * default runner never invents a SHAPE result: a SHAPE executor must be
 * supplied by the caller.
 */

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const scheduleModule = require('./metamorphic-schedule.cjs');
const qWorker = require('./qshape-metamorphic-worker.cjs');
const analysisModule = require('./metamorphic-parity-analysis.cjs');
const malformedModule = require('./metamorphic-malformed-controls.cjs');
const reportingModule = require('./metamorphic-reporting.cjs');
const productionAdapters = require('./metamorphic-production-adapters.cjs');

const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const CONTROL_CAMPAIGN_ID = 'qshape-metamorphic-malformed-v1';
const EXECUTION_INPUT_CAMPAIGN_ID = 'qshape-metamorphic-execution-inputs-v1';
const EXECUTION_INPUT_RECEIPT_KIND = 'frozen-metamorphic-execution-input-bundle';
const RUNTIME_IDENTITY_KIND = 'qshape-node-runtime-v1';
const QSHAPE_PROCESS_MODEL = 'in_process_runner';
const CASES_SHA256 = qWorker.CAMPAIGN_CASES_SHA256;
const SHAPE_REPETITIONS = Object.freeze([1, 2]);
const Q_STREAMS = Object.freeze([...analysisModule.Q_STREAMS]);
const DEFAULT_SHAPE_CONCURRENCY = 2;
const RECEIPT_SCHEMA_VERSION = 2;
const PACKAGE_SCHEMA_VERSION = 2;
const CANDIDATE_SOURCE_PATHS = Object.freeze([
    '.gitattributes',
    'package.json',
    'package-lock.json',
    'src/constants/algorithmConstants.js',
    'src/constants/referenceGeometries/index.js',
    'src/services/algorithms/hungarian.js',
    'src/services/algorithms/kabsch.js',
    'src/services/shapeAnalysis/shapeCalculator.js',
    'validation/protocol.md',
    'validation/scripts/direct-parity-core.cjs',
    'validation/scripts/freeze-metamorphic-execution-inputs.cjs',
    'validation/scripts/metamorphic-cases.cjs',
    'validation/scripts/metamorphic-malformed-controls.cjs',
    'validation/scripts/metamorphic-parity-analysis.cjs',
    'validation/scripts/metamorphic-production-adapters.cjs',
    'validation/scripts/metamorphic-reporting.cjs',
    'validation/scripts/metamorphic-schedule.cjs',
    'validation/scripts/prepare-metamorphic-references.cjs',
    'validation/scripts/qshape-metamorphic-worker.cjs',
    'validation/scripts/run-metamorphic-parity.cjs',
    'validation/scripts/verify-metamorphic-parity.cjs'
]);

function fail(message, code) {
    const error = new Error(message);
    if (code) error.code = code;
    throw error;
}

function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function sha256Buffer(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
    return sha256Buffer(fs.readFileSync(filePath));
}

function exactObjectKeys(value, expected, label, code = 'INPUT_BUNDLE_RECEIPT_INVALID') {
    const observed = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value).sort() : [];
    const wanted = [...expected].sort();
    if (JSON.stringify(observed) !== JSON.stringify(wanted)) {
        fail(`${label} fields differ: observed ${observed.join(',')}; expected ${wanted.join(',')}`,
            code);
    }
}

function runtimeIdentitySha256(identity) {
    return sha256Buffer(Buffer.from(JSON.stringify(stable(identity)), 'utf8'));
}

function captureRuntimeIdentity(repoRoot, dependencyLockfileSha256) {
    const executablePath = fs.realpathSync.native(path.resolve(process.execPath));
    const executableStat = fs.statSync(executablePath);
    if (!executableStat.isFile()) fail('The effective Node executable is not a regular file', 'RUNTIME_INVALID');
    const intl = Intl.DateTimeFormat().resolvedOptions();
    const identity = {
        schema_version: 1,
        identity_kind: RUNTIME_IDENTITY_KIND,
        process_model: QSHAPE_PROCESS_MODEL,
        node_version: process.version,
        node_versions_node: process.versions.node,
        v8_version: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
        node_executable_path: executablePath,
        node_executable_sha256: sha256File(executablePath),
        node_executable_size_bytes: executableStat.size,
        intl_locale: intl.locale || null,
        intl_time_zone: intl.timeZone || null,
        environment_locale: {
            lc_all: process.env.LC_ALL || null,
            lang: process.env.LANG || null,
            language: process.env.LANGUAGE || null
        },
        environment_time_zone: process.env.TZ || null,
        dependency_lockfile: {
            path: 'package-lock.json',
            sha256: dependencyLockfileSha256
        }
    };
    validateRuntimeIdentity(identity, dependencyLockfileSha256);
    return { identity, identitySha256: runtimeIdentitySha256(identity) };
}

function initialRuntimeEvidence(runtime) {
    return {
        schema_version: 1,
        identity_sha256: runtime.identitySha256,
        qshape_worker_execution: 'in-process; no child Node process is used',
        identity: clone(runtime.identity)
    };
}

function validateRuntimeIdentity(identity, dependencyLockfileSha256) {
    exactObjectKeys(identity, [
        'schema_version', 'identity_kind', 'process_model', 'node_version',
        'node_versions_node', 'v8_version', 'platform', 'arch',
        'node_executable_path', 'node_executable_sha256', 'node_executable_size_bytes',
        'intl_locale', 'intl_time_zone', 'environment_locale', 'environment_time_zone',
        'dependency_lockfile'
    ], 'runtime identity', 'RUNTIME_INVALID');
    exactObjectKeys(identity.environment_locale, ['lc_all', 'lang', 'language'],
        'runtime environment locale', 'RUNTIME_INVALID');
    exactObjectKeys(identity.dependency_lockfile, ['path', 'sha256'],
        'runtime dependency lockfile', 'RUNTIME_INVALID');
    const valid = identity.schema_version === 1 && identity.identity_kind === RUNTIME_IDENTITY_KIND &&
        identity.process_model === QSHAPE_PROCESS_MODEL &&
        typeof identity.node_version === 'string' && /^v\d+\.\d+\.\d+/.test(identity.node_version) &&
        identity.node_versions_node === identity.node_version.slice(1) &&
        typeof identity.v8_version === 'string' && identity.v8_version.length > 0 &&
        typeof identity.platform === 'string' && identity.platform.length > 0 &&
        typeof identity.arch === 'string' && identity.arch.length > 0 &&
        path.isAbsolute(identity.node_executable_path) &&
        /^[0-9a-f]{64}$/.test(identity.node_executable_sha256) &&
        Number.isInteger(identity.node_executable_size_bytes) && identity.node_executable_size_bytes > 0 &&
        (identity.intl_locale === null || typeof identity.intl_locale === 'string') &&
        (identity.intl_time_zone === null || typeof identity.intl_time_zone === 'string') &&
        Object.values(identity.environment_locale).every(value => value === null || typeof value === 'string') &&
        (identity.environment_time_zone === null || typeof identity.environment_time_zone === 'string') &&
        identity.dependency_lockfile.path === 'package-lock.json' &&
        identity.dependency_lockfile.sha256 === dependencyLockfileSha256 &&
        /^[0-9a-f]{64}$/.test(identity.dependency_lockfile.sha256);
    if (!valid) fail('The effective Node runtime identity is incomplete or inconsistent', 'RUNTIME_INVALID');
    return true;
}

function regularFile(filePath, label) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        fail(`${label || 'File'} is not a regular file: ${resolved}`);
    }
    return resolved;
}

function regularDirectory(directoryPath, label) {
    const resolved = path.resolve(directoryPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        fail(`${label || 'Directory'} is not a directory: ${resolved}`, 'CANDIDATE_REPO_INVALID');
    }
    return resolved;
}

function normalizeSourcePath(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0 ||
        relativePath.includes('\\') || path.posix.isAbsolute(relativePath)) {
        fail(`Invalid candidate source path: ${relativePath}`, 'CANDIDATE_SOURCE_PATH_INVALID');
    }
    const normalized = path.posix.normalize(relativePath);
    if (normalized !== relativePath || normalized === '..' || normalized.startsWith('../')) {
        fail(`Unsafe candidate source path: ${relativePath}`, 'CANDIDATE_SOURCE_PATH_INVALID');
    }
    return normalized;
}

function runGit(repoRoot, args, label, options = {}) {
    const result = childProcess.spawnSync('git', args, {
        cwd: repoRoot,
        encoding: options.buffer ? null : 'utf8',
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024
    });
    if (result.error || result.status !== 0) {
        const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
        fail(`${label || 'Git command'} failed: ${result.error?.message || stderr.trim() || `exit ${result.status}`}`,
            options.code || 'CANDIDATE_GIT_FAILED');
    }
    return result.stdout;
}

function samePath(left, right) {
    const a = fs.realpathSync.native(path.resolve(left));
    const b = fs.realpathSync.native(path.resolve(right));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function pathIsInside(root, candidate) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function captureCandidateSource(repoPath, sourcePaths = CANDIDATE_SOURCE_PATHS) {
    const requestedRoot = regularDirectory(repoPath, 'Candidate repository');
    const discoveredRoot = String(runGit(requestedRoot, ['rev-parse', '--show-toplevel'], 'Candidate repository discovery')).trim();
    if (!discoveredRoot || !samePath(requestedRoot, discoveredRoot)) {
        fail(`--repo must name the candidate Git worktree root: ${requestedRoot}`, 'CANDIDATE_REPO_INVALID');
    }
    const status = String(runGit(requestedRoot, ['status', '--porcelain=v1', '--untracked-files=all'],
        'Candidate cleanliness check')).trim();
    if (status) {
        fail('Candidate Git worktree is dirty; commit the candidate and validation harness before execution',
            'CANDIDATE_WORKTREE_DIRTY');
    }
    const commit = String(runGit(requestedRoot, ['rev-parse', '--verify', 'HEAD'], 'Candidate commit')).trim().toLowerCase();
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit)) {
        fail(`Candidate commit is invalid: ${commit}`, 'CANDIDATE_COMMIT_INVALID');
    }
    const branchToken = String(runGit(requestedRoot, ['branch', '--show-current'], 'Candidate branch')).trim();
    const normalizedPaths = sourcePaths.map(normalizeSourcePath);
    if (new Set(normalizedPaths).size !== normalizedPaths.length || !normalizedPaths.includes('package-lock.json')) {
        fail('Candidate source path contract is duplicate or lacks package-lock.json', 'CANDIDATE_SOURCE_CONTRACT_INVALID');
    }
    const buffers = new Map();
    const files = normalizedPaths.map(relativePath => {
        const absolute = path.join(requestedRoot, ...relativePath.split('/'));
        if (!fs.existsSync(absolute)) fail(`Candidate source file is missing: ${relativePath}`, 'CANDIDATE_SOURCE_MISSING');
        const stat = fs.lstatSync(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            fail(`Candidate source is not a regular non-symlink file: ${relativePath}`, 'CANDIDATE_SOURCE_INVALID');
        }
        const committed = runGit(requestedRoot, ['show', `HEAD:${relativePath}`],
            `Committed candidate source ${relativePath}`, { buffer: true, code: 'CANDIDATE_SOURCE_UNCOMMITTED' });
        const working = fs.readFileSync(absolute);
        if (!working.equals(committed)) {
            fail(`Candidate source bytes do not match HEAD: ${relativePath}`, 'CANDIDATE_SOURCE_UNCOMMITTED');
        }
        const gitBlobOid = String(runGit(requestedRoot, ['rev-parse', `HEAD:${relativePath}`],
            `Candidate blob ${relativePath}`)).trim().toLowerCase();
        buffers.set(relativePath, Buffer.from(committed));
        return {
            path: relativePath,
            size_bytes: committed.length,
            sha256: sha256Buffer(committed),
            git_blob_oid: gitBlobOid
        };
    });
    const treeContract = { repo_commit: commit, files };
    const identity = {
        schema_version: 1,
        identity_kind: 'clean-committed-qshape-candidate',
        repo_commit: commit,
        repo_branch: branchToken || null,
        detached_head: branchToken.length === 0,
        worktree_clean_at_start: true,
        dependency_lockfile: {
            path: 'package-lock.json',
            sha256: files.find(item => item.path === 'package-lock.json').sha256
        },
        source_tree_sha256: sha256Buffer(Buffer.from(stableJson(treeContract), 'utf8')),
        files
    };
    return { repoRoot: requestedRoot, identity, buffers };
}

function snapshotFilePaths(snapshotRoot, current = snapshotRoot) {
    const paths = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(current, entry.name);
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) fail(`Candidate snapshot contains a symlink: ${absolute}`, 'CANDIDATE_SNAPSHOT_CHANGED');
        if (stat.isDirectory()) paths.push(...snapshotFilePaths(snapshotRoot, absolute));
        else if (stat.isFile()) paths.push(path.relative(snapshotRoot, absolute).split(path.sep).join('/'));
        else fail(`Candidate snapshot contains a non-file entry: ${absolute}`, 'CANDIDATE_SNAPSHOT_CHANGED');
    }
    return paths.sort();
}

function writeCandidateSnapshot(outputRoot, candidate) {
    const snapshotRoot = path.join(outputRoot, 'inputs', 'candidate-snapshot');
    for (const file of candidate.identity.files) {
        const destination = path.join(snapshotRoot, ...file.path.split('/'));
        writeExclusive(destination, candidate.buffers.get(file.path));
        if (sha256File(destination) !== file.sha256) {
            fail(`Candidate snapshot copy mismatch: ${file.path}`, 'CANDIDATE_SNAPSHOT_CHANGED');
        }
    }
    writeExclusive(path.join(snapshotRoot, 'identity.json'), stableJson(candidate.identity), { encoding: 'utf8' });
    return sha256File(path.join(snapshotRoot, 'identity.json'));
}

function verifyCandidateSnapshot(outputRoot, expectedIdentity) {
    const snapshotRoot = path.join(outputRoot, 'inputs', 'candidate-snapshot');
    const identityPath = path.join(snapshotRoot, 'identity.json');
    const retained = readJson(identityPath, 'Candidate snapshot identity');
    if (stableJson(retained.document) !== stableJson(expectedIdentity)) {
        fail('Retained candidate identity differs from the current clean committed candidate', 'CANDIDATE_SOURCE_CHANGED');
    }
    const expectedPaths = [...expectedIdentity.files.map(item => item.path), 'identity.json'].sort();
    if (JSON.stringify(snapshotFilePaths(snapshotRoot)) !== JSON.stringify(expectedPaths)) {
        fail('Candidate snapshot file set changed', 'CANDIDATE_SNAPSHOT_CHANGED');
    }
    for (const file of expectedIdentity.files) {
        const retainedPath = path.join(snapshotRoot, ...file.path.split('/'));
        if (sha256File(retainedPath) !== file.sha256 || fs.statSync(retainedPath).size !== file.size_bytes) {
            fail(`Candidate snapshot bytes changed: ${file.path}`, 'CANDIDATE_SNAPSHOT_CHANGED');
        }
    }
    return retained.sha256;
}

function readJson(filePath, label) {
    const resolved = regularFile(filePath, label);
    let document;
    try {
        document = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } catch (error) {
        fail(`${label || 'JSON file'} is not valid JSON: ${error.message}`);
    }
    return { path: resolved, document, sha256: sha256File(resolved) };
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    }
    return value;
}

function stableJson(value) {
    return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function inputBundleContentContract(receipt) {
    return {
        schema_version: receipt.schema_version,
        receipt_kind: receipt.receipt_kind,
        campaign_id: receipt.campaign_id,
        source_commit: receipt.source_commit,
        positive_cases: receipt.positive_cases,
        references: receipt.references,
        malformed_controls: receipt.malformed_controls
    };
}

function expectedInputBundleStatus(receipt) {
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

function validateInputBundleReceipt(receiptFile, casesFile, referencesFile, malformedControlsFile,
    candidateCommit, options = {}) {
    const receipt = receiptFile.document;
    exactObjectKeys(receipt, [
        'schema_version', 'receipt_kind', 'campaign_id', 'source_commit',
        'positive_cases', 'references', 'malformed_controls', 'status',
        'positive_execution_started', 'output_policy', 'bundle_sha256', 'files'
    ], 'execution-input receipt');
    exactObjectKeys(receipt.positive_cases, [
        'campaign_id', 'sha256', 'count', 'matched_target_evaluations_per_program'
    ], 'execution-input positive cases');
    exactObjectKeys(receipt.references, [
        'sha256', 'count', 'source_direct_references_sha256'
    ], 'execution-input references');
    exactObjectKeys(receipt.malformed_controls, [
        'campaign_id', 'sha256', 'count', 'expected_numeric_rows_contract',
        'expected_numeric_rows_by_control', 'expected_numeric_rows_total'
    ], 'execution-input malformed controls');
    exactObjectKeys(receipt.files, ['references', 'malformed_controls', 'receipt', 'status'],
        'execution-input receipt file registry');

    const expectedRowsByControl = Object.fromEntries(
        malformedControlsFile.document.controls.map(control => [control.control_id, control.expected_numeric_rows])
    );
    const expectedRowsTotal = Object.values(expectedRowsByControl)
        .reduce((sum, value) => sum + Number(value), 0);
    const directReferencesSha256 =
        referencesFile.document?.metamorphic_binding?.source_direct_references_sha256;
    const valid = receipt.schema_version === 2 &&
        receipt.receipt_kind === EXECUTION_INPUT_RECEIPT_KIND &&
        receipt.campaign_id === EXECUTION_INPUT_CAMPAIGN_ID &&
        receipt.source_commit === candidateCommit && /^[0-9a-f]{40}$/.test(receipt.source_commit) &&
        receipt.status === 'preregistered_execution_inputs' &&
        receipt.positive_execution_started === false &&
        receipt.output_policy === 'input-only directory; numerical outputs are forbidden' &&
        receipt.positive_cases.campaign_id === casesFile.document.campaign_id &&
        receipt.positive_cases.sha256 === casesFile.sha256 &&
        receipt.positive_cases.count === casesFile.document.count &&
        receipt.positive_cases.matched_target_evaluations_per_program ===
            casesFile.document.expected_matched_target_evaluations_per_program &&
        receipt.references.sha256 === referencesFile.sha256 &&
        receipt.references.count === referencesFile.document.count &&
        receipt.references.source_direct_references_sha256 === directReferencesSha256 &&
        /^[0-9a-f]{64}$/.test(directReferencesSha256 || '') &&
        receipt.malformed_controls.campaign_id === malformedControlsFile.document.campaign_id &&
        receipt.malformed_controls.sha256 === malformedControlsFile.sha256 &&
        receipt.malformed_controls.count === malformedControlsFile.document.count &&
        receipt.malformed_controls.expected_numeric_rows_contract === 'per-control' &&
        stableJson(receipt.malformed_controls.expected_numeric_rows_by_control) ===
            stableJson(expectedRowsByControl) &&
        receipt.malformed_controls.expected_numeric_rows_total === expectedRowsTotal &&
        receipt.files.references === 'references.json' &&
        receipt.files.malformed_controls === 'malformed-controls.json' &&
        receipt.files.receipt === 'receipt.json' && receipt.files.status === 'STATUS.md';
    if (!valid) fail('Execution-input receipt does not exactly bind the candidate and frozen inputs',
        'INPUT_BUNDLE_RECEIPT_INVALID');

    const expectedBundleSha256 = sha256Buffer(Buffer.from(
        JSON.stringify(stable(inputBundleContentContract(receipt))), 'utf8'
    ));
    if (receipt.bundle_sha256 !== expectedBundleSha256) {
        fail('Execution-input bundle SHA-256 is inconsistent with its content contract',
            'INPUT_BUNDLE_RECEIPT_INVALID');
    }
    const expectedReceiptBytes = Buffer.from(stableJson(receipt), 'utf8');
    if (!fs.readFileSync(receiptFile.path).equals(expectedReceiptBytes)) {
        fail('Execution-input receipt bytes are not canonical', 'INPUT_BUNDLE_RECEIPT_INVALID');
    }

    const bundleDirectory = path.dirname(receiptFile.path);
    if (!samePath(bundleDirectory, path.dirname(referencesFile.path)) ||
        !samePath(bundleDirectory, path.dirname(malformedControlsFile.path))) {
        fail('Execution-input files do not come from one frozen bundle directory',
            'INPUT_BUNDLE_RECEIPT_INVALID');
    }
    const statusPath = path.join(bundleDirectory, 'STATUS.md');
    if (options.requireBundleDirectory !== false) {
        const entries = fs.readdirSync(bundleDirectory, { withFileTypes: true });
        const names = entries.map(entry => entry.name).sort();
        if (JSON.stringify(names) !== JSON.stringify(['STATUS.md', 'malformed-controls.json', 'receipt.json', 'references.json']) ||
            entries.some(entry => !entry.isFile() || fs.lstatSync(path.join(bundleDirectory, entry.name)).isSymbolicLink())) {
            fail('Execution-input bundle directory does not contain the exact four regular files',
                'INPUT_BUNDLE_RECEIPT_INVALID');
        }
        if (fs.readFileSync(statusPath, 'utf8') !== expectedInputBundleStatus(receipt)) {
            fail('Execution-input STATUS.md does not exactly match the receipt',
                'INPUT_BUNDLE_RECEIPT_INVALID');
        }
    }
    return { receipt, bundleSha256: expectedBundleSha256, statusPath };
}

function jsonValue(value) {
    return JSON.stringify(value, (_key, item) => {
        if (Buffer.isBuffer(item)) return { type: 'Buffer', data: item.toString('base64') };
        if (typeof item === 'bigint') return `${item}n`;
        if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack };
        return item;
    }, 2) + '\n';
}

function ensureParent(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeExclusive(filePath, content, options = {}) {
    ensureParent(filePath);
    fs.writeFileSync(filePath, content, { flag: 'wx', ...options });
}

function replaceFile(filePath, content, options = {}) {
    ensureParent(filePath);
    const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    fs.writeFileSync(temporary, content, options);
    fs.renameSync(temporary, filePath);
}

function writeJsonExclusive(filePath, value) {
    writeExclusive(filePath, jsonValue(value), { encoding: 'utf8' });
}

function writeJsonReplace(filePath, value) {
    replaceFile(filePath, jsonValue(value), { encoding: 'utf8' });
}

function toBuffer(value) {
    if (value === undefined || value === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    return Buffer.from(String(value), 'utf8');
}

function invocationResult(result) {
    if (result && result.payload && Array.isArray(result.payload.results)) return result.payload;
    if (result && Array.isArray(result.results)) return result;
    if (result && Array.isArray(result.rows)) return result;
    if (result && result.output && Array.isArray(result.output.results)) return result.output;
    if (result && result.output && Array.isArray(result.output.rows)) return result.output;
    return result || {};
}

function rowsFrom(result) {
    const value = invocationResult(result);
    if (Array.isArray(value.results)) return value.results;
    if (Array.isArray(value.rows)) return value.rows;
    return [];
}

function csvCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const columns = [...new Set(rows.flatMap(row => Object.keys(row || {})))].sort();
    return `${columns.join(',')}\n${rows.map(row => columns.map(column => csvCell(row?.[column])).join(',')).join('\n')}\n`;
}

function writeAnalysisArtifacts(outputRoot, analysis) {
    const reports = path.join(outputRoot, 'reports');
    const comparisons = analysis?.comparison_rows || analysis?.comparisonRows || [];
    const summaries = analysis?.case_summaries || analysis?.caseSummaries || [];
    const failures = analysis?.failure_ledger || analysis?.failureLedger || analysis?.failures || [];
    replaceFile(path.join(reports, 'comparison-rows.csv'), rowsToCsv(comparisons), { encoding: 'utf8' });
    replaceFile(path.join(reports, 'case-summaries.csv'), rowsToCsv(summaries), { encoding: 'utf8' });
    replaceFile(path.join(reports, 'failure-ledger.csv'), rowsToCsv(failures), { encoding: 'utf8' });
    writeJsonReplace(path.join(reports, 'data-dictionary.json'), {
        schema_version: 1,
        files: {
            'comparison-rows.csv': 'one row per case, target, and Q-Shape stream',
            'case-summaries.csv': 'one ranking summary per case and Q-Shape stream',
            'failure-ledger.csv': 'all numerical and operational failures retained without omission'
        },
        analysis_keys: Object.keys(analysis || {}).sort()
    });
}

function validateMalformedObservations(document, frozenDocument, expectedControlsSha256 = null) {
    if (!document || document.schema_version !== 1 || document.campaign_id !== CONTROL_CAMPAIGN_ID ||
        document.evidence_scope !== 'product_boundaries' || document.product_boundary_invoked !== true ||
        !Array.isArray(document.controls) || document.controls.length !== Number(document.count)) {
        fail('Malformed control package has an invalid product-boundary envelope', 'MALFORMED_OBSERVATIONS_INVALID');
    }
    if (!frozenDocument || !Array.isArray(frozenDocument.controls) ||
        frozenDocument.controls.length !== document.controls.length ||
        document.source_positive_cases_sha256 !== frozenDocument.source_positive_cases_sha256 ||
        (expectedControlsSha256 && document.source_controls_sha256 !== expectedControlsSha256)) {
        fail('Malformed observations are not bound to the frozen controls', 'MALFORMED_OBSERVATIONS_INVALID');
    }
    const expectedById = new Map(frozenDocument.controls.map(control => [control.control_id, control]));
    if (expectedById.size !== frozenDocument.controls.length) {
        fail('Frozen malformed controls contain duplicate identifiers', 'MALFORMED_OBSERVATIONS_INVALID');
    }
    const observedIds = new Set();
    let passed = 0;
    for (const control of document.controls) {
        const expected = expectedById.get(control.control_id);
        if (!expected || observedIds.has(control.control_id)) {
            fail(`Malformed observation identity is unknown or duplicated: ${control.control_id || '<missing>'}`,
                'MALFORMED_OBSERVATIONS_INVALID');
        }
        observedIds.add(control.control_id);
        const numericRows = control.observed_numeric_rows;
        const contractMatches = control.expected_outcome === expected.expected_outcome &&
            control.expected_numeric_rows === expected.expected_numeric_rows &&
            control.program === expected.program && control.interface === expected.interface &&
            control.category === expected.category && control.cn === expected.cn &&
            control.source_parent_case_id === expected.source_parent_case_id &&
            control.campaign_gate === 'malformed_control_contract';
        if (!contractMatches || control.observation_complete !== true ||
            control.product_boundary_invoked !== true ||
            typeof control.observed_outcome !== 'string' || control.observed_outcome.length === 0 ||
            !Number.isInteger(numericRows) || numericRows < 0 ||
            !Array.isArray(control.raw_evidence_paths)) {
            fail(`Malformed observation is structurally incomplete: ${control.control_id}`,
                'MALFORMED_OBSERVATIONS_INVALID');
        }
        const expectedStatus = control.observed_outcome === control.expected_outcome &&
            numericRows === control.expected_numeric_rows ? 'pass' : 'fail';
        if (control.status !== expectedStatus) {
            fail(`Malformed observation status is inconsistent: ${control.control_id}`,
                'MALFORMED_OBSERVATIONS_INVALID');
        }
        if (expectedStatus === 'pass') passed += 1;
    }
    if (observedIds.size !== expectedById.size || passed !== document.passed ||
        document.failed !== document.count - passed ||
        document.campaign_gate_status !== (passed === document.count ? 'pass' : 'fail')) {
        fail('Malformed observation census or campaign status is inconsistent', 'MALFORMED_OBSERVATIONS_INVALID');
    }
    return true;
}

function shapeRowEvidence(result) {
    const rows = rowsFrom(result);
    return rows.map(row => ({ ...row }));
}

function validateQPayloadRuntime(payload, expectedIdentity, expectedIdentitySha256, stream) {
    if (!payload || payload.execution_process !== QSHAPE_PROCESS_MODEL ||
        payload.runtime_identity_sha256 !== expectedIdentitySha256 ||
        stableJson(payload.runtime_identity) !== stableJson(expectedIdentity)) {
        fail(`Q-Shape stream ${stream} is not bound to the in-process runner runtime`,
            'Q_RUNTIME_BINDING_INVALID');
    }
    return true;
}

function readRetainedQStream(streamDir, stream, expectedRows, validateRowCounts,
    expectedRuntimeIdentity, expectedRuntimeIdentitySha256) {
    const required = ['payload.json', 'rows.json', 'stdout.txt', 'stderr.txt', 'exit-code.txt', 'raw-result.json'];
    for (const name of required) {
        const filePath = path.join(streamDir, name);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            fail(`Retained Q-Shape ${stream} lacks ${name}`, 'Q_STREAM_CHECKPOINT_CORRUPT');
        }
    }
    if (fs.readFileSync(path.join(streamDir, 'exit-code.txt'), 'utf8') !== '0\n') {
        fail(`Retained Q-Shape stream ${stream} does not have an exact zero exit code`, 'Q_STREAM_CHECKPOINT_CORRUPT');
    }
    let rows;
    let payload;
    let rawResult;
    try {
        rows = JSON.parse(fs.readFileSync(path.join(streamDir, 'rows.json'), 'utf8'));
        payload = JSON.parse(fs.readFileSync(path.join(streamDir, 'payload.json'), 'utf8'));
        rawResult = JSON.parse(fs.readFileSync(path.join(streamDir, 'raw-result.json'), 'utf8'));
    } catch (error) {
        fail(`Retained Q-Shape stream ${stream} JSON is corrupt: ${error.message}`, 'Q_STREAM_CHECKPOINT_CORRUPT');
    }
    if (!Array.isArray(rows) ||
        (validateRowCounts && rows.length !== expectedRows) ||
        JSON.stringify(rowsFrom(payload)) !== JSON.stringify(rows) ||
        JSON.stringify(rowsFrom(rawResult)) !== JSON.stringify(rows)) {
        fail(`Retained Q-Shape stream ${stream} evidence is inconsistent`, 'Q_STREAM_CHECKPOINT_CORRUPT');
    }
    validateQPayloadRuntime(payload, expectedRuntimeIdentity, expectedRuntimeIdentitySha256, stream);
    return rows;
}

function sidecarPath(outputRoot) {
    return `${outputRoot}.verification.json`;
}

function qualificationIdentity(result) {
    return {
        shape_version: result?.shape_version || null,
        executable_sha256: result?.executable_sha256 || null,
        expected_executable_sha256: result?.expected_executable_sha256 || null,
        wsl_registered_distro_name: result?.wsl_registered_distro_name || result?.wsl_distro || null,
        reference_listing_sha256: result?.environment?.reference_listing
            ? sha256Buffer(Buffer.from(result.environment.reference_listing, 'utf8')) : null,
        guest_os_pretty_name: result?.environment?.guest_os_pretty_name || null
    };
}

function outputExists(outputRoot) {
    return fs.existsSync(outputRoot) || fs.existsSync(sidecarPath(outputRoot));
}

function reserveFreshOutput(outputRoot) {
    const resolved = path.resolve(outputRoot);
    if (outputExists(resolved)) fail(`Output already exists and is immutable: ${resolved}`, 'OUTPUT_EXISTS');
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    try {
        fs.mkdirSync(resolved, { recursive: false });
    } catch (error) {
        if (error && error.code === 'EEXIST') fail(`Output already exists and is immutable: ${resolved}`, 'OUTPUT_EXISTS');
        throw error;
    }
    return resolved;
}

function checkpointFor(attemptPath, invocation) {
    return {
        schema_version: scheduleModule.CHECKPOINT_SCHEMA_VERSION,
        status: 'complete',
        invocation_id: invocation.id,
        attempt_number: Number(path.basename(attemptPath).slice('attempt-'.length)),
        expected_row_count: invocation.expectedRowCount,
        completed_row_count: invocation.expectedRowCount,
        evidence: 'retained in this immutable attempt directory'
    };
}

function failureCheckpoint(invocation, attemptPath, error) {
    return {
        schema_version: scheduleModule.CHECKPOINT_SCHEMA_VERSION,
        status: 'failed',
        invocation_id: invocation.id,
        attempt_number: Number(path.basename(attemptPath).slice('attempt-'.length)),
        error: { name: error.name, message: error.message, code: error.code || null }
    };
}

function retainedPartialFiles(attemptPath, current = attemptPath) {
    const retained = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(current, entry.name);
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) {
            fail(`Interrupted SHAPE attempt contains a symlink: ${absolute}`, 'CHECKPOINT_RECOVERY_UNSAFE');
        }
        if (stat.isDirectory()) retained.push(...retainedPartialFiles(attemptPath, absolute));
        else if (stat.isFile()) {
            const relative = path.relative(attemptPath, absolute).split(path.sep).join('/');
            if (relative !== 'checkpoint.json') retained.push({
                path: relative,
                size_bytes: stat.size,
                sha256: sha256File(absolute)
            });
        } else {
            fail(`Interrupted SHAPE attempt contains a non-file entry: ${absolute}`, 'CHECKPOINT_RECOVERY_UNSAFE');
        }
    }
    return retained.sort((left, right) => left.path.localeCompare(right.path));
}

function abandonedCheckpoint(invocation, attemptPath, retainedFiles) {
    return {
        schema_version: scheduleModule.CHECKPOINT_SCHEMA_VERSION,
        status: 'abandoned',
        invocation_id: invocation.id,
        attempt_number: Number(path.basename(attemptPath).slice('attempt-'.length)),
        reason: 'interrupted_before_checkpoint',
        evidence: 'retained partial evidence; never used as a completed result',
        retained_files: retainedFiles
    };
}

function recoverCheckpointlessAttempt(invocation, attempt) {
    const checkpointPath = path.join(attempt.path, 'checkpoint.json');
    if (fs.existsSync(checkpointPath)) fail(`Recovery checkpoint already exists: ${checkpointPath}`, 'CHECKPOINT_CORRUPT');
    const retainedFiles = retainedPartialFiles(attempt.path);
    writeJsonExclusive(checkpointPath, abandonedCheckpoint(invocation, attempt.path, retainedFiles));
    if (JSON.stringify(retainedPartialFiles(attempt.path)) !== JSON.stringify(retainedFiles)) {
        fail(`Interrupted SHAPE attempt changed during recovery: ${attempt.path}`, 'CHECKPOINT_RECOVERY_RACE');
    }
    return retainedFiles;
}

function verifyAbandonedAttemptInventory(attempt, checkpoint) {
    const retainedFiles = retainedPartialFiles(attempt.path);
    if (!checkpoint || JSON.stringify(checkpoint.retained_files) !== JSON.stringify(retainedFiles)) {
        fail(`Abandoned SHAPE attempt inventory changed: ${attempt.path}`, 'CHECKPOINT_CORRUPT');
    }
    return true;
}

function attemptDirectories(invocationRoot) {
    if (!fs.existsSync(invocationRoot) || !fs.statSync(invocationRoot).isDirectory()) return [];
    return fs.readdirSync(invocationRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^attempt-\d+$/.test(entry.name))
        .map(entry => ({ name: entry.name, number: Number(entry.name.slice('attempt-'.length)), path: path.join(invocationRoot, entry.name) }))
        .sort((a, b) => a.number - b.number);
}

function retainedAttemptFailureCounts(outputRoot, schedule) {
    const counts = { failed: 0, abandoned: 0 };
    for (const invocation of schedule.invocations) {
        const invocationRoot = path.join(outputRoot, 'shape', 'attempts', invocation.id);
        for (const attempt of attemptDirectories(invocationRoot)) {
            const checkpointPath = path.join(attempt.path, 'checkpoint.json');
            if (!fs.existsSync(checkpointPath)) continue;
            const checkpoint = scheduleModule.readCheckpointState(checkpointPath, {
                invocationId: invocation.id,
                attemptNumber: attempt.number
            });
            if (checkpoint.state === 'failed') counts.failed += 1;
            else if (checkpoint.state === 'abandoned') {
                verifyAbandonedAttemptInventory(attempt, checkpoint.checkpoint);
                counts.abandoned += 1;
            }
        }
    }
    return counts;
}

function nextAttempt(outputRoot, invocation) {
    const root = path.join(outputRoot, 'shape', 'attempts', invocation.id);
    const attempts = attemptDirectories(root);
    if (!attempts.every((attempt, index) =>
        attempt.number === index + 1 && attempt.name === `attempt-${String(index + 1).padStart(2, '0')}`)) {
        fail(`SHAPE invocation ${invocation.id} attempt sequence is non-contiguous or non-canonical`,
            'CHECKPOINT_CORRUPT');
    }
    const completed = [];
    for (const item of attempts) {
        const checkpointPath = path.join(item.path, 'checkpoint.json');
        let state = scheduleModule.readCheckpointState(checkpointPath, {
            invocationId: invocation.id,
            attemptNumber: item.number
        });
        if (state.state === 'absent') {
            recoverCheckpointlessAttempt(invocation, item);
            state = scheduleModule.readCheckpointState(checkpointPath, {
                invocationId: invocation.id,
                attemptNumber: item.number
            });
        }
        if (state.state === 'complete') {
            const rowsPath = path.join(item.path, 'rows.json');
            if (!fs.existsSync(rowsPath)) {
                fail(`Complete SHAPE checkpoint lacks rows: ${checkpointPath}`, 'CHECKPOINT_CORRUPT');
            }
            const rows = JSON.parse(fs.readFileSync(rowsPath, 'utf8'));
            if (!Array.isArray(rows) || rows.length !== invocation.expectedRowCount) {
                fail(`Complete SHAPE checkpoint row count mismatch: ${checkpointPath}`, 'CHECKPOINT_CORRUPT');
            }
            completed.push({ item, rows });
            continue;
        }
        if (state.state === 'abandoned') verifyAbandonedAttemptInventory(item, state.checkpoint);
        else if (state.state !== 'failed') {
            fail(`SHAPE checkpoint is corrupt: ${checkpointPath} (${state.reason || state.state})`, 'CHECKPOINT_CORRUPT');
        }
    }
    if (completed.length > 1 || (completed.length === 1 && completed[0].item.number !== attempts.at(-1).number)) {
        fail(`SHAPE invocation ${invocation.id} has attempts after a completed result`, 'CHECKPOINT_CORRUPT');
    }
    if (completed.length === 1) return { done: true, attempt: completed[0].item, rows: completed[0].rows };
    const number = attempts.length ? attempts[attempts.length - 1].number + 1 : 1;
    const attemptPath = scheduleModule.reserveAttemptPath(
        path.join(outputRoot, 'shape', 'attempts'), invocation.id, number
    );
    return { done: false, attempt: { number, path: attemptPath }, rows: [] };
}

async function bounded(items, limit, callback, state = {}) {
    const concurrency = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
    let cursor = 0;
    let active = 0;
    state.maxActive = 0;
    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            active += 1;
            state.maxActive = Math.max(state.maxActive, active);
            try {
                await callback(items[index], index);
            } finally {
                active -= 1;
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return state;
}

function parseArguments(argv) {
    const options = { shapeConcurrency: DEFAULT_SHAPE_CONCURRENCY, resume: false, requireFrozenCensus: true };
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) fail(`${token} requires a value`, 'USAGE');
            return argv[++index];
        };
        if (token === '--help' || token === '-h') options.help = true;
        else if (token === '--output') options.output = next();
        else if (token === '--cases') options.cases = next();
        else if (token === '--references') options.references = next();
        else if (token === '--malformed-controls') options.malformedControls = next();
        else if (token === '--input-bundle-receipt') options.inputBundleReceipt = next();
        else if (token === '--repo') options.repo = next();
        else if (token === '--shape-executable') options.shapeExecutable = next();
        else if (token === '--shape-sha256') options.shapeSha256 = next();
        else if (token === '--wsl-distro') options.wslDistro = next();
        else if (token === '--shape-timeout-seconds') options.shapeTimeoutSeconds = Number(next());
        else if (token === '--shape-concurrency') options.shapeConcurrency = Number(next());
        else if (token === '--resume') options.resume = true;
        else if (token === '--allow-nonfrozen-census') options.requireFrozenCensus = false;
        else fail(`Unknown argument: ${token}`, 'USAGE');
    }
    if (options.help) return options;
    if (!options.output || !options.cases || !options.references || !options.malformedControls ||
        !options.inputBundleReceipt) {
        fail('Usage requires --output, --cases, --references, --malformed-controls, and --input-bundle-receipt',
            'USAGE');
    }
    if (!Number.isInteger(options.shapeConcurrency) || options.shapeConcurrency < 1 || options.shapeConcurrency > 2) {
        fail('--shape-concurrency must be 1 or 2', 'USAGE');
    }
    if (options.shapeTimeoutSeconds !== undefined &&
        (!Number.isInteger(options.shapeTimeoutSeconds) || options.shapeTimeoutSeconds < 1)) {
        fail('--shape-timeout-seconds must be a positive integer', 'USAGE');
    }
    return options;
}

function preflight(options) {
    const casesFile = readJson(options.cases, 'Frozen metamorphic cases');
    if (options.requireFrozenCensus !== false) {
        // This validates the complete schema and the exact frozen bytes before
        // the output directory is created.
        qWorker.parseFrozenCases(casesFile.document, casesFile.path);
    } else if (options.expectedCasesSha256 && casesFile.sha256 !== options.expectedCasesSha256) {
        fail(`Frozen cases SHA-256 mismatch: ${casesFile.sha256}`);
    }

    if (!options.references) fail('An explicit frozen reference document is required', 'REFERENCES_REQUIRED');
    if (!options.malformedControls) fail('An explicit frozen malformed-control document is required', 'MALFORMED_CONTROLS_REQUIRED');
    if (!options.inputBundleReceipt) fail('An explicit frozen execution-input receipt is required',
        'INPUT_BUNDLE_RECEIPT_REQUIRED');
    const referencesFile = readJson(options.references, 'Frozen reference inventory');
    if (options.requireFrozenCensus !== false) qWorker.normalizeReferenceDocument(referencesFile.document);
    else validateReferenceDocument(referencesFile.document);
    if (referencesFile.document.source_cases_sha256 !== casesFile.sha256) {
        fail('Frozen reference document is bound to a different cases SHA-256', 'REFERENCES_HASH_MISMATCH');
    }
    const malformedControlsFile = readJson(options.malformedControls, 'Frozen malformed controls');
    if (options.requireFrozenCensus !== false) malformedModule.validateMalformedControlDocument(malformedControlsFile.document);
    else validateMalformedControlDocument(malformedControlsFile.document, casesFile.sha256);
    if (malformedControlsFile.document.source_positive_cases_sha256 !== casesFile.sha256) {
        fail('Frozen malformed controls are bound to a different cases SHA-256', 'MALFORMED_HASH_MISMATCH');
    }
    const inputBundleReceiptFile = readJson(options.inputBundleReceipt, 'Frozen execution-input receipt');
    const inputBundle = validateInputBundleReceipt(
        inputBundleReceiptFile,
        casesFile,
        referencesFile,
        malformedControlsFile,
        options.candidateCommit
    );
    const frozenFiles = [];
    if (options.frozenFiles) {
        for (const item of options.frozenFiles) {
            const filePath = typeof item === 'string' ? item : item.path;
            const expected = typeof item === 'string' ? null : item.sha256;
            const resolved = regularFile(filePath, 'Frozen input');
            const observed = sha256File(resolved);
            if (expected && observed !== expected) fail(`Frozen input SHA-256 mismatch: ${resolved}`);
            frozenFiles.push({ path: resolved, sha256: observed });
        }
    }
    return {
        casesFile,
        referencesFile,
        malformedControlsFile,
        inputBundleReceiptFile,
        inputBundle,
        frozenFiles
    };
}

function frozenRegistryDocument(frozen) {
    return {
        schema_version: 1,
        campaign_id: frozen.casesFile.document.campaign_id || CAMPAIGN_ID,
        cases: { path: 'cases.json', sha256: frozen.casesFile.sha256 },
        references: { path: 'references.json', sha256: frozen.referencesFile.sha256 },
        malformed_controls: { path: 'malformed-controls.json', sha256: frozen.malformedControlsFile.sha256 },
        input_bundle_receipt: {
            path: 'input-bundle-receipt.json',
            sha256: frozen.inputBundleReceiptFile.sha256,
            bundle_sha256: frozen.inputBundle.bundleSha256
        }
    };
}

function verifyFrozenInputBoundary(outputRoot, frozen, registryDocument = null) {
    const registryPath = path.join(outputRoot, 'inputs', 'frozen', 'registry.json');
    const registry = registryDocument || readJson(registryPath, 'Frozen-input registry').document;
    const expected = {
        cases: frozen.casesFile,
        references: frozen.referencesFile,
        malformed_controls: frozen.malformedControlsFile,
        input_bundle_receipt: frozen.inputBundleReceiptFile
    };
    const expectedPaths = {
        cases: 'cases.json',
        references: 'references.json',
        malformed_controls: 'malformed-controls.json',
        input_bundle_receipt: 'input-bundle-receipt.json'
    };
    for (const [key, source] of Object.entries(expected)) {
        if (registry[key]?.sha256 !== source.sha256 || registry[key]?.path !== expectedPaths[key]) {
            fail(`Frozen-input registry binding changed for ${key}`, 'FROZEN_INPUT_CHANGED');
        }
        if (sha256File(source.path) !== source.sha256) {
            fail(`Original frozen ${key} bytes changed during execution`, 'FROZEN_INPUT_CHANGED');
        }
        const copiedPath = path.join(outputRoot, 'inputs', 'frozen', registry[key].path);
        if (!fs.existsSync(copiedPath) || sha256File(copiedPath) !== source.sha256) {
            fail(`Retained frozen ${key} bytes changed during execution`, 'FROZEN_INPUT_CHANGED');
        }
    }
    return registry;
}

function retainedFrozenInputs(outputRoot, registry) {
    return {
        casesFile: readJson(path.join(outputRoot, 'inputs', 'frozen', registry.cases.path), 'Retained frozen cases'),
        referencesFile: readJson(path.join(outputRoot, 'inputs', 'frozen', registry.references.path), 'Retained references'),
        malformedControlsFile: readJson(
            path.join(outputRoot, 'inputs', 'frozen', registry.malformed_controls.path),
            'Retained malformed controls'
        ),
        inputBundleReceiptFile: readJson(
            path.join(outputRoot, 'inputs', 'frozen', registry.input_bundle_receipt.path),
            'Retained execution-input receipt'
        )
    };
}

function expectedVerifierCounts(retainedFrozen, schedule, qRowsByStream, malformed, analysis) {
    const analysisFailures = analysis?.failure_ledger || analysis?.failures || [];
    const shapeRowsWithRepetitions = schedule.invocations.reduce(
        (sum, invocation) => sum + Number(invocation.expectedRowCount), 0
    );
    const qshapeRowsTotal = Object.values(qRowsByStream).reduce(
        (sum, rows) => sum + (Array.isArray(rows) ? rows.length : Number.NaN), 0
    );
    const counts = {
        references: Number(retainedFrozen.referencesFile.document.count),
        cases: Number(retainedFrozen.casesFile.document.count),
        matched_target_evaluations_per_program: Number(schedule.counts.targetEvaluationsPerRepetition),
        shape_invocations: schedule.invocations.length,
        shape_rows_with_repetitions: shapeRowsWithRepetitions,
        qshape_rows_total: qshapeRowsTotal,
        malformed_controls: Number(malformed?.count),
        campaign_failures: Array.isArray(analysisFailures) ? analysisFailures.length : Number.NaN
    };
    if (Object.values(counts).some(value => !Number.isInteger(value) || value < 0)) {
        fail('Cannot derive exact verifier receipt counts from retained campaign evidence',
            'VERIFIER_EXPECTED_COUNTS_INVALID');
    }
    return counts;
}

function validateReferenceDocument(document) {
    if (!document || document.schema_version !== 2 || !Array.isArray(document.by_cn)) {
        fail('Frozen reference inventory has an invalid schema', 'REFERENCES_INVALID');
    }
    let total = 0;
    const seenCns = new Set();
    for (const group of document.by_cn) {
        if (!Number.isInteger(group.cn) || seenCns.has(group.cn) || !Array.isArray(group.references) || group.count !== group.references.length) {
            fail(`Frozen reference group CN=${group?.cn} is invalid`, 'REFERENCES_INVALID');
        }
        seenCns.add(group.cn);
        const seenCodes = new Set();
        group.references.forEach((reference, offset) => {
            if (typeof reference.qshape_code !== 'string' || seenCodes.has(reference.qshape_code) || reference.qshape_index !== offset + 1) {
                fail(`Frozen reference ordinal mismatch for CN=${group.cn}`, 'REFERENCES_INVALID');
            }
            seenCodes.add(reference.qshape_code);
        });
        total += group.count;
    }
    if (document.count !== total || total < 1) fail('Frozen reference inventory count mismatch', 'REFERENCES_INVALID');
    return true;
}

function validateMalformedControlDocument(document, casesSha256) {
    if (!document || document.schema_version !== 1 || !Array.isArray(document.controls) || document.count !== document.controls.length) {
        fail('Frozen malformed-control document has an invalid schema', 'MALFORMED_CONTROLS_INVALID');
    }
    if (document.source_positive_cases_sha256 !== casesSha256) {
        fail('Frozen malformed-control source hash mismatch', 'MALFORMED_HASH_MISMATCH');
    }
    const ids = new Set();
    for (const control of document.controls) {
        if (!control.control_id || ids.has(control.control_id) ||
            typeof control.expected_outcome !== 'string' || control.expected_outcome.length === 0 ||
            !Number.isInteger(control.expected_numeric_rows) || control.expected_numeric_rows < 0 ||
            control.campaign_gate !== 'malformed_control_contract') {
            fail(`Frozen malformed control ${control.control_id || '<missing>'} is invalid`, 'MALFORMED_CONTROLS_INVALID');
        }
        ids.add(control.control_id);
    }
    return true;
}

function runtimeBindings(options, referencesFile) {
    if (referencesFile) {
        const groups = Array.isArray(referencesFile.document?.by_cn)
            ? referencesFile.document.by_cn
            : referencesFile.document;
        if (!Array.isArray(groups)) fail('Frozen reference document has no by_cn groups', 'REFERENCES_INVALID');
        return groups.map(group => ({
            cn: group.cn,
            targets: (group.targets || group.references || []).map((target, offset) => {
                const code = target.code ?? target.qshape_code ?? target.qshapeCode;
                const ordinal = target.ordinal ?? target.qshape_index ?? target.qshapeIndex ?? offset + 1;
                return {
                    ...clone(target),
                    code,
                    qshapeCode: code,
                    shapeCode: target.shapeCode ?? target.shape_code ?? code,
                    ordinal,
                    shapeIndex: ordinal,
                    qshapeIndex: ordinal
                };
            })
        }));
    }
    fail('Runtime SHAPE reference bindings are required from the frozen reference document', 'REFERENCES_REQUIRED');
}

function inventoryForAnalysis(bindings) {
    const normalized = scheduleModule.normalizeRuntimeBindings(bindings);
    return [...normalized.values()].sort((a, b) => a.cn - b.cn).map(group => ({
        cn: group.cn,
        count: group.count,
        targets: group.targets.map(target => ({ ...clone(target), code: target.code }))
    }));
}

function qOptionsFor(stream, options, casesPath, referencesPath) {
    const explicit = stream.startsWith('q_explicit_seed_');
    const explicitSeed = explicit ? Number(stream.slice('q_explicit_seed_'.length)) : null;
    const repetition = explicit ? 1 : Number(stream.slice(-1));
    return {
        output: null,
        cases: casesPath,
        references: referencesPath || null,
        repo: options.repo,
        repetition,
        seedPolicy: explicit ? 'explicit' : 'input-derived',
        explicitSeed,
        stream,
        shardIndex: 0,
        shardCount: 1
    };
}

async function runMetamorphicCampaign(options = {}, dependencies = {}) {
    const normalized = { ...options };
    const isResume = Boolean(normalized.resume);
    const outputRoot = path.resolve(normalized.output);
    if (!isResume && outputExists(outputRoot)) {
        fail(`Output already exists and is immutable: ${outputRoot}`, 'OUTPUT_EXISTS');
    }
    const repoRoot = path.resolve(normalized.repo || path.resolve(__dirname, '..', '..'));
    if (pathIsInside(repoRoot, outputRoot)) {
        fail('Campaign output must be outside the candidate Git worktree', 'OUTPUT_INSIDE_CANDIDATE_REPO');
    }
    const candidateAtStart = captureCandidateSource(repoRoot);
    const runtimeAtStart = captureRuntimeIdentity(
        repoRoot,
        candidateAtStart.identity.dependency_lockfile.sha256
    );
    const runtimeInitialDocument = initialRuntimeEvidence(runtimeAtStart);
    normalized.repo = repoRoot;
    const casesPath = regularFile(normalized.cases, 'Frozen metamorphic cases');
    const frozen = preflight({
        ...normalized,
        cases: casesPath,
        candidateCommit: candidateAtStart.identity.repo_commit
    });
    const verifierHook = dependencies.verifier || normalized.verifier;
    if (typeof verifierHook !== 'function' && !normalized.allowUnverified) {
        fail('A real verifier hook is required by default', 'VERIFIER_REQUIRED');
    }
    if (!isResume) reserveFreshOutput(outputRoot);
    else {
        if (!fs.existsSync(outputRoot) || !fs.statSync(outputRoot).isDirectory()) fail(`Cannot resume missing output: ${outputRoot}`);
        if (fs.existsSync(path.join(outputRoot, 'manifest.json')) || fs.existsSync(sidecarPath(outputRoot))) {
            fail(`Sealed output cannot be resumed: ${outputRoot}`, 'OUTPUT_SEALED');
        }
        const registryPath = path.join(outputRoot, 'inputs', 'frozen', 'registry.json');
        if (!fs.existsSync(registryPath)) fail('Resume requires the frozen-input registry', 'FROZEN_REGISTRY_MISSING');
        const registry = readJson(registryPath, 'Frozen-input registry').document;
        verifyFrozenInputBoundary(outputRoot, frozen, registry);
        verifyCandidateSnapshot(outputRoot, candidateAtStart.identity);
        const retainedRuntimePath = path.join(outputRoot, 'metadata', 'runtime-initial.json');
        const retainedRuntime = readJson(
            retainedRuntimePath,
            'Retained initial runtime identity'
        ).document;
        if (stableJson(retainedRuntime) !== stableJson(runtimeInitialDocument) ||
            !fs.readFileSync(retainedRuntimePath).equals(
                Buffer.from(stableJson(runtimeInitialDocument), 'utf8')
            )) {
            fail('Resume runtime differs from the retained effective Node runtime', 'RUNTIME_CHANGED');
        }
    }

    const statePath = path.join(outputRoot, 'run-state.json');
    const state = {
        schema_version: 1,
        status: 'running',
        campaign_id: frozen.casesFile.document.campaign_id || CAMPAIGN_ID,
        cases_sha256: frozen.casesFile.sha256,
        references_sha256: frozen.referencesFile.sha256,
        malformed_controls_sha256: frozen.malformedControlsFile.sha256,
        input_bundle_receipt_sha256: frozen.inputBundleReceiptFile.sha256,
        input_bundle_sha256: frozen.inputBundle.bundleSha256,
        candidate_source_identity: clone(candidateAtStart.identity),
        execution_runtime_identity: clone(runtimeAtStart.identity),
        execution_runtime_identity_sha256: runtimeAtStart.identitySha256,
        stages: {},
        shape_calls: { scheduled: 0, completed: 0, failed: 0, abandoned: 0, max_concurrency: 0 },
        q_streams: {}
    };
    if (isResume && fs.existsSync(statePath)) {
        try { Object.assign(state, JSON.parse(fs.readFileSync(statePath, 'utf8'))); } catch (_error) { /* durable failure below */ }
        state.status = 'running';
        if (stableJson(state.candidate_source_identity) !== stableJson(candidateAtStart.identity)) {
            fail('Run-state candidate identity does not match the current committed candidate', 'CANDIDATE_SOURCE_CHANGED');
        }
        if (stableJson(state.execution_runtime_identity) !== stableJson(runtimeAtStart.identity) ||
            state.execution_runtime_identity_sha256 !== runtimeAtStart.identitySha256) {
            fail('Run-state runtime identity does not match the current process', 'RUNTIME_CHANGED');
        }
    }
    state.shape_calls = { scheduled: 0, completed: 0, failed: 0, abandoned: 0, max_concurrency: 0 };
    writeJsonReplace(statePath, state);

    const writes = {
        cases: path.join(outputRoot, 'inputs', 'frozen', 'cases.json'),
        references: path.join(outputRoot, 'inputs', 'frozen', 'references.json'),
        malformedControls: path.join(outputRoot, 'inputs', 'frozen', 'malformed-controls.json'),
        inputBundleReceipt: path.join(outputRoot, 'inputs', 'frozen', 'input-bundle-receipt.json')
    };
    if (!fs.existsSync(writes.cases)) writeExclusive(writes.cases, fs.readFileSync(frozen.casesFile.path));
    if (frozen.referencesFile && !fs.existsSync(writes.references)) writeExclusive(writes.references, fs.readFileSync(frozen.referencesFile.path));
    if (!fs.existsSync(writes.malformedControls)) writeExclusive(writes.malformedControls, fs.readFileSync(frozen.malformedControlsFile.path));
    if (!fs.existsSync(writes.inputBundleReceipt)) {
        writeExclusive(writes.inputBundleReceipt, fs.readFileSync(frozen.inputBundleReceiptFile.path));
    }
    if (frozen.frozenFiles.length && !fs.existsSync(path.join(outputRoot, 'inputs', 'frozen', 'additional-files.json'))) {
        writeJsonExclusive(path.join(outputRoot, 'inputs', 'frozen', 'additional-files.json'), frozen.frozenFiles);
    }
    const expectedFrozenRegistry = frozenRegistryDocument(frozen);
    const frozenRegistryPath = path.join(outputRoot, 'inputs', 'frozen', 'registry.json');
    if (!fs.existsSync(frozenRegistryPath)) writeJsonExclusive(frozenRegistryPath, expectedFrozenRegistry);
    const retainedRegistry = readJson(frozenRegistryPath, 'Frozen-input registry').document;
    if (stableJson(retainedRegistry) !== stableJson(expectedFrozenRegistry)) {
        fail('Frozen-input registry content changed', 'FROZEN_INPUT_CHANGED');
    }
    verifyFrozenInputBoundary(outputRoot, frozen, retainedRegistry);
    const retainedFrozen = retainedFrozenInputs(outputRoot, retainedRegistry);
    const retainedInputBundle = validateInputBundleReceipt(
        retainedFrozen.inputBundleReceiptFile,
        retainedFrozen.casesFile,
        retainedFrozen.referencesFile,
        retainedFrozen.malformedControlsFile,
        candidateAtStart.identity.repo_commit,
        { requireBundleDirectory: false }
    );
    if (retainedInputBundle.bundleSha256 !== frozen.inputBundle.bundleSha256 ||
        retainedRegistry.input_bundle_receipt?.bundle_sha256 !== frozen.inputBundle.bundleSha256) {
        fail('Retained execution-input bundle identity changed', 'FROZEN_INPUT_CHANGED');
    }

    const candidateIdentitySha256 = isResume
        ? verifyCandidateSnapshot(outputRoot, candidateAtStart.identity)
        : writeCandidateSnapshot(outputRoot, candidateAtStart);
    const runtimeInitialPath = path.join(outputRoot, 'metadata', 'runtime-initial.json');
    if (!fs.existsSync(runtimeInitialPath)) {
        writeExclusive(runtimeInitialPath, stableJson(runtimeInitialDocument), { encoding: 'utf8' });
    }
    else if (stableJson(readJson(runtimeInitialPath, 'Retained initial runtime identity').document) !==
        stableJson(runtimeInitialDocument)) {
        fail('Retained initial runtime identity changed', 'RUNTIME_CHANGED');
    }

    const shapeRunner = dependencies.shapeRunner || normalized.shapeRunner;
    if (typeof shapeRunner !== 'function') {
        const error = new Error('A shapeRunner hook is required; the positive SHAPE campaign was not executed');
        state.status = 'failed';
        state.failure = { message: error.message, code: 'SHAPE_RUNNER_REQUIRED' };
        writeJsonReplace(statePath, state);
        throw error;
    }

    const bindings = runtimeBindings(normalized, retainedFrozen.referencesFile);
    const schedule = (dependencies.scheduleBuilder || normalized.scheduleBuilder || scheduleModule.buildMetamorphicShapeSchedule)(
        retainedFrozen.casesFile.document,
        bindings,
        {
            repetitions: normalized.repetitions || 2,
            maxTargetsPerBatch: normalized.maxTargetsPerBatch || 12,
            requireFrozenCensus: normalized.requireFrozenCensus !== false
        }
    );
    state.schedule = schedule.counts;
    state.stages.preflight = {
        status: 'complete',
        cases_sha256: retainedFrozen.casesFile.sha256,
        candidate_repo_commit: candidateAtStart.identity.repo_commit,
        candidate_source_tree_sha256: candidateAtStart.identity.source_tree_sha256,
        candidate_snapshot_identity_sha256: candidateIdentitySha256
    };
    state.stages.runtime_preflight = {
        status: 'complete',
        identity_sha256: runtimeAtStart.identitySha256,
        process_model: QSHAPE_PROCESS_MODEL,
        dependency_lockfile_sha256: candidateAtStart.identity.dependency_lockfile.sha256
    };

    const recipesPath = path.join(outputRoot, 'recipes.json');
    if (!fs.existsSync(recipesPath)) {
        writeJsonExclusive(recipesPath, {
            schema_version: 1,
            campaign_id: retainedFrozen.casesFile.document.campaign_id || CAMPAIGN_ID,
            main_recipe_registry: retainedFrozen.casesFile.document.main_recipe_registry || [],
            adversarial_positive_recipe_registry: retainedFrozen.casesFile.document.adversarial_positive_recipe_registry || [],
            main_recipe_registry_sha256: retainedFrozen.casesFile.document.main_recipe_registry_sha256 || null,
            adversarial_positive_recipe_registry_sha256: retainedFrozen.casesFile.document.adversarial_positive_recipe_registry_sha256 || null
        });
    }
    writeJsonReplace(statePath, state);

    let packageSealed = false;
    try {
        const qualification = dependencies.qualificationRunner || normalized.qualificationRunner;
        const qualificationPath = path.join(outputRoot, 'shape', 'qualification.json');
        const resumeQualified = Boolean(
            isResume && state.stages.shape_qualification?.status === 'complete' &&
            fs.existsSync(qualificationPath)
        );
        if (!resumeQualified) {
            state.stages.shape_qualification = { status: 'running', concurrency: 1 };
            writeJsonReplace(statePath, state);
        }
        let qualificationResult = null;
        if (resumeQualified) {
            qualificationResult = JSON.parse(fs.readFileSync(qualificationPath, 'utf8'));
        } else if (typeof qualification === 'function') {
            qualificationResult = await qualification({
                campaignId: CAMPAIGN_ID,
                outputRoot,
                schedule,
                serialBlock: schedule.invocations.slice(0, 15),
                cases: retainedFrozen.casesFile.document
            });
        } else {
            fail('A serial SHAPE qualification hook is required', 'QUALIFICATION_REQUIRED');
        }
        if (!qualificationResult || qualificationResult.status !== 'qualified') {
            fail(`SHAPE qualification must return status=qualified, observed ${qualificationResult?.status || 'missing'}`,
                'QUALIFICATION_NOT_RUN');
        }
        if (!fs.existsSync(qualificationPath)) writeJsonExclusive(qualificationPath, qualificationResult || {});
        state.stages.shape_qualification = { status: 'complete', result_status: qualificationResult?.status || 'complete' };
        writeJsonReplace(statePath, state);

        const shapeRowsByRepetition = { shape_r1: [], shape_r2: [] };
        state.shape_calls.scheduled = schedule.invocations.length;
        const retainedAttemptFailures = retainedAttemptFailureCounts(outputRoot, schedule);
        state.shape_calls.abandoned = retainedAttemptFailures.abandoned;
        state.shape_calls.failed = retainedAttemptFailures.failed + retainedAttemptFailures.abandoned;
        const shapeConcurrency = Math.min(
            DEFAULT_SHAPE_CONCURRENCY,
            Math.max(1, Number(normalized.shapeConcurrency) || DEFAULT_SHAPE_CONCURRENCY)
        );
        const executeShapeInvocation = async invocation => {
            const prepared = nextAttempt(outputRoot, invocation);
            if (prepared.done) {
                const key = `shape_r${invocation.repetition}`;
                shapeRowsByRepetition[key].push(...prepared.rows);
                state.shape_calls.completed += 1;
                return;
            }
            const attemptPath = prepared.attempt.path;
            const context = {
                campaignId: CAMPAIGN_ID,
                outputRoot,
                invocation,
                attemptPath,
                repetition: invocation.repetition,
                targetCodes: invocation.targetCodes,
                cases: invocation.cases
            };
            try {
                const result = await shapeRunner(context);
                const rows = shapeRowEvidence(result);
                if (normalized.validateRowCounts !== false && rows.length !== invocation.expectedRowCount) {
                    fail(`SHAPE invocation ${invocation.id} emitted ${rows.length} rows; expected ${invocation.expectedRowCount}`);
                }
                const exitCode = result?.exitCode ?? result?.exit_code ?? 0;
                writeJsonExclusive(path.join(attemptPath, 'control.json'), result?.control || {
                    invocation_id: invocation.id,
                    target_codes: invocation.targetCodes,
                    cases: invocation.caseIds
                });
                writeExclusive(path.join(attemptPath, 'stdout.txt'), toBuffer(result?.stdout));
                writeExclusive(path.join(attemptPath, 'stderr.txt'), toBuffer(result?.stderr));
                writeExclusive(path.join(attemptPath, 'exit-code.txt'), `${exitCode}\n`, { encoding: 'utf8' });
                if (result?.controlText !== undefined || result?.dat !== undefined || result?.datText !== undefined) {
                    writeExclusive(path.join(attemptPath, 'control.dat'), toBuffer(
                        result.controlText ?? result.dat ?? result.datText
                    ));
                }
                if (result?.out !== undefined || result?.outText !== undefined) writeExclusive(path.join(attemptPath, 'result.out'), toBuffer(result.out ?? result.outText));
                if (result?.tab !== undefined || result?.tabText !== undefined) writeExclusive(path.join(attemptPath, 'result.tab'), toBuffer(result.tab ?? result.tabText));
                writeJsonExclusive(path.join(attemptPath, 'rows.json'), rows);
                writeJsonExclusive(path.join(attemptPath, 'result.json'), result || {});
                if (Number(exitCode) !== 0) fail(`SHAPE invocation ${invocation.id} exited with code ${exitCode}`);
                writeJsonExclusive(path.join(attemptPath, 'checkpoint.json'), checkpointFor(attemptPath, invocation));
                shapeRowsByRepetition[`shape_r${invocation.repetition}`].push(...rows);
                state.shape_calls.completed += 1;
            } catch (error) {
                state.shape_calls.failed += 1;
                try {
                    writeExclusive(path.join(attemptPath, 'stderr.txt'), toBuffer(error.stack || error.message));
                    writeJsonExclusive(path.join(attemptPath, 'checkpoint.json'), failureCheckpoint(invocation, attemptPath, error));
                } catch (_writeError) { /* preserve the primary execution error */ }
                throw error;
            }
        };
        // The first 15 repeated invocations form a serial qualification block
        // in the frozen execution interpretation.  Only after this block has
        // completed may the remaining invocations use the two-process bound.
        const serialBlock = schedule.invocations.slice(0, 15);
        const concurrentBlock = schedule.invocations.slice(15);
        const serialState = {};
        const concurrentState = {};
        await bounded(serialBlock, 1, executeShapeInvocation, serialState);
        await bounded(concurrentBlock, shapeConcurrency, executeShapeInvocation, concurrentState);
        const retainedAttemptFailuresAtCompletion = retainedAttemptFailureCounts(outputRoot, schedule);
        state.shape_calls.abandoned = retainedAttemptFailuresAtCompletion.abandoned;
        state.shape_calls.failed = retainedAttemptFailuresAtCompletion.failed +
            retainedAttemptFailuresAtCompletion.abandoned;
        state.shape_calls.serial_block = serialBlock.length;
        state.shape_calls.max_concurrency = Math.max(serialState.maxActive || 0, concurrentState.maxActive || 0);
        state.stages.shape = {
            status: 'complete',
            calls: schedule.invocations.length,
            serial_block_calls: serialBlock.length,
            max_concurrency: state.shape_calls.max_concurrency
        };
        writeJsonReplace(statePath, state);

        const qRowsByStream = {};
        const qRunner = dependencies.qRunner || normalized.qRunner;
        if (typeof qRunner !== 'function' && !normalized.allowDefaultQWorker) {
            fail('A qRunner hook is required unless allowDefaultQWorker is true');
        }
        for (const stream of Q_STREAMS) {
            const qOptions = qOptionsFor(
                stream,
                normalized,
                retainedFrozen.casesFile.path,
                retainedFrozen.referencesFile.path
            );
            const streamDir = path.join(outputRoot, 'qshape', stream);
            let result;
            try {
                const existingRowsPath = path.join(streamDir, 'rows.json');
                if (isResume && state.q_streams[stream]?.status === 'complete' && fs.existsSync(existingRowsPath)) {
                    qRowsByStream[stream] = readRetainedQStream(
                        streamDir,
                        stream,
                        schedule.counts.targetEvaluationsPerRepetition,
                        normalized.validateRowCounts !== false,
                        runtimeAtStart.identity,
                        runtimeAtStart.identitySha256
                    );
                    continue;
                }
                result = typeof qRunner === 'function'
                    ? await qRunner({
                        ...qOptions,
                        outputRoot,
                        stream,
                        runtimeIdentity: clone(runtimeAtStart.identity),
                        runtimeIdentitySha256: runtimeAtStart.identitySha256,
                        executionProcess: QSHAPE_PROCESS_MODEL
                    })
                    : qWorker.runWorker({
                        ...qOptions,
                        runtimeIdentity: clone(runtimeAtStart.identity),
                        runtimeIdentitySha256: runtimeAtStart.identitySha256,
                        executionProcess: QSHAPE_PROCESS_MODEL
                    }, normalized.workerDependencies || {});
                const payload = invocationResult(result);
                const rows = rowsFrom(result);
                validateQPayloadRuntime(
                    payload,
                    runtimeAtStart.identity,
                    runtimeAtStart.identitySha256,
                    stream
                );
                if (normalized.validateRowCounts !== false && rows.length !== schedule.counts.targetEvaluationsPerRepetition) {
                    fail(`Q-Shape stream ${stream} emitted ${rows.length} rows; expected ${schedule.counts.targetEvaluationsPerRepetition}`);
                }
                qRowsByStream[stream] = rows;
                writeJsonExclusive(path.join(streamDir, 'payload.json'), payload);
                writeJsonExclusive(path.join(streamDir, 'rows.json'), rows);
                writeExclusive(path.join(streamDir, 'stdout.txt'), toBuffer(result?.stdout));
                writeExclusive(path.join(streamDir, 'stderr.txt'), toBuffer(result?.stderr));
                writeExclusive(path.join(streamDir, 'exit-code.txt'), `${result?.exitCode ?? result?.exit_code ?? 0}\n`, { encoding: 'utf8' });
                writeJsonExclusive(path.join(streamDir, 'raw-result.json'), result || {});
                state.q_streams[stream] = {
                    status: 'complete',
                    rows: rows.length,
                    runtime_identity_sha256: runtimeAtStart.identitySha256,
                    execution_process: QSHAPE_PROCESS_MODEL
                };
                writeJsonReplace(statePath, state);
            } catch (error) {
                state.q_streams[stream] = { status: 'failed', error: error.message };
                writeJsonReplace(statePath, state);
                throw error;
            }
        }
        state.stages.qshape = { status: 'complete', streams: [...Q_STREAMS] };

        const malformedRunner = dependencies.malformedRunner || normalized.malformedRunner;
        let malformed;
        if (typeof malformedRunner === 'function') {
            malformed = await malformedRunner({
                outputRoot,
                cases: retainedFrozen.casesFile.document,
                casesPath: retainedFrozen.casesFile.path,
                casesSha256: retainedFrozen.casesFile.sha256,
                controlsDocument: clone(retainedFrozen.malformedControlsFile.document),
                controls: clone(retainedFrozen.malformedControlsFile.document),
                controlsPath: retainedFrozen.malformedControlsFile.path,
                controlsSha256: retainedFrozen.malformedControlsFile.sha256
            });
        } else {
            fail('A malformed-control executor hook is required', 'MALFORMED_RUNNER_REQUIRED');
        }
        if (malformed?.source_controls_sha256 && malformed.source_controls_sha256 !== retainedFrozen.malformedControlsFile.sha256) {
            fail('Malformed outcomes were not produced from the frozen control bytes', 'MALFORMED_INPUT_CHANGED');
        }
        validateMalformedObservations(
            malformed,
            retainedFrozen.malformedControlsFile.document,
            retainedFrozen.malformedControlsFile.sha256
        );
        const malformedPath = path.join(outputRoot, 'malformed', 'observations.json');
        const malformedResultsPath = path.join(outputRoot, 'malformed', 'results.json');
        if (!(isResume && state.stages.malformed?.status === 'complete' && fs.existsSync(malformedPath))) {
            if (!fs.existsSync(malformedPath)) writeJsonExclusive(malformedPath, malformed || {});
            if (!fs.existsSync(malformedResultsPath)) writeJsonExclusive(malformedResultsPath, malformed?.controls || []);
        }
        state.stages.malformed = { status: 'complete', count: malformed?.count ?? null, campaign_id: malformed?.campaign_id || CONTROL_CAMPAIGN_ID };
        writeJsonReplace(statePath, state);

        const analyze = dependencies.analysisRunner || normalized.analysisRunner || analysisModule.analyzeMetamorphicParity;
        const analysisInput = {
            cases: retainedFrozen.casesFile.document.cases,
            inventory: inventoryForAnalysis(bindings),
            shapeRowsByRepetition,
            qshapeRowsByStream: qRowsByStream,
            malformedObservations: malformed
        };
        const analysis = await analyze(analysisInput);
        const analysisPath = path.join(outputRoot, 'reports', 'metamorphic-analysis.json');
        if (!fs.existsSync(analysisPath)) writeJsonExclusive(analysisPath, analysis || {});
        else writeJsonReplace(analysisPath, analysis || {});
        reportingModule.writeReportingArtifacts(
            path.join(outputRoot, 'reports'),
            analysis || {},
            { replace: isResume }
        );
        const campaignGateStatus = analysis?.summary?.campaign_gate_status || analysis?.campaign_gate_status || 'not_evaluated';
        const exactVerifierCounts = expectedVerifierCounts(
            retainedFrozen,
            schedule,
            qRowsByStream,
            malformed,
            analysis
        );
        state.stages.analysis = { status: 'complete', campaign_gate_status: campaignGateStatus };

        const finalQualification = dependencies.finalQualificationRunner ||
            normalized.finalQualificationRunner || qualification;
        if (typeof finalQualification !== 'function') {
            fail('A final SHAPE environment recheck hook is required', 'FINAL_QUALIFICATION_REQUIRED');
        }
        const finalQualificationResult = await finalQualification({
            campaignId: CAMPAIGN_ID,
            outputRoot,
            phase: 'final_recheck',
            schedule,
            cases: retainedFrozen.casesFile.document
        });
        if (!finalQualificationResult || finalQualificationResult.status !== 'qualified') {
            fail('Final SHAPE environment recheck did not qualify', 'FINAL_QUALIFICATION_FAILED');
        }
        const initialIdentity = qualificationIdentity(qualificationResult);
        const finalIdentity = qualificationIdentity(finalQualificationResult);
        if (JSON.stringify(initialIdentity) !== JSON.stringify(finalIdentity)) {
            fail('SHAPE executable or environment identity changed during the campaign',
                'FINAL_QUALIFICATION_IDENTITY_CHANGED');
        }
        const finalQualificationPath = path.join(outputRoot, 'shape', 'qualification-final.json');
        if (fs.existsSync(finalQualificationPath)) {
            const retainedFinalQualification = readJson(
                finalQualificationPath,
                'Retained final SHAPE qualification'
            ).document;
            if (stableJson(retainedFinalQualification) !== stableJson(finalQualificationResult) ||
                !fs.readFileSync(finalQualificationPath).equals(Buffer.from(jsonValue(finalQualificationResult), 'utf8'))) {
                fail('Retained final SHAPE qualification differs from the resumed recheck',
                    'FINAL_QUALIFICATION_EVIDENCE_CHANGED');
            }
        } else {
            writeJsonExclusive(finalQualificationPath, finalQualificationResult);
        }
        state.stages.final_environment_recheck = {
            status: 'complete',
            identity: finalIdentity
        };
        verifyFrozenInputBoundary(outputRoot, frozen, retainedRegistry);
        const finalCandidate = captureCandidateSource(repoRoot);
        if (stableJson(finalCandidate.identity) !== stableJson(candidateAtStart.identity)) {
            fail('Candidate commit or relevant source bytes changed during the campaign', 'CANDIDATE_SOURCE_CHANGED');
        }
        const finalSnapshotIdentitySha256 = verifyCandidateSnapshot(outputRoot, finalCandidate.identity);
        if (finalSnapshotIdentitySha256 !== candidateIdentitySha256) {
            fail('Candidate snapshot identity bytes changed during the campaign', 'CANDIDATE_SNAPSHOT_CHANGED');
        }
        const runtimeAtEnd = captureRuntimeIdentity(
            repoRoot,
            finalCandidate.identity.dependency_lockfile.sha256
        );
        if (stableJson(runtimeAtEnd.identity) !== stableJson(runtimeAtStart.identity) ||
            runtimeAtEnd.identitySha256 !== runtimeAtStart.identitySha256) {
            fail('Effective Node runtime changed during the campaign', 'RUNTIME_CHANGED');
        }
        const runtimeFinalRecheck = {
            schema_version: 1,
            status: 'unchanged',
            identity_sha256: runtimeAtEnd.identitySha256,
            initial_identity_sha256: runtimeAtStart.identitySha256,
            qshape_worker_execution: 'in-process; no child Node process is used',
            identity: clone(runtimeAtEnd.identity)
        };
        replaceFile(
            path.join(outputRoot, 'metadata', 'runtime-final-recheck.json'),
            stableJson(runtimeFinalRecheck),
            { encoding: 'utf8' }
        );
        state.stages.final_runtime_recheck = {
            status: 'complete',
            identity_sha256: runtimeAtEnd.identitySha256,
            process_model: QSHAPE_PROCESS_MODEL
        };
        const candidateFinalRecheck = {
            schema_version: 1,
            status: 'unchanged',
            repo_commit: finalCandidate.identity.repo_commit,
            source_tree_sha256: finalCandidate.identity.source_tree_sha256,
            snapshot_identity_sha256: finalSnapshotIdentitySha256,
            original_frozen_inputs_unchanged: true,
            retained_frozen_inputs_unchanged: true
        };
        writeJsonReplace(
            path.join(outputRoot, 'metadata', 'candidate-source-final-recheck.json'),
            candidateFinalRecheck
        );
        state.stages.final_candidate_recheck = { status: 'complete', ...candidateFinalRecheck };
        if (!['pass', 'fail'].includes(campaignGateStatus)) {
            fail(`Analysis returned non-normative campaign status ${campaignGateStatus}`,
                'CAMPAIGN_STATUS_INVALID');
        }

        state.status = 'sealing';
        state.stages.verifier = { status: 'external_after_seal' };
        writeJsonReplace(statePath, state);
        const manifest = {
            schema_version: PACKAGE_SCHEMA_VERSION,
            package_type: 'metamorphic-parity',
            campaign_id: frozen.casesFile.document.campaign_id || CAMPAIGN_ID,
            cases_sha256: frozen.casesFile.sha256,
            references_sha256: frozen.referencesFile.sha256,
            malformed_controls_sha256: frozen.malformedControlsFile.sha256,
            input_bundle_receipt_sha256: frozen.inputBundleReceiptFile.sha256,
            input_bundle_sha256: frozen.inputBundle.bundleSha256,
            candidate_source: {
                repo_commit: candidateAtStart.identity.repo_commit,
                repo_branch: candidateAtStart.identity.repo_branch,
                worktree_clean_before_run: true,
                worktree_clean_before_seal: true,
                source_tree_sha256: candidateAtStart.identity.source_tree_sha256,
                snapshot_path: 'inputs/candidate-snapshot',
                snapshot_identity_sha256: candidateIdentitySha256,
                dependency_lockfile: clone(candidateAtStart.identity.dependency_lockfile)
            },
            execution_runtime: {
                identity_kind: RUNTIME_IDENTITY_KIND,
                process_model: QSHAPE_PROCESS_MODEL,
                identity_sha256: runtimeAtStart.identitySha256,
                initial_path: 'metadata/runtime-initial.json',
                initial_sha256: sha256File(runtimeInitialPath),
                final_recheck_path: 'metadata/runtime-final-recheck.json',
                final_recheck_sha256: sha256File(
                    path.join(outputRoot, 'metadata', 'runtime-final-recheck.json')
                ),
                qshape_worker_execution: 'in-process; no child Node process is used',
                dependency_lockfile: clone(candidateAtStart.identity.dependency_lockfile)
            },
            sealed: true,
            manifest_checksum_file: 'manifest.sha256',
            counts: { ...schedule.counts },
            stages: clone(state.stages),
            package_status: 'complete',
            campaign_gate_status: campaignGateStatus,
            overall_validation_status: 'incomplete',
            verification_contract: {
                verifier: 'verify-metamorphic-parity.cjs',
                expected_exit_code: campaignGateStatus === 'pass' ? 0 : 2,
                expected_verified_counts: clone(exactVerifierCounts),
                receipt_location: 'sibling:<package>.verification.json'
            },
            files: []
        };
        // run-state is finalized before its hash enters the manifest.  No
        // package file is written after this manifest is sealed.
        state.status = 'sealed';
        writeJsonReplace(statePath, state);
        manifest.files = collectFiles(outputRoot).filter(item => !['manifest.json', 'manifest.sha256'].includes(item.path));
        const manifestPath = path.join(outputRoot, 'manifest.json');
        writeExclusive(manifestPath, stableJson(manifest), { encoding: 'utf8' });
        const manifestSha256 = sha256File(manifestPath);
        writeExclusive(path.join(outputRoot, 'manifest.sha256'), `${manifestSha256}  manifest.json\n`, { encoding: 'utf8' });
        packageSealed = true;

        let verification = {
            status: 'not_run',
            exitCode: null,
            warnings: ['no verifier hook supplied'],
            receipt: null,
            receiptParseError: 'not_run',
            stderr: ''
        };
        if (typeof verifierHook === 'function') {
            try {
                const result = await verifierHook({
                    outputRoot,
                    manifestPath,
                    manifest: clone(manifest),
                    manifestSha256,
                    schedule,
                    analysis,
                    expectedVerifiedCounts: clone(exactVerifierCounts)
                });
                verification = {
                    status: result?.status || (result?.exitCode === 0 ? 'pass' : 'fail'),
                    exitCode: result?.exitCode ?? result?.exit_code ?? null,
                    warnings: Array.isArray(result?.warnings) ? result.warnings.slice().sort() :
                        Array.isArray(result?.receipt?.warnings) ? result.receipt.warnings.slice().sort() : [],
                    verifiedCounts: result?.verifiedCounts || result?.verified_counts ||
                        result?.receipt?.verified_counts || null,
                    receipt: result?.receipt || result?.exact_receipt || null,
                    receiptParseError: result?.receiptParseError ?? result?.receipt_parse_error ?? null,
                    stderr: result?.stderr || ''
                };
            } catch (error) {
                verification = {
                    status: 'error',
                    exitCode: 70,
                    warnings: [`verifier_exception:${error.message}`],
                    verifiedCounts: null,
                    receipt: null,
                    receiptParseError: error.message,
                    stderr: ''
                };
            }
        }
        const expectedVerifierExitCode = campaignGateStatus === 'pass' ? 0 : 2;
        const verifierReceipt = verification.receipt;
        const verifierWarnings = Array.isArray(verifierReceipt?.warnings)
            ? verifierReceipt.warnings : [];
        const verifierReceiptAccepted =
            verification.exitCode === expectedVerifierExitCode &&
            verification.stderr === '' &&
            verification.receiptParseError === null &&
            verifierReceipt?.verification_status === 'valid' &&
            verifierReceipt?.manifest_sha256 === manifestSha256 &&
            verifierReceipt?.package_status === 'complete' &&
            verifierReceipt?.campaign_gate_status === campaignGateStatus &&
            verifierReceipt?.overall_validation_status === 'incomplete' &&
            stableJson(verifierReceipt?.verified_counts) === stableJson(exactVerifierCounts) &&
            stableJson(verification.verifiedCounts) === stableJson(exactVerifierCounts) &&
            JSON.stringify(verifierWarnings) === JSON.stringify([...verifierWarnings].sort());
        const receipt = {
            schema_version: RECEIPT_SCHEMA_VERSION,
            receipt_kind: 'external-independent-verifier-sidecar',
            package_manifest_sha256: manifestSha256,
            verifier_exit_code: verification.exitCode,
            verifier_stderr: verification.stderr,
            receipt_parse_error: verification.receiptParseError,
            receipt: verifierReceipt
        };
        const receiptPath = sidecarPath(outputRoot);
        writeExclusive(receiptPath, stableJson(receipt), { encoding: 'utf8' });
        if (!verifierReceiptAccepted) {
            const error = new Error(
                `Verifier did not return an exact valid receipt: status=${verification.status}, ` +
                `exit_code=${verification.exitCode}, expected=${expectedVerifierExitCode}`
            );
            error.code = 'VERIFIER_FAILED';
            throw error;
        }
        // run-state is intentionally not rewritten after sealing: the manifest
        // contains the exact bytes that existed when it was sealed.
        return {
            outputRoot,
            manifestPath,
            manifestSha256,
            receiptPath,
            schedule,
            analysis,
            verification,
            shapeCalls: { ...state.shape_calls },
            stages: clone(state.stages)
        };
    } catch (error) {
        if (!packageSealed) {
            state.status = 'failed';
            state.failure = { name: error.name, message: error.message, code: error.code || null };
            state.stages.failure = { status: 'durable', message: error.message };
            writeJsonReplace(statePath, state);
            try { writeJsonExclusive(path.join(outputRoot, 'failure-ledger.json'), state.failure); } catch (_writeError) { /* state is primary */ }
        }
        throw error;
    }
}

function collectFiles(root, current = root) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    const result = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) result.push(...collectFiles(root, absolute));
        else if (entry.isFile()) result.push({
            path: path.relative(root, absolute).split(path.sep).join('/'),
            size_bytes: fs.statSync(absolute).size,
            sha256: sha256File(absolute)
        });
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
    const options = parseArguments(argv);
    if (options.help) {
        process.stdout.write(
            'Usage: node run-metamorphic-parity.cjs --output <dir> --cases <cases.json> ' +
            '--references <references.json> --malformed-controls <controls.json> ' +
            '--input-bundle-receipt <receipt.json> ' +
            '--shape-executable </absolute/linux/path> --shape-sha256 <64-hex> ' +
            '[--wsl-distro Ubuntu-22.04] [--shape-concurrency 1|2] [--resume]\n'
        );
        return 0;
    }
    const hasInjectedExecution = typeof dependencies.shapeRunner === 'function' &&
        typeof dependencies.qualificationRunner === 'function';
    if (!hasInjectedExecution &&
        (!options.shapeExecutable || !/^[0-9a-fA-F]{64}$/.test(options.shapeSha256 || ''))) {
        fail('Production execution requires --shape-executable and --shape-sha256', 'USAGE');
    }
    const repoRoot = path.resolve(options.repo || path.resolve(__dirname, '..', '..'));
    const production = productionAdapters.createProductionDependencies({
        repoRoot,
        casesPath: path.resolve(options.cases),
        referencesPath: path.resolve(options.references),
        shapeExecutable: options.shapeExecutable,
        expectedShapeSha256: options.shapeSha256,
        wslDistro: options.wslDistro || productionAdapters.DEFAULT_WSL_DISTRO,
        shapeTimeoutSeconds: options.shapeTimeoutSeconds || productionAdapters.DEFAULT_TIMEOUT_SECONDS
    });
    const result = await runMetamorphicCampaign(
        { ...options, repo: repoRoot },
        { ...production, ...dependencies }
    );
    process.stdout.write(`${JSON.stringify({ output: result.outputRoot, manifest: result.manifestSha256, shape_calls: result.shapeCalls })}\n`);
    return result.analysis?.summary?.campaign_gate_status === 'pass' ? 0 : 2;
}

function resumeMetamorphicCampaign(options = {}, dependencies = {}) {
    return runMetamorphicCampaign({ ...options, resume: true }, dependencies);
}

if (require.main === module) {
    main().then(code => {
        process.exitCode = code;
    }).catch(error => {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = error.code === 'USAGE' ? 64 :
            error.code === 'OUTPUT_EXISTS' ? 73 :
                error.code === 'VERIFIER_FAILED' ? 3 : 3;
    });
}

module.exports = {
    CAMPAIGN_ID,
    CASES_SHA256,
    CANDIDATE_SOURCE_PATHS,
    DEFAULT_SHAPE_CONCURRENCY,
    Q_STREAMS,
    SHAPE_REPETITIONS,
    bounded,
    captureRuntimeIdentity,
    captureCandidateSource,
    collectFiles,
    main,
    nextAttempt,
    parseArguments,
    preflight,
    readRetainedQStream,
    runtimeIdentitySha256,
    validateReferenceDocument,
    validateMalformedControlDocument,
    validateInputBundleReceipt,
    validateQPayloadRuntime,
    validateRuntimeIdentity,
    runMetamorphicCampaign,
    runCampaign: runMetamorphicCampaign,
    resumeMetamorphicCampaign,
    sidecarPath,
    sha256Buffer,
    sha256File,
    verifyCandidateSnapshot,
    verifyFrozenInputBoundary,
    writeCandidateSnapshot
};

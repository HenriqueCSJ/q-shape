'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runner = require('../scripts/run-metamorphic-parity.cjs');
const malformedControls = require('../scripts/metamorphic-malformed-controls.cjs');

const CASES_PATH = 'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/' +
    'validation_preregistrations/metamorphic-adversarial-v1-102895a8-20260824/cases.json';
const EXPECTED_CANDIDATE_SOURCE_PATHS = Object.freeze([
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

function frozenCases() {
    return JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
}

function runtimeBindings(cases) {
    const byCn = new Map();
    for (const item of cases.cases) {
        if (!byCn.has(item.cn)) byCn.set(item.cn, new Map());
        byCn.get(item.cn).set(item.parent_reference_code, item.parent_reference_index);
    }
    return [...byCn.entries()].sort((a, b) => a[0] - b[0]).map(([cn, values]) => ({
        cn,
        targets: [...values.entries()].sort((a, b) => a[1] - b[1]).map(([code, ordinal]) => ({
            code,
            qshapeCode: code,
            shapeCode: code,
            ordinal,
            coordinates: []
        }))
    }));
}

function tempOutput(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `qshape-${label}-`));
}

function git(repo, args) {
    const result = childProcess.spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
}

function writeCandidateRepo(parent) {
    const repo = path.join(parent, 'candidate');
    fs.mkdirSync(repo, { recursive: true });
    for (const relativePath of EXPECTED_CANDIDATE_SOURCE_PATHS) {
        const destination = path.join(repo, ...relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const content = relativePath === '.gitattributes' ? '* text eol=lf\n' : `fixture:${relativePath}\n`;
        fs.writeFileSync(destination, content);
    }
    git(repo, ['init', '--quiet']);
    git(repo, ['config', 'user.name', 'Q-Shape validation test']);
    git(repo, ['config', 'user.email', 'qshape-validation-test@example.invalid']);
    git(repo, ['add', '--all']);
    git(repo, ['commit', '--quiet', '-m', 'frozen candidate']);
    return repo;
}

function writeFrozenInputs(parent, cases) {
    const casesPath = path.join(parent, 'cases.json');
    fs.copyFileSync(CASES_PATH, casesPath);
    const references = runtimeBindings(cases).map(group => ({
        cn: group.cn,
        count: group.targets.length,
        references: group.targets.map(target => ({
            qshape_code: target.code,
            qshape_index: target.ordinal
        }))
    }));
    const referenceDocument = {
        schema_version: 2,
        campaign_id: cases.campaign_id,
        source_cases_sha256: runner.sha256File(casesPath),
        count: references.reduce((sum, group) => sum + group.count, 0),
        by_cn: references
    };
    const malformedDocument = malformedControls.buildMalformedControlDocument(
        cases,
        runner.sha256File(casesPath)
    );
    const referencesPath = path.join(parent, 'references.json');
    const malformedPath = path.join(parent, 'malformed-controls.json');
    fs.writeFileSync(referencesPath, `${JSON.stringify(referenceDocument, null, 2)}\n`);
    fs.writeFileSync(malformedPath, `${JSON.stringify(malformedDocument, null, 2)}\n`);
    return { cases: casesPath, references: referencesPath, malformedControls: malformedPath, repo: writeCandidateRepo(parent) };
}

function basicOptions(output, cases, frozen, overrides = {}) {
    return {
        output,
        cases: frozen.cases,
        references: frozen.references,
        malformedControls: frozen.malformedControls,
        repo: frozen.repo,
        runtimeBindings: runtimeBindings(cases),
        requireFrozenCensus: false,
        validateRowCounts: false,
        ...overrides
    };
}

function fakeDependencies(trace, failFirst = false) {
    let failed = false;
    let active = 0;
    let maxActive = 0;
    return {
        qualificationRunner: async () => {
            trace.push('qualification');
            return { status: 'qualified', executable_sha256: 'fake' };
        },
        shapeRunner: async context => {
            trace.push(`shape:${context.invocation.id}`);
            if (failFirst && !failed && context.invocation.id.endsWith('-r1')) {
                failed = true;
                throw new Error('injected shape interruption');
            }
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 1));
            active -= 1;
            return { stdout: 'fake shape stdout\n', stderr: '', exitCode: 0, rows: [] };
        },
        qRunner: async context => {
            assert.equal(path.basename(context.cases), 'cases.json');
            assert.equal(path.basename(path.dirname(context.cases)), 'frozen');
            assert.equal(path.basename(context.references), 'references.json');
            trace.push(`q:${context.stream}`);
            return { payload: { stream: context.stream, results: [] } };
        },
        malformedRunner: async context => {
            assert.equal(context.controlsDocument.count, 7);
            assert.equal(path.basename(context.controlsPath), 'malformed-controls.json');
            assert.equal(path.basename(path.dirname(context.controlsPath)), 'frozen');
            trace.push(`malformed:${context.controlsSha256.length}`);
            const controls = context.controlsDocument.controls.map(control => ({
                control_id: control.control_id,
                program: control.program,
                interface: control.interface,
                category: control.category,
                cn: control.cn,
                source_parent_case_id: control.source_parent_case_id,
                campaign_gate: 'malformed_control_contract',
                expected_outcome: control.expected_outcome,
                observed_outcome: control.expected_outcome,
                expected_numeric_rows: control.expected_numeric_rows,
                observed_numeric_rows: control.expected_numeric_rows,
                observation_complete: true,
                product_boundary_invoked: true,
                raw_evidence_paths: [],
                status: 'pass'
            }));
            return {
                schema_version: 1,
                campaign_id: 'qshape-metamorphic-malformed-v1',
                campaign_gate: 'malformed_control_contract',
                evidence_scope: 'product_boundaries',
                product_boundary_invoked: true,
                source_positive_cases_sha256: context.casesSha256,
                source_controls_sha256: context.controlsSha256,
                count: 7,
                passed: 7,
                failed: 0,
                campaign_gate_status: 'pass',
                results: controls,
                controls
            };
        },
        analysisRunner: async input => {
            assert.equal(input.malformedObservations.evidence_scope, 'product_boundaries');
            trace.push(`analysis:${Object.keys(input.qshapeRowsByStream).length}`);
            return { summary: { campaign_gate_status: 'pass' }, failures: [] };
        },
        verifier: async context => {
            trace.push(`verifier:${context.manifestSha256.length}`);
            return {
                status: 'pass',
                exitCode: 0,
                stderr: '',
                receiptParseError: null,
                verifiedCounts: context.expectedVerifiedCounts,
                receipt: {
                    verification_status: 'valid',
                    manifest_sha256: context.manifestSha256,
                    package_status: 'complete',
                    campaign_gate_status: context.manifest.campaign_gate_status,
                    overall_validation_status: 'incomplete',
                    verified_counts: context.expectedVerifiedCounts,
                    warnings: []
                }
            };
        },
        get maxActive() { return maxActive; }
    };
}

function tinySchedule(invocationCount = 1) {
    return () => ({
        counts: { recipeCount: 1, invocationCount, targetEvaluationsPerRepetition: 0 },
        invocations: Array.from({ length: invocationCount }, (_, offset) => ({
            id: `s01-c02-b01-r${offset + 1}`,
            repetition: offset + 1,
            expectedRowCount: 0,
            targetCodes: [],
            caseIds: [],
            cases: []
        }))
    });
}

async function waitForChildFile(child, filePath, stderrChunks, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (!fs.existsSync(filePath)) {
        if (child.exitCode !== null) {
            throw new Error(`hard-interruption child exited early (${child.exitCode}): ${stderrChunks.join('')}`);
        }
        if (Date.now() >= deadline) throw new Error(`timed out waiting for hard-interruption child: ${stderrChunks.join('')}`);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

test('fresh runner refuses an existing output before any execution hook', async () => {
    assert.deepEqual(runner.CANDIDATE_SOURCE_PATHS, EXPECTED_CANDIDATE_SOURCE_PATHS);
    const cases = frozenCases();
    const parent = tempOutput('refuse');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    fs.mkdirSync(output);
    let called = false;
    await assert.rejects(
        runner.runMetamorphicCampaign(basicOptions(output, cases, frozen, {
            shapeRunner: async () => { called = true; },
            qRunner: async () => { called = true; }
        })),
        error => error.code === 'OUTPUT_EXISTS'
    );
    assert.equal(called, false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('preflight hash-binds explicit references and malformed controls before hooks', async () => {
    const cases = frozenCases();
    const parent = tempOutput('hash-bind');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const references = JSON.parse(fs.readFileSync(frozen.references, 'utf8'));
    references.source_cases_sha256 = '0'.repeat(64);
    const badReferencesPath = path.join(parent, 'bad-references.json');
    fs.writeFileSync(badReferencesPath, `${JSON.stringify(references, null, 2)}\n`);
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, { ...frozen, references: badReferencesPath }, fakeDependencies([]))
        ),
        error => error.code === 'REFERENCES_HASH_MISMATCH'
    );
    const malformed = JSON.parse(fs.readFileSync(frozen.malformedControls, 'utf8'));
    malformed.source_positive_cases_sha256 = '0'.repeat(64);
    const badMalformedPath = path.join(parent, 'bad-malformed-controls.json');
    fs.writeFileSync(badMalformedPath, `${JSON.stringify(malformed, null, 2)}\n`);
    const trace = [];
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, { ...frozen, malformedControls: badMalformedPath }, fakeDependencies(trace))
        ),
        error => error.code === 'MALFORMED_HASH_MISMATCH'
    );
    assert.deepEqual(trace, []);
    assert.equal(fs.existsSync(output), false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('preflight rejects a dirty candidate before creating output or invoking numerical hooks', async () => {
    const cases = frozenCases();
    const parent = tempOutput('dirty-candidate');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    fs.appendFileSync(path.join(frozen.repo, 'package.json'), 'dirty\n');
    const trace = [];
    await assert.rejects(
        runner.runMetamorphicCampaign(basicOptions(output, cases, frozen), fakeDependencies(trace)),
        error => error.code === 'CANDIDATE_WORKTREE_DIRTY'
    );
    assert.deepEqual(trace, []);
    assert.equal(fs.existsSync(output), false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('candidate snapshot validation rejects retained source-byte tampering', () => {
    const parent = tempOutput('snapshot-tamper');
    const repo = writeCandidateRepo(parent);
    const output = path.join(parent, 'package');
    fs.mkdirSync(output);
    const candidate = runner.captureCandidateSource(repo);
    runner.writeCandidateSnapshot(output, candidate);
    const tamperedPath = path.join(output, 'inputs', 'candidate-snapshot', 'package-lock.json');
    fs.appendFileSync(tamperedPath, 'tampered\n');
    assert.throws(
        () => runner.verifyCandidateSnapshot(output, candidate.identity),
        error => error.code === 'CANDIDATE_SNAPSHOT_CHANGED'
    );
    fs.rmSync(parent, { recursive: true, force: true });
});

test('retained Q stream acceptance requires its complete internally consistent evidence set', () => {
    const root = tempOutput('q-checkpoint');
    fs.writeFileSync(path.join(root, 'payload.json'), '{"stream":"q_primary_input_derived_r1","results":[]}\n');
    fs.writeFileSync(path.join(root, 'rows.json'), '[]\n');
    fs.writeFileSync(path.join(root, 'stdout.txt'), '');
    fs.writeFileSync(path.join(root, 'stderr.txt'), '');
    fs.writeFileSync(path.join(root, 'exit-code.txt'), '0\n');
    fs.writeFileSync(path.join(root, 'raw-result.json'), '{"payload":{"results":[]}}\n');
    assert.deepEqual(runner.readRetainedQStream(root, 'q_primary_input_derived_r1', 0, true), []);
    fs.rmSync(path.join(root, 'payload.json'));
    assert.throws(
        () => runner.readRetainedQStream(root, 'q_primary_input_derived_r1', 0, true),
        error => error.code === 'Q_STREAM_CHECKPOINT_CORRUPT'
    );
    fs.rmSync(root, { recursive: true, force: true });
});

test('attempt selection rejects gaps and any newer attempt after a complete checkpoint', () => {
    const invocation = {
        id: 's01-c02-b01-r1', repetition: 1, expectedRowCount: 0,
        targetCodes: [], caseIds: [], cases: []
    };
    const gapRoot = tempOutput('attempt-gap');
    for (const number of [1, 3]) {
        const attempt = path.join(
            gapRoot, 'shape', 'attempts', invocation.id, `attempt-${String(number).padStart(2, '0')}`
        );
        fs.mkdirSync(attempt, { recursive: true });
        fs.writeFileSync(path.join(attempt, 'checkpoint.json'), JSON.stringify({
            schema_version: 1,
            status: 'failed',
            invocation_id: invocation.id,
            attempt_number: number,
            error: { message: 'retained failure' }
        }));
    }
    assert.throws(() => runner.nextAttempt(gapRoot, invocation), error => error.code === 'CHECKPOINT_CORRUPT');
    fs.rmSync(gapRoot, { recursive: true, force: true });

    const newerRoot = tempOutput('attempt-after-complete');
    const first = path.join(newerRoot, 'shape', 'attempts', invocation.id, 'attempt-01');
    const second = path.join(newerRoot, 'shape', 'attempts', invocation.id, 'attempt-02');
    fs.mkdirSync(first, { recursive: true });
    fs.mkdirSync(second, { recursive: true });
    fs.writeFileSync(path.join(first, 'rows.json'), '[]\n');
    fs.writeFileSync(path.join(first, 'checkpoint.json'), JSON.stringify({
        schema_version: 1,
        status: 'complete',
        invocation_id: invocation.id,
        attempt_number: 1,
        expected_row_count: 0,
        completed_row_count: 0,
        evidence: 'retained in this immutable attempt directory'
    }));
    fs.writeFileSync(path.join(second, 'partial.txt'), 'newer partial bytes\n');
    assert.throws(() => runner.nextAttempt(newerRoot, invocation), error => error.code === 'CHECKPOINT_CORRUPT');
    assert.equal(JSON.parse(fs.readFileSync(path.join(second, 'checkpoint.json'), 'utf8')).status, 'abandoned');
    fs.rmSync(newerRoot, { recursive: true, force: true });

    const duplicateRoot = tempOutput('duplicate-complete');
    for (const number of [1, 2]) {
        const attempt = path.join(
            duplicateRoot, 'shape', 'attempts', invocation.id, `attempt-${String(number).padStart(2, '0')}`
        );
        fs.mkdirSync(attempt, { recursive: true });
        fs.writeFileSync(path.join(attempt, 'rows.json'), '[]\n');
        fs.writeFileSync(path.join(attempt, 'checkpoint.json'), JSON.stringify({
            schema_version: 1,
            status: 'complete',
            invocation_id: invocation.id,
            attempt_number: number,
            expected_row_count: 0,
            completed_row_count: 0,
            evidence: 'retained in this immutable attempt directory'
        }));
    }
    assert.throws(() => runner.nextAttempt(duplicateRoot, invocation), error => error.code === 'CHECKPOINT_CORRUPT');
    fs.rmSync(duplicateRoot, { recursive: true, force: true });
});

test('runner serializes qualification, caps SHAPE at two, keeps five Q streams separate, and seals evidence', async () => {
    const cases = frozenCases();
    const parent = tempOutput('campaign');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const trace = [];
    const dependencies = fakeDependencies(trace);
    const qualification = dependencies.qualificationRunner;
    dependencies.qualificationRunner = async context => {
        assert.equal(fs.existsSync(path.join(context.outputRoot, 'inputs', 'frozen', 'registry.json')), true);
        assert.equal(fs.existsSync(path.join(context.outputRoot, 'inputs', 'frozen', 'malformed-controls.json')), true);
        return qualification(context);
    };
    const result = await runner.runMetamorphicCampaign(basicOptions(output, cases, frozen), dependencies);

    assert.equal(result.shapeCalls.scheduled, 990);
    assert.equal(result.shapeCalls.completed, 990);
    assert.equal(result.shapeCalls.failed, 0);
    assert.equal(result.stages.shape.serial_block_calls, 15);
    assert.ok(result.shapeCalls.max_concurrency <= 2);
    assert.equal(trace[0], 'qualification');
    const shapeTrace = trace.filter(item => item.startsWith('shape:'));
    assert.equal(shapeTrace.length, 990);
    assert.equal(new Set(shapeTrace.slice(0, 15)).size, 15);
    assert.deepEqual(
        trace.filter(item => item.startsWith('q:')).map(item => item.slice(2)),
        runner.Q_STREAMS
    );
    assert.equal(fs.existsSync(path.join(output, 'manifest.json')), true);
    assert.equal(fs.existsSync(runner.sidecarPath(output)), true);

    const attemptsRoot = path.join(output, 'shape', 'attempts');
    const invocationDirectories = fs.readdirSync(attemptsRoot, { withFileTypes: true }).filter(item => item.isDirectory());
    const checkpoints = invocationDirectories.flatMap(invocation =>
        fs.readdirSync(path.join(attemptsRoot, invocation.name), { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(attempt => path.join(attemptsRoot, invocation.name, attempt.name, 'checkpoint.json'))
    );
    assert.equal(invocationDirectories.length, 990);
    assert.equal(checkpoints.length, 990);
    assert.ok(checkpoints.every(file => JSON.parse(fs.readFileSync(file, 'utf8')).status === 'complete'));

    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.sealed, true);
    assert.equal(manifest.counts.invocationCount, 990);
    assert.equal(manifest.counts.recipeCount, 33);
    assert.equal(manifest.candidate_source.repo_commit, git(frozen.repo, ['rev-parse', 'HEAD']));
    assert.equal(manifest.candidate_source.worktree_clean_before_run, true);
    assert.equal(manifest.candidate_source.worktree_clean_before_seal, true);
    assert.deepEqual(manifest.verification_contract.expected_verified_counts, {
        references: 87,
        cases: 2871,
        matched_target_evaluations_per_program: 28545,
        shape_invocations: 990,
        shape_rows_with_repetitions: 57090,
        qshape_rows_total: 0,
        malformed_controls: 7,
        campaign_failures: 0
    });
    const snapshotRoot = path.join(output, 'inputs', 'candidate-snapshot');
    const snapshotIdentity = JSON.parse(fs.readFileSync(path.join(snapshotRoot, 'identity.json'), 'utf8'));
    assert.deepEqual(snapshotIdentity.files.map(item => item.path), EXPECTED_CANDIDATE_SOURCE_PATHS);
    for (const file of snapshotIdentity.files) {
        assert.equal(runner.sha256File(path.join(snapshotRoot, ...file.path.split('/'))), file.sha256);
    }
    assert.equal(fs.existsSync(path.join(output, 'recipes.json')), true);
    assert.equal(fs.existsSync(path.join(output, 'manifest.sha256')), true);
    assert.ok(manifest.files.every(file => Number.isInteger(file.size_bytes)));
    assert.equal(fs.existsSync(path.join(output, 'reports', 'comparison-rows.csv')), true);
    assert.equal(fs.existsSync(path.join(output, 'reports', 'data-dictionary.json')), true);
    assert.equal(JSON.parse(fs.readFileSync(runner.sidecarPath(output), 'utf8')).verifier_exit_code, 0);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('resume preserves failed attempt and allocates a new immutable attempt', async () => {
    const cases = frozenCases();
    const parent = tempOutput('resume');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const scheduleBuilder = () => ({
        counts: { recipeCount: 1, invocationCount: 2, targetEvaluationsPerRepetition: 0 },
        invocations: [
            { id: 's01-c02-b01-r1', repetition: 1, expectedRowCount: 0, targetCodes: [], caseIds: [], cases: [] },
            { id: 's01-c02-b01-r2', repetition: 2, expectedRowCount: 0, targetCodes: [], caseIds: [], cases: [] }
        ]
    });
    const firstTrace = [];
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { scheduleBuilder, ...fakeDependencies(firstTrace, true) })
        ),
        /injected shape interruption/
    );
    const firstAttempt = path.join(output, 'shape', 'attempts', 's01-c02-b01-r1', 'attempt-01', 'checkpoint.json');
    assert.equal(JSON.parse(fs.readFileSync(firstAttempt, 'utf8')).status, 'failed');

    const resumedTrace = [];
    const resumed = await runner.runMetamorphicCampaign(
        basicOptions(output, cases, frozen, { resume: true, scheduleBuilder, ...fakeDependencies(resumedTrace) })
    );
    const secondAttempt = path.join(output, 'shape', 'attempts', 's01-c02-b01-r1', 'attempt-02', 'checkpoint.json');
    assert.equal(JSON.parse(fs.readFileSync(secondAttempt, 'utf8')).status, 'complete');
    assert.equal(fs.existsSync(runner.sidecarPath(output)), true);
    assert.equal(resumed.verification.exitCode, 0);
    assert.equal(resumed.shapeCalls.completed, 2);
    assert.equal(resumed.shapeCalls.failed, 1);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('resume binds a checkpointless hard-interrupted attempt before allocating the retry', async () => {
    const cases = frozenCases();
    const parent = tempOutput('hard-interruption');
    const output = path.join(parent, 'package');
    const readyPath = path.join(parent, 'child-ready.txt');
    const frozen = writeFrozenInputs(parent, cases);
    const config = {
        output,
        cases: frozen.cases,
        references: frozen.references,
        malformedControls: frozen.malformedControls,
        repo: frozen.repo,
        readyPath
    };
    const childScript = `
        const fs = require('node:fs');
        const path = require('node:path');
        const runner = require(process.env.QSHAPE_RUNNER_PATH);
        const config = JSON.parse(process.env.QSHAPE_HARD_KILL_CONFIG);
        const scheduleBuilder = () => ({
            counts: { recipeCount: 1, invocationCount: 1, targetEvaluationsPerRepetition: 0 },
            invocations: [{
                id: 's01-c02-b01-r1', repetition: 1, expectedRowCount: 0,
                targetCodes: [], caseIds: [], cases: []
            }]
        });
        runner.runMetamorphicCampaign({
            output: config.output,
            cases: config.cases,
            references: config.references,
            malformedControls: config.malformedControls,
            repo: config.repo,
            requireFrozenCensus: false,
            validateRowCounts: false,
            scheduleBuilder
        }, {
            qualificationRunner: async () => ({ status: 'qualified', executable_sha256: 'fake' }),
            shapeRunner: async context => {
                fs.writeFileSync(path.join(context.attemptPath, 'partial-process-output.txt'), 'partial bytes\\n');
                fs.writeFileSync(config.readyPath, 'ready\\n');
                await new Promise(resolve => setInterval(resolve, 60000));
                return { rows: [] };
            },
            verifier: async () => ({ status: 'unreachable', exitCode: 70 })
        }).catch(error => {
            process.stderr.write(String(error.stack || error));
            process.exitCode = 1;
        });
    `;
    const stderrChunks = [];
    const child = childProcess.spawn(process.execPath, ['-e', childScript], {
        env: {
            ...process.env,
            QSHAPE_RUNNER_PATH: path.resolve(__dirname, '../scripts/run-metamorphic-parity.cjs'),
            QSHAPE_HARD_KILL_CONFIG: JSON.stringify(config)
        },
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true
    });
    child.stderr.on('data', chunk => stderrChunks.push(chunk.toString('utf8')));
    await waitForChildFile(child, readyPath, stderrChunks);
    const exitPromise = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    assert.equal(child.kill('SIGKILL'), true);
    await exitPromise;

    const firstAttemptRoot = path.join(output, 'shape', 'attempts', 's01-c02-b01-r1', 'attempt-01');
    assert.equal(fs.existsSync(path.join(firstAttemptRoot, 'checkpoint.json')), false);
    const resumed = await runner.runMetamorphicCampaign(
        basicOptions(output, cases, frozen, { resume: true, scheduleBuilder: tinySchedule(1) }),
        fakeDependencies([])
    );
    const abandoned = JSON.parse(fs.readFileSync(path.join(firstAttemptRoot, 'checkpoint.json'), 'utf8'));
    assert.equal(abandoned.status, 'abandoned');
    assert.equal(abandoned.reason, 'interrupted_before_checkpoint');
    assert.equal(abandoned.evidence, 'retained partial evidence; never used as a completed result');
    assert.deepEqual(abandoned.retained_files, [{
        path: 'partial-process-output.txt',
        size_bytes: 14,
        sha256: runner.sha256File(path.join(firstAttemptRoot, 'partial-process-output.txt'))
    }]);
    assert.equal(JSON.parse(fs.readFileSync(
        path.join(output, 'shape', 'attempts', 's01-c02-b01-r1', 'attempt-02', 'checkpoint.json'),
        'utf8'
    )).status, 'complete');
    assert.equal(resumed.shapeCalls.failed, 1);
    assert.equal(resumed.shapeCalls.abandoned, 1);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('resume rejects a different clean candidate commit before reusing retained attempts', async () => {
    const cases = frozenCases();
    const parent = tempOutput('resume-candidate-change');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const scheduleBuilder = tinySchedule(1);
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { scheduleBuilder }),
            fakeDependencies([], true)
        ),
        /injected shape interruption/
    );
    fs.appendFileSync(path.join(frozen.repo, 'package.json'), 'new committed candidate\n');
    git(frozen.repo, ['add', 'package.json']);
    git(frozen.repo, ['commit', '--quiet', '-m', 'different candidate']);
    const trace = [];
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { resume: true, scheduleBuilder }),
            fakeDependencies(trace)
        ),
        error => error.code === 'CANDIDATE_SOURCE_CHANGED'
    );
    assert.deepEqual(trace, []);
    assert.equal(fs.existsSync(path.join(output, 'manifest.json')), false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('final recheck rejects drift of the original frozen inputs after retained copies were consumed', async () => {
    const cases = frozenCases();
    const parent = tempOutput('frozen-drift');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const dependencies = fakeDependencies([]);
    const baseShapeRunner = dependencies.shapeRunner;
    dependencies.shapeRunner = async context => {
        const result = await baseShapeRunner(context);
        fs.appendFileSync(frozen.cases, 'drift\n');
        return result;
    };
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { scheduleBuilder: tinySchedule(1) }),
            dependencies
        ),
        error => error.code === 'FROZEN_INPUT_CHANGED'
    );
    assert.equal(fs.existsSync(path.join(output, 'manifest.json')), false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('final recheck rejects candidate source drift introduced during numerical execution', async () => {
    const cases = frozenCases();
    const parent = tempOutput('candidate-drift');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const dependencies = fakeDependencies([]);
    const baseShapeRunner = dependencies.shapeRunner;
    dependencies.shapeRunner = async context => {
        const result = await baseShapeRunner(context);
        fs.appendFileSync(path.join(frozen.repo, 'package.json'), 'drift\n');
        return result;
    };
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { scheduleBuilder: tinySchedule(1) }),
            dependencies
        ),
        error => error.code === 'CANDIDATE_WORKTREE_DIRTY'
    );
    assert.equal(fs.existsSync(path.join(output, 'manifest.json')), false);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('resume reuses only byte-identical final qualification evidence', async () => {
    const cases = frozenCases();
    const parent = tempOutput('resume-final-qualification');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const dependencies = fakeDependencies([]);
    let analysisCalls = 0;
    dependencies.analysisRunner = async () => ({
        summary: { campaign_gate_status: analysisCalls++ === 0 ? 'not_evaluated' : 'pass' },
        failures: []
    });
    const options = basicOptions(output, cases, frozen, { scheduleBuilder: tinySchedule(1) });
    await assert.rejects(
        runner.runMetamorphicCampaign(options, dependencies),
        error => error.code === 'CAMPAIGN_STATUS_INVALID'
    );
    const finalQualificationPath = path.join(output, 'shape', 'qualification-final.json');
    const retainedBytes = fs.readFileSync(finalQualificationPath);
    const resumed = await runner.runMetamorphicCampaign({ ...options, resume: true }, dependencies);
    assert.equal(resumed.verification.exitCode, 0);
    assert.equal(fs.readFileSync(finalQualificationPath).equals(retainedBytes), true);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('verifier failure retains a deterministic sidecar and rejects the campaign', async () => {
    const cases = frozenCases();
    const parent = tempOutput('verify-fail');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const scheduleBuilder = () => ({
        counts: { recipeCount: 1, invocationCount: 1, targetEvaluationsPerRepetition: 0 },
        invocations: [{ id: 's01-c02-b01-r1', repetition: 1, expectedRowCount: 0, targetCodes: [], caseIds: [], cases: [] }]
    });
    const trace = [];
    const dependencies = {
        ...fakeDependencies(trace),
        verifier: async () => ({ status: 'fail', exitCode: 2, warnings: ['gate_failed'] })
    };
    await assert.rejects(
        runner.runMetamorphicCampaign(basicOptions(output, cases, frozen, { scheduleBuilder }), dependencies),
        error => error.code === 'VERIFIER_FAILED'
    );
    const receiptPath = runner.sidecarPath(output);
    assert.equal(fs.existsSync(receiptPath), true);
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    assert.equal(receipt.verifier_exit_code, 2);
    assert.equal(receipt.receipt, null);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.package_status, 'complete');
    for (const listed of manifest.files) {
        assert.equal(runner.sha256File(path.join(output, listed.path)), listed.sha256);
    }
    fs.rmSync(parent, { recursive: true, force: true });
});

test('runner rejects an otherwise valid verifier receipt with non-exact verified counts', async () => {
    const cases = frozenCases();
    const parent = tempOutput('verify-count-mismatch');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const dependencies = fakeDependencies([]);
    dependencies.verifier = async context => {
        const wrongCounts = { ...context.expectedVerifiedCounts, cases: context.expectedVerifiedCounts.cases + 1 };
        return {
            status: 'pass',
            exitCode: 0,
            stderr: '',
            receiptParseError: null,
            verifiedCounts: wrongCounts,
            receipt: {
                verification_status: 'valid',
                manifest_sha256: context.manifestSha256,
                package_status: 'complete',
                campaign_gate_status: 'pass',
                overall_validation_status: 'incomplete',
                verified_counts: wrongCounts,
                warnings: []
            }
        };
    };
    await assert.rejects(
        runner.runMetamorphicCampaign(
            basicOptions(output, cases, frozen, { scheduleBuilder: tinySchedule(1) }),
            dependencies
        ),
        error => error.code === 'VERIFIER_FAILED'
    );
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.verification_contract.expected_verified_counts.cases, 2871);
    assert.equal(JSON.parse(fs.readFileSync(runner.sidecarPath(output), 'utf8')).receipt.verified_counts.cases, 2872);
    fs.rmSync(parent, { recursive: true, force: true });
});

test('scientific gate failure remains a valid sealed package when verifier returns normative exit 2', async () => {
    const cases = frozenCases();
    const parent = tempOutput('scientific-fail');
    const output = path.join(parent, 'package');
    const frozen = writeFrozenInputs(parent, cases);
    const scheduleBuilder = () => ({
        counts: { recipeCount: 1, invocationCount: 1, targetEvaluationsPerRepetition: 0 },
        invocations: [{ id: 's01-c02-b01-r1', repetition: 1, expectedRowCount: 0, targetCodes: [], caseIds: [], cases: [] }]
    });
    const dependencies = fakeDependencies([]);
    dependencies.analysisRunner = async () => ({
        summary: {
            campaign_gate_status: 'fail',
            overall_validation_status: 'incomplete',
            totals: { cases: 0, comparisons_expected: 0, comparisons_observed: 0, failures: 1 }
        },
        failures: [{
            failure_id: 'failure-test', event_type: 'test_gate', gate: 'test_gate', status: 'fail',
            severity: 'gate_failure', stream: '', repetition: '', execution_unit_id: 'test',
            case_id: '', cn: '', target_code: '', comparison_code: '', observed: 'fail',
            threshold: 'pass', details: 'injected scientific failure'
        }]
    });
    dependencies.verifier = async context => ({
        status: 'fail',
        exitCode: 2,
        stderr: '',
        receiptParseError: null,
        receipt: {
            verification_status: 'valid',
            manifest_sha256: context.manifestSha256,
            package_status: 'complete',
            campaign_gate_status: 'fail',
            overall_validation_status: 'incomplete',
            verified_counts: context.expectedVerifiedCounts,
            warnings: []
        }
    });
    const result = await runner.runMetamorphicCampaign(
        basicOptions(output, cases, frozen, { scheduleBuilder }),
        dependencies
    );
    assert.equal(result.analysis.summary.campaign_gate_status, 'fail');
    assert.equal(result.verification.exitCode, 2);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.campaign_gate_status, 'fail');
    assert.equal(manifest.package_status, 'complete');
    assert.equal(JSON.parse(fs.readFileSync(runner.sidecarPath(output), 'utf8')).verifier_exit_code, 2);
    fs.rmSync(parent, { recursive: true, force: true });
});

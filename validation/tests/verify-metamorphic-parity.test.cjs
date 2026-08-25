'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const generator = require('../scripts/metamorphic-cases.cjs');
const freezer = require('../scripts/freeze-metamorphic-execution-inputs.cjs');
const referencePreparation = require('../scripts/prepare-metamorphic-references.cjs');
const reporting = require('../scripts/metamorphic-reporting.cjs');
const verifier = require('../scripts/verify-metamorphic-parity.cjs');
const { directReferencesPath } = require('./helpers/metamorphic-fixtures.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VERIFIER_PATH = path.resolve(
    __dirname,
    '..',
    'scripts',
    'verify-metamorphic-parity.cjs'
);
const PRODUCTION_CANDIDATE_SOURCE_PATHS = Object.freeze([
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

const generated = generator.generateMetamorphicCases(REPO_ROOT);
const caseText = `${JSON.stringify(generated.document, null, 2)}\n`;
const caseBytes = Buffer.from(caseText, 'utf8');
const references = referencePreparation.buildMetamorphicReferenceDocument(
    JSON.parse(fs.readFileSync(directReferencesPath(), 'utf8')),
    generated.document,
    {
        directReferencesSha256: referencePreparation.DIRECT_REFERENCES_SHA256,
        casesSha256: generator.PREREGISTERED_DOCUMENT_SHA256
    }
);

function stableJson(value) {
    if (Array.isArray(value)) return value.map(stableJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
    }
    return value;
}

function loadFrozenPackageInputValidator() {
    const source = `${fs.readFileSync(VERIFIER_PATH, 'utf8')}\n` +
        'module.exports.__lineageTest = { validateFrozenPackageInputs };\n';
    const fixtureModule = new Module(`${VERIFIER_PATH}.lineage-test.cjs`, module);
    fixtureModule.filename = VERIFIER_PATH;
    fixtureModule.paths = Module._nodeModulePaths(path.dirname(VERIFIER_PATH));
    fixtureModule._compile(source, VERIFIER_PATH);
    return fixtureModule.exports.__lineageTest.validateFrozenPackageInputs;
}

test('production verifier imports only Node core and no campaign implementation', () => {
    const source = fs.readFileSync(VERIFIER_PATH, 'utf8');
    assert.doesNotMatch(source, /require\(['"]\.\//);
    assert.doesNotMatch(source, /require\(['"]\.\.\//);
    assert.doesNotMatch(source, /require\(['"]decimal\.js/);
    assert.doesNotMatch(
        source,
        /require\([^)]*(?:metamorphic-cases\.cjs|metamorphic-parity-analysis\.cjs)/
    );
});

test('independent decimal and CSV primitives preserve lexical scientific evidence', () => {
    assert.equal(verifier.compareDecimals(
        verifier.parseDecimal('0.010000000000000000'),
        verifier.parseDecimal('1e-2')
    ), 0);
    assert.equal(verifier.compareDecimals(
        verifier.absoluteDecimal(verifier.subtractDecimals(
            verifier.parseDecimal('-0.009'),
            verifier.parseDecimal('0.001')
        )),
        verifier.parseDecimal('0.01')
    ), 0);
    assert.equal(verifier.canonicalBinary64Token('1.0000000000000000'), 1);
    assert.throws(() => verifier.canonicalBinary64Token('1.0'), /canonical/);
    assert.deepEqual(verifier.parseCsv('a,b\n"x,y","line 1\nline ""2"""\n'), [
        { a: 'x,y', b: 'line 1\nline "2"' }
    ]);
    assert.deepEqual(verifier.exactDecimalErrorStatistics([
        verifier.parseDecimal('0.1'),
        verifier.parseDecimal('-0.1'),
        verifier.parseDecimal('0')
    ]), {
        count: 3,
        signed_bias: '0',
        mean_absolute_error: '0.0666666666666666667',
        root_mean_square_error: '0.0816496580927726033',
        median_absolute_error: '0.1',
        p95_absolute_error: '0.1',
        p99_absolute_error: '0.1',
        maximum_absolute_error: '0.1'
    });
});

test('manifest verifier enforces safe exact listed/present file equality', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-manifest-'));
    const payload = Buffer.from('evidence\n', 'utf8');
    fs.writeFileSync(path.join(temp, 'evidence.txt'), payload);
    const manifest = {
        schema_version: 2,
        files: [{
            path: 'evidence.txt',
            size_bytes: payload.length,
            sha256: verifier.sha256(payload)
        }]
    };
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    fs.writeFileSync(path.join(temp, 'manifest.json'), manifestText, 'utf8');
    fs.writeFileSync(
        path.join(temp, 'manifest.sha256'),
        `${verifier.sha256(Buffer.from(manifestText))}  manifest.json\n`,
        'utf8'
    );
    const verified = verifier.verifyManifestFiles(temp);
    assert.equal(verified.manifestSha256, verifier.sha256(Buffer.from(manifestText)));
    assert.deepEqual([...verified.listedPaths], ['evidence.txt']);

    fs.writeFileSync(path.join(temp, 'unlisted.txt'), 'tamper\n', 'utf8');
    assert.throws(() => verifier.verifyManifestFiles(temp), /manifest\/present files/);
    assert.throws(() => verifier.normalizeManifestPath('../escape'), /unsafe/);
});

test('independent verifier reconstructs all frozen inputs and the exact pair census', () => {
    const receipt = verifier.verifyFrozenInputs(generated.document, references, caseBytes);
    assert.deepEqual(receipt, {
        campaign_id: 'qshape-metamorphic-adversarial-v1',
        cases_sha256: generator.PREREGISTERED_DOCUMENT_SHA256,
        reference_count: 87,
        case_count: 2871,
        matched_pairs_per_program: 28545,
        input_reconstruction_status: 'pass'
    });
});

test('certified lineage and retained parent fingerprints reject resealed mutations', () => {
    const directLineage = structuredClone(references);
    directLineage.metamorphic_binding.source_direct_references_sha256 = 'f'.repeat(64);
    assert.notEqual(
        verifier.sha256(Buffer.from(JSON.stringify(directLineage))),
        verifier.sha256(Buffer.from(JSON.stringify(references)))
    );
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, directLineage),
        /certified lineage binding mismatch/
    );

    const manifestLineage = structuredClone(references);
    manifestLineage.metamorphic_binding.source_direct_package_manifest_sha256 = 'f'.repeat(64);
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, manifestLineage),
        /certified lineage binding mismatch/
    );

    const parentFingerprint = structuredClone(references);
    parentFingerprint.by_cn[0].references[0]
        .metamorphic_parent_reference_fingerprint_sha256 = 'f'.repeat(64);
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, parentFingerprint),
        /retained parent fingerprint binding mismatch/
    );
});

test('independent package verifier rejects a fingerprint mutation after every enclosing hash is resealed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-fingerprint-reseal-'));
    const frozenRoot = path.join(root, 'inputs', 'frozen');
    const commit = '1'.repeat(40);
    try {
        const bundle = freezer.buildExecutionInputBundle(
            fs.readFileSync(directReferencesPath()),
            caseBytes,
            commit
        );
        const mutatedReferences = JSON.parse(bundle.files['references.json'].toString('utf8'));
        mutatedReferences.by_cn[0].references[0]
            .metamorphic_parent_reference_fingerprint_sha256 = 'f'.repeat(64);
        const referencesBytes = Buffer.from(`${JSON.stringify(mutatedReferences, null, 2)}\n`);

        const receipt = structuredClone(bundle.receipt);
        receipt.references.sha256 = verifier.sha256(referencesBytes);
        const receiptContract = {
            schema_version: receipt.schema_version,
            receipt_kind: receipt.receipt_kind,
            campaign_id: receipt.campaign_id,
            source_commit: receipt.source_commit,
            positive_cases: receipt.positive_cases,
            references: receipt.references,
            malformed_controls: receipt.malformed_controls
        };
        receipt.bundle_sha256 = verifier.sha256(Buffer.from(
            JSON.stringify(stableJson(receiptContract)), 'utf8'
        ));
        const receiptBytes = Buffer.from(
            `${JSON.stringify(stableJson(receipt), null, 2)}\n`, 'utf8'
        );
        const malformedBytes = bundle.files['malformed-controls.json'];
        const registry = {
            schema_version: 1,
            campaign_id: generated.document.campaign_id,
            cases: { path: 'cases.json', sha256: generator.PREREGISTERED_DOCUMENT_SHA256 },
            references: { path: 'references.json', sha256: verifier.sha256(referencesBytes) },
            malformed_controls: {
                path: 'malformed-controls.json',
                sha256: verifier.sha256(malformedBytes)
            },
            input_bundle_receipt: {
                path: 'input-bundle-receipt.json',
                sha256: verifier.sha256(receiptBytes),
                bundle_sha256: receipt.bundle_sha256
            }
        };
        const recipes = {
            schema_version: 1,
            campaign_id: generated.document.campaign_id,
            main_recipe_registry: generated.document.main_recipe_registry,
            adversarial_positive_recipe_registry:
                generated.document.adversarial_positive_recipe_registry,
            main_recipe_registry_sha256: generated.document.main_recipe_registry_sha256,
            adversarial_positive_recipe_registry_sha256:
                generated.document.adversarial_positive_recipe_registry_sha256
        };
        const files = new Map([
            ['inputs/frozen/cases.json', caseBytes],
            ['inputs/frozen/references.json', referencesBytes],
            ['inputs/frozen/malformed-controls.json', malformedBytes],
            ['inputs/frozen/input-bundle-receipt.json', receiptBytes],
            ['inputs/frozen/registry.json', Buffer.from(`${JSON.stringify(registry, null, 2)}\n`)],
            ['recipes.json', Buffer.from(`${JSON.stringify(recipes, null, 2)}\n`)]
        ]);
        for (const [relativePath, bytes] of files) {
            const destination = path.join(root, ...relativePath.split('/'));
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, bytes);
        }
        const manifest = {
            cases_sha256: generator.PREREGISTERED_DOCUMENT_SHA256,
            references_sha256: verifier.sha256(referencesBytes),
            malformed_controls_sha256: verifier.sha256(malformedBytes),
            input_bundle_sha256: receipt.bundle_sha256,
            input_bundle_receipt_sha256: verifier.sha256(receiptBytes),
            candidate_source: { repo_commit: commit }
        };
        const validateFrozenPackageInputs = loadFrozenPackageInputValidator();
        assert.throws(
            () => validateFrozenPackageInputs(root, new Set(files.keys()), manifest),
            /retained parent fingerprint binding mismatch/
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('frozen-byte and semantic case mutations are rejected independently', () => {
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, references, Buffer.from(`${caseText} `)),
        /frozen cases SHA-256 mismatch/
    );

    const mutated = structuredClone(generated.document);
    mutated.cases[0].parent_reference_code = 'tampered';
    assert.throws(
        () => verifier.verifyFrozenInputs(mutated, references),
        /case reconstruction mismatch at meta-cn02-ref01-r01/
    );
});

test('reference coordinate bits and center binding are mandatory', () => {
    const badBits = structuredClone(references);
    badBits.by_cn[0].references[0].qshape_reference_coordinate_float64_hex[0][0] =
        '0000000000000000';
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, badBits),
        /token\/bits mismatch/
    );

    const badCenter = structuredClone(references);
    badCenter.by_cn[0].references[0].qshape_center_index_zero_based = 0;
    assert.throws(
        () => verifier.verifyFrozenInputs(generated.document, badCenter),
        /fingerprint binding mismatch|case reconstruction mismatch/
    );
});

test('input-only CLI returns a deterministic receipt and rejects bad invocation', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-verifier-'));
    const casesPath = path.join(temp, 'cases.json');
    const referencesPath = path.join(temp, 'references.json');
    fs.writeFileSync(casesPath, caseBytes);
    fs.writeFileSync(referencesPath, `${JSON.stringify(references, null, 2)}\n`, 'utf8');

    const good = spawnSync(
        process.execPath,
        [VERIFIER_PATH, '--cases', casesPath, '--references', referencesPath],
        { encoding: 'utf8' }
    );
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).input_reconstruction_status, 'pass');

    const bad = spawnSync(process.execPath, [VERIFIER_PATH], { encoding: 'utf8' });
    assert.equal(bad.status, 64);
    assert.match(bad.stderr, /Usage:/);
});

test('independent report contract reconstructs producer schemas and bytes exactly', () => {
    const analysis = {
        schema_version: 1,
        summary: {
            campaign_gate_status: 'fail',
            overall_validation_status: 'incomplete',
            claim_boundary: 'metamorphic qualification only',
            totals: { cases: 1, comparisons_expected: 1, comparisons_observed: 5, failures: 1 },
            shape_consensus: {
                rows: [{
                    case_id: 'case,1', target_code: 'T-1', shape_r1_token: '1.00000',
                    shape_r2_token: '1.00000', shape_consensus_token: '1.00000',
                    exact_token_agreement: true, domain_valid: true
                }]
            }
        },
        comparison_rows: [{
            stream: 'q_explicit_seed_0', case_id: 'case,1', target_code: 'T-1', cn: 2,
            stratum: 'metamorphic_main', family: 'main_positive', geometry_family: 'T-1',
            recipe_id: 'canonical', recipe_index: 1, recipe_category: 'canonical',
            distortion_type: 'not_applicable', distortion_sign: 'not_applicable',
            distortion_magnitude: 'not_applicable', input_precision_digits: 'not_applicable',
            optimizer_seed_mode: 'explicit', optimizer_seed_uint32: 0,
            browser: 'not_applicable', execution_mode: 'node_worker', qshape_runtime_ms: '0.100000',
            shape_r1_token: '1.00000', shape_r2_token: '1.00000',
            shape_consensus_token: '1.00000', qshape_token: '1.02',
            qshape_float64_hex: '3ff051eb851eb852', signed_error: '0.02', absolute_error: '0.02',
            result_domain_valid: true, pass_abs_0_01: false, seed_policy: 'explicit',
            explicit_seed_uint32: 0
        }],
        case_summaries: [{
            stream: 'q_explicit_seed_0', case_id: 'case,1', ranking_status: 'evaluated',
            not_evaluable_targets: [], shape_best_code: 'T-1', qshape_best_code: 'T-1',
            shape_tie_set: ['T-1'], qshape_tie_set: ['T-1'], exact_best_label_agrees: true,
            qshape_best_within_shape_tie_set: true, resolved_ranking_pairs: 0,
            discordant_ranking_pairs: 0, ranking_agreement_fraction: 'not_evaluable',
            kendall_tau_b: 'not_evaluable', kendall_concordant_pairs: 0,
            kendall_discordant_pairs: 0, kendall_shape_only_ties: 0,
            kendall_qshape_only_ties: 0, kendall_joint_ties: 0, failure_count: 1, pass: false
        }],
        relation_summaries: [{
            child_case_id: 'child', parent_case_id: 'parent', expected_parent_case_id: 'parent',
            authorized: true, relation_status: 'pass', shape_exact_token: 'pass',
            q_explicit_streams: Object.fromEntries(verifier.Q_STREAMS.map(stream => [stream, 'pass']))
        }],
        paired_sign_rows: [{
            stream: 'q_explicit_seed_0', optimizer_seed_mode: 'explicit', optimizer_seed_uint32: 0,
            cn: 2, geometry_family: 'T-1', target_code: 'T-1', distortion_type: 'radial',
            distortion_magnitude: '0.001', minus_case_id: 'minus', plus_case_id: 'plus',
            shape_minus_token: '1.00000', shape_plus_token: '1.00100',
            qshape_minus_token: '1', qshape_plus_token: '1.001', delta_shape: '0.001',
            delta_qshape: '0.001', delta_error: '0', cshm_unit: 'dimensionless_CShM', status: 'pass'
        }],
        stratified_statistics: [{
            stream: 'q_explicit_seed_0', optimizer_seed_mode: 'explicit', optimizer_seed_uint32: 0,
            dimension: 'cn', level: '2', comparisons_total: 1, comparisons_domain_valid: 1,
            cshm_unit: 'dimensionless_CShM', runtime_unit: 'ms', count: 1, signed_bias: '0.02',
            mean_absolute_error: '0.02', root_mean_square_error: '0.02', median_absolute_error: '0.02',
            p95_absolute_error: '0.02', p99_absolute_error: '0.02', maximum_absolute_error: '0.02',
            runtime: { count: 1, mean_ms: '0.1', median_ms: '0.1', p95_ms: '0.1', p99_ms: '0.1', maximum_ms: '0.1' }
        }],
        stream_summaries: {
            q_explicit_seed_0: {
                stream: 'q_explicit_seed_0', seed_mode: 'explicit', explicit_seed_uint32: 0,
                cases_expected: 1, comparisons_expected: 1, comparisons_observed: 1,
                comparisons_domain_valid: 1, failures: 1, campaign_gate_status: 'fail'
            }
        },
        failure_ledger: [{
            failure_id: 'failure-1', event_type: 'threshold_failure', gate: 'absolute_error',
            status: 'fail', severity: 'error', stream: 'q_explicit_seed_0', repetition: '',
            execution_unit_id: 'unit-1', case_id: 'case,1', cn: 2, target_code: 'T-1',
            comparison_code: '', observed: '0.02', threshold: '<0.01', details: 'quoted "detail"'
        }]
    };
    assert.deepEqual(verifier.REPORT_TABLES, reporting.TABLES);
    assert.deepEqual(verifier.buildExpectedDataDictionary(), reporting.buildDataDictionary());
    assert.deepEqual(
        verifier.buildExpectedReportingArtifacts(analysis),
        reporting.buildReportingArtifacts(analysis)
    );
});

test('package receipt and external sidecar follow the sealed runner wrapper contract', () => {
    const manifest = {
        campaign_id: 'qshape-metamorphic-adversarial-v1',
        package_type: 'metamorphic-parity',
        package_status: 'complete',
        overall_validation_status: 'incomplete'
    };
    const counts = { cases: 2871, campaign_failures: 1 };
    const receipt = verifier.expectedPackageReceipt(
        manifest,
        'a'.repeat(64),
        'fail',
        counts,
        ['z-warning', 'a-warning']
    );
    assert.equal(receipt.verification_status, 'valid');
    assert.equal(receipt.package_status, 'complete');
    assert.deepEqual(receipt.warnings, ['a-warning', 'z-warning']);
    assert.equal(verifier.packageExitCodeForReceipt(receipt), 2);
    assert.equal(verifier.packageExitCodeForReceipt({ ...receipt, campaign_gate_status: 'pass' }), 0);

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-sidecar-'));
    const packagePath = path.join(temp, 'sealed-package');
    fs.mkdirSync(packagePath);
    const sidecarPath = `${path.resolve(packagePath)}.verification.json`;
    const wrapper = verifier.expectedExternalPackageSidecar(receipt);
    fs.writeFileSync(sidecarPath, `${JSON.stringify(stableJson(wrapper), null, 2)}\n`, 'utf8');
    assert.equal(verifier.verifyExternalPackageSidecarIfPresent(packagePath, receipt), sidecarPath);

    fs.writeFileSync(sidecarPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    assert.throws(
        () => verifier.verifyExternalPackageSidecarIfPresent(packagePath, receipt),
        /sidecar does not exactly match/
    );
});

test('package CLI maps an invalid package to exit code 3', () => {
    const missing = path.join(os.tmpdir(), `qshape-missing-${process.pid}-${Date.now()}`);
    const result = spawnSync(process.execPath, [VERIFIER_PATH, '--package', missing], { encoding: 'utf8' });
    assert.equal(result.status, 3);
    assert.notEqual(result.stderr.trim(), '');
});

test('candidate snapshot verifier binds the exact 21-file production identity, hashes, Git blobs, lockfile, and final recheck', () => {
    assert.equal(PRODUCTION_CANDIDATE_SOURCE_PATHS.length, 21);
    assert.deepEqual(verifier.CANDIDATE_SOURCE_PATHS, PRODUCTION_CANDIDATE_SOURCE_PATHS);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-candidate-boundary-'));
    const snapshotRoot = path.join(root, 'inputs', 'candidate-snapshot');
    const commit = 'b'.repeat(40);
    const entries = PRODUCTION_CANDIDATE_SOURCE_PATHS.map(sourcePath => {
        const bytes = Buffer.from(sourcePath === 'package-lock.json'
            ? '{"lockfileVersion":3}\n'
            : `candidate:${sourcePath}\n`, 'utf8');
        const destination = path.join(snapshotRoot, ...sourcePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, bytes);
        return {
            path: sourcePath,
            size_bytes: bytes.length,
            sha256: verifier.sha256(bytes),
            git_blob_oid: verifier.gitBlobOid(bytes, 40)
        };
    });
    const tree = { repo_commit: commit, files: entries };
    const treeHash = verifier.sha256(Buffer.from(`${JSON.stringify(stableJson(tree), null, 2)}\n`, 'utf8'));
    const lockEntry = entries.find(entry => entry.path === 'package-lock.json');
    const identity = {
        schema_version: 1,
        identity_kind: 'clean-committed-qshape-candidate',
        repo_commit: commit,
        repo_branch: 'test-branch',
        detached_head: false,
        worktree_clean_at_start: true,
        dependency_lockfile: { path: 'package-lock.json', sha256: lockEntry.sha256 },
        source_tree_sha256: treeHash,
        files: entries
    };
    const identityText = `${JSON.stringify(stableJson(identity), null, 2)}\n`;
    fs.writeFileSync(path.join(snapshotRoot, 'identity.json'), identityText, 'utf8');
    const identityHash = verifier.sha256(Buffer.from(identityText, 'utf8'));
    const finalRecheck = {
        schema_version: 1,
        status: 'unchanged',
        repo_commit: commit,
        source_tree_sha256: treeHash,
        snapshot_identity_sha256: identityHash,
        original_frozen_inputs_unchanged: true,
        retained_frozen_inputs_unchanged: true
    };
    const finalPath = path.join(root, 'metadata', 'candidate-source-final-recheck.json');
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, `${JSON.stringify(finalRecheck, null, 2)}\n`, 'utf8');
    const runState = {
        schema_version: 1,
        status: 'sealed',
        candidate_source_identity: identity,
        stages: {
            preflight: {
                candidate_repo_commit: commit,
                candidate_source_tree_sha256: treeHash,
                candidate_snapshot_identity_sha256: identityHash
            },
            final_candidate_recheck: finalRecheck
        }
    };
    fs.writeFileSync(path.join(root, 'run-state.json'), `${JSON.stringify(runState, null, 2)}\n`, 'utf8');
    const manifest = {
        candidate_source: {
            repo_commit: commit,
            repo_branch: 'test-branch',
            worktree_clean_before_run: true,
            worktree_clean_before_seal: true,
            source_tree_sha256: treeHash,
            snapshot_path: 'inputs/candidate-snapshot',
            snapshot_identity_sha256: identityHash,
            dependency_lockfile: identity.dependency_lockfile
        },
        stages: { final_candidate_recheck: finalRecheck }
    };
    const listedPaths = new Set([
        ...PRODUCTION_CANDIDATE_SOURCE_PATHS.map(sourcePath => `inputs/candidate-snapshot/${sourcePath}`),
        'inputs/candidate-snapshot/identity.json',
        'metadata/candidate-source-final-recheck.json',
        'run-state.json'
    ]);
    const verified = verifier.validateCandidateSourceBoundary({ root, listedPaths, manifest });
    assert.equal(verified.identity.source_tree_sha256, treeHash);

    const incompleteInventory = new Set(listedPaths);
    incompleteInventory.delete(
        'inputs/candidate-snapshot/validation/scripts/freeze-metamorphic-execution-inputs.cjs'
    );
    assert.throws(
        () => verifier.validateCandidateSourceBoundary({
            root,
            listedPaths: incompleteInventory,
            manifest
        }),
        /candidate snapshot exact file set/
    );

    fs.writeFileSync(path.join(snapshotRoot, 'package.json'), 'tampered\n', 'utf8');
    assert.throws(
        () => verifier.validateCandidateSourceBoundary({ root, listedPaths, manifest }),
        /candidate source bytes mismatch/
    );
});

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const analysis = require('../scripts/metamorphic-parity-analysis.cjs');
const reporting = require('../scripts/metamorphic-reporting.cjs');
const productionVerifier = require('../scripts/verify-metamorphic-parity.cjs');

const VERIFIER_PATH = path.resolve(__dirname, '..', 'scripts', 'verify-metamorphic-parity.cjs');
const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const CONTROL_CAMPAIGN_ID = 'qshape-metamorphic-malformed-v1';
const CASES_SHA256 = '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd';
const SHAPE_SHA256 = '1592122408e7f5486fd9665e96e129dda9390b1b0ac76da4d348e3070c1bb4cb';
const Q_STREAMS = Object.freeze([
    'q_primary_input_derived_r1',
    'q_primary_input_derived_r2',
    'q_explicit_seed_0',
    'q_explicit_seed_1364412496',
    'q_explicit_seed_4294967295'
]);

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
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

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value, 'utf8');
}

function relativeToken(root, filePath) {
    return path.relative(root, filePath).split(path.sep).join('/');
}

function listedFiles(root) {
    const result = [];
    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(absolute);
            else if (entry.isFile()) result.push(relativeToken(root, absolute));
        }
    }
    walk(root);
    return new Set(result);
}

function replaceExactlyOnce(source, pattern, replacement, label) {
    const matches = source.match(pattern);
    assert.equal(matches?.length, 1, `instrumentation seam changed for ${label}`);
    return source.replace(pattern, replacement);
}

/*
 * The production verifier intentionally has no public test-only API.  This
 * loader compiles the exact source text with private validators appended to
 * module.exports.  Only immutable campaign census constants are reduced, so a
 * full package fixture remains small enough for the online test matrix.  The
 * validator bodies themselves are not rewritten or copied into the test.
 */
function loadFocusedVerifier() {
    let source = fs.readFileSync(VERIFIER_PATH, 'utf8');
    source = replaceExactlyOnce(source, /const CASE_COUNT = \d+;/g,
        'const CASE_COUNT = 1;', 'CASE_COUNT');
    source = replaceExactlyOnce(source, /const MATCHED_PAIR_COUNT = \d+;/g,
        'const MATCHED_PAIR_COUNT = 1;', 'MATCHED_PAIR_COUNT');
    source = replaceExactlyOnce(source, /const SHAPE_INVOCATION_COUNT = \d+;/g,
        'const SHAPE_INVOCATION_COUNT = 2;', 'SHAPE_INVOCATION_COUNT');
    source = replaceExactlyOnce(source, /const SHAPE_VALUE_COUNT = \d+;/g,
        'const SHAPE_VALUE_COUNT = 2;', 'SHAPE_VALUE_COUNT');
    source = replaceExactlyOnce(source, /const Q_VALUE_COUNT = \d+;/g,
        `const Q_VALUE_COUNT = ${Q_STREAMS.length};`, 'Q_VALUE_COUNT');
    source = replaceExactlyOnce(source, /baseInvocationCount: \d+,/g,
        'baseInvocationCount: 1,', 'baseInvocationCount');
    source += `\nmodule.exports.__packageTest = {\n` +
        '    caseStreamFailures,\n' +
        '    pairKeyOf,\n' +
        '    qInputFingerprint,\n' +
        '    qTokenBits,\n' +
        '    validateManifestVerifiedCounts,\n' +
        '    validatePriorShapeAttemptCheckpoint,\n' +
        '    validateQShapeEvidence,\n' +
        '    validateShapeEvidence,\n' +
        '    verifyMalformedObserved,\n' +
        '    verifyReports\n' +
        '};\n';
    const fixtureModule = new Module(`${VERIFIER_PATH}.focused-test.cjs`, module);
    fixtureModule.filename = VERIFIER_PATH;
    fixtureModule.paths = Module._nodeModulePaths(path.dirname(VERIFIER_PATH));
    fixtureModule._compile(source, VERIFIER_PATH);
    return fixtureModule.exports;
}

const focusedVerifier = loadFocusedVerifier();
const privateVerifier = focusedVerifier.__packageTest;

test('manifest expected verified counts are bound exactly to the independent census', () => {
    const counts = {
        references: 87,
        cases: 2871,
        matched_target_evaluations_per_program: 28545,
        shape_invocations: 990,
        shape_rows_with_repetitions: 57090,
        qshape_rows_total: 142725,
        malformed_controls: 7,
        campaign_failures: 3
    };
    const manifest = { verification_contract: { expected_verified_counts: { ...counts } } };
    assert.doesNotThrow(() => privateVerifier.validateManifestVerifiedCounts(manifest, counts));

    manifest.verification_contract.expected_verified_counts.campaign_failures = 2;
    assert.throws(
        () => privateVerifier.validateManifestVerifiedCounts(manifest, counts),
        /verified counts|reconstruction/i
    );
    manifest.verification_contract.expected_verified_counts = { ...counts, invented: 1 };
    assert.throws(
        () => privateVerifier.validateManifestVerifiedCounts(manifest, counts),
        /verified-count fields/i
    );
});

test('abandoned SHAPE checkpoint binds the exact retained partial-file inventory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-abandoned-attempt-'));
    const invocationId = 's01-c02-b01-r1';
    const attemptName = 'attempt-01';
    const attemptRoot = path.join(root, 'shape', 'attempts', invocationId, attemptName);
    try {
        writeText(path.join(attemptRoot, 'result.out'), 'partial SHAPE output\n');
        writeText(path.join(attemptRoot, 'stderr.txt'), 'interrupted\n');
        const retainedFiles = ['result.out', 'stderr.txt'].map(relative => {
            const bytes = fs.readFileSync(path.join(attemptRoot, relative));
            return { path: relative, size_bytes: bytes.length, sha256: sha256(bytes) };
        });
        const checkpoint = {
            schema_version: 1,
            status: 'abandoned',
            invocation_id: invocationId,
            attempt_number: 1,
            reason: 'interrupted_before_checkpoint',
            evidence: 'retained partial evidence; never used as a completed result',
            retained_files: retainedFiles
        };
        const listed = listedFiles(root);
        assert.doesNotThrow(() => privateVerifier.validatePriorShapeAttemptCheckpoint(
            root, listed, invocationId, attemptName, 1, checkpoint
        ));

        const reordered = { ...checkpoint, retained_files: [...retainedFiles].reverse() };
        assert.throws(() => privateVerifier.validatePriorShapeAttemptCheckpoint(
            root, listed, invocationId, attemptName, 1, reordered
        ), /inventory/i);
        const badHash = {
            ...checkpoint,
            retained_files: retainedFiles.map((entry, index) => index === 0 ?
                { ...entry, sha256: '0'.repeat(64) } : entry)
        };
        assert.throws(() => privateVerifier.validatePriorShapeAttemptCheckpoint(
            root, listed, invocationId, attemptName, 1, badHash
        ), /bytes mismatch/i);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

function resealManifest(root) {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.files = manifest.files.map(entry => {
        const absolute = path.join(root, ...entry.path.split('/'));
        const bytes = fs.readFileSync(absolute);
        return { ...entry, size_bytes: bytes.length, sha256: sha256(bytes) };
    });
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    fs.writeFileSync(manifestPath, text, 'utf8');
    fs.writeFileSync(path.join(root, 'manifest.sha256'),
        `${sha256(Buffer.from(text))}  manifest.json\n`, 'utf8');
    return manifest;
}

function manifestFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-manifest-'));
    writeText(path.join(root, 'evidence.txt'), 'evidence\n');
    const bytes = fs.readFileSync(path.join(root, 'evidence.txt'));
    const manifest = {
        schema_version: 2,
        files: [{ path: 'evidence.txt', size_bytes: bytes.length, sha256: sha256(bytes) }]
    };
    writeJson(path.join(root, 'manifest.json'), manifest);
    const manifestText = fs.readFileSync(path.join(root, 'manifest.json'));
    writeText(path.join(root, 'manifest.sha256'),
        `${sha256(manifestText)}  manifest.json\n`);
    return root;
}

function malformedFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-malformed-'));
    const parentCaseId = 'meta-cn04-ref01-r01';
    const atoms = [
        { element: 'H', tokens: ['1.000000000000000', '0.000000000000000', '0.000000000000000'] },
        { element: 'H', tokens: ['0.000000000000000', '1.000000000000000', '0.000000000000000'] },
        { element: 'H', tokens: ['0.000000000000000', '0.000000000000000', '1.000000000000000'] },
        { element: 'H', tokens: ['-1.000000000000000', '0.000000000000000', '0.000000000000000'] },
        { element: 'C', tokens: ['0.250000000000000', '0.250000000000000', '0.250000000000000'] }
    ];
    const contracts = [
        ['mal-shape-center-missing-01', 'SHAPE 2.1', 'shape_2_1_raw_dat',
            'missing_center', 4, 'accepted_with_numeric_rows', 1],
        ['mal-shape-center-misplaced-01', 'SHAPE 2.1', 'shape_2_1_raw_dat',
            'misplaced_center', 4, 'accepted_with_numeric_rows', 1],
        ['mal-qshape-point-count-01', 'Q-Shape', 'qshape_core_calculator',
            'incorrect_point_count', 4, 'nonfinite_result', 0],
        ['mal-qshape-nonfinite-01', 'Q-Shape', 'qshape_core_calculator',
            'nonfinite_token', 4, 'nonfinite_result', 0],
        ['mal-qshape-duplicate-01', 'Q-Shape', 'qshape_core_calculator',
            'duplicate_ligand', 4, 'finite_result', 1],
        ['mal-qshape-zero-length-01', 'Q-Shape', 'qshape_core_calculator',
            'effectively_zero_length_ligand', 4, 'nonfinite_result', 0],
        ['mal-qshape-unsupported-cn-01', 'Q-Shape', 'qshape_reference_registry',
            'unsupported_coordination_number', 13, 'reference_set_unavailable', 0]
    ];
    const controls = contracts.map(([
        controlId, program, interfaceName, category, cn, expectedOutcome, expectedNumericRows
    ], index) => ({
        control_id: controlId,
        program,
        interface: interfaceName,
        category,
        cn,
        source_parent_case_id: parentCaseId,
        campaign_gate: 'malformed_control_contract',
        expected_outcome: expectedOutcome,
        expected_numeric_rows: expectedNumericRows,
        input: interfaceName === 'shape_2_1_raw_dat'
            ? { target_index: 1, atoms: index === 0 ? atoms : [...atoms.slice(0, 4), atoms[0]] }
            : { target_code: cn === 13 ? null : 'SP-4', ligand_tokens: [] }
    }));
    const malformedSha256 = 'c'.repeat(64);
    const frozen = { malformed: { controls }, malformedSha256 };
    const rows = controls.map((control, index) => {
        const base = {
            control_id: control.control_id,
            program: control.program,
            interface: control.interface,
            category: control.category,
            cn: control.cn,
            source_parent_case_id: control.source_parent_case_id,
            campaign_gate: 'malformed_control_contract',
            expected_outcome: control.expected_outcome,
            expected_numeric_rows: control.expected_numeric_rows,
            observation_complete: true,
            observed_rejection_code: null,
            observed_value_tokens: [],
            observed_tab_value_tokens: [],
            raw_evidence_paths: []
        };
        if (control.interface === 'shape_2_1_raw_dat') {
            const structureId = `MAL${String(index + 1).padStart(2, '0')}`;
            const prefix = `malformed/raw/shape/${control.control_id}`;
            const rawRoot = path.join(root, ...prefix.split('/'));
            const controlDat = [
                '$ Q-Shape direct parity validation, CN=4',
                '%fullout',
                '4 1',
                '1',
                structureId,
                ...control.input.atoms.map(atom =>
                    `${atom.element.padEnd(3, ' ')} ${atom.tokens.join(' ')}`),
                ''
            ].join('\n');
            writeText(path.join(rawRoot, 'control.dat'), controlDat);
            writeText(path.join(rawRoot, 'stdout.txt'), 'synthetic product-boundary fixture\n');
            writeText(path.join(rawRoot, 'stderr.txt'), '');
            writeText(path.join(rawRoot, 'exit-code.txt'), '0\n');
            writeText(path.join(rawRoot, 'control.out'), [
                `Structure 1 [${structureId}]`,
                'SP-4 Ideal structure CShM = 0.12345',
                ''
            ].join('\n'));
            writeText(path.join(rawRoot, 'control.tab'), [
                `Structure [${structureId}] SP-4`,
                ` ${structureId.padEnd(15)},0.123`,
                ''
            ].join('\n'));
            return {
                ...base,
                product_boundary: 'SHAPE 2.1 executable',
                product_boundary_invoked: true,
                execution_mode: 'retained_product_evidence',
                process_exit_code: 0,
                observed_outcome: 'accepted_with_numeric_rows',
                observed_numeric_rows: 1,
                observed_value_tokens: ['0.12345'],
                observed_tab_value_tokens: ['0.123'],
                observed_structure_ids: [structureId],
                observed_target_codes: ['SP-4'],
                raw_evidence_paths: [
                    `${prefix}/control.dat`, `${prefix}/stdout.txt`, `${prefix}/stderr.txt`,
                    `${prefix}/exit-code.txt`, `${prefix}/control.out`, `${prefix}/control.tab`
                ],
                status: 'pass'
            };
        }
        if (control.interface === 'qshape_reference_registry') return {
            ...base,
            product_boundary: 'src/constants/referenceGeometries/index.js',
            product_boundary_invoked: true,
            observed_outcome: 'reference_set_unavailable',
            observed_numeric_rows: 0,
            observed_reference_count: 0,
            status: 'pass'
        };
        const finite = control.expected_outcome === 'finite_result';
        return {
            ...base,
            product_boundary: 'src/services/shapeAnalysis/shapeCalculator.js',
            product_boundary_invoked: true,
            observed_outcome: finite ? 'finite_result' : 'nonfinite_result',
            observed_numeric_rows: finite ? 1 : 0,
            observed_value_tokens: [finite ? '1.2500000000000000' : 'NaN'],
            observed_result_type: 'number',
            status: 'pass'
        };
    });
    const observed = {
        schema_version: 1,
        campaign_id: CONTROL_CAMPAIGN_ID,
        campaign_gate: 'malformed_control_contract',
        evidence_scope: 'product_boundaries',
        product_boundary_invoked: true,
        source_positive_cases_sha256: CASES_SHA256,
        count: 7,
        passed: 7,
        failed: 0,
        campaign_gate_status: 'pass',
        results: rows,
        controls: rows,
        source_controls_sha256: malformedSha256
    };
    return { root, frozen, observed };
}

function scientificFixture() {
    const caseItem = {
        case_id: 'case-1',
        caseId: 'case-1',
        structure_id: 'case-1',
        cn: 2,
        stratum: 'metamorphic_main',
        family: 'main_positive',
        recipe_id: 'canonical',
        recipeId: 'canonical',
        recipe_index: 1,
        recipe_category: 'canonical',
        recipeCategory: 'canonical',
        parent_reference_code: 'L-2',
        parentReferenceCode: 'L-2',
        expectedOwnTargetCode: 'L-2',
        qshape_actual_ligand_tokens: [
            ['1.000000000000000', '0.000000000000000', '0.000000000000000'],
            ['-1.000000000000000', '0.000000000000000', '0.000000000000000']
        ],
        shape_atoms: [
            { element: 'X', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
            { element: 'H', tokens: ['1.000000000000000', '0.000000000000000', '0.000000000000000'] },
            { element: 'H', tokens: ['-1.000000000000000', '0.000000000000000', '0.000000000000000'] }
        ]
    };
    const target = {
        cn: 2,
        code: 'L-2',
        shapeCode: 'L-2',
        index: 1,
        name: 'linear',
        coordinateRoundtripTokens: [
            ['1.0000000000000000', '0.0000000000000000', '0.0000000000000000'],
            ['-1.0000000000000000', '0.0000000000000000', '0.0000000000000000'],
            ['0.0000000000000000', '0.0000000000000000', '0.0000000000000000']
        ]
    };
    target.coordinateBits = target.coordinateRoundtripTokens.map(point =>
        point.map(token => focusedVerifier.float64Hex(Number(token)))
    );
    const shapeRow = {
        caseId: caseItem.case_id,
        targetCode: target.code,
        valueToken: '0.00000',
        lexicallyValid: true,
        tabValueToken: '0.000',
        tabRawPath: 'focused/result.tab'
    };
    const pairs = new Map([[`${caseItem.case_id}\u0000${target.code}`, { caseItem, target }]]);
    const casesState = {
        caseMap: new Map([[caseItem.case_id, caseItem]]),
        caseOrdinalById: new Map([[caseItem.case_id, 0]]),
        pairs,
        referencesFlat: [target]
    };
    return { caseItem, target, shapeRow, casesState };
}

function shapeEvidenceFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-shape-'));
    const scientific = scientificFixture();
    const command = (label, stdout = '') => ({
        label,
        command: `synthetic ${label}`,
        stdout,
        stderr: '',
        exit_code: 0
    });
    const referenceListing = '2 L-2 linear\n';
    const qualification = {
        status: 'qualified',
        shape_version: '2.1',
        shape_banner: 'SHAPE v2.1',
        executable_sha256: SHAPE_SHA256,
        expected_executable_sha256: SHAPE_SHA256,
        shape_executable: '/synthetic/shape_2.1_linux_64',
        wsl_registered_distro_name: 'Ubuntu-22.04',
        environment: {
            reference_listing: referenceListing,
            guest_os_pretty_name: 'Synthetic Linux',
            process_locale: 'C',
            process_timezone: 'UTC'
        },
        commands: {
            'shape-sha256': command('shape-sha256', `${SHAPE_SHA256}  shape\n`),
            'shape-help': command('shape-help', 'SHAPE v2.1\n'),
            'shape-list-all': command('shape-list-all', referenceListing),
            'shape-file': command('shape-file', 'ELF 64-bit\n'),
            'shape-ldd': command('shape-ldd', 'statically linked\n'),
            uname: command('uname', 'Linux synthetic\n'),
            'os-release': command('os-release', 'PRETTY_NAME="Synthetic Linux"\n'),
            locale: command('locale', 'C\n')
        }
    };
    writeJson(path.join(root, 'shape', 'qualification.json'), qualification);
    writeJson(path.join(root, 'shape', 'qualification-final.json'), qualification);
    for (const repetition of [1, 2]) {
        const id = `s01-c02-b01-r${repetition}`;
        const attempt = path.join(root, 'shape', 'attempts', id, 'attempt-01');
        const evidenceRow = {
            ...scientific.shapeRow,
            invocationId: id,
            repetition,
            structureId: scientific.caseItem.structure_id,
            shapeCode: scientific.target.shapeCode,
            targetIndex: scientific.target.index,
            rawPath: `shape/attempts/${id}/attempt-01/result.out`,
            tabValueToken: '0.000',
            tabRawPath: `shape/attempts/${id}/attempt-01/result.tab`
        };
        writeJson(path.join(attempt, 'control.json'), {
            invocation_id: id,
            target_codes: [scientific.target.shapeCode],
            cases: [scientific.caseItem.case_id]
        });
        writeText(path.join(attempt, 'control.dat'), [
            '%fullout',
            '2 1',
            scientific.caseItem.case_id,
            ...scientific.caseItem.shape_atoms.map(atom => `${atom.element} ${atom.tokens.join(' ')}`),
            ''
        ].join('\n'));
        const resultOut = [
            `Structure 1 [${scientific.caseItem.case_id}]`,
            `${scientific.target.shapeCode} Ideal structure CShM = 0.00000`,
            ''
        ].join('\n');
        const resultTab = [
            `Structure [${scientific.caseItem.case_id}] ${scientific.target.shapeCode}`,
            ` ${scientific.caseItem.case_id.padEnd(15)},0.000`,
            ''
        ].join('\n');
        writeText(path.join(attempt, 'control.out'), resultOut);
        writeText(path.join(attempt, 'control.tab'), resultTab);
        writeText(path.join(attempt, 'result.out'), resultOut);
        writeText(path.join(attempt, 'result.tab'), resultTab);
        writeText(path.join(attempt, 'stdout.txt'), 'synthetic fixture\n');
        writeText(path.join(attempt, 'stderr.txt'), '');
        writeText(path.join(attempt, 'exit-code.txt'), '0\n');
        writeJson(path.join(attempt, 'rows.json'), [evidenceRow]);
        writeJson(path.join(attempt, 'result.json'), {
            exitCode: 0,
            stdout: 'synthetic fixture\n',
            stderr: ''
        });
        writeJson(path.join(attempt, 'checkpoint.json'), {
            schema_version: 1,
            status: 'complete',
            invocation_id: id,
            attempt_number: 1,
            expected_row_count: 1,
            completed_row_count: 1,
            evidence: 'retained in this immutable attempt directory'
        });
    }
    return { root, ...scientific, listed: listedFiles(root) };
}

function streamContract(stream) {
    const explicit = stream.startsWith('q_explicit_seed_');
    return {
        seedPolicy: explicit ? 'explicit' : 'input-derived',
        seed: explicit ? Number(stream.slice('q_explicit_seed_'.length)) : null,
        repetition: explicit ? 1 : Number(stream.slice(-1))
    };
}

function canonicalQToken(value) {
    if (['NaN', 'Infinity', '-Infinity'].includes(String(value))) return String(value);
    const number = Number(value);
    assert.ok(Number.isFinite(number), `non-finite focused Q token ${value}`);
    return Object.is(number, -0) ? '-0' : number.toPrecision(17);
}

function focusedScientificCase(id, recipeId = 'canonical', parentCaseId = null) {
    const representation = [
        'rotation-a',
        'scale-small',
        'permutation',
        'rotation-scale',
        'rotation-permutation',
        'rotation-scale-permutation'
    ].includes(recipeId);
    return {
        case_id: id,
        caseId: id,
        cn: 2,
        stratum: 'focused_scientific_gate',
        family: 'focused_scientific_gate',
        recipe_id: recipeId,
        recipeId,
        recipe_index: 1,
        recipe_category: representation ? 'representation' :
            (recipeId === 'canonical' ? 'canonical' : 'distortion'),
        recipeCategory: representation ? 'representation' :
            (recipeId === 'canonical' ? 'canonical' : 'distortion'),
        parent_reference_code: 'A',
        parentReferenceCode: 'A',
        expectedOwnTargetCode: 'A',
        ...(parentCaseId === null ? {} : {
            parent_case_id: parentCaseId,
            parentCaseId
        })
    };
}

function focusedScientificTarget(code, index) {
    return { cn: 2, code, shapeCode: code, index, name: `target-${code}` };
}

function inMemoryScientificFixture(options = {}) {
    const cases = options.cases || [focusedScientificCase('focused-case')];
    const targets = options.targets || [
        focusedScientificTarget('A', 1),
        focusedScientificTarget('B', 2)
    ];
    const shapeTokens = Object.fromEntries(['shape_r1', 'shape_r2'].map(repetition => [
        repetition,
        Object.fromEntries(cases.map(item => [
            item.case_id,
            Object.fromEntries(targets.map(target => [target.code, '0.00000']))
        ]))
    ]));
    const qValues = Object.fromEntries(Q_STREAMS.map(stream => [
        stream,
        Object.fromEntries(cases.map(item => [
            item.case_id,
            Object.fromEntries(targets.map(target => [target.code, '0']))
        ]))
    ]));
    const tabTokens = Object.fromEntries(['shape_r1', 'shape_r2'].map(repetition => [
        repetition,
        Object.fromEntries(cases.map(item => [
            item.case_id,
            Object.fromEntries(targets.map(target => [target.code, null]))
        ]))
    ]));
    if (options.mutate) options.mutate({ cases, targets, shapeTokens, tabTokens, qValues });

    const shapeRows = Object.fromEntries(['shape_r1', 'shape_r2'].map(repetition => [
        repetition,
        cases.flatMap(item => targets.map(target => ({
            caseId: item.case_id,
            targetCode: target.code,
            valueToken: shapeTokens[repetition][item.case_id][target.code],
            lexicallyValid: true,
            tabValueToken: tabTokens[repetition][item.case_id][target.code] ??
                Number(shapeTokens[repetition][item.case_id][target.code]).toFixed(3),
            tabRawPath: `focused/${repetition}.tab`
        })))
    ]));
    const qRows = Object.fromEntries(Q_STREAMS.map(stream => {
        const contract = streamContract(stream);
        return [stream, cases.flatMap(item => targets.map(target => {
            const valueToken = canonicalQToken(qValues[stream][item.case_id][target.code]);
            const numericValue = Number(valueToken);
            return {
                caseId: item.case_id,
                targetCode: target.code,
                valueToken,
                valueHex: focusedVerifier.float64Hex(numericValue),
                resultFinite: Number.isFinite(numericValue),
                resultDomainValid: Number.isFinite(numericValue) &&
                    numericValue >= 0 && numericValue <= 100,
                runtimeMsToken: '0.000001',
                seedPolicy: contract.seedPolicy,
                explicitSeed: contract.seed,
                mode: 'default'
            };
        }))];
    }));
    const pairs = new Map();
    for (const item of cases) {
        for (const target of targets) {
            pairs.set(`${item.case_id}\u0000${target.code}`, { caseItem: item, target });
        }
    }
    const casesState = {
        caseMap: new Map(cases.map(item => [item.case_id, item])),
        caseOrdinalById: new Map(cases.map((item, index) => [item.case_id, index])),
        pairs,
        referencesFlat: targets
    };
    const analyzerInput = {
        cases,
        inventory: [{ cn: 2, count: targets.length, targets }],
        shapeRowsByRepetition: shapeRows,
        qshapeRowsByStream: qRows
    };
    return {
        cases,
        targets,
        shapeRows,
        qRows,
        casesState,
        analyzerResult: analysis.analyzeMetamorphicParity(analyzerInput),
        verifierState: privateVerifier.caseStreamFailures(casesState, shapeRows, qRows)
    };
}

function qEvidenceFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-q-'));
    const scientific = scientificFixture();
    const casesPath = path.join(root, 'inputs', 'frozen', 'cases.json');
    const referencesPath = path.join(root, 'inputs', 'frozen', 'references.json');
    writeJson(casesPath, { fixture: 'cases' });
    writeJson(referencesPath, { fixture: 'references' });
    const qRows = {};
    for (const stream of Q_STREAMS) {
        const contract = streamContract(stream);
        const row = {
            caseId: scientific.caseItem.case_id,
            caseOrdinal: 0,
            stratum: scientific.caseItem.stratum,
            cn: scientific.caseItem.cn,
            targetCode: scientific.target.code,
            targetOrdinal: scientific.target.index,
            qshapeLigandFixed15Tokens: scientific.caseItem.qshape_actual_ligand_tokens,
            targetReferenceBinary64RoundtripTokens: scientific.target.coordinateRoundtripTokens,
            targetReferenceFloat64Hex: scientific.target.coordinateBits,
            valueToken: '0.0000000000000000',
            valueHex: '0000000000000000',
            resultFinite: true,
            resultDomainValid: true,
            runtimeMsToken: '0.000001',
            inputFingerprintSha256: privateVerifier.qInputFingerprint(
                scientific.caseItem,
                scientific.target,
                contract.seedPolicy,
                contract.seed
            ),
            mode: 'default',
            seedPolicy: contract.seedPolicy,
            explicitSeed: contract.seed,
            repetition: contract.repetition,
            stream
        };
        qRows[stream] = [row];
        const directory = path.join(root, 'qshape', stream);
        const payload = {
            schema_version: 1,
            program: 'Q-Shape',
            campaign_id: CAMPAIGN_ID,
            cases_sha256: sha256(fs.readFileSync(casesPath)),
            references_sha256: sha256(fs.readFileSync(referencesPath)),
            mode: 'default',
            input_contract: 'frozen-metamorphic-cases-and-reference-binary64-v1',
            stream,
            seed_policy: contract.seedPolicy,
            explicit_seed_uint32: contract.seed,
            repetition: contract.repetition,
            shard_index: 0,
            shard_count: 1,
            case_count: 1,
            count: 1,
            expected_count: 1,
            results: [row]
        };
        writeJson(path.join(directory, 'payload.json'), payload);
        writeJson(path.join(directory, 'rows.json'), [row]);
        writeJson(path.join(directory, 'raw-result.json'), {});
        writeText(path.join(directory, 'stdout.txt'), '');
        writeText(path.join(directory, 'stderr.txt'), '');
        writeText(path.join(directory, 'exit-code.txt'), '0\n');
    }
    return {
        root,
        ...scientific,
        qRows,
        listed: listedFiles(root),
        shapeRows: { shape_r1: [scientific.shapeRow], shape_r2: [scientific.shapeRow] }
    };
}

function rewriteQRow(fixture, stream, mutate) {
    const directory = path.join(fixture.root, 'qshape', stream);
    const payloadPath = path.join(directory, 'payload.json');
    const rowsPath = path.join(directory, 'rows.json');
    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
    mutate(payload.results[0]);
    writeJson(payloadPath, payload);
    writeJson(rowsPath, payload.results);
}

function reportFixture(options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-report-'));
    const scientific = scientificFixture();
    const shapeRows = { shape_r1: [scientific.shapeRow], shape_r2: [scientific.shapeRow] };
    const qRows = {};
    for (const stream of Q_STREAMS) {
        const contract = streamContract(stream);
        const valueToken = canonicalQToken(options.qValue ? options.qValue(stream) : 0);
        qRows[stream] = [{
            caseId: scientific.caseItem.case_id,
            targetCode: scientific.target.code,
            valueToken,
            valueHex: focusedVerifier.float64Hex(Number(valueToken)),
            runtimeMsToken: '0.000001',
            seedPolicy: contract.seedPolicy,
            explicitSeed: contract.seed,
            mode: 'default'
        }];
    }
    const analyzerInput = {
        cases: [scientific.caseItem],
        inventory: [{ cn: 2, count: 1, targets: [scientific.target] }],
        shapeRowsByRepetition: shapeRows,
        qshapeRowsByStream: qRows
    };
    const result = analysis.analyzeMetamorphicParity(analyzerInput);
    const reportsRoot = path.join(root, 'reports');
    fs.mkdirSync(reportsRoot, { recursive: true });
    writeJson(path.join(reportsRoot, 'metamorphic-analysis.json'), result);
    for (const [fileName, contents] of Object.entries(reporting.buildReportingArtifacts(result))) {
        writeText(path.join(reportsRoot, fileName), contents);
    }
    const analysisState = privateVerifier.caseStreamFailures(
        scientific.casesState,
        shapeRows,
        qRows
    );
    return {
        root,
        result,
        analysisState,
        ...scientific,
        listed: listedFiles(root),
        manifest: { campaign_gate_status: result.summary.campaign_gate_status }
    };
}

function writeResealedReportBundle(fixture, document) {
    const reportsRoot = path.join(fixture.root, 'reports');
    writeJson(path.join(reportsRoot, 'metamorphic-analysis.json'), document);
    for (const [fileName, contents] of Object.entries(reporting.buildReportingArtifacts(document))) {
        writeText(path.join(reportsRoot, fileName), contents);
    }
}

test('package manifest catches both byte tamper and resealed unlisted inventory', () => {
    const root = manifestFixture();
    try {
        assert.doesNotThrow(() => productionVerifier.verifyManifestFiles(root));
        writeText(path.join(root, 'evidence.txt'), 'tampered evidence\n');
        assert.throws(() => productionVerifier.verifyManifestFiles(root), /hash|size/i);

        resealManifest(root);
        writeText(path.join(root, 'unlisted.txt'), 'unlisted\n');
        assert.throws(() => productionVerifier.verifyManifestFiles(root), /manifest\/present files/i);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('external verifier sidecar requires the exact runner wrapper and rejects wrapper tamper', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-package-sidecar-'));
    const packageRoot = path.join(parent, 'package');
    fs.mkdirSync(packageRoot);
    const receipt = {
        schema_version: 2,
        verification_status: 'valid',
        campaign_id: CAMPAIGN_ID,
        package_type: 'metamorphic-parity',
        manifest_sha256: 'a'.repeat(64),
        package_status: 'complete',
        campaign_gate_status: 'fail',
        overall_validation_status: 'incomplete',
        verified_counts: { campaign_failures: 1 },
        warnings: []
    };
    const wrapper = {
        schema_version: 2,
        receipt_kind: 'external-independent-verifier-sidecar',
        package_manifest_sha256: receipt.manifest_sha256,
        verifier_exit_code: 2,
        verifier_stderr: '',
        receipt_parse_error: null,
        receipt
    };
    const sidecarPath = `${packageRoot}.verification.json`;
    try {
        writeText(sidecarPath, stableJson(wrapper));
        assert.equal(
            productionVerifier.verifyExternalPackageSidecarIfPresent(packageRoot, receipt),
            sidecarPath
        );
        wrapper.package_manifest_sha256 = 'b'.repeat(64);
        writeText(sidecarPath, stableJson(wrapper));
        assert.throws(
            () => productionVerifier.verifyExternalPackageSidecarIfPresent(packageRoot, receipt),
            /sidecar|receipt/i
        );
    } finally {
        fs.rmSync(parent, { recursive: true, force: true });
    }
});

test('malformed-control verification distinguishes scientific mismatch from invalid evidence', () => {
    const fixture = malformedFixture();
    const controlsPath = path.join(fixture.root, 'malformed', 'controls.json');
    const observationsPath = path.join(fixture.root, 'malformed', 'observations.json');
    try {
        writeJson(controlsPath, fixture.observed);
        assert.throws(
            () => privateVerifier.verifyMalformedObserved(
                fixture.root,
                new Set(['malformed/controls.json']),
                fixture.frozen
            ),
            /observations|manifested|missing/i
        );

        writeJson(observationsPath, fixture.observed);
        writeJson(path.join(fixture.root, 'malformed', 'results.json'), fixture.observed.controls);
        let manifested = listedFiles(fixture.root);
        const valid = privateVerifier.verifyMalformedObserved(
            fixture.root, manifested, fixture.frozen
        );
        assert.equal(valid.passed, 7);
        assert.equal(valid.failed, 0);
        assert.deepEqual(valid.failures, []);

        const scientificallyFailed = structuredClone(fixture.observed);
        const duplicate = scientificallyFailed.controls[4];
        duplicate.observed_outcome = 'nonfinite_result';
        duplicate.observed_numeric_rows = 0;
        duplicate.observed_value_tokens = ['NaN'];
        duplicate.status = 'fail';
        scientificallyFailed.results = scientificallyFailed.controls;
        scientificallyFailed.passed = 6;
        scientificallyFailed.failed = 1;
        scientificallyFailed.campaign_gate_status = 'fail';
        writeJson(observationsPath, scientificallyFailed);
        writeJson(path.join(fixture.root, 'malformed', 'results.json'), scientificallyFailed.controls);
        manifested = listedFiles(fixture.root);
        const failed = privateVerifier.verifyMalformedObserved(
            fixture.root, manifested, fixture.frozen
        );
        assert.equal(failed.failed, 1);
        assert.equal(failed.campaignGateStatus, 'fail');
        assert.equal(failed.failures[0].gate, 'malformed_control_contract');
        assert.equal(failed.failures[0].execution_unit_id,
            'malformed:mal-qshape-duplicate-01');
        const analyzed = analysis.analyzeMetamorphicParity({
            cases: [],
            inventory: [],
            shapeRowsByRepetition: { shape_r1: [], shape_r2: [] },
            qshapeRowsByStream: Object.fromEntries(Q_STREAMS.map(stream => [stream, []])),
            malformedObservations: scientificallyFailed
        });
        assert.deepEqual(analyzed.failure_ledger, failed.failures);
        assert.deepEqual(analyzed.summary.malformed_controls, {
            included: true,
            controls_observed: 7,
            controls_passed: 6,
            controls_failed: 1,
            campaign_gate_status: 'fail'
        });

        const structurallyInvalid = structuredClone(scientificallyFailed);
        delete structurallyInvalid.controls[4].observation_complete;
        structurallyInvalid.results = structurallyInvalid.controls;
        writeJson(observationsPath, structurallyInvalid);
        writeJson(path.join(fixture.root, 'malformed', 'results.json'), structurallyInvalid.controls);
        manifested = listedFiles(fixture.root);
        assert.throws(() => privateVerifier.verifyMalformedObserved(
            fixture.root, manifested, fixture.frozen
        ), /fields|structurally incomplete/i);
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('SHAPE evidence validator rejects a raw .out value that disagrees with retained rows', () => {
    const fixture = shapeEvidenceFixture();
    try {
        const valid = privateVerifier.validateShapeEvidence(
            fixture.root,
            fixture.listed,
            fixture.casesState,
            [fixture.target],
            {}
        );
        assert.equal(valid.shape_r1.length, 1);
        assert.equal(valid.shape_r2.length, 1);

        const outPath = path.join(
            fixture.root,
            'shape', 'attempts', 's01-c02-b01-r1', 'attempt-01', 'result.out'
        );
        writeText(outPath, fs.readFileSync(outPath, 'utf8').replace('0.00000', '0.10000'));
        assert.throws(
            () => privateVerifier.validateShapeEvidence(
                fixture.root,
                fixture.listed,
                fixture.casesState,
                [fixture.target],
                {}
            ),
            /native\/retained \.out mismatch|\.out\/rows mismatch/i
        );
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('Q evidence validator rejects canonical-bit and frozen-input-fingerprint tamper', () => {
    const fixture = qEvidenceFixture();
    const stream = 'q_explicit_seed_0';
    try {
        assert.doesNotThrow(() => privateVerifier.validateQShapeEvidence(
            fixture.root,
            fixture.listed,
            fixture.casesState,
            [fixture.target],
            fixture.shapeRows
        ));

        rewriteQRow(fixture, stream, row => { row.valueHex = '3ff0000000000000'; });
        assert.throws(
            () => privateVerifier.validateQShapeEvidence(
                fixture.root,
                fixture.listed,
                fixture.casesState,
                [fixture.target],
                fixture.shapeRows
            ),
            /canonical binary64 bits mismatch/i
        );

        rewriteQRow(fixture, stream, row => {
            row.valueHex = '0000000000000000';
            row.inputFingerprintSha256 = '0'.repeat(64);
        });
        assert.throws(
            () => privateVerifier.validateQShapeEvidence(
                fixture.root,
                fixture.listed,
                fixture.casesState,
                [fixture.target],
                fixture.shapeRows
            ),
            /seed\/runtime identity mismatch|fingerprint/i
        );
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('scientific ranking failures retain comparison identity without false duplicate rejection', () => {
    const fixture = inMemoryScientificFixture({
        cases: [focusedScientificCase('ranking-case', 'radial-plus-0.05')],
        targets: [
            focusedScientificTarget('A', 1),
            focusedScientificTarget('B', 2),
            focusedScientificTarget('C', 3)
        ],
        mutate: ({ shapeTokens, qValues }) => {
            for (const repetition of ['shape_r1', 'shape_r2']) {
                shapeTokens[repetition]['ranking-case'].A = '1.00000';
                shapeTokens[repetition]['ranking-case'].B = '0.00000';
                shapeTokens[repetition]['ranking-case'].C = '0.00000';
            }
            for (const stream of Q_STREAMS) {
                qValues[stream]['ranking-case'].A = '1';
                qValues[stream]['ranking-case'].B = '0';
                qValues[stream]['ranking-case'].C = '0';
            }
            qValues.q_explicit_seed_0['ranking-case'].A = '0';
            qValues.q_explicit_seed_0['ranking-case'].B = '1';
            qValues.q_explicit_seed_0['ranking-case'].C = '1';
        }
    });
    assert.deepEqual(fixture.verifierState.failures, fixture.analyzerResult.failure_ledger);
    const rankingFailures = fixture.analyzerResult.failure_ledger.filter(failure =>
        failure.stream === 'q_explicit_seed_0' &&
        failure.gate === 'ranking_loss_or_inversion' &&
        failure.target_code === 'A'
    );
    assert.equal(rankingFailures.length, 2);
    assert.deepEqual(rankingFailures.map(failure => failure.comparison_code), ['B', 'C']);
    assert.equal(new Set(rankingFailures.map(failure => failure.failure_id)).size, 2);
    const obsoleteWeakSignature = failure => [
        failure.gate,
        failure.stream,
        failure.case_id,
        failure.target_code,
        failure.observed,
        failure.details
    ].join('\u0000');
    assert.equal(new Set(rankingFailures.map(obsoleteWeakSignature)).size, 1);
});

test('analyzer and independent verifier give fail precedence over a later not-evaluable relation target', () => {
    const fixture = inMemoryScientificFixture({
        cases: [
            focusedScientificCase('relation-parent'),
            focusedScientificCase('relation-child', 'rotation-a', 'relation-parent')
        ],
        targets: [
            focusedScientificTarget('A', 1),
            focusedScientificTarget('B', 2),
            focusedScientificTarget('C', 3)
        ],
        mutate: ({ qValues }) => {
            qValues.q_explicit_seed_0['relation-child'].B = '2e-8';
            qValues.q_explicit_seed_0['relation-child'].C = 'NaN';
        }
    });
    assert.deepEqual(fixture.verifierState.failures, fixture.analyzerResult.failure_ledger);
    assert.deepEqual(
        fixture.verifierState.relationSummaries,
        fixture.analyzerResult.relation_summaries
    );
    const relation = fixture.analyzerResult.relation_summaries.find(row =>
        row.child_case_id === 'relation-child'
    );
    assert.equal(relation.q_explicit_streams.q_explicit_seed_0, 'fail');
    assert.equal(relation.relation_status, 'fail');
    assert.equal(fixture.analyzerResult.summary.relation_counts.failed_relations, 1);
    assert.equal(fixture.verifierState.relationSummaries.filter(row =>
        row.relation_status === 'fail'
    ).length, 1);
    assert.ok(fixture.analyzerResult.failure_ledger.some(failure =>
        failure.gate === 'qshape_parent_child_explicit_invariance' &&
        failure.target_code === 'B'
    ));
});

test('independent verifier reproduces every focused scientific gate family as a full ordered ledger', () => {
    const relationCases = [
        focusedScientificCase('relation-parent'),
        focusedScientificCase('relation-child', 'rotation-a', 'relation-parent')
    ];
    const scenarios = [
        {
            name: 'strict absolute error',
            mutate: ({ qValues }) => {
                qValues.q_explicit_seed_0['focused-case'].B = '0.01';
            },
            gates: ['absolute_error']
        },
        {
            name: 'Q domain and ranking not evaluable',
            mutate: ({ qValues }) => {
                qValues.q_explicit_seed_0['focused-case'].B = '-0.1';
                qValues.q_explicit_seed_1364412496['focused-case'].B = '100.1';
            },
            gates: ['qshape_negative_cshm', 'qshape_cshm_above_100', 'ranking_not_evaluable']
        },
        {
            name: 'canonical retained Q NaN',
            mutate: ({ qValues }) => {
                qValues.q_explicit_seed_0['focused-case'].B = 'NaN';
            },
            gates: ['qshape_nonfinite_cshm', 'ranking_not_evaluable'],
            assertFixture: fixture => {
                const row = fixture.qRows.q_explicit_seed_0.find(item => item.targetCode === 'B');
                assert.equal(row.valueToken, 'NaN');
                assert.equal(row.valueHex, '7ff8000000000000');
                assert.equal(row.resultFinite, false);
                assert.equal(row.resultDomainValid, false);
            }
        },
        {
            name: 'SHAPE domain',
            mutate: ({ shapeTokens }) => {
                shapeTokens.shape_r1['focused-case'].B = '100.00001';
                shapeTokens.shape_r2['focused-case'].B = '100.00001';
            },
            gates: ['shape_cshm_above_100', 'ranking_not_evaluable']
        },
        {
            name: 'SHAPE lexical repeatability',
            mutate: ({ shapeTokens }) => {
                shapeTokens.shape_r2['focused-case'].B = '0.00001';
            },
            gates: ['shape_repeatability_token', 'ranking_not_evaluable']
        },
        {
            name: 'parseable SHAPE out-tab interval disagreement',
            mutate: ({ shapeTokens, tabTokens }) => {
                for (const repetition of ['shape_r1', 'shape_r2']) {
                    shapeTokens[repetition]['focused-case'].B = '0.00100';
                    tabTokens[repetition]['focused-case'].B = '0.000';
                }
            },
            gates: ['shape_out_tab_inconsistency']
        },
        {
            name: 'ideal self and nominal tie set',
            mutate: ({ shapeTokens, qValues }) => {
                for (const repetition of ['shape_r1', 'shape_r2']) {
                    shapeTokens[repetition]['focused-case'].A = '0.02002';
                }
                for (const stream of Q_STREAMS) {
                    qValues[stream]['focused-case'].A = '0.02002';
                }
            },
            gates: [
                'ideal_self_qshape',
                'ideal_self_shape',
                'ideal_nominal_outside_shape_tie_set'
            ]
        },
        {
            name: 'primary binary64 repeatability',
            mutate: ({ qValues }) => {
                qValues.q_primary_input_derived_r2['focused-case'].B = '1e-16';
            },
            gates: ['qshape_primary_repeatability_bits']
        },
        {
            name: 'authorized SHAPE and explicit-Q relations',
            cases: relationCases,
            mutate: ({ shapeTokens, qValues }) => {
                shapeTokens.shape_r1['relation-child'].B = '0.00001';
                shapeTokens.shape_r2['relation-child'].B = '0.00001';
                for (const stream of Q_STREAMS.filter(name => name.startsWith('q_explicit_'))) {
                    qValues[stream]['relation-child'].B = '2e-8';
                }
            },
            gates: ['shape_parent_child_exact_token', 'qshape_parent_child_explicit_invariance']
        },
        {
            name: 'paired-sign distortion rows',
            cases: [
                focusedScientificCase('radial-minus', 'radial-minus-0.05'),
                focusedScientificCase('radial-plus', 'radial-plus-0.05')
            ],
            gates: [],
            assertFixture: fixture => {
                assert.ok(fixture.verifierState.pairedSignRows.length > 0);
            }
        }
    ];
    for (const scenario of scenarios) {
        const fixture = inMemoryScientificFixture({
            cases: scenario.cases,
            mutate: scenario.mutate
        });
        assert.deepEqual(
            fixture.verifierState.failures,
            fixture.analyzerResult.failure_ledger,
            `${scenario.name} full ledger mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.caseSummaries,
            fixture.analyzerResult.case_summaries,
            `${scenario.name} case-summary mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.streamStatuses,
            fixture.analyzerResult.stream_summaries,
            `${scenario.name} stream-summary mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.relationSummaries,
            fixture.analyzerResult.relation_summaries,
            `${scenario.name} relation-summary mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.pairedSignRows,
            fixture.analyzerResult.paired_sign_rows,
            `${scenario.name} paired-sign mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.stratifiedStatistics,
            fixture.analyzerResult.stratified_statistics,
            `${scenario.name} stratified-statistics mismatch`
        );
        assert.deepEqual(
            fixture.verifierState.primaryRepeatability,
            fixture.analyzerResult.primary_q_repeatability,
            `${scenario.name} primary-repeatability summary mismatch`
        );
        const observedGates = new Set(fixture.analyzerResult.failure_ledger.map(failure => failure.gate));
        for (const gate of scenario.gates) {
            assert.ok(observedGates.has(gate), `${scenario.name} did not exercise ${gate}`);
        }
        if (scenario.assertFixture) scenario.assertFixture(fixture);
    }
});

test('report verifier rejects independently regenerated semantic report tamper', () => {
    const fixture = reportFixture();
    const mutations = [
        ['comparison-row order', document => {
            document.comparison_rows.reverse();
        }],
        ['case-summary ranking', document => {
            document.case_summaries[0].ranking_status = 'not_evaluable';
        }],
        ['case-summary Kendall', document => {
            document.case_summaries[0].kendall_tau_b = '0.5';
        }],
        ['stream summary', document => {
            document.stream_summaries.q_primary_input_derived_r1.comparisons_domain_valid = 0;
        }],
        ['relation insertion', document => {
            document.relation_summaries.push({
                child_case_id: 'invented-child',
                parent_case_id: 'invented-parent',
                expected_parent_case_id: 'invented-parent',
                authorized: true,
                relation_status: 'pass',
                shape_exact_token: 'pass',
                q_explicit_streams: {}
            });
        }],
        ['paired-sign insertion', document => {
            document.paired_sign_rows.push({
                stream: 'q_explicit_seed_0',
                cn: 2,
                target_code: 'L-2',
                minus_case_id: 'invented-minus',
                plus_case_id: 'invented-plus',
                status: 'evaluable'
            });
        }],
        ['stratified statistic', document => {
            document.stratified_statistics[0].mean_absolute_error = '999';
        }]
    ];
    try {
        for (const [label, mutate] of mutations) {
            const document = structuredClone(fixture.result);
            mutate(document);
            writeResealedReportBundle(fixture, document);
            assert.throws(
                () => privateVerifier.verifyReports(
                    fixture.root,
                    fixture.listed,
                    fixture.analysisState,
                    fixture.casesState,
                    fixture.manifest
                ),
                /independent|differ|mismatch/i,
                label
            );
        }
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('report verifier rejects every regenerated failure-ledger field and ordering tamper', () => {
    const fixture = reportFixture({
        qValue: stream => stream === 'q_explicit_seed_0' ? 0.01 : 0
    });
    const replacements = {
        failure_id: 'failure-0000000000000000',
        event_type: 'tampered_event',
        gate: 'tampered_gate',
        status: 'pass',
        severity: 'diagnostic',
        stream: 'tampered_stream',
        repetition: 'tampered_repetition',
        execution_unit_id: 'tampered:unit',
        case_id: 'tampered-case',
        cn: 99,
        target_code: 'tampered-target',
        comparison_code: 'tampered-comparison',
        observed: 'tampered-observation',
        threshold: 'tampered-threshold',
        details: 'tampered-details'
    };
    try {
        assert.ok(fixture.result.failure_ledger.length >= 2);
        for (const [field, replacement] of Object.entries(replacements)) {
            const document = structuredClone(fixture.result);
            document.failures[0][field] = replacement;
            document.failure_ledger[0][field] = replacement;
            writeResealedReportBundle(fixture, document);
            assert.throws(
                () => privateVerifier.verifyReports(
                    fixture.root,
                    fixture.listed,
                    fixture.analysisState,
                    fixture.casesState,
                    fixture.manifest
                ),
                /failure ledger|independent|differ|mismatch/i,
                `failure field ${field}`
            );
        }

        const reordered = structuredClone(fixture.result);
        reordered.failures.reverse();
        assert.strictEqual(reordered.failures, reordered.failure_ledger);
        writeResealedReportBundle(fixture, reordered);
        assert.throws(
            () => privateVerifier.verifyReports(
                fixture.root,
                fixture.listed,
                fixture.analysisState,
                fixture.casesState,
                fixture.manifest
            ),
            /failure ledger|independent|differ|mismatch/i
        );
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('report verifier rejects source-row and typed data-dictionary tamper', () => {
    const fixture = reportFixture();
    const comparisonPath = path.join(fixture.root, 'reports', 'comparison-rows.csv');
    const dictionaryPath = path.join(fixture.root, 'reports', 'data-dictionary.json');
    const originalComparison = fs.readFileSync(comparisonPath, 'utf8');
    const originalDictionary = fs.readFileSync(dictionaryPath, 'utf8');
    try {
        assert.doesNotThrow(() => privateVerifier.verifyReports(
            fixture.root,
            fixture.listed,
            fixture.analysisState,
            fixture.casesState,
            fixture.manifest
        ));

        const parsed = focusedVerifier.parseCsvDocument(originalComparison);
        parsed.rows[0].qshape_token = '1.0000000000000000';
        writeText(comparisonPath, reporting.rowsToCsv(parsed.rows, parsed.header));
        assert.throws(
            () => privateVerifier.verifyReports(
                fixture.root,
                fixture.listed,
                fixture.analysisState,
                fixture.casesState,
                fixture.manifest
            ),
            /comparison report value mismatch|does not exactly match independent reconstruction/i
        );

        writeText(comparisonPath, originalComparison);
        const dictionary = JSON.parse(originalDictionary);
        dictionary.tables['comparison-rows.csv'].columns[0].unit = 'tampered_unit';
        writeJson(dictionaryPath, dictionary);
        assert.throws(
            () => privateVerifier.verifyReports(
                fixture.root,
                fixture.listed,
                fixture.analysisState,
                fixture.casesState,
                fixture.manifest
            ),
            /data dictionary|dictionary/i
        );
    } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

test('focused package harness changes only census constants and appends exports', () => {
    const productionSource = fs.readFileSync(VERIFIER_PATH, 'utf8');
    const validatorNames = [
        'validateShapeEvidence',
        'validateQShapeEvidence',
        'verifyMalformedObserved',
        'verifyReports'
    ];
    const thisSource = fs.readFileSync(__filename, 'utf8');
    for (const name of validatorNames) {
        const signature = `function ${name}(`;
        assert.equal(thisSource.includes(signature), false, `test copied production validator: ${signature}`);
        assert.equal(productionSource.includes(signature), true, `production validator disappeared: ${signature}`);
    }
    assert.equal(SHAPE_SHA256.length, 64);
});

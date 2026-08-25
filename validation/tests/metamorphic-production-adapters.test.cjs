'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const adapters = require('../scripts/metamorphic-production-adapters.cjs');
const directCore = require('../scripts/direct-parity-core.cjs');
const { generateMetamorphicCases } = require('../scripts/metamorphic-cases.cjs');
const malformedControls = require('../scripts/metamorphic-malformed-controls.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function memoryFs() {
    const files = new Map();
    const directories = new Set();
    const key = filePath => path.resolve(String(filePath));
    const ensure = directory => {
        const resolved = key(directory);
        directories.add(resolved);
        const parent = path.dirname(resolved);
        if (parent !== resolved) directories.add(parent);
    };
    return {
        files,
        directories,
        existsSync(filePath) {
            const resolved = key(filePath);
            return files.has(resolved) || directories.has(resolved);
        },
        mkdirSync(directory, options = {}) {
            if (options.recursive) {
                let current = key(directory);
                const pending = [];
                while (!directories.has(current)) {
                    pending.push(current);
                    const parent = path.dirname(current);
                    if (parent === current) break;
                    current = parent;
                }
                pending.reverse().forEach(item => directories.add(item));
            } else ensure(directory);
        },
        writeFileSync(filePath, content, options = {}) {
            const resolved = key(filePath);
            if (options.flag === 'wx' && files.has(resolved)) {
                const error = new Error(`exists: ${resolved}`);
                error.code = 'EEXIST';
                throw error;
            }
            ensure(path.dirname(resolved));
            files.set(resolved, Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), 'utf8'));
        },
        readFileSync(filePath, encoding) {
            const resolved = key(filePath);
            if (!files.has(resolved)) throw new Error(`missing: ${resolved}`);
            const value = Buffer.from(files.get(resolved));
            return encoding ? value.toString(encoding) : value;
        },
        statSync(filePath) {
            const resolved = key(filePath);
            return { isFile: () => files.has(resolved), isDirectory: () => directories.has(resolved) };
        }
    };
}

function baseOptions(overrides = {}) {
    return {
        shapeExecutable: '/opt/shape/shape_2.1_linux64',
        expectedShapeSha256: 'a'.repeat(64),
        repoRoot: 'C:/q-shape',
        ...overrides
    };
}

test('qualification captures exact digest, SHAPE v2.1 banner, and WSL environment through injected process boundary', async () => {
    const calls = [];
    const dependencies = {
        runProcess: async (command, args) => {
            calls.push({ command, args });
            const shell = args.at(-1);
            const bare = shell.replace(/^export LC_ALL=C LANG=C TZ=UTC\n/, '');
            if (bare.includes('sha256sum')) return { status: 0, stdout: `${'a'.repeat(64)}  /opt/shape/shape_2.1_linux64\n`, stderr: '' };
            if (bare.includes(' -h')) return { status: 0, stdout: 'S H A P E v2.1\n', stderr: '' };
            if (bare.endsWith(" +")) return { status: 0, stdout: '* 4 Vertices\n  SP-4 1 Td Symmetry\n', stderr: '' };
            if (bare.includes('file ')) return { status: 0, stdout: 'ELF 64-bit LSB executable\n', stderr: '' };
            if (bare.startsWith('ldd ')) return { status: 0, stdout: 'linux-vdso.so.1 => not found\n', stderr: '' };
            if (bare === 'uname -a') return { status: 0, stdout: 'Linux fake 6.1 x86_64\n', stderr: '' };
            if (bare.includes('/etc/os-release')) return { status: 0, stdout: 'PRETTY_NAME="Ubuntu 22.04.5 LTS"\n', stderr: '' };
            if (bare === 'locale') return { status: 0, stdout: 'LANG=C\nLC_ALL=C\n', stderr: '' };
            throw new Error(`unexpected qualification command: ${shell}`);
        }
    };
    const production = adapters.createProductionDependencies(baseOptions(), dependencies);
    const result = await production.qualificationRunner({});
    assert.equal(result.status, 'qualified');
    assert.equal(result.executable_sha256, 'a'.repeat(64));
    assert.equal(result.wsl_registered_distro_name, 'Ubuntu-22.04');
    assert.equal(result.environment.guest_os_pretty_name, 'Ubuntu 22.04.5 LTS');
    assert.equal(Object.keys(result.commands).length, 8);
    assert.ok(calls.length >= 8);
    assert.ok(calls.every(call => call.command === 'wsl.exe'));
    assert.deepEqual(calls[0].args.slice(0, 4), ['-d', 'Ubuntu-22.04', '--', 'bash']);
});

test('SHAPE adapter writes exact control, invokes WSL, and returns five-decimal rows with identity', async () => {
    const files = memoryFs();
    const calls = [];
    const attemptPath = 'C:/package/shape/attempts/s01-c02-b01-r1/attempt-01';
    const dependencies = {
        fsModule: files,
        runProcess: async (command, args, options) => {
            calls.push({ command, args, options });
            files.writeFileSync(path.join(options.attemptPath, 'control.out'),
                'Structure 1 [S1]\n  C2v-1 Ideal structure CShM = 0.12345\n');
            files.writeFileSync(path.join(options.attemptPath, 'control.tab'),
                ' Structure [S1] C2v-1\n S1             ,0.123\n');
            return { status: 0, stdout: 'shape stdout\n', stderr: '' };
        }
    };
    const production = adapters.createProductionDependencies(baseOptions(), dependencies);
    const result = await production.shapeRunner({
        outputRoot: 'C:/package',
        attemptPath,
        invocation: {
            id: 's01-c02-b01-r1',
            repetition: 1,
            cn: 2,
            targets: [{ code: 'C2v-1', shapeCode: 'C2v-1', shapeIndex: 1 }],
            cases: [{
                case_id: 'meta-cn02-ref01-r01',
                structure_id: 'S1',
                cn: 2,
                shape_atoms: [
                    { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
                    { element: 'C', tokens: ['1.000000000000000', '0.000000000000000', '0.000000000000000'] },
                    { element: 'C', tokens: ['-1.000000000000000', '0.000000000000000', '0.000000000000000'] }
                ]
            }]
        }
    });
    const control = files.readFileSync(path.join(attemptPath, 'control.dat'), 'utf8');
    assert.match(control, /%fullout\n2 1\n1\nS1\n/);
    assert.equal(result.exitCode, 0);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].invocation_id, 's01-c02-b01-r1');
    assert.equal(result.rows[0].case_id, 'meta-cn02-ref01-r01');
    assert.equal(result.rows[0].target_code, 'C2v-1');
    assert.equal(result.rows[0].value_token, '0.12345');
    assert.equal(result.rows[0].raw_path,
        'shape/attempts/s01-c02-b01-r1/attempt-01/result.out');
    assert.equal(result.rows[0].tab_value_token, '0.123');
    assert.equal(result.rows[0].tab_raw_path,
        'shape/attempts/s01-c02-b01-r1/attempt-01/result.tab');
    assert.equal(calls[0].command, 'wsl.exe');
    assert.match(calls[0].args.at(-1), /timeout -k 30s 1800s/);
});

test('SHAPE adapter retains partial evidence and rejects nonzero process results', async () => {
    const files = memoryFs();
    const attemptPath = 'C:/attempts/failure/attempt-01';
    const production = adapters.createProductionDependencies(baseOptions(), {
        fsModule: files,
        runProcess: async () => ({ status: 17, stdout: 'partial stdout\n', stderr: 'shape failed\n' })
    });
    await assert.rejects(
        production.shapeRunner({
            attemptPath,
            invocation: {
                id: 's01-c02-b01-r1',
                cn: 2,
                targets: [{ code: 'C2v-1', shapeCode: 'C2v-1', shapeIndex: 1 }],
                cases: [{
                    case_id: 'case-1', structure_id: 'S1', cn: 2,
                    shape_atoms: [
                        { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
                        { element: 'C', tokens: ['1.000000000000000', '0.000000000000000', '0.000000000000000'] },
                        { element: 'C', tokens: ['-1.000000000000000', '0.000000000000000', '0.000000000000000'] }
                    ]
                }]
            }
        }),
        error => error.code === 'SHAPE_PROCESS_FAILED'
    );
    assert.equal(files.readFileSync(path.join(attemptPath, 'stdout.txt'), 'utf8'), 'partial stdout\n');
    assert.equal(files.readFileSync(path.join(attemptPath, 'stderr.txt'), 'utf8'), 'shape failed\n');
    assert.equal(files.readFileSync(path.join(attemptPath, 'exit-code.txt'), 'utf8'), '17\n');
    assert.ok(files.existsSync(path.join(attemptPath, 'control.dat')));
});

test('Q, malformed, and verifier adapters delegate to injected/existing production components', async () => {
    const qCalls = [];
    const malformedCalls = [];
    const verifierCalls = [];
    const dependencies = {
        qWorker: {
            runWorker: (options, workerDependencies) => {
                qCalls.push({ options, workerDependencies });
                return { payload: { stream: options.stream, results: [] } };
            }
        },
        buildMalformedControlDocument: (document, hash) => ({ schema_version: 1, source: document, hash }),
        validateMalformedControlDocument: () => true,
        typedMalformedExecutor: document => {
            malformedCalls.push(document);
            return { count: 1, controls: [{ observed_rejection_code: 'typed.reject', observed_numeric_rows: 0 }] };
        },
        runProcess: async (command, args) => {
            assert.equal(command, process.execPath);
            verifierCalls.push(args);
            return { status: 0, stdout: '{"verifier":"independent","status":"pass"}\n', stderr: '' };
        }
    };
    const production = adapters.createProductionDependencies(baseOptions({ casesPath: 'C:/cases.json', referencesPath: 'C:/references.json' }), dependencies);
    const runtimeIdentity = { schema_version: 1, fixture: 'effective-node-runtime' };
    const qResult = await production.qRunner({
        cases: 'C:/cases.json', references: 'C:/references.json', repo: 'C:/repo',
        seedPolicy: 'explicit', explicitSeed: 0, repetition: 1, stream: 'q_explicit_seed_0',
        executionProcess: 'in_process_runner', runtimeIdentity,
        runtimeIdentitySha256: 'a'.repeat(64)
    });
    assert.equal(qResult.payload.stream, 'q_explicit_seed_0');
    assert.equal(qCalls[0].options.explicitSeed, 0);
    assert.equal(qCalls[0].options.executionProcess, 'in_process_runner');
    assert.equal(qCalls[0].options.runtimeIdentitySha256, 'a'.repeat(64));
    assert.deepEqual(qCalls[0].options.runtimeIdentity, runtimeIdentity);
    const malformedResult = await production.malformedRunner({ cases: { frozen: true }, casesSha256: 'b'.repeat(64) });
    assert.equal(malformedResult.count, 1);
    assert.equal(malformedCalls.length, 1);
    const verification = await production.verifier({ outputRoot: 'C:/package', manifestPath: 'C:/package/manifest.json' });
    assert.equal(verification.exitCode, 0);
    assert.deepEqual(verifierCalls[0].slice(-2), ['--package', 'C:/package']);
    assert.deepEqual(verification.receipt, { verifier: 'independent', status: 'pass' });
    assert.equal(verification.exact_exit_code, 0);
    assert.deepEqual(verification.exact_receipt, verification.receipt);
});

test('malformed adapter executes the exact frozen control bytes instead of regenerating controls', async () => {
    const files = memoryFs();
    const controlsPath = 'C:/frozen/malformed-controls.json';
    const document = {
        schema_version: 1,
        campaign_id: 'qshape-metamorphic-malformed-v2',
        count: 1,
        controls: [{ control_id: 'frozen-1' }]
    };
    const bytes = `${JSON.stringify(document, null, 2)}\n`;
    files.writeFileSync(controlsPath, bytes);
    const controlsSha256 = adapters.sha256Buffer(Buffer.from(bytes));
    let observed = null;
    const production = adapters.createProductionDependencies(baseOptions(), {
        fsModule: files,
        buildMalformedControlDocument: () => {
            throw new Error('frozen controls must not be regenerated');
        },
        validateMalformedControlDocument: value => {
            assert.deepEqual(value, document);
            return true;
        },
        typedMalformedExecutor: value => {
            observed = value;
            return {
                count: 1,
                results: [{
                    control_id: 'frozen-1',
                    observed_rejection_code: 'typed.reject',
                    observed_numeric_rows: 0
                }]
            };
        }
    });
    const result = await production.malformedRunner({
        cases: { frozen: true },
        casesSha256: 'b'.repeat(64),
        controlsDocument: structuredClone(document),
        controlsPath,
        controlsSha256
    });
    assert.deepEqual(observed, document);
    assert.equal(result.source_controls_sha256, controlsSha256);
    assert.deepEqual(result.controls, result.results);
});

test('default malformed adapter invokes raw SHAPE and real Q-Shape product boundaries', async () => {
    const files = memoryFs();
    const positive = generateMetamorphicCases(REPO_ROOT).document;
    const document = malformedControls.buildMalformedControlDocument(positive);
    const shapeCalls = [];
    const production = adapters.createProductionDependencies(baseOptions({ repoRoot: REPO_ROOT }), {
        fsModule: files,
        runProcess: async (command, args, options) => {
            assert.equal(command, 'wsl.exe');
            shapeCalls.push({ args, options });
            const first = options.controlId.endsWith('missing-01');
            const structureId = first ? 'MAL01' : 'MAL02';
            const outToken = first ? '35.84530' : '43.75000';
            const tabToken = first ? '35.845' : '43.750';
            files.writeFileSync(path.join(options.attemptPath, 'control.out'),
                `Structure 1 [${structureId}]\n SP-4 Ideal structure CShM = ${outToken}\n`);
            files.writeFileSync(path.join(options.attemptPath, 'control.tab'),
                ` Structure [ML4 ] SP-4\n ${structureId.padEnd(15, ' ')},${tabToken}\n`);
            return { status: 0, stdout: 'SHAPE accepted probe\n', stderr: '' };
        }
    });
    const result = await production.malformedRunner({
        outputRoot: 'C:/package',
        cases: positive,
        casesSha256: malformedControls.POSITIVE_CASES_SHA256,
        controlsDocument: document
    });

    assert.equal(shapeCalls.length, 2);
    assert.equal(result.evidence_scope, 'product_boundaries');
    assert.equal(result.product_boundary_invoked, true);
    assert.equal(result.campaign_gate, 'malformed_control_contract');
    assert.equal(result.count, 7);
    assert.equal(result.passed, 7);
    assert.equal(result.failed, 0);
    assert.equal(result.campaign_gate_status, 'pass');
    assert.ok(result.results.every(row => row.observation_complete === true));
    assert.ok(result.results.every(row => row.product_boundary_invoked === true));
    assert.ok(result.results.every(row => row.status === 'pass'));

    const missing = result.results.find(row => row.category === 'missing_center');
    const misplaced = result.results.find(row => row.category === 'misplaced_center');
    assert.equal(missing.observed_outcome, 'accepted_with_numeric_rows');
    assert.equal(missing.observed_numeric_rows, 1);
    assert.deepEqual(missing.observed_value_tokens, ['35.84530']);
    assert.deepEqual(missing.observed_tab_value_tokens, ['35.845']);
    assert.equal(misplaced.observed_numeric_rows, 1);
    assert.deepEqual(misplaced.observed_value_tokens, ['43.75000']);
    assert.deepEqual(misplaced.observed_tab_value_tokens, ['43.750']);
    assert.ok(missing.raw_evidence_paths.includes(
        'malformed/raw/shape/mal-shape-center-missing-01/control.out'
    ));

    const pointCount = result.results.find(row => row.category === 'incorrect_point_count');
    const nonfinite = result.results.find(row => row.category === 'nonfinite_token');
    const duplicate = result.results.find(row => row.category === 'duplicate_ligand');
    const zeroLength = result.results.find(row => row.category === 'effectively_zero_length_ligand');
    const unsupported = result.results.find(row => row.category === 'unsupported_coordination_number');
    assert.equal(pointCount.observed_outcome, 'thrown_error');
    assert.deepEqual(pointCount.observed_value_tokens, []);
    assert.equal(pointCount.observed_error_name, 'Error');
    assert.match(pointCount.observed_error_message, /point set size mismatch/i);
    assert.equal(nonfinite.observed_outcome, 'thrown_error');
    assert.deepEqual(nonfinite.observed_value_tokens, []);
    assert.equal(nonfinite.observed_error_name, 'Error');
    assert.match(nonfinite.observed_error_message, /non-finite value/i);
    assert.equal(duplicate.observed_outcome, 'finite_result');
    assert.equal(duplicate.observed_numeric_rows, 1);
    assert.deepEqual(duplicate.observed_value_tokens, ['30.555555555555515']);
    assert.equal(zeroLength.observed_outcome, 'thrown_error');
    assert.deepEqual(zeroLength.observed_value_tokens, []);
    assert.equal(zeroLength.observed_error_name, 'Error');
    assert.match(zeroLength.observed_error_message, /insufficient spatial extent/i);
    assert.equal(unsupported.observed_outcome, 'reference_set_unavailable');
    assert.equal(unsupported.observed_reference_count, 0);
});

test('complete product-boundary mismatch is retained as a scientific gate failure', () => {
    const positive = generateMetamorphicCases(REPO_ROOT).document;
    const document = malformedControls.buildMalformedControlDocument(positive);
    const duplicate = document.controls.find(control => control.category === 'duplicate_ligand');
    const loaded = directCore.loadQShape(REPO_ROOT);
    const product = {
        ...loaded,
        inventory: directCore.buildReferenceInventory(loaded.referenceGeometries),
        calculateShapeMeasure: () => ({ measure: Infinity })
    };
    const observed = adapters.executeQShapeMalformedControl(duplicate, product);
    assert.equal(observed.observation_complete, true);
    assert.equal(observed.expected_outcome, 'finite_result');
    assert.equal(observed.observed_outcome, 'nonfinite_result');
    assert.equal(observed.expected_numeric_rows, 1);
    assert.equal(observed.observed_numeric_rows, 0);
    assert.equal(observed.status, 'fail');
});

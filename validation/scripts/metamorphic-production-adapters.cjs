'use strict';

/*
 * Production dependency adapters for the metamorphic runner.
 *
 * The runner owns package layout and scheduling.  This module owns the
 * external boundaries: qualification of the user-supplied SHAPE executable,
 * one immutable SHAPE attempt, the existing Q-Shape worker, product-boundary
 * malformed-input probes, and the independent verifier.  Every boundary is
 * injectable so the contract can be tested without running SHAPE.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const directCore = require('./direct-parity-core.cjs');
const defaultQWorker = require('./qshape-metamorphic-worker.cjs');
const defaultMalformed = require('./metamorphic-malformed-controls.cjs');

const DEFAULT_WSL_DISTRO = 'Ubuntu-22.04';
const DEFAULT_TIMEOUT_SECONDS = 1800;
const DEFAULT_MAX_BUFFER = 128 * 1024 * 1024;
const SHAPE_VERSION = '2.1';
const FIXED_FIVE = /^\d+\.\d{5}$/;
const FIXED_THREE = /^\d+\.\d{3}$/;
const LINUX_ABSOLUTE = /^\//;
const SAFE_STRUCTURE_ID = /^[A-Za-z0-9_.-]+$/;

function fail(message, code, details) {
    const error = new Error(message);
    if (code) error.code = code;
    if (details !== undefined) error.details = details;
    throw error;
}

function sha256Buffer(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath, fsModule = fs) {
    return sha256Buffer(fsModule.readFileSync(filePath));
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `\'"'"\'`)}'`;
}

function asText(value) {
    if (value === undefined || value === null) return '';
    return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
}

function normalizeExitCode(result) {
    if (result && result.status !== undefined && result.status !== null) return Number(result.status);
    if (result && result.exitCode !== undefined && result.exitCode !== null) return Number(result.exitCode);
    if (result && result.exit_code !== undefined && result.exit_code !== null) return Number(result.exit_code);
    return result?.error || result?.signal ? 1 : 0;
}

function ensureDirectory(directory, fsModule) {
    if (!fsModule.existsSync(directory)) fsModule.mkdirSync(directory, { recursive: true });
}

function writeExclusive(filePath, content, fsModule) {
    ensureDirectory(path.dirname(filePath), fsModule);
    fsModule.writeFileSync(filePath, content, { flag: 'wx', encoding: 'utf8' });
}

function writeOnce(filePath, content, fsModule) {
    if (fsModule.existsSync(filePath)) return false;
    try {
        writeExclusive(filePath, content, fsModule);
        return true;
    } catch (error) {
        if (error?.code === 'EEXIST' || fsModule.existsSync(filePath)) return false;
        throw error;
    }
}

function readTextIfPresent(filePath, fsModule) {
    if (!fsModule.existsSync(filePath)) return null;
    return asText(fsModule.readFileSync(filePath, 'utf8'));
}

function regularFile(filePath, label, fsModule) {
    if (!filePath || !fsModule.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
    if (typeof fsModule.statSync === 'function' && !fsModule.statSync(filePath).isFile()) {
        fail(`${label} is not a regular file: ${filePath}`);
    }
    return path.resolve(filePath);
}

function processBoundary(dependencies) {
    if (typeof dependencies.runProcess === 'function') return dependencies.runProcess;
    if (typeof dependencies.spawnSync === 'function') {
        return (command, args, options) => dependencies.spawnSync(command, args, options);
    }
    return (command, args, options) => spawnSync(command, args, options);
}

async function runProcess(dependencies, command, args, options = {}) {
    const runner = processBoundary(dependencies);
    const result = await runner(command, args, {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: DEFAULT_MAX_BUFFER,
        ...options
    });
    if (!result || typeof result !== 'object') fail(`Process boundary returned no result for ${command}`, 'PROCESS_RESULT_INVALID');
    return {
        ...result,
        stdout: asText(result.stdout),
        stderr: asText(result.stderr),
        exitCode: normalizeExitCode(result)
    };
}

async function runWsl(dependencies, distro, command, options = {}) {
    return runProcess(
        dependencies,
        'wsl.exe',
        ['-d', distro, '--', 'bash', '-lc', command],
        { timeout: (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000, ...options }
    );
}

function commandRecord(label, command, result) {
    return {
        label,
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode
    };
}

function requireSuccessful(result, label) {
    if (result.exitCode !== 0) {
        fail(`${label} exited with code ${result.exitCode}`, 'PROCESS_FAILED', {
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exitCode
        });
    }
    return result;
}

function parseSha256(text, label) {
    const match = String(text).match(/^([a-fA-F0-9]{64})\s/m);
    if (!match) fail(`${label} did not return an exact SHA-256 digest`, 'QUALIFICATION_HASH_UNPARSED');
    return match[1].toLowerCase();
}

function parseOsRelease(text) {
    const result = {};
    for (const line of String(text).split(/\r?\n/)) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) result[match[1]] = match[2].replace(/^"|"$/g, '');
    }
    return result;
}

function hasShape21Banner(text) {
    return /S\s*H\s*A\s*P\s*E\s+v?2\.1/i.test(String(text));
}

function getOption(context, config, key, fallback) {
    if (context && context[key] !== undefined) return context[key];
    if (config && config[key] !== undefined) return config[key];
    const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (context && context[snake] !== undefined) return context[snake];
    if (config && config[snake] !== undefined) return config[snake];
    return fallback;
}

async function qualifyShape(config, dependencies, context = {}) {
    const executable = getOption(context, config, 'shapeExecutable', context.shapeBin || config.shapeBin || null);
    const expectedSha = getOption(
        context,
        config,
        'expectedShapeSha256',
        context.shapeExpectedSha256 || config.shapeExpectedSha256 || context.expectedSha256 || config.expectedSha256 || null
    );
    const distro = getOption(context, config, 'wslDistro', DEFAULT_WSL_DISTRO);
    if (typeof executable !== 'string' || !LINUX_ABSOLUTE.test(executable)) {
        fail('SHAPE executable must be an absolute Linux path', 'QUALIFICATION_EXECUTABLE_INVALID');
    }
    if (typeof expectedSha !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expectedSha)) {
        fail('Expected SHAPE executable SHA-256 is mandatory', 'QUALIFICATION_HASH_REQUIRED');
    }

    const commands = {};
    const runQualification = async (label, command, required = true) => {
        const result = await runWsl(dependencies, distro, `export LC_ALL=C LANG=C TZ=UTC\n${command}`, {
            timeoutSeconds: getOption(context, config, 'qualificationTimeoutSeconds', 60),
            purpose: label,
            qualificationLabel: label
        });
        commands[label] = commandRecord(label, command, result);
        return required ? requireSuccessful(result, label) : result;
    };

    const hashResult = await runQualification('shape-sha256', `sha256sum ${shellQuote(executable)}`);
    const executableSha256 = parseSha256(hashResult.stdout, 'SHAPE sha256sum');
    const expected = expectedSha.toLowerCase();
    if (executableSha256 !== expected) {
        fail(`SHAPE executable hash ${executableSha256} does not match expected ${expected}`, 'QUALIFICATION_HASH_MISMATCH', {
            observed_sha256: executableSha256,
            expected_sha256: expected
        });
    }

    const helpResult = await runQualification('shape-help', `${shellQuote(executable)} -h`);
    const helpText = `${helpResult.stdout}${helpResult.stderr}`;
    if (!hasShape21Banner(helpText)) {
        fail('SHAPE help output did not contain the SHAPE v2.1 banner', 'QUALIFICATION_VERSION_MISMATCH', {
            observed: helpText
        });
    }

    const listingResult = await runQualification('shape-list-all', `${shellQuote(executable)} +`);
    const fileResult = await runQualification('shape-file', `file ${shellQuote(executable)}`);
    const lddResult = await runQualification('shape-ldd', `ldd ${shellQuote(executable)}`, false);
    const unameResult = await runQualification('uname', 'uname -a');
    const osReleaseResult = await runQualification('os-release', 'cat /etc/os-release');
    const localeResult = await runQualification('locale', 'locale');
    const osRelease = parseOsRelease(osReleaseResult.stdout);
    return {
        status: 'qualified',
        shape_version: SHAPE_VERSION,
        shape_banner: 'SHAPE v2.1',
        shape_executable: executable,
        executable_sha256: executableSha256,
        expected_executable_sha256: expected,
        wsl_distro: distro,
        wsl_registered_distro_name: distro,
        environment: {
            file: fileResult.stdout,
            reference_listing: listingResult.stdout,
            ldd: lddResult.stdout,
            uname: unameResult.stdout,
            os_release: osReleaseResult.stdout,
            os_release_fields: osRelease,
            locale: localeResult.stdout,
            process_locale: 'C',
            process_timezone: 'UTC',
            guest_os_pretty_name: osRelease.PRETTY_NAME || 'not_parsed'
        },
        commands
    };
}

function valueOf(record, camel, snake = camel) {
    if (record && record[camel] !== undefined) return record[camel];
    return record ? record[snake] : undefined;
}

function normalizeShapeCase(item, offset) {
    const caseId = valueOf(item, 'caseId', 'case_id');
    const structureId = valueOf(item, 'structureId', 'structure_id');
    const cn = Number(valueOf(item, 'cn'));
    const shapeAtoms = valueOf(item, 'shapeAtoms', 'shape_atoms') || valueOf(item, 'canonicalShapeAtoms', 'canonical_shape_atoms');
    if (typeof caseId !== 'string' || !caseId) fail(`SHAPE case ${offset + 1} has no case ID`, 'SHAPE_CASE_INVALID');
    if (typeof structureId !== 'string' || !SAFE_STRUCTURE_ID.test(structureId)) {
        fail(`SHAPE case ${caseId} has an unsafe structure ID`, 'SHAPE_STRUCTURE_ID_INVALID');
    }
    if (!Number.isInteger(cn) || cn < 2) fail(`SHAPE case ${caseId} has an invalid CN`, 'SHAPE_CASE_INVALID');
    if (!Array.isArray(shapeAtoms)) fail(`SHAPE case ${caseId} has no atom tokens`, 'SHAPE_ATOMS_MISSING');
    const atoms = shapeAtoms.map(atom => ({
        element: atom?.element,
        tokens: atom?.tokens
    }));
    if (atoms.length !== cn + 1) fail(`SHAPE case ${caseId} has ${atoms.length} atoms; expected ${cn + 1}`, 'SHAPE_POINT_COUNT_MISMATCH');
    const center = atoms[0];
    if (!center || !Array.isArray(center.tokens) || center.tokens.length !== 3 ||
        center.tokens.some(token => !Number.isFinite(Number(token)) || Number(token) !== 0)) {
        fail(`SHAPE case ${caseId} does not place the center at atom position 1`, 'SHAPE_CENTER_NOT_FIRST');
    }
    return { source: item, caseId, structureId, cn, shapeAtoms: atoms };
}

function normalizeShapeTarget(target, offset) {
    const shapeCode = valueOf(target, 'shapeCode', 'shape_code') || valueOf(target, 'code');
    const qshapeCode = valueOf(target, 'code') || valueOf(target, 'qshapeCode', 'qshape_code') || shapeCode;
    const shapeIndex = Number(valueOf(target, 'shapeIndex', 'shape_index') ?? valueOf(target, 'ordinal') ?? valueOf(target, 'index'));
    if (typeof shapeCode !== 'string' || !shapeCode) fail(`SHAPE target ${offset + 1} has no SHAPE code`, 'SHAPE_TARGET_INVALID');
    if (typeof qshapeCode !== 'string' || !qshapeCode) fail(`SHAPE target ${shapeCode} has no Q-Shape code`, 'SHAPE_TARGET_INVALID');
    if (!Number.isInteger(shapeIndex) || shapeIndex < 1) fail(`SHAPE target ${shapeCode} has no index`, 'SHAPE_TARGET_INVALID');
    return { source: target, shapeCode, qshapeCode, shapeIndex };
}

function normalizedInvocation(invocation) {
    const id = invocation?.id || invocation?.invocation_id;
    const cn = Number(invocation?.cn);
    if (typeof id !== 'string' || !id) fail('SHAPE invocation has no ID', 'SHAPE_INVOCATION_INVALID');
    if (!Number.isInteger(cn) || cn < 2) fail(`SHAPE invocation ${id} has an invalid CN`, 'SHAPE_INVOCATION_INVALID');
    const cases = (invocation.cases || []).map(normalizeShapeCase);
    const targets = (invocation.targets || []).map(normalizeShapeTarget);
    if (cases.length === 0) fail(`SHAPE invocation ${id} has no cases`, 'SHAPE_CASES_EMPTY');
    if (targets.length === 0) {
        const codes = invocation.targetCodes || invocation.target_codes || [];
        const qCodes = invocation.targetQShapeCodes || invocation.target_qshape_codes || codes;
        const ordinals = invocation.targetOrdinals || invocation.target_ordinals || codes.map((_, i) => i + 1);
        for (let i = 0; i < codes.length; i++) targets.push(normalizeShapeTarget({ shapeCode: codes[i], code: qCodes[i], shapeIndex: ordinals[i] }, i));
    }
    if (targets.length === 0) fail(`SHAPE invocation ${id} has no targets`, 'SHAPE_TARGETS_EMPTY');
    if (cases.some(item => item.cn !== cn)) fail(`SHAPE invocation ${id} mixes coordination numbers`, 'SHAPE_CN_MISMATCH');
    const structureIds = new Set();
    for (const item of cases) {
        if (structureIds.has(item.structureId)) fail(`SHAPE invocation ${id} repeats structure ${item.structureId}`, 'SHAPE_DUPLICATE_STRUCTURE');
        structureIds.add(item.structureId);
    }
    const shapeCodes = new Set();
    const shapeIndices = new Set();
    for (const target of targets) {
        if (shapeCodes.has(target.shapeCode) || shapeIndices.has(target.shapeIndex)) {
            fail(`SHAPE invocation ${id} repeats target identity`, 'SHAPE_DUPLICATE_TARGET');
        }
        shapeCodes.add(target.shapeCode);
        shapeIndices.add(target.shapeIndex);
    }
    return { id, cn, cases, targets, repetition: invocation.repetition ?? null };
}

function makeControl(invocation) {
    const cases = invocation.cases.map(item => ({
        caseId: item.caseId,
        structureId: item.structureId,
        cn: item.cn,
        shapeAtoms: item.shapeAtoms
    }));
    const targets = invocation.targets.map(target => ({
        qshapeCode: target.qshapeCode,
        shapeCode: target.shapeCode,
        shapeIndex: target.shapeIndex
    }));
    const dat = directCore.buildShapeDat(invocation.cn, cases, targets.map(target => ({
        shapeIndex: target.shapeIndex,
        index: target.shapeIndex
    })));
    return { dat, cases, targets };
}

function exactIdentity(values, expected, label) {
    const actual = values.slice();
    const want = expected.slice();
    if (actual.length !== want.length || new Set(actual).size !== actual.length ||
        actual.some((value, index) => value !== want[index])) {
        fail(`${label} set/order mismatch`, 'SHAPE_PARSE_CONTRACT', { observed: actual, expected: want });
    }
}

function exactSet(values, expected, label) {
    const actual = values.slice();
    const want = expected.slice();
    if (actual.length !== want.length || new Set(actual).size !== actual.length ||
        actual.some(value => !want.includes(value)) || want.some(value => !actual.includes(value))) {
        fail(`${label} set mismatch`, 'SHAPE_PARSE_CONTRACT', { observed: actual, expected: want });
    }
}

function retainedRawPath(attemptPath, outputRoot, fileName) {
    if (!outputRoot) return path.join(attemptPath, fileName);
    const relative = path.relative(path.resolve(outputRoot), path.resolve(attemptPath, fileName));
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        fail('SHAPE raw evidence path escapes the package root', 'SHAPE_RAW_PATH_INVALID');
    }
    return relative.split(path.sep).join('/');
}

function parseShapeRows(invocation, outText, tabText, attemptPath, config = {}) {
    const parsedOut = directCore.parseShapeOut(outText);
    const parsedTab = directCore.parseShapeTab(tabText);
    const expectedStructureIds = invocation.cases.map(item => item.structureId);
    const expectedShapeCodes = invocation.targets.map(item => item.shapeCode);
    exactIdentity(parsedOut.map(item => item.structureId), expectedStructureIds, 'SHAPE .out structures');
    exactIdentity(parsedTab.structures.map(item => item.structureId), expectedStructureIds, 'SHAPE .tab structures');
    exactIdentity(parsedTab.targetCodes, expectedShapeCodes, 'SHAPE .tab target order');
    const caseByStructure = new Map(invocation.cases.map(item => [item.structureId, item]));
    const targetByShape = new Map(invocation.targets.map(item => [item.shapeCode, item]));
    const tabByStructure = new Map(parsedTab.structures.map(item => [item.structureId, item]));
    const rows = [];
    for (const structure of parsedOut) {
        const caseItem = caseByStructure.get(structure.structureId);
        const values = structure.values;
        exactSet(values.map(item => item.targetCode), expectedShapeCodes, `SHAPE .out ${structure.structureId} targets`);
        for (const value of values) {
            if (!value.lexicallyValid || !FIXED_FIVE.test(value.valueToken)) {
                fail(`SHAPE .out value ${value.valueToken} is not an exact five-decimal token`, 'SHAPE_OUT_TOKEN_INVALID');
            }
            const target = targetByShape.get(value.targetCode);
            const tabStructure = tabByStructure.get(structure.structureId);
            const tabValue = tabStructure?.values?.find(item => item.targetCode === value.targetCode);
            if (!tabValue || !FIXED_THREE.test(tabValue.valueToken)) {
                fail(`SHAPE .tab value is missing for ${structure.structureId}/${value.targetCode}`,
                    'SHAPE_TAB_TOKEN_INVALID');
            }
            rows.push({
                invocationId: invocation.id,
                invocation_id: invocation.id,
                repetition: invocation.repetition,
                caseId: caseItem.caseId,
                case_id: caseItem.caseId,
                structureId: caseItem.structureId,
                structure_id: caseItem.structureId,
                targetCode: target.qshapeCode,
                target_code: target.qshapeCode,
                shapeCode: target.shapeCode,
                shape_code: target.shapeCode,
                targetIndex: target.shapeIndex,
                target_index: target.shapeIndex,
                valueToken: value.valueToken,
                value_token: value.valueToken,
                lexicallyValid: true,
                rawLineNumber: value.rawLineNumber,
                rawPath: retainedRawPath(attemptPath, config.outputRoot, 'result.out'),
                raw_path: retainedRawPath(attemptPath, config.outputRoot, 'result.out'),
                tabValueToken: tabValue.valueToken,
                tab_value_token: tabValue.valueToken,
                tabRawPath: retainedRawPath(attemptPath, config.outputRoot, 'result.tab'),
                tab_raw_path: retainedRawPath(attemptPath, config.outputRoot, 'result.tab')
            });
        }
    }
    for (const structure of parsedTab.structures) {
        const values = structure.values;
        exactIdentity(values.map(item => item.targetCode), expectedShapeCodes, `SHAPE .tab ${structure.structureId} targets`);
        for (const value of values) {
            if (!FIXED_THREE.test(value.valueToken)) fail(`SHAPE .tab value ${value.valueToken} is not an exact three-decimal token`, 'SHAPE_TAB_TOKEN_INVALID');
        }
    }
    const expectedCount = invocation.cases.length * invocation.targets.length;
    if (rows.length !== expectedCount) fail(`SHAPE invocation ${invocation.id} emitted ${rows.length} rows; expected ${expectedCount}`, 'SHAPE_ROW_COUNT_MISMATCH');
    return { rows, parsedOut, parsedTab };
}

function shapeShellCommand(executable, attemptPath, datName, timeoutSeconds) {
    const wslAttemptPath = `$(wslpath -a ${shellQuote(path.resolve(attemptPath))})`;
    return [
        'set -o pipefail',
        'export LC_ALL=C LANG=C TZ=UTC',
        `cd "${wslAttemptPath}"`,
        `timeout -k 30s ${Number(timeoutSeconds)}s ${shellQuote(executable)} ${shellQuote(datName)}`
    ].join('\n');
}

function retainFailureEvidence(attemptPath, result, outText, tabText, fsModule) {
    writeOnce(path.join(attemptPath, 'stdout.txt'), result.stdout, fsModule);
    writeOnce(path.join(attemptPath, 'stderr.txt'), result.stderr, fsModule);
    writeOnce(path.join(attemptPath, 'exit-code.txt'), `${result.exitCode}\n`, fsModule);
    if (outText !== null) writeOnce(path.join(attemptPath, 'result.out'), outText, fsModule);
    if (tabText !== null) writeOnce(path.join(attemptPath, 'result.tab'), tabText, fsModule);
}

async function executeShapeInvocation(config, dependencies, context) {
    const fsModule = dependencies.fsModule || fs;
    const invocation = normalizedInvocation(context.invocation || context);
    const rawAttemptPath = context.attemptPath || context.attempt_path;
    if (typeof rawAttemptPath !== 'string' || !rawAttemptPath) fail('SHAPE attempt path is required', 'SHAPE_ATTEMPT_PATH_INVALID');
    const attemptPath = path.resolve(rawAttemptPath);
    if (attemptPath === path.parse(attemptPath).root) fail('SHAPE attempt path cannot be a filesystem root', 'SHAPE_ATTEMPT_PATH_INVALID');
    ensureDirectory(attemptPath, fsModule);
    const executable = getOption(context, config, 'shapeExecutable', context.shapeBin || config.shapeBin || null);
    const distro = getOption(context, config, 'wslDistro', DEFAULT_WSL_DISTRO);
    const timeoutSeconds = getOption(context, config, 'shapeTimeoutSeconds', DEFAULT_TIMEOUT_SECONDS);
    if (typeof executable !== 'string' || !LINUX_ABSOLUTE.test(executable)) fail('SHAPE executable must be an absolute Linux path', 'SHAPE_EXECUTABLE_INVALID');
    const control = makeControl(invocation);
    const datPath = path.join(attemptPath, 'control.dat');
    const outPath = path.join(attemptPath, 'control.out');
    const tabPath = path.join(attemptPath, 'control.tab');
    const runnerOwnsEvidenceWrites = context.outputRoot !== undefined;
    for (const outputPath of [datPath, outPath, tabPath]) {
        if (fsModule.existsSync(outputPath)) fail(`SHAPE attempt evidence already exists: ${outputPath}`, 'ATTEMPT_EVIDENCE_EXISTS');
    }
    writeExclusive(datPath, control.dat, fsModule);
    let processResult;
    let outText = readTextIfPresent(outPath, fsModule);
    let tabText = readTextIfPresent(tabPath, fsModule);
    try {
        processResult = await runWsl(dependencies, distro, shapeShellCommand(executable, attemptPath, 'control.dat', timeoutSeconds), {
            timeoutSeconds: (Number(timeoutSeconds) + 30),
            purpose: `SHAPE ${invocation.id}`,
            attemptPath,
            invocationId: invocation.id
        });
        outText = readTextIfPresent(outPath, fsModule);
        tabText = readTextIfPresent(tabPath, fsModule);
        if (outText === null && processResult.out !== undefined) outText = asText(processResult.out);
        if (tabText === null && processResult.tab !== undefined) tabText = asText(processResult.tab);
        if (outText !== null && !fsModule.existsSync(outPath)) writeOnce(outPath, outText, fsModule);
        if (tabText !== null && !fsModule.existsSync(tabPath)) writeOnce(tabPath, tabText, fsModule);
        if (processResult.exitCode !== 0) {
            retainFailureEvidence(attemptPath, processResult, outText, tabText, fsModule);
            fail(`SHAPE invocation ${invocation.id} exited with code ${processResult.exitCode}`, 'SHAPE_PROCESS_FAILED', {
                exit_code: processResult.exitCode,
                stdout: processResult.stdout,
                stderr: processResult.stderr
            });
        }
        if (outText === null || tabText === null) {
            retainFailureEvidence(attemptPath, processResult, outText, tabText, fsModule);
            fail(`SHAPE invocation ${invocation.id} did not retain both .out and .tab`, 'SHAPE_EVIDENCE_MISSING', {
                out: outText !== null,
                tab: tabText !== null
            });
        }
        const parsed = parseShapeRows(invocation, outText, tabText, attemptPath, {
            ...config,
            outputRoot: context.outputRoot || config.outputRoot || null
        });
        return {
            status: 'complete',
            invocationId: invocation.id,
            invocation_id: invocation.id,
            repetition: invocation.repetition,
            exitCode: processResult.exitCode,
            stdout: processResult.stdout,
            stderr: processResult.stderr,
            // The current orchestrator writes controlText to control.dat after
            // a successful hook.  The adapter has already created the exact
            // immutable control file so returning it there would be a second
            // write.  Direct callers still receive the text for inspection.
            controlText: runnerOwnsEvidenceWrites ? undefined : control.dat,
            control: {
                invocation_id: invocation.id,
                target_codes: invocation.targets.map(target => target.shapeCode),
                target_qshape_codes: invocation.targets.map(target => target.qshapeCode),
                case_ids: invocation.cases.map(item => item.caseId),
                center_position_one_based: true
            },
            out: outText,
            tab: tabText,
            datPath,
            outPath,
            tabPath,
            rows: parsed.rows,
            parsedOut: parsed.parsedOut,
            parsedTab: parsed.parsedTab
        };
    } catch (error) {
        if (processResult) retainFailureEvidence(attemptPath, processResult, outText, tabText, fsModule);
        throw error;
    }
}

function readJsonDocument(filePath, fsModule) {
    const raw = fsModule.readFileSync(filePath);
    return { raw, document: JSON.parse(asText(raw)) };
}

function qRunnerFactory(config, dependencies, context) {
    const worker = dependencies.qWorker || defaultQWorker;
    if (!worker || typeof worker.runWorker !== 'function') fail('Q-Shape worker does not expose runWorker', 'Q_WORKER_INVALID');
    const stream = context.stream;
    const explicitStream = typeof stream === 'string' && stream.startsWith('q_explicit_seed_');
    const inferredSeedPolicy = context.seedPolicy || (explicitStream ? 'explicit' : 'input-derived');
    const inferredSeed = context.explicitSeed !== undefined
        ? context.explicitSeed
        : explicitStream ? Number(stream.slice('q_explicit_seed_'.length)) : undefined;
    const inferredRepetition = context.repetition || (explicitStream ? 1 : Number(String(stream || '').slice(-1)) || 1);
    const options = {
        ...context,
        output: context.output || null,
        cases: context.casesPath || context.cases,
        references: context.referencesPath || context.references || null,
        repo: context.repo || config.repoRoot,
        seedPolicy: inferredSeedPolicy,
        explicitSeed: inferredSeed,
        repetition: inferredRepetition,
        stream,
        shardIndex: context.shardIndex ?? 0,
        shardCount: context.shardCount ?? 1
    };
    const workerDependencies = dependencies.workerDependencies || config.workerDependencies || {};
    return worker.runWorker(options, workerDependencies);
}

function canonicalProductToken(value) {
    if (typeof value !== 'number') return null;
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return Object.is(value, -0) ? '-0' : value.toPrecision(17);
}

function malformedObservationBase(control) {
    return {
        control_id: control.control_id,
        program: control.program,
        interface: control.interface,
        category: control.category,
        cn: control.cn,
        source_parent_case_id: control.source_parent_case_id,
        campaign_gate: 'malformed_control_contract',
        expected_outcome: control.expected_outcome,
        expected_numeric_rows: control.expected_numeric_rows
    };
}

function finalizeMalformedObservation(control, observed) {
    const row = {
        ...malformedObservationBase(control),
        observation_complete: true,
        observed_rejection_code: null,
        observed_value_tokens: [],
        observed_tab_value_tokens: [],
        raw_evidence_paths: [],
        ...observed
    };
    row.status = row.observed_outcome === row.expected_outcome &&
        row.observed_numeric_rows === row.expected_numeric_rows ? 'pass' : 'fail';
    return row;
}

function qShapeProductBoundary(config, dependencies) {
    const loaded = dependencies.qshapeProduct || directCore.loadQShape(path.resolve(config.repoRoot));
    if (!loaded || typeof loaded.calculateShapeMeasure !== 'function' ||
        !loaded.referenceGeometries) {
        fail('Q-Shape product boundary is unavailable', 'QSHAPE_PRODUCT_BOUNDARY_INVALID');
    }
    const inventory = directCore.buildReferenceInventory(loaded.referenceGeometries);
    return { ...loaded, inventory };
}

function executeQShapeMalformedControl(control, product) {
    const group = product.inventory.find(item => item.cn === control.cn);
    const targetCode = control.input?.target_code;
    if (control.interface === 'qshape_reference_registry') {
        const available = Boolean(group && group.count > 0);
        return finalizeMalformedObservation(control, {
            product_boundary: 'src/constants/referenceGeometries/index.js',
            product_boundary_invoked: true,
            observed_outcome: available ? 'reference_set_available' : 'reference_set_unavailable',
            observed_numeric_rows: 0,
            observed_reference_count: group?.count || 0
        });
    }
    const target = group?.targets.find(item => item.code === targetCode);
    if (!target) fail(`Q-Shape target ${targetCode} is unavailable for CN=${control.cn}`,
        'QSHAPE_MALFORMED_TARGET_MISSING');
    const actual = control.input.ligand_tokens.map(point => point.map(Number));
    let result;
    try {
        result = product.calculateShapeMeasure(actual, target.coordinates, 'default');
    } catch (error) {
        return finalizeMalformedObservation(control, {
            product_boundary: 'src/services/shapeAnalysis/shapeCalculator.js',
            product_boundary_invoked: true,
            observed_outcome: 'thrown_error',
            observed_numeric_rows: 0,
            observed_error_name: error?.name || 'Error',
            observed_error_message: error?.message || String(error),
            observed_rejection_code: error?.rejection_code || null
        });
    }
    const measure = result?.measure;
    const finite = typeof measure === 'number' && Number.isFinite(measure);
    return finalizeMalformedObservation(control, {
        product_boundary: 'src/services/shapeAnalysis/shapeCalculator.js',
        product_boundary_invoked: true,
        observed_outcome: finite ? 'finite_result' : 'nonfinite_result',
        observed_numeric_rows: finite ? 1 : 0,
        observed_value_tokens: typeof measure === 'number' ? [canonicalProductToken(measure)] : [],
        observed_result_type: typeof measure
    });
}

function rawShapeMalformedControl(control, ordinal) {
    const structureId = `MAL${String(ordinal + 1).padStart(2, '0')}`;
    const shapeCase = {
        cn: control.cn,
        structureId,
        shapeAtoms: control.input.atoms
    };
    const dat = directCore.buildShapeDat(control.cn, [shapeCase], [{
        index: control.input.target_index,
        shapeIndex: control.input.target_index
    }]);
    return { dat, structureId };
}

async function executeShapeMalformedControl(config, dependencies, context, control, ordinal) {
    const fsModule = dependencies.fsModule || fs;
    const executable = getOption(context, config, 'shapeExecutable', context.shapeBin || config.shapeBin || null);
    const distro = getOption(context, config, 'wslDistro', DEFAULT_WSL_DISTRO);
    const timeoutSeconds = getOption(context, config, 'shapeTimeoutSeconds', DEFAULT_TIMEOUT_SECONDS);
    if (typeof executable !== 'string' || !LINUX_ABSOLUTE.test(executable)) {
        fail('SHAPE executable must be an absolute Linux path', 'SHAPE_EXECUTABLE_INVALID');
    }
    if (!context.outputRoot) fail('Malformed SHAPE probe requires an output root', 'MALFORMED_OUTPUT_ROOT_MISSING');
    const attemptPath = path.join(path.resolve(context.outputRoot), 'malformed', 'raw', 'shape', control.control_id);
    ensureDirectory(attemptPath, fsModule);
    const controlPath = path.join(attemptPath, 'control.dat');
    const outPath = path.join(attemptPath, 'control.out');
    const tabPath = path.join(attemptPath, 'control.tab');
    const stdoutPath = path.join(attemptPath, 'stdout.txt');
    const stderrPath = path.join(attemptPath, 'stderr.txt');
    const exitPath = path.join(attemptPath, 'exit-code.txt');
    const raw = rawShapeMalformedControl(control, ordinal);
    let executionMode = 'live_product_process';
    let processResult = null;
    if (fsModule.existsSync(controlPath)) {
        if (asText(fsModule.readFileSync(controlPath)) !== raw.dat) {
            fail(`Retained malformed SHAPE control changed: ${control.control_id}`,
                'MALFORMED_SHAPE_CONTROL_CHANGED');
        }
        if (!fsModule.existsSync(outPath) || !fsModule.existsSync(tabPath) || !fsModule.existsSync(exitPath)) {
            fail(`Retained malformed SHAPE evidence is incomplete: ${control.control_id}`,
                'MALFORMED_SHAPE_EVIDENCE_INCOMPLETE');
        }
        executionMode = 'retained_product_evidence';
        processResult = {
            exitCode: Number(asText(fsModule.readFileSync(exitPath)).trim()),
            stdout: readTextIfPresent(stdoutPath, fsModule) || '',
            stderr: readTextIfPresent(stderrPath, fsModule) || ''
        };
    } else {
        writeExclusive(controlPath, raw.dat, fsModule);
        processResult = await runWsl(
            dependencies,
            distro,
            shapeShellCommand(executable, attemptPath, 'control.dat', timeoutSeconds),
            {
                timeoutSeconds: Number(timeoutSeconds) + 30,
                purpose: `SHAPE malformed probe ${control.control_id}`,
                attemptPath,
                controlId: control.control_id
            }
        );
        writeOnce(stdoutPath, processResult.stdout, fsModule);
        writeOnce(stderrPath, processResult.stderr, fsModule);
        writeOnce(exitPath, `${processResult.exitCode}\n`, fsModule);
    }
    const outText = readTextIfPresent(outPath, fsModule);
    const tabText = readTextIfPresent(tabPath, fsModule);
    const rawPaths = [controlPath, stdoutPath, stderrPath, exitPath]
        .concat(outText === null ? [] : [outPath])
        .concat(tabText === null ? [] : [tabPath])
        .map(filePath => retainedRawPath(attemptPath, context.outputRoot, path.basename(filePath)));
    if (processResult.exitCode !== 0) {
        return finalizeMalformedObservation(control, {
            product_boundary: `SHAPE ${SHAPE_VERSION} executable`,
            product_boundary_invoked: true,
            execution_mode: executionMode,
            process_exit_code: processResult.exitCode,
            observed_outcome: 'process_rejected_or_failed',
            observed_numeric_rows: 0,
            raw_evidence_paths: rawPaths
        });
    }
    if (outText === null || tabText === null) {
        return finalizeMalformedObservation(control, {
            product_boundary: `SHAPE ${SHAPE_VERSION} executable`,
            product_boundary_invoked: true,
            execution_mode: executionMode,
            process_exit_code: processResult.exitCode,
            observed_outcome: 'completed_without_output_pair',
            observed_numeric_rows: 0,
            raw_evidence_paths: rawPaths
        });
    }
    let parsedOut;
    let parsedTab;
    try {
        parsedOut = directCore.parseShapeOut(outText);
        parsedTab = directCore.parseShapeTab(tabText);
    } catch (error) {
        return finalizeMalformedObservation(control, {
            product_boundary: `SHAPE ${SHAPE_VERSION} executable`,
            product_boundary_invoked: true,
            execution_mode: executionMode,
            process_exit_code: processResult.exitCode,
            observed_outcome: 'unparseable_product_output',
            observed_numeric_rows: 0,
            observed_error_message: error.message,
            raw_evidence_paths: rawPaths
        });
    }
    const outValues = parsedOut.flatMap(structure => structure.values || []);
    const tabValues = parsedTab.structures.flatMap(structure => structure.values || []);
    return finalizeMalformedObservation(control, {
        product_boundary: `SHAPE ${SHAPE_VERSION} executable`,
        product_boundary_invoked: true,
        execution_mode: executionMode,
        process_exit_code: processResult.exitCode,
        observed_outcome: outValues.length > 0 ? 'accepted_with_numeric_rows' : 'accepted_without_numeric_rows',
        observed_numeric_rows: outValues.length,
        observed_value_tokens: outValues.map(item => item.valueToken),
        observed_tab_value_tokens: tabValues.map(item => item.valueToken),
        observed_structure_ids: parsedOut.map(item => item.structureId),
        observed_target_codes: outValues.map(item => item.targetCode),
        raw_evidence_paths: rawPaths
    });
}

async function executeProductionMalformedControls(config, dependencies, context, document) {
    defaultMalformed.validateMalformedControlDocument(document);
    let qProduct = null;
    const results = [];
    for (let ordinal = 0; ordinal < document.controls.length; ordinal++) {
        const control = document.controls[ordinal];
        if (control.interface === 'shape_2_1_raw_dat') {
            results.push(await executeShapeMalformedControl(
                config, dependencies, context, control, ordinal
            ));
        } else {
            if (!qProduct) qProduct = qShapeProductBoundary(config, dependencies);
            results.push(executeQShapeMalformedControl(control, qProduct));
        }
    }
    const passed = results.filter(item => item.status === 'pass').length;
    const failed = results.length - passed;
    return {
        schema_version: 1,
        campaign_id: document.campaign_id,
        campaign_gate: 'malformed_control_contract',
        evidence_scope: 'product_boundaries',
        product_boundary_invoked: true,
        source_positive_cases_sha256: document.source_positive_cases_sha256,
        count: results.length,
        passed,
        failed,
        campaign_gate_status: failed === 0 ? 'pass' : 'fail',
        results,
        controls: results
    };
}

async function malformedRunnerFactory(config, dependencies, context) {
    const malformed = dependencies.malformedModule || defaultMalformed;
    const builder = dependencies.buildMalformedControlDocument || malformed.buildMalformedControlDocument;
    const injectedExecutor = dependencies.productionMalformedExecutor ||
        dependencies.typedMalformedExecutor || dependencies.malformedExecutor || null;
    if (typeof builder !== 'function') fail('Malformed-control builder is required', 'MALFORMED_EXECUTOR_INVALID');
    let positiveDocument = context.cases || context.positiveDocument;
    let sourceHash = context.casesSha256 || context.sourcePositiveCasesSha256;
    if (typeof positiveDocument === 'string') {
        const source = readJsonDocument(positiveDocument, dependencies.fsModule || fs);
        positiveDocument = source.document;
        sourceHash = sourceHash || sha256Buffer(source.raw);
    }
    if (!positiveDocument || typeof positiveDocument !== 'object') {
        const casesPath = context.casesPath || config.casesPath;
        if (!casesPath) fail('Malformed runner requires the frozen positive document', 'MALFORMED_DOCUMENT_MISSING');
        const source = readJsonDocument(casesPath, dependencies.fsModule || fs);
        positiveDocument = source.document;
        sourceHash = sourceHash || sha256Buffer(source.raw);
    }
    let document = context.controlsDocument || context.malformedDocument || null;
    let sourceControlsSha256 = context.controlsSha256 || context.sourceControlsSha256 || null;
    if (context.controlsPath) {
        const frozen = readJsonDocument(context.controlsPath, dependencies.fsModule || fs);
        const observedSha256 = sha256Buffer(frozen.raw);
        if (sourceControlsSha256 && observedSha256 !== sourceControlsSha256) {
            fail('Frozen malformed-control bytes changed before execution', 'MALFORMED_INPUT_CHANGED');
        }
        sourceControlsSha256 = observedSha256;
        if (document && JSON.stringify(document) !== JSON.stringify(frozen.document)) {
            fail('Frozen malformed-control document differs from its retained bytes', 'MALFORMED_INPUT_CHANGED');
        }
        document = frozen.document;
    }
    if (!document) document = builder(positiveDocument, sourceHash);
    const validator = dependencies.validateMalformedControlDocument || malformed.validateMalformedControlDocument;
    if (typeof validator === 'function') validator(document);
    const result = injectedExecutor
        ? await injectedExecutor(document, { config, dependencies, context })
        : await executeProductionMalformedControls(config, dependencies, context, document);
    // The frozen typed executor calls its per-control collection `results`,
    // while the runner's evidence contract calls the same collection
    // `controls`.  Preserve the executor result and add only the compatibility
    // alias needed at the runner boundary.
    if (result && Array.isArray(result.results) && !Array.isArray(result.controls)) {
        return {
            ...result,
            controls: result.results,
            source_controls_sha256: sourceControlsSha256 || null
        };
    }
    return { ...result, source_controls_sha256: sourceControlsSha256 || null };
}

function parseVerifierReceipt(stdout) {
    const text = String(stdout).trim();
    if (!text) return { receipt: null, parseError: 'empty_stdout' };
    const lines = text.split(/\r?\n/).filter(Boolean);
    try {
        return { receipt: JSON.parse(lines[lines.length - 1]), parseError: null };
    } catch (error) {
        return { receipt: null, parseError: error.message };
    }
}

async function verifierFactory(config, dependencies, context) {
    const fsModule = dependencies.fsModule || fs;
    const verifierPath = context.verifierPath || config.verifierPath || path.resolve(config.repoRoot || process.cwd(), 'validation/scripts/verify-metamorphic-parity.cjs');
    const packageFrozenRoot = context.outputRoot ? path.join(context.outputRoot, 'inputs', 'frozen') : null;
    const casesPath = context.casesPath || config.casesPath || (packageFrozenRoot && path.join(packageFrozenRoot, 'cases.json'));
    const referencesPath = context.referencesPath || config.referencesPath || (packageFrozenRoot && path.join(packageFrozenRoot, 'references.json'));
    const argumentBuilder = context.verifierArguments || config.verifierArguments;
    const args = typeof argumentBuilder === 'function'
        ? argumentBuilder({ ...context, verifierPath, casesPath, referencesPath })
        : context.verifierArgs || (context.inputOnly === true
            ? [verifierPath, '--cases', casesPath, '--references', referencesPath]
            : [verifierPath, '--package', context.outputRoot || config.outputRoot]);
    const result = await runProcess(dependencies, context.nodeExecutable || config.nodeExecutable || process.execPath, args, {
        cwd: config.repoRoot || process.cwd(),
        purpose: 'independent metamorphic verifier',
        verifierPath
    });
    const parsed = parseVerifierReceipt(result.stdout);
    const exitCode = result.exitCode;
    return {
        status: parsed.parseError ? 'error' : exitCode === 0 ? 'pass' : 'fail',
        exitCode,
        exit_code: exitCode,
        receipt: parsed.receipt,
        receiptParseError: parsed.parseError,
        stdout: result.stdout,
        stderr: result.stderr,
        verifierPath,
        args,
        exact_exit_code: exitCode,
        exact_receipt: parsed.receipt,
        verifiedCounts: parsed.receipt?.verified_counts || null,
        verified_counts: parsed.receipt?.verified_counts || null,
        outputRoot: context.outputRoot || config.outputRoot,
        manifestPath: context.manifestPath || null,
        fs_available: Boolean(fsModule)
    };
}

function createProductionDependencies(options = {}, injected = {}) {
    const config = {
        wslDistro: DEFAULT_WSL_DISTRO,
        shapeTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        qualificationTimeoutSeconds: 60,
        repoRoot: process.cwd(),
        ...options
    };
    const dependencies = {
        ...(options.dependencies || {}),
        ...injected
    };
    const qualificationRunner = context => qualifyShape(config, dependencies, context);
    const shapeRunner = context => executeShapeInvocation(config, dependencies, context);
    const qRunner = context => qRunnerFactory(config, dependencies, context);
    const malformedRunner = context => malformedRunnerFactory(config, dependencies, context);
    const verifier = context => verifierFactory(config, dependencies, context);
    return {
        qualificationRunner,
        shapeRunner,
        qRunner,
        malformedRunner,
        verifier,
        qualifyShape: qualificationRunner,
        executeShapeInvocation: shapeRunner,
        runQShape: qRunner,
        executeMalformedControls: malformedRunner,
        verify: verifier,
        config,
        dependencies
    };
}

module.exports = {
    DEFAULT_MAX_BUFFER,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_WSL_DISTRO,
    FIXED_FIVE,
    FIXED_THREE,
    SHAPE_VERSION,
    createProductionDependencyFactory: createProductionDependencies,
    createMetamorphicProductionDependencies: createProductionDependencies,
    createProductionDependencies,
    makeProductionDependencies: createProductionDependencies,
    canonicalProductToken,
    executeProductionMalformedControls,
    executeQShapeMalformedControl,
    executeShapeMalformedControl,
    executeShapeInvocation,
    hasShape21Banner,
    normalizeShapeCase,
    normalizeShapeTarget,
    parseShapeRows,
    qualifyShape,
    qRunnerFactory,
    malformedRunnerFactory,
    verifierFactory,
    shapeShellCommand,
    shellQuote,
    sha256Buffer
};

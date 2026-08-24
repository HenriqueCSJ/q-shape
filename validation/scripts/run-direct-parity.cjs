#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
    buildFixtureCases,
    buildIdealCases,
    buildReferenceInventory,
    buildShapeDat,
    formatCoordinate,
    loadQShape,
    parseShapeOut,
    parseShapeReferenceListing,
    rowsToCsv,
    sha256Buffer,
    sha256File,
    shellQuote
} = require('./direct-parity-core.cjs');
const {
    analyzeDirectParity
} = require('./direct-parity-analysis.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAX_SHAPE_REFERENCES_PER_CONTROL = 12;
const QSHAPE_REPETITIONS = 2;
const SHAPE_REPETITIONS = 2;

const COMPARISON_COLUMNS = [
    'case_id',
    'stratum',
    'cn',
    'source_name',
    'target_code',
    'target_name',
    'shape_token',
    'qshape_full_precision',
    'qshape_display_5dp',
    'signed_error',
    'absolute_error',
    'pass_abs_0_01',
    'runtime_ms'
];

const CASE_SUMMARY_COLUMNS = [
    'case_id',
    'stratum',
    'cn',
    'source_name',
    'expected_own_target_code',
    'shape_best_code',
    'qshape_best_code',
    'best_label_agrees',
    'shape_best_second_margin',
    'qshape_best_second_margin',
    'max_absolute_error',
    'median_absolute_error',
    'p95_absolute_error',
    'resolved_ranking_pairs',
    'discordant_ranking_pairs',
    'ranking_agreement_fraction',
    'failure_count',
    'pass'
];

const FAILURE_COLUMNS = [
    'failure_id',
    'case_id',
    'stratum',
    'cn',
    'gate',
    'target_code',
    'comparison_code',
    'observed',
    'threshold',
    'details'
];

function parseArguments(argv) {
    const options = {
        output: null,
        shapeExecutable: process.env.SHAPE_BIN || null,
        wslDistro: process.env.SHAPE_WSL_DISTRO || 'Ubuntu-22.04',
        expectedShapeSha256: process.env.SHAPE_EXPECTED_SHA256 || null,
        allowDirty: false
    };
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--output') options.output = argv[++index];
        else if (token === '--shape-executable') options.shapeExecutable = argv[++index];
        else if (token === '--wsl-distro') options.wslDistro = argv[++index];
        else if (token === '--expected-shape-sha256') {
            options.expectedShapeSha256 = argv[++index];
        } else if (token === '--allow-dirty') options.allowDirty = true;
        else if (token === '--help' || token === '-h') options.help = true;
        else throw new Error(`Unknown argument: ${token}`);
    }
    return options;
}

function usage() {
    return [
        'Usage:',
        '  node validation/scripts/run-direct-parity.cjs --output <new-directory>',
        '    --shape-executable </absolute/linux/path/to/shape_2.1_linux64>',
        '    [--wsl-distro Ubuntu-22.04]',
        '    [--expected-shape-sha256 <sha256>]',
        '',
        'The output directory must not already exist. The default run refuses a',
        'dirty Git worktree so that Q-Shape results are bound to a frozen commit.'
    ].join('\n');
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: options.maxBuffer || 128 * 1024 * 1024,
        windowsHide: true
    });
    if (result.error) throw result.error;
    if (!options.allowFailure && result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} exited ${result.status}\n${result.stderr || result.stdout}`
        );
    }
    return result;
}

function runWslShell(distro, command, allowFailure = false) {
    return run(
        'wsl.exe',
        ['-d', distro, '--', 'bash', '-lc', command],
        { allowFailure }
    );
}

function toWslPath(distro, windowsPath) {
    const result = run('wsl.exe', [
        '-d',
        distro,
        '--',
        'wslpath',
        '-a',
        path.resolve(windowsPath)
    ]);
    const converted = result.stdout.trim();
    if (!converted.startsWith('/')) {
        throw new Error(`wslpath returned an invalid path: ${converted}`);
    }
    return converted;
}

function writeText(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
}

function writeJson(filePath, value) {
    writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeTo(root, filePath) {
    return path.relative(root, filePath).replace(/\\/g, '/');
}

function chunk(values, size) {
    const chunks = [];
    for (let offset = 0; offset < values.length; offset += size) {
        chunks.push(values.slice(offset, offset + size));
    }
    return chunks;
}

function collectFiles(root, current = root) {
    const files = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles(root, fullPath));
        else if (entry.isFile()) files.push(fullPath);
    }
    return files;
}

function formatRuntime(milliseconds) {
    return Number(milliseconds).toFixed(6);
}

function qshapeValueToken(value) {
    return Number.isFinite(value) ? value.toPrecision(17) : String(value);
}

function parseOsRelease(text) {
    const result = {};
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (!match) continue;
        result[match[1]] = match[2].replace(/^"|"$/g, '');
    }
    return result;
}

function buildWorkingReport(summary, metadata) {
    const statusLabel = summary.status === 'pass' ? 'PASS' : 'FAIL';
    return [
        '# Direct SHAPE parity census — working report',
        '',
        'Status: working validation artifact; not a publication-ready table or a',
        'claim of chemical validity.',
        '',
        `Scientific gate status: **${statusLabel}**.`,
        '',
        `- Q-Shape commit: \`${metadata.qshape_commit}\`.`,
        `- SHAPE banner: \`${metadata.shape_banner}\`.`,
        `- SHAPE executable SHA-256: \`${metadata.shape_executable_sha256}\`.`,
        `- Cases: ${summary.totals.cases}.`,
        `- Pairwise CShM comparisons: ${summary.totals.comparisons_observed}.`,
        `- Failures retained in the ledger: ${summary.totals.failures}.`,
        `- Maximum absolute error: ${summary.totals.error_statistics.max ?? 'not_available'} CShM.`,
        `- Median absolute error: ${summary.totals.error_statistics.median ?? 'not_available'} CShM.`,
        `- P95 absolute error: ${summary.totals.error_statistics.p95 ?? 'not_available'} CShM.`,
        '',
        'The authoritative machine-readable results are `comparisons.csv`,',
        '`case-summary.csv`, `failure-ledger.csv`, and `summary.json`. Values in',
        'the CSV preserve the five-decimal SHAPE token and the full Q-Shape',
        'double-precision token separately.',
        '',
        'This census measures implementation agreement on the 11 retained fixtures',
        'and on ideal reference geometries shared with the implementation. It does',
        'not replace the preregistered perturbation family, external chemical',
        'holdout, browser workflow validation, or independent-user study.',
        ''
    ].join('\n');
}

function buildDataDictionary() {
    return {
        schema_version: 1,
        table_mode: 'working_tidy_data',
        publication_status: 'not_reviewed_not_publication_ready',
        quantities: {
            shape_token: {
                meaning: 'CShM printed by SHAPE .out',
                type: 'exact lexical decimal token',
                unit: 'dimensionless CShM',
                resolution: '0.00001'
            },
            qshape_full_precision: {
                meaning: 'Q-Shape JavaScript Number rendered with toPrecision(17)',
                type: 'IEEE-754 binary64 lexical round-trip token',
                unit: 'dimensionless CShM'
            },
            signed_error: {
                meaning: 'Q-Shape minus SHAPE',
                derivation: 'decimal subtraction of retained lexical tokens',
                unit: 'dimensionless CShM'
            },
            absolute_error: {
                meaning: 'absolute value of signed_error',
                derivation: 'decimal absolute value',
                unit: 'dimensionless CShM'
            },
            runtime_ms: {
                meaning: 'wall-clock time for one Q-Shape target evaluation',
                type: 'diagnostic only',
                unit: 'ms',
                claim_boundary: 'not used as a scientific acceptance gate'
            }
        },
        missingness: {
            empty_failure_ledger: 'zero observed failures; header remains present',
            not_applicable: 'quantity is mathematically undefined for the row',
            missing_result: 'explicit failure; never encoded as a blank numeric value'
        },
        gates: {
            pairwise_absolute_error: '<0.01 CShM',
            ideal_qshape_self: '<1e-8 CShM',
            ideal_shape_self: '<0.01 CShM',
            ranking_joint_tie_zone: '0.02001 CShM'
        }
    };
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
    }
    if (!options.output) throw new Error('--output is required');
    if (!options.shapeExecutable || !options.shapeExecutable.startsWith('/')) {
        throw new Error('--shape-executable must be an absolute Linux path');
    }
    const outputRoot = path.resolve(options.output);
    if (fs.existsSync(outputRoot)) {
        throw new Error(`Output directory already exists: ${outputRoot}`);
    }

    const gitStatus = run('git', ['status', '--porcelain']).stdout.trim();
    if (gitStatus && !options.allowDirty) {
        throw new Error(
            'Git worktree is dirty. Commit the runner and candidate before validation.'
        );
    }
    const qshapeCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
    const qshapeBranch = run('git', ['branch', '--show-current']).stdout.trim();

    fs.mkdirSync(outputRoot, { recursive: false });
    const inputFixtureRoot = path.join(outputRoot, 'inputs', 'fixtures');
    const oracleMetadataRoot = path.join(outputRoot, 'oracle', 'metadata');
    const oracleRawRoot = path.join(outputRoot, 'oracle', 'raw');
    const qshapeRoot = path.join(outputRoot, 'qshape');
    const reportRoot = path.join(outputRoot, 'reports');
    const metadataRoot = path.join(outputRoot, 'metadata');
    for (const directory of [
        inputFixtureRoot,
        oracleMetadataRoot,
        oracleRawRoot,
        qshapeRoot,
        reportRoot,
        metadataRoot
    ]) {
        fs.mkdirSync(directory, { recursive: true });
    }

    const { referenceGeometries, calculateShapeMeasure } = loadQShape(REPO_ROOT);
    const inventory = buildReferenceInventory(referenceGeometries);

    const referenceListings = [];
    for (const item of inventory) {
        const command = [
            'export LC_ALL=C LANG=C TZ=UTC',
            `${shellQuote(options.shapeExecutable)} +${item.cn}`
        ].join('\n');
        const listingRun = runWslShell(options.wslDistro, command);
        const listingPath = path.join(
            oracleMetadataRoot,
            `references-cn${String(item.cn).padStart(2, '0')}.stdout.txt`
        );
        writeText(listingPath, listingRun.stdout);
        const parsed = parseShapeReferenceListing(listingRun.stdout, item.cn);
        if (parsed.references.length !== item.count) {
            throw new Error(
                `SHAPE listed ${parsed.references.length} references for CN=${item.cn}; expected ${item.count}`
            );
        }
        for (const target of item.targets) {
            const official = parsed.references.find(entry => entry.index === target.index);
            if (!official) {
                throw new Error(`SHAPE omitted CN=${item.cn} reference index ${target.index}`);
            }
            target.shapeCode = official.shapeCode;
            target.shapePointGroup = official.pointGroup;
            target.shapeDescription = official.description;
        }
        referenceListings.push({
            cn: item.cn,
            rawPath: relativeTo(outputRoot, listingPath),
            references: parsed.references
        });
    }

    const fixtureCases = buildFixtureCases(REPO_ROOT, inventory);
    const idealCases = buildIdealCases(inventory);
    const cases = [...fixtureCases, ...idealCases].sort(
        (a, b) => a.cn - b.cn || a.stratum.localeCompare(b.stratum) ||
            a.caseId.localeCompare(b.caseId)
    );
    if (fixtureCases.length !== 11 || idealCases.length !== 87 || cases.length !== 98) {
        throw new Error(
            `Unexpected case inventory: ${fixtureCases.length} fixtures, ${idealCases.length} ideals`
        );
    }
    const structureIds = new Set(cases.map(item => item.structureId));
    if (structureIds.size !== cases.length) {
        throw new Error('Structure IDs are not unique');
    }

    for (const item of fixtureCases) {
        fs.copyFileSync(
            path.resolve(REPO_ROOT, item.sourceFile),
            path.join(inputFixtureRoot, path.basename(item.sourceFile))
        );
    }

    writeJson(path.join(outputRoot, 'references.json'), {
        schema_version: 1,
        source_file: 'src/constants/referenceGeometries/index.js',
        source_sha256: sha256File(path.join(
            REPO_ROOT,
            'src/constants/referenceGeometries/index.js'
        )),
        coordinate_policy: 'CN ligands followed by center; generated SHAPE inputs retain 15 decimal places',
        count: 87,
        by_cn: inventory.map(item => ({
            cn: item.cn,
            count: item.count,
            references: item.targets.map(target => ({
                reference_id: `cn${String(item.cn).padStart(2, '0')}-r${String(target.index).padStart(2, '0')}`,
                index: target.index,
                qshape_code: target.code,
                qshape_name: target.name,
                shape_code: target.shapeCode,
                shape_point_group: target.shapePointGroup,
                shape_description: target.shapeDescription,
                center_index_zero_based: item.cn,
                coordinate_tokens: target.coordinates.map(point => point.map(formatCoordinate))
            }))
        }))
    });

    writeJson(path.join(outputRoot, 'cases.json'), {
        schema_version: 1,
        count: cases.length,
        strata: {
            retained_fixture: fixtureCases.length,
            ideal_reference: idealCases.length
        },
        cases: cases.map(item => ({
            case_id: item.caseId,
            structure_id: item.structureId,
            stratum: item.stratum,
            cn: item.cn,
            source_name: item.sourceName,
            source_file: item.sourceFile,
            source_sha256: item.sourceSha256 ?? null,
            expected_own_target_code: item.expectedOwnTargetCode,
            center_original: item.centerOriginal,
            actual_ligands_center_relative: item.actualLigands
        }))
    });

    const metadataCommands = {
        'shape-help.txt': `${shellQuote(options.shapeExecutable)} -h`,
        'shape-list-all.txt': `${shellQuote(options.shapeExecutable)} +`,
        'shape-file.txt': `file ${shellQuote(options.shapeExecutable)}`,
        'shape-ldd.txt': `ldd ${shellQuote(options.shapeExecutable)}`,
        'shape-sha256.txt': `sha256sum ${shellQuote(options.shapeExecutable)}`,
        'uname.txt': 'uname -a',
        'os-release.txt': 'cat /etc/os-release'
    };
    const metadataOutputs = {};
    for (const [name, command] of Object.entries(metadataCommands)) {
        const result = runWslShell(
            options.wslDistro,
            `export LC_ALL=C LANG=C TZ=UTC\n${command}`,
            true
        );
        const combined = `${result.stdout}${result.stderr}`;
        writeText(path.join(oracleMetadataRoot, name), combined);
        metadataOutputs[name] = combined;
    }
    const shapeShaMatch = metadataOutputs['shape-sha256.txt'].match(/^([a-fA-F0-9]{64})\s/m);
    if (!shapeShaMatch) throw new Error('Could not parse SHAPE executable SHA-256');
    const shapeExecutableSha256 = shapeShaMatch[1].toLowerCase();
    if (
        options.expectedShapeSha256 &&
        shapeExecutableSha256 !== options.expectedShapeSha256.toLowerCase()
    ) {
        throw new Error(
            `SHAPE executable hash ${shapeExecutableSha256} does not match expected ${options.expectedShapeSha256}`
        );
    }

    const oracleRawWsl = toWslPath(options.wslDistro, oracleRawRoot);
    const caseByStructureId = new Map(cases.map(item => [item.structureId, item]));
    const shapeRows = [];
    const oracleRepeatability = [];
    const additionalFailures = [];

    for (const item of inventory) {
        const cnCases = cases.filter(caseItem => caseItem.cn === item.cn);
        const targetBatches = chunk(item.targets, MAX_SHAPE_REFERENCES_PER_CONTROL);
        for (let batchIndex = 0; batchIndex < targetBatches.length; batchIndex++) {
            const targetBatch = targetBatches[batchIndex];
            const parsedReplicates = [];
            const replicateFiles = [];
            for (let replicate = 1; replicate <= SHAPE_REPETITIONS; replicate++) {
                const stem = `cn${String(item.cn).padStart(2, '0')}-b${String(batchIndex + 1).padStart(2, '0')}-r${replicate}`;
                const datPath = path.join(oracleRawRoot, `${stem}.dat`);
                writeText(datPath, buildShapeDat(item.cn, cnCases, targetBatch));
                const command = [
                    'set -o pipefail',
                    'export LC_ALL=C LANG=C TZ=UTC',
                    `cd ${shellQuote(oracleRawWsl)}`,
                    `timeout -k 30s 1800s ${shellQuote(options.shapeExecutable)} ${shellQuote(`${stem}.dat`)}`
                ].join('\n');
                const result = runWslShell(options.wslDistro, command, true);
                const stdoutPath = path.join(oracleRawRoot, `${stem}.stdout.txt`);
                const stderrPath = path.join(oracleRawRoot, `${stem}.stderr.txt`);
                const exitCodePath = path.join(oracleRawRoot, `${stem}.exit-code.txt`);
                writeText(stdoutPath, result.stdout);
                writeText(stderrPath, result.stderr);
                writeText(exitCodePath, `${result.status}\n`);
                const outPath = path.join(oracleRawRoot, `${stem}.out`);
                const tabPath = path.join(oracleRawRoot, `${stem}.tab`);
                if (result.status !== 0 || !fs.existsSync(outPath) || !fs.existsSync(tabPath)) {
                    throw new Error(
                        `SHAPE failed for ${stem}: exit=${result.status}, out=${fs.existsSync(outPath)}, tab=${fs.existsSync(tabPath)}`
                    );
                }
                const parsed = parseShapeOut(fs.readFileSync(outPath, 'utf8'));
                if (parsed.length !== cnCases.length) {
                    throw new Error(
                        `${stem} returned ${parsed.length} structures; expected ${cnCases.length}`
                    );
                }
                const targetByShapeCode = new Map(
                    targetBatch.map(target => [target.shapeCode, target])
                );
                const normalizedRows = [];
                for (const structure of parsed) {
                    const caseItem = caseByStructureId.get(structure.structureId);
                    if (!caseItem || caseItem.cn !== item.cn) {
                        throw new Error(`${stem} returned unknown structure ${structure.structureId}`);
                    }
                    if (structure.values.length !== targetBatch.length) {
                        throw new Error(
                            `${stem}/${structure.structureId} returned ${structure.values.length} values; expected ${targetBatch.length}`
                        );
                    }
                    for (const value of structure.values) {
                        const target = targetByShapeCode.get(value.targetCode);
                        if (!target) {
                            throw new Error(
                                `${stem} returned unexpected SHAPE code ${value.targetCode}`
                            );
                        }
                        normalizedRows.push({
                            caseId: caseItem.caseId,
                            targetCode: target.code,
                            shapeCode: target.shapeCode,
                            targetIndex: target.index,
                            valueToken: value.valueToken,
                            rawPath: relativeTo(outputRoot, outPath),
                            replicate
                        });
                    }
                }
                parsedReplicates.push(normalizedRows);
                replicateFiles.push({
                    replicate,
                    dat: relativeTo(outputRoot, datPath),
                    out: relativeTo(outputRoot, outPath),
                    tab: relativeTo(outputRoot, tabPath),
                    stdout: relativeTo(outputRoot, stdoutPath),
                    stderr: relativeTo(outputRoot, stderrPath),
                    exit_code: result.status,
                    dat_sha256: sha256File(datPath),
                    out_sha256: sha256File(outPath),
                    tab_sha256: sha256File(tabPath)
                });
            }
            const primary = parsedReplicates[0];
            const repeated = parsedReplicates[1];
            const primaryByPair = new Map(primary.map(row => [
                `${row.caseId}:${row.targetCode}`,
                row.valueToken
            ]));
            const mismatches = repeated.filter(row =>
                primaryByPair.get(`${row.caseId}:${row.targetCode}`) !== row.valueToken
            );
            if (mismatches.length > 0) {
                for (const mismatch of mismatches) {
                    additionalFailures.push({
                        caseId: mismatch.caseId,
                        gate: 'shape_repeatability',
                        targetCode: mismatch.targetCode,
                        observed: `rep1=${primaryByPair.get(`${mismatch.caseId}:${mismatch.targetCode}`)}; rep2=${mismatch.valueToken}`,
                        threshold: 'identical five-decimal CShM token',
                        details: 'Two clean SHAPE executions disagreed.'
                    });
                }
            }
            oracleRepeatability.push({
                cn: item.cn,
                batch: batchIndex + 1,
                target_indices: targetBatch.map(target => target.index),
                target_shape_codes: targetBatch.map(target => target.shapeCode),
                comparison_count: primary.length,
                value_token_mismatches: mismatches.length,
                out_files_byte_identical:
                    replicateFiles[0].out_sha256 === replicateFiles[1].out_sha256,
                tab_files_byte_identical:
                    replicateFiles[0].tab_sha256 === replicateFiles[1].tab_sha256,
                files: replicateFiles
            });
            shapeRows.push(...primary);
            process.stdout.write(
                `SHAPE CN=${item.cn} batch=${batchIndex + 1}/${targetBatches.length}: ${primary.length} values\n`
            );
        }
    }

    const expectedComparisons = cases.reduce((sum, item) =>
        sum + inventory.find(entry => entry.cn === item.cn).count,
    0);
    if (expectedComparisons !== 952 || shapeRows.length !== expectedComparisons) {
        throw new Error(
            `Oracle comparison count ${shapeRows.length}; expected ${expectedComparisons} (canonical target 952)`
        );
    }
    writeJson(path.join(outputRoot, 'oracle', 'parsed-results.json'), {
        schema_version: 1,
        source: 'SHAPE .out, five-decimal CShM tokens',
        count: shapeRows.length,
        results: shapeRows
    });
    writeJson(path.join(outputRoot, 'oracle', 'repeatability.json'), {
        schema_version: 1,
        repetitions: SHAPE_REPETITIONS,
        batches: oracleRepeatability,
        total_value_token_mismatches: oracleRepeatability.reduce(
            (sum, item) => sum + item.value_token_mismatches,
            0
        )
    });

    const qshapeAllRows = [];
    const qshapePrimaryRows = [];
    const qshapePrimaryByPair = new Map();
    const qshapeRepeatabilityMismatches = [];
    for (let replicate = 1; replicate <= QSHAPE_REPETITIONS; replicate++) {
        for (const item of cases) {
            const targets = inventory.find(entry => entry.cn === item.cn).targets;
            for (const target of targets) {
                const started = performance.now();
                const result = calculateShapeMeasure(
                    item.actualLigands,
                    target.coordinates,
                    'default'
                );
                const elapsed = performance.now() - started;
                const row = {
                    caseId: item.caseId,
                    targetCode: target.code,
                    valueToken: qshapeValueToken(result.measure),
                    runtimeMsToken: formatRuntime(elapsed),
                    mode: 'default',
                    replicate
                };
                qshapeAllRows.push(row);
                const pairKey = `${item.caseId}:${target.code}`;
                if (replicate === 1) {
                    qshapePrimaryRows.push(row);
                    qshapePrimaryByPair.set(pairKey, row.valueToken);
                } else if (qshapePrimaryByPair.get(pairKey) !== row.valueToken) {
                    qshapeRepeatabilityMismatches.push({
                        caseId: item.caseId,
                        targetCode: target.code,
                        primary: qshapePrimaryByPair.get(pairKey),
                        repeated: row.valueToken
                    });
                }
            }
        }
        process.stdout.write(
            `Q-Shape replicate ${replicate}/${QSHAPE_REPETITIONS}: ${expectedComparisons} values\n`
        );
    }
    for (const mismatch of qshapeRepeatabilityMismatches) {
        additionalFailures.push({
            caseId: mismatch.caseId,
            gate: 'qshape_repeatability',
            targetCode: mismatch.targetCode,
            observed: `rep1=${mismatch.primary}; rep2=${mismatch.repeated}`,
            threshold: 'bitwise-identical JavaScript Number token',
            details: 'Repeated default-mode Q-Shape calculations disagreed.'
        });
    }
    writeJson(path.join(qshapeRoot, 'results.json'), {
        schema_version: 1,
        mode: 'default',
        repetitions: QSHAPE_REPETITIONS,
        count: qshapeAllRows.length,
        results: qshapeAllRows
    });
    writeJson(path.join(qshapeRoot, 'repeatability.json'), {
        schema_version: 1,
        comparisons_per_repetition: expectedComparisons,
        mismatch_count: qshapeRepeatabilityMismatches.length,
        mismatches: qshapeRepeatabilityMismatches
    });

    const analysis = analyzeDirectParity({
        cases,
        inventory,
        shapeRows,
        qshapeRows: qshapePrimaryRows,
        additionalFailures
    });
    writeJson(path.join(reportRoot, 'summary.json'), analysis.summary);
    writeText(
        path.join(reportRoot, 'comparisons.csv'),
        rowsToCsv(COMPARISON_COLUMNS, analysis.comparisonRows)
    );
    writeText(
        path.join(reportRoot, 'case-summary.csv'),
        rowsToCsv(CASE_SUMMARY_COLUMNS, analysis.caseSummaryRows)
    );
    writeText(
        path.join(reportRoot, 'failure-ledger.csv'),
        rowsToCsv(FAILURE_COLUMNS, analysis.failures)
    );
    writeJson(path.join(metadataRoot, 'data-dictionary.json'), buildDataDictionary());

    const osRelease = parseOsRelease(metadataOutputs['os-release.txt']);
    const shapeBannerMatch = metadataOutputs['shape-help.txt'].match(/S H A P E\s+v([\d.]+)/);
    const runMetadata = {
        schema_version: 1,
        generated_at_utc: new Date().toISOString(),
        qshape_commit: qshapeCommit,
        qshape_branch: qshapeBranch,
        qshape_worktree_clean_before_run: gitStatus === '',
        node_version: process.version,
        node_platform: process.platform,
        node_arch: process.arch,
        package_lock_sha256: sha256File(path.join(REPO_ROOT, 'package-lock.json')),
        reference_source_sha256: sha256File(path.join(
            REPO_ROOT,
            'src/constants/referenceGeometries/index.js'
        )),
        shape_banner: shapeBannerMatch ? `SHAPE v${shapeBannerMatch[1]}` : 'SHAPE version banner not parsed',
        shape_executable_basename: path.posix.basename(options.shapeExecutable),
        shape_executable_sha256: shapeExecutableSha256,
        shape_executable_redistributed: false,
        shape_license_status: 'third-party executable; no license file identified in the audited local installation',
        wsl_registered_distro_name: options.wslDistro,
        wsl_guest_os_pretty_name: osRelease.PRETTY_NAME || 'not_parsed',
        locale: 'C',
        timezone: 'UTC',
        qshape_mode: 'default',
        qshape_repetitions: QSHAPE_REPETITIONS,
        shape_repetitions: SHAPE_REPETITIONS,
        max_shape_references_per_control: MAX_SHAPE_REFERENCES_PER_CONTROL,
        reference_listings: referenceListings
    };
    writeJson(path.join(metadataRoot, 'run-environment.json'), runMetadata);
    writeText(
        path.join(reportRoot, 'working-report.md'),
        buildWorkingReport(analysis.summary, runMetadata)
    );

    const filesForManifest = collectFiles(outputRoot)
        .filter(filePath => !['manifest.json', 'manifest.sha256'].includes(path.basename(filePath)))
        .sort((a, b) => relativeTo(outputRoot, a).localeCompare(relativeTo(outputRoot, b)))
        .map(filePath => ({
            path: relativeTo(outputRoot, filePath),
            size_bytes: fs.statSync(filePath).size,
            sha256: sha256File(filePath)
        }));
    const manifest = {
        schema_version: 1,
        release_kind: 'direct_canonical_plus_retained_fixtures',
        scientific_status: analysis.summary.status,
        claim_boundary: 'implementation agreement on retained fixtures and shared ideal references; not external chemical validity',
        generated_at_utc: runMetadata.generated_at_utc,
        qshape_commit: qshapeCommit,
        shape_executable_sha256: shapeExecutableSha256,
        expected_counts: {
            reference_geometries: 87,
            retained_fixture_cases: 11,
            ideal_reference_cases: 87,
            total_cases: 98,
            pairwise_comparisons_per_program: 952,
            qshape_raw_rows_with_repetitions: 1904,
            shape_batches: 15,
            shape_runs_with_repetitions: 30
        },
        observed_counts: {
            reference_geometries: 87,
            retained_fixture_cases: fixtureCases.length,
            ideal_reference_cases: idealCases.length,
            total_cases: cases.length,
            pairwise_comparisons_per_program: analysis.summary.totals.comparisons_observed,
            qshape_raw_rows_with_repetitions: qshapeAllRows.length,
            shape_batches: oracleRepeatability.length,
            shape_runs_with_repetitions: oracleRepeatability.length * SHAPE_REPETITIONS,
            failures: analysis.failures.length
        },
        files: filesForManifest
    };
    const manifestPath = path.join(outputRoot, 'manifest.json');
    writeJson(manifestPath, manifest);
    writeText(
        path.join(outputRoot, 'manifest.sha256'),
        `${sha256File(manifestPath)}  manifest.json\n`
    );

    process.stdout.write(
        `Direct parity release written to ${outputRoot}\n` +
        `Scientific status: ${analysis.summary.status.toUpperCase()}\n` +
        `Cases: ${cases.length}; comparisons: ${analysis.summary.totals.comparisons_observed}; failures: ${analysis.failures.length}\n`
    );
    if (analysis.summary.status !== 'pass') {
        process.exitCode = 2;
    }
}

try {
    main();
} catch (error) {
    process.stderr.write(`Direct parity run failed: ${error.stack || error.message}\n`);
    process.exitCode = 1;
}

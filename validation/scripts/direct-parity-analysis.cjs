'use strict';

const crypto = require('crypto');
const Decimal = require('decimal.js');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

const ABS_ERROR_GATE = new Decimal('0.01');
const IDEAL_SELF_GATE = new Decimal('1e-8');
const RANKING_RESOLUTION = new Decimal('0.02001');
const MAX_CSHM = new Decimal('100');
const PAIR_SEPARATOR = '\u0000';

function decimalToken(value) {
    return value instanceof Decimal ? value.toSignificantDigits(18).toString() : '';
}

function finiteDecimal(token) {
    if (typeof token !== 'string' && typeof token !== 'number') return null;
    const text = String(token);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(text)) return null;
    const value = new Decimal(text);
    return value.isFinite() ? value : null;
}

function median(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a.comparedTo(b));
    const midpoint = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[midpoint];
    return sorted[midpoint - 1].plus(sorted[midpoint]).dividedBy(2);
}

function nearestRank(values, probability) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a.comparedTo(b));
    const rank = Math.max(1, Math.ceil(probability * sorted.length));
    return sorted[rank - 1];
}

function stats(values) {
    if (values.length === 0) {
        return { count: 0, mean: null, median: null, p95: null, p99: null, max: null };
    }
    const sum = values.reduce((accumulator, value) => accumulator.plus(value), new Decimal(0));
    const maximum = values.reduce((current, value) => Decimal.max(current, value));
    return {
        count: values.length,
        mean: decimalToken(sum.dividedBy(values.length)),
        median: decimalToken(median(values)),
        p95: decimalToken(nearestRank(values, 0.95)),
        p99: decimalToken(nearestRank(values, 0.99)),
        max: decimalToken(maximum)
    };
}

function errorStatistics(signedErrors) {
    if (signedErrors.length === 0) {
        return {
            count: 0,
            signed_bias: null,
            mean_absolute_error: null,
            root_mean_square_error: null,
            median_absolute_error: null,
            p95_absolute_error: null,
            p99_absolute_error: null,
            max_absolute_error: null
        };
    }
    const absoluteErrors = signedErrors.map(value => value.abs());
    const signedSum = signedErrors.reduce(
        (accumulator, value) => accumulator.plus(value),
        new Decimal(0)
    );
    const absoluteSum = absoluteErrors.reduce(
        (accumulator, value) => accumulator.plus(value),
        new Decimal(0)
    );
    const squaredSum = signedErrors.reduce(
        (accumulator, value) => accumulator.plus(value.times(value)),
        new Decimal(0)
    );
    const absoluteStats = stats(absoluteErrors);
    return {
        count: signedErrors.length,
        signed_bias: decimalToken(signedSum.dividedBy(signedErrors.length)),
        mean_absolute_error: decimalToken(absoluteSum.dividedBy(signedErrors.length)),
        root_mean_square_error: decimalToken(squaredSum.dividedBy(signedErrors.length).sqrt()),
        median_absolute_error: absoluteStats.median,
        p95_absolute_error: absoluteStats.p95,
        p99_absolute_error: absoluteStats.p99,
        max_absolute_error: absoluteStats.max
    };
}

function pairKey(caseId, targetCode) {
    return `${caseId}${PAIR_SEPARATOR}${targetCode}`;
}

function buildExpectedPairs(cases, inventory) {
    const caseIds = new Set();
    const inventoryByCn = new Map();
    for (const item of inventory) {
        if (inventoryByCn.has(item.cn)) {
            throw new Error(`Duplicate reference inventory for CN=${item.cn}`);
        }
        const targetCodes = new Set();
        for (const target of item.targets) {
            if (targetCodes.has(target.code)) {
                throw new Error(`Duplicate target code ${target.code} for CN=${item.cn}`);
            }
            targetCodes.add(target.code);
        }
        if (targetCodes.size !== item.count) {
            throw new Error(`Reference count mismatch for CN=${item.cn}`);
        }
        inventoryByCn.set(item.cn, item);
    }

    const expectedPairs = new Map();
    for (const item of cases) {
        if (caseIds.has(item.caseId)) throw new Error(`Duplicate case ID: ${item.caseId}`);
        caseIds.add(item.caseId);
        const cnInventory = inventoryByCn.get(item.cn);
        if (!cnInventory) {
            throw new Error(`No reference inventory for ${item.caseId} CN=${item.cn}`);
        }
        for (const target of cnInventory.targets) {
            expectedPairs.set(pairKey(item.caseId, target.code), { caseItem: item, target });
        }
    }
    return { expectedPairs, inventoryByCn };
}

function validatePrimaryRows(program, rows, expectedPairs) {
    if (!Array.isArray(rows)) throw new Error(`${program} rows are not an array`);
    const byPair = new Map();
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const key = pairKey(row?.caseId, row?.targetCode);
        if (!expectedPairs.has(key)) {
            throw new Error(
                `${program} row ${index + 1} references unknown pair ` +
                `${row?.caseId}/${row?.targetCode}`
            );
        }
        if (byPair.has(key)) {
            throw new Error(`${program} contains duplicate pair ${row.caseId}/${row.targetCode}`);
        }
        if (typeof row.valueToken !== 'string') {
            throw new Error(`${program} ${row.caseId}/${row.targetCode} lacks a lexical value token`);
        }
        byPair.set(key, row);
    }
    if (byPair.size !== expectedPairs.size) {
        const missing = [...expectedPairs.keys()]
            .filter(key => !byPair.has(key))
            .slice(0, 5)
            .map(key => key.replace(PAIR_SEPARATOR, '/'));
        throw new Error(
            `${program} contains ${byPair.size} unique pairs; expected ${expectedPairs.size}. ` +
            `Missing: ${missing.join(', ')}`
        );
    }
    return byPair;
}

function stableFailureId(failure, duplicateIndex = 0) {
    const payload = [
        failure.case_id,
        failure.gate,
        failure.target_code,
        failure.comparison_code,
        failure.observed,
        failure.threshold,
        failure.details
    ].join('\u001f');
    const digest = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
    return duplicateIndex === 0 ? `failure-${digest}` : `failure-${digest}-${duplicateIndex + 1}`;
}

function gammaAwareKendallTauB(rows) {
    let concordant = 0;
    let discordant = 0;
    let shapeOnlyTies = 0;
    let qshapeOnlyTies = 0;
    let jointTies = 0;
    for (let left = 0; left < rows.length; left++) {
        for (let right = left + 1; right < rows.length; right++) {
            const shapeDelta = rows[left].shape.minus(rows[right].shape);
            const qshapeDelta = rows[left].qshape.minus(rows[right].qshape);
            const shapeTie = shapeDelta.abs().lte(RANKING_RESOLUTION);
            const qshapeTie = qshapeDelta.abs().lte(RANKING_RESOLUTION);
            if (shapeTie && qshapeTie) jointTies += 1;
            else if (shapeTie) shapeOnlyTies += 1;
            else if (qshapeTie) qshapeOnlyTies += 1;
            else if (shapeDelta.times(qshapeDelta).gt(0)) concordant += 1;
            else discordant += 1;
        }
    }
    const denominatorSquared =
        (concordant + discordant + shapeOnlyTies) *
        (concordant + discordant + qshapeOnlyTies);
    return {
        tau_b: denominatorSquared === 0
            ? null
            : new Decimal(concordant - discordant)
                .dividedBy(new Decimal(denominatorSquared).sqrt())
                .toSignificantDigits(18)
                .toString(),
        concordant,
        discordant,
        shape_only_ties: shapeOnlyTies,
        qshape_only_ties: qshapeOnlyTies,
        joint_ties: jointTies
    };
}

function analyzeDirectParity({ cases, inventory, shapeRows, qshapeRows, additionalFailures = [] }) {
    const { expectedPairs, inventoryByCn } = buildExpectedPairs(cases, inventory);
    const caseById = new Map(cases.map(item => [item.caseId, item]));
    const shapeByPair = validatePrimaryRows('SHAPE', shapeRows, expectedPairs);
    const qshapeByPair = validatePrimaryRows('Q-Shape', qshapeRows, expectedPairs);

    const failures = [];
    const comparisonRows = [];
    const addFailure = (item, gate, fields = {}) => {
        failures.push({
            failure_id: '',
            case_id: item.caseId,
            stratum: item.stratum,
            cn: item.cn,
            gate,
            target_code: fields.targetCode ?? '',
            comparison_code: fields.comparisonCode ?? '',
            observed: fields.observed ?? '',
            threshold: fields.threshold ?? '',
            details: fields.details ?? '',
            shape_raw_path: fields.shapeRawPath ?? '',
            qshape_raw_path: fields.qshapeRawPath ?? '',
            severity: fields.severity ?? 'gate_failure',
            status: 'fail'
        });
    };

    for (const failure of additionalFailures) {
        const item = caseById.get(failure.caseId);
        if (!item) throw new Error(`Additional failure references unknown case ${failure.caseId}`);
        addFailure(item, failure.gate, failure);
    }

    for (const item of cases) {
        const cnInventory = inventoryByCn.get(item.cn);
        for (const target of cnInventory.targets) {
            const key = pairKey(item.caseId, target.code);
            const shape = shapeByPair.get(key);
            const qshape = qshapeByPair.get(key);
            const shapeValue = finiteDecimal(shape.valueToken);
            const qshapeValue = finiteDecimal(qshape.valueToken);
            const shapeLexicallyValid = shape.lexicallyValid !== false;
            const qshapeLexicallyValid = qshape.lexicallyValid !== false;
            const domainValid = Boolean(
                shapeLexicallyValid && qshapeLexicallyValid && shapeValue && qshapeValue &&
                shapeValue.gte(0) && qshapeValue.gte(0) &&
                shapeValue.lte(MAX_CSHM) && qshapeValue.lte(MAX_CSHM)
            );

            if (!shapeLexicallyValid) {
                addFailure(item, 'shape_lexical_token', {
                    targetCode: target.code,
                    observed: shape.valueToken,
                    threshold: 'non-negative fixed decimal with exactly five fractional digits',
                    details: `Invalid SHAPE .out CShM token at line ${shape.rawLineNumber ?? 'unknown'}`,
                    shapeRawPath: shape.rawPath
                });
            }
            if (!qshapeLexicallyValid || !qshapeValue) {
                addFailure(item, 'qshape_lexical_token', {
                    targetCode: target.code,
                    observed: qshape.valueToken,
                    threshold: 'finite IEEE-754 binary64 round-trip decimal token',
                    qshapeRawPath: qshape.rawPath
                });
            }
            if (shapeLexicallyValid && !shapeValue) {
                addFailure(item, 'shape_nonfinite_result', {
                    targetCode: target.code,
                    observed: shape.valueToken,
                    shapeRawPath: shape.rawPath
                });
            }
            if (shapeValue && shapeValue.lt(0)) {
                addFailure(item, 'shape_negative_cshm', {
                    targetCode: target.code,
                    observed: shape.valueToken,
                    threshold: '>=0 CShM',
                    shapeRawPath: shape.rawPath
                });
            }
            if (qshapeValue && qshapeValue.lt(0)) {
                addFailure(item, 'qshape_negative_cshm', {
                    targetCode: target.code,
                    observed: qshape.valueToken,
                    threshold: '>=0 CShM',
                    qshapeRawPath: qshape.rawPath
                });
            }
            if (shapeValue && shapeValue.gt(MAX_CSHM)) {
                addFailure(item, 'shape_cshm_above_100', {
                    targetCode: target.code,
                    observed: shape.valueToken,
                    threshold: '<=100 CShM',
                    shapeRawPath: shape.rawPath
                });
            }
            if (qshapeValue && qshapeValue.gt(MAX_CSHM)) {
                addFailure(item, 'qshape_cshm_above_100', {
                    targetCode: target.code,
                    observed: qshape.valueToken,
                    threshold: '<=100 CShM',
                    qshapeRawPath: qshape.rawPath
                });
            }

            const signedError = domainValid ? qshapeValue.minus(shapeValue) : null;
            const absoluteError = signedError ? signedError.abs() : null;
            const passesAbsoluteError = Boolean(absoluteError && absoluteError.lt(ABS_ERROR_GATE));
            comparisonRows.push({
                case_id: item.caseId,
                stratum: item.stratum,
                cn: item.cn,
                source_name: item.sourceName,
                target_code: target.code,
                target_name: target.name,
                shape_code: shape.shapeCode ?? target.shapeCode ?? target.code,
                shape_token: shape.valueToken,
                qshape_full_precision: qshape.valueToken,
                qshape_float64_hex: qshape.valueHex ?? '',
                qshape_display_5dp: qshapeValue && qshapeValue.gte(0) ? qshapeValue.toFixed(5) : '',
                signed_error: signedError ? decimalToken(signedError) : '',
                absolute_error: absoluteError ? decimalToken(absoluteError) : '',
                result_domain_valid: domainValid,
                pass_abs_0_01: passesAbsoluteError,
                runtime_ms: qshape.runtimeMsToken ?? '',
                qshape_seed_policy: qshape.seedPolicy ?? '',
                qshape_explicit_seed_uint32: qshape.explicitSeed ?? '',
                shape_raw_path: shape.rawPath ?? '',
                qshape_raw_path: qshape.rawPath ?? ''
            });
            if (domainValid && !passesAbsoluteError) {
                addFailure(item, 'absolute_error', {
                    targetCode: target.code,
                    observed: decimalToken(absoluteError),
                    threshold: '<0.01 CShM',
                    details: `Q-Shape ${qshape.valueToken}; SHAPE ${shape.valueToken}`,
                    shapeRawPath: shape.rawPath,
                    qshapeRawPath: qshape.rawPath
                });
            }
        }
    }

    const caseSummaryRows = [];
    for (const item of cases) {
        const rows = comparisonRows.filter(row => row.case_id === item.caseId);
        const finiteRows = rows.map(row => ({
            row,
            shape: finiteDecimal(row.shape_token),
            qshape: finiteDecimal(row.qshape_full_precision),
            signedError: finiteDecimal(row.signed_error),
            absoluteError: finiteDecimal(row.absolute_error)
        })).filter(entry =>
            entry.row.result_domain_valid && entry.shape && entry.qshape &&
            entry.signedError && entry.absoluteError
        );

        const shapeOrder = [...finiteRows].sort((a, b) =>
            a.shape.comparedTo(b.shape) || a.row.target_code.localeCompare(b.row.target_code)
        );
        const qshapeOrder = [...finiteRows].sort((a, b) =>
            a.qshape.comparedTo(b.qshape) || a.row.target_code.localeCompare(b.row.target_code)
        );
        const shapeBest = shapeOrder[0]?.row.target_code ?? '';
        const qshapeBest = qshapeOrder[0]?.row.target_code ?? '';
        const shapeMinimum = shapeOrder[0]?.shape ?? null;
        const shapeTieSet = shapeMinimum
            ? shapeOrder.filter(entry => entry.shape.minus(shapeMinimum).lte(RANKING_RESOLUTION))
                .map(entry => entry.row.target_code)
            : [];
        const qshapeTieSet = qshapeOrder.length > 0
            ? qshapeOrder.filter(entry =>
                entry.qshape.minus(qshapeOrder[0].qshape).lte(RANKING_RESOLUTION)
            ).map(entry => entry.row.target_code)
            : [];
        const shapeMargin = shapeOrder.length > 1
            ? shapeOrder[1].shape.minus(shapeOrder[0].shape)
            : null;
        const qshapeMargin = qshapeOrder.length > 1
            ? qshapeOrder[1].qshape.minus(qshapeOrder[0].qshape)
            : null;
        const exactBestAgreement = shapeBest !== '' && shapeBest === qshapeBest;
        const qshapeBestWithinShapeTieSet = qshapeBest !== '' && shapeTieSet.includes(qshapeBest);
        if (finiteRows.length > 0 && !qshapeBestWithinShapeTieSet) {
            addFailure(item, 'best_geometry_outside_shape_tie_set', {
                targetCode: qshapeBest,
                comparisonCode: shapeBest,
                observed: `SHAPE tie set=${shapeTieSet.join('|')}; Q-Shape best=${qshapeBest}`,
                threshold: `Q-Shape best must be within ${RANKING_RESOLUTION.toString()} CShM of SHAPE minimum`,
                details: `SHAPE minimum ${decimalToken(shapeMinimum)}`,
                shapeRawPath: shapeOrder[0]?.row.shape_raw_path,
                qshapeRawPath: qshapeOrder[0]?.row.qshape_raw_path
            });
        }

        let resolvedPairs = 0;
        let discordantPairs = 0;
        for (let left = 0; left < finiteRows.length; left++) {
            for (let right = left + 1; right < finiteRows.length; right++) {
                const first = finiteRows[left];
                const second = finiteRows[right];
                const shapeDelta = first.shape.minus(second.shape);
                if (shapeDelta.abs().lte(RANKING_RESOLUTION)) continue;
                resolvedPairs += 1;
                const qshapeDelta = first.qshape.minus(second.qshape);
                if (shapeDelta.times(qshapeDelta).lte(0)) {
                    discordantPairs += 1;
                    addFailure(item, 'ranking_loss_or_inversion', {
                        targetCode: first.row.target_code,
                        comparisonCode: second.row.target_code,
                        observed: `SHAPE delta=${decimalToken(shapeDelta)}; Q-Shape delta=${decimalToken(qshapeDelta)}`,
                        threshold: `same non-zero sign when |SHAPE delta|>${RANKING_RESOLUTION.toString()} CShM`,
                        details: qshapeDelta.isZero()
                            ? 'Q-Shape collapsed a SHAPE-resolved pair into an exact tie.'
                            : 'Q-Shape reversed a SHAPE-resolved pair.',
                        shapeRawPath: first.row.shape_raw_path,
                        qshapeRawPath: first.row.qshape_raw_path
                    });
                }
            }
        }

        if (item.stratum === 'ideal_reference' && item.expectedOwnTargetCode) {
            const own = finiteRows.find(entry => entry.row.target_code === item.expectedOwnTargetCode);
            if (!own) {
                addFailure(item, 'missing_valid_ideal_self_result', {
                    targetCode: item.expectedOwnTargetCode
                });
            } else {
                if (own.qshape.gte(IDEAL_SELF_GATE)) {
                    addFailure(item, 'ideal_self_qshape', {
                        targetCode: item.expectedOwnTargetCode,
                        observed: decimalToken(own.qshape),
                        threshold: '<1e-8 CShM',
                        qshapeRawPath: own.row.qshape_raw_path
                    });
                }
                if (own.shape.gte(ABS_ERROR_GATE)) {
                    addFailure(item, 'ideal_self_shape', {
                        targetCode: item.expectedOwnTargetCode,
                        observed: decimalToken(own.shape),
                        threshold: '<0.01 CShM',
                        shapeRawPath: own.row.shape_raw_path
                    });
                }
                if (!shapeTieSet.includes(item.expectedOwnTargetCode)) {
                    addFailure(item, 'ideal_nominal_outside_shape_tie_set', {
                        targetCode: item.expectedOwnTargetCode,
                        observed: decimalToken(own.shape.minus(shapeMinimum)),
                        threshold: `<=${RANKING_RESOLUTION.toString()} CShM above SHAPE minimum`,
                        details: `SHAPE minimum belongs to ${shapeBest}`,
                        shapeRawPath: own.row.shape_raw_path
                    });
                }
            }
        }

        const caseFailures = failures.filter(failure => failure.case_id === item.caseId);
        const caseErrorStats = errorStatistics(finiteRows.map(entry => entry.signedError));
        const kendall = gammaAwareKendallTauB(finiteRows);
        caseSummaryRows.push({
            case_id: item.caseId,
            stratum: item.stratum,
            cn: item.cn,
            source_name: item.sourceName,
            expected_own_target_code: item.expectedOwnTargetCode ?? '',
            shape_best_code: shapeBest,
            qshape_best_code: qshapeBest,
            shape_tie_set: shapeTieSet.join('|'),
            qshape_tie_set: qshapeTieSet.join('|'),
            exact_best_label_agrees: exactBestAgreement,
            qshape_best_within_shape_tie_set: qshapeBestWithinShapeTieSet,
            shape_best_second_margin: decimalToken(shapeMargin),
            qshape_best_second_margin: decimalToken(qshapeMargin),
            max_absolute_error: caseErrorStats.max_absolute_error ?? '',
            median_absolute_error: caseErrorStats.median_absolute_error ?? '',
            p95_absolute_error: caseErrorStats.p95_absolute_error ?? '',
            p99_absolute_error: caseErrorStats.p99_absolute_error ?? '',
            mean_absolute_error: caseErrorStats.mean_absolute_error ?? '',
            root_mean_square_error: caseErrorStats.root_mean_square_error ?? '',
            signed_bias: caseErrorStats.signed_bias ?? '',
            kendall_tau_b_gamma: kendall.tau_b ?? 'not_applicable',
            kendall_concordant_pairs: kendall.concordant,
            kendall_discordant_pairs: kendall.discordant,
            kendall_shape_only_ties: kendall.shape_only_ties,
            kendall_qshape_only_ties: kendall.qshape_only_ties,
            kendall_joint_ties: kendall.joint_ties,
            resolved_ranking_pairs: resolvedPairs,
            discordant_ranking_pairs: discordantPairs,
            ranking_agreement_fraction: resolvedPairs === 0
                ? 'not_applicable'
                : new Decimal(resolvedPairs - discordantPairs)
                    .dividedBy(resolvedPairs).toSignificantDigits(18).toString(),
            failure_count: caseFailures.length,
            pass: caseFailures.length === 0
        });
    }

    failures.sort((left, right) =>
        left.case_id.localeCompare(right.case_id) ||
        left.gate.localeCompare(right.gate) ||
        left.target_code.localeCompare(right.target_code) ||
        left.comparison_code.localeCompare(right.comparison_code) ||
        left.observed.localeCompare(right.observed)
    );
    const failureIdCounts = new Map();
    for (const failure of failures) {
        const provisional = stableFailureId(failure);
        const count = failureIdCounts.get(provisional) || 0;
        failure.failure_id = stableFailureId(failure, count);
        failureIdCounts.set(provisional, count + 1);
    }

    const allSignedErrors = comparisonRows.map(row => finiteDecimal(row.signed_error)).filter(Boolean);
    const allRuntimeValues = comparisonRows.map(row => finiteDecimal(row.runtime_ms)).filter(Boolean);
    const summarizeRankStatistics = subsetCaseSummaries => {
        const tauValues = subsetCaseSummaries
            .map(row => finiteDecimal(row.kendall_tau_b_gamma))
            .filter(Boolean);
        const sumField = field => subsetCaseSummaries.reduce(
            (sum, row) => sum + Number(row[field]),
            0
        );
        const kendallComponents = {
            concordant_pairs: sumField('kendall_concordant_pairs'),
            discordant_pairs: sumField('kendall_discordant_pairs'),
            shape_only_ties: sumField('kendall_shape_only_ties'),
            qshape_only_ties: sumField('kendall_qshape_only_ties'),
            joint_ties: sumField('kendall_joint_ties')
        };
        const candidatePairs = Object.values(kendallComponents).reduce(
            (sum, count) => sum + count,
            0
        );
        const resolvedPairs = sumField('resolved_ranking_pairs');
        const discordantResolvedPairs = sumField('discordant_ranking_pairs');
        const agreeingResolvedPairs = resolvedPairs - discordantResolvedPairs;
        return {
            definition: 'Kendall tau-b with gamma=0.02001 CShM used as the tie threshold in both programs',
            tau_b_across_cases: stats(tauValues),
            kendall_pair_components: {
                candidate_pairs: candidatePairs,
                ...kendallComponents
            },
            resolved_ranking_pairs: resolvedPairs,
            discordant_ranking_pairs: discordantResolvedPairs,
            protected_pair_agreement: {
                agree: agreeingResolvedPairs,
                total: resolvedPairs,
                fraction: resolvedPairs === 0
                    ? 'not_applicable'
                    : new Decimal(agreeingResolvedPairs)
                        .dividedBy(resolvedPairs).toSignificantDigits(18).toString()
            }
        };
    };
    const summarizeSubset = subset => {
        const subsetIds = new Set(subset.map(item => item.caseId));
        const subsetRows = comparisonRows.filter(row => subsetIds.has(row.case_id));
        const subsetSignedErrors = subsetRows
            .map(row => finiteDecimal(row.signed_error)).filter(Boolean);
        const subsetRuntimeValues = subsetRows
            .map(row => finiteDecimal(row.runtime_ms)).filter(Boolean);
        const subsetCaseSummaries = caseSummaryRows.filter(row => subsetIds.has(row.case_id));
        return {
            cases: subset.length,
            comparisons_expected: subset.reduce(
                (sum, item) => sum + inventoryByCn.get(item.cn).count,
                0
            ),
            comparisons_observed: subsetRows.length,
            comparisons_domain_valid: subsetSignedErrors.length,
            error_statistics: errorStatistics(subsetSignedErrors),
            runtime_statistics_ms: stats(subsetRuntimeValues),
            exact_best_label_agreement: {
                agree: subsetCaseSummaries.filter(row => row.exact_best_label_agrees).length,
                total: subsetCaseSummaries.length
            },
            best_within_shape_tie_set: {
                agree: subsetCaseSummaries.filter(row => row.qshape_best_within_shape_tie_set).length,
                total: subsetCaseSummaries.length
            },
            rank_statistics: summarizeRankStatistics(subsetCaseSummaries),
            failures: failures.filter(failure => subsetIds.has(failure.case_id)).length
        };
    };

    const byStratum = {};
    for (const stratum of [...new Set(cases.map(item => item.stratum))]) {
        byStratum[stratum] = summarizeSubset(cases.filter(item => item.stratum === stratum));
    }
    const byCn = {};
    for (const cn of [...new Set(cases.map(item => item.cn))].sort((a, b) => a - b)) {
        byCn[cn] = summarizeSubset(cases.filter(item => item.cn === cn));
    }

    const summary = {
        schema_version: 2,
        campaign_gate_status: failures.length === 0 ? 'pass' : 'fail',
        overall_validation_status: 'incomplete',
        claim_boundary: 'direct agreement on shared ideal references and retained fixtures only',
        gates: {
            absolute_error_cshm: '<0.01',
            ideal_self_qshape_cshm: '<1e-8',
            ideal_self_shape_cshm: '<0.01',
            shape_tie_set_gamma_cshm: RANKING_RESOLUTION.toString(),
            best_geometry: 'Q-Shape minimum must belong to the SHAPE tie set',
            resolved_ranking_pairs: 'same strict sign when |SHAPE delta|>gamma',
            cshm_domain: 'finite and within [0, 100]'
        },
        totals: {
            reference_geometries: inventory.reduce((sum, item) => sum + item.count, 0),
            cases: cases.length,
            comparisons_expected: expectedPairs.size,
            comparisons_observed: comparisonRows.length,
            comparisons_domain_valid: allSignedErrors.length,
            failures: failures.length,
            error_statistics: errorStatistics(allSignedErrors),
            runtime_statistics_ms: stats(allRuntimeValues),
            rank_statistics: summarizeRankStatistics(caseSummaryRows)
        },
        by_stratum: byStratum,
        by_cn: byCn
    };

    return { summary, comparisonRows, caseSummaryRows, failures };
}

module.exports = {
    ABS_ERROR_GATE: ABS_ERROR_GATE.toString(),
    IDEAL_SELF_GATE: IDEAL_SELF_GATE.toString(),
    MAX_CSHM: MAX_CSHM.toString(),
    RANKING_RESOLUTION: RANKING_RESOLUTION.toString(),
    analyzeDirectParity,
    buildExpectedPairs,
    decimalToken,
    errorStatistics,
    finiteDecimal,
    gammaAwareKendallTauB,
    median,
    nearestRank,
    pairKey,
    stats,
    validatePrimaryRows
};

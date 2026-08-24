'use strict';

const Decimal = require('decimal.js');

const ABS_ERROR_GATE = new Decimal('0.01');
const IDEAL_SELF_GATE = new Decimal('1e-8');
const RANKING_RESOLUTION = new Decimal('0.02001');

function decimalToken(value) {
    return value instanceof Decimal ? value.toSignificantDigits(18).toString() : '';
}

function finiteDecimal(token) {
    if (typeof token !== 'string' && typeof token !== 'number') return null;
    const text = String(token);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(text)) {
        return null;
    }
    return new Decimal(text);
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
        return { count: 0, median: null, p95: null, max: null, mean: null };
    }
    const sum = values.reduce((accumulator, value) => accumulator.plus(value), new Decimal(0));
    const maximum = values.reduce((current, value) => Decimal.max(current, value));
    return {
        count: values.length,
        median: decimalToken(median(values)),
        p95: decimalToken(nearestRank(values, 0.95)),
        max: decimalToken(maximum),
        mean: decimalToken(sum.dividedBy(values.length))
    };
}

function analyzeDirectParity({
    cases,
    inventory,
    shapeRows,
    qshapeRows,
    additionalFailures = []
}) {
    const caseById = new Map(cases.map(item => [item.caseId, item]));
    const targetByCnAndCode = new Map();
    for (const item of inventory) {
        for (const target of item.targets) {
            targetByCnAndCode.set(`${item.cn}:${target.code}`, target);
        }
    }

    const shapeByPair = new Map(shapeRows.map(row => [
        `${row.caseId}:${row.targetCode}`,
        row
    ]));
    const qshapeByPair = new Map(qshapeRows.map(row => [
        `${row.caseId}:${row.targetCode}`,
        row
    ]));

    const failures = [];
    const comparisonRows = [];
    let failureSequence = 0;
    const addFailure = (item, gate, fields = {}) => {
        failureSequence += 1;
        failures.push({
            failure_id: `failure-${String(failureSequence).padStart(5, '0')}`,
            case_id: item.caseId,
            stratum: item.stratum,
            cn: item.cn,
            gate,
            target_code: fields.targetCode ?? '',
            comparison_code: fields.comparisonCode ?? '',
            observed: fields.observed ?? '',
            threshold: fields.threshold ?? '',
            details: fields.details ?? ''
        });
    };

    for (const failure of additionalFailures) {
        const item = caseById.get(failure.caseId);
        if (!item) {
            throw new Error(`Additional failure references unknown case ${failure.caseId}`);
        }
        addFailure(item, failure.gate, failure);
    }

    for (const item of cases) {
        const cnInventory = inventory.find(entry => entry.cn === item.cn);
        for (const target of cnInventory.targets) {
            const pairKey = `${item.caseId}:${target.code}`;
            const shape = shapeByPair.get(pairKey);
            const qshape = qshapeByPair.get(pairKey);
            if (!shape) {
                addFailure(item, 'missing_shape_result', {
                    targetCode: target.code,
                    details: 'SHAPE output did not contain the expected target value.'
                });
                continue;
            }
            if (!qshape) {
                addFailure(item, 'missing_qshape_result', {
                    targetCode: target.code,
                    details: 'Q-Shape output did not contain the expected target value.'
                });
                continue;
            }
            const shapeValue = finiteDecimal(shape.valueToken);
            const qshapeValue = finiteDecimal(qshape.valueToken);
            if (!shapeValue || !qshapeValue) {
                addFailure(item, 'nonfinite_result', {
                    targetCode: target.code,
                    observed: `SHAPE=${shape.valueToken}; Q-Shape=${qshape.valueToken}`,
                    details: 'At least one result was non-finite or unparsable.'
                });
                comparisonRows.push({
                    case_id: item.caseId,
                    stratum: item.stratum,
                    cn: item.cn,
                    source_name: item.sourceName,
                    target_code: target.code,
                    target_name: target.name,
                    shape_token: shape.valueToken,
                    qshape_full_precision: qshape.valueToken,
                    qshape_display_5dp: '',
                    signed_error: '',
                    absolute_error: '',
                    pass_abs_0_01: false,
                    runtime_ms: qshape.runtimeMsToken ?? ''
                });
                continue;
            }
            const signedError = qshapeValue.minus(shapeValue);
            const absoluteError = signedError.abs();
            const passes = absoluteError.lt(ABS_ERROR_GATE);
            comparisonRows.push({
                case_id: item.caseId,
                stratum: item.stratum,
                cn: item.cn,
                source_name: item.sourceName,
                target_code: target.code,
                target_name: target.name,
                shape_token: shape.valueToken,
                qshape_full_precision: qshape.valueToken,
                qshape_display_5dp: qshapeValue.toFixed(5),
                signed_error: decimalToken(signedError),
                absolute_error: decimalToken(absoluteError),
                pass_abs_0_01: passes,
                runtime_ms: qshape.runtimeMsToken ?? ''
            });
            if (!passes) {
                addFailure(item, 'absolute_error', {
                    targetCode: target.code,
                    observed: decimalToken(absoluteError),
                    threshold: '<0.01 CShM',
                    details: `Q-Shape ${qshape.valueToken}; SHAPE ${shape.valueToken}`
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
            absoluteError: finiteDecimal(row.absolute_error)
        })).filter(entry => entry.shape && entry.qshape && entry.absoluteError);

        const shapeOrder = [...finiteRows].sort((a, b) =>
            a.shape.comparedTo(b.shape) || a.row.target_code.localeCompare(b.row.target_code)
        );
        const qshapeOrder = [...finiteRows].sort((a, b) =>
            a.qshape.comparedTo(b.qshape) || a.row.target_code.localeCompare(b.row.target_code)
        );
        const shapeBest = shapeOrder[0]?.row.target_code ?? '';
        const qshapeBest = qshapeOrder[0]?.row.target_code ?? '';
        const shapeMargin = shapeOrder.length > 1
            ? shapeOrder[1].shape.minus(shapeOrder[0].shape)
            : null;
        const qshapeMargin = qshapeOrder.length > 1
            ? qshapeOrder[1].qshape.minus(qshapeOrder[0].qshape)
            : null;
        const bestAgreement = shapeBest !== '' && shapeBest === qshapeBest;
        const shapeBestResolved = shapeMargin && shapeMargin.gt(RANKING_RESOLUTION);
        if (!bestAgreement && shapeBestResolved) {
            addFailure(item, 'best_geometry_label', {
                observed: `SHAPE=${shapeBest}; Q-Shape=${qshapeBest}`,
                threshold: `SHAPE best-second margin <=${RANKING_RESOLUTION.toString()} is tie-zone`,
                details: `SHAPE margin ${decimalToken(shapeMargin)}`
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
                if (shapeDelta.times(qshapeDelta).lt(0)) {
                    discordantPairs += 1;
                    addFailure(item, 'ranking_inversion', {
                        targetCode: first.row.target_code,
                        comparisonCode: second.row.target_code,
                        observed: `SHAPE delta=${decimalToken(shapeDelta)}; Q-Shape delta=${decimalToken(qshapeDelta)}`,
                        threshold: `|SHAPE delta|>${RANKING_RESOLUTION.toString()} CShM`,
                        details: 'Pairwise order is reversed outside the joint numerical tie-zone.'
                    });
                }
            }
        }

        if (item.stratum === 'ideal_reference' && item.expectedOwnTargetCode) {
            const own = finiteRows.find(entry =>
                entry.row.target_code === item.expectedOwnTargetCode
            );
            if (!own) {
                addFailure(item, 'missing_ideal_self_result', {
                    targetCode: item.expectedOwnTargetCode
                });
            } else if (own.qshape.abs().gte(IDEAL_SELF_GATE)) {
                addFailure(item, 'ideal_self_qshape', {
                    targetCode: item.expectedOwnTargetCode,
                    observed: decimalToken(own.qshape.abs()),
                    threshold: '<1e-8 CShM'
                });
            }
            if (own && own.shape.abs().gte(ABS_ERROR_GATE)) {
                addFailure(item, 'ideal_self_shape', {
                    targetCode: item.expectedOwnTargetCode,
                    observed: decimalToken(own.shape.abs()),
                    threshold: '<0.01 CShM'
                });
            }
            if (
                own &&
                shapeOrder.length > 0 &&
                own.shape.minus(shapeOrder[0].shape).gt(RANKING_RESOLUTION)
            ) {
                addFailure(item, 'ideal_nominal_outside_shape_tie_set', {
                    targetCode: item.expectedOwnTargetCode,
                    observed: decimalToken(own.shape.minus(shapeOrder[0].shape)),
                    threshold: `<=${RANKING_RESOLUTION.toString()} CShM above SHAPE minimum`,
                    details: `SHAPE minimum belongs to ${shapeOrder[0].row.target_code}`
                });
            }
        }

        const caseFailures = failures.filter(failure => failure.case_id === item.caseId);
        const errorStats = stats(finiteRows.map(entry => entry.absoluteError));
        caseSummaryRows.push({
            case_id: item.caseId,
            stratum: item.stratum,
            cn: item.cn,
            source_name: item.sourceName,
            expected_own_target_code: item.expectedOwnTargetCode ?? '',
            shape_best_code: shapeBest,
            qshape_best_code: qshapeBest,
            best_label_agrees: bestAgreement,
            shape_best_second_margin: decimalToken(shapeMargin),
            qshape_best_second_margin: decimalToken(qshapeMargin),
            max_absolute_error: errorStats.max ?? '',
            median_absolute_error: errorStats.median ?? '',
            p95_absolute_error: errorStats.p95 ?? '',
            resolved_ranking_pairs: resolvedPairs,
            discordant_ranking_pairs: discordantPairs,
            ranking_agreement_fraction: resolvedPairs === 0
                ? 'not_applicable'
                : new Decimal(resolvedPairs - discordantPairs)
                    .dividedBy(resolvedPairs)
                    .toSignificantDigits(18)
                    .toString(),
            failure_count: caseFailures.length,
            pass: caseFailures.length === 0
        });
    }

    const allFiniteErrors = comparisonRows
        .map(row => finiteDecimal(row.absolute_error))
        .filter(Boolean);
    const summarizeSubset = subset => {
        const subsetIds = new Set(subset.map(item => item.caseId));
        const subsetRows = comparisonRows.filter(row => subsetIds.has(row.case_id));
        const subsetErrors = subsetRows.map(row => finiteDecimal(row.absolute_error)).filter(Boolean);
        const subsetCaseSummaries = caseSummaryRows.filter(row => subsetIds.has(row.case_id));
        return {
            cases: subset.length,
            comparisons_expected: subset.reduce((sum, item) => {
                const targetCount = inventory.find(entry => entry.cn === item.cn).count;
                return sum + targetCount;
            }, 0),
            comparisons_observed: subsetRows.length,
            error_statistics: stats(subsetErrors),
            best_label_agreement: {
                agree: subsetCaseSummaries.filter(row => row.best_label_agrees).length,
                total: subsetCaseSummaries.length
            },
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
        schema_version: 1,
        status: failures.length === 0 ? 'pass' : 'fail',
        gates: {
            absolute_error_cshm: '<0.01',
            ideal_self_qshape_cshm: '<1e-8',
            ideal_self_shape_cshm: '<0.01',
            ranking_joint_tie_zone_cshm: RANKING_RESOLUTION.toString(),
            best_geometry: 'agreement required outside the joint tie-zone'
        },
        totals: {
            reference_geometries: inventory.reduce((sum, item) => sum + item.count, 0),
            cases: cases.length,
            comparisons_expected: cases.reduce((sum, item) =>
                sum + inventory.find(entry => entry.cn === item.cn).count,
            0),
            comparisons_observed: comparisonRows.length,
            failures: failures.length,
            error_statistics: stats(allFiniteErrors)
        },
        by_stratum: byStratum,
        by_cn: byCn
    };

    return { summary, comparisonRows, caseSummaryRows, failures };
}

module.exports = {
    ABS_ERROR_GATE: ABS_ERROR_GATE.toString(),
    IDEAL_SELF_GATE: IDEAL_SELF_GATE.toString(),
    RANKING_RESOLUTION: RANKING_RESOLUTION.toString(),
    analyzeDirectParity,
    decimalToken,
    finiteDecimal,
    median,
    nearestRank,
    stats
};

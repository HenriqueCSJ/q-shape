'use strict';

// This module is deliberately a pure reducer.  It consumes already parsed
// SHAPE/Q-Shape rows and returns a bounded analysis object; it never reads or
// writes the evidence package.  The runner and the independent verifier own
// package I/O and sealing respectively.

const crypto = require('crypto');
const Decimal = require('decimal.js');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

const ABS_ERROR_GATE = new Decimal('0.01');
const IDEAL_SELF_Q_GATE = new Decimal('1e-8');
const IDEAL_SELF_SHAPE_GATE = new Decimal('0.01');
const RANKING_GAMMA = new Decimal('0.02001');
const RELATIONAL_Q_GATE = new Decimal('1e-8');
const MAX_CSHM = new Decimal('100');

const Q_STREAMS = Object.freeze([
    'q_primary_input_derived_r1',
    'q_primary_input_derived_r2',
    'q_explicit_seed_0',
    'q_explicit_seed_1364412496',
    'q_explicit_seed_4294967295'
]);
const SHAPE_REPETITIONS = Object.freeze(['shape_r1', 'shape_r2']);
const EXPLICIT_SEEDS = Object.freeze({
    q_explicit_seed_0: 0,
    q_explicit_seed_1364412496: 1364412496,
    q_explicit_seed_4294967295: 4294967295
});
const REPRESENTATION_RECIPE_IDS = Object.freeze([
    'rotation-a',
    'scale-small',
    'permutation',
    'rotation-scale',
    'rotation-permutation',
    'rotation-scale-permutation'
]);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function field(object, ...names) {
    for (const name of names) {
        if (object && hasOwn(object, name)) return object[name];
    }
    return undefined;
}

function caseIdOf(item) {
    return field(item, 'caseId', 'case_id');
}

function targetCodeOf(item) {
    return field(item, 'targetCode', 'target_code', 'code');
}

function recipeIdOf(item) {
    return field(item, 'recipeId', 'recipe_id') || '';
}

function recipeCategoryOf(item) {
    return field(item, 'recipeCategory', 'recipe_category', 'category') || '';
}

function parentCaseIdOf(item) {
    return field(item, 'parentCaseId', 'parent_case_id');
}

function finiteDecimal(token) {
    // Numeric input is accepted for convenience, but source lexical tokens
    // are retained from the row and are never replaced in output.
    if (typeof token !== 'string' && typeof token !== 'number') return null;
    const text = String(token);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(text)) {
        return null;
    }
    const value = new Decimal(text);
    return value.isFinite() ? value : null;
}

function decimalToken(value) {
    return value instanceof Decimal
        ? value.toSignificantDigits(18).toString()
        : '';
}

function decimalOrEmpty(value) {
    return value === null || value === undefined ? '' : decimalToken(value);
}

function pairKey(caseId, targetCode) {
    return `${caseId}\u0000${targetCode}`;
}

function gammaAwareKendall(entries) {
    let concordant = 0;
    let discordant = 0;
    let shapeOnlyTies = 0;
    let qshapeOnlyTies = 0;
    let jointTies = 0;
    for (let left = 0; left < entries.length; left++) {
        for (let right = left + 1; right < entries.length; right++) {
            const shapeDelta = entries[left].shape.minus(entries[right].shape);
            const qshapeDelta = entries[left].qshape.minus(entries[right].qshape);
            const shapeTie = shapeDelta.abs().lte(RANKING_GAMMA);
            const qshapeTie = qshapeDelta.abs().lte(RANKING_GAMMA);
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

function medianDecimal(sortedValues) {
    if (sortedValues.length === 0) return null;
    const middle = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 1) return sortedValues[middle];
    return sortedValues[middle - 1].plus(sortedValues[middle]).dividedBy(2);
}

function nearestRankDecimal(sortedValues, probability) {
    if (sortedValues.length === 0) return null;
    const position = Math.max(1, Math.ceil(probability * sortedValues.length));
    return sortedValues[position - 1];
}

function exactErrorStatistics(signedErrors) {
    if (signedErrors.length === 0) {
        return {
            count: 0,
            signed_bias: 'not_evaluable',
            mean_absolute_error: 'not_evaluable',
            root_mean_square_error: 'not_evaluable',
            median_absolute_error: 'not_evaluable',
            p95_absolute_error: 'not_evaluable',
            p99_absolute_error: 'not_evaluable',
            maximum_absolute_error: 'not_evaluable'
        };
    }
    const count = new Decimal(signedErrors.length);
    const absolute = signedErrors.map(value => value.abs()).sort((a, b) => a.comparedTo(b));
    const signedSum = signedErrors.reduce((sum, value) => sum.plus(value), new Decimal(0));
    const absoluteSum = absolute.reduce((sum, value) => sum.plus(value), new Decimal(0));
    const squareSum = signedErrors.reduce(
        (sum, value) => sum.plus(value.times(value)),
        new Decimal(0)
    );
    return {
        count: signedErrors.length,
        signed_bias: decimalToken(signedSum.dividedBy(count)),
        mean_absolute_error: decimalToken(absoluteSum.dividedBy(count)),
        root_mean_square_error: decimalToken(squareSum.dividedBy(count).sqrt()),
        median_absolute_error: decimalToken(medianDecimal(absolute)),
        p95_absolute_error: decimalToken(nearestRankDecimal(absolute, 0.95)),
        p99_absolute_error: decimalToken(nearestRankDecimal(absolute, 0.99)),
        maximum_absolute_error: decimalToken(absolute.at(-1))
    };
}

function exactRuntimeStatistics(runtimeValues) {
    if (runtimeValues.length === 0) {
        return {
            count: 0,
            mean_ms: 'not_evaluable',
            median_ms: 'not_evaluable',
            p95_ms: 'not_evaluable',
            p99_ms: 'not_evaluable',
            maximum_ms: 'not_evaluable'
        };
    }
    const sorted = [...runtimeValues].sort((a, b) => a.comparedTo(b));
    const sum = sorted.reduce((total, value) => total.plus(value), new Decimal(0));
    return {
        count: sorted.length,
        mean_ms: decimalToken(sum.dividedBy(sorted.length)),
        median_ms: decimalToken(medianDecimal(sorted)),
        p95_ms: decimalToken(nearestRankDecimal(sorted, 0.95)),
        p99_ms: decimalToken(nearestRankDecimal(sorted, 0.99)),
        maximum_ms: decimalToken(sorted.at(-1))
    };
}

function reportingMetadata(item, stream, qRow) {
    const recipeId = recipeIdOf(item);
    const distortion = recipeId.match(/^(radial|angular|mixed)-(minus|plus)-(.+)$/);
    const precision = recipeId.match(/^precision-(\d+)$/);
    return {
        cn: field(item, 'cn'),
        stratum: field(item, 'stratum') || '',
        family: field(item, 'family') || '',
        geometry_family: field(item, 'parentReferenceCode', 'parent_reference_code') || '',
        recipe_id: recipeId,
        recipe_index: field(item, 'recipeIndex', 'recipe_index') ?? '',
        recipe_category: recipeCategoryOf(item),
        distortion_type: distortion ? distortion[1] : 'not_applicable',
        distortion_sign: distortion ? distortion[2] : 'not_applicable',
        distortion_magnitude: distortion ? distortion[3] : 'not_applicable',
        input_precision_digits: precision ? Number(precision[1]) : 'not_applicable',
        optimizer_seed_mode: streamKind(stream),
        optimizer_seed_uint32: expectedSeed(stream),
        browser: 'not_applicable_node_worker',
        execution_mode: field(qRow, 'mode') || 'default',
        qshape_runtime_ms: field(qRow, 'runtimeMsToken', 'runtime_ms_token', 'runtime_ms') || ''
    };
}

function buildStratifiedStatistics(comparisonRows) {
    const dimensions = [
        ['overall', () => 'all'],
        ['cn', row => String(row.cn)],
        ['stratum', row => row.stratum],
        ['family', row => row.family],
        ['geometry_family', row => row.geometry_family],
        ['recipe_category', row => row.recipe_category],
        ['recipe_id', row => row.recipe_id],
        ['distortion_type', row => row.distortion_type],
        ['distortion_sign', row => row.distortion_sign],
        ['distortion_magnitude', row => row.distortion_magnitude],
        ['input_precision_digits', row => String(row.input_precision_digits)],
        ['target_code', row => row.target_code]
    ];
    const output = [];
    for (const stream of Q_STREAMS) {
        const streamRows = comparisonRows.filter(row => row.stream === stream);
        for (const [dimension, levelOf] of dimensions) {
            const groups = new Map();
            for (const row of streamRows) {
                const level = levelOf(row);
                if (!groups.has(level)) groups.set(level, []);
                groups.get(level).push(row);
            }
            for (const [level, rows] of [...groups.entries()].sort((a, b) =>
                String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true })
            )) {
                const valid = rows.filter(row => row.result_domain_valid);
                const signedErrors = valid.map(row => finiteDecimal(row.signed_error)).filter(Boolean);
                const runtimes = rows.map(row => finiteDecimal(row.qshape_runtime_ms)).filter(Boolean);
                output.push({
                    stream,
                    optimizer_seed_mode: streamKind(stream),
                    optimizer_seed_uint32: expectedSeed(stream),
                    dimension,
                    level,
                    comparisons_total: rows.length,
                    comparisons_domain_valid: valid.length,
                    cshm_unit: 'dimensionless_CShM',
                    runtime_unit: 'ms',
                    ...exactErrorStatistics(signedErrors),
                    runtime: exactRuntimeStatistics(runtimes)
                });
            }
        }
    }
    return output;
}

function buildPairedSignRows(caseMap, inventoryByCn, shapeConsensus, qValidated) {
    const descriptors = new Map();
    for (const item of caseMap.values()) {
        const recipeId = recipeIdOf(item);
        const match = recipeId.match(/^(radial|angular|mixed)-(minus|plus)-(.+)$/);
        if (!match) continue;
        const key = [
            field(item, 'cn'),
            field(item, 'parentReferenceCode', 'parent_reference_code'),
            match[1],
            match[3]
        ].join('\u0000');
        if (!descriptors.has(key)) descriptors.set(key, {
            cn: field(item, 'cn'),
            geometryFamily: field(item, 'parentReferenceCode', 'parent_reference_code'),
            distortionType: match[1],
            magnitude: match[3],
            minus: null,
            plus: null
        });
        descriptors.get(key)[match[2]] = item;
    }
    const rows = [];
    for (const descriptor of descriptors.values()) {
        const targetCodes = descriptor.minus
            ? targetCodesForCase(descriptor.minus, inventoryByCn)
            : descriptor.plus
                ? targetCodesForCase(descriptor.plus, inventoryByCn)
                : [];
        for (const stream of Q_STREAMS) {
            for (const targetCode of targetCodes) {
                const minusId = descriptor.minus ? caseIdOf(descriptor.minus) : '';
                const plusId = descriptor.plus ? caseIdOf(descriptor.plus) : '';
                const minusShape = minusId ? shapeConsensus.get(pairKey(minusId, targetCode)) : null;
                const plusShape = plusId ? shapeConsensus.get(pairKey(plusId, targetCode)) : null;
                const minusQ = minusId ? qValidated[stream].map.get(pairKey(minusId, targetCode)) : null;
                const plusQ = plusId ? qValidated[stream].map.get(pairKey(plusId, targetCode)) : null;
                const minusQValue = minusQ ? valueForRow(minusQ) : null;
                const plusQValue = plusQ ? valueForRow(plusQ) : null;
                const evaluable = Boolean(
                    descriptor.minus && descriptor.plus &&
                    minusShape?.valid && plusShape?.valid &&
                    domainValid(minusQValue) && domainValid(plusQValue)
                );
                const deltaShape = evaluable ? plusShape.value.minus(minusShape.value) : null;
                const deltaQ = evaluable ? plusQValue.minus(minusQValue) : null;
                rows.push({
                    stream,
                    optimizer_seed_mode: streamKind(stream),
                    optimizer_seed_uint32: expectedSeed(stream),
                    cn: descriptor.cn,
                    geometry_family: descriptor.geometryFamily,
                    target_code: targetCode,
                    distortion_type: descriptor.distortionType,
                    distortion_magnitude: descriptor.magnitude,
                    minus_case_id: minusId,
                    plus_case_id: plusId,
                    shape_minus_token: minusShape?.token || '',
                    shape_plus_token: plusShape?.token || '',
                    qshape_minus_token: minusQ ? field(minusQ, 'valueToken', 'value_token') || '' : '',
                    qshape_plus_token: plusQ ? field(plusQ, 'valueToken', 'value_token') || '' : '',
                    delta_shape: decimalOrEmpty(deltaShape),
                    delta_qshape: decimalOrEmpty(deltaQ),
                    delta_error: decimalOrEmpty(evaluable ? deltaQ.minus(deltaShape) : null),
                    cshm_unit: 'dimensionless_CShM',
                    status: evaluable ? 'evaluable' : 'not_evaluable'
                });
            }
        }
    }
    return rows;
}

function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key =>
            `${JSON.stringify(key)}:${stableJson(value[key])}`
        ).join(',')}}`;
    }
    return JSON.stringify(value);
}

function qBits(row) {
    const supplied = field(row, 'valueHex', 'value_hex', 'float64Hex', 'float64_hex');
    if (supplied !== undefined && supplied !== null && supplied !== '') {
        const text = String(supplied).toLowerCase();
        return /^[0-9a-f]{16}$/.test(text) ? text : null;
    }
    const value = finiteDecimal(field(row, 'valueToken', 'value_token'));
    if (!value) return null;
    const number = Number(field(row, 'valueToken', 'value_token'));
    if (!Number.isFinite(number)) return null;
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(number, 0);
    return buffer.toString('hex');
}

function qTokenBits(token) {
    if (token === 'NaN' || token === 'Infinity' || token === '-Infinity') {
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeDoubleBE(Number(token), 0);
        return buffer.toString('hex');
    }
    if (typeof token !== 'string' || finiteDecimal(token) === null) return null;
    const value = Number(token);
    if (!Number.isFinite(value)) return null;
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(value, 0);
    return buffer.toString('hex');
}

function canonicalQToken(token) {
    if (token === 'NaN') return NaN;
    if (token === 'Infinity') return Infinity;
    if (token === '-Infinity') return -Infinity;
    if (typeof token !== 'string' || finiteDecimal(token) === null) return null;
    const value = Number(token);
    if (!Number.isFinite(value)) return null;
    const expected = Object.is(value, -0) ? '-0' : value.toPrecision(17);
    return token === expected ? value : null;
}

function streamKind(stream) {
    if (stream.startsWith('q_primary_')) return 'input-derived';
    if (stream.startsWith('q_explicit_')) return 'explicit-seed';
    return 'unknown';
}

function expectedSeed(stream) {
    return hasOwn(EXPLICIT_SEEDS, stream) ? EXPLICIT_SEEDS[stream] : null;
}

function expectedQPolicy(stream) {
    // The worker contract calls the explicit mode simply "explicit"; the
    // stream kind remains "explicit-seed" to distinguish it from primary.
    return streamKind(stream) === 'input-derived' ? 'input-derived' : 'explicit';
}

function shapeTokenIsValid(token) {
    return typeof token === 'string' && /^\d+\.\d{5}$/.test(token);
}

function qTokenIsValid(token) {
    return canonicalQToken(token) !== null;
}

function domainValid(value) {
    return Boolean(value && value.gte(0) && value.lte(MAX_CSHM));
}

function normalizeInventory(inventory, addFailure) {
    const byCn = new Map();
    if (!Array.isArray(inventory)) {
        addFailure({ gate: 'inventory_missing', details: 'Reference inventory is not an array' });
        return byCn;
    }
    for (const item of inventory) {
        const cn = field(item, 'cn');
        const targets = field(item, 'targets');
        if (!Number.isInteger(cn) || !Array.isArray(targets) || byCn.has(cn)) {
            addFailure({
                gate: 'inventory_invalid',
                observed: String(cn),
                details: 'Inventory CN is duplicated or has no target array'
            });
            continue;
        }
        const targetMap = new Map();
        for (const target of targets) {
            const code = targetCodeOf(target);
            if (typeof code !== 'string' || targetMap.has(code)) {
                addFailure({
                    gate: 'inventory_invalid_target',
                    cn,
                    targetCode: code || '',
                    details: 'Target code is missing or duplicated'
                });
                continue;
            }
            targetMap.set(code, target);
        }
        byCn.set(cn, { cn, targets, targetMap });
    }
    return byCn;
}

function makeExpectedPairs(cases, inventoryByCn, addFailure) {
    const expected = new Map();
    const caseMap = new Map();
    if (!Array.isArray(cases)) {
        addFailure({ gate: 'cases_missing', details: 'Cases are not an array' });
        return { expected, caseMap };
    }
    for (const item of cases) {
        const id = caseIdOf(item);
        const cn = field(item, 'cn');
        if (typeof id !== 'string' || !id || caseMap.has(id)) {
            addFailure({
                caseId: id || '',
                gate: 'case_set_multiplicity',
                details: 'Case ID is missing or duplicated'
            });
            continue;
        }
        caseMap.set(id, item);
        const group = inventoryByCn.get(cn);
        if (!group) {
            addFailure({ caseId: id, gate: 'case_reference_inventory', cn, details: 'No inventory for case CN' });
            continue;
        }
        for (const target of group.targets) {
            const code = targetCodeOf(target);
            expected.set(pairKey(id, code), { caseItem: item, target, targetCode: code });
        }
    }
    return { expected, caseMap };
}

function extractShapeRepetitions(input) {
    const candidate = field(input, 'shapeRowsByRepetition', 'shape_repetitions');
    if (candidate && !Array.isArray(candidate)) {
        return {
            shape_r1: field(candidate, 'shape_r1', 'r1', 'rep1') || [],
            shape_r2: field(candidate, 'shape_r2', 'r2', 'rep2') || []
        };
    }
    if (Array.isArray(candidate)) {
        return { shape_r1: candidate[0] || [], shape_r2: candidate[1] || [] };
    }
    return {
        shape_r1: field(input, 'shapeRowsR1', 'shape_r1') || [],
        shape_r2: field(input, 'shapeRowsR2', 'shape_r2') || []
    };
}

function extractQStreams(input) {
    const candidate = field(input, 'qshapeRowsByStream', 'qshapeStreams', 'qshape_streams');
    const output = {};
    if (candidate && !Array.isArray(candidate)) {
        for (const stream of Q_STREAMS) {
            const value = field(candidate, stream);
            output[stream] = Array.isArray(value) ? value : [];
        }
        return output;
    }
    if (Array.isArray(candidate)) {
        for (const entry of candidate) {
            const name = field(entry, 'stream', 'name', 'id');
            if (Q_STREAMS.includes(name)) output[name] = field(entry, 'rows') || [];
        }
    }
    for (const stream of Q_STREAMS) {
        if (!hasOwn(output, stream)) {
            output[stream] = field(input, stream) || [];
        }
    }
    return output;
}

function createFailureCollector() {
    const raw = [];
    const addFailure = (fields = {}) => {
        const failure = {
            failure_id: '',
            event_type: fields.gate || fields.eventType || 'unknown_failure',
            gate: fields.gate || fields.eventType || 'unknown_failure',
            status: 'fail',
            severity: fields.severity || 'gate_failure',
            stream: fields.stream || '',
            repetition: fields.repetition || '',
            execution_unit_id: fields.executionUnitId || [
                fields.stream || fields.repetition || 'package',
                fields.caseId || '',
                fields.targetCode || fields.comparisonCode || ''
            ].join(':'),
            case_id: fields.caseId || '',
            cn: fields.cn ?? '',
            target_code: fields.targetCode || '',
            comparison_code: fields.comparisonCode || '',
            observed: fields.observed ?? '',
            threshold: fields.threshold ?? '',
            details: fields.details || ''
        };
        raw.push(failure);
        return failure;
    };
    const finalize = () => {
        const failures = [...raw].sort((a, b) =>
            a.stream.localeCompare(b.stream) ||
            a.repetition.localeCompare(b.repetition) ||
            a.case_id.localeCompare(b.case_id) ||
            a.gate.localeCompare(b.gate) ||
            a.target_code.localeCompare(b.target_code) ||
            a.comparison_code.localeCompare(b.comparison_code) ||
            String(a.observed).localeCompare(String(b.observed)) ||
            a.details.localeCompare(b.details)
        );
        const counts = new Map();
        for (const failure of failures) {
            const digest = crypto.createHash('sha256')
                .update(stableJson({
                    event_type: failure.event_type,
                    stream: failure.stream,
                    repetition: failure.repetition,
                    execution_unit_id: failure.execution_unit_id,
                    case_id: failure.case_id,
                    cn: failure.cn,
                    target_code: failure.target_code,
                    comparison_code: failure.comparison_code,
                    observed: failure.observed,
                    threshold: failure.threshold,
                    details: failure.details
                }))
                .digest('hex')
                .slice(0, 16);
            const base = `failure-${digest}`;
            const index = counts.get(base) || 0;
            failure.failure_id = index === 0 ? base : `${base}-${index + 1}`;
            counts.set(base, index + 1);
        }
        return failures;
    };
    return { addFailure, finalize, raw };
}

function analyzeBoundaryControls(input, addFailure) {
    const document = field(
        input,
        'malformedObservations',
        'malformed_observations',
        'boundaryControlObservations',
        'boundary_control_observations'
    );
    const controls = Array.isArray(document?.controls)
        ? document.controls
        : (Array.isArray(document?.results) ? document.results : []);
    const summary = {
        included: Boolean(document),
        controls_observed: controls.length,
        controls_passed: 0,
        controls_failed: 0,
        campaign_gate_status: document ? 'pass' : 'not_evaluated'
    };
    for (const control of controls) {
        const controlId = field(control, 'controlId', 'control_id') || '';
        const expectedOutcome = field(
            control,
            'expectedOutcome',
            'expected_outcome'
        );
        const observedOutcome = field(
            control,
            'observedOutcome',
            'observed_outcome'
        );
        const expectedNumericRows = Number(field(
            control,
            'expectedNumericRows',
            'expected_numeric_rows'
        ));
        const observedNumericRows = Number(field(
            control,
            'observedNumericRows',
            'observed_numeric_rows',
            'observed_numeric_row_count'
        ));
        const passed = typeof expectedOutcome === 'string' &&
            typeof observedOutcome === 'string' &&
            Number.isInteger(expectedNumericRows) && expectedNumericRows >= 0 &&
            Number.isInteger(observedNumericRows) && observedNumericRows >= 0 &&
            expectedOutcome === observedOutcome &&
            expectedNumericRows === observedNumericRows;
        if (passed) {
            summary.controls_passed += 1;
            continue;
        }
        summary.controls_failed += 1;
        addFailure({
            gate: 'malformed_control_contract',
            executionUnitId: `malformed:${controlId}`,
            caseId: field(control, 'sourceParentCaseId', 'source_parent_case_id') || '',
            cn: field(control, 'cn') ?? '',
            observed: `outcome=${String(observedOutcome ?? 'missing')};numeric_rows=${String(observedNumericRows)}`,
            threshold: `outcome=${String(expectedOutcome ?? 'missing')};numeric_rows=${String(expectedNumericRows)}`,
            details: `Boundary control ${controlId || '<missing>'} (` +
                `${field(control, 'category') || 'unknown'}, ${field(control, 'interface') || 'unknown'}) ` +
                'did not match the frozen outcome contract'
        });
    }
    if (summary.controls_failed > 0) summary.campaign_gate_status = 'fail';
    return summary;
}

function validateRows(rows, unit, expectedPairs, caseMap, addFailure, options = {}) {
    const map = new Map();
    const invalidCases = new Set();
    if (!Array.isArray(rows)) {
        addFailure({
            gate: 'row_collection_missing',
            stream: options.stream || '',
            repetition: options.repetition || '',
            executionUnitId: unit,
            details: 'Result rows are not an array'
        });
        return { map, invalidCases, rowCount: 0 };
    }
    for (let index = 0; index < rows.length; index++) {
        const row = rows[index] || {};
        const id = field(row, 'caseId', 'case_id');
        const target = targetCodeOf(row);
        const key = pairKey(id, target);
        const expectedItem = expectedPairs.get(key);
        if (!expectedItem) {
            if (caseMap.has(id)) invalidCases.add(id);
            addFailure({
                gate: 'unexpected_target_row',
                stream: options.stream || '',
                repetition: options.repetition || '',
                executionUnitId: unit,
                caseId: id || '',
                targetCode: target || '',
                observed: `${id || ''}/${target || ''}`,
                details: `Unknown case/target at row ${index + 1}`
            });
            continue;
        }
        if (map.has(key)) {
            invalidCases.add(id);
            addFailure({
                gate: 'duplicate_target_row',
                stream: options.stream || '',
                repetition: options.repetition || '',
                executionUnitId: unit,
                caseId: id,
                targetCode: target,
                details: `Duplicate case/target at row ${index + 1}`
            });
            continue;
        }
        map.set(key, row);
        const valueToken = field(row, 'valueToken', 'value_token');
        if (options.kind === 'shape') {
            if (field(row, 'lexicallyValid', 'lexically_valid') === false || !shapeTokenIsValid(valueToken)) {
                invalidCases.add(id);
                addFailure({
                    gate: 'shape_lexical_token',
                    repetition: options.repetition || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: valueToken ?? '',
                    threshold: 'non-negative fixed decimal with exactly five fractional digits',
                    details: 'SHAPE token is not an exact five-decimal lexical token'
                });
            }
        } else if (options.kind === 'qshape') {
            if (field(row, 'lexicallyValid', 'lexically_valid') === false || !qTokenIsValid(valueToken)) {
                invalidCases.add(id);
                addFailure({
                    gate: 'qshape_lexical_token',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: valueToken ?? '',
                    threshold: 'finite IEEE-754 binary64 round-trip decimal token',
                    details: 'Q-Shape token is missing or non-finite'
                });
            }
            const bits = qBits(row);
            const suppliedBits = field(row, 'valueHex', 'value_hex', 'float64Hex', 'float64_hex');
            const expectedBits = qTokenBits(valueToken);
            if (suppliedBits === undefined || suppliedBits === null || suppliedBits === '' ||
                !bits || !expectedBits || String(suppliedBits).toLowerCase() !== expectedBits) {
                invalidCases.add(id);
                addFailure({
                    gate: 'qshape_float64_bits',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: suppliedBits ?? '',
                    threshold: 'exact lowercase/uppercase hexadecimal bits of the canonical result token',
                    details: 'Q-Shape binary64 result bits are missing, malformed, or inconsistent with the token'
                });
            }
            const runtimeToken = field(row, 'runtimeMsToken', 'runtime_ms_token', 'runtime_ms');
            if (typeof runtimeToken !== 'string' || !/^\d+\.\d{6}$/.test(runtimeToken) ||
                !Number.isFinite(Number(runtimeToken))) {
                addFailure({
                    gate: 'qshape_runtime_token',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: runtimeToken ?? '',
                    threshold: 'non-negative finite milliseconds with exactly six fractional digits',
                    details: 'Q-Shape diagnostic runtime token is missing or malformed'
                });
            }
            const policy = field(row, 'seedPolicy', 'seed_policy');
            if (policy === undefined || String(policy) !== expectedQPolicy(options.stream)) {
                invalidCases.add(id);
                addFailure({
                    gate: 'qshape_seed_policy',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: policy ?? '',
                    threshold: expectedQPolicy(options.stream),
                    details: 'Q-Shape result uses the wrong seed policy for its stream'
                });
            }
            const requiredSeed = expectedSeed(options.stream);
            const actualSeed = field(row, 'explicitSeed', 'explicit_seed_uint32', 'explicit_seed');
            if (requiredSeed !== null &&
                (actualSeed === undefined || String(actualSeed) !== String(requiredSeed))) {
                invalidCases.add(id);
                addFailure({
                    gate: 'qshape_explicit_seed_identity',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: actualSeed ?? '',
                    threshold: String(requiredSeed),
                    details: 'Explicit uint32 seed does not match the frozen stream'
                });
            } else if (requiredSeed === null && actualSeed !== undefined &&
                actualSeed !== null && actualSeed !== '') {
                invalidCases.add(id);
                addFailure({
                    gate: 'qshape_explicit_seed_forbidden',
                    stream: options.stream || '',
                    executionUnitId: unit,
                    caseId: id,
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: target,
                    observed: actualSeed,
                    threshold: 'null/absent for input-derived stream',
                    details: 'Input-derived Q-Shape stream must not carry an explicit seed'
                });
            }
        }
    }
    for (const [key, expectedItem] of expectedPairs) {
        if (map.has(key)) continue;
        const id = caseIdOf(expectedItem.caseItem);
        const target = expectedItem.targetCode;
        invalidCases.add(id);
        addFailure({
            gate: 'missing_target_row',
            stream: options.stream || '',
            repetition: options.repetition || '',
            executionUnitId: unit,
            caseId: id,
            cn: field(expectedItem.caseItem, 'cn'),
            targetCode: target,
            observed: 'missing',
            threshold: 'exactly one row for every expected case/target pair',
            details: 'Missing target is a structural failure; ranking cannot use a subset'
        });
    }
    return { map, invalidCases, rowCount: rows.length };
}

function targetCodesForCase(item, inventoryByCn) {
    const group = inventoryByCn.get(field(item, 'cn'));
    return group ? [...group.targetMap.keys()] : [];
}

function valueForRow(row) {
    return finiteDecimal(field(row, 'valueToken', 'value_token'));
}

function pairIsDomainValid(shapeEntry, qRow) {
    return Boolean(
        shapeEntry && shapeEntry.valid &&
        qRow && qTokenIsValid(field(qRow, 'valueToken', 'value_token')) &&
        qBits(qRow) &&
        domainValid(valueForRow(qRow)) &&
        domainValid(shapeEntry.value)
    );
}

function isRepresentationCase(item) {
    const recipe = recipeIdOf(item);
    return recipe === 'canonical' ||
        REPRESENTATION_RECIPE_IDS.includes(recipe) ||
        recipeCategoryOf(item) === 'representation';
}

function relationDescriptor(item, caseMap) {
    const recipe = recipeIdOf(item);
    let authorized = false;
    let expectedParent = null;
    if (REPRESENTATION_RECIPE_IDS.includes(recipe)) {
        authorized = true;
        expectedParent = [...caseMap.values()].find(candidate =>
            field(candidate, 'cn') === field(item, 'cn') &&
            field(candidate, 'parentReferenceCode', 'parent_reference_code') ===
                field(item, 'parentReferenceCode', 'parent_reference_code') &&
            recipeIdOf(candidate) === 'canonical'
        );
    } else if (recipe === 'distorted-twin') {
        authorized = true;
        expectedParent = [...caseMap.values()].find(candidate =>
            field(candidate, 'cn') === field(item, 'cn') &&
            field(candidate, 'parentReferenceCode', 'parent_reference_code') ===
                field(item, 'parentReferenceCode', 'parent_reference_code') &&
            recipeIdOf(candidate) === 'mixed-plus-0.05'
        );
    }
    if (!authorized) return { authorized: false, expectedParent: null };
    const declaredParentId = parentCaseIdOf(item);
    const parent = declaredParentId ? caseMap.get(declaredParentId) : expectedParent;
    return {
        authorized: true,
        expectedParent,
        parent,
        declaredParentId,
        parentId: parent ? caseIdOf(parent) : ''
    };
}

function rankCase(item, targetCodes, shapeByPair, qByPair, structuralInvalid,
    addFailure, stream) {
    const caseId = caseIdOf(item);
    const entries = [];
    const invalidTargets = [];
    for (const targetCode of targetCodes) {
        const key = pairKey(caseId, targetCode);
        const shape = shapeByPair.get(key);
        const q = qByPair.get(key);
        if (!pairIsDomainValid(shape, q)) invalidTargets.push(targetCode);
        else entries.push({
            targetCode,
            shape: shape.value,
            qshape: valueForRow(q)
        });
    }
    const notEvaluable = structuralInvalid || invalidTargets.length > 0 || entries.length !== targetCodes.length;
    if (notEvaluable) {
        addFailure({
            gate: 'ranking_not_evaluable',
            stream,
            executionUnitId: `${stream}:${caseId}`,
            caseId,
            cn: field(item, 'cn'),
            observed: invalidTargets.join('|') || 'structural_failure',
            threshold: 'complete finite valid case/target set',
            details: 'Ranking was not computed from a subset of valid targets'
        });
        return {
            case_id: caseId,
            stream,
            ranking_status: 'not_evaluable',
            not_evaluable_targets: invalidTargets,
            shape_best_code: '',
            qshape_best_code: '',
            shape_tie_set: [],
            qshape_tie_set: [],
            exact_best_label_agrees: false,
            qshape_best_within_shape_tie_set: false,
            resolved_ranking_pairs: 0,
            discordant_ranking_pairs: 0,
            ranking_agreement_fraction: 'not_applicable',
            kendall_tau_b: null,
            kendall_concordant_pairs: 0,
            kendall_discordant_pairs: 0,
            kendall_shape_only_ties: 0,
            kendall_qshape_only_ties: 0,
            kendall_joint_ties: 0,
            failure_count: 0,
            pass: false
        };
    }

    const shapeOrder = [...entries].sort((a, b) =>
        a.shape.comparedTo(b.shape) || a.targetCode.localeCompare(b.targetCode)
    );
    const qOrder = [...entries].sort((a, b) =>
        a.qshape.comparedTo(b.qshape) || a.targetCode.localeCompare(b.targetCode)
    );
    const shapeMinimum = shapeOrder[0].shape;
    const qMinimum = qOrder[0].qshape;
    const shapeTieSet = shapeOrder.filter(entry =>
        entry.shape.minus(shapeMinimum).lte(RANKING_GAMMA)
    ).map(entry => entry.targetCode);
    const qTieSet = qOrder.filter(entry =>
        entry.qshape.minus(qMinimum).lte(RANKING_GAMMA)
    ).map(entry => entry.targetCode);
    const shapeBest = shapeOrder[0].targetCode;
    const qBest = qOrder[0].targetCode;
    const qBestWithin = shapeTieSet.includes(qBest);
    const kendall = gammaAwareKendall(entries);
    if (!qBestWithin) {
        addFailure({
            gate: 'best_geometry_outside_shape_tie_set',
            stream,
            executionUnitId: `${stream}:${caseId}`,
            caseId,
            cn: field(item, 'cn'),
            targetCode: qBest,
            comparisonCode: shapeBest,
            observed: `SHAPE tie set=${shapeTieSet.join('|')}; Q-Shape best=${qBest}`,
            threshold: `Q-Shape best must be within ${RANKING_GAMMA.toString()} CShM of SHAPE minimum`,
            details: 'Complete-set ranking gate failed'
        });
    }
    let resolved = 0;
    let discordant = 0;
    for (let left = 0; left < entries.length; left++) {
        for (let right = left + 1; right < entries.length; right++) {
            const shapeDelta = entries[left].shape.minus(entries[right].shape);
            if (shapeDelta.abs().lte(RANKING_GAMMA)) continue;
            resolved += 1;
            const qDelta = entries[left].qshape.minus(entries[right].qshape);
            if (shapeDelta.times(qDelta).lte(0)) {
                discordant += 1;
                addFailure({
                    gate: 'ranking_loss_or_inversion',
                    stream,
                    executionUnitId: `${stream}:${caseId}`,
                    caseId,
                    cn: field(item, 'cn'),
                    targetCode: entries[left].targetCode,
                    comparisonCode: entries[right].targetCode,
                    observed: `SHAPE delta=${decimalToken(shapeDelta)}; Q-Shape delta=${decimalToken(qDelta)}`,
                    threshold: `same strict sign when |SHAPE delta|>${RANKING_GAMMA.toString()} CShM`,
                    details: qDelta.isZero()
                        ? 'Q-Shape collapsed a SHAPE-resolved pair into an exact tie'
                        : 'Q-Shape reversed a SHAPE-resolved pair'
                });
            }
        }
    }

    const selfCode = field(item, 'expectedOwnTargetCode', 'expected_own_target_code') ||
        field(item, 'parentReferenceCode', 'parent_reference_code');
    if (isRepresentationCase(item)) {
        const selfShape = entries.find(entry => entry.targetCode === selfCode);
        const selfQ = selfShape && qByPair.get(pairKey(caseId, selfCode));
        if (!selfShape || !selfQ) {
            addFailure({
                gate: 'ideal_self_not_evaluable',
                stream,
                executionUnitId: `${stream}:${caseId}:${selfCode || ''}`,
                caseId,
                cn: field(item, 'cn'),
                targetCode: selfCode || '',
                details: 'Canonical/representation self target is missing or invalid'
            });
        } else {
            if (selfShape.qshape.gte(IDEAL_SELF_Q_GATE)) {
                addFailure({
                    gate: 'ideal_self_qshape',
                    stream,
                    executionUnitId: `${stream}:${caseId}:${selfCode}`,
                    caseId,
                    cn: field(item, 'cn'),
                    targetCode: selfCode,
                    observed: decimalToken(selfShape.qshape),
                    threshold: '<1e-8 CShM',
                    details: 'Ideal/representation self Q-Shape measure is too large'
                });
            }
            if (selfShape.shape.gte(IDEAL_SELF_SHAPE_GATE)) {
                addFailure({
                    gate: 'ideal_self_shape',
                    stream,
                    executionUnitId: `${stream}:${caseId}:${selfCode}`,
                    caseId,
                    cn: field(item, 'cn'),
                    targetCode: selfCode,
                    observed: decimalToken(selfShape.shape),
                    threshold: '<0.01 CShM',
                    details: 'Ideal/representation self SHAPE measure is too large'
                });
            }
            if (!shapeTieSet.includes(selfCode)) {
                addFailure({
                    gate: 'ideal_nominal_outside_shape_tie_set',
                    stream,
                    executionUnitId: `${stream}:${caseId}:${selfCode}`,
                    caseId,
                    cn: field(item, 'cn'),
                    targetCode: selfCode,
                    observed: decimalToken(selfShape.shape.minus(shapeMinimum)),
                    threshold: `<=${RANKING_GAMMA.toString()} CShM above SHAPE minimum`,
                    details: 'Expected ideal/representation self target is outside SHAPE tie set'
                });
            }
        }
    }
    return {
        case_id: caseId,
        stream,
        ranking_status: 'evaluated',
        not_evaluable_targets: [],
        shape_best_code: shapeBest,
        qshape_best_code: qBest,
        shape_tie_set: shapeTieSet,
        qshape_tie_set: qTieSet,
        exact_best_label_agrees: shapeBest === qBest,
        qshape_best_within_shape_tie_set: qBestWithin,
        resolved_ranking_pairs: resolved,
        discordant_ranking_pairs: discordant,
        ranking_agreement_fraction: resolved === 0
            ? 'not_applicable'
            : decimalToken(new Decimal(resolved - discordant).dividedBy(resolved)),
        kendall_tau_b: kendall.tau_b,
        kendall_concordant_pairs: kendall.concordant,
        kendall_discordant_pairs: kendall.discordant,
        kendall_shape_only_ties: kendall.shape_only_ties,
        kendall_qshape_only_ties: kendall.qshape_only_ties,
        kendall_joint_ties: kendall.joint_ties,
        failure_count: 0,
        pass: true
    };
}

function analyzeMetamorphicParity(input = {}) {
    const collector = createFailureCollector();
    const addFailure = collector.addFailure;
    const inventoryByCn = normalizeInventory(field(input, 'inventory'), addFailure);
    const { expected, caseMap } = makeExpectedPairs(field(input, 'cases'), inventoryByCn, addFailure);
    const shapeRows = extractShapeRepetitions(input);
    const qRows = extractQStreams(input);

    const shapeValidated = {};
    for (const repetition of SHAPE_REPETITIONS) {
        shapeValidated[repetition] = validateRows(
            shapeRows[repetition], repetition, expected, caseMap, addFailure,
            { kind: 'shape', repetition }
        );
    }
    const qValidated = {};
    for (const stream of Q_STREAMS) {
        qValidated[stream] = validateRows(
            qRows[stream], stream, expected, caseMap, addFailure,
            { kind: 'qshape', stream }
        );
    }
    const boundaryControls = analyzeBoundaryControls(input, addFailure);

    const shapeConsensus = new Map();
    const shapeConsensusRows = [];
    for (const [key, expectedItem] of expected) {
        const r1 = shapeValidated.shape_r1.map.get(key);
        const r2 = shapeValidated.shape_r2.map.get(key);
        const t1 = r1 ? field(r1, 'valueToken', 'value_token') : '';
        const t2 = r2 ? field(r2, 'valueToken', 'value_token') : '';
        for (const [repetition, row, outToken] of [
            ['shape_r1', r1, t1],
            ['shape_r2', r2, t2]
        ]) {
            const tabToken = field(row, 'tabValueToken', 'tab_value_token');
            if (typeof tabToken !== 'string' || !/^\d+\.\d{3}$/.test(tabToken) ||
                !shapeTokenIsValid(outToken)) continue;
            const intervalDifference = finiteDecimal(outToken).minus(finiteDecimal(tabToken)).abs();
            if (intervalDifference.gt('0.000505')) addFailure({
                gate: 'shape_out_tab_inconsistency',
                repetition,
                executionUnitId: `shape-tab:${repetition}:${key}`,
                caseId: caseIdOf(expectedItem.caseItem),
                cn: field(expectedItem.caseItem, 'cn'),
                targetCode: expectedItem.targetCode,
                observed: `.out=${outToken}; .tab=${tabToken}`,
                threshold: '|out-tab|<=0.000505 CShM (overlapping printed-value intervals)',
                details: `SHAPE ${repetition} parseable .out/.tab values are inconsistent`
            });
        }
        const exact = Boolean(r1 && r2 && t1 === t2);
        if (r1 && r2 && !exact) {
            addFailure({
                gate: 'shape_repeatability_token',
                repetition: 'shape_r1|shape_r2',
                executionUnitId: `shape:${key}`,
                caseId: caseIdOf(expectedItem.caseItem),
                cn: field(expectedItem.caseItem, 'cn'),
                targetCode: expectedItem.targetCode,
                observed: `${t1}|${t2}`,
                threshold: 'identical five-decimal SHAPE token in both repetitions',
                details: 'SHAPE repetitions cannot form a consensus token'
            });
        }
        const value = exact && shapeTokenIsValid(t1) ? finiteDecimal(t1) : null;
        const valid = exact && shapeTokenIsValid(t1) && domainValid(value);
        if (exact && value && value.lt(0)) {
            addFailure({
                gate: 'shape_negative_cshm',
                repetition: 'shape_r1|shape_r2',
                executionUnitId: `shape:${key}`,
                caseId: caseIdOf(expectedItem.caseItem),
                cn: field(expectedItem.caseItem, 'cn'),
                targetCode: expectedItem.targetCode,
                observed: t1,
                threshold: '>=0 CShM',
                details: 'Consensus SHAPE value is negative'
            });
        }
        if (exact && value && value.gt(MAX_CSHM)) {
            addFailure({
                gate: 'shape_cshm_above_100',
                repetition: 'shape_r1|shape_r2',
                executionUnitId: `shape:${key}`,
                caseId: caseIdOf(expectedItem.caseItem),
                cn: field(expectedItem.caseItem, 'cn'),
                targetCode: expectedItem.targetCode,
                observed: t1,
                threshold: '<=100 CShM',
                details: 'Consensus SHAPE value exceeds the mathematical domain'
            });
        }
        shapeConsensus.set(key, { value, token: exact ? t1 : '', rep1Token: t1, rep2Token: t2, exact, valid });
        shapeConsensusRows.push({
            case_id: caseIdOf(expectedItem.caseItem),
            target_code: expectedItem.targetCode,
            shape_r1_token: t1,
            shape_r2_token: t2,
            shape_consensus_token: exact ? t1 : '',
            exact_token_agreement: exact,
            domain_valid: valid
        });
    }

    const comparisonRows = [];
    const caseSummaries = [];
    const streamSummaries = {};
    for (const stream of Q_STREAMS) {
        const streamValidated = qValidated[stream];
        const perCase = [];
        for (const [caseId, item] of caseMap) {
            const targetCodes = targetCodesForCase(item, inventoryByCn);
            const caseInvalid = streamValidated.invalidCases.has(caseId);
            for (const targetCode of targetCodes) {
                const key = pairKey(caseId, targetCode);
                const shape = shapeConsensus.get(key);
                const q = streamValidated.map.get(key);
                const qValue = q ? valueForRow(q) : null;
                const valid = pairIsDomainValid(shape, q);
                const signedError = valid ? qValue.minus(shape.value) : null;
                const absoluteError = signedError ? signedError.abs() : null;
                if (valid && !absoluteError.lt(ABS_ERROR_GATE)) {
                    addFailure({
                        gate: 'absolute_error',
                        stream,
                        executionUnitId: `${stream}:${caseId}:${targetCode}`,
                        caseId,
                        cn: field(item, 'cn'),
                        targetCode,
                        observed: decimalToken(absoluteError),
                        threshold: '<0.01 CShM',
                        details: `Q-Shape ${field(q, 'valueToken', 'value_token')}; SHAPE ${shape.token}`
                    });
                }
                if (qValue && qValue.lt(0)) {
                    addFailure({
                        gate: 'qshape_negative_cshm',
                        stream,
                        executionUnitId: `${stream}:${caseId}:${targetCode}`,
                        caseId,
                        cn: field(item, 'cn'),
                        targetCode,
                        observed: field(q, 'valueToken', 'value_token'),
                        threshold: '>=0 CShM',
                        details: 'Q-Shape result is negative'
                    });
                }
                if (qValue && qValue.gt(MAX_CSHM)) {
                    addFailure({
                        gate: 'qshape_cshm_above_100',
                        stream,
                        executionUnitId: `${stream}:${caseId}:${targetCode}`,
                        caseId,
                        cn: field(item, 'cn'),
                        targetCode,
                        observed: field(q, 'valueToken', 'value_token'),
                        threshold: '<=100 CShM',
                        details: 'Q-Shape result exceeds the mathematical domain'
                    });
                }
                if (q && ['NaN', 'Infinity', '-Infinity'].includes(
                    field(q, 'valueToken', 'value_token')
                )) {
                    addFailure({
                        gate: 'qshape_nonfinite_cshm',
                        stream,
                        executionUnitId: `${stream}:${caseId}:${targetCode}`,
                        caseId,
                        cn: field(item, 'cn'),
                        targetCode,
                        observed: field(q, 'valueToken', 'value_token'),
                        threshold: 'finite CShM within [0, 100]',
                        details: 'Q-Shape result is non-finite'
                    });
                }
                const metadata = reportingMetadata(item, stream, q);
                comparisonRows.push({
                    stream,
                    case_id: caseId,
                    target_code: targetCode,
                    ...metadata,
                    shape_r1_token: shape ? shape.rep1Token : '',
                    shape_r2_token: shape ? shape.rep2Token : '',
                    shape_consensus_token: shape ? shape.token : '',
                    qshape_token: q ? field(q, 'valueToken', 'value_token') : '',
                    qshape_float64_hex: q ? (qBits(q) || '') : '',
                    signed_error: decimalOrEmpty(signedError),
                    absolute_error: decimalOrEmpty(absoluteError),
                    result_domain_valid: valid,
                    pass_abs_0_01: Boolean(valid && absoluteError.lt(ABS_ERROR_GATE)),
                    seed_policy: q ? field(q, 'seedPolicy', 'seed_policy') || '' : '',
                    explicit_seed_uint32: q ? field(q, 'explicitSeed', 'explicit_seed_uint32', 'explicit_seed') ?? '' : ''
                });
            }
            const summary = rankCase(
                item,
                targetCodes,
                shapeConsensus,
                streamValidated.map,
                caseInvalid,
                addFailure,
                stream
            );
            const directFailures = collector.raw.filter(failure =>
                failure.stream === stream && failure.case_id === caseId
            );
            summary.failure_count = directFailures.length;
            summary.pass = directFailures.length === 0;
            perCase.push(summary);
            caseSummaries.push(summary);
        }
        const streamFailures = collector.raw.filter(failure => failure.stream === stream);
        const streamRows = comparisonRows.filter(row => row.stream === stream);
        streamSummaries[stream] = {
            stream,
            seed_mode: streamKind(stream),
            explicit_seed_uint32: expectedSeed(stream),
            cases_expected: caseMap.size,
            comparisons_expected: expected.size,
            comparisons_observed: streamValidated.map.size,
            comparisons_domain_valid: streamRows.filter(row => row.result_domain_valid).length,
            case_summaries: perCase,
            failures: streamFailures.length,
            campaign_gate_status: streamFailures.length === 0 ? 'pass' : 'fail'
        };
    }

    // The only Q repeatability gate is between the two input-derived primary
    // streams.  Explicit seed streams are independent executions, not pooled
    // repetitions and not a source of post-hoc seed selection.
    let repeatabilityCompared = 0;
    let repeatabilityPass = true;
    const qPrimaryR1 = qValidated.q_primary_input_derived_r1.map;
    const qPrimaryR2 = qValidated.q_primary_input_derived_r2.map;
    for (const [key, expectedItem] of expected) {
        const left = qPrimaryR1.get(key);
        const right = qPrimaryR2.get(key);
        const leftBits = left && qBits(left);
        const rightBits = right && qBits(right);
        if (!leftBits || !rightBits) {
            repeatabilityPass = false;
            addFailure({
                gate: 'qshape_primary_repeatability_not_evaluable',
                stream: 'q_primary_input_derived_r1|q_primary_input_derived_r2',
                executionUnitId: `q-primary:${key}`,
                caseId: caseIdOf(expectedItem.caseItem),
                cn: field(expectedItem.caseItem, 'cn'),
                targetCode: expectedItem.targetCode,
                observed: `${leftBits || 'missing'}|${rightBits || 'missing'}`,
                threshold: 'bit-identical binary64 result bits in both primary repetitions',
                details: 'Primary repeatability cannot be assessed for a missing/invalid row'
            });
        } else {
            repeatabilityCompared += 1;
            if (leftBits !== rightBits) {
                repeatabilityPass = false;
                addFailure({
                    gate: 'qshape_primary_repeatability_bits',
                    stream: 'q_primary_input_derived_r1|q_primary_input_derived_r2',
                    executionUnitId: `q-primary:${key}`,
                    caseId: caseIdOf(expectedItem.caseItem),
                    cn: field(expectedItem.caseItem, 'cn'),
                    targetCode: expectedItem.targetCode,
                    observed: `${leftBits}|${rightBits}`,
                    threshold: 'identical IEEE-754 binary64 hexadecimal bits',
                    details: 'Primary input-derived repetitions differ at the bit level'
                });
            }
        }
    }

    const relationSummaries = [];
    for (const item of caseMap.values()) {
        const descriptor = relationDescriptor(item, caseMap);
        if (!descriptor.authorized) continue;
        const childId = caseIdOf(item);
        const parent = descriptor.parent;
        const parentId = descriptor.parentId;
        const expectedParentId = descriptor.expectedParent ? caseIdOf(descriptor.expectedParent) : '';
        if (!parent || !parentId || (descriptor.declaredParentId && parentId !== expectedParentId)) {
            addFailure({
                gate: 'relation_parent_contract',
                executionUnitId: `relation:${childId}`,
                caseId: childId,
                cn: field(item, 'cn'),
                observed: parentId || 'missing',
                threshold: expectedParentId || 'authorized parent case',
                details: 'Only the preregistered parent relation may be gated'
            });
            relationSummaries.push({
                child_case_id: childId,
                parent_case_id: parentId,
                relation_status: 'not_evaluable',
                authorized: true,
                expected_parent_case_id: expectedParentId,
                shape_exact_token: 'not_evaluable',
                q_explicit_streams: {}
            });
            continue;
        }
        const relation = {
            child_case_id: childId,
            parent_case_id: parentId,
            relation_status: 'pass',
            authorized: true,
            expected_parent_case_id: expectedParentId,
            shape_exact_token: 'pass',
            q_explicit_streams: {}
        };
        const childTargetCodes = targetCodesForCase(item, inventoryByCn);
        for (const targetCode of childTargetCodes) {
            const key = pairKey(childId, targetCode);
            const parentKey = pairKey(parentId, targetCode);
            const childShape = shapeConsensus.get(key);
            const parentShape = shapeConsensus.get(parentKey);
            if (!childShape || !parentShape || !childShape.valid || !parentShape.valid) {
                if (relation.shape_exact_token !== 'fail') {
                    relation.shape_exact_token = 'not_evaluable';
                }
                continue;
            }
            if (childShape.token !== parentShape.token) {
                relation.shape_exact_token = 'fail';
                addFailure({
                    gate: 'shape_parent_child_exact_token',
                    executionUnitId: `relation:${childId}:${targetCode}`,
                    caseId: childId,
                    cn: field(item, 'cn'),
                    targetCode,
                    comparisonCode: parentId,
                    observed: `${parentShape.token}|${childShape.token}`,
                    threshold: 'identical five-decimal SHAPE consensus token',
                    details: 'Authorized representation relation changed the SHAPE token'
                });
            }
        }
        for (const stream of Q_STREAMS) {
            if (streamKind(stream) !== 'explicit-seed') {
                relation.q_explicit_streams[stream] = 'not_applicable';
                continue;
            }
            let status = 'pass';
            for (const targetCode of childTargetCodes) {
                const key = pairKey(childId, targetCode);
                const child = qValidated[stream].map.get(key);
                const parentRow = qValidated[stream].map.get(pairKey(parentId, targetCode));
                const childValue = child && valueForRow(child);
                const parentValue = parentRow && valueForRow(parentRow);
                if (!childValue || !parentValue || !domainValid(childValue) || !domainValid(parentValue)) {
                    if (status !== 'fail') status = 'not_evaluable';
                    continue;
                }
                const difference = childValue.minus(parentValue).abs();
                if (difference.gt(RELATIONAL_Q_GATE)) {
                    status = 'fail';
                    addFailure({
                        gate: 'qshape_parent_child_explicit_invariance',
                        stream,
                        executionUnitId: `relation:${stream}:${childId}:${targetCode}`,
                        caseId: childId,
                        cn: field(item, 'cn'),
                        targetCode,
                        comparisonCode: parentId,
                        observed: decimalToken(difference),
                        threshold: '<=1e-8 CShM under the same explicit seed',
                        details: `Authorized relation failed for ${stream}`
                    });
                }
            }
            relation.q_explicit_streams[stream] = status;
        }
        if (relation.shape_exact_token === 'fail' ||
            Object.values(relation.q_explicit_streams).includes('fail')) {
            relation.relation_status = 'fail';
        } else if (relation.shape_exact_token === 'not_evaluable' ||
            Object.values(relation.q_explicit_streams).includes('not_evaluable')) {
            relation.relation_status = 'not_evaluable';
        }
        relationSummaries.push(relation);
    }

    const pairedSignRows = buildPairedSignRows(
        caseMap,
        inventoryByCn,
        shapeConsensus,
        qValidated
    );
    const stratifiedStatistics = buildStratifiedStatistics(comparisonRows);
    const failures = collector.finalize();
    for (const summary of caseSummaries) {
        summary.failure_count = failures.filter(failure =>
            failure.stream === summary.stream && failure.case_id === summary.case_id
        ).length;
        summary.pass = summary.failure_count === 0;
    }
    for (const stream of Q_STREAMS) {
        streamSummaries[stream].failures = failures.filter(failure => failure.stream === stream).length;
        streamSummaries[stream].campaign_gate_status = streamSummaries[stream].failures === 0
            ? 'pass' : 'fail';
    }

    const allComparisonRows = comparisonRows;
    const allSignedErrors = allComparisonRows
        .filter(row => row.result_domain_valid)
        .map(row => finiteDecimal(row.signed_error))
        .filter(Boolean);
    const relationFailures = failures.filter(failure =>
        failure.gate.startsWith('relation_') || failure.gate.startsWith('shape_parent_child_') ||
        failure.gate.startsWith('qshape_parent_child_')
    ).length;
    const summary = {
        schema_version: 1,
        campaign_gate_status: failures.length === 0 ? 'pass' : 'fail',
        overall_validation_status: 'incomplete',
        claim_boundary: 'metamorphic representation and distortion robustness; not external chemical validity',
        gates: {
            streams: Q_STREAMS,
            shape_repetitions: SHAPE_REPETITIONS,
            absolute_error_cshm: '<0.01',
            cshm_domain: 'finite and within [0, 100]',
            qshape_nonfinite_cshm: 'canonical retained result is a scientific gate failure',
            ideal_self_qshape_cshm: '<1e-8',
            ideal_self_shape_cshm: '<0.01',
            shape_repeatability: 'exact five-decimal lexical token',
            shape_out_tab_consistency: '|out-tab|<=0.000505 CShM',
            shape_tie_set_gamma_cshm: RANKING_GAMMA.toString(),
            resolved_ranking_pairs: 'same strict sign when |SHAPE delta|>gamma',
            primary_q_repeatability: 'identical IEEE-754 binary64 hexadecimal bits',
            authorized_relations: 'six canonical representation children plus distorted-twin; explicit Q only'
        },
        totals: {
            cases: caseMap.size,
            comparisons_expected: expected.size,
            comparisons_observed: comparisonRows.length,
            comparisons_domain_valid: allComparisonRows.filter(row => row.result_domain_valid).length,
            signed_error_count: allSignedErrors.length,
            relation_failures: relationFailures,
            failures: failures.length
        },
        shape_consensus: {
            comparisons_expected: shapeConsensusRows.length,
            exact_token_agree: shapeConsensusRows.filter(row => row.exact_token_agreement).length,
            domain_valid: shapeConsensusRows.filter(row => row.domain_valid).length,
            rows: shapeConsensusRows
        },
        primary_q_repeatability: {
            compared: repeatabilityCompared,
            bit_identical: repeatabilityPass,
            status: repeatabilityPass ? 'pass' : 'fail'
        },
        relation_counts: {
            authorized_relations: relationSummaries.length,
            failed_relations: relationSummaries.filter(row => row.relation_status === 'fail').length,
            not_evaluable_relations: relationSummaries.filter(row => row.relation_status === 'not_evaluable').length,
            input_derived_q_relation_gate: 'not_applicable'
        },
        malformed_controls: boundaryControls,
        reporting_counts: {
            tidy_comparison_rows: comparisonRows.length,
            case_summary_rows: caseSummaries.length,
            authorized_relation_rows: relationSummaries.length,
            paired_sign_rows: pairedSignRows.length,
            paired_sign_not_evaluable_rows: pairedSignRows.filter(row => row.status !== 'evaluable').length,
            stratified_statistics_rows: stratifiedStatistics.length
        }
    };

    return {
        schema_version: 1,
        summary,
        primary_q_repeatability: summary.primary_q_repeatability,
        stream_summaries: streamSummaries,
        comparison_rows: comparisonRows,
        case_summaries: caseSummaries,
        relation_summaries: relationSummaries,
        paired_sign_rows: pairedSignRows,
        stratified_statistics: stratifiedStatistics,
        failures,
        failure_ledger: failures
    };
}

module.exports = {
    ABS_ERROR_GATE: ABS_ERROR_GATE.toString(),
    EXPLICIT_SEEDS,
    IDEAL_SELF_Q_GATE: IDEAL_SELF_Q_GATE.toString(),
    IDEAL_SELF_SHAPE_GATE: IDEAL_SELF_SHAPE_GATE.toString(),
    MAX_CSHM: MAX_CSHM.toString(),
    Q_STREAMS,
    RANKING_GAMMA: RANKING_GAMMA.toString(),
    RELATIONAL_Q_GATE: RELATIONAL_Q_GATE.toString(),
    SHAPE_REPETITIONS,
    analyzeMetamorphicParity,
    analyzeBoundaryControls,
    buildPairedSignRows,
    buildStratifiedStatistics,
    decimalToken,
    exactErrorStatistics,
    exactRuntimeStatistics,
    finiteDecimal,
    gammaAwareKendall,
    pairKey,
    qBits,
    qTokenBits,
    shapeTokenIsValid
};

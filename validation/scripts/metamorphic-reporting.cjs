'use strict';

const fs = require('node:fs');
const path = require('node:path');

const Q_STREAMS = Object.freeze([
    'q_primary_input_derived_r1',
    'q_primary_input_derived_r2',
    'q_explicit_seed_0',
    'q_explicit_seed_1364412496',
    'q_explicit_seed_4294967295'
]);

const TABLES = Object.freeze({
    'comparison-rows.csv': {
        source: 'comparison_rows',
        row_semantics: 'one matched case-target evaluation for one independent Q-Shape stream, paired to the two-run SHAPE consensus',
        primary_key: ['stream', 'case_id', 'target_code'],
        columns: [
            'stream', 'case_id', 'target_code', 'cn', 'stratum', 'family', 'geometry_family',
            'recipe_id', 'recipe_index', 'recipe_category', 'distortion_type', 'distortion_sign',
            'distortion_magnitude', 'input_precision_digits', 'optimizer_seed_mode',
            'optimizer_seed_uint32', 'browser', 'execution_mode', 'qshape_runtime_ms',
            'shape_r1_token', 'shape_r2_token', 'shape_consensus_token', 'qshape_token',
            'qshape_float64_hex', 'signed_error', 'absolute_error', 'result_domain_valid',
            'pass_abs_0_01', 'seed_policy', 'explicit_seed_uint32'
        ]
    },
    'case-summaries.csv': {
        source: 'case_summaries',
        row_semantics: 'one complete same-CN ranking comparison for one case and one independent Q-Shape stream',
        primary_key: ['stream', 'case_id'],
        columns: [
            'stream', 'case_id', 'ranking_status', 'not_evaluable_targets_json', 'shape_best_code',
            'qshape_best_code', 'shape_tie_set_json', 'qshape_tie_set_json',
            'exact_best_label_agrees', 'qshape_best_within_shape_tie_set',
            'resolved_ranking_pairs', 'discordant_ranking_pairs', 'ranking_agreement_fraction',
            'kendall_tau_b', 'kendall_concordant_pairs', 'kendall_discordant_pairs',
            'kendall_shape_only_ties', 'kendall_qshape_only_ties', 'kendall_joint_ties',
            'failure_count', 'pass'
        ]
    },
    'relation-summaries.csv': {
        source: 'relation_summaries',
        row_semantics: 'one preregistered authorized parent-child relation, with per-stream applicability or result',
        primary_key: ['child_case_id'],
        columns: [
            'child_case_id', 'parent_case_id', 'expected_parent_case_id', 'authorized',
            'relation_status', 'shape_exact_token',
            'q_primary_input_derived_r1_status', 'q_primary_input_derived_r2_status',
            'q_explicit_seed_0_status', 'q_explicit_seed_1364412496_status',
            'q_explicit_seed_4294967295_status'
        ]
    },
    'paired-sign-deltas.csv': {
        source: 'paired_sign_rows',
        row_semantics: 'one preregistered minus/plus distortion pair for one geometry, target, and Q-Shape stream; descriptive, not a response-model fit',
        primary_key: ['stream', 'cn', 'geometry_family', 'target_code', 'distortion_type', 'distortion_magnitude'],
        columns: [
            'stream', 'optimizer_seed_mode', 'optimizer_seed_uint32', 'cn', 'geometry_family',
            'target_code', 'distortion_type', 'distortion_magnitude', 'minus_case_id', 'plus_case_id',
            'shape_minus_token', 'shape_plus_token', 'qshape_minus_token', 'qshape_plus_token',
            'delta_shape', 'delta_qshape', 'delta_error', 'cshm_unit', 'status'
        ]
    },
    'stratified-statistics.csv': {
        source: 'stratified_statistics',
        row_semantics: 'one exact descriptive error/runtime summary for one stream, stratification dimension, and level',
        primary_key: ['stream', 'dimension', 'level'],
        columns: [
            'stream', 'optimizer_seed_mode', 'optimizer_seed_uint32', 'dimension', 'level',
            'comparisons_total', 'comparisons_domain_valid', 'cshm_unit', 'runtime_unit', 'count',
            'signed_bias', 'mean_absolute_error', 'root_mean_square_error',
            'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
            'maximum_absolute_error', 'runtime_count', 'runtime_mean_ms', 'runtime_median_ms',
            'runtime_p95_ms', 'runtime_p99_ms', 'runtime_maximum_ms'
        ]
    },
    'shape-consensus.csv': {
        source: 'summary.shape_consensus.rows',
        row_semantics: 'one matched case-target SHAPE result retaining both lexical repetitions and their admissible consensus',
        primary_key: ['case_id', 'target_code'],
        columns: [
            'case_id', 'target_code', 'shape_r1_token', 'shape_r2_token',
            'shape_consensus_token', 'exact_token_agreement', 'domain_valid'
        ]
    },
    'stream-summaries.csv': {
        source: 'stream_summaries',
        row_semantics: 'one execution/census summary for each preregistered Q-Shape stream',
        primary_key: ['stream'],
        columns: [
            'stream', 'seed_mode', 'explicit_seed_uint32', 'cases_expected', 'comparisons_expected',
            'comparisons_observed', 'comparisons_domain_valid', 'failures', 'campaign_gate_status'
        ]
    },
    'failure-ledger.csv': {
        source: 'failure_ledger',
        row_semantics: 'one typed gate-failure event; header is retained even when no failure occurs',
        primary_key: ['failure_id'],
        columns: [
            'failure_id', 'event_type', 'gate', 'status', 'severity', 'stream', 'repetition',
            'execution_unit_id', 'case_id', 'cn', 'target_code', 'comparison_code',
            'observed', 'threshold', 'details'
        ]
    }
});

const INTEGER_COLUMNS = new Set([
    'cn', 'recipe_index', 'optimizer_seed_uint32', 'explicit_seed_uint32',
    'resolved_ranking_pairs', 'discordant_ranking_pairs', 'kendall_concordant_pairs',
    'kendall_discordant_pairs', 'kendall_shape_only_ties', 'kendall_qshape_only_ties',
    'kendall_joint_ties', 'failure_count', 'comparisons_total', 'comparisons_domain_valid',
    'count', 'runtime_count', 'cases_expected', 'comparisons_expected', 'comparisons_observed',
    'failures'
]);
const BOOLEAN_COLUMNS = new Set([
    'result_domain_valid', 'pass_abs_0_01', 'exact_best_label_agrees',
    'qshape_best_within_shape_tie_set', 'authorized', 'pass',
    'exact_token_agreement', 'domain_valid'
]);
const CSHM_COLUMNS = new Set([
    'shape_r1_token', 'shape_r2_token', 'shape_consensus_token', 'qshape_token',
    'signed_error', 'absolute_error', 'shape_minus_token', 'shape_plus_token',
    'qshape_minus_token', 'qshape_plus_token', 'delta_shape', 'delta_qshape', 'delta_error',
    'signed_bias', 'mean_absolute_error', 'root_mean_square_error',
    'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
    'maximum_absolute_error'
]);
const RUNTIME_COLUMNS = new Set([
    'qshape_runtime_ms', 'runtime_mean_ms', 'runtime_median_ms',
    'runtime_p95_ms', 'runtime_p99_ms', 'runtime_maximum_ms'
]);

const DEFINITIONS = Object.freeze({
    stream: 'Preregistered independent Q-Shape execution stream identifier.',
    case_id: 'Stable preregistered positive-case identifier.',
    child_case_id: 'Stable preregistered child-case identifier for an authorized relation.',
    parent_case_id: 'Parent case declared by the frozen child record.',
    expected_parent_case_id: 'Parent case independently implied by the frozen recipe contract.',
    target_code: 'Coordination-geometry target code evaluated by both programs.',
    comparison_code: 'Second target or case code involved in a failed relational/ranking comparison.',
    cn: 'Coordination number, excluding the central atom.',
    stratum: 'Frozen evidence stratum of the case.',
    family: 'Main-positive or adversarial-positive case family.',
    geometry_family: 'Frozen parent reference geometry code.',
    recipe_id: 'Stable transformation recipe identifier.',
    recipe_index: 'One-based recipe ordinal within its frozen registry.',
    recipe_category: 'Frozen transformation category.',
    distortion_type: 'Radial, angular, mixed, or not-applicable descriptor derived from recipe ID.',
    distortion_sign: 'Minus, plus, or not-applicable direction derived from recipe ID.',
    distortion_magnitude: 'Lexical preregistered distortion magnitude; not silently coerced to a physical unit.',
    input_precision_digits: 'Retained decimal precision for precision recipes, or not_applicable.',
    optimizer_seed_mode: 'Input-derived or explicit-seed optimizer mode.',
    optimizer_seed_uint32: 'Unsigned 32-bit explicit seed; empty only when the stream is input-derived.',
    explicit_seed_uint32: 'Unsigned 32-bit seed reported by the execution row; empty only when not applicable.',
    seed_mode: 'Input-derived or explicit-seed stream class.',
    seed_policy: 'Seed policy reported by the Q-Shape worker for this row.',
    browser: 'Browser stratum; node-worker rows are explicitly not applicable to browser validation.',
    execution_mode: 'Q-Shape execution mode retained from the worker row.',
    qshape_runtime_ms: 'Diagnostic Q-Shape target runtime token; never used as an accuracy gate.',
    shape_r1_token: 'SHAPE repetition-1 CShM token retained at the oracle lexical resolution.',
    shape_r2_token: 'SHAPE repetition-2 CShM token retained at the oracle lexical resolution.',
    shape_consensus_token: 'Admissible SHAPE token only when both lexical repetitions agree exactly.',
    qshape_token: 'Canonical binary64 round-trip Q-Shape CShM token.',
    qshape_float64_hex: 'Sixteen-lowercase-hex-digit IEEE-754 binary64 representation of qshape_token.',
    signed_error: 'Q-Shape minus SHAPE-consensus CShM.',
    absolute_error: 'Absolute Q-Shape/SHAPE-consensus CShM difference.',
    result_domain_valid: 'True only when both paired results are finite and in [0,100].',
    pass_abs_0_01: 'True only when the valid absolute difference is strictly below 0.01 CShM.',
    ranking_status: 'Complete-set ranking evaluation status; never computed on a valid subset.',
    not_evaluable_targets_json: 'JSON array of target codes preventing complete-set ranking evaluation.',
    shape_best_code: 'Lexically tie-broken lowest-CShM SHAPE target code.',
    qshape_best_code: 'Lexically tie-broken lowest-CShM Q-Shape target code.',
    shape_tie_set_json: 'JSON array of targets within preregistered gamma of the SHAPE minimum.',
    qshape_tie_set_json: 'JSON array of targets within preregistered gamma of the Q-Shape minimum.',
    exact_best_label_agrees: 'Whether the tie-broken best target labels are identical.',
    qshape_best_within_shape_tie_set: 'Whether the Q-Shape best belongs to the SHAPE gamma tie set.',
    resolved_ranking_pairs: 'Number of target pairs resolved by SHAPE beyond gamma.',
    discordant_ranking_pairs: 'Number of SHAPE-resolved target pairs lost or inverted by Q-Shape.',
    ranking_agreement_fraction: 'Exact decimal fraction of SHAPE-resolved pairs preserving strict sign.',
    kendall_tau_b: 'Gamma-aware Kendall tau-b token, or empty when mathematically undefined.',
    kendall_concordant_pairs: 'Gamma-aware concordant target-pair count.',
    kendall_discordant_pairs: 'Gamma-aware discordant target-pair count.',
    kendall_shape_only_ties: 'Target-pair count tied only by SHAPE under gamma.',
    kendall_qshape_only_ties: 'Target-pair count tied only by Q-Shape under gamma.',
    kendall_joint_ties: 'Target-pair count tied by both programs under gamma.',
    failure_count: 'Typed gate-failure events assigned to this case/stream row.',
    pass: 'True only when the case/stream has no typed gate failure.',
    authorized: 'Whether the relation belongs to the preregistered relation allowlist.',
    relation_status: 'Aggregate pass, fail, or not_evaluable relation status.',
    shape_exact_token: 'Status of exact SHAPE parent-child token invariance.',
    q_primary_input_derived_r1_status: 'Relation gate applicability for the first input-derived stream.',
    q_primary_input_derived_r2_status: 'Relation gate applicability for the second input-derived stream.',
    q_explicit_seed_0_status: 'Relation status for explicit seed 0.',
    q_explicit_seed_1364412496_status: 'Relation status for explicit seed 1364412496.',
    q_explicit_seed_4294967295_status: 'Relation status for explicit seed 4294967295.',
    minus_case_id: 'Case identifier for the preregistered negative-sign distortion.',
    plus_case_id: 'Case identifier for the preregistered positive-sign distortion.',
    shape_minus_token: 'SHAPE CShM consensus token for the minus case.',
    shape_plus_token: 'SHAPE CShM consensus token for the plus case.',
    qshape_minus_token: 'Q-Shape CShM token for the minus case.',
    qshape_plus_token: 'Q-Shape CShM token for the plus case.',
    delta_shape: 'SHAPE plus-minus CShM difference; descriptive only.',
    delta_qshape: 'Q-Shape plus-minus CShM difference; descriptive only.',
    delta_error: 'delta_qshape minus delta_shape; descriptive only.',
    cshm_unit: 'Explicit unit label for CShM-valued fields.',
    runtime_unit: 'Explicit unit label for runtime-valued fields.',
    status: 'Row-specific typed status defined by the table row semantics.',
    dimension: 'Stratification dimension name.',
    level: 'Exact retained level within the stratification dimension.',
    comparisons_total: 'All matched comparison rows in the stratum.',
    comparisons_domain_valid: 'Matched comparison rows with both results finite and in [0,100].',
    count: 'Number of domain-valid signed errors used for error statistics.',
    signed_bias: 'Exact mean signed Q-Shape-minus-SHAPE error token.',
    mean_absolute_error: 'Exact mean absolute error token.',
    root_mean_square_error: 'Exact root-mean-square error token.',
    median_absolute_error: 'Exact median absolute error token using the frozen estimator.',
    p95_absolute_error: 'Nearest-rank 95th percentile absolute error token.',
    p99_absolute_error: 'Nearest-rank 99th percentile absolute error token.',
    maximum_absolute_error: 'Maximum absolute error token.',
    runtime_count: 'Number of finite runtime tokens used for runtime statistics.',
    runtime_mean_ms: 'Exact mean diagnostic runtime token.',
    runtime_median_ms: 'Exact median diagnostic runtime token.',
    runtime_p95_ms: 'Nearest-rank 95th percentile diagnostic runtime token.',
    runtime_p99_ms: 'Nearest-rank 99th percentile diagnostic runtime token.',
    runtime_maximum_ms: 'Maximum diagnostic runtime token.',
    exact_token_agreement: 'Whether both SHAPE repetition tokens agree byte-for-byte.',
    domain_valid: 'Whether the retained consensus token is finite and in [0,100].',
    cases_expected: 'Preregistered positive-case count for the stream.',
    comparisons_expected: 'Preregistered matched case-target count for the stream.',
    comparisons_observed: 'Observed unique valid-identity row count before numerical gates.',
    failures: 'Typed gate-failure event count for the stream.',
    campaign_gate_status: 'Pass only when no preregistered gate fails.',
    failure_id: 'Deterministic identifier derived from the full failure event.',
    event_type: 'Typed failure-event category.',
    gate: 'Preregistered gate that produced the failure.',
    severity: 'Failure severity class.',
    repetition: 'SHAPE repetition identity, or combined identity when applicable.',
    execution_unit_id: 'Stable process/stream/case/target execution-unit identifier.',
    observed: 'Lexical observed value or typed condition causing failure.',
    threshold: 'Lexical preregistered threshold or expected condition.',
    details: 'Deterministic explanatory detail without omitted failure state.'
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function csvCell(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') throw new Error('nested object reached CSV cell');
    if (typeof value === 'number') assert(Number.isFinite(value), 'non-finite number reached CSV cell');
    const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows, columns) {
    assert(Array.isArray(rows), 'CSV rows must be an array');
    assert(Array.isArray(columns) && columns.length > 0, 'CSV columns must be nonempty');
    const header = columns.join(',');
    if (rows.length === 0) return `${header}\n`;
    return `${header}\n${rows.map(row => columns.map(column => csvCell(row[column])).join(',')).join('\n')}\n`;
}

function sorted(rows, key) {
    return [...rows].sort((left, right) => key.map(column =>
        String(left[column] ?? '').localeCompare(String(right[column] ?? ''), 'en', { numeric: true })
    ).find(value => value !== 0) || 0);
}

function project(row, columns) {
    return Object.fromEntries(columns.map(column => [column, row?.[column] ?? '']));
}

function prepareTableRows(fileName, analysis) {
    const table = TABLES[fileName];
    assert(table, `unknown reporting table ${fileName}`);
    let rows;
    if (fileName === 'case-summaries.csv') {
        rows = (analysis.case_summaries || []).map(row => ({
            ...row,
            not_evaluable_targets_json: JSON.stringify(row.not_evaluable_targets || []),
            shape_tie_set_json: JSON.stringify(row.shape_tie_set || []),
            qshape_tie_set_json: JSON.stringify(row.qshape_tie_set || [])
        }));
    } else if (fileName === 'relation-summaries.csv') {
        rows = (analysis.relation_summaries || []).map(row => ({
            ...row,
            ...Object.fromEntries(Q_STREAMS.map(stream => [
                `${stream}_status`,
                row.q_explicit_streams?.[stream] ?? 'not_evaluable'
            ]))
        }));
    } else if (fileName === 'stratified-statistics.csv') {
        rows = (analysis.stratified_statistics || []).map(row => ({
            ...row,
            runtime_count: row.runtime?.count ?? 0,
            runtime_mean_ms: row.runtime?.mean_ms ?? 'not_evaluable',
            runtime_median_ms: row.runtime?.median_ms ?? 'not_evaluable',
            runtime_p95_ms: row.runtime?.p95_ms ?? 'not_evaluable',
            runtime_p99_ms: row.runtime?.p99_ms ?? 'not_evaluable',
            runtime_maximum_ms: row.runtime?.maximum_ms ?? 'not_evaluable'
        }));
    } else if (fileName === 'shape-consensus.csv') {
        rows = analysis.summary?.shape_consensus?.rows || [];
    } else if (fileName === 'stream-summaries.csv') {
        rows = Object.values(analysis.stream_summaries || {}).map(row => ({
            stream: row.stream,
            seed_mode: row.seed_mode,
            explicit_seed_uint32: row.explicit_seed_uint32 ?? '',
            cases_expected: row.cases_expected,
            comparisons_expected: row.comparisons_expected,
            comparisons_observed: row.comparisons_observed,
            comparisons_domain_valid: row.comparisons_domain_valid,
            failures: row.failures,
            campaign_gate_status: row.campaign_gate_status
        }));
    } else if (fileName === 'failure-ledger.csv') {
        rows = analysis.failure_ledger || analysis.failures || [];
    } else {
        rows = analysis[table.source] || [];
    }
    return sorted(rows.map(row => project(row, table.columns)), table.primary_key);
}

function columnSpec(name) {
    assert(DEFINITIONS[name], `missing data-dictionary definition for ${name}`);
    const notApplicable = [
        'optimizer_seed_uint32', 'explicit_seed_uint32', 'kendall_tau_b',
        'shape_best_code', 'qshape_best_code', 'shape_consensus_token', 'signed_error',
        'absolute_error', 'qshape_runtime_ms', 'observed', 'threshold', 'comparison_code',
        'case_id', 'target_code', 'stream', 'repetition'
    ].includes(name);
    return {
        name,
        data_type: BOOLEAN_COLUMNS.has(name) ? 'boolean_token' :
            INTEGER_COLUMNS.has(name) ? 'integer_or_not_applicable' :
                (CSHM_COLUMNS.has(name) || RUNTIME_COLUMNS.has(name) ||
                    ['ranking_agreement_fraction', 'kendall_tau_b'].includes(name))
                    ? 'exact_decimal_token_or_typed_missing' : 'utf8_string',
        unit: CSHM_COLUMNS.has(name) ? 'dimensionless_CShM' :
            RUNTIME_COLUMNS.has(name) ? 'ms' :
                (name.endsWith('_uint32') ? 'uint32' :
                    (INTEGER_COLUMNS.has(name) ? 'count_or_index' : 'not_applicable')),
        missingness: notApplicable
            ? 'empty only when structurally not applicable or not evaluable; companion status/validity and failure-ledger fields are authoritative'
            : 'not permitted unless the row semantics explicitly define an empty identifier for a package-level event',
        definition: DEFINITIONS[name]
    };
}

function buildDataDictionary() {
    return {
        schema_version: 2,
        artifact_status: 'working_qualification_evidence',
        quantity_policy: {
            cshm: 'dimensionless continuous shape measure; lexical tokens are never rounded again by reporting',
            runtime: 'milliseconds; diagnostic only and not an accuracy gate',
            missingness: 'empty CSV cells are typed by this dictionary and companion status columns; literal NaN/undefined/null are forbidden',
            precision: 'source lexical resolution is preserved; statistics use the frozen exact-decimal estimator contract'
        },
        tables: Object.fromEntries(Object.entries(TABLES).map(([fileName, table]) => [fileName, {
            row_semantics: table.row_semantics,
            primary_key: table.primary_key,
            source: table.source,
            columns: table.columns.map(columnSpec)
        }]))
    };
}

function stableJson(value) {
    if (Array.isArray(value)) return value.map(stableJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
    }
    return value;
}

function buildWorkingReport(analysis) {
    const summary = analysis.summary || {};
    const totals = summary.totals || {};
    return [
        '# Q-Shape metamorphic parity campaign — working qualification report',
        '',
        '> Status: working qualification evidence. This is not a publication-ready table or a complete software-validation claim.',
        '',
        `- Campaign gate: ${summary.campaign_gate_status || 'not_evaluated'}`,
        `- Overall validation: ${summary.overall_validation_status || 'incomplete'}`,
        `- Positive cases: ${totals.cases ?? 'not_evaluated'}`,
        `- Matched comparisons expected per stream: ${totals.comparisons_expected ?? 'not_evaluated'}`,
        `- Matched comparison rows reported across streams: ${totals.comparisons_observed ?? 'not_evaluated'}`,
        `- Typed gate failures: ${totals.failures ?? (analysis.failure_ledger || []).length}`,
        `- Claim boundary: ${summary.claim_boundary || 'metamorphic qualification only'}`,
        '',
        'Machine-readable CSV files preserve source lexical tokens. Units, typed missingness, row semantics, and primary keys are defined in `data-dictionary.json`.',
        ''
    ].join('\n');
}

function buildReportingArtifacts(analysis) {
    assert(analysis && typeof analysis === 'object', 'analysis must be an object');
    const artifacts = {};
    for (const [fileName, table] of Object.entries(TABLES)) {
        artifacts[fileName] = rowsToCsv(prepareTableRows(fileName, analysis), table.columns);
    }
    artifacts['summary.json'] = `${JSON.stringify(stableJson(analysis.summary || {}), null, 2)}\n`;
    artifacts['data-dictionary.json'] = `${JSON.stringify(stableJson(buildDataDictionary()), null, 2)}\n`;
    artifacts['working-report.md'] = buildWorkingReport(analysis);
    return artifacts;
}

function writeReportingArtifacts(outputDirectory, analysis, options = {}) {
    const resolved = path.resolve(outputDirectory);
    fs.mkdirSync(resolved, { recursive: true });
    const artifacts = buildReportingArtifacts(analysis);
    for (const [fileName, content] of Object.entries(artifacts)) {
        const destination = path.join(resolved, fileName);
        if (!options.replace && fs.existsSync(destination)) {
            throw new Error(`reporting artifact already exists: ${destination}`);
        }
        fs.writeFileSync(destination, content, { encoding: 'utf8', flag: options.replace ? 'w' : 'wx' });
    }
    return Object.keys(artifacts).sort();
}

module.exports = {
    Q_STREAMS,
    TABLES,
    buildDataDictionary,
    buildReportingArtifacts,
    buildWorkingReport,
    prepareTableRows,
    rowsToCsv,
    writeReportingArtifacts
};

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const reporting = require('../scripts/metamorphic-reporting.cjs');

function fixture() {
    const comparison = {
        stream: 'q_explicit_seed_0', case_id: 'case-1', target_code: 'SP-4', cn: 4,
        stratum: 'metamorphic_main', family: 'main_positive', geometry_family: 'SP-4',
        recipe_id: 'canonical', recipe_index: 1, recipe_category: 'canonical',
        distortion_type: 'not_applicable', distortion_sign: 'not_applicable',
        distortion_magnitude: 'not_applicable', input_precision_digits: 'not_applicable',
        optimizer_seed_mode: 'explicit-seed', optimizer_seed_uint32: 0,
        browser: 'not_applicable_node_worker', execution_mode: 'default', qshape_runtime_ms: '1.25',
        shape_r1_token: '0.00000', shape_r2_token: '0.00000', shape_consensus_token: '0.00000',
        qshape_token: '0.0000000000000000', qshape_float64_hex: '0000000000000000',
        signed_error: '0', absolute_error: '0', result_domain_valid: true,
        pass_abs_0_01: true, seed_policy: 'explicit', explicit_seed_uint32: 0
    };
    const runtime = {
        count: 1, mean_ms: '1.25', median_ms: '1.25', p95_ms: '1.25',
        p99_ms: '1.25', maximum_ms: '1.25'
    };
    return {
        summary: {
            campaign_gate_status: 'pass', overall_validation_status: 'incomplete',
            claim_boundary: 'metamorphic qualification only',
            totals: { cases: 1, comparisons_expected: 1, comparisons_observed: 5, failures: 0 },
            shape_consensus: { rows: [{
                case_id: 'case-1', target_code: 'SP-4', shape_r1_token: '0.00000',
                shape_r2_token: '0.00000', shape_consensus_token: '0.00000',
                exact_token_agreement: true, domain_valid: true
            }] }
        },
        comparison_rows: [comparison],
        case_summaries: [{
            stream: comparison.stream, case_id: comparison.case_id, ranking_status: 'evaluated',
            not_evaluable_targets: [], shape_best_code: 'SP-4', qshape_best_code: 'SP-4',
            shape_tie_set: ['SP-4'], qshape_tie_set: ['SP-4'], exact_best_label_agrees: true,
            qshape_best_within_shape_tie_set: true, resolved_ranking_pairs: 0,
            discordant_ranking_pairs: 0, ranking_agreement_fraction: 'not_applicable',
            kendall_tau_b: null, kendall_concordant_pairs: 0, kendall_discordant_pairs: 0,
            kendall_shape_only_ties: 0, kendall_qshape_only_ties: 0, kendall_joint_ties: 0,
            failure_count: 0, pass: true
        }],
        relation_summaries: [{
            child_case_id: 'case-2', parent_case_id: 'case-1', expected_parent_case_id: 'case-1',
            authorized: true, relation_status: 'pass', shape_exact_token: 'pass',
            q_explicit_streams: Object.fromEntries(reporting.Q_STREAMS.map(stream => [
                stream, stream.startsWith('q_primary_') ? 'not_applicable' : 'pass'
            ]))
        }],
        paired_sign_rows: [{
            stream: comparison.stream, optimizer_seed_mode: 'explicit-seed', optimizer_seed_uint32: 0,
            cn: 4, geometry_family: 'SP-4', target_code: 'SP-4', distortion_type: 'radial',
            distortion_magnitude: '0.01', minus_case_id: 'case-minus', plus_case_id: 'case-plus',
            shape_minus_token: '0.10000', shape_plus_token: '0.20000',
            qshape_minus_token: '0.10000000000000001', qshape_plus_token: '0.20000000000000001',
            delta_shape: '0.1', delta_qshape: '0.1', delta_error: '0',
            cshm_unit: 'dimensionless_CShM', status: 'evaluable'
        }],
        stratified_statistics: [{
            stream: comparison.stream, optimizer_seed_mode: 'explicit-seed', optimizer_seed_uint32: 0,
            dimension: 'overall', level: 'all', comparisons_total: 1, comparisons_domain_valid: 1,
            cshm_unit: 'dimensionless_CShM', runtime_unit: 'ms', count: 1, signed_bias: '0',
            mean_absolute_error: '0', root_mean_square_error: '0', median_absolute_error: '0',
            p95_absolute_error: '0', p99_absolute_error: '0', maximum_absolute_error: '0', runtime
        }],
        stream_summaries: {
            q_explicit_seed_0: {
                stream: comparison.stream, seed_mode: 'explicit-seed', explicit_seed_uint32: 0,
                cases_expected: 1, comparisons_expected: 1, comparisons_observed: 1,
                comparisons_domain_valid: 1, failures: 0, campaign_gate_status: 'pass',
                case_summaries: []
            }
        },
        failures: [],
        failure_ledger: []
    };
}

test('reporting emits deterministic fixed-schema tables without nested object coercion', () => {
    const first = reporting.buildReportingArtifacts(fixture());
    const second = reporting.buildReportingArtifacts(fixture());
    assert.deepEqual(first, second);
    assert.deepEqual(Object.keys(first).sort(), [
        'case-summaries.csv', 'comparison-rows.csv', 'data-dictionary.json',
        'failure-ledger.csv', 'paired-sign-deltas.csv', 'relation-summaries.csv',
        'shape-consensus.csv', 'stratified-statistics.csv', 'stream-summaries.csv',
        'summary.json', 'working-report.md'
    ]);
    for (const content of Object.values(first)) {
        assert.doesNotMatch(content, /\[object Object\]/);
    }
    for (const [fileName, content] of Object.entries(first)) {
        if (fileName === 'data-dictionary.json') continue;
        assert.doesNotMatch(content, /\bundefined\b|\bNaN\b/);
    }
    assert.match(first['case-summaries.csv'], /"\[""SP-4""\]"/);
    assert.match(first['stratified-statistics.csv'], /runtime_mean_ms/);
    assert.match(first['stratified-statistics.csv'], /,1\.25,1\.25,1\.25,1\.25,1\.25\n/);
});

test('failure ledger always retains its exact header when there are zero failures', () => {
    const artifacts = reporting.buildReportingArtifacts(fixture());
    assert.equal(
        artifacts['failure-ledger.csv'],
        `${reporting.TABLES['failure-ledger.csv'].columns.join(',')}\n`
    );
});

test('data dictionary covers every emitted CSV column with units, missingness, and definitions', () => {
    const dictionary = reporting.buildDataDictionary();
    assert.equal(dictionary.schema_version, 2);
    for (const [fileName, table] of Object.entries(reporting.TABLES)) {
        const described = dictionary.tables[fileName];
        assert.deepEqual(described.primary_key, table.primary_key);
        assert.deepEqual(described.columns.map(column => column.name), table.columns);
        assert.ok(described.columns.every(column =>
            column.data_type && column.unit && column.missingness && column.definition
        ));
    }
    const comparison = dictionary.tables['comparison-rows.csv'].columns;
    assert.equal(comparison.find(column => column.name === 'absolute_error').unit, 'dimensionless_CShM');
    assert.equal(comparison.find(column => column.name === 'qshape_runtime_ms').unit, 'ms');
});

test('writer creates a complete working package once and refuses silent overwrite', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-meta-reporting-'));
    const files = reporting.writeReportingArtifacts(root, fixture());
    assert.equal(files.length, 11);
    assert.ok(files.every(file => fs.statSync(path.join(root, file)).isFile()));
    assert.throws(() => reporting.writeReportingArtifacts(root, fixture()), /already exists/);
    assert.match(fs.readFileSync(path.join(root, 'working-report.md'), 'utf8'), /working qualification evidence/i);
});

test('CSV writer preserves lexical tokens and quotes commas, quotes, and newlines', () => {
    assert.equal(
        reporting.rowsToCsv([{ a: 'x,y', b: 'line 1\nline "2"' }], ['a', 'b']),
        'a,b\n"x,y","line 1\nline ""2"""\n'
    );
    assert.throws(() => reporting.rowsToCsv([{ a: { nested: true } }], ['a']), /nested object/);
});

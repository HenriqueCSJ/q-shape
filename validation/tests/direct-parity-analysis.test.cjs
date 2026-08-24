'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const analysis = require('../scripts/direct-parity-analysis.cjs');

const inventory = [{
    cn: 2,
    count: 2,
    targets: [
        { code: 'A-2', name: 'A', shapeCode: 'A-2' },
        { code: 'B-2', name: 'B', shapeCode: 'B-2' }
    ]
}];
const cases = [{
    caseId: 'fixture-cn02',
    stratum: 'retained_fixture',
    cn: 2,
    sourceName: 'fixture.xyz',
    expectedOwnTargetCode: null
}];

function row(caseId, targetCode, valueToken, fields = {}) {
    return { caseId, targetCode, valueToken, rawPath: `${fields.program || 'raw'}.json`, ...fields };
}

function run(shapeValues, qValues, overrides = {}) {
    return analysis.analyzeDirectParity({
        cases: overrides.cases || cases,
        inventory: overrides.inventory || inventory,
        shapeRows: [row('fixture-cn02', 'A-2', shapeValues[0]), row('fixture-cn02', 'B-2', shapeValues[1])],
        qshapeRows: [row('fixture-cn02', 'A-2', qValues[0]), row('fixture-cn02', 'B-2', qValues[1])],
        additionalFailures: overrides.additionalFailures || []
    });
}

test('absolute error threshold is strict', () => {
    const result = run(['0.00000', '1.00000'], ['0', '1.01000']);
    assert.ok(result.failures.some(failure =>
        failure.gate === 'absolute_error' && failure.target_code === 'B-2'
    ));
});

test('duplicate, missing, and extra raw keys fail structurally', () => {
    assert.throws(() => analysis.analyzeDirectParity({
        cases,
        inventory,
        shapeRows: [row('fixture-cn02', 'A-2', '0.00000'), row('fixture-cn02', 'A-2', '0.00000')],
        qshapeRows: [row('fixture-cn02', 'A-2', '0'), row('fixture-cn02', 'B-2', '1')]
    }), /duplicate pair/i);
    assert.throws(() => analysis.analyzeDirectParity({
        cases,
        inventory,
        shapeRows: [row('fixture-cn02', 'A-2', '0.00000')],
        qshapeRows: [row('fixture-cn02', 'A-2', '0'), row('fixture-cn02', 'B-2', '1')]
    }), /Missing:/);
    assert.throws(() => analysis.analyzeDirectParity({
        cases,
        inventory,
        shapeRows: [row('fixture-cn02', 'A-2', '0.00000'), row('fixture-cn02', 'C-2', '1.00000')],
        qshapeRows: [row('fixture-cn02', 'A-2', '0'), row('fixture-cn02', 'B-2', '1')]
    }), /unknown pair/);
});

test('negative CShM values cannot pass as small errors', () => {
    const result = run(['0.00000', '1.00000'], ['-0.00001', '1.00000']);
    assert.ok(result.failures.some(failure => failure.gate === 'qshape_negative_cshm'));
    assert.equal(result.summary.campaign_gate_status, 'fail');
});

test('CShM values above 100 fail the mathematical domain gate', () => {
    const result = run(['0.00000', '99.99999'], ['0', '100.00001']);
    assert.ok(result.failures.some(failure => failure.gate === 'qshape_cshm_above_100'));
    assert.equal(result.comparisonRows[1].result_domain_valid, false);
});

test('Q-Shape exact best may differ when it remains inside the SHAPE tie set', () => {
    const result = run(['0.00000', '0.01000'], ['0.005', '0.004']);
    const summary = result.caseSummaryRows[0];
    assert.equal(summary.exact_best_label_agrees, false);
    assert.equal(summary.qshape_best_within_shape_tie_set, true);
    assert.ok(!result.failures.some(failure => failure.gate.includes('best_geometry')));
});

test('Q-Shape best outside the SHAPE tie set is a gate failure', () => {
    const result = run(['0.00000', '1.00000'], ['0.009', '0.008']);
    assert.ok(result.failures.some(failure =>
        failure.gate === 'best_geometry_outside_shape_tie_set'
    ));
});

test('collapsing a SHAPE-resolved pair into a Q-Shape tie fails ranking', () => {
    const result = run(['0.00000', '1.00000'], ['0.5', '0.5']);
    assert.ok(result.failures.some(failure => failure.gate === 'ranking_loss_or_inversion'));
});

test('error statistics include signed bias, MAE, RMSE, P95, and P99', () => {
    const values = ['0.1', '-0.2'].map(analysis.finiteDecimal);
    assert.deepEqual(analysis.errorStatistics(values), {
        count: 2,
        signed_bias: '-0.05',
        mean_absolute_error: '0.15',
        root_mean_square_error: '0.158113883008418967',
        median_absolute_error: '0.15',
        p95_absolute_error: '0.2',
        p99_absolute_error: '0.2',
        max_absolute_error: '0.2'
    });
});

test('failure identifiers are deterministic across repeated analysis', () => {
    const first = run(['0.00000', '1.00000'], ['0.5', '0.5']);
    const second = run(['0.00000', '1.00000'], ['0.5', '0.5']);
    assert.deepEqual(
        first.failures.map(failure => failure.failure_id),
        second.failures.map(failure => failure.failure_id)
    );
});

test('gamma-aware Kendall tau-b accounts explicitly for ties', () => {
    const decimal = analysis.finiteDecimal;
    const result = analysis.gammaAwareKendallTauB([
        { shape: decimal('0'), qshape: decimal('0') },
        { shape: decimal('1'), qshape: decimal('1') },
        { shape: decimal('2'), qshape: decimal('2') }
    ]);
    assert.deepEqual(result, {
        tau_b: '1',
        concordant: 3,
        discordant: 0,
        shape_only_ties: 0,
        qshape_only_ties: 0,
        joint_ties: 0
    });
});

test('rank statistics are aggregated by stratum and coordination number', () => {
    const groupedCases = [
        {
            caseId: 'fixture-cn02',
            stratum: 'retained_fixture',
            cn: 2,
            sourceName: 'fixture.xyz',
            expectedOwnTargetCode: null
        },
        {
            caseId: 'ideal-cn02-01',
            stratum: 'ideal_reference',
            cn: 2,
            sourceName: 'ideal A',
            expectedOwnTargetCode: 'A-2'
        }
    ];
    const result = analysis.analyzeDirectParity({
        cases: groupedCases,
        inventory,
        shapeRows: [
            row('fixture-cn02', 'A-2', '0.00000'),
            row('fixture-cn02', 'B-2', '1.00000'),
            row('ideal-cn02-01', 'A-2', '0.00000'),
            row('ideal-cn02-01', 'B-2', '1.00000')
        ],
        qshapeRows: [
            row('fixture-cn02', 'A-2', '0'),
            row('fixture-cn02', 'B-2', '1'),
            row('ideal-cn02-01', 'A-2', '1'),
            row('ideal-cn02-01', 'B-2', '0')
        ]
    });

    assert.deepEqual(result.summary.by_stratum.retained_fixture.rank_statistics, {
        definition: 'Kendall tau-b with gamma=0.02001 CShM used as the tie threshold in both programs',
        tau_b_across_cases: {
            count: 1,
            mean: '1',
            median: '1',
            p95: '1',
            p99: '1',
            max: '1'
        },
        kendall_pair_components: {
            candidate_pairs: 1,
            concordant_pairs: 1,
            discordant_pairs: 0,
            shape_only_ties: 0,
            qshape_only_ties: 0,
            joint_ties: 0
        },
        resolved_ranking_pairs: 1,
        discordant_ranking_pairs: 0,
        protected_pair_agreement: { agree: 1, total: 1, fraction: '1' }
    });
    assert.deepEqual(result.summary.by_stratum.ideal_reference.rank_statistics, {
        definition: 'Kendall tau-b with gamma=0.02001 CShM used as the tie threshold in both programs',
        tau_b_across_cases: {
            count: 1,
            mean: '-1',
            median: '-1',
            p95: '-1',
            p99: '-1',
            max: '-1'
        },
        kendall_pair_components: {
            candidate_pairs: 1,
            concordant_pairs: 0,
            discordant_pairs: 1,
            shape_only_ties: 0,
            qshape_only_ties: 0,
            joint_ties: 0
        },
        resolved_ranking_pairs: 1,
        discordant_ranking_pairs: 1,
        protected_pair_agreement: { agree: 0, total: 1, fraction: '0' }
    });
    assert.deepEqual(result.summary.by_cn[2].rank_statistics, {
        definition: 'Kendall tau-b with gamma=0.02001 CShM used as the tie threshold in both programs',
        tau_b_across_cases: {
            count: 2,
            mean: '0',
            median: '0',
            p95: '1',
            p99: '1',
            max: '1'
        },
        kendall_pair_components: {
            candidate_pairs: 2,
            concordant_pairs: 1,
            discordant_pairs: 1,
            shape_only_ties: 0,
            qshape_only_ties: 0,
            joint_ties: 0
        },
        resolved_ranking_pairs: 2,
        discordant_ranking_pairs: 1,
        protected_pair_agreement: { agree: 1, total: 2, fraction: '0.5' }
    });
    assert.deepEqual(result.summary.totals.rank_statistics,
        result.summary.by_cn[2].rank_statistics);
});

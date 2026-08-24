'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const analysis = require('../scripts/metamorphic-parity-analysis.cjs');

const inventory = [{
    cn: 2,
    count: 3,
    targets: [
        { code: 'A-2', name: 'A' },
        { code: 'B-2', name: 'B' },
        { code: 'C-2', name: 'C' }
    ]
}];

const representationRecipes = [
    'rotation-a',
    'scale-small',
    'permutation',
    'rotation-scale',
    'rotation-permutation',
    'rotation-scale-permutation'
];

function makeCases() {
    const cases = [{
        caseId: 'meta-cn02-ref01-r01',
        recipeId: 'canonical',
        recipeCategory: 'canonical',
        cn: 2,
        parentReferenceCode: 'ref-a',
        expectedOwnTargetCode: 'A-2',
        stratum: 'metamorphic_main'
    }];
    representationRecipes.forEach((recipe, index) => cases.push({
        caseId: `meta-cn02-ref01-r${String(index + 2).padStart(2, '0')}`,
        recipeId: recipe,
        recipeCategory: 'representation',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r01',
        expectedOwnTargetCode: 'A-2',
        stratum: 'metamorphic_main'
    }));
    cases.push({
        caseId: 'meta-cn02-ref01-r24',
        recipeId: 'mixed-minus-0.05',
        recipeCategory: 'mixed',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r01',
        stratum: 'metamorphic_main'
    });
    cases.push({
        caseId: 'meta-cn02-ref01-r25',
        recipeId: 'mixed-plus-0.05',
        recipeCategory: 'mixed',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r01',
        stratum: 'metamorphic_main'
    });
    cases.push({
        caseId: 'meta-cn02-ref01-r29',
        recipeId: 'distorted-twin',
        recipeCategory: 'distorted_twin',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r25',
        stratum: 'metamorphic_main'
    });
    cases.push({
        caseId: 'meta-cn02-ref01-r11',
        recipeId: 'radial-minus-0.001',
        recipeCategory: 'radial',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r01',
        stratum: 'metamorphic_main'
    });
    cases.push({
        caseId: 'meta-cn02-ref01-r12',
        recipeId: 'radial-plus-0.001',
        recipeCategory: 'radial',
        cn: 2,
        parentReferenceCode: 'ref-a',
        parentCaseId: 'meta-cn02-ref01-r01',
        stratum: 'metamorphic_main'
    });
    return cases;
}

function bits(valueToken) {
    return analysis.qBits({ valueToken });
}

function canonical(valueToken) {
    const value = Number(valueToken);
    return Object.is(value, -0) ? '-0' : value.toPrecision(17);
}

function row(caseId, targetCode, valueToken, extra = {}) {
    return {
        caseId,
        targetCode,
        valueToken,
        ...extra
    };
}

function valueFor(targetCode) {
    return { 'A-2': '0.00000', 'B-2': '1.00000', 'C-2': '2.00000' }[targetCode];
}

function buildInput(overrides = {}) {
    const cases = overrides.cases || makeCases();
    const expectedRows = (caseItem, targetCode, stream) => {
        let token = valueFor(targetCode);
        const override = overrides.qValue;
        if (typeof override === 'function') token = override(caseItem, targetCode, stream, token);
        token = canonical(token);
        const seed = stream.startsWith('q_explicit_')
            ? Number(stream.slice('q_explicit_seed_'.length))
            : undefined;
        return row(caseItem.caseId, targetCode, token, {
            valueHex: bits(token),
            runtimeMsToken: '1.000000',
            seedPolicy: stream.startsWith('q_explicit_') ? 'explicit' : 'input-derived',
            ...(seed === undefined ? {} : { explicitSeed: seed })
        });
    };
    const shapeRows = targetToken => cases.flatMap(caseItem =>
        inventory[0].targets.map(target => row(
            caseItem.caseId,
            target.code,
            targetToken ? targetToken(caseItem, target.code) : valueFor(target.code)
        ))
    );
    const shapeR1 = shapeRows(overrides.shapeToken);
    const shapeR2 = shapeRows(overrides.shapeTokenR2 || overrides.shapeToken);
    const qshapeRowsByStream = {};
    for (const stream of analysis.Q_STREAMS) {
        qshapeRowsByStream[stream] = cases.flatMap(caseItem =>
            inventory[0].targets.map(target => expectedRows(caseItem, target.code, stream))
        );
    }
    if (overrides.qRowsByStream) {
        for (const [stream, transform] of Object.entries(overrides.qRowsByStream)) {
            qshapeRowsByStream[stream] = transform(qshapeRowsByStream[stream]);
        }
    }
    return {
        cases,
        inventory,
        shapeRowsByRepetition: { shape_r1: shapeR1, shape_r2: shapeR2 },
        qshapeRowsByStream
    };
}

function failuresFor(result, gate) {
    return result.failures.filter(failure => failure.gate === gate);
}

test('all five Q streams use independent direct gates and authorized relations', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput());
    assert.equal(result.summary.campaign_gate_status, 'pass');
    assert.deepEqual(Object.keys(result.stream_summaries), [...analysis.Q_STREAMS]);
    assert.equal(result.summary.shape_consensus.exact_token_agree, result.summary.shape_consensus.comparisons_expected);
    assert.equal(result.primary_q_repeatability.status, 'pass');
    assert.equal(result.relation_summaries.length, 7);
    assert.ok(result.relation_summaries.every(relation => relation.authorized));
    assert.ok(result.relation_summaries.every(relation =>
        relation.q_explicit_streams.q_primary_input_derived_r1 === 'not_applicable'
    ));
    assert.equal(result.failures.length, 0);
});

test('case summaries report gamma-aware Kendall tau-b and all tie classes', () => {
    const exact = analysis.analyzeMetamorphicParity(buildInput());
    const exactSummary = exact.case_summaries.find(item =>
        item.stream === 'q_explicit_seed_0' && item.case_id.endsWith('r01')
    );
    assert.equal(exactSummary.kendall_tau_b, '1');
    assert.equal(exactSummary.kendall_concordant_pairs, 3);
    assert.equal(exactSummary.kendall_discordant_pairs, 0);
    assert.equal(exactSummary.kendall_shape_only_ties, 0);
    assert.equal(exactSummary.kendall_qshape_only_ties, 0);
    assert.equal(exactSummary.kendall_joint_ties, 0);

    const qTie = analysis.analyzeMetamorphicParity(buildInput({
        qValue: (item, target, stream, token) =>
            item.caseId.endsWith('r01') && target === 'B-2' && stream === 'q_explicit_seed_0'
                ? '0.01' : token
    }));
    const tiedSummary = qTie.case_summaries.find(item =>
        item.stream === 'q_explicit_seed_0' && item.case_id.endsWith('r01')
    );
    assert.equal(tiedSummary.kendall_concordant_pairs, 2);
    assert.equal(tiedSummary.kendall_qshape_only_ties, 1);
    assert.equal(tiedSummary.kendall_shape_only_ties, 0);
    assert.equal(tiedSummary.kendall_joint_ties, 0);
    assert.match(tiedSummary.kendall_tau_b, /^0\.816496580927726/);
});

test('working outputs retain typed strata, exact error statistics, and paired-sign deltas', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput());
    const expectedComparisons = makeCases().length * inventory[0].targets.length *
        analysis.Q_STREAMS.length;
    assert.equal(result.summary.reporting_counts.tidy_comparison_rows, expectedComparisons);
    assert.equal(result.summary.reporting_counts.paired_sign_rows, 30);
    assert.equal(result.summary.reporting_counts.paired_sign_not_evaluable_rows, 0);

    const comparison = result.comparison_rows.find(row =>
        row.stream === 'q_explicit_seed_0' && row.case_id.endsWith('r12') && row.target_code === 'A-2'
    );
    assert.deepEqual({
        family: comparison.family,
        geometry_family: comparison.geometry_family,
        recipe_id: comparison.recipe_id,
        distortion_type: comparison.distortion_type,
        distortion_sign: comparison.distortion_sign,
        distortion_magnitude: comparison.distortion_magnitude,
        optimizer_seed_uint32: comparison.optimizer_seed_uint32,
        browser: comparison.browser,
        execution_mode: comparison.execution_mode,
        qshape_runtime_ms: comparison.qshape_runtime_ms
    }, {
        family: '',
        geometry_family: 'ref-a',
        recipe_id: 'radial-plus-0.001',
        distortion_type: 'radial',
        distortion_sign: 'plus',
        distortion_magnitude: '0.001',
        optimizer_seed_uint32: 0,
        browser: 'not_applicable_node_worker',
        execution_mode: 'default',
        qshape_runtime_ms: '1.000000'
    });

    const overall = result.stratified_statistics.find(row =>
        row.stream === 'q_explicit_seed_0' && row.dimension === 'overall'
    );
    assert.equal(overall.comparisons_total, makeCases().length * 3);
    assert.equal(overall.comparisons_domain_valid, overall.comparisons_total);
    assert.equal(overall.mean_absolute_error, '0');
    assert.equal(overall.root_mean_square_error, '0');
    assert.equal(overall.runtime.mean_ms, '1');

    const pair = result.paired_sign_rows.find(row =>
        row.stream === 'q_explicit_seed_0' && row.target_code === 'A-2' &&
        row.distortion_type === 'radial'
    );
    assert.equal(pair.minus_case_id, 'meta-cn02-ref01-r11');
    assert.equal(pair.plus_case_id, 'meta-cn02-ref01-r12');
    assert.equal(pair.delta_shape, '0');
    assert.equal(pair.delta_qshape, '0');
    assert.equal(pair.delta_error, '0');
    assert.equal(pair.status, 'evaluable');
});

test('SHAPE repetitions must agree on exact lexical five-decimal tokens before consensus', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        shapeTokenR2: (item, target) => item.caseId.endsWith('r01') && target === 'B-2'
            ? '1.00001' : valueFor(target)
    }));
    assert.ok(failuresFor(result, 'shape_repeatability_token').some(failure =>
        failure.case_id === 'meta-cn02-ref01-r01' && failure.target_code === 'B-2'
    ));
    assert.ok(failuresFor(result, 'ranking_not_evaluable').length >= analysis.Q_STREAMS.length);
    assert.equal(result.case_summaries.find(summary =>
        summary.stream === analysis.Q_STREAMS[0] && summary.case_id.endsWith('r01')
    ).ranking_status, 'not_evaluable');
    assert.equal(result.summary.shape_consensus.exact_token_agree,
        result.summary.shape_consensus.comparisons_expected - 1);
});

test('primary Q repeatability compares binary64 bits and rejects noncanonical tokens', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_primary_input_derived_r2: rows => rows.map((item, index) => index === 0
                ? { ...item, valueToken: '0.0', valueHex: bits('0.0') }
                : item)
        }
    }));
    assert.equal(result.summary.campaign_gate_status, 'fail');
    assert.ok(failuresFor(result, 'qshape_lexical_token').length > 0);

    const differentBits = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_primary_input_derived_r2: rows => rows.map((item, index) => index === 0
                ? {
                    ...item,
                    valueToken: canonical('0.0000000000000001'),
                    valueHex: bits(canonical('0.0000000000000001'))
                }
                : item)
        }
    }));
    assert.equal(differentBits.primary_q_repeatability.status, 'fail');
    assert.ok(failuresFor(differentBits, 'qshape_primary_repeatability_bits').length > 0);
});

test('explicit-seed relational gate is at most 1e-8 and input-derived relations are not gated', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qValue: (item, target, stream, token) => {
            if (item.recipeId === 'rotation-a' && target === 'B-2' && stream.startsWith('q_explicit_')) {
                return '1.00000002';
            }
            if (item.recipeId === 'rotation-a' && target === 'B-2' && stream.startsWith('q_primary_')) {
                return '1.000009';
            }
            return token;
        }
    }));
    assert.equal(result.summary.campaign_gate_status, 'fail');
    assert.equal(failuresFor(result, 'qshape_parent_child_explicit_invariance').length, 3);
    assert.equal(failuresFor(result, 'qshape_parent_child_input_derived_invariance').length, 0);
    const rotation = result.relation_summaries.find(relation =>
        relation.child_case_id.endsWith('r02')
    );
    assert.equal(rotation.q_explicit_streams.q_explicit_seed_0, 'fail');
    assert.equal(rotation.q_explicit_streams.q_primary_input_derived_r1, 'not_applicable');
});

test('relation aggregation preserves an earlier numeric failure when a later target is not evaluable', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qValue: (item, target, stream, token) => {
            if (item.recipeId !== 'rotation-a' || stream !== 'q_explicit_seed_0') return token;
            if (target === 'B-2') return '1.00000002';
            if (target === 'C-2') return 'NaN';
            return token;
        }
    }));
    const rotation = result.relation_summaries.find(relation =>
        relation.child_case_id.endsWith('r02')
    );
    assert.equal(rotation.q_explicit_streams.q_explicit_seed_0, 'fail');
    assert.equal(rotation.relation_status, 'fail');
    assert.equal(result.summary.relation_counts.failed_relations, 1);
    assert.equal(failuresFor(result, 'qshape_parent_child_explicit_invariance').length, 1);
    assert.ok(result.failure_ledger.some(failure =>
        failure.gate === 'qshape_parent_child_explicit_invariance' &&
        failure.target_code === 'B-2'
    ));
});

test('missing target rows fail and make ranking not_evaluable instead of ranking a subset', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_explicit_seed_0: rows => rows.filter(item =>
                !(item.caseId.endsWith('r01') && item.targetCode === 'C-2')
            )
        }
    }));
    assert.ok(failuresFor(result, 'missing_target_row').some(failure =>
        failure.stream === 'q_explicit_seed_0' && failure.target_code === 'C-2'
    ));
    const summary = result.case_summaries.find(item =>
        item.stream === 'q_explicit_seed_0' && item.case_id.endsWith('r01')
    );
    assert.equal(summary.ranking_status, 'not_evaluable');
    assert.equal(summary.qshape_best_code, '');
    assert.deepEqual(summary.not_evaluable_targets, ['C-2']);
});

test('absolute error is strict and domain failures remain typed', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_explicit_seed_1364412496: rows => rows.map(item =>
                item.caseId.endsWith('r01') && item.targetCode === 'B-2'
                    ? {
                        ...item,
                        valueToken: canonical('1.01000'),
                        valueHex: bits(canonical('1.01000'))
                    }
                    : item
            ),
            q_explicit_seed_4294967295: rows => rows.map(item =>
                item.caseId.endsWith('r01') && item.targetCode === 'A-2'
                    ? {
                        ...item,
                        valueToken: canonical('-0.1'),
                        valueHex: bits(canonical('-0.1'))
                    }
                    : item
            )
        }
    }));
    assert.ok(failuresFor(result, 'absolute_error').some(failure =>
        failure.stream === 'q_explicit_seed_1364412496' && failure.target_code === 'B-2'
    ));
    assert.ok(failuresFor(result, 'qshape_negative_cshm').some(failure =>
        failure.stream === 'q_explicit_seed_4294967295' && failure.target_code === 'A-2'
    ));
    assert.ok(failuresFor(result, 'ranking_not_evaluable').some(failure =>
        failure.stream === 'q_explicit_seed_4294967295' && failure.case_id.endsWith('r01')
    ));
});

test('multiple typed events may share an execution unit but have deterministic distinct IDs', () => {
    const input = buildInput({
        qRowsByStream: {
            q_explicit_seed_0: rows => rows.map(item =>
                item.caseId.endsWith('r01') && item.targetCode === 'A-2'
                    ? { ...item, valueHex: 'not-a-float64', seedPolicy: undefined }
                    : item
            )
        }
    });
    const first = analysis.analyzeMetamorphicParity(input);
    const second = analysis.analyzeMetamorphicParity(input);
    const unitFailures = first.failures.filter(failure =>
        failure.stream === 'q_explicit_seed_0' &&
        failure.case_id === 'meta-cn02-ref01-r01' &&
        failure.target_code === 'A-2'
    );
    assert.ok(unitFailures.length >= 2);
    assert.equal(new Set(unitFailures.map(failure => failure.failure_id)).size, unitFailures.length);
    assert.deepEqual(first.failures.map(failure => failure.failure_id), second.failures.map(failure => failure.failure_id));
});

test('Q result bits and diagnostic runtime remain bound to each lexical row', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_explicit_seed_0: rows => rows.map((item, index) => index === 0
                ? { ...item, valueHex: bits(canonical('1')), runtimeMsToken: 'missing' }
                : item)
        }
    }));
    assert.ok(failuresFor(result, 'qshape_float64_bits').some(failure =>
        failure.stream === 'q_explicit_seed_0' && failure.target_code === 'A-2'
    ));
    assert.ok(failuresFor(result, 'qshape_runtime_token').some(failure =>
        failure.stream === 'q_explicit_seed_0' && failure.target_code === 'A-2'
    ));
});

test('unauthorized parent declarations are never converted into parent-child gates', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qValue: (item, target, stream, token) =>
            item.recipeId === 'radial-plus-0.001' && target === 'B-2' && stream.startsWith('q_explicit_')
                ? '1.00002' : token
    }));
    assert.equal(failuresFor(result, 'qshape_parent_child_explicit_invariance').length, 0);
    assert.equal(result.relation_summaries.some(relation =>
        relation.child_case_id.endsWith('r12')
    ), false);
});

test('explicit stream identity is mandatory, including seed zero', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_explicit_seed_0: rows => rows.map((item, index) => index === 0
                ? { ...item, explicitSeed: undefined, seedPolicy: undefined }
                : item)
        }
    }));
    assert.ok(failuresFor(result, 'qshape_seed_policy').length > 0);
    assert.ok(failuresFor(result, 'qshape_explicit_seed_identity').length > 0);
});

test('seed zero cannot be smuggled into an input-derived stream', () => {
    const result = analysis.analyzeMetamorphicParity(buildInput({
        qRowsByStream: {
            q_primary_input_derived_r1: rows => rows.map((item, index) => index === 0
                ? { ...item, explicitSeed: 0 }
                : item)
        }
    }));
    assert.ok(failuresFor(result, 'qshape_explicit_seed_forbidden').length > 0);
});

test('complete boundary-control mismatches are retained as scientific gate failures', () => {
    const input = buildInput();
    input.malformedObservations = {
        controls: [
            {
                control_id: 'boundary-pass',
                interface: 'qshape_calculator',
                category: 'nonfinite_token',
                cn: 4,
                source_parent_case_id: 'meta-cn02-ref01-r01',
                expected_outcome: 'nonfinite_result',
                observed_outcome: 'nonfinite_result',
                expected_numeric_rows: 0,
                observed_numeric_rows: 0
            },
            {
                control_id: 'boundary-fail',
                interface: 'qshape_calculator',
                category: 'duplicate_ligand',
                cn: 4,
                source_parent_case_id: 'meta-cn02-ref01-r01',
                expected_outcome: 'nonfinite_result',
                observed_outcome: 'finite_result',
                expected_numeric_rows: 0,
                observed_numeric_rows: 1
            }
        ]
    };
    const first = analysis.analyzeMetamorphicParity(input);
    const second = analysis.analyzeMetamorphicParity(input);
    const failures = failuresFor(first, 'malformed_control_contract');
    assert.equal(first.summary.campaign_gate_status, 'fail');
    assert.deepEqual(first.summary.malformed_controls, {
        included: true,
        controls_observed: 2,
        controls_passed: 1,
        controls_failed: 1,
        campaign_gate_status: 'fail'
    });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].execution_unit_id, 'malformed:boundary-fail');
    assert.equal(failures[0].observed, 'outcome=finite_result;numeric_rows=1');
    assert.equal(failures[0].threshold, 'outcome=nonfinite_result;numeric_rows=0');
    assert.equal(first.summary.totals.failures, first.failures.length);
    assert.deepEqual(first.failures, second.failures);
});

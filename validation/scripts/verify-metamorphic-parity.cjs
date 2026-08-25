#!/usr/bin/env node
'use strict';

// This verifier is intentionally self-contained. It imports only Node.js core
// modules and does not import the runner, generator, analyzer, Q-Shape source,
// shared parsers, or Decimal.js.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CAMPAIGN_ID = 'qshape-metamorphic-adversarial-v1';
const EXECUTION_INPUT_CAMPAIGN_ID = 'qshape-metamorphic-execution-inputs-v1';
const EXECUTION_INPUT_RECEIPT_KIND = 'frozen-metamorphic-execution-input-bundle';
const RUNTIME_IDENTITY_KIND = 'qshape-node-runtime-v1';
const QSHAPE_PROCESS_MODEL = 'in_process_runner';
const CASES_SHA256 = '102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd';
const CERTIFIED_DIRECT_REFERENCES_SHA256 =
    '170c444f035f4a67dc5388a03a23b27ba2ed1a96e3a1ec2e7f95c4d203f49787';
const CERTIFIED_DIRECT_PACKAGE_MANIFEST_SHA256 =
    '5ae614626fef9d60991d7c51804913e166d9b99c3163f10847a66f0b105260ca';
const MAIN_REGISTRY_SHA256 = '06da4f20f3d1f92f9074bcb05860f316f497dae759f15cbdaf374dd56b727966';
const ADVERSARIAL_REGISTRY_SHA256 = '2db4dfd689b403206bfd54b6b766866ae1770156844e02a0d96b4ea596bc7744';
const REFERENCE_COUNT = 87;
const CASE_COUNT = 2871;
const MATCHED_PAIR_COUNT = 28545;
const EXPECTED_SHAPE_HASH = '1592122408e7f5486fd9665e96e129dda9390b1b0ac76da4d348e3070c1bb4cb';
const SHAPE_REPETITIONS = Object.freeze(['shape_r1', 'shape_r2']);
const Q_STREAMS = Object.freeze([
    'q_primary_input_derived_r1',
    'q_primary_input_derived_r2',
    'q_explicit_seed_0',
    'q_explicit_seed_1364412496',
    'q_explicit_seed_4294967295'
]);
const EXPLICIT_SEEDS = Object.freeze({
    q_explicit_seed_0: 0,
    q_explicit_seed_1364412496: 1364412496,
    q_explicit_seed_4294967295: 4294967295
});
const SHAPE_INVOCATION_COUNT = 990;
const SHAPE_VALUE_COUNT = 57090;
const Q_VALUE_COUNT = 142725;
const PACKAGE_SCHEMA_VERSION = 2;
const CONTROL_CAMPAIGN_ID = 'qshape-metamorphic-malformed-v2';
const MALFORMED_CONTROL_STATUS = 'prespecified_post_repair_product_boundary_probes';
const EXPECTED_COUNTS = Object.freeze({
    recipeCount: 33,
    mainRecipeCount: 30,
    supplementRecipeCount: 3,
    referenceCount: REFERENCE_COUNT,
    caseCount: CASE_COUNT,
    baseInvocationCount: 495,
    repetitions: 2,
    invocationCount: SHAPE_INVOCATION_COUNT,
    targetEvaluationsPerRepetition: MATCHED_PAIR_COUNT,
    targetEvaluationsTotal: SHAPE_VALUE_COUNT,
    shapeValueCount: SHAPE_VALUE_COUNT
});
const CANDIDATE_SOURCE_PATHS = Object.freeze([
    '.gitattributes',
    'package.json',
    'package-lock.json',
    'src/constants/algorithmConstants.js',
    'src/constants/referenceGeometries/index.js',
    'src/services/algorithms/hungarian.js',
    'src/services/algorithms/kabsch.js',
    'src/services/shapeAnalysis/shapeCalculator.js',
    'validation/protocol.md',
    'validation/scripts/direct-parity-core.cjs',
    'validation/scripts/freeze-metamorphic-execution-inputs.cjs',
    'validation/scripts/metamorphic-cases.cjs',
    'validation/scripts/metamorphic-malformed-controls.cjs',
    'validation/scripts/metamorphic-parity-analysis.cjs',
    'validation/scripts/metamorphic-production-adapters.cjs',
    'validation/scripts/metamorphic-reporting.cjs',
    'validation/scripts/metamorphic-schedule.cjs',
    'validation/scripts/prepare-metamorphic-references.cjs',
    'validation/scripts/qshape-metamorphic-worker.cjs',
    'validation/scripts/run-metamorphic-parity.cjs',
    'validation/scripts/verify-metamorphic-parity.cjs'
]);
const MALFORMED_CATEGORIES = Object.freeze([
    'missing_center',
    'misplaced_center',
    'incorrect_point_count',
    'nonfinite_token',
    'duplicate_ligand',
    'effectively_zero_length_ligand',
    'unsupported_coordination_number'
]);
const MALFORMED_PARENT_CASE_ID = 'meta-cn04-ref01-r01';
const MALFORMED_CLAIM_BOUNDARY =
    'raw SHAPE 2.1 .dat execution and Q-Shape core calculator/reference-registry behavior, including fail-closed Q-Shape errors for invalid coordinate inputs; legacy typed codes are synthetic-harness diagnostics only, not product API outcomes or scientific gates; browser behavior is not tested';
const MALFORMED_CONTROL_CONTRACTS = Object.freeze([
    Object.freeze({
        control_id: 'mal-shape-center-missing-01', program: 'SHAPE 2.1',
        interface: 'shape_2_1_raw_dat', category: 'missing_center', cn: 4,
        expected_outcome: 'accepted_with_numeric_rows', expected_numeric_rows: 1,
        harness_only_expected_rejection_code: 'shape.center_missing_at_position_1'
    }),
    Object.freeze({
        control_id: 'mal-shape-center-misplaced-01', program: 'SHAPE 2.1',
        interface: 'shape_2_1_raw_dat', category: 'misplaced_center', cn: 4,
        expected_outcome: 'accepted_with_numeric_rows', expected_numeric_rows: 1,
        harness_only_expected_rejection_code: 'shape.center_misplaced'
    }),
    Object.freeze({
        control_id: 'mal-qshape-point-count-01', program: 'Q-Shape',
        interface: 'qshape_core_calculator', category: 'incorrect_point_count', cn: 4,
        expected_outcome: 'thrown_error', expected_numeric_rows: 0,
        harness_only_expected_rejection_code: 'qshape.ligand_count_mismatch'
    }),
    Object.freeze({
        control_id: 'mal-qshape-nonfinite-01', program: 'Q-Shape',
        interface: 'qshape_core_calculator', category: 'nonfinite_token', cn: 4,
        expected_outcome: 'thrown_error', expected_numeric_rows: 0,
        harness_only_expected_rejection_code: 'qshape.nonfinite_coordinate_token'
    }),
    Object.freeze({
        control_id: 'mal-qshape-duplicate-01', program: 'Q-Shape',
        interface: 'qshape_core_calculator', category: 'duplicate_ligand', cn: 4,
        expected_outcome: 'finite_result', expected_numeric_rows: 1,
        harness_only_expected_rejection_code: 'qshape.duplicate_ligand'
    }),
    Object.freeze({
        control_id: 'mal-qshape-zero-length-01', program: 'Q-Shape',
        interface: 'qshape_core_calculator', category: 'effectively_zero_length_ligand', cn: 4,
        expected_outcome: 'thrown_error', expected_numeric_rows: 0,
        harness_only_expected_rejection_code: 'qshape.effectively_zero_length_ligand'
    }),
    Object.freeze({
        control_id: 'mal-qshape-unsupported-cn-01', program: 'Q-Shape',
        interface: 'qshape_reference_registry', category: 'unsupported_coordination_number', cn: 13,
        expected_outcome: 'reference_set_unavailable', expected_numeric_rows: 0,
        harness_only_expected_rejection_code: 'qshape.unsupported_coordination_number'
    })
]);
// This reporting contract is intentionally duplicated here instead of being
// imported from metamorphic-reporting.cjs.  The verifier must be able to
// reconstruct every report byte from the sealed analysis without trusting the
// code that emitted those reports.
const REPORT_TABLES = Object.freeze({
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

const REPORT_INTEGER_COLUMNS = new Set([
    'cn', 'recipe_index', 'optimizer_seed_uint32', 'explicit_seed_uint32',
    'resolved_ranking_pairs', 'discordant_ranking_pairs', 'kendall_concordant_pairs',
    'kendall_discordant_pairs', 'kendall_shape_only_ties', 'kendall_qshape_only_ties',
    'kendall_joint_ties', 'failure_count', 'comparisons_total', 'comparisons_domain_valid',
    'count', 'runtime_count', 'cases_expected', 'comparisons_expected', 'comparisons_observed',
    'failures'
]);
const REPORT_BOOLEAN_COLUMNS = new Set([
    'result_domain_valid', 'pass_abs_0_01', 'exact_best_label_agrees',
    'qshape_best_within_shape_tie_set', 'authorized', 'pass',
    'exact_token_agreement', 'domain_valid'
]);
const REPORT_CSHM_COLUMNS = new Set([
    'shape_r1_token', 'shape_r2_token', 'shape_consensus_token', 'qshape_token',
    'signed_error', 'absolute_error', 'shape_minus_token', 'shape_plus_token',
    'qshape_minus_token', 'qshape_plus_token', 'delta_shape', 'delta_qshape', 'delta_error',
    'signed_bias', 'mean_absolute_error', 'root_mean_square_error',
    'median_absolute_error', 'p95_absolute_error', 'p99_absolute_error',
    'maximum_absolute_error'
]);
const REPORT_RUNTIME_COLUMNS = new Set([
    'qshape_runtime_ms', 'runtime_mean_ms', 'runtime_median_ms',
    'runtime_p95_ms', 'runtime_p99_ms', 'runtime_maximum_ms'
]);

const REPORT_DEFINITIONS = Object.freeze({
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
const FIXED15 = /^[+-]?\d+\.\d{15}$/;
const HEX64 = /^[0-9a-f]{16}$/;

const ROTATION_SPEC = Object.freeze({
    a: Object.freeze({ axis: Object.freeze([1, 2, 3]), angle_rad: '0.417' }),
    rotationScale: Object.freeze({ axis: Object.freeze([-3, 1, 4]), angle_rad: '1.913' }),
    rotationPermutation: Object.freeze({ axis: Object.freeze([5, -2, 1]), angle_rad: '4.207' }),
    rotationScalePermutation: Object.freeze({ axis: Object.freeze([7, -4, 9]), angle_rad: '2.731' }),
    twin: Object.freeze({ axis: Object.freeze([7, -3, 2]), angle_rad: '2.731' })
});

const MAIN_RECIPES = Object.freeze([
    Object.freeze({ id: 'canonical', category: 'canonical', relation: 'self' }),
    Object.freeze({ id: 'rotation-a', category: 'representation', relation: 'canonical_invariant', rotation: 'a' }),
    Object.freeze({ id: 'scale-small', category: 'representation', relation: 'canonical_invariant', scale: '0.00005' }),
    Object.freeze({ id: 'permutation', category: 'representation', relation: 'canonical_invariant', permutation: true }),
    Object.freeze({ id: 'rotation-scale', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationScale', scale: '2.5' }),
    Object.freeze({ id: 'rotation-permutation', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationPermutation', permutation: true }),
    Object.freeze({ id: 'rotation-scale-permutation', category: 'representation', relation: 'canonical_invariant', rotation: 'rotationScalePermutation', scale: '0.00005', permutation: true }),
    Object.freeze({ id: 'precision-9', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 9 }),
    Object.freeze({ id: 'precision-6', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 6 }),
    Object.freeze({ id: 'precision-3', category: 'input_precision', relation: 'quantized_rotation_a', decimal_places: 3 }),
    Object.freeze({ id: 'radial-minus-0.001', seed_key: 'radial-0.001', category: 'radial', relation: 'distorted', radial_fraction: '-0.001' }),
    Object.freeze({ id: 'radial-plus-0.001', seed_key: 'radial-0.001', category: 'radial', relation: 'distorted', radial_fraction: '0.001' }),
    Object.freeze({ id: 'radial-minus-0.02', seed_key: 'radial-0.02', category: 'radial', relation: 'distorted', radial_fraction: '-0.02' }),
    Object.freeze({ id: 'radial-plus-0.02', seed_key: 'radial-0.02', category: 'radial', relation: 'distorted', radial_fraction: '0.02' }),
    Object.freeze({ id: 'radial-minus-0.10', seed_key: 'radial-0.10', category: 'radial', relation: 'distorted', radial_fraction: '-0.10' }),
    Object.freeze({ id: 'radial-plus-0.10', seed_key: 'radial-0.10', category: 'radial', relation: 'distorted', radial_fraction: '0.10' }),
    Object.freeze({ id: 'angular-minus-0.001', seed_key: 'angular-0.001', category: 'angular', relation: 'distorted', angular_radians: '-0.001' }),
    Object.freeze({ id: 'angular-plus-0.001', seed_key: 'angular-0.001', category: 'angular', relation: 'distorted', angular_radians: '0.001' }),
    Object.freeze({ id: 'angular-minus-0.02', seed_key: 'angular-0.02', category: 'angular', relation: 'distorted', angular_radians: '-0.02' }),
    Object.freeze({ id: 'angular-plus-0.02', seed_key: 'angular-0.02', category: 'angular', relation: 'distorted', angular_radians: '0.02' }),
    Object.freeze({ id: 'angular-minus-0.10', seed_key: 'angular-0.10', category: 'angular', relation: 'distorted', angular_radians: '-0.10' }),
    Object.freeze({ id: 'angular-plus-0.10', seed_key: 'angular-0.10', category: 'angular', relation: 'distorted', angular_radians: '0.10' }),
    Object.freeze({ id: 'mixed-minus-0.005', seed_key: 'mixed-0.005', category: 'mixed', relation: 'distorted', radial_fraction: '-0.005', angular_radians: '-0.005' }),
    Object.freeze({ id: 'mixed-plus-0.005', seed_key: 'mixed-0.005', category: 'mixed', relation: 'distorted', radial_fraction: '0.005', angular_radians: '0.005' }),
    Object.freeze({ id: 'mixed-minus-0.05', seed_key: 'mixed-0.05', category: 'mixed', relation: 'distorted', radial_fraction: '-0.05', angular_radians: '-0.05' }),
    Object.freeze({ id: 'mixed-plus-0.05', seed_key: 'mixed-0.05', category: 'mixed', relation: 'distorted', radial_fraction: '0.05', angular_radians: '0.05' }),
    Object.freeze({ id: 'mixed-minus-0.25', seed_key: 'mixed-0.25', category: 'mixed', relation: 'distorted', radial_fraction: '-0.25', angular_radians: '-0.25' }),
    Object.freeze({ id: 'mixed-plus-0.25', seed_key: 'mixed-0.25', category: 'mixed', relation: 'distorted', radial_fraction: '0.25', angular_radians: '0.25' }),
    Object.freeze({ id: 'distorted-twin', category: 'distorted_twin', relation: 'mixed_plus_0.05_invariant', rotation: 'twin', scale: '0.37', permutation: true }),
    Object.freeze({ id: 'reflected-x', category: 'reflection', relation: 'chirality_probe', reflection_axis: 'x' })
]);

const ADVERSARIAL_RECIPES = Object.freeze([
    Object.freeze({ id: 'near-degenerate-assignment', category: 'near_degenerate', relation: 'valid_adversarial', separation_rms_fraction: '0.000001' }),
    Object.freeze({ id: 'near-collinear', category: 'near_collinear', relation: 'valid_adversarial', angular_radians: '0.00017453292519943296' }),
    Object.freeze({ id: 'center-ligand-swap', category: 'center_ligand_trap', relation: 'alternate_center_parity_only' })
]);

function invalid(message) {
    const error = new Error(message);
    error.code = 'INVALID_PACKAGE';
    throw error;
}

function requireThat(condition, message) {
    if (!condition) invalid(message);
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
    return sha256(fs.readFileSync(filePath));
}

function pow10(exponent) {
    requireThat(Number.isInteger(exponent) && exponent >= 0, `invalid power-of-ten exponent ${exponent}`);
    return 10n ** BigInt(exponent);
}

function parseDecimal(text) {
    requireThat(typeof text === 'string', 'decimal token must be a string');
    const match = text.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[Ee]([+-]?\d+))?$/);
    requireThat(match && `${match[2]}${match[3] || ''}`.length > 0, `invalid decimal token ${text}`);
    const negative = match[1] === '-';
    const digits = `${match[2] || ''}${match[3] || ''}`.replace(/^0+(?=\d)/, '') || '0';
    const exponent = Number(match[4] || 0);
    const fractional = (match[3] || '').length;
    let coefficient = BigInt(digits);
    let scale = fractional - exponent;
    if (scale < 0) {
        coefficient *= pow10(-scale);
        scale = 0;
    }
    if (negative && coefficient !== 0n) coefficient = -coefficient;
    return { coefficient, scale };
}

function alignDecimals(left, right) {
    const scale = Math.max(left.scale, right.scale);
    return {
        left: left.coefficient * pow10(scale - left.scale),
        right: right.coefficient * pow10(scale - right.scale),
        scale
    };
}

function compareDecimals(left, right) {
    const aligned = alignDecimals(left, right);
    return aligned.left < aligned.right ? -1 : aligned.left > aligned.right ? 1 : 0;
}

function normalizeDecimal(value) {
    let coefficient = value.coefficient;
    let scale = value.scale;
    while (scale > 0 && coefficient % 10n === 0n) {
        coefficient /= 10n;
        scale -= 1;
    }
    return { coefficient, scale };
}

function addDecimals(left, right) {
    const aligned = alignDecimals(left, right);
    return normalizeDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function subtractDecimals(left, right) {
    const aligned = alignDecimals(left, right);
    return { coefficient: aligned.left - aligned.right, scale: aligned.scale };
}

function multiplyDecimals(left, right) {
    return normalizeDecimal({
        coefficient: left.coefficient * right.coefficient,
        scale: left.scale + right.scale
    });
}

function absoluteDecimal(value) {
    return {
        coefficient: value.coefficient < 0n ? -value.coefficient : value.coefficient,
        scale: value.scale
    };
}

function canonicalBinary64Token(token, label = 'binary64 token') {
    requireThat(typeof token === 'string', `${label} is not a string`);
    const parsed = Number(token);
    requireThat(Number.isFinite(parsed), `${label} is non-finite`);
    const expected = Object.is(parsed, -0) ? '-0' : parsed.toPrecision(17);
    requireThat(token === expected, `${label} is not the canonical binary64 round-trip token`);
    return parsed;
}

function sumDecimals(values) {
    return values.reduce(
        (sum, value) => addDecimals(sum, value),
        { coefficient: 0n, scale: 0 }
    );
}

function rationalExponent10(numerator, denominator) {
    requireThat(numerator > 0n && denominator > 0n, 'invalid positive rational');
    let exponent = numerator.toString().length - denominator.toString().length;
    const belowCandidatePower = exponent >= 0
        ? numerator < denominator * pow10(exponent)
        : numerator * pow10(-exponent) < denominator;
    if (belowCandidatePower) exponent -= 1;
    return exponent;
}

function roundedIntegerToSignificantToken(coefficient, exponent, precision, negative = false) {
    const decimalExponent = exponent - (precision - 1);
    const decimal = decimalExponent >= 0
        ? { coefficient: coefficient * pow10(decimalExponent), scale: 0 }
        : { coefficient, scale: -decimalExponent };
    if (negative) decimal.coefficient = -decimal.coefficient;
    return decimalToSignificantHalfUp(decimal, precision);
}

function rationalToSignificantHalfUp(numerator, denominator, precision = 18) {
    requireThat(typeof numerator === 'bigint' && typeof denominator === 'bigint' && denominator > 0n,
        'invalid rational decimal');
    requireThat(Number.isInteger(precision) && precision >= 1,
        'invalid rational significant precision');
    if (numerator === 0n) return '0';
    const negative = numerator < 0n;
    const absoluteNumerator = negative ? -numerator : numerator;
    let exponent = rationalExponent10(absoluteNumerator, denominator);
    const shift = precision - 1 - exponent;
    const scaledNumerator = shift >= 0
        ? absoluteNumerator * pow10(shift)
        : absoluteNumerator;
    const scaledDenominator = shift >= 0
        ? denominator
        : denominator * pow10(-shift);
    let coefficient = scaledNumerator / scaledDenominator;
    const remainder = scaledNumerator % scaledDenominator;
    if (remainder * 2n >= scaledDenominator) coefficient += 1n;
    if (coefficient === pow10(precision)) {
        coefficient /= 10n;
        exponent += 1;
    }
    return roundedIntegerToSignificantToken(coefficient, exponent, precision, negative);
}

function integerSqrt(value) {
    requireThat(typeof value === 'bigint' && value >= 0n, 'invalid integer square-root input');
    if (value < 2n) return value;
    const bitLength = BigInt(value.toString(2).length);
    let estimate = 1n << ((bitLength + 1n) / 2n);
    while (true) {
        const next = (estimate + value / estimate) / 2n;
        if (next >= estimate) return estimate;
        estimate = next;
    }
}

function sqrtRationalToSignificantHalfUp(numerator, denominator, precision = 18) {
    requireThat(typeof numerator === 'bigint' && numerator >= 0n &&
        typeof denominator === 'bigint' && denominator > 0n,
    'invalid square-root rational');
    if (numerator === 0n) return '0';
    let exponent = Math.floor(rationalExponent10(numerator, denominator) / 2);
    const shift = precision - 1 - exponent;
    const scaledNumerator = shift >= 0
        ? numerator * pow10(2 * shift)
        : numerator;
    const scaledDenominator = shift >= 0
        ? denominator
        : denominator * pow10(-2 * shift);
    let coefficient = integerSqrt(scaledNumerator / scaledDenominator);
    const halfBoundary = 2n * coefficient + 1n;
    if (4n * scaledNumerator >= scaledDenominator * halfBoundary * halfBoundary) coefficient += 1n;
    if (coefficient === pow10(precision)) {
        coefficient /= 10n;
        exponent += 1;
    }
    return roundedIntegerToSignificantToken(coefficient, exponent, precision);
}

function decimalToSignificantHalfUp(value, precision = 18) {
    requireThat(Number.isInteger(precision) && precision >= 1,
        'invalid significant-decimal precision');
    if (value.coefficient === 0n) return '0';
    const negative = value.coefficient < 0n;
    let coefficient = negative ? -value.coefficient : value.coefficient;
    let digits = coefficient.toString();
    const droppedDigits = Math.max(0, digits.length - precision);
    if (droppedDigits > 0) {
        const divisor = pow10(droppedDigits);
        let rounded = coefficient / divisor;
        if ((coefficient % divisor) * 2n >= divisor) rounded += 1n;
        coefficient = rounded;
    }
    let exponent10 = droppedDigits - value.scale;
    while (coefficient % 10n === 0n) {
        coefficient /= 10n;
        exponent10 += 1;
    }
    digits = coefficient.toString();
    const scientificExponent = digits.length - 1 + exponent10;
    let token;
    if (scientificExponent <= -7 || scientificExponent >= 21) {
        const mantissa = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
        token = `${mantissa}e${scientificExponent >= 0 ? '+' : ''}${scientificExponent}`;
    } else if (exponent10 >= 0) token = `${digits}${'0'.repeat(exponent10)}`;
    else {
        const point = digits.length + exponent10;
        token = point > 0
            ? `${digits.slice(0, point)}.${digits.slice(point)}`
            : `0.${'0'.repeat(-point)}${digits}`;
    }
    return `${negative ? '-' : ''}${token}`;
}

function decimalAverageToken(values) {
    requireThat(values.length > 0, 'cannot average an empty decimal set');
    const sum = sumDecimals(values);
    return rationalToSignificantHalfUp(
        sum.coefficient,
        BigInt(values.length) * pow10(sum.scale)
    );
}

function decimalMedianToken(sortedValues) {
    requireThat(sortedValues.length > 0, 'cannot take median of an empty decimal set');
    const midpoint = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 1) return decimalToSignificantHalfUp(sortedValues[midpoint]);
    const pairSum = addDecimals(sortedValues[midpoint - 1], sortedValues[midpoint]);
    return rationalToSignificantHalfUp(pairSum.coefficient, 2n * pow10(pairSum.scale));
}

function exactDecimalDistribution(values) {
    if (values.length === 0) {
        return { count: 0, mean: null, median: null, p95: null, p99: null, max: null };
    }
    const sorted = [...values].sort(compareDecimals);
    const nearest = probability => sorted[Math.max(1, Math.ceil(probability * sorted.length)) - 1];
    return {
        count: values.length,
        mean: decimalAverageToken(values),
        median: decimalMedianToken(sorted),
        p95: decimalToSignificantHalfUp(nearest(0.95)),
        p99: decimalToSignificantHalfUp(nearest(0.99)),
        max: decimalToSignificantHalfUp(sorted.at(-1))
    };
}

function exactDecimalErrorStatistics(signedErrors) {
    if (signedErrors.length === 0) {
        return {
            count: 0,
            signed_bias: null,
            mean_absolute_error: null,
            root_mean_square_error: null,
            median_absolute_error: null,
            p95_absolute_error: null,
            p99_absolute_error: null,
            maximum_absolute_error: null
        };
    }
    const absoluteErrors = signedErrors.map(absoluteDecimal);
    const distribution = exactDecimalDistribution(absoluteErrors);
    const squareSum = sumDecimals(signedErrors.map(value => multiplyDecimals(value, value)));
    return {
        count: signedErrors.length,
        signed_bias: decimalAverageToken(signedErrors),
        mean_absolute_error: decimalAverageToken(absoluteErrors),
        root_mean_square_error: sqrtRationalToSignificantHalfUp(
            squareSum.coefficient,
            BigInt(signedErrors.length) * pow10(squareSum.scale)
        ),
        median_absolute_error: distribution.median,
        p95_absolute_error: distribution.p95,
        p99_absolute_error: distribution.p99,
        maximum_absolute_error: distribution.max
    };
}

function walk(root, current = root) {
    const files = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        const stat = fs.lstatSync(fullPath);
        requireThat(!stat.isSymbolicLink(), `symlink is forbidden in validation package: ${fullPath}`);
        if (entry.isDirectory()) files.push(...walk(root, fullPath));
        else if (entry.isFile()) files.push(fullPath);
    }
    return files;
}

function normalizeManifestPath(token) {
    requireThat(typeof token === 'string' && token.length > 0, 'manifest path is empty');
    requireThat(!token.includes('\\'), `manifest path contains backslash: ${token}`);
    requireThat(!path.posix.isAbsolute(token), `manifest path is absolute: ${token}`);
    const normalized = path.posix.normalize(token);
    requireThat(normalized === token && normalized !== '..' && !normalized.startsWith('../'),
        `unsafe manifest path: ${token}`);
    return token;
}

function isRegularFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function exactSet(actualValues, expectedValues, label) {
    const actual = new Set(actualValues);
    const expected = new Set(expectedValues);
    requireThat(actual.size === actualValues.length, `${label} contains duplicates`);
    const missing = [...expected].filter(value => !actual.has(value));
    const extra = [...actual].filter(value => !expected.has(value));
    requireThat(missing.length === 0 && extra.length === 0,
        `${label} set mismatch; missing=${missing.join('|')}; extra=${extra.join('|')}`);
}

function resolveListedFile(root, listedPaths, token, label) {
    const normalized = normalizeManifestPath(token);
    requireThat(listedPaths.has(normalized), `${label} is not a manifested file: ${normalized}`);
    const filePath = path.join(root, ...normalized.split('/'));
    requireThat(isRegularFile(filePath), `${label} is not a regular file: ${normalized}`);
    return filePath;
}

function parseCsvDocument(text) {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') quoted = false;
            else field += character;
        } else if (character === '"') quoted = true;
        else if (character === ',') {
            record.push(field);
            field = '';
        } else if (character === '\n') {
            record.push(field.replace(/\r$/, ''));
            records.push(record);
            record = [];
            field = '';
        } else field += character;
    }
    requireThat(!quoted, 'CSV ends inside a quoted field');
    if (field.length || record.length) {
        record.push(field.replace(/\r$/, ''));
        records.push(record);
    }
    requireThat(records.length > 0, 'CSV is empty');
    const header = records[0];
    exactSet(header, header, 'CSV header');
    const rows = records.slice(1).filter(row => !(row.length === 1 && row[0] === '')).map((row, index) => {
        requireThat(row.length === header.length, `CSV row ${index + 2} has wrong field count`);
        return Object.fromEntries(header.map((column, offset) => [column, row[offset]]));
    });
    return { header, rows };
}

function parseCsv(text) {
    return parseCsvDocument(text).rows;
}

function float64Hex(value) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(value, 0);
    return buffer.toString('hex');
}

function jsonEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
    }
    return value;
}

function jsonSemanticEqual(left, right) {
    return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function reportCsvCell(value) {
    if (value === undefined || value === null) return '';
    requireThat(typeof value !== 'object', 'nested object reached CSV cell');
    if (typeof value === 'number') requireThat(Number.isFinite(value), 'non-finite number reached CSV cell');
    const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function expectedRowsToCsv(rows, columns) {
    requireThat(Array.isArray(rows), 'CSV rows must be an array');
    requireThat(Array.isArray(columns) && columns.length > 0, 'CSV columns must be nonempty');
    const header = columns.join(',');
    if (rows.length === 0) return `${header}\n`;
    return `${header}\n${rows.map(row => columns.map(column => reportCsvCell(row[column])).join(',')).join('\n')}\n`;
}

function sortExpectedReportRows(rows, key) {
    return [...rows].sort((left, right) => key.map(column =>
        String(left[column] ?? '').localeCompare(String(right[column] ?? ''), 'en', { numeric: true })
    ).find(value => value !== 0) || 0);
}

function projectExpectedReportRow(row, columns) {
    return Object.fromEntries(columns.map(column => [column, row?.[column] ?? '']));
}

function prepareExpectedReportRows(fileName, analysis) {
    const table = REPORT_TABLES[fileName];
    requireThat(table, `unknown reporting table ${fileName}`);
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
    return sortExpectedReportRows(
        rows.map(row => projectExpectedReportRow(row, table.columns)),
        table.primary_key
    );
}

function expectedReportColumnSpec(name) {
    requireThat(REPORT_DEFINITIONS[name], `missing data-dictionary definition for ${name}`);
    const notApplicable = [
        'optimizer_seed_uint32', 'explicit_seed_uint32', 'kendall_tau_b',
        'shape_best_code', 'qshape_best_code', 'shape_consensus_token', 'signed_error',
        'absolute_error', 'qshape_runtime_ms', 'observed', 'threshold', 'comparison_code',
        'case_id', 'target_code', 'stream', 'repetition'
    ].includes(name);
    return {
        name,
        data_type: REPORT_BOOLEAN_COLUMNS.has(name) ? 'boolean_token' :
            REPORT_INTEGER_COLUMNS.has(name) ? 'integer_or_not_applicable' :
                (REPORT_CSHM_COLUMNS.has(name) || REPORT_RUNTIME_COLUMNS.has(name) ||
                    ['ranking_agreement_fraction', 'kendall_tau_b'].includes(name))
                    ? 'exact_decimal_token_or_typed_missing' : 'utf8_string',
        unit: REPORT_CSHM_COLUMNS.has(name) ? 'dimensionless_CShM' :
            REPORT_RUNTIME_COLUMNS.has(name) ? 'ms' :
                (name.endsWith('_uint32') ? 'uint32' :
                    (REPORT_INTEGER_COLUMNS.has(name) ? 'count_or_index' : 'not_applicable')),
        missingness: notApplicable
            ? 'empty only when structurally not applicable or not evaluable; companion status/validity and failure-ledger fields are authoritative'
            : 'not permitted unless the row semantics explicitly define an empty identifier for a package-level event',
        definition: REPORT_DEFINITIONS[name]
    };
}

function buildExpectedDataDictionary() {
    return {
        schema_version: 2,
        artifact_status: 'working_qualification_evidence',
        quantity_policy: {
            cshm: 'dimensionless continuous shape measure; lexical tokens are never rounded again by reporting',
            runtime: 'milliseconds; diagnostic only and not an accuracy gate',
            missingness: 'empty CSV cells are typed by this dictionary and companion status columns; literal NaN/undefined/null are forbidden',
            precision: 'source lexical resolution is preserved; statistics use the frozen exact-decimal estimator contract'
        },
        tables: Object.fromEntries(Object.entries(REPORT_TABLES).map(([fileName, table]) => [fileName, {
            row_semantics: table.row_semantics,
            primary_key: table.primary_key,
            source: table.source,
            columns: table.columns.map(expectedReportColumnSpec)
        }]))
    };
}

function buildExpectedWorkingReport(analysis) {
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

function buildExpectedReportingArtifacts(analysis) {
    requireThat(analysis && typeof analysis === 'object', 'analysis must be an object');
    const artifacts = {};
    for (const [fileName, table] of Object.entries(REPORT_TABLES)) {
        artifacts[fileName] = expectedRowsToCsv(
            prepareExpectedReportRows(fileName, analysis),
            table.columns
        );
    }
    artifacts['summary.json'] = `${JSON.stringify(canonicalJson(analysis.summary || {}), null, 2)}\n`;
    artifacts['data-dictionary.json'] = `${JSON.stringify(canonicalJson(buildExpectedDataDictionary()), null, 2)}\n`;
    artifacts['working-report.md'] = buildExpectedWorkingReport(analysis);
    return artifacts;
}

function vectorsAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vectorsSubtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vectorScale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function vectorDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vectorCross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function vectorNorm(vector) {
    return Math.sqrt(vectorDot(vector, vector));
}

function unitVector(vector, label) {
    const magnitude = vectorNorm(vector);
    requireThat(Number.isFinite(magnitude) && magnitude > 1e-15, `cannot normalize ${label}`);
    return vectorScale(vector, 1 / magnitude);
}

function rodrigues(vector, axis, angle) {
    const unitAxis = unitVector(axis, 'rotation axis');
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return vectorsAdd(
        vectorsAdd(vectorScale(vector, cosine), vectorScale(vectorCross(unitAxis, vector), sine)),
        vectorScale(unitAxis, vectorDot(unitAxis, vector) * (1 - cosine))
    );
}

function independentPerpendicular(vector, seed) {
    const unit = unitVector(vector, 'ligand vector');
    const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        .sort((a, b) => Math.abs(vectorDot(unit, a)) - Math.abs(vectorDot(unit, b)));
    const start = seed % 3;
    for (let index = 0; index < 3; index++) {
        const perpendicular = vectorCross(unit, basis[(start + index) % 3]);
        if (vectorNorm(perpendicular) > 1e-12) return unitVector(perpendicular, 'perpendicular axis');
    }
    invalid('cannot construct perpendicular axis');
}

function deriveSeed(cn, referenceCode, seedKey) {
    const digest = crypto.createHash('sha256')
        .update(`${CAMPAIGN_ID}\0${cn}\0${referenceCode}\0${seedKey}`)
        .digest();
    return digest.readUInt32BE(0);
}

function permutation(length, seed) {
    const order = Array.from({ length }, (_, index) => index);
    let state = seed >>> 0;
    const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
    for (let index = length - 1; index > 0; index--) {
        const swap = Math.floor(next() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
    }
    if (length > 1 && order.every((value, index) => value === index)) {
        order.push(order.shift());
    }
    return order;
}

function reorder(points, order) {
    requireThat(points.length === order.length, 'permutation length mismatch');
    return order.map(index => points[index].slice());
}

function copyPoints(points) {
    return points.map(point => point.slice());
}

function fixed15(value) {
    requireThat(Number.isFinite(value), 'cannot serialize non-finite coordinate');
    return value.toFixed(15);
}

function pointsToFixed15(points) {
    return points.map(point => point.map(fixed15));
}

function fixed15ToPoints(tokens, label) {
    requireThat(Array.isArray(tokens), `${label} must be an array`);
    return tokens.map((point, pointIndex) => {
        requireThat(Array.isArray(point) && point.length === 3, `${label}/${pointIndex} is not xyz`);
        return point.map((token, axis) => {
            requireThat(typeof token === 'string' && FIXED15.test(token),
                `${label}/${pointIndex}/${axis} is not fixed15`);
            const value = Number(token);
            requireThat(Number.isFinite(value), `${label}/${pointIndex}/${axis} is non-finite`);
            return value;
        });
    });
}

function rmsRadius(points) {
    return Math.sqrt(points.reduce((sum, point) => sum + vectorDot(point, point), 0) / points.length);
}

function normalizedDistanceSignature(ligands) {
    const points = [[0, 0, 0], ...ligands];
    const radius = rmsRadius(ligands);
    const distances = [];
    for (let first = 0; first < points.length; first++) {
        for (let second = first + 1; second < points.length; second++) {
            distances.push(vectorNorm(vectorsSubtract(points[first], points[second])) / radius);
        }
    }
    return distances.sort((a, b) => a - b);
}

function changesDistanceSignature(before, after) {
    const first = normalizedDistanceSignature(before);
    const second = normalizedDistanceSignature(after);
    requireThat(first.length === second.length, 'distance signature length mismatch');
    return first.some((value, index) => Math.abs(value - second[index]) > 1e-12);
}

function selectedIndices(length, seed, count) {
    return permutation(length, seed).slice(0, Math.min(count, length));
}

function representationTransform(ligands, recipe, seed) {
    let result = copyPoints(ligands);
    const details = {};
    if (recipe.rotation) {
        const rotation = ROTATION_SPEC[recipe.rotation];
        result = result.map(point => rodrigues(point, rotation.axis, Number(rotation.angle_rad)));
        details.rotation = rotation;
    }
    if (recipe.scale) {
        result = result.map(point => vectorScale(point, Number(recipe.scale)));
        details.scale = recipe.scale;
    }
    if (recipe.permutation) {
        const order = permutation(result.length, seed);
        result = reorder(result, order);
        details.permutation_order_zero_based = order;
    }
    return { ligands: result, details };
}

function radialTransform(ligands, recipe, seed) {
    const result = copyPoints(ligands);
    const ligandIndex = selectedIndices(ligands.length, seed, 1)[0];
    const factor = 1 + Number(recipe.radial_fraction);
    result[ligandIndex] = vectorScale(result[ligandIndex], factor);
    return { ligands: result, details: { ligand_index_zero_based: ligandIndex, radial_factor: factor.toString() } };
}

function angularTransform(ligands, recipe, seed) {
    const result = copyPoints(ligands);
    const ligandIndex = selectedIndices(ligands.length, seed, 1)[0];
    const angle = Number(recipe.angular_radians);
    let chosen = null;
    let chosenOffset = null;
    for (let offset = 0; offset < 3; offset++) {
        const candidate = independentPerpendicular(result[ligandIndex], (seed >>> 8) + offset);
        const probe = copyPoints(ligands);
        probe[ligandIndex] = rodrigues(probe[ligandIndex], candidate, Math.abs(angle));
        if (changesDistanceSignature(ligands, probe)) {
            chosen = candidate;
            chosenOffset = offset;
            break;
        }
    }
    requireThat(chosen, `no distorting angular axis for ${recipe.id}`);
    result[ligandIndex] = rodrigues(result[ligandIndex], chosen, angle);
    return {
        ligands: result,
        details: {
            ligand_index_zero_based: ligandIndex,
            rotation_axis: chosen.map(value => value.toPrecision(17)),
            axis_candidate_offset: chosenOffset,
            angular_radians: recipe.angular_radians
        }
    };
}

function mixedTransform(ligands, recipe, seed) {
    const result = copyPoints(ligands);
    const indices = selectedIndices(ligands.length, seed, 3);
    const radialMagnitude = Number(recipe.radial_fraction);
    const angularMagnitude = Number(recipe.angular_radians);
    const operations = [];
    indices.forEach((ligandIndex, operationIndex) => {
        const sign = operationIndex % 2 === 0 ? 1 : -1;
        const radialFactor = 1 + sign * radialMagnitude;
        const axis = independentPerpendicular(result[ligandIndex], (seed + operationIndex + 1) >>> 0);
        result[ligandIndex] = rodrigues(
            vectorScale(result[ligandIndex], radialFactor),
            axis,
            sign * angularMagnitude
        );
        operations.push({
            ligand_index_zero_based: ligandIndex,
            radial_factor: radialFactor.toString(),
            angular_radians: (sign * angularMagnitude).toString(),
            rotation_axis: axis.map(value => value.toPrecision(17))
        });
    });
    return { ligands: result, details: { operations } };
}

function nearDegenerateTransform(ligands, recipe, seed) {
    const result = copyPoints(ligands);
    const [moving, anchor] = selectedIndices(ligands.length, seed, 2);
    const separation = rmsRadius(ligands) * Number(recipe.separation_rms_fraction);
    const direction = independentPerpendicular(result[anchor], seed >>> 5);
    result[moving] = vectorsAdd(result[anchor], vectorScale(direction, separation));
    return {
        ligands: result,
        details: {
            moving_ligand_index_zero_based: moving,
            anchor_ligand_index_zero_based: anchor,
            separation_rms_fraction: recipe.separation_rms_fraction,
            separation_direction_unit: direction.map(value => value.toPrecision(17))
        }
    };
}

function nearCollinearTransform(ligands, recipe, seed) {
    const result = copyPoints(ligands);
    const [anchor, moving] = selectedIndices(ligands.length, seed, 2);
    const anchorDirection = unitVector(result[anchor], 'near-collinear anchor');
    const movingRadius = vectorNorm(result[moving]);
    const tangent = independentPerpendicular(anchorDirection, seed >>> 7);
    const angle = Number(recipe.angular_radians);
    result[moving] = vectorScale(
        vectorsAdd(vectorScale(anchorDirection, Math.cos(angle)), vectorScale(tangent, Math.sin(angle))),
        movingRadius
    );
    return {
        ligands: result,
        details: {
            anchor_ligand_index_zero_based: anchor,
            moving_ligand_index_zero_based: moving,
            angular_radians: recipe.angular_radians,
            anchor_direction_unit: anchorDirection.map(value => value.toPrecision(17)),
            tangent_direction_unit: tangent.map(value => value.toPrecision(17)),
            retained_moving_radius: movingRadius.toPrecision(17)
        }
    };
}

function centerSwapTransform(ligands, seed) {
    const selected = selectedIndices(ligands.length, seed, 1)[0];
    const newCenter = ligands[selected];
    const allPoints = [[0, 0, 0], ...copyPoints(ligands)];
    const result = allPoints
        .filter((_, index) => index !== selected + 1)
        .map(point => vectorsSubtract(point, newCenter));
    requireThat(result.length === ligands.length, 'center-swap ligand count mismatch');
    return {
        ligands: result,
        details: { selected_original_ligand_index_zero_based: selected, original_center_becomes_ligand: true }
    };
}

function applyRecipe(baseLigands, recipe, seed, generated) {
    if (recipe.id === 'canonical') return { ligands: copyPoints(baseLigands), details: {} };
    if (recipe.category === 'representation') return representationTransform(baseLigands, recipe, seed);
    if (recipe.category === 'input_precision') {
        const parent = generated.get('rotation-a');
        requireThat(parent, `${recipe.id} lacks rotation-a parent`);
        return {
            ligands: parent.map(point => point.map(value => Number(value.toFixed(recipe.decimal_places)))),
            details: { decimal_places: recipe.decimal_places, parent_recipe_id: 'rotation-a' }
        };
    }
    if (recipe.category === 'radial') return radialTransform(baseLigands, recipe, seed);
    if (recipe.category === 'angular') return angularTransform(baseLigands, recipe, seed);
    if (recipe.category === 'mixed') return mixedTransform(baseLigands, recipe, seed);
    if (recipe.id === 'near-degenerate-assignment') return nearDegenerateTransform(baseLigands, recipe, seed);
    if (recipe.id === 'near-collinear') return nearCollinearTransform(baseLigands, recipe, seed);
    if (recipe.id === 'center-ligand-swap') return centerSwapTransform(baseLigands, seed);
    if (recipe.id === 'distorted-twin') {
        const parent = generated.get('mixed-plus-0.05');
        requireThat(parent, 'distorted-twin lacks mixed-plus-0.05 parent');
        const transformed = representationTransform(parent, recipe, seed);
        transformed.details.parent_recipe_id = 'mixed-plus-0.05';
        return transformed;
    }
    if (recipe.id === 'reflected-x') {
        return {
            ligands: baseLigands.map(([x, y, z]) => [-x, y, z]),
            details: { reflection_matrix_diagonal: ['-1', '1', '1'] }
        };
    }
    invalid(`unknown recipe ${recipe.id}`);
}

function flattenReferences(referenceDocument) {
    requireThat(referenceDocument?.schema_version === 2, 'references schema_version must be 2');
    requireThat(referenceDocument?.count === REFERENCE_COUNT, 'references count mismatch');
    requireThat(Array.isArray(referenceDocument.by_cn) && referenceDocument.by_cn.length === 11,
        'references by_cn census mismatch');
    const references = [];
    for (const group of referenceDocument.by_cn) {
        requireThat(Number.isInteger(group.cn) && group.cn >= 2 && group.cn <= 12, 'invalid reference CN');
        requireThat(Array.isArray(group.references) && group.references.length === group.count,
            `reference group CN${group.cn} count mismatch`);
        for (const reference of group.references) {
            requireThat(reference.qshape_point_group && reference.qshape_chirality,
                `${reference.qshape_code} lacks Q-Shape point-group/chirality binding`);
            requireThat(/^[0-9a-f]{64}$/.test(
                reference.metamorphic_parent_reference_fingerprint_sha256 || ''
            ), `${reference.qshape_code} lacks metamorphic parent fingerprint binding`);
            requireThat(Number.isInteger(reference.qshape_center_index_zero_based),
                `${reference.qshape_code} lacks center index`);
            requireThat(Array.isArray(reference.qshape_reference_coordinate_roundtrip_tokens) &&
                Array.isArray(reference.qshape_reference_coordinate_float64_hex) &&
                reference.qshape_reference_coordinate_roundtrip_tokens.length === group.cn + 1 &&
                reference.qshape_reference_coordinate_float64_hex.length === group.cn + 1,
            `${reference.qshape_code} lacks exact coordinate evidence`);
            requireThat(reference.qshape_center_index_zero_based >= 0 &&
                reference.qshape_center_index_zero_based <= group.cn,
            `${reference.qshape_code} center index is out of range`);
            const coordinates = reference.qshape_reference_coordinate_roundtrip_tokens.map((point, pointIndex) =>
                point.map((token, axis) => {
                    requireThat(Array.isArray(point) && point.length === 3 &&
                        Array.isArray(reference.qshape_reference_coordinate_float64_hex[pointIndex]) &&
                        reference.qshape_reference_coordinate_float64_hex[pointIndex].length === 3,
                    `${reference.qshape_code}/${pointIndex} coordinate width mismatch`);
                    const value = Number(token);
                    requireThat(Number.isFinite(value), `${reference.qshape_code}/${pointIndex}/${axis} non-finite`);
                    requireThat(HEX64.test(reference.qshape_reference_coordinate_float64_hex[pointIndex][axis]),
                        `${reference.qshape_code}/${pointIndex}/${axis} invalid bits`);
                    requireThat(float64Hex(value) === reference.qshape_reference_coordinate_float64_hex[pointIndex][axis],
                        `${reference.qshape_code}/${pointIndex}/${axis} token/bits mismatch`);
                    return value;
                })
            );
            requireThat(coordinates.length === group.cn + 1, `${reference.qshape_code} point count mismatch`);
            references.push({
                cn: group.cn,
                index: reference.qshape_index,
                code: reference.qshape_code,
                shapeCode: reference.shape_code || reference.shapeCode || reference.qshape_code,
                name: reference.qshape_name,
                pointGroup: reference.qshape_point_group,
                chirality: reference.qshape_chirality,
                retainedParentFingerprint:
                    reference.metamorphic_parent_reference_fingerprint_sha256,
                centerIndex: reference.qshape_center_index_zero_based,
                coordinates,
                coordinateRoundtripTokens: reference.qshape_reference_coordinate_roundtrip_tokens,
                coordinateBits: reference.qshape_reference_coordinate_float64_hex
            });
        }
    }
    requireThat(references.length === REFERENCE_COUNT, 'flattened reference count mismatch');
    return references;
}

function certifiedDirectReferenceProjectionBytes(referenceDocument) {
    const projected = JSON.parse(JSON.stringify(referenceDocument));
    delete projected.source_cases_sha256;
    delete projected.metamorphic_binding;
    requireThat(Array.isArray(projected.by_cn),
        'references by_cn must be an array for certified direct projection');
    for (const group of projected.by_cn) {
        requireThat(Array.isArray(group.references),
            `reference group CN${group?.cn ?? '<missing>'} lacks references for certified direct projection`);
        for (const reference of group.references) {
            delete reference.qshape_point_group;
            delete reference.qshape_chirality;
            delete reference.metamorphic_parent_reference_fingerprint_sha256;
        }
    }
    return Buffer.from(`${JSON.stringify(projected, null, 2)}\n`, 'utf8');
}

function referenceFingerprint(reference) {
    const contract = {
        cn: reference.cn,
        index: reference.index,
        code: reference.code,
        name: reference.name,
        point_group: reference.pointGroup,
        chirality: reference.chirality,
        coordinate_roundtrip_tokens: reference.coordinates.map(point =>
            point.map(value => Object.is(value, -0) ? '-0' : value.toPrecision(17))
        ),
        coordinate_float64_hex: reference.coordinates.map(point => point.map(float64Hex))
    };
    return sha256(Buffer.from(JSON.stringify(contract), 'utf8'));
}

function canonicalLigands(reference) {
    const center = reference.coordinates[reference.centerIndex];
    const ligands = reference.coordinates
        .filter((_, index) => index !== reference.centerIndex)
        .map(point => vectorsSubtract(point, center));
    return fixed15ToPoints(pointsToFixed15(ligands), `${reference.code}/canonical`);
}

function expectedCase(reference, recipe, recipeIndex, family, finalized, details, seed) {
    const main = family === 'main_positive';
    const cn = String(reference.cn).padStart(2, '0');
    const ref = String(reference.index).padStart(2, '0');
    const recipeToken = String(recipeIndex + 1).padStart(2, '0');
    const canonicalId = `meta-cn${cn}-ref${ref}-r01`;
    const rotationParent = MAIN_RECIPES.findIndex(item => item.id === 'rotation-a') + 1;
    const twinParent = MAIN_RECIPES.findIndex(item => item.id === 'mixed-plus-0.05') + 1;
    const ligandTokens = pointsToFixed15(finalized);
    return {
        case_id: `${main ? 'meta' : 'adv'}-cn${cn}-ref${ref}-r${recipeToken}`,
        structure_id: `${main ? 'M' : 'A'}${cn}${ref}${recipeToken}`,
        stratum: main ? 'metamorphic_main' : 'adversarial_positive',
        family,
        cn: reference.cn,
        source_name: reference.name,
        parent_reference_code: reference.code,
        parent_reference_index: reference.index,
        parent_reference_fingerprint_sha256: referenceFingerprint(reference),
        reference_point_group: reference.pointGroup,
        reference_chirality: reference.chirality,
        expected_own_target_code: recipe.id === 'canonical' || recipe.category === 'representation'
            ? reference.code
            : null,
        recipe_id: recipe.id,
        recipe_index: recipeIndex + 1,
        recipe_category: recipe.category,
        relation: recipe.relation,
        generation_seed_uint32: seed,
        generation_seed_derivation_key: recipe.seed_key || recipe.id,
        applicability: recipe.id === 'near-collinear' && reference.cn === 2
            ? 'structurally_degenerate_cn2_stress'
            : 'general',
        parent_case_id: recipe.id === 'distorted-twin'
            ? `meta-cn${cn}-ref${ref}-r${String(twinParent).padStart(2, '0')}`
            : recipe.category === 'input_precision'
                ? `meta-cn${cn}-ref${ref}-r${String(rotationParent).padStart(2, '0')}`
                : recipe.id === 'canonical'
                    ? null
                    : canonicalId,
        recipe_parameters: Object.fromEntries(
            Object.entries(recipe).filter(([key]) => !['id', 'category', 'relation'].includes(key))
        ),
        generation_details: details,
        qshape_actual_ligand_tokens: ligandTokens,
        shape_atoms: [
            { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
            ...ligandTokens.map(tokens => ({ element: 'C', tokens }))
        ],
        input_coordinate_policy:
            'recipe_applied_to_parent_fixed15_ligands_then_reserialized_fixed15; identical tokens feed Q-Shape and SHAPE'
    };
}

function verifyFrozenInputs(caseDocument, referenceDocument, caseBytes = null) {
    if (caseBytes) requireThat(sha256(caseBytes) === CASES_SHA256, 'frozen cases SHA-256 mismatch');
    requireThat(caseDocument?.schema_version === 1, 'cases schema_version must be 1');
    requireThat(caseDocument?.campaign_id === CAMPAIGN_ID, 'cases campaign_id mismatch');
    requireThat(caseDocument?.status === 'preregistered_generated_inputs', 'cases status mismatch');
    requireThat(caseDocument?.reference_count === REFERENCE_COUNT, 'cases reference count mismatch');
    requireThat(caseDocument?.count === CASE_COUNT, 'cases count mismatch');
    requireThat(caseDocument?.expected_matched_target_evaluations_per_program === MATCHED_PAIR_COUNT,
        'matched-pair count mismatch');
    requireThat(jsonEqual(caseDocument.explicit_seed_sensitivity_uint32, [0, 1364412496, 4294967295]),
        'explicit seed registry mismatch');
    requireThat(jsonEqual(caseDocument.main_recipe_registry, MAIN_RECIPES), 'main recipe registry mismatch');
    requireThat(jsonEqual(caseDocument.adversarial_positive_recipe_registry, ADVERSARIAL_RECIPES),
        'adversarial recipe registry mismatch');
    requireThat(sha256(Buffer.from(JSON.stringify(MAIN_RECIPES), 'utf8')) === MAIN_REGISTRY_SHA256,
        'internal main registry hash mismatch');
    requireThat(sha256(Buffer.from(JSON.stringify(ADVERSARIAL_RECIPES), 'utf8')) === ADVERSARIAL_REGISTRY_SHA256,
        'internal adversarial registry hash mismatch');
    requireThat(caseDocument.main_recipe_registry_sha256 === MAIN_REGISTRY_SHA256,
        'manifested main registry hash mismatch');
    requireThat(caseDocument.adversarial_positive_recipe_registry_sha256 === ADVERSARIAL_REGISTRY_SHA256,
        'manifested adversarial registry hash mismatch');
    requireThat(Array.isArray(caseDocument.cases) && caseDocument.cases.length === CASE_COUNT,
        'case array count mismatch');

    const references = flattenReferences(referenceDocument);
    requireThat(referenceDocument.source_cases_sha256 === CASES_SHA256,
        'reference top-level cases binding mismatch');
    requireThat(referenceDocument.metamorphic_binding?.campaign_id === CAMPAIGN_ID &&
        referenceDocument.metamorphic_binding.source_positive_cases_sha256 === CASES_SHA256 &&
        referenceDocument.metamorphic_binding.source_direct_references_sha256 ===
            CERTIFIED_DIRECT_REFERENCES_SHA256 &&
        referenceDocument.metamorphic_binding.source_direct_package_manifest_sha256 ===
            CERTIFIED_DIRECT_PACKAGE_MANIFEST_SHA256,
    'reference certified lineage binding mismatch');
    requireThat(sha256(certifiedDirectReferenceProjectionBytes(referenceDocument)) ===
        CERTIFIED_DIRECT_REFERENCES_SHA256,
    'reference certified direct projection SHA-256 mismatch');
    const caseFingerprints = new Map();
    for (const item of caseDocument.cases) {
        const key = `${item.cn}\u0000${item.parent_reference_code}\u0000${item.parent_reference_index}`;
        if (!caseFingerprints.has(key)) caseFingerprints.set(key, new Set());
        caseFingerprints.get(key).add(item.parent_reference_fingerprint_sha256);
    }
    for (const reference of references) {
        const reconstructed = referenceFingerprint(reference);
        const key = `${reference.cn}\u0000${reference.code}\u0000${reference.index}`;
        const frozenCaseFingerprints = caseFingerprints.get(key);
        requireThat(reference.retainedParentFingerprint === reconstructed &&
            frozenCaseFingerprints?.size === 1 && frozenCaseFingerprints.has(reconstructed),
        `${reference.code} retained parent fingerprint binding mismatch`);
    }
    const observedIds = new Set();
    let caseOffset = 0;
    let expectedPairs = 0;
    for (const reference of references) {
        const base = canonicalLigands(reference);
        const generated = new Map();
        const families = [
            { registry: MAIN_RECIPES, family: 'main_positive' },
            { registry: ADVERSARIAL_RECIPES, family: 'adversarial_positive' }
        ];
        for (const { registry, family } of families) {
            registry.forEach((recipe, recipeIndex) => {
                const seed = deriveSeed(reference.cn, reference.code, recipe.seed_key || recipe.id);
                const transformed = applyRecipe(base, recipe, seed, generated);
                const finalized = fixed15ToPoints(pointsToFixed15(transformed.ligands), `${reference.code}/${recipe.id}`);
                generated.set(recipe.id, finalized);
                const expected = expectedCase(
                    reference,
                    recipe,
                    recipeIndex,
                    family,
                    finalized,
                    transformed.details,
                    seed
                );
                const observed = caseDocument.cases[caseOffset++];
                requireThat(observed && jsonEqual(observed, expected),
                    `case reconstruction mismatch at ${expected.case_id}`);
                requireThat(!observedIds.has(observed.case_id), `duplicate case_id ${observed.case_id}`);
                observedIds.add(observed.case_id);
            });
        }
        const sameCnTargetCount = references.filter(item => item.cn === reference.cn).length;
        expectedPairs += 33 * sameCnTargetCount;
    }
    requireThat(caseOffset === CASE_COUNT, 'case reconstruction did not consume exact array');
    requireThat(observedIds.size === CASE_COUNT, 'case ID census mismatch');
    requireThat(expectedPairs === MATCHED_PAIR_COUNT, 'independent pair census mismatch');
    return {
        campaign_id: CAMPAIGN_ID,
        cases_sha256: CASES_SHA256,
        reference_count: references.length,
        case_count: caseOffset,
        matched_pairs_per_program: expectedPairs,
        input_reconstruction_status: 'pass'
    };
}

function readJsonFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath);
        return { raw, value: JSON.parse(raw.toString('utf8')) };
    } catch (error) {
        invalid(`cannot parse JSON ${filePath}: ${error.message}`);
    }
}

function verifyManifestFiles(packagePath) {
    const root = path.resolve(packagePath);
    requireThat(fs.existsSync(root) && fs.statSync(root).isDirectory(),
        `package directory does not exist: ${root}`);
    const manifestPath = path.join(root, 'manifest.json');
    const digestPath = path.join(root, 'manifest.sha256');
    requireThat(isRegularFile(manifestPath), 'manifest.json is missing');
    requireThat(isRegularFile(digestPath), 'manifest.sha256 is missing');
    const digestMatch = fs.readFileSync(digestPath, 'utf8')
        .match(/^([0-9a-f]{64})  manifest\.json\n$/);
    requireThat(digestMatch, 'manifest.sha256 has invalid syntax');
    const manifestSha256 = sha256File(manifestPath);
    requireThat(digestMatch[1] === manifestSha256, 'manifest.json digest mismatch');
    const manifest = readJsonFile(manifestPath).value;
    requireThat(Number.isInteger(manifest.schema_version) && manifest.schema_version >= 2,
        'unsupported manifest schema');
    requireThat(Array.isArray(manifest.files), 'manifest file inventory is missing');
    const listed = new Map();
    for (const entry of manifest.files) {
        const token = normalizeManifestPath(entry?.path);
        requireThat(!listed.has(token), `duplicate manifest path: ${token}`);
        requireThat(Number.isInteger(entry.size_bytes) && entry.size_bytes >= 0,
            `invalid manifest size for ${token}`);
        requireThat(/^[0-9a-f]{64}$/.test(entry.sha256 || ''),
            `invalid manifest digest for ${token}`);
        listed.set(token, entry);
    }
    const present = walk(root).map(filePath =>
        path.relative(root, filePath).replace(/\\/g, '/')
    ).filter(token => token !== 'manifest.json' && token !== 'manifest.sha256');
    exactSet(present, [...listed.keys()], 'manifest/present files');
    for (const [token, entry] of listed) {
        const filePath = path.join(root, ...token.split('/'));
        const stat = fs.statSync(filePath);
        requireThat(stat.size === entry.size_bytes, `size mismatch for ${token}`);
        requireThat(sha256File(filePath) === entry.sha256, `digest mismatch for ${token}`);
    }
    return { root, manifest, manifestSha256, listedPaths: new Set(listed.keys()) };
}

function packageJson(root, listedPaths, token, label) {
    const filePath = resolveListedFile(root, listedPaths, token, label);
    const raw = fs.readFileSync(filePath);
    try {
        return { path: filePath, raw, value: JSON.parse(raw.toString('utf8')) };
    } catch (error) {
        invalid(`cannot parse ${label}: ${error.message}`);
    }
}

function packageText(root, listedPaths, token, label) {
    const filePath = resolveListedFile(root, listedPaths, token, label);
    return fs.readFileSync(filePath, 'utf8');
}

function fieldOf(object, ...names) {
    for (const name of names) {
        if (object && Object.prototype.hasOwnProperty.call(object, name)) return object[name];
    }
    return undefined;
}

function pairKeyOf(caseId, targetCode) {
    return `${caseId}\u0000${targetCode}`;
}

function qTokenBits(token) {
    if (token === 'NaN' || token === 'Infinity' || token === '-Infinity') {
        return float64Hex(Number(token));
    }
    try {
        const value = canonicalBinary64Token(token, 'Q-Shape result token');
        return float64Hex(value);
    } catch (_error) {
        return null;
    }
}

function qValueFromRow(row) {
    const token = fieldOf(row, 'valueToken', 'value_token');
    if (qTokenBits(token) === null) return null;
    if (token === 'NaN' || token === 'Infinity' || token === '-Infinity') return null;
    return parseDecimal(token);
}

function shapeValueFromRow(row) {
    const token = fieldOf(row, 'valueToken', 'value_token');
    if (typeof token !== 'string' || !/^\d+\.\d{5}$/.test(token)) return null;
    return parseDecimal(token);
}

function expectedPairMap(casesDocument, references) {
    const caseMap = new Map();
    const caseOrdinalById = new Map();
    const pairs = new Map();
    requireThat(Array.isArray(casesDocument.cases), 'cases array is missing');
    for (const item of casesDocument.cases) {
        requireThat(typeof item.case_id === 'string' && item.case_id.length > 0,
            'case ID is missing');
        requireThat(!caseMap.has(item.case_id), `duplicate case ID ${item.case_id}`);
        const targets = references.filter(reference => reference.cn === item.cn);
        requireThat(targets.length > 0, `no references for case ${item.case_id}`);
        caseMap.set(item.case_id, item);
        caseOrdinalById.set(item.case_id, caseMap.size - 1);
        for (const target of targets) {
            const key = pairKeyOf(item.case_id, target.code);
            requireThat(!pairs.has(key), `duplicate expected pair ${key}`);
            pairs.set(key, { caseItem: item, target });
        }
    }
    requireThat(caseMap.size === CASE_COUNT, 'case map census mismatch');
    requireThat(pairs.size === MATCHED_PAIR_COUNT, 'expected pair census mismatch');
    return { caseMap, pairs, caseOrdinalById };
}

function expectedCaseOrder(caseMap) {
    return [...caseMap.values()].map((item, index) => ({ item, ordinal: index }));
}

function inputBundleContentContract(receipt) {
    return {
        schema_version: receipt.schema_version,
        receipt_kind: receipt.receipt_kind,
        campaign_id: receipt.campaign_id,
        source_commit: receipt.source_commit,
        positive_cases: receipt.positive_cases,
        references: receipt.references,
        malformed_controls: receipt.malformed_controls
    };
}

function validateRetainedInputBundleReceipt(receiptFile, casesFile, referencesFile, malformedFile, manifest) {
    const receipt = receiptFile.value;
    exactSet(Object.keys(receipt || {}), [
        'schema_version', 'receipt_kind', 'campaign_id', 'source_commit',
        'positive_cases', 'references', 'malformed_controls', 'status',
        'positive_execution_started', 'output_policy', 'bundle_sha256', 'files'
    ], 'execution-input receipt fields');
    exactSet(Object.keys(receipt.positive_cases || {}), [
        'campaign_id', 'sha256', 'count', 'matched_target_evaluations_per_program'
    ], 'execution-input positive-case fields');
    exactSet(Object.keys(receipt.references || {}), [
        'sha256', 'count', 'source_direct_references_sha256',
        'source_direct_package_manifest_sha256'
    ], 'execution-input reference fields');
    exactSet(Object.keys(receipt.malformed_controls || {}), [
        'campaign_id', 'sha256', 'count', 'expected_numeric_rows_contract',
        'expected_numeric_rows_by_control', 'expected_numeric_rows_total'
    ], 'execution-input malformed-control fields');
    exactSet(Object.keys(receipt.files || {}), ['references', 'malformed_controls', 'receipt', 'status'],
        'execution-input file-registry fields');

    const expectedRowsByControl = Object.fromEntries(
        malformedFile.value.controls.map(control => [control.control_id, control.expected_numeric_rows])
    );
    const expectedRowsTotal = Object.values(expectedRowsByControl).reduce((sum, value) => sum + value, 0);
    const referenceBinding = referencesFile.value?.metamorphic_binding;
    const directReferencesSha256 = referenceBinding?.source_direct_references_sha256;
    const directPackageManifestSha256 =
        referenceBinding?.source_direct_package_manifest_sha256;
    requireThat(receipt.schema_version === 2 &&
        receipt.receipt_kind === EXECUTION_INPUT_RECEIPT_KIND &&
        receipt.campaign_id === EXECUTION_INPUT_CAMPAIGN_ID &&
        receipt.source_commit === manifest.candidate_source?.repo_commit &&
        /^[0-9a-f]{40}$/.test(receipt.source_commit) &&
        receipt.status === 'preregistered_execution_inputs' &&
        receipt.positive_execution_started === false &&
        receipt.output_policy === 'input-only directory; numerical outputs are forbidden' &&
        receipt.positive_cases.campaign_id === CAMPAIGN_ID &&
        receipt.positive_cases.sha256 === sha256(casesFile.raw) &&
        receipt.positive_cases.count === casesFile.value.count &&
        receipt.positive_cases.matched_target_evaluations_per_program ===
            casesFile.value.expected_matched_target_evaluations_per_program &&
        receipt.references.sha256 === sha256(referencesFile.raw) &&
        receipt.references.count === referencesFile.value.count &&
        receipt.references.source_direct_references_sha256 === directReferencesSha256 &&
        receipt.references.source_direct_package_manifest_sha256 === directPackageManifestSha256 &&
        referencesFile.value.source_cases_sha256 === CASES_SHA256 &&
        referenceBinding?.campaign_id === CAMPAIGN_ID &&
        referenceBinding?.source_positive_cases_sha256 === CASES_SHA256 &&
        directReferencesSha256 === CERTIFIED_DIRECT_REFERENCES_SHA256 &&
        directPackageManifestSha256 === CERTIFIED_DIRECT_PACKAGE_MANIFEST_SHA256 &&
        receipt.malformed_controls.campaign_id === CONTROL_CAMPAIGN_ID &&
        receipt.malformed_controls.sha256 === sha256(malformedFile.raw) &&
        receipt.malformed_controls.count === malformedFile.value.count &&
        receipt.malformed_controls.expected_numeric_rows_contract === 'per-control' &&
        jsonSemanticEqual(receipt.malformed_controls.expected_numeric_rows_by_control,
            expectedRowsByControl) &&
        receipt.malformed_controls.expected_numeric_rows_total === expectedRowsTotal &&
        receipt.files.references === 'references.json' &&
        receipt.files.malformed_controls === 'malformed-controls.json' &&
        receipt.files.receipt === 'receipt.json' && receipt.files.status === 'STATUS.md',
    'execution-input receipt does not exactly bind the retained candidate inputs');
    const expectedBundleSha256 = sha256(Buffer.from(
        JSON.stringify(canonicalJson(inputBundleContentContract(receipt))), 'utf8'
    ));
    requireThat(receipt.bundle_sha256 === expectedBundleSha256 &&
        manifest.input_bundle_sha256 === expectedBundleSha256 &&
        manifest.input_bundle_receipt_sha256 === sha256(receiptFile.raw),
    'execution-input receipt or bundle SHA-256 mismatch');
    requireThat(receiptFile.raw.equals(Buffer.from(
        `${JSON.stringify(canonicalJson(receipt), null, 2)}\n`, 'utf8'
    )),
        'execution-input receipt bytes are not canonical');
    return { receipt, receiptSha256: sha256(receiptFile.raw), bundleSha256: expectedBundleSha256 };
}

function validateFrozenPackageInputs(root, listedPaths, manifest) {
    exactSet(
        [...listedPaths].filter(filePath => filePath.startsWith('inputs/frozen/')),
        [
            'inputs/frozen/cases.json',
            'inputs/frozen/references.json',
            'inputs/frozen/malformed-controls.json',
            'inputs/frozen/input-bundle-receipt.json',
            'inputs/frozen/registry.json'
        ],
        'retained frozen-input exact file set'
    );
    const casesFile = packageJson(root, listedPaths, 'inputs/frozen/cases.json', 'frozen cases');
    const referencesFile = packageJson(root, listedPaths, 'inputs/frozen/references.json', 'frozen references');
    const malformedFile = packageJson(
        root, listedPaths, 'inputs/frozen/malformed-controls.json', 'frozen malformed controls'
    );
    const bundleReceiptFile = packageJson(
        root, listedPaths, 'inputs/frozen/input-bundle-receipt.json',
        'frozen execution-input receipt'
    );
    requireThat(sha256(casesFile.raw) === CASES_SHA256, 'frozen cases SHA-256 mismatch');
    if (manifest.cases_sha256 !== CASES_SHA256) invalid('manifest cases SHA-256 mismatch');
    requireThat(manifest.references_sha256 === sha256(referencesFile.raw),
        'manifest references SHA-256 mismatch');
    requireThat(manifest.malformed_controls_sha256 === sha256(malformedFile.raw),
        'manifest malformed-control SHA-256 mismatch');
    const inputReceipt = verifyFrozenInputs(casesFile.value, referencesFile.value, casesFile.raw);
    requireThat(inputReceipt.campaign_id === CAMPAIGN_ID, 'frozen campaign mismatch');

    const recipes = packageJson(root, listedPaths, 'recipes.json', 'recipe registry').value;
    requireThat(recipes.schema_version === 1 && recipes.campaign_id === CAMPAIGN_ID,
        'recipe registry envelope mismatch');
    requireThat(jsonEqual(recipes.main_recipe_registry, casesFile.value.main_recipe_registry) &&
        jsonEqual(recipes.adversarial_positive_recipe_registry,
            casesFile.value.adversarial_positive_recipe_registry),
    'recipe registry does not match frozen cases');
    requireThat(recipes.main_recipe_registry_sha256 === MAIN_REGISTRY_SHA256 &&
        recipes.adversarial_positive_recipe_registry_sha256 === ADVERSARIAL_REGISTRY_SHA256,
    'recipe registry hash mismatch');

    const registry = packageJson(root, listedPaths, 'inputs/frozen/registry.json', 'frozen registry').value;
    requireThat(registry.schema_version === 1 && registry.campaign_id === CAMPAIGN_ID,
        'frozen registry envelope mismatch');
    requireThat(registry.cases?.path === 'cases.json' && registry.cases.sha256 === sha256(casesFile.raw),
        'frozen cases registry binding mismatch');
    requireThat(registry.references?.path === 'references.json' &&
        registry.references.sha256 === sha256(referencesFile.raw),
    'frozen references registry binding mismatch');
    requireThat(registry.malformed_controls?.path === 'malformed-controls.json' &&
        registry.malformed_controls.sha256 === sha256(malformedFile.raw),
    'frozen malformed registry binding mismatch');
    requireThat(registry.input_bundle_receipt?.path === 'input-bundle-receipt.json' &&
        registry.input_bundle_receipt.sha256 === sha256(bundleReceiptFile.raw) &&
        registry.input_bundle_receipt.bundle_sha256 === bundleReceiptFile.value.bundle_sha256,
    'frozen execution-input receipt registry binding mismatch');

    validateMalformedFrozenDocument(malformedFile.value, casesFile.raw, casesFile.value);
    const inputBundleReceipt = validateRetainedInputBundleReceipt(
        bundleReceiptFile, casesFile, referencesFile, malformedFile, manifest
    );
    return {
        cases: casesFile.value,
        references: referencesFile.value,
        malformed: malformedFile.value,
        malformedSha256: sha256(malformedFile.raw),
        referencesFlat: flattenReferences(referencesFile.value),
        inputReceipt,
        inputBundleReceipt
    };
}

function unsupportedMalformedLigands() {
    return Array.from({ length: 13 }, (_, index) => {
        const n = index + 1;
        return [n.toFixed(15), (n * n).toFixed(15), (n * n * n).toFixed(15)];
    });
}

function validateMalformedFrozenDocument(document, casesBytes, casesDocument) {
    requireThat(document?.schema_version === 1 && document.campaign_id === CONTROL_CAMPAIGN_ID,
        'malformed-control envelope mismatch');
    exactSet(Object.keys(document), [
        'schema_version', 'campaign_id', 'status', 'claim_boundary',
        'source_positive_campaign_id', 'source_positive_cases_sha256',
        'expected_numeric_rows_policy', 'count', 'controls'
    ], 'malformed-control document fields');
    requireThat(document.status === MALFORMED_CONTROL_STATUS &&
        document.claim_boundary === MALFORMED_CLAIM_BOUNDARY &&
        document.source_positive_campaign_id === CAMPAIGN_ID &&
        document.source_positive_cases_sha256 === sha256(casesBytes) &&
        document.expected_numeric_rows_policy === 'per-control product-boundary contract',
    'malformed-control source binding mismatch');
    requireThat(document.count === MALFORMED_CONTROL_CONTRACTS.length &&
        Array.isArray(document.controls) && document.controls.length === 7,
    'malformed-control census mismatch');
    const parent = casesDocument?.cases?.find(item => item.case_id === MALFORMED_PARENT_CASE_ID);
    requireThat(parent && parent.cn === 4 && Array.isArray(parent.qshape_actual_ligand_tokens) &&
        parent.qshape_actual_ligand_tokens.length === 4 && Array.isArray(parent.shape_atoms) &&
        parent.shape_atoms.length === 5 &&
        /^[0-9a-f]{64}$/.test(parent.parent_reference_fingerprint_sha256),
    'malformed-control frozen parent binding mismatch');
    const parentLigands = structuredClone(parent.qshape_actual_ligand_tokens);
    const parentAtoms = structuredClone(parent.shape_atoms);
    const missingCenterAtoms = [
        ...structuredClone(parentAtoms.slice(1)),
        { element: 'C', tokens: ['0.250000000000000', '0.250000000000000', '0.250000000000000'] }
    ];
    const misplacedCenterAtoms = [...structuredClone(parentAtoms.slice(1)), structuredClone(parentAtoms[0])];
    const pointCount = structuredClone(parentLigands.slice(0, 3));
    const nonfinite = structuredClone(parentLigands);
    nonfinite[1][2] = 'NaN';
    const duplicate = structuredClone(parentLigands);
    duplicate[1] = structuredClone(duplicate[0]);
    const effectivelyZero = structuredClone(parentLigands);
    effectivelyZero[0] = ['0.000001000000000', '0.000000000000000', '0.000000000000000'];
    const expectedInputs = [
        { declared_cn: 4, target_code: 'SP-4', target_index: 1, atoms: missingCenterAtoms },
        { declared_cn: 4, target_code: 'SP-4', target_index: 1, atoms: misplacedCenterAtoms },
        { declared_cn: 4, target_code: 'SP-4', ligand_tokens: pointCount },
        { declared_cn: 4, target_code: 'SP-4', ligand_tokens: nonfinite },
        { declared_cn: 4, target_code: 'SP-4', ligand_tokens: duplicate },
        { declared_cn: 4, target_code: 'SP-4', ligand_tokens: effectivelyZero },
        { declared_cn: 13, target_code: null, ligand_tokens: unsupportedMalformedLigands() }
    ];
    const ids = new Set();
    const categories = new Set();
    for (const [index, control] of document.controls.entries()) {
        const expected = MALFORMED_CONTROL_CONTRACTS[index];
        exactSet(Object.keys(control), [
            'control_id', 'program', 'interface', 'category', 'cn', 'expected_outcome',
            'expected_numeric_rows', 'harness_only_expected_rejection_code',
            'source_parent_case_id', 'source_parent_reference_code',
            'source_parent_reference_fingerprint_sha256', 'campaign_gate', 'input'
        ], `malformed control ${index + 1} fields`);
        requireThat(jsonSemanticEqual(
            Object.fromEntries(Object.keys(expected).map(key => [key, control[key]])),
            expected
        ) && !ids.has(control.control_id), 'malformed control identity/contract mismatch');
        ids.add(control.control_id);
        categories.add(control.category);
        requireThat(control.source_parent_case_id === parent.case_id &&
            control.source_parent_reference_code === parent.parent_reference_code &&
            control.source_parent_reference_fingerprint_sha256 ===
                parent.parent_reference_fingerprint_sha256 &&
            control.campaign_gate === 'malformed_control_contract' &&
            jsonEqual(control.input, expectedInputs[index]),
        `malformed control ${control.control_id} contract mismatch`);
    }
    exactSet([...categories], MALFORMED_CATEGORIES, 'malformed category census');
}

function stableJsonText(value) {
    return `${JSON.stringify(canonicalJson(value), null, 2)}\n`;
}

function gitBlobOid(buffer, oidLength) {
    const algorithm = oidLength === 40 ? 'sha1' : oidLength === 64 ? 'sha256' : null;
    requireThat(algorithm, `unsupported Git object ID length ${oidLength}`);
    return crypto.createHash(algorithm)
        .update(Buffer.from(`blob ${buffer.length}\0`, 'utf8'))
        .update(buffer)
        .digest('hex');
}

function validateCandidateSourceBoundary(bundle) {
    const { root, listedPaths, manifest } = bundle;
    const source = manifest.candidate_source;
    requireThat(source && typeof source === 'object', 'manifest candidate source identity is missing');
    exactSet(Object.keys(source), [
        'repo_commit', 'repo_branch', 'worktree_clean_before_run', 'worktree_clean_before_seal',
        'source_tree_sha256', 'snapshot_path', 'snapshot_identity_sha256', 'dependency_lockfile'
    ], 'manifest candidate source fields');
    requireThat(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(source.repo_commit) &&
        (source.repo_branch === null || typeof source.repo_branch === 'string') &&
        source.worktree_clean_before_run === true && source.worktree_clean_before_seal === true &&
        /^[0-9a-f]{64}$/.test(source.source_tree_sha256) &&
        source.snapshot_path === 'inputs/candidate-snapshot' &&
        /^[0-9a-f]{64}$/.test(source.snapshot_identity_sha256),
    'manifest candidate source identity is invalid');

    const identityFile = packageJson(
        root, listedPaths, 'inputs/candidate-snapshot/identity.json', 'candidate snapshot identity'
    );
    const identity = identityFile.value;
    requireThat(sha256(identityFile.raw) === source.snapshot_identity_sha256,
        'candidate snapshot identity SHA-256 mismatch');
    requireThat(identityFile.raw.equals(Buffer.from(stableJsonText(identity), 'utf8')),
        'candidate snapshot identity bytes are not canonical stable JSON');
    exactSet(Object.keys(identity), [
        'schema_version', 'identity_kind', 'repo_commit', 'repo_branch', 'detached_head',
        'worktree_clean_at_start', 'dependency_lockfile', 'source_tree_sha256', 'files'
    ], 'candidate snapshot identity fields');
    requireThat(identity.schema_version === 1 &&
        identity.identity_kind === 'clean-committed-qshape-candidate' &&
        identity.repo_commit === source.repo_commit && identity.repo_branch === source.repo_branch &&
        identity.detached_head === (identity.repo_branch === null) &&
        identity.worktree_clean_at_start === true &&
        identity.source_tree_sha256 === source.source_tree_sha256,
    'candidate snapshot identity/manifest mismatch');
    requireThat(Array.isArray(identity.files) && identity.files.length === CANDIDATE_SOURCE_PATHS.length,
        'candidate snapshot source-file census mismatch');
    requireThat(jsonEqual(identity.files.map(file => file.path), CANDIDATE_SOURCE_PATHS),
        'candidate snapshot source-file order/path contract mismatch');

    const expectedSnapshotPaths = new Set([
        'inputs/candidate-snapshot/identity.json',
        ...CANDIDATE_SOURCE_PATHS.map(filePath => `inputs/candidate-snapshot/${filePath}`)
    ]);
    const actualSnapshotPaths = new Set([...listedPaths].filter(filePath =>
        filePath.startsWith('inputs/candidate-snapshot/')
    ));
    exactSet([...actualSnapshotPaths], [...expectedSnapshotPaths], 'candidate snapshot exact file set');

    for (const [index, file] of identity.files.entries()) {
        exactSet(Object.keys(file), ['path', 'size_bytes', 'sha256', 'git_blob_oid'],
            `candidate source entry ${index + 1} fields`);
        requireThat(file.path === CANDIDATE_SOURCE_PATHS[index] &&
            Number.isInteger(file.size_bytes) && file.size_bytes >= 0 &&
            /^[0-9a-f]{64}$/.test(file.sha256) &&
            /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(file.git_blob_oid),
        `candidate source entry ${index + 1} identity mismatch`);
        const packageToken = `inputs/candidate-snapshot/${file.path}`;
        const retainedPath = resolveListedFile(root, listedPaths, packageToken, `candidate source ${file.path}`);
        const retained = fs.readFileSync(retainedPath);
        requireThat(retained.length === file.size_bytes && sha256(retained) === file.sha256,
            `candidate source bytes mismatch for ${file.path}`);
        requireThat(gitBlobOid(retained, file.git_blob_oid.length) === file.git_blob_oid,
            `candidate Git blob identity mismatch for ${file.path}`);
    }

    const treeContract = { repo_commit: identity.repo_commit, files: identity.files };
    requireThat(sha256(Buffer.from(stableJsonText(treeContract), 'utf8')) === identity.source_tree_sha256,
        'candidate source-tree SHA-256 mismatch');
    const lockEntry = identity.files.find(file => file.path === 'package-lock.json');
    requireThat(lockEntry && jsonSemanticEqual(identity.dependency_lockfile, {
        path: 'package-lock.json', sha256: lockEntry.sha256
    }) && jsonSemanticEqual(source.dependency_lockfile, identity.dependency_lockfile),
    'candidate dependency lockfile binding mismatch');
    packageJson(
        root, listedPaths, 'inputs/candidate-snapshot/package-lock.json',
        'candidate dependency lockfile'
    );

    const finalRecheck = packageJson(
        root, listedPaths, 'metadata/candidate-source-final-recheck.json',
        'candidate source final recheck'
    ).value;
    exactSet(Object.keys(finalRecheck), [
        'schema_version', 'status', 'repo_commit', 'source_tree_sha256',
        'snapshot_identity_sha256', 'original_frozen_inputs_unchanged',
        'retained_frozen_inputs_unchanged'
    ], 'candidate final-recheck fields');
    requireThat(finalRecheck.schema_version === 1 && finalRecheck.status === 'unchanged' &&
        finalRecheck.repo_commit === identity.repo_commit &&
        finalRecheck.source_tree_sha256 === identity.source_tree_sha256 &&
        finalRecheck.snapshot_identity_sha256 === source.snapshot_identity_sha256 &&
        finalRecheck.original_frozen_inputs_unchanged === true &&
        finalRecheck.retained_frozen_inputs_unchanged === true,
    'candidate final-recheck identity mismatch');

    const runState = packageJson(root, listedPaths, 'run-state.json', 'sealed run state').value;
    requireThat(runState.schema_version === 1 && runState.status === 'sealed' &&
        jsonSemanticEqual(runState.candidate_source_identity, identity),
    'run-state candidate identity mismatch');
    requireThat(runState.stages?.preflight?.candidate_repo_commit === identity.repo_commit &&
        runState.stages.preflight.candidate_source_tree_sha256 === identity.source_tree_sha256 &&
        runState.stages.preflight.candidate_snapshot_identity_sha256 === source.snapshot_identity_sha256 &&
        jsonSemanticEqual(runState.stages?.final_candidate_recheck, finalRecheck),
    'run-state candidate checkpoint mismatch');
    requireThat(jsonSemanticEqual(manifest.stages?.final_candidate_recheck, finalRecheck),
        'manifest candidate final-recheck mismatch');
    return { identity, finalRecheck };
}

function runtimeIdentitySha256(identity) {
    return sha256(Buffer.from(JSON.stringify(canonicalJson(identity)), 'utf8'));
}

function validateRuntimeIdentityDocument(identity, dependencyLockfileSha256, label) {
    exactSet(Object.keys(identity || {}), [
        'schema_version', 'identity_kind', 'process_model', 'node_version',
        'node_versions_node', 'v8_version', 'platform', 'arch',
        'node_executable_path', 'node_executable_sha256', 'node_executable_size_bytes',
        'intl_locale', 'intl_time_zone', 'environment_locale', 'environment_time_zone',
        'dependency_lockfile'
    ], `${label} fields`);
    exactSet(Object.keys(identity.environment_locale || {}), ['lc_all', 'lang', 'language'],
        `${label} environment-locale fields`);
    exactSet(Object.keys(identity.dependency_lockfile || {}), ['path', 'sha256'],
        `${label} dependency-lockfile fields`);
    const absoluteExecutable = path.posix.isAbsolute(identity.node_executable_path || '') ||
        path.win32.isAbsolute(identity.node_executable_path || '');
    requireThat(identity.schema_version === 1 && identity.identity_kind === RUNTIME_IDENTITY_KIND &&
        identity.process_model === QSHAPE_PROCESS_MODEL &&
        typeof identity.node_version === 'string' && /^v\d+\.\d+\.\d+/.test(identity.node_version) &&
        identity.node_versions_node === identity.node_version.slice(1) &&
        typeof identity.v8_version === 'string' && identity.v8_version.length > 0 &&
        typeof identity.platform === 'string' && identity.platform.length > 0 &&
        typeof identity.arch === 'string' && identity.arch.length > 0 && absoluteExecutable &&
        /^[0-9a-f]{64}$/.test(identity.node_executable_sha256) &&
        Number.isInteger(identity.node_executable_size_bytes) && identity.node_executable_size_bytes > 0 &&
        (identity.intl_locale === null || typeof identity.intl_locale === 'string') &&
        (identity.intl_time_zone === null || typeof identity.intl_time_zone === 'string') &&
        Object.values(identity.environment_locale).every(value => value === null || typeof value === 'string') &&
        (identity.environment_time_zone === null || typeof identity.environment_time_zone === 'string') &&
        identity.dependency_lockfile.path === 'package-lock.json' &&
        identity.dependency_lockfile.sha256 === dependencyLockfileSha256,
    `${label} is incomplete or inconsistent`);
    return runtimeIdentitySha256(identity);
}

function validateExecutionRuntimeBoundary(bundle, candidateState) {
    const { root, listedPaths, manifest } = bundle;
    const runtime = manifest.execution_runtime;
    exactSet(Object.keys(runtime || {}), [
        'identity_kind', 'process_model', 'identity_sha256', 'initial_path', 'initial_sha256',
        'final_recheck_path', 'final_recheck_sha256', 'qshape_worker_execution',
        'dependency_lockfile'
    ], 'manifest execution-runtime fields');
    const initialFile = packageJson(
        root, listedPaths, 'metadata/runtime-initial.json', 'initial execution runtime'
    );
    const finalFile = packageJson(
        root, listedPaths, 'metadata/runtime-final-recheck.json', 'final execution-runtime recheck'
    );
    const initial = initialFile.value;
    const final = finalFile.value;
    exactSet(Object.keys(initial || {}), [
        'schema_version', 'identity_sha256', 'qshape_worker_execution', 'identity'
    ],
        'initial execution-runtime document fields');
    exactSet(Object.keys(final || {}), [
        'schema_version', 'status', 'identity_sha256', 'initial_identity_sha256',
        'qshape_worker_execution', 'identity'
    ], 'final execution-runtime document fields');
    const lockSha256 = candidateState.identity.dependency_lockfile.sha256;
    requireThat(initialFile.raw.equals(Buffer.from(
        `${JSON.stringify(canonicalJson(initial), null, 2)}\n`, 'utf8'
    )) && finalFile.raw.equals(Buffer.from(
        `${JSON.stringify(canonicalJson(final), null, 2)}\n`, 'utf8'
    )),
    'execution-runtime evidence bytes are not canonical');
    const recomputed = validateRuntimeIdentityDocument(initial.identity, lockSha256,
        'initial execution runtime identity');
    requireThat(initial.schema_version === 1 && initial.identity_sha256 === recomputed &&
        initial.qshape_worker_execution === 'in-process; no child Node process is used',
    'initial execution-runtime hash or process model mismatch');
    const finalRecomputed = validateRuntimeIdentityDocument(final.identity, lockSha256,
        'final execution runtime identity');
    requireThat(final.schema_version === 1 && final.status === 'unchanged' &&
        final.identity_sha256 === recomputed && final.initial_identity_sha256 === recomputed &&
        finalRecomputed === recomputed && jsonSemanticEqual(final.identity, initial.identity) &&
        final.qshape_worker_execution === initial.qshape_worker_execution,
    'final execution runtime differs from the initial runtime');
    requireThat(runtime.identity_kind === RUNTIME_IDENTITY_KIND &&
        runtime.process_model === QSHAPE_PROCESS_MODEL && runtime.identity_sha256 === recomputed &&
        runtime.initial_path === 'metadata/runtime-initial.json' &&
        runtime.initial_sha256 === sha256(initialFile.raw) &&
        runtime.final_recheck_path === 'metadata/runtime-final-recheck.json' &&
        runtime.final_recheck_sha256 === sha256(finalFile.raw) &&
        runtime.qshape_worker_execution === initial.qshape_worker_execution &&
        jsonSemanticEqual(runtime.dependency_lockfile, candidateState.identity.dependency_lockfile),
    'manifest execution runtime is not bound to the retained evidence');
    const runState = packageJson(root, listedPaths, 'run-state.json', 'sealed run state').value;
    requireThat(jsonSemanticEqual(runState.execution_runtime_identity, initial.identity) &&
        runState.execution_runtime_identity_sha256 === recomputed &&
        runState.stages?.runtime_preflight?.status === 'complete' &&
        runState.stages.runtime_preflight.identity_sha256 === recomputed &&
        runState.stages.runtime_preflight.process_model === QSHAPE_PROCESS_MODEL &&
        runState.stages.runtime_preflight.dependency_lockfile_sha256 === lockSha256 &&
        runState.stages?.final_runtime_recheck?.status === 'complete' &&
        runState.stages.final_runtime_recheck.identity_sha256 === recomputed &&
        runState.stages.final_runtime_recheck.process_model === QSHAPE_PROCESS_MODEL &&
        jsonSemanticEqual(manifest.stages?.runtime_preflight, runState.stages.runtime_preflight) &&
        jsonSemanticEqual(manifest.stages?.final_runtime_recheck, runState.stages.final_runtime_recheck),
    'run-state/manifest runtime checkpoints are inconsistent');
    return { identity: initial.identity, identitySha256: recomputed };
}

function validateManifestPackage(bundle) {
    const { manifest } = bundle;
    requireThat(manifest.schema_version === PACKAGE_SCHEMA_VERSION &&
        manifest.package_type === 'metamorphic-parity' && manifest.campaign_id === CAMPAIGN_ID,
    'metamorphic manifest identity mismatch');
    requireThat(manifest.sealed === true && manifest.package_status === 'complete' &&
        manifest.overall_validation_status === 'incomplete',
    'metamorphic manifest status mismatch');
    requireThat(manifest.manifest_checksum_file === 'manifest.sha256',
        'metamorphic manifest checksum binding mismatch');
    requireThat(manifest.counts && typeof manifest.counts === 'object',
        'metamorphic manifest counts are missing');
    exactSet(Object.keys(manifest.counts), Object.keys(EXPECTED_COUNTS), 'metamorphic manifest count fields');
    for (const [field, expected] of Object.entries(EXPECTED_COUNTS)) {
        requireThat(manifest.counts[field] === expected, `metamorphic manifest count mismatch for ${field}`);
    }
    requireThat(manifest.campaign_gate_status === 'pass' || manifest.campaign_gate_status === 'fail',
        'metamorphic manifest campaign status is invalid');
    exactSet(Object.keys(manifest.verification_contract || {}), [
        'verifier', 'expected_exit_code', 'expected_verified_counts', 'receipt_location'
    ], 'metamorphic manifest verification contract fields');
    requireThat(manifest.verification_contract?.verifier === 'verify-metamorphic-parity.cjs' &&
        manifest.verification_contract.expected_exit_code ===
            (manifest.campaign_gate_status === 'pass' ? 0 : 2) &&
        manifest.verification_contract.expected_verified_counts &&
        typeof manifest.verification_contract.expected_verified_counts === 'object' &&
        !Array.isArray(manifest.verification_contract.expected_verified_counts) &&
        manifest.verification_contract.receipt_location === 'sibling:<package>.verification.json',
    'metamorphic manifest verification contract mismatch');
    const candidate = validateCandidateSourceBoundary(bundle);
    const runtime = validateExecutionRuntimeBoundary(bundle, candidate);
    return { candidate, runtime };
}

function validateManifestVerifiedCounts(manifest, verifiedCounts) {
    const fields = [
        'references', 'cases', 'matched_target_evaluations_per_program',
        'shape_invocations', 'shape_rows_with_repetitions', 'qshape_rows_total',
        'malformed_controls', 'campaign_failures'
    ];
    const expected = manifest.verification_contract?.expected_verified_counts;
    exactSet(Object.keys(expected || {}), fields,
        'metamorphic manifest expected verified-count fields');
    exactSet(Object.keys(verifiedCounts || {}), fields,
        'independently reconstructed verified-count fields');
    requireThat(jsonEqual(expected, verifiedCounts),
        'metamorphic manifest expected verified counts do not match independent reconstruction');
}

function invocationParts(id) {
    const match = /^s(\d{2})-c(\d{2})-b(\d{2})-r([12])$/.exec(id);
    requireThat(match, `invalid SHAPE invocation ID ${id}`);
    return { slot: Number(match[1]), cn: Number(match[2]), batch: Number(match[3]), repetition: Number(match[4]) };
}

function rowIdentity(row, label) {
    const caseId = fieldOf(row, 'caseId', 'case_id');
    const targetCode = fieldOf(row, 'targetCode', 'target_code');
    requireThat(typeof caseId === 'string' && typeof targetCode === 'string',
        `${label} row identity is incomplete`);
    return { caseId, targetCode };
}

function parseShapeRawOut(text, label) {
    const records = new Map();
    let current = null;
    for (const [lineNumber, line] of text.split(/\r?\n/).entries()) {
        const structure = /^\s*Structure\s+\d+\s+\[([^\]]+)\]\s*$/.exec(line);
        if (structure) {
            const id = structure[1].trim();
            requireThat(!records.has(id), `${label} duplicate structure ${id}`);
            current = { caseId: id, values: new Map() };
            records.set(id, current);
            continue;
        }
        if (!current) continue;
        const value = /^\s*(\S+-\d+)\s+Ideal structure\s+CShM\s*=\s*(\S+)\s*$/.exec(line);
        if (value) {
            requireThat(!current.values.has(value[1]), `${label} duplicate target at line ${lineNumber + 1}`);
            requireThat(/^\d+\.\d{5}$/.test(value[2]), `${label} noncanonical .out value`);
            current.values.set(value[1], value[2]);
        }
    }
    requireThat(records.size > 0, `${label} contains no structures`);
    return records;
}

function parseShapeRawTab(text, label) {
    const targetHeader = text.split(/\r?\n/).find(line => /Structure\s+\[[^\]]+\]/.test(line));
    requireThat(targetHeader, `${label} lacks target header`);
    const afterBracket = targetHeader.slice(targetHeader.indexOf(']') + 1);
    const targets = [...afterBracket.matchAll(/([^\s,]+-\d+)/g)].map(match => match[1]);
    requireThat(targets.length > 0, `${label} contains no target columns`);
    const records = new Map();
    for (const line of text.split(/\r?\n/)) {
        const match = /^ (.{1,15}),(.*)$/.exec(line);
        if (!match) continue;
        const id = match[1].trim();
        const values = match[2].split(',').map(value => value.trim());
        requireThat(values.length === targets.length, `${label} row width mismatch for ${id}`);
        requireThat(!records.has(id), `${label} duplicate structure ${id}`);
        values.forEach(value => requireThat(/^\d+\.\d{3}$/.test(value), `${label} noncanonical .tab value`));
        records.set(id, new Map(targets.map((target, index) => [target, values[index]])));
    }
    requireThat(records.size > 0, `${label} contains no structure rows`);
    return { targets, records };
}

function validateShapeDat(text, invocation, caseMap, label) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.length > 0);
    requireThat(lines.some(line => line.trim() === '%fullout'), `${label} lacks %fullout`);
    requireThat(lines.some(line => line.trim() === `${invocation.cn} 1`),
        `${label} lacks center/CN control`);
    for (const caseId of invocation.caseIds) {
        const item = caseMap.get(caseId);
        requireThat(item, `${label} references unknown case ${caseId}`);
        const index = lines.findIndex(line => line.trim() === item.structure_id || line.trim() === caseId);
        requireThat(index >= 0, `${label} lacks structure ${caseId}`);
        const atomLines = lines.slice(index + 1, index + 2 + invocation.cn);
        requireThat(atomLines.length === invocation.cn + 1,
            `${label} structure ${caseId} atom census mismatch`);
        (item.shape_atoms || []).forEach((atom, atomIndex) => {
            const tokens = atom.tokens.join(' ');
            requireThat(atomLines[atomIndex].trim().split(/\s+/).join(' ') ===
                `${atom.element} ${tokens}`, `${label} structure ${caseId} atom evidence mismatch`);
        });
    }
}

function qualificationIdentityForVerification(document) {
    return {
        shape_version: document.shape_version,
        executable_sha256: document.executable_sha256,
        expected_executable_sha256: document.expected_executable_sha256,
        wsl_registered_distro_name: document.wsl_registered_distro_name || document.wsl_distro,
        reference_listing_sha256: sha256(Buffer.from(document.environment.reference_listing, 'utf8')),
        guest_os_pretty_name: document.environment.guest_os_pretty_name
    };
}

function validateShapeQualificationDocument(document, label) {
    requireThat(document && document.status === 'qualified' && document.shape_version === '2.1' &&
        document.shape_banner === 'SHAPE v2.1', `${label} SHAPE identity mismatch`);
    requireThat(document.executable_sha256 === EXPECTED_SHAPE_HASH &&
        document.expected_executable_sha256 === EXPECTED_SHAPE_HASH,
    `${label} executable SHA-256 mismatch`);
    requireThat(typeof document.shape_executable === 'string' &&
        document.shape_executable.startsWith('/') &&
        typeof (document.wsl_registered_distro_name || document.wsl_distro) === 'string',
    `${label} executable/WSL identity is incomplete`);
    const environment = document.environment;
    requireThat(environment && typeof environment.reference_listing === 'string' &&
        environment.reference_listing.length > 0 &&
        typeof environment.guest_os_pretty_name === 'string' &&
        environment.guest_os_pretty_name.length > 0 &&
        environment.process_locale === 'C' && environment.process_timezone === 'UTC',
    `${label} environment evidence is incomplete`);
    const requiredCommands = [
        'shape-sha256', 'shape-help', 'shape-list-all', 'shape-file',
        'shape-ldd', 'uname', 'os-release', 'locale'
    ];
    exactSet(Object.keys(document.commands || {}), requiredCommands, `${label} command evidence`);
    for (const commandName of requiredCommands) {
        const command = document.commands[commandName];
        requireThat(command && command.label === commandName &&
            typeof command.command === 'string' && command.command.length > 0 &&
            typeof command.stdout === 'string' && typeof command.stderr === 'string' &&
            Number.isInteger(command.exit_code), `${label}/${commandName} command record mismatch`);
        if (commandName !== 'shape-ldd') requireThat(command.exit_code === 0,
            `${label}/${commandName} did not exit successfully`);
    }
    requireThat(document.commands['shape-sha256'].stdout.toLowerCase().includes(EXPECTED_SHAPE_HASH),
        `${label} hash command does not retain the certified digest`);
    requireThat(/S\s*H\s*A\s*P\s*E\s+v?2\.1/i.test(
        `${document.commands['shape-help'].stdout}${document.commands['shape-help'].stderr}`
    ), `${label} help command does not retain the SHAPE v2.1 banner`);
    requireThat(environment.reference_listing === document.commands['shape-list-all'].stdout,
        `${label} reference listing/command mismatch`);
    return qualificationIdentityForVerification(document);
}

function validateShapeQualifications(root, listedPaths) {
    const initial = packageJson(
        root, listedPaths, 'shape/qualification.json', 'initial SHAPE qualification'
    ).value;
    const final = packageJson(
        root, listedPaths, 'shape/qualification-final.json', 'final SHAPE qualification'
    ).value;
    const initialIdentity = validateShapeQualificationDocument(initial, 'initial SHAPE qualification');
    const finalIdentity = validateShapeQualificationDocument(final, 'final SHAPE qualification');
    requireThat(jsonEqual(initialIdentity, finalIdentity),
        'SHAPE executable or environment identity changed during the campaign');
    return { initial, final, identity: initialIdentity };
}

function validatePriorShapeAttemptCheckpoint(root, listedPaths, invocationId, attemptName,
    attemptNumber, checkpoint) {
    requireThat(checkpoint?.schema_version === 1 &&
        checkpoint.invocation_id === invocationId &&
        checkpoint.attempt_number === attemptNumber,
    `${invocationId}/${attemptName} prior checkpoint identity mismatch`);
    if (checkpoint.status === 'failed') {
        exactSet(Object.keys(checkpoint), [
            'schema_version', 'status', 'invocation_id', 'attempt_number', 'error'
        ], `${invocationId}/${attemptName} failed checkpoint fields`);
        exactSet(Object.keys(checkpoint.error || {}), ['name', 'message', 'code'],
            `${invocationId}/${attemptName} failed error fields`);
        requireThat(typeof checkpoint.error.name === 'string' && checkpoint.error.name.length > 0 &&
            typeof checkpoint.error.message === 'string' && checkpoint.error.message.length > 0 &&
            (checkpoint.error.code === null || typeof checkpoint.error.code === 'string'),
        `${invocationId}/${attemptName} failed error evidence mismatch`);
        return;
    }
    requireThat(checkpoint.status === 'abandoned',
        `${invocationId}/${attemptName} prior checkpoint is neither failed nor abandoned`);
    exactSet(Object.keys(checkpoint), [
        'schema_version', 'status', 'invocation_id', 'attempt_number', 'reason',
        'evidence', 'retained_files'
    ], `${invocationId}/${attemptName} abandoned checkpoint fields`);
    requireThat(checkpoint.reason === 'interrupted_before_checkpoint' &&
        checkpoint.evidence === 'retained partial evidence; never used as a completed result' &&
        Array.isArray(checkpoint.retained_files),
    `${invocationId}/${attemptName} abandoned checkpoint contract mismatch`);
    const attemptToken = path.posix.join('shape/attempts', invocationId, attemptName);
    const attemptPath = path.join(root, ...attemptToken.split('/'));
    const actualFiles = walk(attemptPath).map(filePath =>
        path.relative(attemptPath, filePath).split(path.sep).join('/')
    ).filter(relative => relative !== 'checkpoint.json').sort((left, right) =>
        left.localeCompare(right)
    );
    const retainedPaths = checkpoint.retained_files.map(entry => entry?.path);
    requireThat(jsonEqual(retainedPaths, [...retainedPaths].sort((left, right) =>
        String(left).localeCompare(String(right)))) &&
        jsonEqual(retainedPaths, actualFiles),
    `${invocationId}/${attemptName} abandoned file inventory mismatch`);
    for (const [index, entry] of checkpoint.retained_files.entries()) {
        exactSet(Object.keys(entry || {}), ['path', 'size_bytes', 'sha256'],
            `${invocationId}/${attemptName} retained file ${index + 1} fields`);
        const relative = normalizeManifestPath(entry.path);
        requireThat(relative !== 'checkpoint.json' && !relative.startsWith('../') &&
            Number.isInteger(entry.size_bytes) && entry.size_bytes >= 0 &&
            /^[0-9a-f]{64}$/.test(entry.sha256),
        `${invocationId}/${attemptName} retained file ${index + 1} identity mismatch`);
        const token = path.posix.join(attemptToken, relative);
        const filePath = resolveListedFile(root, listedPaths, token,
            `${invocationId}/${attemptName} abandoned retained file`);
        const bytes = fs.readFileSync(filePath);
        requireThat(bytes.length === entry.size_bytes && sha256(bytes) === entry.sha256,
            `${invocationId}/${attemptName} abandoned retained file bytes mismatch ${relative}`);
    }
}

function validateShapeEvidence(root, listedPaths, casesState, references, manifest) {
    validateShapeQualifications(root, listedPaths);
    const attemptsRoot = path.join(root, 'shape', 'attempts');
    requireThat(fs.existsSync(attemptsRoot) && fs.statSync(attemptsRoot).isDirectory(),
        'SHAPE attempts directory is missing');
    const invocationDirs = fs.readdirSync(attemptsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    requireThat(invocationDirs.length === SHAPE_INVOCATION_COUNT,
        'SHAPE invocation census mismatch');
    const caseMap = casesState.caseMap;
    const rowsByRep = { shape_r1: [], shape_r2: [] };
    const seenInvocations = new Set();
    const baseInvocations = new Set();
    for (const id of invocationDirs) {
        const parts = invocationParts(id);
        requireThat(parts.slot >= 1 && parts.slot <= 33 && parts.cn >= 2 && parts.cn <= 12 &&
            parts.batch >= 1 && parts.repetition >= 1 && parts.repetition <= 2,
        `SHAPE invocation coordinates are invalid for ${id}`);
        const invocationRoot = path.join(attemptsRoot, id);
        const attempts = fs.readdirSync(invocationRoot, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name);
        requireThat(attempts.length > 0, `${id} has no immutable attempts`);
        const attemptNumbers = attempts.map(name => {
            const match = /^attempt-(\d{2,})$/.exec(name);
            requireThat(match, `${id} has an invalid attempt directory ${name}`);
            return Number(match[1]);
        }).sort((left, right) => left - right);
        requireThat(attemptNumbers.every((number, index) => number === index + 1),
            `${id} immutable attempts are not contiguous`);
        const finalAttemptName = `attempt-${String(attemptNumbers.at(-1)).padStart(2, '0')}`;
        const attemptPath = path.join(invocationRoot, finalAttemptName);
        const required = [
            'control.json', 'control.dat', 'control.out', 'control.tab',
            'result.out', 'result.tab', 'stdout.txt',
            'stderr.txt', 'exit-code.txt', 'rows.json', 'result.json', 'checkpoint.json'
        ];
        for (const name of required) resolveListedFile(
            root, listedPaths, path.posix.join('shape/attempts', id, finalAttemptName, name),
            `${id}/${name}`
        );
        const control = packageJson(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'control.json'), `${id} control`).value;
        const rows = packageJson(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'rows.json'), `${id} rows`).value;
        const checkpoint = packageJson(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'checkpoint.json'), `${id} checkpoint`).value;
        const result = packageJson(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'result.json'), `${id} result`).value;
        exactSet(Object.keys(checkpoint), [
            'schema_version', 'status', 'invocation_id', 'attempt_number',
            'expected_row_count', 'completed_row_count', 'evidence'
        ], `${id} complete checkpoint fields`);
        requireThat(checkpoint.schema_version === 1 && checkpoint.status === 'complete' &&
            (checkpoint.invocation_id === id || checkpoint.invocationId === id) &&
            (checkpoint.attempt_number ?? checkpoint.attempt) === attemptNumbers.at(-1) &&
            checkpoint.expected_row_count === checkpoint.completed_row_count &&
            checkpoint.evidence === 'retained in this immutable attempt directory',
        `${id} checkpoint is not a complete immutable checkpoint`);
        requireThat(Number(fs.readFileSync(path.join(attemptPath, 'exit-code.txt'), 'utf8').trim()) === 0,
            `${id} SHAPE exit code is not zero`);
        requireThat(result && Number(result.exitCode ?? result.exit_code ?? 0) === 0,
            `${id} result exit code is not zero`);
        for (const attemptNumber of attemptNumbers.slice(0, -1)) {
            const priorName = `attempt-${String(attemptNumber).padStart(2, '0')}`;
            const priorCheckpoint = packageJson(root, listedPaths,
                path.posix.join('shape/attempts', id, priorName, 'checkpoint.json'),
                `${id}/${priorName} checkpoint`).value;
            validatePriorShapeAttemptCheckpoint(
                root, listedPaths, id, priorName, attemptNumber, priorCheckpoint
            );
        }
        const controlCases = fieldOf(control, 'cases', 'case_ids', 'caseIds');
        const targetCodes = fieldOf(control, 'target_codes', 'targetCodes') || [];
        requireThat(Array.isArray(controlCases) && controlCases.length > 0 &&
            Array.isArray(targetCodes) && targetCodes.length > 0 && targetCodes.length <= 12,
        `${id} control census is incomplete`);
        controlCases.forEach(caseId => requireThat(caseMap.has(caseId), `${id} unknown control case ${caseId}`));
        const targetQCodes = targetCodes.map(code => {
            const target = references.find(reference => reference.cn === parts.cn &&
                (reference.shapeCode === code || reference.code === code));
            requireThat(target, `${id} unknown SHAPE target code ${code}`);
            return target.code;
        });
        if (Array.isArray(control.target_qshape_codes)) requireThat(
            jsonEqual(control.target_qshape_codes, targetQCodes),
            `${id} control Q-Shape target order mismatch`
        );
        if (control.center_position_one_based !== undefined) requireThat(
            control.center_position_one_based === true,
            `${id} control center-position contract mismatch`
        );
        const expectedStructureIds = controlCases.map(caseId => caseMap.get(caseId).structure_id);
        const baseId = id.replace(/-r[12]$/, '');
        requireThat(!seenInvocations.has(id), `duplicate SHAPE invocation ${id}`);
        seenInvocations.add(id); baseInvocations.add(baseId);
        requireThat(Array.isArray(rows), `${id} rows are not an array`);
        requireThat(rows.length === controlCases.length * targetCodes.length,
            `${id} SHAPE row count mismatch`);
        requireThat(checkpoint.expected_row_count === rows.length,
            `${id} checkpoint row count mismatch`);
        if (Array.isArray(result.rows)) requireThat(jsonEqual(result.rows, rows),
            `${id} result/rows mismatch`);
        requireThat(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'stdout.txt'), `${id} stdout`) ===
            String(result.stdout ?? ''), `${id} stdout/result mismatch`);
        requireThat(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'stderr.txt'), `${id} stderr`) ===
            String(result.stderr ?? ''), `${id} stderr/result mismatch`);
        const local = new Set();
        for (const row of rows) {
            const { caseId, targetCode } = rowIdentity(row, `${id} SHAPE`);
            requireThat(controlCases.includes(caseId) && targetQCodes.includes(targetCode),
                `${id} SHAPE row is outside its control`);
            const key = pairKeyOf(caseId, targetCode);
            requireThat(!local.has(key), `${id} duplicate SHAPE row ${key}`);
            local.add(key);
            const token = fieldOf(row, 'valueToken', 'value_token');
            const target = references.find(reference => reference.cn === parts.cn &&
                reference.code === targetCode);
            const expectedRawPath = path.posix.join(
                'shape/attempts', id, finalAttemptName, 'result.out'
            );
            const expectedTabRawPath = path.posix.join(
                'shape/attempts', id, finalAttemptName, 'result.tab'
            );
            requireThat(shapeValueFromRow(row) !== null &&
                fieldOf(row, 'lexicallyValid', 'lexically_valid') === true &&
                fieldOf(row, 'invocationId', 'invocation_id') === id &&
                Number(row.repetition) === parts.repetition &&
                fieldOf(row, 'structureId', 'structure_id') === caseMap.get(caseId).structure_id &&
                target && fieldOf(row, 'shapeCode', 'shape_code') === target.shapeCode &&
                Number(fieldOf(row, 'targetIndex', 'target_index')) === target.index &&
                fieldOf(row, 'rawPath', 'raw_path') === expectedRawPath &&
                /^\d+\.\d{3}$/.test(fieldOf(row, 'tabValueToken', 'tab_value_token')) &&
                fieldOf(row, 'tabRawPath', 'tab_raw_path') === expectedTabRawPath,
                `${id} SHAPE value token is invalid`);
            rowsByRep[`shape_r${parts.repetition}`].push(row);
        }
        validateShapeDat(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'control.dat'), `${id} .dat`),
        { ...parts, caseIds: controlCases }, caseMap, `${id} .dat`);
        const outRecords = parseShapeRawOut(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'result.out'), `${id} .out`), `${id} .out`);
        const tabRecords = parseShapeRawTab(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'result.tab'), `${id} .tab`), `${id} .tab`);
        requireThat(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'control.out'), `${id} native .out`) ===
            packageText(root, listedPaths,
                path.posix.join('shape/attempts', id, finalAttemptName, 'result.out'), `${id} retained .out`),
        `${id} native/retained .out mismatch`);
        requireThat(packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'control.tab'), `${id} native .tab`) ===
            packageText(root, listedPaths,
                path.posix.join('shape/attempts', id, finalAttemptName, 'result.tab'), `${id} retained .tab`),
        `${id} native/retained .tab mismatch`);
        if (result.out !== undefined) requireThat(result.out === packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'result.out'), `${id} .out result binding`),
        `${id} result/.out mismatch`);
        if (result.tab !== undefined) requireThat(result.tab === packageText(root, listedPaths,
            path.posix.join('shape/attempts', id, finalAttemptName, 'result.tab'), `${id} .tab result binding`),
        `${id} result/.tab mismatch`);
        requireThat(jsonEqual([...outRecords.keys()], expectedStructureIds),
            `${id} .out structure order mismatch`);
        requireThat(jsonEqual([...tabRecords.records.keys()], expectedStructureIds),
            `${id} .tab structure order mismatch`);
        requireThat(jsonEqual(tabRecords.targets, targetCodes), `${id} .tab target order mismatch`);
        for (const row of rows) {
            const caseId = fieldOf(row, 'caseId', 'case_id');
            const targetCode = fieldOf(row, 'targetCode', 'target_code');
            const shapeToken = fieldOf(row, 'valueToken', 'value_token');
            const structureId = caseMap.get(caseId).structure_id;
            const out = outRecords.get(structureId);
            const target = references.find(reference => reference.cn === parts.cn && reference.code === targetCode);
            requireThat(out && target && out.values.get(target.shapeCode) === shapeToken,
                `${id} .out/rows mismatch for ${caseId}/${targetCode}`);
            const tab = tabRecords.records.get(structureId);
            requireThat(tab && target && tab.has(target.shapeCode), `${id} .tab missing ${caseId}/${targetCode}`);
            requireThat(tab.get(target.shapeCode) ===
                fieldOf(row, 'tabValueToken', 'tab_value_token'),
            `${id} .tab/rows mismatch for ${caseId}/${targetCode}`);
        }
    }
    requireThat(baseInvocations.size === EXPECTED_COUNTS.baseInvocationCount,
        'SHAPE base invocation census mismatch');
    for (const rep of ['shape_r1', 'shape_r2']) {
        requireThat(rowsByRep[rep].length === MATCHED_PAIR_COUNT, `${rep} SHAPE row census mismatch`);
    }
    return rowsByRep;
}

function qInputFingerprint(caseItem, target, seedPolicy, explicitSeed) {
    const contract = {
        schema_version: 1,
        case_id: caseItem.case_id,
        cn: caseItem.cn,
        qshape_ligand_fixed15_tokens: caseItem.qshape_actual_ligand_tokens,
        target_code: target.code,
        target_reference_binary64_roundtrip_tokens: target.coordinateRoundtripTokens,
        target_reference_float64_hex: target.coordinateBits,
        mode: 'default',
        seed_policy: seedPolicy,
        explicit_seed_uint32: explicitSeed
    };
    return sha256(Buffer.from(JSON.stringify(contract), 'utf8'));
}

function validateQPayload(payload, stream, casesSha256, referencesSha256, runtimeState = null) {
    const explicit = stream.startsWith('q_explicit_seed_');
    const expectedSeed = explicit ? Number(stream.slice('q_explicit_seed_'.length)) : null;
    requireThat(payload?.schema_version === 1 && payload.program === 'Q-Shape' &&
        payload.campaign_id === CAMPAIGN_ID && payload.cases_sha256 === casesSha256 &&
        payload.references_sha256 === referencesSha256 && payload.mode === 'default' &&
        payload.input_contract === 'frozen-metamorphic-cases-and-reference-binary64-v1' &&
        payload.stream === stream && payload.seed_policy === (explicit ? 'explicit' : 'input-derived') &&
        payload.explicit_seed_uint32 === expectedSeed && payload.repetition === (explicit ? 1 : Number(stream.slice(-1))) &&
        payload.shard_index === 0 && payload.shard_count === 1 && payload.case_count === CASE_COUNT &&
        payload.count === MATCHED_PAIR_COUNT && payload.expected_count === MATCHED_PAIR_COUNT &&
        Array.isArray(payload.results),
    `${stream} payload identity mismatch`);
    if (runtimeState) {
        requireThat(payload.execution_process === QSHAPE_PROCESS_MODEL &&
            payload.runtime_identity_sha256 === runtimeState.identitySha256 &&
            jsonSemanticEqual(payload.runtime_identity, runtimeState.identity),
        `${stream} payload runtime is not bound to the in-process runner`);
    }
}

function validateQShapeEvidence(root, listedPaths, casesState, references, shapeRows, runtimeState = null) {
    const refsByCode = new Map(references.map(reference => [reference.code, reference]));
    const expectedPairOrder = [...casesState.pairs.keys()];
    const qRows = {};
    const pairRows = new Map();
    for (const stream of Q_STREAMS) {
        const streamDir = path.posix.join('qshape', stream);
        const payloadFile = packageJson(root, listedPaths, `${streamDir}/payload.json`, `${stream} payload`);
        const rowsFile = packageJson(root, listedPaths, `${streamDir}/rows.json`, `${stream} rows`);
        resolveListedFile(root, listedPaths, `${streamDir}/stdout.txt`, `${stream} stdout`);
        resolveListedFile(root, listedPaths, `${streamDir}/stderr.txt`, `${stream} stderr`);
        resolveListedFile(root, listedPaths, `${streamDir}/exit-code.txt`, `${stream} exit code`);
        const rawResult = packageJson(root, listedPaths, `${streamDir}/raw-result.json`, `${stream} raw result`).value;
        const casesSha = sha256(packageJson(root, listedPaths, 'inputs/frozen/cases.json', 'frozen cases').raw);
        const refsSha = sha256(packageJson(root, listedPaths, 'inputs/frozen/references.json', 'frozen references').raw);
        validateQPayload(payloadFile.value, stream, casesSha, refsSha, runtimeState);
        requireThat(JSON.stringify(payloadFile.value.results) === JSON.stringify(rowsFile.value),
            `${stream} payload/rows mismatch`);
        const resultRows = fieldOf(rawResult, 'results', 'rows') ||
            fieldOf(rawResult?.payload, 'results', 'rows');
        if (Array.isArray(resultRows)) requireThat(JSON.stringify(resultRows) === JSON.stringify(rowsFile.value),
            `${stream} raw-result/rows mismatch`);
        requireThat(Number(fs.readFileSync(path.join(root, streamDir, 'exit-code.txt'), 'utf8').trim()) === 0,
            `${stream} Q-Shape exit code is not zero`);
        const rows = rowsFile.value;
        requireThat(Array.isArray(rows) && rows.length === MATCHED_PAIR_COUNT,
            `${stream} Q-Shape row census mismatch`);
        const seen = new Set();
        for (const [rowIndex, row] of rows.entries()) {
            const { caseId, targetCode } = rowIdentity(row, stream);
            const expected = casesState.pairs.get(pairKeyOf(caseId, targetCode));
            requireThat(expected, `${stream} unknown case/target row ${caseId}/${targetCode}`);
            const key = pairKeyOf(caseId, targetCode);
            requireThat(!seen.has(key), `${stream} duplicate case/target row ${key}`);
            requireThat(key === expectedPairOrder[rowIndex],
                `${stream} Q-Shape row order changed at row ${rowIndex + 1}`);
            seen.add(key);
            const item = expected.caseItem;
            const target = expected.target;
            const explicit = stream.startsWith('q_explicit_seed_');
            const seed = explicit ? Number(stream.slice('q_explicit_seed_'.length)) : null;
            requireThat(row.caseOrdinal === casesState.caseOrdinalById.get(caseId) &&
                row.cn === item.cn && row.stratum === item.stratum && row.targetOrdinal === target.index &&
                jsonEqual(row.qshapeLigandFixed15Tokens, item.qshape_actual_ligand_tokens) &&
                jsonEqual(row.targetReferenceBinary64RoundtripTokens, target.coordinateRoundtripTokens) &&
                jsonEqual(row.targetReferenceFloat64Hex, target.coordinateBits),
            `${stream} frozen row identity mismatch for ${key}`);
            const valueToken = fieldOf(row, 'valueToken', 'value_token');
            const bits = fieldOf(row, 'valueHex', 'value_hex', 'float64Hex', 'float64_hex');
            const expectedBits = qTokenBits(valueToken);
            requireThat(expectedBits !== null && bits === expectedBits,
                `${stream} canonical binary64 bits mismatch for ${key}`);
            requireThat(row.resultFinite === Number.isFinite(Number(valueToken)) &&
                row.resultDomainValid === (row.resultFinite && Number(valueToken) >= 0 && Number(valueToken) <= 100),
            `${stream} result-domain identity mismatch for ${key}`);
            const runtime = fieldOf(row, 'runtimeMsToken', 'runtime_ms_token', 'runtime_ms');
            requireThat(typeof runtime === 'string' && /^\d+\.\d{6}$/.test(runtime) && Number.isFinite(Number(runtime)),
                `${stream} runtime identity mismatch for ${key}`);
            requireThat(row.inputFingerprintSha256 === qInputFingerprint(item, target,
                explicit ? 'explicit' : 'input-derived', seed) && row.mode === 'default' &&
                row.seedPolicy === (explicit ? 'explicit' : 'input-derived') &&
                row.explicitSeed === seed && row.repetition === (explicit ? 1 : Number(stream.slice(-1))) &&
                row.stream === stream,
            `${stream} seed/runtime identity mismatch for ${key}`);
            pairRows.set(`${stream}\u0000${key}`, row);
        }
        exactSet([...seen], [...casesState.pairs.keys()], `${stream} Q-Shape pair set`);
        qRows[stream] = rows;
    }
    return { qRows, pairRows };
}

function decimalDifference(left, right) {
    return absoluteDecimal(subtractDecimals(left, right));
}

function decimalLess(left, right) { return compareDecimals(left, right) < 0; }
function decimalLessEqual(left, right) { return compareDecimals(left, right) <= 0; }

function finalizeIndependentFailureObjects(rawFailures) {
    const failures = rawFailures.map(failure => ({ ...failure, failure_id: '' })).sort((left, right) =>
        left.stream.localeCompare(right.stream) ||
        left.repetition.localeCompare(right.repetition) ||
        left.case_id.localeCompare(right.case_id) ||
        left.gate.localeCompare(right.gate) ||
        left.target_code.localeCompare(right.target_code) ||
        left.comparison_code.localeCompare(right.comparison_code) ||
        String(left.observed).localeCompare(String(right.observed)) ||
        left.details.localeCompare(right.details)
    );
    const counts = new Map();
    for (const failure of failures) {
        const digest = sha256(Buffer.from(analyzerStableJson({
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
        }), 'utf8')).slice(0, 16);
        const base = `failure-${digest}`;
        const occurrence = counts.get(base) || 0;
        failure.failure_id = occurrence === 0 ? base : `${base}-${occurrence + 1}`;
        counts.set(base, occurrence + 1);
    }
    return failures;
}

function independentFailureCollector() {
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
    const finalize = () => finalizeIndependentFailureObjects(raw);
    return { addFailure, finalize, raw };
}

const SCIENTIFIC_REPRESENTATION_RECIPES = Object.freeze([
    'rotation-a',
    'scale-small',
    'permutation',
    'rotation-scale',
    'rotation-permutation',
    'rotation-scale-permutation'
]);

function scientificRecipeId(item) {
    return fieldOf(item, 'recipeId', 'recipe_id') || '';
}

function scientificRecipeCategory(item) {
    return fieldOf(item, 'recipeCategory', 'recipe_category', 'category') || '';
}

function isScientificRepresentationCase(item) {
    const recipe = scientificRecipeId(item);
    return recipe === 'canonical' || SCIENTIFIC_REPRESENTATION_RECIPES.includes(recipe) ||
        scientificRecipeCategory(item) === 'representation';
}

function scientificRelationDescriptor(item, caseMap) {
    const recipe = scientificRecipeId(item);
    let authorized = false;
    let expectedParent = null;
    if (SCIENTIFIC_REPRESENTATION_RECIPES.includes(recipe)) {
        authorized = true;
        expectedParent = [...caseMap.values()].find(candidate =>
            candidate.cn === item.cn &&
            fieldOf(candidate, 'parentReferenceCode', 'parent_reference_code') ===
                fieldOf(item, 'parentReferenceCode', 'parent_reference_code') &&
            scientificRecipeId(candidate) === 'canonical'
        );
    } else if (recipe === 'distorted-twin') {
        authorized = true;
        expectedParent = [...caseMap.values()].find(candidate =>
            candidate.cn === item.cn &&
            fieldOf(candidate, 'parentReferenceCode', 'parent_reference_code') ===
                fieldOf(item, 'parentReferenceCode', 'parent_reference_code') &&
            scientificRecipeId(candidate) === 'mixed-plus-0.05'
        );
    }
    if (!authorized) return { authorized: false, expectedParent: null };
    const declaredParentId = fieldOf(item, 'parentCaseId', 'parent_case_id');
    const parent = declaredParentId ? caseMap.get(declaredParentId) : expectedParent;
    return {
        authorized: true,
        expectedParent,
        parent,
        declaredParentId,
        parentId: parent ? fieldOf(parent, 'caseId', 'case_id') : ''
    };
}

function independentGammaAwareKendall(entries) {
    let concordant = 0;
    let discordant = 0;
    let shapeOnlyTies = 0;
    let qshapeOnlyTies = 0;
    let jointTies = 0;
    for (let left = 0; left < entries.length; left++) {
        for (let right = left + 1; right < entries.length; right++) {
            const shapeDelta = subtractDecimals(entries[left].shape, entries[right].shape);
            const qshapeDelta = subtractDecimals(entries[left].qshape, entries[right].qshape);
            const shapeTie = decimalLessEqual(
                absoluteDecimal(shapeDelta), parseDecimal('0.02001')
            );
            const qshapeTie = decimalLessEqual(
                absoluteDecimal(qshapeDelta), parseDecimal('0.02001')
            );
            if (shapeTie && qshapeTie) jointTies += 1;
            else if (shapeTie) shapeOnlyTies += 1;
            else if (qshapeTie) qshapeOnlyTies += 1;
            else if (compareDecimals(
                multiplyDecimals(shapeDelta, qshapeDelta), parseDecimal('0')
            ) > 0) concordant += 1;
            else discordant += 1;
        }
    }
    const denominatorSquared =
        (concordant + discordant + shapeOnlyTies) *
        (concordant + discordant + qshapeOnlyTies);
    const difference = concordant - discordant;
    let tau = null;
    if (denominatorSquared !== 0) {
        tau = sqrtRationalToSignificantHalfUp(
            BigInt(difference * difference), BigInt(denominatorSquared)
        );
        if (difference < 0 && tau !== '0') tau = `-${tau}`;
    }
    return {
        tau_b: tau,
        concordant,
        discordant,
        shape_only_ties: shapeOnlyTies,
        qshape_only_ties: qshapeOnlyTies,
        joint_ties: jointTies
    };
}

function analyzerErrorStatistics(signedErrors) {
    if (signedErrors.length === 0) return {
        count: 0,
        signed_bias: 'not_evaluable',
        mean_absolute_error: 'not_evaluable',
        root_mean_square_error: 'not_evaluable',
        median_absolute_error: 'not_evaluable',
        p95_absolute_error: 'not_evaluable',
        p99_absolute_error: 'not_evaluable',
        maximum_absolute_error: 'not_evaluable'
    };
    return exactDecimalErrorStatistics(signedErrors);
}

function analyzerRuntimeStatistics(runtimeValues) {
    if (runtimeValues.length === 0) return {
        count: 0,
        mean_ms: 'not_evaluable',
        median_ms: 'not_evaluable',
        p95_ms: 'not_evaluable',
        p99_ms: 'not_evaluable',
        maximum_ms: 'not_evaluable'
    };
    const distribution = exactDecimalDistribution(runtimeValues);
    return {
        count: distribution.count,
        mean_ms: distribution.mean,
        median_ms: distribution.median,
        p95_ms: distribution.p95,
        p99_ms: distribution.p99,
        maximum_ms: distribution.max
    };
}

function buildIndependentPairedSignRows(casesState, shapeConsensus, qMaps) {
    const descriptors = new Map();
    for (const item of casesState.caseMap.values()) {
        const match = /^(radial|angular|mixed)-(minus|plus)-(.+)$/.exec(
            scientificRecipeId(item)
        );
        if (!match) continue;
        const key = [
            item.cn,
            fieldOf(item, 'parentReferenceCode', 'parent_reference_code'),
            match[1],
            match[3]
        ].join('\u0000');
        if (!descriptors.has(key)) descriptors.set(key, {
            cn: item.cn,
            geometryFamily: fieldOf(item, 'parentReferenceCode', 'parent_reference_code'),
            distortionType: match[1],
            magnitude: match[3],
            minus: null,
            plus: null
        });
        descriptors.get(key)[match[2]] = item;
    }
    const rows = [];
    for (const descriptor of descriptors.values()) {
        const source = descriptor.minus || descriptor.plus;
        const targetCodes = source
            ? referencesForCase(casesState, source.cn).map(target => target.code) : [];
        for (const stream of Q_STREAMS) {
            for (const targetCode of targetCodes) {
                const minusId = descriptor.minus ? descriptor.minus.case_id : '';
                const plusId = descriptor.plus ? descriptor.plus.case_id : '';
                const minusShape = minusId
                    ? shapeConsensus.get(pairKeyOf(minusId, targetCode)) : null;
                const plusShape = plusId
                    ? shapeConsensus.get(pairKeyOf(plusId, targetCode)) : null;
                const minusQ = minusId
                    ? qMaps[stream].get(pairKeyOf(minusId, targetCode)) : null;
                const plusQ = plusId
                    ? qMaps[stream].get(pairKeyOf(plusId, targetCode)) : null;
                const minusQValue = minusQ ? qValueFromRow(minusQ) : null;
                const plusQValue = plusQ ? qValueFromRow(plusQ) : null;
                const evaluable = Boolean(
                    descriptor.minus && descriptor.plus &&
                    minusShape?.valid && plusShape?.valid &&
                    minusQValue && plusQValue &&
                    decimalLessEqual(parseDecimal('0'), minusQValue) &&
                    decimalLessEqual(minusQValue, parseDecimal('100')) &&
                    decimalLessEqual(parseDecimal('0'), plusQValue) &&
                    decimalLessEqual(plusQValue, parseDecimal('100'))
                );
                const deltaShape = evaluable
                    ? subtractDecimals(plusShape.value, minusShape.value) : null;
                const deltaQ = evaluable
                    ? subtractDecimals(plusQValue, minusQValue) : null;
                rows.push({
                    stream,
                    optimizer_seed_mode: stream.startsWith('q_explicit_')
                        ? 'explicit-seed' : 'input-derived',
                    optimizer_seed_uint32: stream.startsWith('q_explicit_')
                        ? Number(stream.slice('q_explicit_seed_'.length)) : null,
                    cn: descriptor.cn,
                    geometry_family: descriptor.geometryFamily,
                    target_code: targetCode,
                    distortion_type: descriptor.distortionType,
                    distortion_magnitude: descriptor.magnitude,
                    minus_case_id: minusId,
                    plus_case_id: plusId,
                    shape_minus_token: minusShape?.token || '',
                    shape_plus_token: plusShape?.token || '',
                    qshape_minus_token: minusQ
                        ? fieldOf(minusQ, 'valueToken', 'value_token') || '' : '',
                    qshape_plus_token: plusQ
                        ? fieldOf(plusQ, 'valueToken', 'value_token') || '' : '',
                    delta_shape: deltaShape ? decimalToSignificantHalfUp(deltaShape) : '',
                    delta_qshape: deltaQ ? decimalToSignificantHalfUp(deltaQ) : '',
                    delta_error: evaluable
                        ? decimalToSignificantHalfUp(subtractDecimals(deltaQ, deltaShape)) : '',
                    cshm_unit: 'dimensionless_CShM',
                    status: evaluable ? 'evaluable' : 'not_evaluable'
                });
            }
        }
    }
    return rows;
}

function buildIndependentStratifiedStatistics(comparisonRows) {
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
            for (const [level, rows] of [...groups.entries()].sort((left, right) =>
                String(left[0]).localeCompare(String(right[0]), 'en', { numeric: true })
            )) {
                const valid = rows.filter(row => row.result_domain_valid);
                const signedErrors = valid.map(row => parseDecimal(row.signed_error));
                const runtimes = rows.map(row => parseDecimal(row.qshape_runtime_ms));
                output.push({
                    stream,
                    optimizer_seed_mode: stream.startsWith('q_explicit_')
                        ? 'explicit-seed' : 'input-derived',
                    optimizer_seed_uint32: stream.startsWith('q_explicit_')
                        ? Number(stream.slice('q_explicit_seed_'.length)) : null,
                    dimension,
                    level,
                    comparisons_total: rows.length,
                    comparisons_domain_valid: valid.length,
                    cshm_unit: 'dimensionless_CShM',
                    runtime_unit: 'ms',
                    ...analyzerErrorStatistics(signedErrors),
                    runtime: analyzerRuntimeStatistics(runtimes)
                });
            }
        }
    }
    return output;
}

function caseStreamFailures(casesState, shapeRows, qRows) {
    const collector = independentFailureCollector();
    const addFailure = collector.addFailure;
    const shapeMap = new Map();
    for (const repetition of SHAPE_REPETITIONS) {
        for (const row of shapeRows[repetition]) {
            const { caseId, targetCode } = rowIdentity(row, repetition);
            shapeMap.set(`${repetition}\u0000${pairKeyOf(caseId, targetCode)}`, row);
        }
    }
    const shapeConsensus = new Map();
    for (const [key, expected] of casesState.pairs) {
        const r1 = shapeMap.get(`shape_r1\u0000${key}`);
        const r2 = shapeMap.get(`shape_r2\u0000${key}`);
        const t1 = r1 ? fieldOf(r1, 'valueToken', 'value_token') : '';
        const t2 = r2 ? fieldOf(r2, 'valueToken', 'value_token') : '';
        for (const [repetition, row, outToken] of [
            ['shape_r1', r1, t1],
            ['shape_r2', r2, t2]
        ]) {
            const tabToken = fieldOf(row, 'tabValueToken', 'tab_value_token');
            if (typeof tabToken !== 'string' || !/^\d+\.\d{3}$/.test(tabToken) ||
                !/^\d+\.\d{5}$/.test(outToken)) continue;
            const intervalDifference = absoluteDecimal(subtractDecimals(
                parseDecimal(outToken), parseDecimal(tabToken)
            ));
            if (decimalLess(parseDecimal('0.000505'), intervalDifference)) addFailure({
                gate: 'shape_out_tab_inconsistency',
                repetition,
                executionUnitId: `shape-tab:${repetition}:${key}`,
                caseId: expected.caseItem.case_id,
                cn: expected.caseItem.cn,
                targetCode: expected.target.code,
                observed: `.out=${outToken}; .tab=${tabToken}`,
                threshold: '|out-tab|<=0.000505 CShM (overlapping printed-value intervals)',
                details: `SHAPE ${repetition} parseable .out/.tab values are inconsistent`
            });
        }
        const exact = Boolean(r1 && r2 && t1 === t2);
        if (r1 && r2 && !exact) addFailure({
            gate: 'shape_repeatability_token',
            repetition: 'shape_r1|shape_r2',
            executionUnitId: `shape:${key}`,
            caseId: expected.caseItem.case_id,
            cn: expected.caseItem.cn,
            targetCode: expected.target.code,
            observed: `${t1}|${t2}`,
            threshold: 'identical five-decimal SHAPE token in both repetitions',
            details: 'SHAPE repetitions cannot form a consensus token'
        });
        const value = exact ? shapeValueFromRow(r1) : null;
        const valid = Boolean(value && decimalLessEqual(parseDecimal('0'), value) &&
            decimalLessEqual(value, parseDecimal('100')));
        if (exact && value && decimalLess(value, parseDecimal('0'))) addFailure({
            gate: 'shape_negative_cshm',
            repetition: 'shape_r1|shape_r2',
            executionUnitId: `shape:${key}`,
            caseId: expected.caseItem.case_id,
            cn: expected.caseItem.cn,
            targetCode: expected.target.code,
            observed: t1,
            threshold: '>=0 CShM',
            details: 'Consensus SHAPE value is negative'
        });
        if (exact && value && decimalLess(parseDecimal('100'), value)) addFailure({
            gate: 'shape_cshm_above_100',
            repetition: 'shape_r1|shape_r2',
            executionUnitId: `shape:${key}`,
            caseId: expected.caseItem.case_id,
            cn: expected.caseItem.cn,
            targetCode: expected.target.code,
            observed: t1,
            threshold: '<=100 CShM',
            details: 'Consensus SHAPE value exceeds the mathematical domain'
        });
        shapeConsensus.set(key, {
            token: exact ? t1 : '', value, valid, exact,
            rep1Token: t1, rep2Token: t2, r1, r2
        });
    }
    const comparisons = [];
    const caseSummaries = [];
    const qMaps = {};
    const caseSummariesByStream = {};
    for (const stream of Q_STREAMS) {
        const rows = qRows[stream];
        const map = new Map(rows.map(row => {
            const id = rowIdentity(row, stream);
            return [pairKeyOf(id.caseId, id.targetCode), row];
        }));
        qMaps[stream] = map;
        const perCase = [];
        for (const item of casesState.caseMap.values()) {
            const targets = referencesForCase(casesState, item.cn).map(target => target.code);
            const entries = [];
            const invalidTargets = [];
            for (const targetCode of targets) {
                const key = pairKeyOf(item.case_id, targetCode);
                const shape = shapeConsensus.get(key);
                const q = map.get(key);
                const qValue = qValueFromRow(q || {});
                const valid = Boolean(shape?.valid && qValue &&
                    decimalLessEqual(parseDecimal('0'), qValue) &&
                    decimalLessEqual(qValue, parseDecimal('100')));
                const signed = valid ? subtractDecimals(qValue, shape.value) : null;
                const absolute = signed ? absoluteDecimal(signed) : null;
                if (valid && !decimalLess(absolute, parseDecimal('0.01'))) addFailure({
                    gate: 'absolute_error',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}:${targetCode}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    targetCode,
                    observed: decimalToSignificantHalfUp(absolute),
                    threshold: '<0.01 CShM',
                    details: `Q-Shape ${fieldOf(q, 'valueToken', 'value_token')}; SHAPE ${shape.token}`
                });
                if (qValue && decimalLess(qValue, parseDecimal('0'))) addFailure({
                    gate: 'qshape_negative_cshm',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}:${targetCode}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    targetCode,
                    observed: fieldOf(q, 'valueToken', 'value_token'),
                    threshold: '>=0 CShM',
                    details: 'Q-Shape result is negative'
                });
                if (qValue && decimalLess(parseDecimal('100'), qValue)) addFailure({
                    gate: 'qshape_cshm_above_100',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}:${targetCode}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    targetCode,
                    observed: fieldOf(q, 'valueToken', 'value_token'),
                    threshold: '<=100 CShM',
                    details: 'Q-Shape result exceeds the mathematical domain'
                });
                const qToken = q ? fieldOf(q, 'valueToken', 'value_token') : '';
                if (['NaN', 'Infinity', '-Infinity'].includes(qToken)) addFailure({
                    gate: 'qshape_nonfinite_cshm',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}:${targetCode}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    targetCode,
                    observed: qToken,
                    threshold: 'finite CShM within [0, 100]',
                    details: 'Q-Shape result is non-finite'
                });
                const recipeId = scientificRecipeId(item);
                const distortion = /^(radial|angular|mixed)-(minus|plus)-(.+)$/.exec(recipeId);
                const precision = /^precision-(\d+)$/.exec(recipeId);
                comparisons.push({
                    stream,
                    case_id: item.case_id,
                    target_code: targetCode,
                    cn: item.cn,
                    stratum: item.stratum || '',
                    family: item.family || '',
                    geometry_family: fieldOf(item, 'parentReferenceCode', 'parent_reference_code') || '',
                    recipe_id: recipeId,
                    recipe_index: fieldOf(item, 'recipeIndex', 'recipe_index') ?? '',
                    recipe_category: scientificRecipeCategory(item),
                    distortion_type: distortion ? distortion[1] : 'not_applicable',
                    distortion_sign: distortion ? distortion[2] : 'not_applicable',
                    distortion_magnitude: distortion ? distortion[3] : 'not_applicable',
                    input_precision_digits: precision ? Number(precision[1]) : 'not_applicable',
                    optimizer_seed_mode: stream.startsWith('q_explicit_') ? 'explicit-seed' : 'input-derived',
                    optimizer_seed_uint32: stream.startsWith('q_explicit_')
                        ? Number(stream.slice('q_explicit_seed_'.length)) : null,
                    browser: 'not_applicable_node_worker',
                    execution_mode: q ? fieldOf(q, 'mode') || 'default' : 'default',
                    qshape_runtime_ms: q
                        ? fieldOf(q, 'runtimeMsToken', 'runtime_ms_token', 'runtime_ms') || '' : '',
                    shape_r1_token: shape?.rep1Token || '',
                    shape_r2_token: shape?.rep2Token || '',
                    shape_consensus_token: shape?.token || '',
                    qshape_token: q ? fieldOf(q, 'valueToken', 'value_token') : '',
                    qshape_float64_hex: q
                        ? fieldOf(q, 'valueHex', 'value_hex', 'float64Hex', 'float64_hex') : '',
                    signed_error: signed ? decimalToSignificantHalfUp(signed) : '',
                    absolute_error: absolute ? decimalToSignificantHalfUp(absolute) : '',
                    result_domain_valid: valid,
                    pass_abs_0_01: Boolean(valid && decimalLess(absolute, parseDecimal('0.01'))),
                    seed_policy: q ? fieldOf(q, 'seedPolicy', 'seed_policy') || '' : '',
                    explicit_seed_uint32: q
                        ? fieldOf(q, 'explicitSeed', 'explicit_seed_uint32', 'explicit_seed') ?? '' : ''
                });
                if (!valid) invalidTargets.push(targetCode);
                else entries.push({ targetCode, shape: shape.value, qshape: qValue });
            }
            if (invalidTargets.length > 0 || entries.length !== targets.length) {
                addFailure({
                    gate: 'ranking_not_evaluable',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    observed: invalidTargets.join('|') || 'structural_failure',
                    threshold: 'complete finite valid case/target set',
                    details: 'Ranking was not computed from a subset of valid targets'
                });
                const summary = {
                    case_id: item.case_id,
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
                perCase.push(summary);
                caseSummaries.push(summary);
                continue;
            }
            const shapeOrdered = [...entries].sort((left, right) =>
                compareDecimals(left.shape, right.shape) || left.targetCode.localeCompare(right.targetCode)
            );
            const qOrdered = [...entries].sort((left, right) =>
                compareDecimals(left.qshape, right.qshape) || left.targetCode.localeCompare(right.targetCode)
            );
            const shapeMinimum = shapeOrdered[0].shape;
            const qMinimum = qOrdered[0].qshape;
            const shapeTieSet = shapeOrdered.filter(entry => decimalLessEqual(
                subtractDecimals(entry.shape, shapeMinimum), parseDecimal('0.02001')
            )).map(entry => entry.targetCode);
            const qTieSet = qOrdered.filter(entry => decimalLessEqual(
                subtractDecimals(entry.qshape, qMinimum), parseDecimal('0.02001')
            )).map(entry => entry.targetCode);
            const shapeBest = shapeOrdered[0].targetCode;
            const qBest = qOrdered[0].targetCode;
            const kendall = independentGammaAwareKendall(entries);
            if (!shapeTieSet.includes(qBest)) addFailure({
                gate: 'best_geometry_outside_shape_tie_set',
                stream,
                executionUnitId: `${stream}:${item.case_id}`,
                caseId: item.case_id,
                cn: item.cn,
                targetCode: qBest,
                comparisonCode: shapeBest,
                observed: `SHAPE tie set=${shapeTieSet.join('|')}; Q-Shape best=${qBest}`,
                threshold: 'Q-Shape best must be within 0.02001 CShM of SHAPE minimum',
                details: 'Complete-set ranking gate failed'
            });
            let resolved = 0;
            let discordant = 0;
            for (let left = 0; left < entries.length; left++) {
                for (let right = left + 1; right < entries.length; right++) {
                    const shapeDelta = subtractDecimals(entries[left].shape, entries[right].shape);
                    if (decimalLessEqual(absoluteDecimal(shapeDelta), parseDecimal('0.02001'))) continue;
                    resolved += 1;
                    const qDelta = subtractDecimals(entries[left].qshape, entries[right].qshape);
                    if (compareDecimals(multiplyDecimals(shapeDelta, qDelta), parseDecimal('0')) <= 0) {
                        discordant += 1;
                        addFailure({
                            gate: 'ranking_loss_or_inversion',
                            stream,
                            executionUnitId: `${stream}:${item.case_id}`,
                            caseId: item.case_id,
                            cn: item.cn,
                            targetCode: entries[left].targetCode,
                            comparisonCode: entries[right].targetCode,
                            observed: `SHAPE delta=${decimalToSignificantHalfUp(shapeDelta)}; ` +
                                `Q-Shape delta=${decimalToSignificantHalfUp(qDelta)}`,
                            threshold: 'same strict sign when |SHAPE delta|>0.02001 CShM',
                            details: qDelta.coefficient === 0n
                                ? 'Q-Shape collapsed a SHAPE-resolved pair into an exact tie'
                                : 'Q-Shape reversed a SHAPE-resolved pair'
                        });
                    }
                }
            }
            const selfCode = fieldOf(item, 'expectedOwnTargetCode', 'expected_own_target_code') ||
                fieldOf(item, 'parentReferenceCode', 'parent_reference_code');
            if (isScientificRepresentationCase(item)) {
                const selfShape = entries.find(entry => entry.targetCode === selfCode);
                const selfQ = selfShape && map.get(pairKeyOf(item.case_id, selfCode));
                if (!selfShape || !selfQ) addFailure({
                    gate: 'ideal_self_not_evaluable',
                    stream,
                    executionUnitId: `${stream}:${item.case_id}:${selfCode || ''}`,
                    caseId: item.case_id,
                    cn: item.cn,
                    targetCode: selfCode || '',
                    details: 'Canonical/representation self target is missing or invalid'
                });
                else {
                    if (!decimalLess(selfShape.qshape, parseDecimal('1e-8'))) addFailure({
                        gate: 'ideal_self_qshape',
                        stream,
                        executionUnitId: `${stream}:${item.case_id}:${selfCode}`,
                        caseId: item.case_id,
                        cn: item.cn,
                        targetCode: selfCode,
                        observed: decimalToSignificantHalfUp(selfShape.qshape),
                        threshold: '<1e-8 CShM',
                        details: 'Ideal/representation self Q-Shape measure is too large'
                    });
                    if (!decimalLess(selfShape.shape, parseDecimal('0.01'))) addFailure({
                        gate: 'ideal_self_shape',
                        stream,
                        executionUnitId: `${stream}:${item.case_id}:${selfCode}`,
                        caseId: item.case_id,
                        cn: item.cn,
                        targetCode: selfCode,
                        observed: decimalToSignificantHalfUp(selfShape.shape),
                        threshold: '<0.01 CShM',
                        details: 'Ideal/representation self SHAPE measure is too large'
                    });
                    if (!shapeTieSet.includes(selfCode)) addFailure({
                        gate: 'ideal_nominal_outside_shape_tie_set',
                        stream,
                        executionUnitId: `${stream}:${item.case_id}:${selfCode}`,
                        caseId: item.case_id,
                        cn: item.cn,
                        targetCode: selfCode,
                        observed: decimalToSignificantHalfUp(
                            subtractDecimals(selfShape.shape, shapeMinimum)
                        ),
                        threshold: '<=0.02001 CShM above SHAPE minimum',
                        details: 'Expected ideal/representation self target is outside SHAPE tie set'
                    });
                }
            }
            const summary = {
                case_id: item.case_id,
                stream,
                ranking_status: 'evaluated',
                not_evaluable_targets: [],
                shape_best_code: shapeBest,
                qshape_best_code: qBest,
                shape_tie_set: shapeTieSet,
                qshape_tie_set: qTieSet,
                exact_best_label_agrees: shapeBest === qBest,
                qshape_best_within_shape_tie_set: shapeTieSet.includes(qBest),
                resolved_ranking_pairs: resolved,
                discordant_ranking_pairs: discordant,
                ranking_agreement_fraction: resolved === 0
                    ? 'not_applicable'
                    : rationalToSignificantHalfUp(
                        BigInt(resolved - discordant), BigInt(resolved)
                    ),
                kendall_tau_b: kendall.tau_b,
                kendall_concordant_pairs: kendall.concordant,
                kendall_discordant_pairs: kendall.discordant,
                kendall_shape_only_ties: kendall.shape_only_ties,
                kendall_qshape_only_ties: kendall.qshape_only_ties,
                kendall_joint_ties: kendall.joint_ties,
                failure_count: 0,
                pass: true
            };
            perCase.push(summary);
            caseSummaries.push(summary);
        }
        caseSummariesByStream[stream] = perCase;
    }

    let repeatabilityCompared = 0;
    let repeatabilityPass = true;
    const primary1 = qMaps.q_primary_input_derived_r1;
    const primary2 = qMaps.q_primary_input_derived_r2;
    for (const [key, expected] of casesState.pairs) {
        const left = primary1.get(key);
        const right = primary2.get(key);
        const leftBits = left && String(fieldOf(left,
            'valueHex', 'value_hex', 'float64Hex', 'float64_hex') || '').toLowerCase();
        const rightBits = right && String(fieldOf(right,
            'valueHex', 'value_hex', 'float64Hex', 'float64_hex') || '').toLowerCase();
        if (!leftBits || !rightBits) {
            repeatabilityPass = false;
            addFailure({
                gate: 'qshape_primary_repeatability_not_evaluable',
                stream: 'q_primary_input_derived_r1|q_primary_input_derived_r2',
                executionUnitId: `q-primary:${key}`,
                caseId: expected.caseItem.case_id,
                cn: expected.caseItem.cn,
                targetCode: expected.target.code,
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
                    caseId: expected.caseItem.case_id,
                    cn: expected.caseItem.cn,
                    targetCode: expected.target.code,
                    observed: `${leftBits}|${rightBits}`,
                    threshold: 'identical IEEE-754 binary64 hexadecimal bits',
                    details: 'Primary input-derived repetitions differ at the bit level'
                });
            }
        }
    }

    const relationSummaries = [];
    for (const item of casesState.caseMap.values()) {
        const descriptor = scientificRelationDescriptor(item, casesState.caseMap);
        if (!descriptor.authorized) continue;
        const childId = item.case_id;
        const parent = descriptor.parent;
        const parentId = descriptor.parentId;
        const expectedParentId = descriptor.expectedParent
            ? fieldOf(descriptor.expectedParent, 'caseId', 'case_id') : '';
        if (!parent || !parentId ||
            (descriptor.declaredParentId && parentId !== expectedParentId)) {
            addFailure({
                gate: 'relation_parent_contract',
                executionUnitId: `relation:${childId}`,
                caseId: childId,
                cn: item.cn,
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
        const targetCodes = referencesForCase(casesState, item.cn).map(target => target.code);
        for (const targetCode of targetCodes) {
            const childShape = shapeConsensus.get(pairKeyOf(childId, targetCode));
            const parentShape = shapeConsensus.get(pairKeyOf(parentId, targetCode));
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
                    cn: item.cn,
                    targetCode,
                    comparisonCode: parentId,
                    observed: `${parentShape.token}|${childShape.token}`,
                    threshold: 'identical five-decimal SHAPE consensus token',
                    details: 'Authorized representation relation changed the SHAPE token'
                });
            }
        }
        for (const stream of Q_STREAMS) {
            if (!stream.startsWith('q_explicit_')) {
                relation.q_explicit_streams[stream] = 'not_applicable';
                continue;
            }
            let status = 'pass';
            for (const targetCode of targetCodes) {
                const childValue = qValueFromRow(qMaps[stream].get(
                    pairKeyOf(childId, targetCode)
                ) || {});
                const parentValue = qValueFromRow(qMaps[stream].get(
                    pairKeyOf(parentId, targetCode)
                ) || {});
                if (!childValue || !parentValue ||
                    !decimalLessEqual(parseDecimal('0'), childValue) ||
                    !decimalLessEqual(childValue, parseDecimal('100')) ||
                    !decimalLessEqual(parseDecimal('0'), parentValue) ||
                    !decimalLessEqual(parentValue, parseDecimal('100'))) {
                    if (status !== 'fail') status = 'not_evaluable';
                    continue;
                }
                const difference = absoluteDecimal(subtractDecimals(childValue, parentValue));
                if (decimalLess(parseDecimal('1e-8'), difference)) {
                    status = 'fail';
                    addFailure({
                        gate: 'qshape_parent_child_explicit_invariance',
                        stream,
                        executionUnitId: `relation:${stream}:${childId}:${targetCode}`,
                        caseId: childId,
                        cn: item.cn,
                        targetCode,
                        comparisonCode: parentId,
                        observed: decimalToSignificantHalfUp(difference),
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

    const failures = collector.finalize();
    for (const summary of caseSummaries) {
        summary.failure_count = failures.filter(failure =>
            failure.stream === summary.stream && failure.case_id === summary.case_id
        ).length;
        summary.pass = summary.failure_count === 0;
    }
    const streamStatuses = Object.fromEntries(Q_STREAMS.map(stream => {
        const streamFailures = failures.filter(failure => failure.stream === stream).length;
        const streamComparisons = comparisons.filter(row => row.stream === stream);
        return [stream, {
            stream,
            seed_mode: stream.startsWith('q_explicit_') ? 'explicit-seed' : 'input-derived',
            explicit_seed_uint32: stream.startsWith('q_explicit_')
                ? Number(stream.slice('q_explicit_seed_'.length)) : null,
            cases_expected: casesState.caseMap.size,
            comparisons_expected: casesState.pairs.size,
            comparisons_observed: qMaps[stream].size,
            comparisons_domain_valid: streamComparisons.filter(row => row.result_domain_valid).length,
            case_summaries: caseSummariesByStream[stream],
            failures: streamFailures,
            campaign_gate_status: streamFailures === 0 ? 'pass' : 'fail'
        }];
    }));
    const relationFailureCount = failures.filter(failure =>
        failure.gate.startsWith('relation_') ||
        failure.gate.startsWith('shape_parent_child_') ||
        failure.gate.startsWith('qshape_parent_child_')
    ).length;
    const pairedSignRows = buildIndependentPairedSignRows(casesState, shapeConsensus, qMaps);
    const stratifiedStatistics = buildIndependentStratifiedStatistics(comparisons);
    return {
        shapeConsensus,
        comparisons,
        caseSummaries,
        failures,
        streamStatuses,
        relationSummaries,
        relationFailureCount,
        pairedSignRows,
        stratifiedStatistics,
        primaryRepeatability: {
            compared: repeatabilityCompared,
            bit_identical: repeatabilityPass,
            status: repeatabilityPass ? 'pass' : 'fail'
        }
    };
}

function referencesForCase(casesState, cn) {
    return casesState.referencesFlat.filter(reference => reference.cn === cn);
}

function csvValue(value) {
    return value === undefined || value === null ? '' : String(value);
}

function compareCsvRowsAgainstExpected(actualRows, expectedRows, label) {
    requireThat(actualRows.length === expectedRows.length,
        `${label} row count mismatch`);
    const actualByKey = new Map();
    for (const row of actualRows) {
        const stream = row.stream || '';
        const key = `${stream}\u0000${row.case_id || ''}\u0000${row.target_code || row.targetCode || ''}`;
        requireThat(!actualByKey.has(key), `${label} duplicate row ${key}`);
        actualByKey.set(key, row);
    }
    for (const expected of expectedRows) {
        const key = `${expected.stream}\u0000${expected.case_id}\u0000${expected.target_code}`;
        const actual = actualByKey.get(key);
        requireThat(actual, `${label} missing row ${key}`);
        for (const [field, value] of Object.entries(expected)) {
            requireThat(csvValue(actual[field]) === csvValue(value),
                `${label} value mismatch ${key}/${field}`);
        }
    }
}

function verifyReports(root, listedPaths, analysisState, casesState, manifest) {
    const analysisFile = packageJson(
        root,
        listedPaths,
        'reports/metamorphic-analysis.json',
        'metamorphic analysis'
    );
    const analysis = analysisFile.value;
    exactSet(Object.keys(analysis), [
        'schema_version', 'summary', 'primary_q_repeatability', 'stream_summaries',
        'comparison_rows', 'case_summaries', 'relation_summaries', 'paired_sign_rows',
        'stratified_statistics', 'failures', 'failure_ledger'
    ], 'metamorphic analysis fields');
    requireThat(analysis.schema_version === 1 && analysis.summary &&
        analysis.summary.overall_validation_status === 'incomplete',
    'metamorphic analysis envelope mismatch');
    requireThat(analysis.summary.campaign_gate_status === manifest.campaign_gate_status,
        'analysis/manifest campaign status mismatch');
    const expectedMalformedSummary = analysisState.malformedSummary || {
        included: false,
        controls_observed: 0,
        controls_passed: 0,
        controls_failed: 0,
        campaign_gate_status: 'not_evaluated'
    };
    const expectedShapeRows = [...casesState.pairs].map(([key, expected]) => {
        const shape = analysisState.shapeConsensus.get(key);
        return {
            case_id: expected.caseItem.case_id,
            target_code: expected.target.code,
            shape_r1_token: shape.rep1Token,
            shape_r2_token: shape.rep2Token,
            shape_consensus_token: shape.token,
            exact_token_agreement: shape.exact,
            domain_valid: shape.valid
        };
    });
    const expectedGates = {
        streams: Q_STREAMS,
        shape_repetitions: SHAPE_REPETITIONS,
        absolute_error_cshm: '<0.01',
        cshm_domain: 'finite and within [0, 100]',
        qshape_nonfinite_cshm: 'canonical retained result is a scientific gate failure',
        ideal_self_qshape_cshm: '<1e-8',
        ideal_self_shape_cshm: '<0.01',
        shape_repeatability: 'exact five-decimal lexical token',
        shape_out_tab_consistency: '|out-tab|<=0.000505 CShM',
        shape_tie_set_gamma_cshm: '0.02001',
        resolved_ranking_pairs: 'same strict sign when |SHAPE delta|>gamma',
        primary_q_repeatability: 'identical IEEE-754 binary64 hexadecimal bits',
        authorized_relations: 'six canonical representation children plus distorted-twin; explicit Q only'
    };
    const expectedTotals = {
        cases: casesState.caseMap.size,
        comparisons_expected: casesState.pairs.size,
        comparisons_observed: analysisState.comparisons.length,
        comparisons_domain_valid: analysisState.comparisons.filter(
            row => row.result_domain_valid
        ).length,
        signed_error_count: analysisState.comparisons.filter(
            row => row.result_domain_valid
        ).length,
        relation_failures: analysisState.relationFailureCount,
        failures: analysisState.failures.length
    };
    const expectedShapeSummary = {
        comparisons_expected: expectedShapeRows.length,
        exact_token_agree: expectedShapeRows.filter(row => row.exact_token_agreement).length,
        domain_valid: expectedShapeRows.filter(row => row.domain_valid).length,
        rows: expectedShapeRows
    };
    const expectedRelationCounts = {
        authorized_relations: analysisState.relationSummaries.length,
        failed_relations: analysisState.relationSummaries.filter(
            row => row.relation_status === 'fail'
        ).length,
        not_evaluable_relations: analysisState.relationSummaries.filter(
            row => row.relation_status === 'not_evaluable'
        ).length,
        input_derived_q_relation_gate: 'not_applicable'
    };
    const expectedReportingCounts = {
        tidy_comparison_rows: analysisState.comparisons.length,
        case_summary_rows: analysisState.caseSummaries.length,
        authorized_relation_rows: analysisState.relationSummaries.length,
        paired_sign_rows: analysisState.pairedSignRows.length,
        paired_sign_not_evaluable_rows: analysisState.pairedSignRows.filter(
            row => row.status !== 'evaluable'
        ).length,
        stratified_statistics_rows: analysisState.stratifiedStatistics.length
    };
    exactSet(Object.keys(analysis.summary), [
        'schema_version', 'campaign_gate_status', 'overall_validation_status',
        'claim_boundary', 'gates', 'totals', 'shape_consensus',
        'primary_q_repeatability', 'relation_counts', 'malformed_controls',
        'reporting_counts'
    ], 'metamorphic analysis summary fields');
    requireThat(analysis.summary.schema_version === 1 &&
        analysis.summary.claim_boundary ===
            'metamorphic representation and distortion robustness; not external chemical validity' &&
        jsonEqual(analysis.summary.gates, expectedGates) &&
        jsonEqual(analysis.summary.totals, expectedTotals) &&
        jsonEqual(analysis.summary.shape_consensus, expectedShapeSummary) &&
        jsonEqual(analysis.summary.primary_q_repeatability, analysisState.primaryRepeatability) &&
        jsonEqual(analysis.primary_q_repeatability, analysisState.primaryRepeatability) &&
        jsonEqual(analysis.summary.relation_counts, expectedRelationCounts) &&
        jsonEqual(analysis.summary.malformed_controls, expectedMalformedSummary) &&
        jsonEqual(analysis.summary.reporting_counts, expectedReportingCounts),
    'metamorphic analysis independently reconstructed summary mismatch');

    // Bind the emitted analysis back to the verifier's independent SHAPE/Q
    // reconstruction before using that analysis as the report source.
    requireThat(Array.isArray(analysis.comparison_rows) &&
        jsonEqual(analysis.comparison_rows, analysisState.comparisons),
    'metamorphic analysis comparison rows differ from independent ordered reconstruction');

    requireThat(jsonEqual(analysis.case_summaries, analysisState.caseSummaries),
        'metamorphic analysis case summaries differ from independent reconstruction');
    requireThat(jsonEqual(analysis.stream_summaries, analysisState.streamStatuses),
        'metamorphic analysis stream summaries differ from independent reconstruction');
    requireThat(jsonEqual(analysis.relation_summaries, analysisState.relationSummaries),
        'metamorphic analysis relation summaries differ from independent reconstruction');
    requireThat(jsonEqual(analysis.paired_sign_rows, analysisState.pairedSignRows),
        'metamorphic analysis paired-sign rows differ from independent reconstruction');
    requireThat(jsonEqual(analysis.stratified_statistics, analysisState.stratifiedStatistics),
        'metamorphic analysis stratified statistics differ from independent reconstruction');
    requireThat(jsonEqual(analysis.failures, analysisState.failures) &&
        jsonEqual(analysis.failure_ledger, analysisState.failures),
    'metamorphic analysis failure ledger differs from independent ordered reconstruction');

    // Reconstruct exact table order, CSV quoting, typed dictionary, stable JSON,
    // and working-report bytes without importing the report producer.
    const expectedArtifacts = buildExpectedReportingArtifacts(analysis);
    for (const [fileName, expectedText] of Object.entries(expectedArtifacts)) {
        const token = `reports/${fileName}`;
        const actualText = packageText(root, listedPaths, token, `report ${fileName}`);
        requireThat(actualText === expectedText,
            `report ${fileName} does not exactly match independent reconstruction`);
    }

    const comparisonCsv = parseCsvDocument(expectedArtifacts['comparison-rows.csv']);
    const summaries = parseCsvDocument(expectedArtifacts['case-summaries.csv']).rows;
    return { analysis, comparisonCsv, summaries, expectedArtifacts };
}

function analyzerStableJson(value) {
    if (Array.isArray(value)) return `[${value.map(analyzerStableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key =>
            `${JSON.stringify(key)}:${analyzerStableJson(value[key])}`
        ).join(',')}}`;
    }
    return JSON.stringify(value);
}

function malformedScientificFailure(row) {
    const failure = {
        failure_id: '',
        event_type: 'malformed_control_contract',
        gate: 'malformed_control_contract',
        status: 'fail',
        severity: 'gate_failure',
        stream: '',
        repetition: '',
        execution_unit_id: `malformed:${row.control_id}`,
        case_id: row.source_parent_case_id || '',
        cn: row.cn ?? '',
        target_code: '',
        comparison_code: '',
        observed: `outcome=${String(row.observed_outcome ?? 'missing')};numeric_rows=${String(row.observed_numeric_rows)}`,
        threshold: `outcome=${String(row.expected_outcome ?? 'missing')};numeric_rows=${String(row.expected_numeric_rows)}`,
        details: `Boundary control ${row.control_id || '<missing>'} (` +
            `${row.category || 'unknown'}, ${row.interface || 'unknown'}) ` +
            'did not match the frozen outcome contract'
    };
    const digestSource = {
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
    };
    failure.failure_id = `failure-${sha256(Buffer.from(analyzerStableJson(digestSource), 'utf8')).slice(0, 16)}`;
    return failure;
}

function expectedMalformedShapeDat(control, ordinal) {
    const structureId = `MAL${String(ordinal + 1).padStart(2, '0')}`;
    return [
        `$ Q-Shape direct parity validation, CN=${control.cn}`,
        '%fullout',
        `${control.cn} 1`,
        String(control.input.target_index),
        structureId,
        ...control.input.atoms.map(atom =>
            `${atom.element.padEnd(3, ' ')} ${atom.tokens[0]} ${atom.tokens[1]} ${atom.tokens[2]}`
        ),
        ''
    ].join('\n');
}

function validateMalformedShapeObservation(root, listedPaths, row, frozenControl, ordinal) {
    const prefix = `malformed/raw/shape/${row.control_id}/`;
    const manifestedPaths = [...listedPaths].filter(token => token.startsWith(prefix));
    const declaredPaths = row.raw_evidence_paths.map(token => normalizeManifestPath(token));
    requireThat(declaredPaths.every(token => token.startsWith(prefix)),
        `malformed SHAPE raw path escapes its control ${row.control_id}`);
    exactSet(manifestedPaths, declaredPaths, `malformed SHAPE ${row.control_id} raw evidence set`);
    const byName = new Map(declaredPaths.map(token => [path.posix.basename(token), token]));
    requireThat(byName.size === declaredPaths.length,
        `malformed SHAPE ${row.control_id} repeats a raw evidence basename`);
    for (const name of ['control.dat', 'stdout.txt', 'stderr.txt', 'exit-code.txt']) {
        requireThat(byName.has(name), `malformed SHAPE ${row.control_id} lacks ${name}`);
    }
    const read = name => packageText(
        root, listedPaths, byName.get(name), `malformed SHAPE ${row.control_id}/${name}`
    );
    requireThat(read('control.dat') === expectedMalformedShapeDat(frozenControl, ordinal),
        `malformed SHAPE control bytes mismatch ${row.control_id}`);
    const exitText = read('exit-code.txt');
    requireThat(/^-?\d+\n$/.test(exitText), `malformed SHAPE exit-code bytes mismatch ${row.control_id}`);
    const exitCode = Number(exitText.trim());
    requireThat(row.execution_mode === 'live_product_process' ||
        row.execution_mode === 'retained_product_evidence',
    `malformed SHAPE execution mode mismatch ${row.control_id}`);
    requireThat(row.process_exit_code === exitCode,
        `malformed SHAPE process exit mismatch ${row.control_id}`);
    requireThat(row.product_boundary === 'SHAPE 2.1 executable',
        `malformed SHAPE product boundary mismatch ${row.control_id}`);
    requireThat(row.observed_rejection_code === null,
        `malformed SHAPE control has a synthetic rejection code ${row.control_id}`);

    const outText = byName.has('control.out') ? read('control.out') : null;
    const tabText = byName.has('control.tab') ? read('control.tab') : null;
    const expectedRawNames = ['control.dat', 'stdout.txt', 'stderr.txt', 'exit-code.txt']
        .concat(outText === null ? [] : ['control.out'])
        .concat(tabText === null ? [] : ['control.tab']);
    requireThat(jsonEqual(declaredPaths, expectedRawNames.map(name => `${prefix}${name}`)),
        `malformed SHAPE ${row.control_id} raw evidence order mismatch`);
    let observedOutcome;
    let observedNumericRows = 0;
    let outTokens = [];
    let tabTokens = [];
    let structureIds = [];
    let targetCodes = [];
    if (exitCode !== 0) {
        observedOutcome = 'process_rejected_or_failed';
    } else if (outText === null || tabText === null) {
        observedOutcome = 'completed_without_output_pair';
    } else {
        try {
            const parsedOut = parseShapeRawOut(outText, `malformed SHAPE ${row.control_id} .out`);
            const parsedTab = parseShapeRawTab(tabText, `malformed SHAPE ${row.control_id} .tab`);
            structureIds = [...parsedOut.keys()];
            for (const record of parsedOut.values()) {
                for (const [targetCode, token] of record.values) {
                    targetCodes.push(targetCode);
                    outTokens.push(token);
                }
            }
            for (const record of parsedTab.records.values()) {
                for (const token of record.values()) tabTokens.push(token);
            }
            requireThat(jsonEqual([...parsedTab.records.keys()], structureIds) &&
                [...parsedOut.values()].every(record =>
                    jsonEqual([...record.values.keys()], parsedTab.targets)),
            `malformed SHAPE .out/.tab identity mismatch ${row.control_id}`);
            observedNumericRows = outTokens.length;
            observedOutcome = observedNumericRows > 0
                ? 'accepted_with_numeric_rows' : 'accepted_without_numeric_rows';
        } catch (_error) {
            observedOutcome = 'unparseable_product_output';
        }
    }
    requireThat(row.observed_outcome === observedOutcome &&
        row.observed_numeric_rows === observedNumericRows,
    `malformed SHAPE observed outcome/evidence mismatch ${row.control_id}`);
    requireThat(jsonEqual(row.observed_value_tokens, outTokens) &&
        jsonEqual(row.observed_tab_value_tokens, tabTokens),
    `malformed SHAPE observed token mismatch ${row.control_id}`);
    if (observedOutcome === 'unparseable_product_output') requireThat(
        typeof row.observed_error_message === 'string' && row.observed_error_message.length > 0,
        `malformed SHAPE parse-error evidence mismatch ${row.control_id}`
    );
    if (observedOutcome.startsWith('accepted_')) requireThat(
        jsonEqual(row.observed_structure_ids, structureIds) &&
        jsonEqual(row.observed_target_codes, targetCodes),
        `malformed SHAPE parsed identity mismatch ${row.control_id}`
    );
}

function validateMalformedQShapeObservation(row) {
    requireThat(row.raw_evidence_paths.length === 0,
        `malformed Q-Shape control has unexpected raw process paths ${row.control_id}`);
    requireThat(row.observed_tab_value_tokens.length === 0,
        `malformed Q-Shape control has unexpected SHAPE tab tokens ${row.control_id}`);
    if (row.interface === 'qshape_reference_registry') {
        requireThat(row.product_boundary === 'src/constants/referenceGeometries/index.js' &&
            row.observed_rejection_code === null &&
            ['reference_set_available', 'reference_set_unavailable'].includes(row.observed_outcome) &&
            Number.isInteger(row.observed_reference_count) && row.observed_reference_count >= 0 &&
            row.observed_numeric_rows === 0 && row.observed_value_tokens.length === 0,
        `malformed Q-Shape reference-registry evidence mismatch ${row.control_id}`);
        requireThat((row.observed_outcome === 'reference_set_available') ===
            (row.observed_reference_count > 0),
        `malformed Q-Shape reference-registry outcome/count mismatch ${row.control_id}`);
        return;
    }
    requireThat(row.product_boundary === 'src/services/shapeAnalysis/shapeCalculator.js' &&
        ['finite_result', 'nonfinite_result', 'thrown_error'].includes(row.observed_outcome),
    `malformed Q-Shape calculator evidence mismatch ${row.control_id}`);
    if (row.observed_outcome === 'finite_result') {
        requireThat(row.observed_numeric_rows === 1 && row.observed_value_tokens.length === 1 &&
            qTokenBits(row.observed_value_tokens[0]) !== null &&
            row.observed_rejection_code === null &&
            row.observed_result_type === 'number',
        `malformed Q-Shape finite-result evidence mismatch ${row.control_id}`);
    } else if (row.observed_outcome === 'nonfinite_result') {
        requireThat(row.observed_numeric_rows === 0 && row.observed_value_tokens.length === 1 &&
            ['NaN', 'Infinity', '-Infinity'].includes(row.observed_value_tokens[0]) &&
            row.observed_rejection_code === null &&
            row.observed_result_type === 'number',
        `malformed Q-Shape nonfinite-result evidence mismatch ${row.control_id}`);
    } else {
        requireThat(row.observed_numeric_rows === 0 && row.observed_value_tokens.length === 0 &&
            typeof row.observed_error_name === 'string' && row.observed_error_name.length > 0 &&
            typeof row.observed_error_message === 'string',
        `malformed Q-Shape thrown-error evidence mismatch ${row.control_id}`);
    }
}

function expectedMalformedObservationFields(row) {
    const fields = [
        'control_id', 'program', 'interface', 'category', 'cn',
        'source_parent_case_id', 'campaign_gate', 'expected_outcome',
        'expected_numeric_rows', 'observation_complete', 'observed_rejection_code',
        'observed_value_tokens', 'observed_tab_value_tokens', 'raw_evidence_paths',
        'product_boundary', 'product_boundary_invoked', 'observed_outcome',
        'observed_numeric_rows', 'status'
    ];
    if (row.interface === 'qshape_reference_registry') fields.push('observed_reference_count');
    else if (row.interface === 'qshape_core_calculator') {
        if (row.observed_outcome === 'thrown_error') {
            fields.push('observed_error_name', 'observed_error_message');
        } else {
            fields.push('observed_result_type');
        }
    } else {
        fields.push('execution_mode', 'process_exit_code');
        if (row.observed_outcome === 'unparseable_product_output') {
            fields.push('observed_error_message');
        } else if (row.observed_outcome === 'accepted_with_numeric_rows' ||
            row.observed_outcome === 'accepted_without_numeric_rows') {
            fields.push('observed_structure_ids', 'observed_target_codes');
        }
    }
    return fields;
}

function verifyMalformedObserved(root, listedPaths, frozen) {
    const observed = packageJson(root, listedPaths, 'malformed/observations.json',
        'malformed observed outcomes').value;
    exactSet(Object.keys(observed), [
        'schema_version', 'campaign_id', 'campaign_gate', 'evidence_scope',
        'product_boundary_invoked', 'source_positive_cases_sha256', 'count',
        'passed', 'failed', 'campaign_gate_status', 'results', 'controls',
        'source_controls_sha256'
    ], 'malformed observed envelope fields');
    requireThat(observed.schema_version === 1 && observed.campaign_id === CONTROL_CAMPAIGN_ID &&
        observed.campaign_gate === 'malformed_control_contract' &&
        observed.evidence_scope === 'product_boundaries' &&
        observed.product_boundary_invoked === true &&
        observed.source_positive_cases_sha256 === CASES_SHA256 &&
        observed.source_controls_sha256 === frozen.malformedSha256 &&
        observed.count === MALFORMED_CONTROL_CONTRACTS.length &&
        Array.isArray(observed.results) && Array.isArray(observed.controls) &&
        observed.results.length === observed.count &&
        jsonEqual(observed.results, observed.controls),
    'malformed observed product-boundary envelope mismatch');
    const rows = observed.controls;
    const expectedById = new Map(frozen.malformed.controls.map(control => [control.control_id, control]));
    const seen = new Set();
    const failures = [];
    let passed = 0;
    for (const [ordinal, row] of rows.entries()) {
        const expected = expectedById.get(row.control_id);
        requireThat(expected && !seen.has(row.control_id),
            `unknown/duplicate malformed outcome ${row.control_id || '<missing>'}`);
        requireThat(row.control_id === frozen.malformed.controls[ordinal]?.control_id,
            `malformed observation order mismatch at position ${ordinal + 1}`);
        seen.add(row.control_id);
        exactSet(Object.keys(row), expectedMalformedObservationFields(row),
            `malformed observation ${row.control_id} fields`);
        requireThat(row.observation_complete === true && row.product_boundary_invoked === true &&
            row.program === expected.program && row.interface === expected.interface &&
            row.category === expected.category && row.cn === expected.cn &&
            row.source_parent_case_id === expected.source_parent_case_id &&
            row.campaign_gate === 'malformed_control_contract' &&
            row.expected_outcome === expected.expected_outcome &&
            row.expected_numeric_rows === expected.expected_numeric_rows &&
            typeof row.observed_outcome === 'string' && row.observed_outcome.length > 0 &&
            Number.isInteger(row.observed_numeric_rows) && row.observed_numeric_rows >= 0 &&
            (row.observed_rejection_code === null || typeof row.observed_rejection_code === 'string') &&
            Array.isArray(row.observed_value_tokens) &&
            Array.isArray(row.observed_tab_value_tokens) &&
            Array.isArray(row.raw_evidence_paths),
        `malformed observation is structurally incomplete ${row.control_id}`);
        if (row.interface === 'shape_2_1_raw_dat') {
            validateMalformedShapeObservation(root, listedPaths, row, expected, ordinal);
        } else {
            validateMalformedQShapeObservation(row);
        }
        const status = row.observed_outcome === row.expected_outcome &&
            row.observed_numeric_rows === row.expected_numeric_rows ? 'pass' : 'fail';
        requireThat(row.status === status,
            `malformed observation status is inconsistent ${row.control_id}`);
        if (status === 'pass') passed += 1;
        else failures.push(malformedScientificFailure(row));
    }
    requireThat(seen.size === MALFORMED_CONTROL_CONTRACTS.length &&
        observed.passed === passed && observed.failed === observed.count - passed &&
        observed.campaign_gate_status === (passed === observed.count ? 'pass' : 'fail'),
    'malformed observation census or campaign status mismatch');
    const resultRows = packageJson(root, listedPaths, 'malformed/results.json',
        'malformed result rows').value;
    requireThat(Array.isArray(resultRows) && jsonEqual(resultRows, rows),
        'malformed result-row copy mismatch');
    return {
        rows,
        failures,
        passed,
        failed: observed.count - passed,
        campaignGateStatus: observed.campaign_gate_status
    };
}

function expectedPackageReceipt(manifest, manifestSha256, campaignGateStatus, verifiedCounts, warnings = []) {
    return {
        schema_version: 2,
        verification_status: 'valid',
        campaign_id: manifest.campaign_id,
        package_type: manifest.package_type,
        manifest_sha256: manifestSha256,
        package_status: 'complete',
        campaign_gate_status: campaignGateStatus,
        overall_validation_status: manifest.overall_validation_status,
        verified_counts: verifiedCounts,
        warnings: [...warnings].sort()
    };
}

function packageExitCodeForReceipt(receipt) {
    requireThat(receipt?.verification_status === 'valid' &&
        receipt.package_status === 'complete' &&
        ['pass', 'fail'].includes(receipt.campaign_gate_status),
    'cannot derive a normative exit code from an invalid verifier receipt');
    return receipt.campaign_gate_status === 'pass' ? 0 : 2;
}

function expectedExternalPackageSidecar(receipt) {
    return {
        schema_version: 2,
        receipt_kind: 'external-independent-verifier-sidecar',
        package_manifest_sha256: receipt.manifest_sha256,
        verifier_exit_code: packageExitCodeForReceipt(receipt),
        verifier_stderr: '',
        receipt_parse_error: null,
        receipt
    };
}

function verifyPackage(packagePath) {
    const bundle = verifyManifestFiles(packagePath);
    const boundaries = validateManifestPackage(bundle);
    const frozen = validateFrozenPackageInputs(bundle.root, bundle.listedPaths, bundle.manifest);
    const casesState = expectedPairMap(frozen.cases, frozen.referencesFlat);
    casesState.referencesFlat = frozen.referencesFlat;
    const shapeRows = validateShapeEvidence(
        bundle.root, bundle.listedPaths, casesState, frozen.referencesFlat, bundle.manifest
    );
    const qEvidence = validateQShapeEvidence(
        bundle.root, bundle.listedPaths, casesState, frozen.referencesFlat, shapeRows,
        boundaries.runtime
    );
    const malformedState = verifyMalformedObserved(bundle.root, bundle.listedPaths, frozen);
    const analysisState = caseStreamFailures(casesState, shapeRows, qEvidence.qRows);
    analysisState.malformedSummary = {
        included: true,
        controls_observed: malformedState.rows.length,
        controls_passed: malformedState.passed,
        controls_failed: malformedState.failed,
        campaign_gate_status: malformedState.campaignGateStatus
    };
    analysisState.failures = finalizeIndependentFailureObjects([
        ...analysisState.failures,
        ...malformedState.failures
    ]);
    const malformedExecutionUnits = new Set(
        malformedState.rows.filter(row => row.status === 'fail')
            .map(row => `malformed:${row.control_id}`)
    );
    analysisState.malformedFailures = analysisState.failures.filter(failure =>
        malformedExecutionUnits.has(failure.execution_unit_id)
    );
    const reports = verifyReports(
        bundle.root, bundle.listedPaths, analysisState, casesState, bundle.manifest
    );
    requireThat(reports.analysis.summary.campaign_gate_status ===
        (analysisState.failures.length === 0 ? 'pass' : 'fail'),
    'independently recomputed campaign status mismatch');
    requireThat(bundle.manifest.campaign_gate_status === reports.analysis.summary.campaign_gate_status,
        'manifest campaign status does not match independent analysis');
    const warnings = [];
    const verifiedCounts = {
        references: REFERENCE_COUNT,
        cases: CASE_COUNT,
        matched_target_evaluations_per_program: MATCHED_PAIR_COUNT,
        shape_invocations: SHAPE_INVOCATION_COUNT,
        shape_rows_with_repetitions: SHAPE_VALUE_COUNT,
        qshape_rows_total: Q_VALUE_COUNT,
        malformed_controls: 7,
        campaign_failures: analysisState.failures.length
    };
    validateManifestVerifiedCounts(bundle.manifest, verifiedCounts);
    const receipt = expectedPackageReceipt(
        bundle.manifest, bundle.manifestSha256, bundle.manifest.campaign_gate_status,
        verifiedCounts, warnings
    );
    verifyExternalPackageSidecarIfPresent(packagePath, receipt);
    return receipt;
}

function verifyExternalPackageSidecarIfPresent(packagePath, receipt) {
    const sidecarPath = `${path.resolve(packagePath)}.verification.json`;
    if (!fs.existsSync(sidecarPath)) return null;
    const stat = fs.lstatSync(sidecarPath);
    requireThat(stat.isFile() && !stat.isSymbolicLink(),
        `Verification sidecar is not a regular file: ${sidecarPath}`);
    const expected = expectedExternalPackageSidecar(receipt);
    requireThat(fs.readFileSync(sidecarPath, 'utf8') ===
        `${JSON.stringify(canonicalJson(expected), null, 2)}\n`,
        'External verification sidecar does not exactly match a fresh verifier receipt');
    return sidecarPath;
}

function inputCli(argv) {
    if (argv.length !== 4 || argv[0] !== '--cases' || argv[2] !== '--references') {
        process.stderr.write('Usage: node verify-metamorphic-parity.cjs --cases <cases.json> --references <references.json>\n');
        return 64;
    }
    try {
        const casesPath = path.resolve(argv[1]);
        const referencesPath = path.resolve(argv[3]);
        const cases = readJsonFile(casesPath);
        const references = readJsonFile(referencesPath);
        const receipt = verifyFrozenInputs(cases.value, references.value, cases.raw);
        process.stdout.write(`${JSON.stringify(receipt)}\n`);
        return 0;
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        return error?.code === 'INVALID_PACKAGE' ? 3 : 70;
    }
}

function packageCli(argv) {
    if (argv.length !== 2 || argv[0] !== '--package') {
        process.stderr.write(
            'Usage: node verify-metamorphic-parity.cjs --package <package-directory>\n'
        );
        return 64;
    }
    try {
        const receipt = verifyPackage(argv[1]);
        process.stdout.write(`${JSON.stringify(receipt)}\n`);
        return packageExitCodeForReceipt(receipt);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 3;
    }
}

function cli(argv) {
    if (argv[0] === '--package') return packageCli(argv);
    return inputCli(argv);
}

if (require.main === module) process.exitCode = cli(process.argv.slice(2));

module.exports = {
    ADVERSARIAL_RECIPES,
    CANDIDATE_SOURCE_PATHS,
    CASES_SHA256,
    EXPLICIT_SEEDS,
    MAIN_RECIPES,
    Q_STREAMS,
    REPORT_TABLES,
    SHAPE_REPETITIONS,
    absoluteDecimal,
    canonicalBinary64Token,
    buildExpectedDataDictionary,
    buildExpectedReportingArtifacts,
    buildExpectedWorkingReport,
    compareDecimals,
    decimalToSignificantHalfUp,
    deriveSeed,
    exactSet,
    exactDecimalDistribution,
    exactDecimalErrorStatistics,
    expectedExternalPackageSidecar,
    expectedPackageReceipt,
    float64Hex,
    gitBlobOid,
    inputCli,
    packageCli,
    packageExitCodeForReceipt,
    verifyPackage,
    verifyExternalPackageSidecarIfPresent,
    validateCandidateSourceBoundary,
    validateShapeQualifications,
    normalizeManifestPath,
    parseCsv,
    parseCsvDocument,
    parseDecimal,
    permutation,
    sha256,
    subtractDecimals,
    verifyManifestFiles,
    verifyFrozenInputs
};

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const frozenCasesPath = 'C:/Users/henri/OneDrive/Academic/Production/Papers/Working/Q²M³/Q-Shape/validation_preregistrations/metamorphic-adversarial-v1-102895a8-20260824/cases.json';
const document = JSON.parse(fs.readFileSync(frozenCasesPath, 'utf8'));

const {
    EXPECTED_SHAPE_VALUE_COUNT,
    buildMetamorphicShapeSchedule,
    makeAttemptPath,
    makeCheckpointPath,
    makeInvocationId,
    parseCheckpoint,
    parseInvocationId,
    recipeCompositeKey,
    reserveAttemptPath
} = require('../scripts/metamorphic-schedule.cjs');

const SHAPE_ALIASES = new Map([
    ['3:fac-vOC-3', 'fvOC-3'],
    ['3:mer-vOC-3', 'mvOC-3'],
    ['8:JBTP-8', 'JBTPR-8']
]);

function runtimeBindingsFromFrozenCases() {
    const byCn = new Map();
    for (const item of document.cases) {
        if (!byCn.has(item.cn)) byCn.set(item.cn, new Map());
        byCn.get(item.cn).set(item.parent_reference_index, item.parent_reference_code);
    }
    return [...byCn.entries()].sort((a, b) => a[0] - b[0]).map(([cn, byOrdinal]) => ({
        cn,
        targets: [...byOrdinal.entries()].sort((a, b) => a[0] - b[0]).map(([ordinal, code]) => ({
            code,
            shapeCode: SHAPE_ALIASES.get(`${cn}:${code}`) || code,
            shapeIndex: ordinal
        }))
    }));
}

test('builds the frozen 33-recipe, 495-base, 990-repeated schedule', () => {
    const schedule = buildMetamorphicShapeSchedule(document, runtimeBindingsFromFrozenCases());
    assert.equal(schedule.recipes.length, 33);
    assert.equal(schedule.baseInvocations.length, 495);
    assert.equal(schedule.invocations.length, 990);
    assert.equal(schedule.counts.referenceCount, 87);
    assert.equal(schedule.counts.caseCount, 2871);
    assert.equal(schedule.counts.targetEvaluationsPerRepetition, 28545);
    assert.equal(schedule.counts.shapeValueCount, EXPECTED_SHAPE_VALUE_COUNT);

    assert.deepEqual(schedule.recipes.slice(0, 2).map(item => [item.slotId, item.recipeKey]), [
        ['s01', recipeCompositeKey('main_positive', 1, 'canonical')],
        ['s02', recipeCompositeKey('main_positive', 2, 'rotation-a')]
    ]);
    assert.deepEqual(schedule.recipes.slice(-3).map(item => [item.slotId, item.recipeKey]), [
        ['s31', recipeCompositeKey('adversarial_positive', 1, 'near-degenerate-assignment')],
        ['s32', recipeCompositeKey('adversarial_positive', 2, 'near-collinear')],
        ['s33', recipeCompositeKey('adversarial_positive', 3, 'center-ligand-swap')]
    ]);

    const ids = new Set(schedule.invocations.map(item => item.id));
    assert.equal(ids.size, schedule.invocations.length);
    assert.match(schedule.invocations[0].id, /^s01-c02-b01-r1$/);
    assert.match(schedule.invocations.at(-1).id, /^s33-c12-b02-r2$/);
    assert.deepEqual(schedule.invocations[0].targetOrdinals, [1, 2, 3]);
    assert.deepEqual(schedule.invocations.find(item => item.id === 's01-c08-b02-r1').targetOrdinals, [13]);
    assert.equal(schedule.invocations[0].expectedCaseCount, 3);
    assert.equal(schedule.invocations[0].expectedTargetCount, 3);
    assert.equal(schedule.invocations[0].expectedRowCount, 9);
});

test('uses runtime ordinals and SHAPE aliases, never lexical target order', () => {
    const bindings = runtimeBindingsFromFrozenCases();
    const cn3 = bindings.find(group => group.cn === 3);
    cn3.targets.reverse();
    const schedule = buildMetamorphicShapeSchedule(document, bindings);
    const call = schedule.invocations.find(item => item.id === 's01-c03-b01-r1');
    assert.deepEqual(call.targetOrdinals, [1, 2, 3, 4]);
    assert.equal(call.targetCodes.includes('fvOC-3'), true);
    assert.equal(call.targetQShapeCodes.includes('fac-vOC-3'), true);
});

test('recipe keys remain collision-free across duplicate ordinal namespaces', () => {
    const main = recipeCompositeKey('main_positive', 1, 'canonical');
    const supplement = recipeCompositeKey('adversarial_positive', 1, 'near-degenerate-assignment');
    assert.notEqual(main, supplement);
    assert.throws(() => recipeCompositeKey('main_positive', 1, 'x\u0000y'), /NUL/);
    assert.throws(() => recipeCompositeKey('main_positive\u0000x', 1, 'canonical'), /NUL/);
});

test('attempt paths are immutable and a reused attempt is rejected', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-schedule-'));
    try {
        const id = makeInvocationId(1, 2, 1, 1);
        const first = reserveAttemptPath(tempRoot, id, 1);
        assert.equal(first, makeAttemptPath(tempRoot, id, 1));
        assert.equal(makeCheckpointPath(first), path.join(first, 'checkpoint.json'));
        assert.throws(() => reserveAttemptPath(tempRoot, id, 1), error => error.code === 'ATTEMPT_PATH_EXISTS');
        assert.notEqual(reserveAttemptPath(tempRoot, id, 2), first);
        assert.deepEqual(parseInvocationId(id), {
            id,
            baseId: 's01-c02-b01',
            slot: 1,
            cn: 2,
            batch: 1,
            repetition: 1
        });
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('checkpoint parser distinguishes absent, complete, failed, and corrupt', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qshape-checkpoint-'));
    try {
        const absent = path.join(tempRoot, 'missing', 'checkpoint.json');
        assert.equal(parseCheckpoint(absent).state, 'absent');

        const completePath = path.join(tempRoot, 'attempt-01', 'checkpoint.json');
        fs.mkdirSync(path.dirname(completePath), { recursive: true });
        fs.writeFileSync(completePath, JSON.stringify({
            schema_version: 1,
            invocation_id: 's01-c02-b01-r1',
            attempt_number: 1,
            status: 'complete',
            row_count: 9
        }));
        assert.equal(parseCheckpoint(completePath).state, 'complete');

        const failedPath = path.join(tempRoot, 'attempt-02', 'checkpoint.json');
        fs.mkdirSync(path.dirname(failedPath), { recursive: true });
        fs.writeFileSync(failedPath, JSON.stringify({
            schema_version: 1,
            invocation_id: 's01-c02-b01-r1',
            attempt_number: 2,
            status: 'failed',
            failure: { code: 'SHAPE_EXIT_NONZERO' }
        }));
        assert.equal(parseCheckpoint(failedPath).state, 'failed');

        const abandoned = {
            schema_version: 1,
            invocation_id: 's01-c02-b01-r1',
            attempt_number: 3,
            status: 'abandoned',
            reason: 'interrupted_before_checkpoint',
            evidence: 'retained partial evidence; never used as a completed result',
            retained_files: []
        };
        assert.equal(parseCheckpoint(abandoned, {
            invocationId: 's01-c02-b01-r1', attemptNumber: 3
        }).state, 'abandoned');
        for (const statusDocument of [
            { schema_version: 1, invocation_id: 's01-c02-b01-r1', status: 'complete' },
            { schema_version: 1, invocation_id: 's01-c02-b01-r1', status: 'failed', failure: { code: 'x' } },
            { ...abandoned, attempt_number: undefined }
        ]) {
            assert.equal(parseCheckpoint(statusDocument, {
                invocationId: 's01-c02-b01-r1', attemptNumber: 3
            }).state, 'corrupt');
        }

        const corruptPath = path.join(tempRoot, 'attempt-03', 'checkpoint.json');
        fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
        fs.writeFileSync(corruptPath, '{not-json');
        assert.equal(parseCheckpoint(corruptPath).state, 'corrupt');
        assert.equal(parseCheckpoint({ status: 'pending' }).state, 'corrupt');
        assert.equal(parseCheckpoint(null).state, 'absent');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

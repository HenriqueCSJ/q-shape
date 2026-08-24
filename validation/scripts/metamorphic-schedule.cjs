'use strict';

/*
 * Deterministic scheduling primitives for the metamorphic SHAPE campaign.
 *
 * This module deliberately does not execute SHAPE and does not write a
 * campaign package.  It binds the frozen generated cases to a runtime SHAPE
 * reference listing, partitions that listing at the 12-target control limit,
 * and returns an immutable schedule for the runner to consume.
 */

const fs = require('node:fs');
const path = require('node:path');

const MAX_TARGETS_PER_BATCH = 12;
const REPETITIONS = 2;
const MAIN_RECIPE_COUNT = 30;
const SUPPLEMENT_RECIPE_COUNT = 3;
const TOTAL_RECIPE_COUNT = MAIN_RECIPE_COUNT + SUPPLEMENT_RECIPE_COUNT;
const EXPECTED_REFERENCE_COUNT = 87;
const EXPECTED_CASE_COUNT = 2871;
const EXPECTED_TARGET_EVALUATIONS_PER_REPETITION = 28545;
const EXPECTED_SHAPE_VALUE_COUNT = EXPECTED_TARGET_EVALUATIONS_PER_REPETITION * REPETITIONS;
const CHECKPOINT_SCHEMA_VERSION = 1;
const ATTEMPT_NAME_PATTERN = /^attempt-(\d{2,})$/;
const INVOCATION_ID_PATTERN = /^s(\d{2})-c(\d{2})-b(\d{2})-r([1-9]\d*)$/;
const INVOCATION_BASE_ID_PATTERN = /^s(\d{2})-c(\d{2})-b(\d{2})$/;

const MAIN_FAMILY = 'main_positive';
const SUPPLEMENT_FAMILY = 'adversarial_positive';

const EXPECTED_REFERENCE_COUNTS = Object.freeze({
    2: 3,
    3: 4,
    4: 4,
    5: 5,
    6: 5,
    7: 7,
    8: 13,
    9: 13,
    10: 13,
    11: 7,
    12: 13
});

function fail(message) {
    throw new Error(message);
}

function integer(value, label, { min = 1 } = {}) {
    if (!Number.isInteger(value) || value < min) fail(`${label} must be an integer >= ${min}`);
    return value;
}

function cleanText(value, label) {
    if (typeof value !== 'string' || value.length === 0 || value.includes('\u0000')) {
        fail(`${label} must be a non-empty string without NUL`);
    }
    return value;
}

function deepFreeze(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
}

function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function valueOf(record, camel, snake = camel) {
    if (record && record[camel] !== undefined) return record[camel];
    return record ? record[snake] : undefined;
}

function normalizeFamily(value) {
    if (value === MAIN_FAMILY || value === 'main' || value === 'main_positive') return MAIN_FAMILY;
    if (value === SUPPLEMENT_FAMILY || value === 'adversarial' || value === 'supplement' || value === 'adversarial_positive') {
        return SUPPLEMENT_FAMILY;
    }
    return value;
}

/**
 * Recipe identity is deliberately a composite.  Recipe IDs are not a safe
 * identity on their own because the main and supplement registries each have
 * their own ordinal namespace.  NUL is used as a field separator after
 * rejecting it from user-controlled fields, so this key is collision-free.
 */
function recipeCompositeKey(family, recipeIndex, recipeId) {
    const normalizedFamily = normalizeFamily(cleanText(family, 'recipe family'));
    const index = integer(recipeIndex, 'recipe index');
    const id = cleanText(recipeId, 'recipe id');
    return `${normalizedFamily}\u0000${index}\u0000${id}`;
}

function recipeKeyFromCase(item) {
    const family = normalizeFamily(
        valueOf(item, 'family') || valueOf(item, 'stratum') || valueOf(item, 'recipeFamily')
    );
    const index = valueOf(item, 'recipeIndex', 'recipe_index');
    const id = valueOf(item, 'recipeId', 'recipe_id');
    return recipeCompositeKey(family, index, id);
}

function parseRecipeKey(key) {
    cleanText(key, 'recipe key');
    const fields = key.split('\u0000');
    if (fields.length !== 3) fail(`Invalid composite recipe key: ${JSON.stringify(key)}`);
    const [family, index, id] = fields;
    return Object.freeze({ family, recipeIndex: integer(Number(index), 'recipe index'), recipeId: id, key });
}

function recipeRegistryEntries(document) {
    const main = Array.isArray(document?.main_recipe_registry)
        ? document.main_recipe_registry : null;
    const supplement = Array.isArray(document?.adversarial_positive_recipe_registry)
        ? document.adversarial_positive_recipe_registry : null;
    if (!main && !supplement) return null;

    const entries = [];
    const append = (registry, family, slotOffset) => {
        if (!registry) return;
        registry.forEach((entry, offset) => {
            const recipeId = valueOf(entry, 'id', 'recipe_id');
            const recipeIndex = valueOf(entry, 'recipeIndex', 'recipe_index') ?? offset + 1;
            const key = recipeCompositeKey(family, recipeIndex, recipeId);
            entries.push({
                family,
                recipeIndex,
                recipeId,
                key,
                slot: slotOffset + recipeIndex,
                registry: clone(entry)
            });
        });
    };
    append(main, MAIN_FAMILY, 0);
    append(supplement, SUPPLEMENT_FAMILY, MAIN_RECIPE_COUNT);
    return entries;
}

function deriveRecipeEntries(document, cases) {
    const registered = recipeRegistryEntries(document);
    if (registered) return registered;
    const unique = new Map();
    for (const item of cases) {
        const family = normalizeFamily(valueOf(item, 'family') || valueOf(item, 'stratum'));
        const recipeIndex = valueOf(item, 'recipeIndex', 'recipe_index');
        const recipeId = valueOf(item, 'recipeId', 'recipe_id');
        const key = recipeCompositeKey(family, recipeIndex, recipeId);
        if (!unique.has(key)) unique.set(key, { family, recipeIndex, recipeId, key });
    }
    return [...unique.values()].sort((a, b) =>
        (a.family === b.family ? 0 : a.family === MAIN_FAMILY ? -1 : 1) ||
        a.recipeIndex - b.recipeIndex || a.recipeId.localeCompare(b.recipeId)
    ).map((entry, offset) => ({ ...entry, slot: offset + 1, registry: null }));
}

function buildRecipeSlots(documentOrCases) {
    const document = Array.isArray(documentOrCases) ? null : documentOrCases;
    const cases = Array.isArray(documentOrCases) ? documentOrCases : document?.cases;
    if (!Array.isArray(cases)) fail('Frozen metamorphic cases must be an array');
    const entries = deriveRecipeEntries(document, cases);
    if (entries.length !== TOTAL_RECIPE_COUNT) {
        fail(`Recipe census is ${entries.length}; expected ${TOTAL_RECIPE_COUNT}`);
    }
    const keys = new Set();
    const slots = entries.map((entry, offset) => {
        const slot = entry.slot ?? offset + 1;
        if (slot !== offset + 1) fail('Recipe registries do not define contiguous global slots');
        if (keys.has(entry.key)) fail(`Duplicate composite recipe key: ${JSON.stringify(entry.key)}`);
        keys.add(entry.key);
        if (entry.family === MAIN_FAMILY && entry.recipeIndex > MAIN_RECIPE_COUNT) {
            fail(`Main recipe index ${entry.recipeIndex} exceeds ${MAIN_RECIPE_COUNT}`);
        }
        if (entry.family === SUPPLEMENT_FAMILY && entry.recipeIndex > SUPPLEMENT_RECIPE_COUNT) {
            fail(`Supplement recipe index ${entry.recipeIndex} exceeds ${SUPPLEMENT_RECIPE_COUNT}`);
        }
        return deepFreeze({
            family: entry.family,
            recipeIndex: entry.recipeIndex,
            recipeId: entry.recipeId,
            key: entry.key,
            recipeKey: entry.key,
            slot,
            slotId: `s${String(slot).padStart(2, '0')}`,
            registry: entry.registry
        });
    });
    if (slots.filter(item => item.family === MAIN_FAMILY).length !== MAIN_RECIPE_COUNT ||
        slots.filter(item => item.family === SUPPLEMENT_FAMILY).length !== SUPPLEMENT_RECIPE_COUNT) {
        fail('Recipe family census does not match 30 main + 3 supplement recipes');
    }
    return Object.freeze(slots);
}

function normalizeCases(documentOrCases) {
    const cases = Array.isArray(documentOrCases) ? documentOrCases : documentOrCases?.cases;
    if (!Array.isArray(cases)) fail('Frozen metamorphic cases must be an array');
    return cases.map((item, offset) => {
        const caseId = valueOf(item, 'caseId', 'case_id');
        const cn = valueOf(item, 'cn');
        const parentReferenceCode = valueOf(item, 'parentReferenceCode', 'parent_reference_code');
        const parentReferenceIndex = valueOf(item, 'parentReferenceIndex', 'parent_reference_index');
        const recipeIndex = valueOf(item, 'recipeIndex', 'recipe_index');
        const recipeId = valueOf(item, 'recipeId', 'recipe_id');
        const family = normalizeFamily(valueOf(item, 'family') || valueOf(item, 'stratum'));
        cleanText(caseId, `case[${offset}] case id`);
        integer(cn, `case[${offset}] CN`, { min: 2 });
        cleanText(parentReferenceCode, `${caseId} parent reference code`);
        integer(parentReferenceIndex, `${caseId} parent reference index`);
        const key = recipeCompositeKey(family, recipeIndex, recipeId);
        return {
            source: item,
            caseId,
            structureId: valueOf(item, 'structureId', 'structure_id') ?? null,
            family,
            recipeIndex,
            recipeId,
            recipeKey: key,
            cn,
            parentReferenceCode,
            parentReferenceIndex
        };
    });
}

function targetCode(target) {
    return valueOf(target, 'qshapeCode', 'qshape_code') ?? valueOf(target, 'code');
}

function targetOrdinal(target) {
    return valueOf(target, 'shapeIndex', 'shape_index') ??
        valueOf(target, 'index') ?? valueOf(target, 'ordinal');
}

function targetShapeCode(target) {
    return valueOf(target, 'shapeCode', 'shape_code') ?? targetCode(target);
}

function normalizeRuntimeBindings(runtimeBindings) {
    let groups;
    if (Array.isArray(runtimeBindings)) groups = runtimeBindings;
    else if (Array.isArray(runtimeBindings?.by_cn)) groups = runtimeBindings.by_cn;
    else if (Array.isArray(runtimeBindings?.byCn)) groups = runtimeBindings.byCn;
    else if (runtimeBindings && typeof runtimeBindings === 'object') {
        groups = Object.entries(runtimeBindings).map(([cn, targets]) => ({ cn: Number(cn), targets }));
    } else fail('Runtime SHAPE reference bindings are required');

    const byCn = new Map();
    for (const group of groups) {
        const cn = integer(Number(valueOf(group, 'cn')), 'runtime binding CN', { min: 2 });
        const targets = valueOf(group, 'targets') ?? valueOf(group, 'references');
        if (!Array.isArray(targets) || targets.length === 0) fail(`Runtime CN=${cn} targets are missing`);
        if (byCn.has(cn)) fail(`Duplicate runtime binding CN=${cn}`);
        const normalized = targets.map((target, offset) => {
            const code = targetCode(target);
            const shapeCode = targetShapeCode(target);
            const ordinal = targetOrdinal(target);
            cleanText(code, `runtime CN=${cn} target code`);
            cleanText(shapeCode, `runtime CN=${cn} SHAPE target code`);
            integer(Number(ordinal), `runtime CN=${cn} target ordinal`);
            return { source: target, code, shapeCode, ordinal: Number(ordinal), offset };
        }).sort((a, b) => a.ordinal - b.ordinal);
        const seenQShapeCode = new Set();
        const seenShapeCode = new Set();
        const seenOrdinal = new Set();
        normalized.forEach((target, offset) => {
            if (seenQShapeCode.has(target.code)) {
                fail(`Duplicate runtime target code in CN=${cn}: ${target.code}`);
            }
            if (seenShapeCode.has(target.shapeCode)) {
                fail(`Duplicate runtime SHAPE target code in CN=${cn}: ${target.shapeCode}`);
            }
            if (seenOrdinal.has(target.ordinal)) fail(`Duplicate runtime target ordinal in CN=${cn}: ${target.ordinal}`);
            seenQShapeCode.add(target.code);
            seenShapeCode.add(target.shapeCode);
            seenOrdinal.add(target.ordinal);
            if (target.ordinal !== offset + 1) {
                fail(`Runtime CN=${cn} target ordinals must be contiguous 1..N`);
            }
        });
        byCn.set(cn, Object.freeze({
            cn,
            count: normalized.length,
            targets: Object.freeze(normalized.map(target => deepFreeze({
                ...clone(target.source),
                code: target.code,
                qshapeCode: target.code,
                shapeCode: target.shapeCode,
                ordinal: target.ordinal,
                shapeIndex: target.ordinal,
                qshapeIndex: target.ordinal
            })))
        }));
    }
    return byCn;
}

function chunk(values, size) {
    const result = [];
    for (let offset = 0; offset < values.length; offset += size) result.push(values.slice(offset, offset + size));
    return result;
}

function makeInvocationBaseId(slot, cn, batch) {
    integer(slot, 'recipe slot');
    integer(cn, 'CN', { min: 2 });
    integer(batch, 'target batch');
    if (slot > 99 || cn > 99 || batch > 99) fail('Invocation ID fields must fit two digits');
    return `s${String(slot).padStart(2, '0')}-c${String(cn).padStart(2, '0')}-b${String(batch).padStart(2, '0')}`;
}

function makeInvocationId(slot, cn, batch, repetition) {
    integer(repetition, 'repetition');
    return `${makeInvocationBaseId(slot, cn, batch)}-r${repetition}`;
}

function parseInvocationId(id) {
    cleanText(id, 'invocation id');
    let match = id.match(INVOCATION_ID_PATTERN);
    if (match) {
        return Object.freeze({
            id,
            baseId: id.slice(0, id.lastIndexOf('-r')),
            slot: Number(match[1]),
            cn: Number(match[2]),
            batch: Number(match[3]),
            repetition: Number(match[4])
        });
    }
    match = id.match(INVOCATION_BASE_ID_PATTERN);
    if (match) {
        return Object.freeze({
            id,
            baseId: id,
            slot: Number(match[1]),
            cn: Number(match[2]),
            batch: Number(match[3]),
            repetition: null
        });
    }
    fail(`Invalid invocation ID: ${id}`);
}

function normalizeScheduleArgs(documentOrCases, runtimeBindings, options) {
    const document = Array.isArray(documentOrCases) ? null : documentOrCases;
    const cases = Array.isArray(documentOrCases) ? documentOrCases : document?.cases;
    if (!Array.isArray(cases)) fail('Frozen metamorphic cases must be an array');
    let bindings = runtimeBindings;
    let opts = options || {};
    if (runtimeBindings && !Array.isArray(runtimeBindings) &&
        !Array.isArray(runtimeBindings.by_cn) && !Array.isArray(runtimeBindings.byCn) &&
        (runtimeBindings.runtimeBindings || runtimeBindings.bindings || runtimeBindings.options)) {
        bindings = runtimeBindings.runtimeBindings || runtimeBindings.bindings;
        opts = { ...(runtimeBindings.options || {}), ...runtimeBindings };
        delete opts.runtimeBindings;
        delete opts.bindings;
        delete opts.options;
    }
    return { document, cases, bindings, options: opts };
}

function buildMetamorphicShapeSchedule(documentOrCases, runtimeBindings, options = {}) {
    const args = normalizeScheduleArgs(documentOrCases, runtimeBindings, options);
    const document = args.document;
    const cases = normalizeCases(args.cases);
    const maxTargetsPerBatch = args.options.maxTargetsPerBatch ?? MAX_TARGETS_PER_BATCH;
    const repetitions = args.options.repetitions ?? REPETITIONS;
    integer(maxTargetsPerBatch, 'maximum targets per batch');
    integer(repetitions, 'repetitions');
    if (maxTargetsPerBatch > MAX_TARGETS_PER_BATCH) fail(`SHAPE control limit cannot exceed ${MAX_TARGETS_PER_BATCH}`);

    const slots = buildRecipeSlots(document || args.cases);
    const bindings = normalizeRuntimeBindings(args.bindings);
    if (cases.length !== EXPECTED_CASE_COUNT && args.options.requireFrozenCensus !== false) {
        fail(`Case census is ${cases.length}; expected ${EXPECTED_CASE_COUNT}`);
    }
    const cnValues = [...bindings.keys()].sort((a, b) => a - b);
    if (args.options.requireFrozenCensus !== false) {
        if (cnValues.length !== Object.keys(EXPECTED_REFERENCE_COUNTS).length ||
            cnValues.some(cn => EXPECTED_REFERENCE_COUNTS[cn] !== bindings.get(cn).count)) {
            fail('Runtime reference census does not match frozen 87-reference inventory');
        }
    }
    const caseIds = new Set();
    for (const item of cases) {
        if (caseIds.has(item.caseId)) fail(`Duplicate case ID: ${item.caseId}`);
        caseIds.add(item.caseId);
    }

    const baseInvocations = [];
    const invocations = [];
    const usedInvocationIds = new Set();
    let baseValueCount = 0;

    for (const slot of slots) {
        const recipeCases = cases.filter(item => item.recipeKey === slot.key);
        if (args.options.requireFrozenCensus !== false && recipeCases.length !== EXPECTED_REFERENCE_COUNT) {
            fail(`Recipe ${slot.key} has ${recipeCases.length} cases; expected ${EXPECTED_REFERENCE_COUNT}`);
        }
        for (const cn of cnValues) {
            const group = bindings.get(cn);
            const cnCases = recipeCases.filter(item => item.cn === cn)
                .sort((a, b) => a.parentReferenceIndex - b.parentReferenceIndex);
            if (cnCases.length !== group.count) {
                fail(`Recipe ${slot.key} CN=${cn} has ${cnCases.length} cases; expected ${group.count}`);
            }
            const codes = new Set();
            for (const item of cnCases) {
                if (codes.has(item.parentReferenceCode)) fail(`Duplicate parent target for ${item.caseId}`);
                codes.add(item.parentReferenceCode);
            }
            const expectedCodes = group.targets.map(target => target.code);
            if (codes.size !== expectedCodes.length || expectedCodes.some(code => !codes.has(code))) {
                fail(`Recipe ${slot.key} CN=${cn} cases do not cover runtime target codes exactly`);
            }
            const targetBatches = chunk(group.targets, maxTargetsPerBatch);
            for (let batchOffset = 0; batchOffset < targetBatches.length; batchOffset++) {
                const batchNumber = batchOffset + 1;
                const targetBatch = targetBatches[batchOffset];
                const baseId = makeInvocationBaseId(slot.slot, cn, batchNumber);
                const expectedRowCount = cnCases.length * targetBatch.length;
                const base = {
                    id: baseId,
                    baseId,
                    slot: slot.slot,
                    slotId: slot.slotId,
                    family: slot.family,
                    recipeIndex: slot.recipeIndex,
                    recipeId: slot.recipeId,
                    recipeKey: slot.key,
                    cn,
                    batch: batchNumber,
                    targetBatchIndex: batchNumber,
                    targetCodes: targetBatch.map(target => target.shapeCode),
                    targetQShapeCodes: targetBatch.map(target => target.code),
                    targetOrdinals: targetBatch.map(target => target.ordinal),
                    targets: targetBatch.map(target => clone(target)),
                    cases: cnCases.map(item => clone(item.source)),
                    caseIds: cnCases.map(item => item.caseId),
                    expectedCaseCount: cnCases.length,
                    expectedTargetCount: targetBatch.length,
                    expectedRowCount,
                    targetLimit: maxTargetsPerBatch,
                    attemptRelativePath: path.join(baseId, 'attempt-01')
                };
                // Keep both naming conventions at the schedule boundary: the
                // runner uses camelCase internally while manifests/checkpoints
                // use the protocol's snake_case vocabulary.
                base.recipe_key = slot.key;
                base.recipe_slot = slot.slot;
                base.target_codes = base.targetCodes;
                base.target_qshape_codes = base.targetQShapeCodes;
                base.target_ordinals = base.targetOrdinals;
                base.case_ids = base.caseIds;
                base.expected_case_count = base.expectedCaseCount;
                base.expected_target_count = base.expectedTargetCount;
                base.expected_row_count = base.expectedRowCount;
                base.target_batch_index = base.targetBatchIndex;
                base.attempt_relative_path = base.attemptRelativePath;
                deepFreeze(base);
                baseInvocations.push(base);
                baseValueCount += expectedRowCount;
                for (let repetition = 1; repetition <= repetitions; repetition++) {
                    const id = makeInvocationId(slot.slot, cn, batchNumber, repetition);
                    if (usedInvocationIds.has(id)) fail(`Invocation ID collision: ${id}`);
                    usedInvocationIds.add(id);
                    const invocation = {
                        ...base,
                        id,
                        repetition,
                        attemptRelativePath: path.join(id, 'attempt-01')
                    };
                    deepFreeze(invocation);
                    invocations.push(invocation);
                }
            }
        }
    }

    const expectedBaseInvocations = TOTAL_RECIPE_COUNT * 15;
    if (baseInvocations.length !== expectedBaseInvocations) {
        fail(`Base invocation census is ${baseInvocations.length}; expected ${expectedBaseInvocations}`);
    }
    if (baseValueCount !== EXPECTED_TARGET_EVALUATIONS_PER_REPETITION && args.options.requireFrozenCensus !== false) {
        fail(`Target-value census is ${baseValueCount}; expected ${EXPECTED_TARGET_EVALUATIONS_PER_REPETITION}`);
    }
    const attemptRoot = args.options.attemptRoot ?? null;
    const withAttemptPaths = invocation => {
        if (attemptRoot === null) return invocation;
        return deepFreeze({
            ...invocation,
            attemptPath: makeAttemptPath(attemptRoot, invocation.id, 1),
            checkpointPath: makeCheckpointPath(makeAttemptPath(attemptRoot, invocation.id, 1))
        });
    };
    const finalBaseInvocations = baseInvocations.map(withAttemptPaths);
    const finalInvocations = invocations.map(withAttemptPaths);
    const counts = {
        recipeCount: slots.length,
        mainRecipeCount: slots.filter(slot => slot.family === MAIN_FAMILY).length,
        supplementRecipeCount: slots.filter(slot => slot.family === SUPPLEMENT_FAMILY).length,
        referenceCount: bindings.size ? [...bindings.values()].reduce((sum, group) => sum + group.count, 0) : 0,
        caseCount: cases.length,
        baseInvocationCount: finalBaseInvocations.length,
        repetitions,
        invocationCount: finalInvocations.length,
        targetEvaluationsPerRepetition: baseValueCount,
        targetEvaluationsTotal: baseValueCount * repetitions,
        shapeValueCount: baseValueCount * repetitions
    };
    if (args.options.requireFrozenCensus !== false && counts.shapeValueCount !== EXPECTED_SHAPE_VALUE_COUNT) {
        fail(`SHAPE-value census is ${counts.shapeValueCount}; expected ${EXPECTED_SHAPE_VALUE_COUNT}`);
    }
    return deepFreeze({
        schemaVersion: 1,
        campaignId: document?.campaign_id ?? document?.campaignId ?? null,
        maxTargetsPerBatch,
        repetitions,
        recipes: slots,
        baseInvocations: finalBaseInvocations,
        invocations: finalInvocations,
        calls: finalInvocations,
        counts,
        contracts: {
            expectedBaseInvocations,
            expectedRepeatedInvocations: expectedBaseInvocations * repetitions,
            expectedShapeValues: EXPECTED_SHAPE_VALUE_COUNT
        }
    });
}

function makeAttemptPath(root, invocationId, attemptNumber = 1) {
    cleanText(root, 'attempt root');
    const parsed = parseInvocationId(invocationId);
    if (parsed.repetition === null) fail('Attempt paths require a repeated invocation ID');
    integer(attemptNumber, 'attempt number');
    const attemptName = `attempt-${String(attemptNumber).padStart(2, '0')}`;
    return path.resolve(root, invocationId, attemptName);
}

function makeCheckpointPath(attemptPath) {
    cleanText(attemptPath, 'attempt path');
    const name = path.basename(attemptPath);
    if (!ATTEMPT_NAME_PATTERN.test(name)) fail(`Not an immutable attempt path: ${attemptPath}`);
    return path.join(attemptPath, 'checkpoint.json');
}

function assertAttemptPathAvailable(attemptPath, fsModule = fs) {
    cleanText(attemptPath, 'attempt path');
    if (fsModule.existsSync(attemptPath)) {
        const error = new Error(`Attempt path already exists and is immutable: ${attemptPath}`);
        error.code = 'ATTEMPT_PATH_EXISTS';
        throw error;
    }
    return true;
}

/** Atomically creates an attempt directory; a second call can never reuse it. */
function reserveAttemptPath(root, invocationId, attemptNumber = 1, fsModule = fs) {
    const attemptPath = makeAttemptPath(root, invocationId, attemptNumber);
    const parent = path.dirname(attemptPath);
    fsModule.mkdirSync(parent, { recursive: true });
    try {
        fsModule.mkdirSync(attemptPath, { recursive: false });
    } catch (error) {
        if (error && (error.code === 'EEXIST' || fsModule.existsSync(attemptPath))) {
            const immutable = new Error(`Attempt path already exists and is immutable: ${attemptPath}`);
            immutable.code = 'ATTEMPT_PATH_EXISTS';
            throw immutable;
        }
        throw error;
    }
    return attemptPath;
}

function checkpointResult(state, extra = {}) {
    return Object.freeze({ state, ...extra });
}

function validateCheckpointDocument(document, expected = {}) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        return checkpointResult('corrupt', { reason: 'checkpoint is not an object', errors: ['not_object'] });
    }
    const errors = [];
    if (document.schema_version !== undefined && document.schema_version !== CHECKPOINT_SCHEMA_VERSION) {
        errors.push('unsupported_schema_version');
    }
    if (!['complete', 'failed', 'abandoned'].includes(document.status)) errors.push('invalid_status');
    if (expected.invocationId !== undefined && document.invocation_id !== expected.invocationId && document.invocationId !== expected.invocationId) {
        errors.push('invocation_mismatch');
    }
    if (expected.attemptNumber !== undefined) {
        const observed = document.attempt_number ?? document.attempt;
        if (!Number.isInteger(observed) || observed !== expected.attemptNumber) errors.push('attempt_mismatch');
    }
    if (document.status === 'complete' && document.failure !== undefined) errors.push('complete_has_failure');
    if (document.status === 'failed' && document.error === undefined && document.failure === undefined && document.reason === undefined) {
        errors.push('failed_without_reason');
    }
    if (document.status === 'abandoned') {
        if (document.reason !== 'interrupted_before_checkpoint') errors.push('abandoned_reason_invalid');
        if (document.evidence !== 'retained partial evidence; never used as a completed result') {
            errors.push('abandoned_evidence_invalid');
        }
        if (!Array.isArray(document.retained_files)) errors.push('abandoned_inventory_missing');
    }
    if (errors.length) return checkpointResult('corrupt', { reason: errors.join(', '), errors });
    return checkpointResult(document.status, { checkpoint: deepFreeze(clone(document)), errors: [] });
}

function parseCheckpoint(input, expected = {}) {
    if (typeof input === 'string' || Buffer.isBuffer(input)) {
        const checkpointPath = String(input);
        if (!fs.existsSync(checkpointPath)) return checkpointResult('absent', { path: checkpointPath, reason: 'missing' });
        let text;
        try {
            text = fs.readFileSync(checkpointPath, 'utf8');
        } catch (error) {
            return checkpointResult('corrupt', { path: checkpointPath, reason: `read_error:${error.code || error.message}` });
        }
        let document;
        try {
            document = JSON.parse(text);
        } catch (error) {
            return checkpointResult('corrupt', { path: checkpointPath, reason: 'invalid_json' });
        }
        const inferredAttempt = path.basename(path.dirname(checkpointPath)).match(ATTEMPT_NAME_PATTERN);
        const inferredExpected = inferredAttempt && expected.attemptNumber === undefined
            ? { ...expected, attemptNumber: Number(inferredAttempt[1]) } : expected;
        const result = validateCheckpointDocument(document, inferredExpected);
        return checkpointResult(result.state, { ...result, path: checkpointPath });
    }
    if (input === undefined || input === null) return checkpointResult('absent', { reason: 'missing' });
    const result = validateCheckpointDocument(input, expected);
    return result;
}

function readCheckpointState(input, expected = {}) { return parseCheckpoint(input, expected); }
function inspectCheckpoint(input, expected = {}) { return parseCheckpoint(input, expected); }

module.exports = {
    ATTEMPT_NAME_PATTERN,
    CHECKPOINT_SCHEMA_VERSION,
    EXPECTED_CASE_COUNT,
    EXPECTED_REFERENCE_COUNTS,
    EXPECTED_REFERENCE_COUNT,
    EXPECTED_SHAPE_VALUE_COUNT,
    EXPECTED_TARGET_EVALUATIONS_PER_REPETITION,
    INVOCATION_ID_PATTERN,
    MAIN_RECIPE_COUNT,
    MAX_TARGETS_PER_BATCH,
    REPETITIONS,
    SUPPLEMENT_RECIPE_COUNT,
    TOTAL_RECIPE_COUNT,
    assertAttemptPathAvailable,
    buildMetamorphicShapeSchedule,
    buildRecipeSlots,
    chunk,
    deepFreeze,
    inspectCheckpoint,
    makeAttemptPath,
    makeCheckpointPath,
    makeInvocationBaseId,
    makeInvocationId,
    normalizeRuntimeBindings,
    parseCheckpoint,
    parseInvocationId,
    parseRecipeKey,
    recipeCompositeKey,
    recipeKeyFromCase,
    readCheckpointState,
    reserveAttemptPath,
    validateCheckpointDocument,
    // Intentional compatibility aliases for the runner integration.
    buildShapeSchedule: buildMetamorphicShapeSchedule,
    createMetamorphicShapeSchedule: buildMetamorphicShapeSchedule,
    createSchedule: buildMetamorphicShapeSchedule,
    checkpointPath: makeCheckpointPath,
    getCheckpointState: parseCheckpoint
};

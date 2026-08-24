'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { generateMetamorphicCases } = require('../scripts/metamorphic-cases.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('pre-execution clarification freezes five Q streams and consensus semantics', () => {
    const protocol = fs.readFileSync(path.join(REPO_ROOT, 'validation', 'protocol.md'), 'utf8');
    for (const stream of [
        'q_primary_input_derived_r1',
        'q_primary_input_derived_r2',
        'q_explicit_seed_0',
        'q_explicit_seed_1364412496',
        'q_explicit_seed_4294967295'
    ]) {
        assert.match(protocol, new RegExp(`^${stream}$`, 'm'));
    }
    assert.match(protocol, /shape_consensus_token/);
    assert.match(protocol, /Primary\s+accuracy summaries use `q_primary_input_derived_r1` only/);
    assert.match(protocol, /Each explicit-seed stream is one preregistered execution/);
    assert.match(protocol, /No ranking is\s+recomputed on a subset/);
    assert.match(protocol, /`geometry_family` means the frozen `parent_reference_code`/);
});

test('frozen relational and ideal-self censuses are exact', () => {
    const document = generateMetamorphicCases(REPO_ROOT).document;
    const idealSelf = document.cases.filter(item =>
        item.recipe_id === 'canonical' || item.recipe_category === 'representation'
    );
    const representationRelations = document.cases.filter(item =>
        item.recipe_category === 'representation'
    );
    const twinRelations = document.cases.filter(item => item.recipe_id === 'distorted-twin');

    assert.equal(idealSelf.length, 609);
    assert.equal(representationRelations.length, 522);
    assert.equal(twinRelations.length, 87);

    const targetCounts = new Map();
    for (const item of document.cases.filter(item =>
        item.recipe_category === 'representation' || item.recipe_id === 'distorted-twin'
    )) {
        targetCounts.set(item.cn, document.cases.filter(candidate =>
            candidate.cn === item.cn && candidate.recipe_id === 'canonical'
        ).length);
    }
    const relationsPerStream = document.cases
        .filter(item => item.recipe_category === 'representation' || item.recipe_id === 'distorted-twin')
        .reduce((sum, item) => sum + targetCounts.get(item.cn), 0);
    assert.equal(relationsPerStream, 6055);
    assert.equal(relationsPerStream * 2, 12110);
    assert.equal(relationsPerStream * 3, 18165);
});

test('the frozen document has 2871 case IDs but 2870 serialized coordinate arrays', () => {
    const document = generateMetamorphicCases(REPO_ROOT).document;
    const groups = new Map();
    for (const item of document.cases) {
        const key = JSON.stringify(item.qshape_actual_ligand_tokens);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item.case_id);
    }
    assert.equal(document.cases.length, 2871);
    assert.equal(groups.size, 2870);
    const duplicates = [...groups.values()].filter(ids => ids.length > 1);
    assert.deepEqual(duplicates, [['meta-cn02-ref01-r04', 'meta-cn02-ref01-r30']]);
});

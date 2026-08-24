'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const verifier = require('../scripts/verify-direct-parity.cjs');

test('verifier is implementation-independent and uses no project parser or decimal dependency', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'scripts', 'verify-direct-parity.cjs'),
        'utf8'
    );
    assert.doesNotMatch(source, /require\(['"]\.\/direct-parity/);
    assert.doesNotMatch(source, /require\(['"]decimal\.js/);
});

test('BigInt decimal comparison is exact across exponents and trailing zeros', () => {
    assert.equal(verifier.compareDecimals(
        verifier.parseDecimal('1e-8'), verifier.parseDecimal('0.0000000100')
    ), 0);
    assert.equal(verifier.compareDecimals(
        verifier.parseDecimal('0.009999999999999999'), verifier.parseDecimal('0.01')
    ), -1);
    assert.equal(verifier.compareDecimals(
        verifier.absoluteDecimal(verifier.subtractDecimals(
            verifier.parseDecimal('31.37468'), verifier.parseDecimal('31.375')
        )),
        verifier.parseDecimal('0.000505')
    ), -1);
});

test('independent CSV parser preserves quoted commas, quotes, and embedded newlines', () => {
    const rows = verifier.parseCsv('a,b\n"x,y","line 1\nline ""2"""\n');
    assert.deepEqual(rows, [{ a: 'x,y', b: 'line 1\nline "2"' }]);
});

test('independent SHAPE parsers retain invalid tokens and fixed-width identifiers', () => {
    const out = verifier.parseShapeOut([
        'Structure     1    [F04]',
        ' T-4          Ideal structure    CShM =   31.37468',
        ' SP-4         Ideal structure    CShM =   Infinity'
    ].join('\n'));
    assert.equal(out[0].values[0].lexicallyValid, true);
    assert.equal(out[0].values[1].lexicallyValid, false);
    const tab = verifier.parseShapeTab([
        'Structure [ML4 ]          T-4         SP-4',
        ` ${'F04'.padEnd(15, ' ')},      31.375,       0.970`
    ].join('\n'));
    assert.equal(tab.structures[0].structureId, 'F04');
    assert.deepEqual(tab.targetCodes, ['T-4', 'SP-4']);
});

test('independent .dat parser enforces center index and fixed 15-decimal tokens', () => {
    const dat = [
        '$ Q-Shape direct parity validation, CN=2',
        '%fullout',
        '2 1',
        '1 3',
        'F02',
        'Fe  0.000000000000000 0.000000000000000 0.000000000000000',
        'C   1.000000000000000 0.000000000000000 0.000000000000000',
        'C   -1.000000000000000 0.000000000000000 0.000000000000000',
        ''
    ].join('\n');
    const parsed = verifier.parseShapeDat(dat, 2);
    assert.deepEqual(parsed.targetIndices, [1, 3]);
    assert.equal(parsed.structures[0].atoms.length, 3);
    assert.throws(() => verifier.parseShapeDat(dat.replace('2 1', '2 2'), 2),
        /center control/);
});

test('float64 verification distinguishes negative zero and exact round-trip tokens', () => {
    assert.equal(verifier.float64Hex(0), '0000000000000000');
    assert.equal(verifier.float64Hex(Number('-0')), '8000000000000000');
});

test('worker decimals must use the unique canonical binary64 round-trip spelling', () => {
    assert.equal(verifier.canonicalBinary64Token('0.010000000000000000'), 0.01);
    assert.equal(verifier.canonicalBinary64Token('1.0000000000000000e-8'), 1e-8);
    assert.equal(verifier.canonicalBinary64Token('0.020010000000000000'), 0.02001);
    assert.ok(Object.is(verifier.canonicalBinary64Token('-0'), -0));
    for (const alternative of ['0.01', '0.0100', '1e-8', '0.02001', '-0.0']) {
        assert.throws(() => verifier.canonicalBinary64Token(alternative), /canonical/);
    }
});

test('independent fixed-decimal rendering uses exact decimal half-up rounding', () => {
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('1.234565'), 5), '1.23457');
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('1.234564999'), 5), '1.23456');
    assert.equal(verifier.decimalToFixedHalfUp(verifier.parseDecimal('100'), 5), '100.00000');
});

test('verifier CLI classifies a missing package as invalid rather than an internal error', () => {
    const script = path.resolve(__dirname, '..', 'scripts', 'verify-direct-parity.cjs');
    const missing = path.resolve(__dirname, 'definitely-missing-package');
    const result = spawnSync(process.execPath, [script, missing], { encoding: 'utf8' });
    assert.equal(result.status, 3);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.verification_status, 'invalid');
    assert.match(receipt.error, /does not exist/);
});

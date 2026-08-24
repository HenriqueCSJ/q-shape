'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const core = require('../scripts/direct-parity-core.cjs');
const verifier = require('../scripts/verify-direct-parity.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('canonical inventory contains 87 references with the preregistered CN census', () => {
    const { referenceGeometries } = core.loadQShape(REPO_ROOT);
    const inventory = core.buildReferenceInventory(referenceGeometries);
    assert.equal(inventory.reduce((sum, item) => sum + item.count, 0), 87);
    assert.deepEqual(
        Object.fromEntries(inventory.map(item => [item.cn, item.count])),
        core.EXPECTED_REFERENCE_COUNTS
    );
});

test('canonical Q-Shape reference fingerprint binds all 87 names, coordinates, and bits', () => {
    const { referenceGeometries } = core.loadQShape(REPO_ROOT);
    const inventory = core.buildReferenceInventory(referenceGeometries);
    const roundtrip = value => Object.is(value, -0) ? '-0' : value.toPrecision(17);
    const document = {
        by_cn: inventory.map(group => ({
            cn: group.cn,
            references: group.targets.map(target => ({
                qshape_index: target.index,
                qshape_code: target.code,
                qshape_name: target.name,
                qshape_center_index_zero_based: group.cn,
                qshape_reference_coordinate_fixed15_tokens: target.coordinates.map(point =>
                    point.map(core.formatCoordinate)
                ),
                qshape_reference_coordinate_roundtrip_tokens: target.coordinates.map(point =>
                    point.map(roundtrip)
                ),
                qshape_reference_coordinate_float64_hex: target.coordinates.map(point =>
                    point.map(core.float64Hex)
                )
            }))
        }))
    };
    const expected = '33e90f101fdc784a5de9c278dcc6d802390986575d7d7b1cb52c475110be1a71';
    assert.equal(verifier.qshapeReferenceInventoryFingerprint(document), expected);
    document.by_cn[0].references[0].qshape_reference_coordinate_float64_hex[0][0] =
        '0000000000000000';
    assert.notEqual(verifier.qshapeReferenceInventoryFingerprint(document), expected);
});

test('all ideal and fixture cases feed identical canonical coordinate tokens to both programs', () => {
    const { referenceGeometries } = core.loadQShape(REPO_ROOT);
    const inventory = core.buildReferenceInventory(referenceGeometries);
    const cases = [
        ...core.buildIdealCases(inventory),
        ...core.buildFixtureCases(REPO_ROOT, inventory)
    ];
    assert.equal(cases.length, 98);
    for (const item of cases) {
        assert.equal(item.shapeAtoms.length, item.cn + 1);
        assert.deepEqual(
            item.shapeAtoms[0].tokens,
            ['0.000000000000000', '0.000000000000000', '0.000000000000000']
        );
        assert.deepEqual(
            item.actualLigands,
            item.shapeAtoms.slice(1).map(atom => atom.tokens.map(Number)),
            item.caseId
        );
    }
});

test('the SHAPE code mapping contains exactly the three audited aliases', () => {
    assert.deepEqual(core.SHAPE_CODE_ALIASES, {
        '3:fac-vOC-3': 'fvOC-3',
        '3:mer-vOC-3': 'mvOC-3',
        '8:JBTP-8': 'JBTPR-8'
    });
    assert.equal(core.expectedShapeCode(4, 'SP-4'), 'SP-4');
});

test('reference binding validates both explicit code and ordinal', () => {
    const item = {
        cn: 3,
        count: 4,
        targets: [
            { index: 1, code: 'TP-3' },
            { index: 2, code: 'vT-3' },
            { index: 3, code: 'fac-vOC-3' },
            { index: 4, code: 'mer-vOC-3' }
        ]
    };
    core.bindShapeReferenceListing(item, {
        cn: 3,
        references: [
            { index: 1, shapeCode: 'TP-3', pointGroup: 'D3h', description: 'x' },
            { index: 2, shapeCode: 'vT-3', pointGroup: 'C2v', description: 'x' },
            { index: 3, shapeCode: 'fvOC-3', pointGroup: 'C3v', description: 'x' },
            { index: 4, shapeCode: 'mvOC-3', pointGroup: 'C2v', description: 'x' }
        ]
    });
    assert.deepEqual(item.targets.map(target => target.shapeCode), [
        'TP-3', 'vT-3', 'fvOC-3', 'mvOC-3'
    ]);
    assert.throws(() => core.bindShapeReferenceListing({
        cn: 3,
        count: 4,
        targets: item.targets.map(target => ({ index: target.index, code: target.code }))
    }, {
        cn: 3,
        references: [
            { index: 1, shapeCode: 'TP-3' },
            { index: 2, shapeCode: 'fvOC-3' },
            { index: 3, shapeCode: 'vT-3' },
            { index: 4, shapeCode: 'mvOC-3' }
        ]
    }), /Reference-order mismatch/);
});

test('strict SHAPE .out parser retains invalid lexical tokens for the failure ledger', () => {
    const parsed = core.parseShapeOut([
        'Structure     1    [F04]',
        ' T-4          Ideal structure    CShM =   31.37468',
        ' SP-4         Ideal structure    CShM =   Infinity',
        'Structure     2    [I0401]',
        ' T-4          Ideal structure    CShM =    0.00000',
        ' SP-4         Ideal structure    CShM =   -0.00001'
    ].join('\n'));
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].values[0].lexicallyValid, true);
    assert.equal(parsed[0].values[1].valueToken, 'Infinity');
    assert.equal(parsed[0].values[1].lexicallyValid, false);
    assert.equal(parsed[1].values[1].lexicallyValid, false);
    assert.throws(() => core.parseShapeOut([
        'Structure 1 [F04]',
        ' T-4 Ideal structure CShM = 1.00000',
        ' T-4 Ideal structure CShM = 1.00000'
    ].join('\n')), /Duplicate SHAPE \.out target/);
});

test('SHAPE .tab parser handles the fixed-width structure field and invalid tokens', () => {
    const tab = [
        'Structure [ML4 ]          T-4         SP-4',
        ` ${'F04'.padEnd(15, ' ')},      31.375,       0.970`,
        ` ${'I0401'.padEnd(15, ' ')},       0.000,         NaN`
    ].join('\n');
    const parsed = core.parseShapeTab(tab);
    assert.deepEqual(parsed.targetCodes, ['T-4', 'SP-4']);
    assert.equal(parsed.structures[0].structureId, 'F04');
    assert.equal(parsed.structures[0].values[0].valueToken, '31.375');
    assert.equal(parsed.structures[1].values[1].lexicallyValid, false);
});

test('SHAPE control builder validates atom counts and uses bound SHAPE indices', () => {
    const atoms = [
        { element: 'Fe', tokens: ['0.000000000000000', '0.000000000000000', '0.000000000000000'] },
        { element: 'C', tokens: ['1.000000000000000', '0.000000000000000', '0.000000000000000'] },
        { element: 'C', tokens: ['-1.000000000000000', '0.000000000000000', '0.000000000000000'] }
    ];
    const dat = core.buildShapeDat(2, [{ cn: 2, structureId: 'F02', shapeAtoms: atoms }], [
        { index: 99, shapeIndex: 1 },
        { index: 98, shapeIndex: 3 }
    ]);
    assert.match(dat, /\n2 1\n1 3\nF02\n/);
    assert.throws(() => core.buildShapeDat(2, [
        { cn: 2, structureId: 'F02', shapeAtoms: atoms.slice(0, 2) }
    ], [{ shapeIndex: 1 }]), /expected 3/);
});

test('float64 encoding distinguishes positive and negative zero', () => {
    assert.equal(core.float64Hex(0), '0000000000000000');
    assert.equal(core.float64Hex(-0), '8000000000000000');
});

test('WSL path command shell-quotes Windows paths without losing separators or Unicode', () => {
    const windowsPath = 'C:\\Users\\henri\\OneDrive\\Q²M³ project\\oracle\\raw';
    assert.equal(
        core.wslPathCommand(windowsPath),
        "wslpath -a 'C:\\Users\\henri\\OneDrive\\Q²M³ project\\oracle\\raw'"
    );
});

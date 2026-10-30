'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {loadQShape,expectedShapeCode}=require('../scripts/direct-parity-core.cjs');
const {referenceGeometries}=loadQShape(root);
const pinned=require('./fixtures/cosymlib-pinned-johnson.json');
test('four Johnson coordinates equal the pinned complete primary coordinate rows, including center',()=>{
    for(const [code,coords] of Object.entries(pinned.references)){
        const cn=Number(code.split('-').at(-1));
        const entry=Object.entries(referenceGeometries[cn]).find(([name])=>name.startsWith(code+' '));
        assert.ok(entry,code);
        assert.deepEqual(entry[1],coords,code);
        assert.equal(coords.length,cn+1);
    }
});
test('JSPC-10 uses J86; TIC-60 retains its saved-record name and SHAPE alias',()=>{
    assert.ok(referenceGeometries[10]['JSPC-10 (Sphenocorona, J86)']);
    assert.ok(!referenceGeometries[10]['JSPC-10 (Sphenocorona, J87)']);
    assert.ok(referenceGeometries[60]['TIC-60 (Truncated Icosahedron)']);
    assert.equal(expectedShapeCode(60,'TIC-60'),'TRIC-60');
});

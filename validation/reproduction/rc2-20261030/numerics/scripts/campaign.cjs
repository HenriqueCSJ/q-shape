'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.resolve(__dirname,'..'),REPO=process.env.QSHAPE_SOURCE?path.resolve(process.env.QSHAPE_SOURCE):path.resolve(ROOT,'../software');
const EXPECTED=process.env.QSHAPE_EXPECTED_COMMIT||'9c6a8397be05ad3580269c1b6734cdf5319d2d9b';
const mode=process.argv[2];if(!['bridge1','bridge2','robustness','reflection','self','high'].includes(mode))throw Error('Invalid mode');
const identity=require('./source-identity.cjs').sourceIdentity(REPO,{expected:EXPECTED,requireClean:true});
const core=require(path.join(REPO,'validation/scripts/direct-parity-core.cjs'));
console.log('Loading frozen production source',new Date().toISOString(),mode);
const {calculateShapeMeasure,referenceGeometries}=core.loadQShape(REPO),{capture}=require('./capture-result.cjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'inputs',n))),groups=read('current-targets.json');
// Refuse a stale exported library: every numerical target must equal current source.
for(const g of groups)for(const t of g.targets)if(JSON.stringify(t.coordinates)!==JSON.stringify(referenceGeometries[g.cn][t.name]))throw Error('Target/source mismatch '+t.code);
let cases,oracle=[];
if(mode.startsWith('bridge')){
    cases=read('bridge-cases.json').cases.map(c=>({caseId:c.case_id,cn:c.cn,stratum:c.stratum,actualLigands:c.qshape_actual_ligand_tokens.map(p=>p.map(Number))}));
    oracle=read('bridge-shape-oracle.json').results;
}else if(mode==='robustness'||mode==='reflection'){
    cases=read('robustness-cases.json').filter(c=>mode!=='reflection'||c.variant==='base').map(c=>({...c,caseId:c.id,actualLigands:c.relativeDonorTokens.map(p=>p.map((v,k)=>Number(v)*(mode==='reflection'&&k===0?-1:1)))}));
    oracle=read('robustness-shape-oracle.json').results;
}else if(mode==='self')cases=read('current-ideal-cases.json');
else cases=read('high-cn-cases.json').map(c=>({...c,actualLigands:c.relativeDonorTokens.map(p=>p.map(Number))}));
const om=new Map(oracle.map(r=>[r.caseId+'|'+r.targetCode,r]));
const out=path.join(process.env.QSHAPE_OUTPUT_ROOT?path.resolve(process.env.QSHAPE_OUTPUT_ROOT):path.join(ROOT,'final'),mode);if(fs.existsSync(out))throw Error('Refusing output reuse');fs.mkdirSync(out,{recursive:true});
const fd=fs.openSync(path.join(out,'results.jsonl'),'wx'),rows=[],failures=[],startAll=performance.now();
const metadata={...identity,mode,analysisMode:'default',seedPolicy:'input-derived',startedAt:new Date().toISOString(),node:process.version,nodeExecutable:process.execPath,os:os.version(),executionPolicy:'Serial fits within each process; low-CN campaigns may run concurrently. High-CN timing campaign is isolated from other Q-Shape campaigns.',oracleRerun:false};
fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');
for(const c of cases)for(const t of groups.find(g=>g.cn===c.cn).targets.filter(t=>!c.targetCode||c.targetCode===t.code)){
    const oracleRow=om.get(c.caseId+'|'+t.code);let row={caseId:c.caseId,baseId:c.baseId,variant:c.variant,cn:c.cn,stratum:c.stratum,targetCode:t.code,shapeToken:oracleRow?.valueToken};
    const started=performance.now();
    try{
        const result=calculateShapeMeasure(c.actualLigands,t.coordinates,'default');
        const captured=capture(result,c.actualLigands,t.coordinates);
        row={...row,status:'ok',valueToken:result.measure.toPrecision(17),valueHex:core.float64Hex(result.measure),runtimeMs:performance.now()-started,...captured.diagnostics};
        if(oracleRow)row.signedDifference=result.measure-Number(oracleRow.valueToken);
        for(const issue of captured.failures)failures.push({caseId:c.caseId,targetCode:t.code,kind:issue});
    }catch(error){row={...row,status:'failed',runtimeMs:performance.now()-started,error:error.stack};failures.push({caseId:c.caseId,targetCode:t.code,kind:'execution'});}
    rows.push(row);fs.writeSync(fd,JSON.stringify(row)+'\n');
    if(rows.length%25===0||mode==='high')console.log(mode,rows.length,'rows',((performance.now()-startAll)/1000).toFixed(1),'s',row.caseId,row.targetCode,row.valueToken);
}
fs.closeSync(fd);
const expected={bridge1:952,bridge2:952,robustness:1032,reflection:172,self:87,high:45}[mode];
if(rows.length!==expected)failures.push({kind:'coverage',expected,actual:rows.length});
const summary={...metadata,completedAt:new Date().toISOString(),expected,actual:rows.length,finite:rows.filter(r=>r.status==='ok').length,failures,totalMs:performance.now()-startAll};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...summary,results:rows},null,2)+'\n');
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
if(failures.length)process.exitCode=1;

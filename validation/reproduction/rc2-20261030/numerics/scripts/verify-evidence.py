"""Reconcile tidy calculation outputs to the retained production records."""
import pathlib,json,csv,math
ROOT=pathlib.Path(__file__).resolve().parent.parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
key=lambda r:r['caseId']+'|'+r['targetCode']
counts={'bridge1':952,'bridge2':952,'robustness':1032,'reflection':172,'self':87,'high':45}
records={}
for name,expected in counts.items():
    directory=ROOT/'final'/name
    if (directory/'results.json').exists():d=load(directory/'results.json');rows=d['results']
    else:
        d=load(directory/'summary.json')
        rows=[json.loads(line) for line in (directory/'results.jsonl').read_text().splitlines() if line.strip()]
    assert d['expected']==d['actual']==d['finite']==len(rows)==expected
    assert not d['failures']
    assert len({key(r) for r in rows})==expected
    assert all(r['status']=='ok' and math.isfinite(float(r['valueToken'])) and 0<=float(r['valueToken'])<=100 for r in rows)
    records[name]={key(r):r for r in rows}
for k,r in records['bridge1'].items():assert r['valueHex']==records['bridge2'][k]['valueHex']
oracle={key(r):r for r in load(ROOT/'inputs/bridge-shape-oracle.json')['results']}
with (ROOT/'final/signed-score-comparisons.csv').open(newline='') as f:csvrows=list(csv.DictReader(f))
assert len(csvrows)==952
for r in csvrows:
    actual=records['bridge1'][key(r)];shape=oracle[key(r)]
    assert r['qshapeValueToken']==actual['valueToken'] and r['shapeValueToken']==shape['valueToken']
    assert float(r['signedDifference'])==float(actual['valueToken'])-float(shape['valueToken'])
    assert (ROOT/'inputs'/shape['rawPath']).is_file()
with (ROOT/'final/cn-summary.csv').open(newline='') as f:cn=list(csv.DictReader(f))
assert len(cn)==11 and sum(int(r['comparisons']) for r in cn)==952
assert sum(int(r['aboveRoundingCount']) for r in cn)==9
for r in cn:assert int(r['comparisons'])==sum(int(row['cn'])==int(r['cn']) for row in csvrows)
robust_oracle=load(ROOT/'inputs/robustness-shape-oracle.json')['results']
assert len(robust_oracle)==1032
for r in robust_oracle:assert (ROOT/'inputs'/r['rawPath']).is_file()
shape=load(ROOT/'final/high-shape/results.json');assert shape['count']==45
assert all(r['status']=='ok' for r in shape['results'])
with (ROOT/'final/high-cn-results.csv').open(newline='') as f:high=list(csv.DictReader(f))
assert len(high)==45
for r in high:assert r['qshapeValueToken']==records['high'][key(r)]['valueToken']
audit=load(ROOT/'reference-superposition.json')
assert audit['count']==92 and all(r['status']=='compared' for r in audit['rows'])
assert max(r['current']['directRmsResidual'] for r in audit['rows'] if r['cn']<=12)<1e-12
result={'status':'data_consistency_checks_passed','scope':'Computational evidence reconciliation only; no figure/table/layout release approval.',
        'productionCounts':counts,'signedCsvRows':len(csvrows),'cnSummaryRows':len(cn),'highCnCsvRows':len(high),
        'bridgeOracleRawPathsResolved':952,'robustnessOracleRawPathsResolved':1032,'referenceSuperpositions':92}
(ROOT/'checks/evidence-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

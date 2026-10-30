"""Descriptive source-bound calculations; outputs are tidy evidence, not a publication table release."""
import json,pathlib,csv,statistics,sys,math,subprocess,os
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=pathlib.Path(os.environ.get('QSHAPE_OUTPUT_ROOT',ROOT/'final'));read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
write=lambda name,d:(OUT/name).write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
def csvout(name,rows):
    if not rows:return
    fields=list(dict.fromkeys(k for row in rows for k in row))
    with (OUT/name).open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
def timing(rows):
    a=sorted(r['runtimeMs'] for r in rows)
    return {'n':len(a),'medianMs':statistics.median(a),'p95Ms':float(np.percentile(a,95)),'maxMs':max(a),'sumMs':sum(a)}
def key(r):return r['caseId']+'|'+r['targetCode']
def campaign(name):
    directory=OUT/name
    if (directory/'results.json').exists():return read(directory/'results.json')
    result=read(directory/'summary.json')
    result['results']=[json.loads(line) for line in (directory/'results.jsonl').read_text().splitlines() if line.strip()]
    return result
bridge=campaign('bridge1');repeat=campaign('bridge2');robust=campaign('robustness')
reflection=campaign('reflection');ideal=campaign('self')
source=bridge['sourceCommit']
for d in [repeat,robust,reflection,ideal]:
    assert d['sourceCommit']==source
    assert d['actual']==d['expected']==d['finite'] and not d['failures']
assert bridge['actual']==bridge['expected']==bridge['finite']==952 and not bridge['failures']
oracles={key(r):r for r in read(ROOT/'inputs/bridge-shape-oracle.json')['results']}
rows=[]
for r in bridge['results']:
    oracle=oracles[key(r)];q=float(r['valueToken']);s=float(oracle['valueToken']);d=q-s
    rows.append({'caseId':r['caseId'],'cn':r['cn'],'stratum':r['stratum'],'targetCode':r['targetCode'],
        'qshapeValueToken':r['valueToken'],'shapeValueToken':oracle['valueToken'],'signedDifference':d,'absoluteDifference':abs(d),
        'aboveShapeRoundingHalfWidth':abs(d)>5e-6,'runtimeMs':r['runtimeMs'],'sourceCommit':source,'oracleRawPath':oracle['rawPath'],'oracleRawLine':oracle['rawLineNumber']})
csvout('signed-score-comparisons.csv',rows)
cns=[]
for cn in range(2,13):
    rr=[r for r in rows if r['cn']==cn];diff=[r['signedDifference'] for r in rr];ad=[abs(d) for d in diff]
    cns.append({'cn':cn,'inputEnvironments':len(set(r['caseId'] for r in rr)),'comparisons':len(rr),
        'historicalIdealInputComparisons':sum(r['stratum']=='ideal_reference' for r in rr),'fixedRegressionComparisons':sum(r['stratum']=='retained_fixture' for r in rr),
        'meanAbsoluteDifference':statistics.mean(ad),'medianAbsoluteDifference':statistics.median(ad),'maxAbsoluteDifference':max(ad),
        'meanSignedDifference':statistics.mean(diff),'minSignedDifference':min(diff),'maxSignedDifference':max(diff),
        'aboveRoundingCount':sum(a>5e-6 for a in ad),'positiveAboveRounding':sum(d>5e-6 for d in diff),'negativeAboveRounding':sum(d< -5e-6 for d in diff),
        **timing(rr)})
csvout('cn-summary.csv',cns)
second={key(r):r for r in repeat['results']};contract=['comparisonConvention','alignmentParity','branchScores','transformationMatrix','properRotationMatrix','matching','alignedCoords']
bitmismatch=[key(r) for r in bridge['results'] if r['valueHex']!=second[key(r)]['valueHex']]
contractmismatch=[key(r) for r in bridge['results'] if any(r.get(f)!=second[key(r)].get(f) for f in contract)]
rank=[]
for case in dict.fromkeys(r['caseId'] for r in rows):
    rr=[r for r in rows if r['caseId']==case];qs=sorted(rr,key=lambda r:float(r['qshapeValueToken']));ss=sorted(rr,key=lambda r:float(r['shapeValueToken']))
    rank.append({'caseId':case,'cn':rr[0]['cn'],'stratum':rr[0]['stratum'],'qshapeBest':qs[0]['targetCode'],'shapeBest':ss[0]['targetCode'],
        'exactBestMatch':qs[0]['targetCode']==ss[0]['targetCode'],'qshapeGap':float(qs[1]['qshapeValueToken'])-float(qs[0]['qshapeValueToken']),
        'shapeGap':float(ss[1]['shapeValueToken'])-float(ss[0]['shapeValueToken'])})
csvout('bridge-ranking.csv',rank)
rm={key(r):r for r in robust['results']};transforms=[]
for r in robust['results']:
    if r['variant']=='base':continue
    b=rm[r['baseId']+'_base|'+r['targetCode']]
    transforms.append({'caseId':r['caseId'],'baseId':r['baseId'],'variant':r['variant'],'cn':r['cn'],'targetCode':r['targetCode'],
        'baseValueToken':b['valueToken'],'valueToken':r['valueToken'],'absoluteRepresentationDifference':abs(float(r['valueToken'])-float(b['valueToken']))})
csvout('representation-differences.csv',transforms)
near=[]
for case in ['challenge_cn8_base','challenge_cn12_base']:
    rr=[r for r in robust['results'] if r['caseId']==case];qs=sorted(rr,key=lambda r:float(r['valueToken']));ss=sorted(rr,key=lambda r:float(r['shapeToken']))
    near.append({'caseId':case,'cn':qs[0]['cn'],'qshapeFirst':qs[0]['targetCode'],'qshapeSecond':qs[1]['targetCode'],
        'qshapeFirstToken':qs[0]['valueToken'],'qshapeSecondToken':qs[1]['valueToken'],'qshapeGap':float(qs[1]['valueToken'])-float(qs[0]['valueToken']),
        'shapeFirst':ss[0]['targetCode'],'shapeSecond':ss[1]['targetCode'],'shapeFirstToken':ss[0]['shapeToken'],'shapeSecondToken':ss[1]['shapeToken'],
        'shapeGap':float(ss[1]['shapeToken'])-float(ss[0]['shapeToken']),**timing(rr)})
csvout('near-degenerate-cases.csv',near)
reflect=[{'caseId':r['caseId'],'targetCode':r['targetCode'],'absoluteReflectionDifference':abs(float(r['valueToken'])-float(rm[key(r)]['valueToken']))} for r in reflection['results']]
csvout('reflection-differences.csv',reflect)
base=[r for r in robust['results'] if r['variant']=='base']
summary={'sourceCommit':source,'status':'working_evidence','bridge':{'comparisons':952,'inputEnvironments':98,'historicalIdealInputs':87,'fixedRegressionInputs':11,
    'repetitions':2,'bitwiseRepeatMismatches':bitmismatch,'contractRepeatMismatches':contractmismatch,'nearestLabelMatches':sum(r['exactBestMatch'] for r in rank),
    'meanAbsoluteDifference':statistics.mean(r['absoluteDifference'] for r in rows),'medianAbsoluteDifference':statistics.median(r['absoluteDifference'] for r in rows),
    'maxAbsoluteDifference':max(r['absoluteDifference'] for r in rows),'aboveRoundingCount':sum(r['aboveShapeRoundingHalfWidth'] for r in rows),
    'positiveAboveRounding':sum(r['signedDifference']>5e-6 for r in rows),'negativeAboveRounding':sum(r['signedDifference']< -5e-6 for r in rows),
    'allDifferencesBelow001':all(r['absoluteDifference']<0.01 for r in rows),'oracleRerun':False,'timing':timing(bridge['results']),
    'maxDirectResidualDifference':max(r['residualDifference'] for r in bridge['results']),
    'maxTransformReconstructionDifference':max(r['reconstructionDifference'] for r in bridge['results']),
    'maxOrthogonalityError':max(r['orthogonalityError'] for r in bridge['results'])},
    'robustness':{'baseEnvironments':18,'baseFits':len(base),'representationsPerEnvironment':6,'representedInputs':108,'targetExecutions':1032,'additionalRepresentationComparisons':len(transforms),
    'maxRepresentationDifference':max(r['absoluteRepresentationDifference'] for r in transforms),
    'maxAbsoluteShapeDifference':max(abs(r['signedDifference']) for r in robust['results']),
    'meanAbsoluteShapeDifferenceBaseFits':statistics.mean(abs(r['signedDifference']) for r in base),
    'baseTiming':timing(base),'allTiming':timing(robust['results']),'oracleRerun':False,
    'maxDirectResidualDifference':max(r['residualDifference'] for r in robust['results']),
    'maxTransformReconstructionDifference':max(r['reconstructionDifference'] for r in robust['results']),
    'interpretation':'Donor ordering and geometry-derived seeds remove some representation dependence, but do not define a full canonical orientation frame. These observations test these representations; they are not independent search-accuracy evidence.'},
    'currentIdealSelfRecovery':{'cases':87,'maxMeasure':max(float(r['valueToken']) for r in ideal['results']),'oracleComparison':False},
    'reflection':{'baseFits':172,'maxDifference':max(r['absoluteReflectionDifference'] for r in reflect),'interpretation':'Mirror equivalence convention check; swapping parity branches is not independent search accuracy evidence.'},
    'nearDegenerateCases':near,'cnSummary':cns,
    'timingPolicy':'Low-CN processes and engineering checks overlapped; these are observed execution timings, not standalone benchmark speed comparisons.',
    'inputPolicy':read(ROOT/'inputs/input-policy.json')}
write('summary.json',summary)
write('above-rounding-comparisons.json',[r for r in rows if r['aboveShapeRoundingHalfWidth']])
if (OUT/'high/summary.json').exists():
    high=campaign('high');assert high['actual']==high['finite']==45
    if high['sourceCommit']!=source:
        repo=pathlib.Path(os.environ.get('QSHAPE_SOURCE',ROOT.parent/'software'))
        if (repo/'.git').exists():
            files=subprocess.check_output(['git','diff','--name-only',source,high['sourceCommit']],cwd=repo,text=True).splitlines()
            assert files==['.zenodo.json'],files
        else:
            # The retained source pair was verified with Git during execution.
            # An extracted archive can recompute the statistics without claiming
            # that it has independently reobserved the historical Git diff.
            assert source=='7a995b93731f94ab7c0f4eeb72f18391f116cd7b' and high['sourceCommit']=='9c6a8397be05ad3580269c1b6734cdf5319d2d9b'
    hs={key(r):r for r in read(OUT/'high-shape/results.json')['results']};hi={r['caseId']:r for r in read(ROOT/'inputs/high-cn-cases.json')}
    refs={t['code']:t['coordinates'] for g in read(ROOT/'inputs/current-targets.json') for t in g['targets']};hr=[]
    norm=lambda a:(a-a.mean(0))/np.sqrt(np.sum((a-a.mean(0))**2)/len(a))
    for r in high['results']:
        c=hi[r['caseId']];h=hs[key(r)];p=norm(np.r_[np.array(c['relativeDonorTokens'],float),np.zeros((1,3))]);q=norm(np.array(refs[r['targetCode']]))
        mapping=c['inputToReferenceDonorPermutation']+[c['cn']];u,s,vt=np.linalg.svd(p.T@q[mapping]);rot=u@vt;overlap=float(np.sum((p@rot)*q[mapping])/len(p));scale=max(0,overlap)
        bound=float(100*np.sum((p@rot-scale*q[mapping])**2)/len(p));score=float(r['valueToken']);sh=float(h['valueToken'])
        hr.append({'caseId':r['caseId'],'baseId':c['baseId'],'cn':r['cn'],'targetCode':r['targetCode'],'distortionPercent':c['distortionPercent'],'variant':c['variant'],
            'qshapeValueToken':r['valueToken'],'shapeFixedPairingToken':h['valueToken'],'knownPairingFullPrecisionAttainableScore':bound,
            'qshapeMinusShapePrinted':score-sh,'qshapeMinusKnownPairingBound':score-bound,'aboveKnownBoundByMoreThan1eMinus6':score-bound>1e-6,
            'shapePrintedVsKnownPairingDifference':sh-bound,'runtimeMs':r['runtimeMs'],'sourceCommit':high['sourceCommit']})
    hbase={r['baseId']:r for r in hr if r['variant']==0}
    for r in hr:r['absoluteRepresentationDifference']=abs(float(r['qshapeValueToken'])-float(hbase[r['baseId']]['qshapeValueToken']))
    csvout('high-cn-results.csv',hr)
    summary['highCN']={'sourceCommit':high['sourceCommit'],'references':5,'baseGeometries':15,'targetExecutions':45,'knownPairingMissesAbove1eMinus6':sum(r['aboveKnownBoundByMoreThan1eMinus6'] for r in hr),
       'maxAboveKnownPairingBound':max(r['qshapeMinusKnownPairingBound'] for r in hr),'aboveKnownBoundByMoreThan1eMinus8':sum(r['qshapeMinusKnownPairingBound']>1e-8 for r in hr),
       'maxRepresentationDifference':max(r['absoluteRepresentationDifference'] for r in hr),
       'maxAbsoluteQShapeVsPrintedShapeDifference':max(abs(r['qshapeMinusShapePrinted']) for r in hr),
       'maxDirectResidualDifference':max(r['residualDifference'] for r in high['results']),
       'maxShapeFixedPairingRoundingDifference':max(abs(r['shapePrintedVsKnownPairingDifference']) for r in hr),'timing':timing(high['results']),
       'oracleRerun':True,'oracleMeaning':'SHAPE2.1 %fixperm against exact current-library custom reference. Known correspondence is an attainable bound, not a global minimum.',
       'status':'provisional','failures':high['failures']}
    write('summary.json',summary)
print(json.dumps({k:v for k,v in summary.items() if k not in ['cnSummary','inputPolicy']},indent=2))

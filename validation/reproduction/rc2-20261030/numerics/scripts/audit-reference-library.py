"""Center-constrained direct superposition; not a production-score comparison."""
import json,pathlib,itertools,csv,sys
import numpy as np
import yaml
from scipy.optimize import linear_sum_assignment
ROOT=pathlib.Path(__file__).resolve().parent.parent
refs=json.loads((ROOT/'inputs/current-library.json').read_text())['references']
primary=yaml.safe_load((ROOT/'primary/ideal_structures_center.yaml').read_text())
aliases={'fac-vOC-3':'fvOC-3','mer-vOC-3':'mvOC-3','JBTP-8':'JBTPR-8','TIC-60':'TRIC-60'}
old=json.loads((ROOT/'inputs/prior-cn2-12-references.json').read_text())
oldrefs={r['qshape_code']:np.array(r['qshape_reference_coordinate_roundtrip_tokens'],float) for g in old['by_cn'] for r in g['references']}
def normalize(p):
    q=p-p.mean(0);return q/np.sqrt(np.sum(q*q)/len(q))
def fit(a,b):
    u,s,vt=np.linalg.svd(a.T@b)
    return u@vt # O(3): mirror equivalence; center mapping remains fixed.
def match(a,b,r):
    _,p=linear_sum_assignment(-((a@r)[:-1]@b[:-1].T))
    return np.r_[p,len(a)-1]
def frame(a,b):
    x=a/np.linalg.norm(a);z=np.cross(x,b)
    if np.linalg.norm(z)<1e-8:return None
    z/=np.linalg.norm(z);return np.column_stack([x,np.cross(z,x),z])
def superpose(a,b):
    a=normalize(a);b=normalize(b);n=len(a)-1
    # One well-conditioned donor pair and all compatible target pair images.
    _,i,j=max((np.linalg.norm(np.cross(a[i],a[j])),i,j) for i in range(n) for j in range(i+1,n))
    f=frame(a[i],a[j]);best=None
    da=np.sort(np.linalg.norm(a[:,None]-a[None,:],axis=2),axis=1)
    db=np.sort(np.linalg.norm(b[:,None]-b[None,:],axis=2),axis=1)
    sig=np.max(np.abs(da[:,None,:]-db[None,:,:]),axis=2)
    candidates_i=[k for k in range(n) if sig[i,k]<max(1e-3,sig[i,:n].min()+1e-8)]
    candidates_j=[k for k in range(n) if sig[j,k]<max(1e-3,sig[j,:n].min()+1e-8)]
    rotations=[fit(a,b)]
    for k,l in itertools.product(candidates_i,candidates_j):
        if k==l:continue
        g=frame(b[k],b[l])
        if g is not None:
            rotations.extend([f@g.T,f@np.diag([1,1,-1])@g.T])
    for r in rotations:
        previous=None
        for _ in range(12):
            mapping=match(a,b,r);r=fit(a,b[mapping]);res=a@r-b[mapping]
            rms=float(np.sqrt(np.sum(res*res)/len(a)))
            if best is None or rms<best['directRmsResidual']:
                best={'directRmsResidual':rms,'maxPointResidual':float(np.max(np.linalg.norm(res,axis=1))),
                      'directResidualCShM':100*rms*rms,'mappingDonorsThenFixedCenter':mapping.tolist(),
                      'determinant':float(np.linalg.det(r)),'rotation':r.tolist()}
            if previous is not None and np.array_equal(previous,mapping):break
            previous=mapping
    return best
rows=[]
for cn,group in refs.items():
    for name,coords in group.items():
        code=name.split()[0];primarycode=code if code in primary else aliases.get(code,code)
        if primarycode not in primary:
            rows.append({'code':code,'cn':int(cn),'primaryCode':primarycode,'status':'missing_primary'});continue
        b=np.array(primary[primarycode],float);a=np.array(coords,float)
        new=superpose(a,b);prior=superpose(oldrefs[code],b) if code in oldrefs else None
        row={'code':code,'cn':int(cn),'primaryCode':primarycode,'status':'compared','current':new,'prior':prior}
        rows.append(row);print(code,new['directRmsResidual'],flush=True)
result={'method':'All-point centroid/RMS normalization; center last fixed; donor-only linear assignment; O(3) SVD superposition with one anchor pair and all distance-signature-compatible images. Direct coordinate residual avoids overlap subtraction cancellation.',
        'primary':json.loads((ROOT/'primary/source.json').read_text(encoding='utf-8-sig')),
        'count':len(rows),'rows':rows,'remainingAbove1eMinus6Rms':[r['code'] for r in rows if r.get('current',{}).get('directRmsResidual',0)>1e-6]}
(ROOT/'reference-superposition.json').write_text(json.dumps(result,indent=2)+'\n')
with (ROOT/'reference-superposition.csv').open('w',newline='') as f:
    fields=['code','cn','primaryCode','status','currentRmsResidual','priorRmsResidual','currentMaxPointResidual']
    w=csv.DictWriter(f,fields);w.writeheader()
    for r in rows:w.writerow({**{k:r[k] for k in fields[:4]},'currentRmsResidual':r.get('current',{}).get('directRmsResidual'),'priorRmsResidual':(r.get('prior') or {}).get('directRmsResidual'),'currentMaxPointResidual':r.get('current',{}).get('maxPointResidual')})
print('remaining > 1e-6:',result['remainingAbove1eMinus6Rms'])

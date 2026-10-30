"""SHAPE 2.1 fixed known pairing against exact current Q-Shape references."""
import json,pathlib,subprocess,time,re,shlex,os
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=pathlib.Path(os.environ.get('QSHAPE_SHAPE_OUTPUT',ROOT/'final/high-shape'));OUT.mkdir(parents=True,exist_ok=False)
groups=json.loads((ROOT/'inputs/current-targets.json').read_text())
targets={t['code']:t for g in groups for t in g['targets']}
cases=json.loads((ROOT/'inputs/high-cn-cases.json').read_text())
exe=os.environ.get('SHAPE_BIN','/home/henrique/SHAPE/SHAPE_2.1_linux_64/shape_2.1_linux64')
linux='/mnt/'+str(OUT)[0].lower()+str(OUT)[2:].replace('\\','/')
rows=[]
for case_index,c in enumerate(cases):
    t=targets[c['targetCode']];code=c['targetCode'];refcode='Q'+code
    reffile=OUT/(code+'.ref')
    if not reffile.exists():
        reffile.write_text('\n'.join([refcode,'Exact rc.2 reference; designated center last','C1',
            *[' '.join(format(v,'.17g') for v in p) for p in t['coordinates']],'']))
    stem=f'h{case_index:03d}';pairing=' '.join(str(i+1) for i in c['inputToReferenceDonorPermutation'])
    dat='\n'.join(['$ Bounded fixed-pairing control; not global minimization',f'%reference {code}.ref','%fullout','%fixperm 1',
        f"{c['cn']} 1",'0',pairing,'HIGH_CASE','Fe 0.000000000000000 0.000000000000000 0.000000000000000',
        *['C '+ ' '.join(p) for p in c['relativeDonorTokens']],''])
    (OUT/(stem+'.dat')).write_text(dat)
    cmd=f'export LC_ALL=C LANG=C TZ=UTC\ncd {shlex.quote(linux)}\ntimeout -k 5s 120s {shlex.quote(exe)} {shlex.quote(stem+".dat")}'
    start=time.perf_counter()
    p=subprocess.run(['wsl.exe','-d',os.environ.get('WSL_DISTRO','Ubuntu-22.04'),'--','bash','-lc',cmd],capture_output=True,text=True,timeout=135)
    ms=(time.perf_counter()-start)*1000
    for ext,body in [('command.txt',cmd),('stdout.txt',p.stdout),('stderr.txt',p.stderr)]: (OUT/(stem+'.'+ext)).write_text(body)
    outpath=OUT/(stem+'.out');matches=[]
    if outpath.exists():matches=re.findall(r'\b'+re.escape(refcode)+r'\s+Ideal structure\s+CShM\s*=\s*([+-]?[\d.]+)',outpath.read_text())
    row={'caseId':c['caseId'],'invocationStem':stem,'targetCode':code,'status':'ok' if p.returncode==0 and len(matches)==1 else 'failed','valueToken':matches[0] if len(matches)==1 else None,
        'processExitCode':p.returncode,'wallMsIncludingWslStartup':ms,'customReference':str(reffile),'rawOutput':str(outpath),
        'pairing':c['inputToReferenceDonorPermutation'],'interpretation':'Attainable fixed correspondence score, not an unrestricted minimum.'}
    rows.append(row)
    (OUT/'results.json').write_text(json.dumps({'executable':exe,'referencePolicy':'Exact current-library custom reference; center fixed; known source correspondence preserved through rotations/permutations.',
        'oracleRerun':True,'count':len(rows),'results':rows},indent=2)+'\n')
    print(stem,row['status'],row['valueToken'],flush=True)
    if row['status']!='ok':raise RuntimeError('Fixed-pairing execution failed; inspect retained raw logs')

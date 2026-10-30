"""Verify the native browser results and exports against the exact input."""
from pathlib import Path
import csv
import html
import json
import re
from PIL import Image

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output'/'playwright'
SOURCE='9c6a8397be05ad3580269c1b6734cdf5319d2d9b'
def read(name):return json.loads((OUT/f'{name}.json').read_text(encoding='utf-8'))
lines=(ROOT/'inputs'/'CCDC1429506-CuO6.xyz').read_text(encoding='utf-8').splitlines()
atoms=[]
for line in lines[2:]:
    e,x,y,z=line.split();atoms.append({'element':e,'x':float(x),'y':float(y),'z':float(z)})
cases=[('02-cn6-minimum',6,2.5,{1,2,3,4,5,6},5,'OC-6 (Octahedral)'),
       ('03-cn6-alternate',6,2.5,{1,2,3,4,5,6},5,'TPR-6 (Trigonal Prism)'),
       ('04-cn4-minimum',4,2.1,{3,4,5,6},4,'SP-4 (Square Planar)')]
records=[]
for name,cn,radius,indices,reference_count,overlay in cases:
    state=read(name);a=state['analysis'];v=state['visualization']
    assert a['atoms']==atoms
    assert a['metalIndex']==0 and len(a['coordAtoms'])==cn
    assert {p['idx'] for p in a['coordAtoms']}==indices
    assert state['controls']['coordRadius']==radius
    assert len(a['geometryResults'])==reference_count
    assert v['displayGeometry']['name']==overlay and v['showIdeal']
    assert not v['autoRotate']
    assert a['analysisParams']['mode']=='default'
    csv_rows=list(csv.DictReader((OUT/f'{name}.csv').open(encoding='utf-8-sig',newline='')))
    assert len(csv_rows)==reference_count
    for row,result in zip(csv_rows,a['geometryResults']):
        context=json.loads(row['Analysis_Context_JSON'])
        align=json.loads(row['Alignment_Record_JSON'])
        assert context['sourceCommit']==SOURCE
        assert context['atoms']==atoms
        assert context['selectedMetal']==0 and set(context['selectedDonorIndices'])==indices
        assert context['coordRadius']==radius and context['analysisMode']=='default'
        assert float(row['CShM_Full_Precision'])==result['shapeMeasure']
        assert align['shapeMeasure']==result['shapeMeasure'] and align['name']==result['name']
        assert align['alignmentParity']==result['alignmentParity']
        assert len(align['transformationMatrix'])==16
        assert len(align['matching'])==cn+1  # donors plus fixed appended center
        assert [cn,cn] in align['matching']
        assert sorted(p[0] for p in align['matching'])==list(range(cn+1))
        assert sorted(p[1] for p in align['matching'])==list(range(cn+1))
    report=(OUT/f'{name}-report.html').read_text(encoding='utf-8')
    assert '1.6.0-rc.2' in report and SOURCE in report
    blocks=re.findall(r'<pre[^>]*>(.*?)</pre>',report,re.S)
    assert len(blocks)==1
    payload=json.loads(html.unescape(blocks[0]))
    assert payload['sourceCommit']==SOURCE
    assert payload['context']['atoms']==atoms
    assert payload['minimumResult']['name']==a['bestGeometry']['name']
    assert payload['displayedOverlay']['name']==overlay
    assert [r['shapeMeasure'] for r in payload['results']]==[r['shapeMeasure'] for r in a['geometryResults']]
    assert SOURCE[:12] in (OUT/f'{name}.txt').read_text(encoding='utf-8')
    records.append({'name':name,'cn':cn,'radius_A':radius,'selected_zero_based_indices':sorted(indices),
                    'mode':'Standard (default)','minimum':a['bestGeometry']['name'],
                    'displayed_overlay':overlay,'references':[{'name':r['name'],'CShM':r['shapeMeasure'],'alignment_parity':r['alignmentParity']} for r in a['geometryResults']],
                    'csv_matches_live_inputs_and_results':True,'html_report_matches_live_inputs_and_results':True})
initial=read('02-cn6-minimum')['analysis']
restored=read('05-cn6-restored')['analysis']
assert initial['atoms']==restored['atoms']==atoms
assert [r['shapeMeasure'] for r in initial['geometryResults']]==[r['shapeMeasure'] for r in restored['geometryResults']]
assert 'crystallographic symmetry and periodic images are not expanded' in (OUT/'00-cif-import.txt').read_text(encoding='utf-8')
assert 'Import warnings' not in (OUT/'01-cn6-initial.txt').read_text(encoding='utf-8')
native=json.loads((OUT/'native-canvas-record.json').read_text(encoding='utf-8'))
assert native['sourceCommit']==SOURCE and native['devicePixelRatio']==2
for capture in native['captures']:
    original=read(capture['name'])
    assert Image.open(OUT/capture['file']).size==(1564,1196)
    assert capture['canvas']['width']==1564 and capture['canvas']['height']==1200
    assert set(capture['donorIndices'])=={a['idx'] for a in original['analysis']['coordAtoms']}
    assert capture['minimumScore']==original['analysis']['bestGeometry']['shapeMeasure']
    assert capture['overlayScore']==original['visualization']['displayGeometry']['shapeMeasure']
    assert capture['exactInputsAndScoresMatchUI']
summary={'status':'checks passed; working evidence, not formal figure approval','source_commit':SOURCE,
         'software_version':'1.6.0-rc.2','browser':'Chromium 148.0.7778.96','cases':records,
         'checks':{'complete_source_coordinates_preserved':True,'full_same_CN_rankings_present':True,
                   'alternate_overlay_does_not_replace_minimum':True,'radius_restore_reproduces_all_CN6_scores_exactly':True,
                   'raw_CIF_symmetry_advisory_shown':True,'replacing_CIF_with_XYZ_clears_import_advisory':True,
                   'CSV_source_commit_inputs_full_precision_alignment_preserved':True,
                   'native_high_resolution_canvases_match_retained_UI_states':True,
                   'HTML_report_version_source_minimum_overlay_inputs_results_preserved':True},
         'limitations':['The native CSV has no separate version field; it retains the exact source commit. UI and report retain both.',
                        'Full-precision report JSON is in the retained HTML expandable record. Print CSS hides it; printed donor coordinates are rounded to four decimals. The printed PDF alone is not the full-precision archive.',
                        'Raw asymmetric-unit CIF import is not the experimental coordination-sphere analysis: it does not expand symmetry and includes H positions in the ordinary radius selection.',
                        'The four-donor comparison is a selected geometric subset, not a chemical coordination-number reassignment.',
                        'This run tests single-structure radius restoration, not saved batch restoration.']}
(ROOT/'browser-handoff.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))

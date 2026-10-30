"""Reproduce a complete CuO6 donor sphere from the unmodified primary CIF.

This source-specific extractor reads the deposited atom-site table and cell,
uses both deposited P -1 operators and nearby lattice translations, and writes
an ordinary Cartesian XYZ. It does not refine, optimize or idealize coordinates.
"""
from pathlib import Path
from itertools import product
import json
import math
import re
import shlex

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'inputs' / 'hp2072sup1.cif'
text = SOURCE.read_text(encoding='utf-8')

def number(value):
    return float(re.sub(r'\(\d+\)$', '', value))

def scalar(tag):
    match = re.search(r'^' + re.escape(tag) + r'\s+(.+)$', text, re.M)
    assert match, tag
    return shlex.split(match.group(1))[0]

def loop_with(tag):
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == tag)
    while lines[start - 1].strip().startswith('_'):
        start -= 1
    assert lines[start - 1].strip() == 'loop_'
    tags = []
    while lines[start].strip().startswith('_'):
        tags.append(lines[start].strip())
        start += 1
    tokens = []
    for line in lines[start:]:
        stripped = line.strip()
        if stripped.startswith('_') or stripped == 'loop_' or stripped.startswith('data_'):
            break
        tokens.extend(shlex.split(line, comments=True))
    assert len(tokens) % len(tags) == 0
    return [dict(zip(tags, tokens[i:i+len(tags)])) for i in range(0, len(tokens), len(tags))]

assert scalar('_database_code_depnum_ccdc_archive') == 'CCDC 1429506'
assert scalar('_journal_paper_doi') == '10.1107/S2056989015018629'
assert scalar('_space_group_name_H-M_alt') == 'P -1'
operators = [row['_space_group_symop_operation_xyz'].replace(' ', '')
             for row in loop_with('_space_group_symop_operation_xyz')]
assert operators == ['x,y,z', '-x,-y,-z']
cell = [number(scalar('_cell_' + tag)) for tag in
        ['length_a', 'length_b', 'length_c', 'angle_alpha', 'angle_beta', 'angle_gamma']]
a, b, c, alpha, beta, gamma = cell
ca, cb, cg = [math.cos(math.radians(v)) for v in [alpha, beta, gamma]]
sg = math.sin(math.radians(gamma))
basis = [[a, 0.0, 0.0], [b*cg, b*sg, 0.0],
         [c*cb, c*(ca-cb*cg)/sg, c*math.sqrt(1-cb*cb-((ca-cb*cg)/sg)**2)]]

def cartesian(frac):
    return [sum(frac[j]*basis[j][i] for j in range(3)) for i in range(3)]

sites = []
for row in loop_with('_atom_site_fract_x'):
    sites.append({'label': row['_atom_site_label'], 'element': row['_atom_site_type_symbol'],
                  'fractional': [number(row['_atom_site_fract_'+d]) for d in 'xyz'],
                  'occupancy': number(row['_atom_site_occupancy'])})
center = next(site for site in sites if site['label'] == 'Cu1')
assert center['fractional'] == [0.5, 0.5, 0.5]
assert all(site['occupancy'] == 1.0 for site in sites)
neighbors = []
seen = set()
for site in sites:
    if site['element'] == 'H':
        continue
    for operator_index, sign in enumerate([1, -1]):
        for shift in product(range(-2, 3), repeat=3):
            frac = [sign*x+s for x, s in zip(site['fractional'], shift)]
            rel = [x-y for x, y in zip(frac, center['fractional'])]
            xyz = cartesian(rel)
            distance = math.sqrt(sum(x*x for x in xyz))
            if distance < 1e-8:
                continue
            key = tuple(round(v, 9) for v in xyz)
            if key in seen:
                continue
            seen.add(key)
            neighbors.append({'cif_label': site['label'], 'element': site['element'],
                              'operator': operators[operator_index], 'translation': list(shift),
                              'fractional': frac, 'cartesian_centered_A': xyz, 'distance_A': distance})
neighbors.sort(key=lambda p:p['distance_A'])
sphere = [p for p in neighbors if p['distance_A'] <= 2.5]
assert len(sphere) == 6
assert {p['cif_label'] for p in sphere} == {'O11W','O12W','O13W'}
assert all(p['element'] == 'O' for p in sphere)
assert len([p for p in sphere if p['distance_A'] <= 2.1]) == 4
sphere.sort(key=lambda p:(p['cif_label'], p['operator'] != 'x,y,z'))
for index, atom in enumerate(sphere, start=1):
    atom['xyz_zero_based_index'] = index
    atom['app_atom_label'] = 'O'
    atom['app_selector_label'] = f'#{index+1}: O'
    atom['source_display_label'] = atom['cif_label'] + ('^i' if atom['operator'] != 'x,y,z' else '')
    assert atom['translation'] == ([0,0,0] if atom['operator'] == 'x,y,z' else [1,1,1])
published = {'O11W':2.398, 'O12W':1.935, 'O13W':1.9790}
assert all(abs(p['distance_A']-published[p['cif_label']]) < 0.0006 for p in sphere)
for i in range(0,6,2):
    assert max(abs(x+y) for x,y in zip(sphere[i]['cartesian_centered_A'],sphere[i+1]['cartesian_centered_A'])) < 1e-12
comment = ('CCDC 1429506 | CuO6 complete symmetry-expanded donor sphere | '
           'DOI 10.1107/S2056989015018629 | Cu1 at origin | '
           'O11W,O11W^i,O12W,O12W^i,O13W,O13W^i; i=1-x,1-y,1-z')
xyz_lines = ['7', comment, 'Cu 0.0000000000 0.0000000000 0.0000000000']
xyz_lines.extend('O ' + ' '.join(f'{v:.10f}' for v in p['cartesian_centered_A']) for p in sphere)
(ROOT/'inputs'/'CCDC1429506-CuO6.xyz').write_text('\n'.join(xyz_lines)+'\n', encoding='utf-8')
record = {
    'status': 'working experimental input; no formal figure approval',
    'citation': {'authors':['Tamara J. Lukianova','Vasyl Kinzhybalo','Adam Pietraszko'],
                 'title':'Crystal structure of new organically templated copper sulfate with 2-aminopyridinium',
                 'journal':'Acta Crystallographica Section E', 'year':2015,'volume':71,'pages':'m191-m192',
                 'doi':'10.1107/S2056989015018629','accession':'CCDC 1429506',
                 'article_url':'https://journals.iucr.org/e/issues/2015/11/00/hp2072/',
                 'cif_doi':'10.1107/S2056989015018629/hp2072sup1.cif',
                 'download_url':'https://scripts.iucr.org/cgi-bin/sendcif?hp2072'},
    'source_file':'inputs/hp2072sup1.cif', 'source_datablock':'I',
    'coordinate_source':'Published _atom_site_fract table; standard uncertainties removed for numeric conversion only. Embedded SHELXL coordinates are not substituted.',
    'units':'angstrom', 'cell_a_b_c_alpha_beta_gamma':cell, 'basis_vectors_A':basis,
    'deposited_symmetry_operators':operators, 'expanded_operator_about_Cu1':'1-x,1-y,1-z',
    'center_source':center, 'origin_shift_only':True, 'refinement_or_optimization':False,
    'translation_search':[-2,2], 'complete_sphere_radius_A':2.5, 'shorter_subset_radius_A':2.1,
    'next_nonhydrogen_distance_A':neighbors[6]['distance_A'],
    'atoms':sphere,
    'checks':{'six_nonhydrogen_neighbors_within_2p5_A':True,'four_within_2p1_A':True,
              'inversion_pairs_match':True,'published_distances_match_within_0p0006_A':True},
    'interpretation':'The paper describes six-coordinate elongated CuO6. The four-shorter-donor selection is a geometric subset used to demonstrate selection-dependent CShM; it is not a reassignment to chemically preferred CN4.',
    'limitations':['The XYZ contains the metal and six donor O atoms only; water H atoms and crystal packing are omitted.',
                   'Q-Shape XYZ selectors use atom indices and element labels; the 3D labels show elements. Original CIF label mapping is retained here.',
                   'Q-Shape does not expand crystal symmetry; expansion is performed externally by this script.']
}
(ROOT/'inputs'/'CCDC1429506-derivation.json').write_text(json.dumps(record,indent=2)+'\n', encoding='utf-8')
print(json.dumps({'accession':record['citation']['accession'],'distances_A':[(p['source_display_label'],p['distance_A']) for p in sphere],
                  'next_nonhydrogen_distance_A':record['next_nonhydrogen_distance_A'],'checks':record['checks']},indent=2))

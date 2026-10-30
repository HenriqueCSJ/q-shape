# Experimental browser illustration — working evidence

This folder contains a source-derived coordination environment and task-local
browser evidence for the October 2026 Q-Shape revision. It is an interface
illustration within the general supported-CN software paper, not a chemical
case-study spine. Figures remain working candidates for root inspection.

## Primary source

Lukianova, T. J.; Kinzhybalo, V.; Pietraszko, A. *Crystal structure of new
organically templated copper sulfate with 2-aminopyridinium.* Acta Cryst. E
**2015**, *71*, m191–m192. DOI:
[10.1107/S2056989015018629](https://doi.org/10.1107/S2056989015018629).
Deposition: **CCDC 1429506**. The primary article identifies an elongated,
six-coordinate [Cu(H₂O)₆]²⁺ ion on an inversion center.

`inputs/hp2072sup1.cif` is the unmodified downloaded CIF. The publisher's
ordinary file URL returned a web challenge; the publisher's public CIF endpoint
successfully supplied the original file:
<https://scripts.iucr.org/cgi-bin/sendcif?hp2072>.
The CIF itself contains the accession and DOI above.

## Reproducible complete-sphere extraction

Run `python derive_coordination_sphere.py`. The script reads the deposited
`_atom_site_fract` table and cell, removes standard-uncertainty suffixes only
for numerical conversion, and applies both deposited P −1 symmetry operators
with nearby integer translations. It converts the fractional positions using
the triclinic cell matrix, translates Cu1 to the Cartesian origin, and retains
all non-hydrogen neighbors within 2.500 Å. Coordinates are neither optimized
nor idealized. The higher-precision coordinates embedded in the SHELXL text
are not substituted for the published atom-site table.

The resulting `inputs/CCDC1429506-CuO6.xyz` contains Cu and six donor O atoms.
Water H atoms, counterions, solvation molecules and crystal packing are not
part of this selected coordination environment. The raw CIF is retained so the
full experimental structure remains available. The inversion-related donors
use **(i) 1−x, 1−y, 1−z** about Cu1 = (½, ½, ½).

`inputs/CCDC1429506-derivation.json` records the cell, exact conversion,
source labels, source-to-XYZ-index mapping and checks. Distances from the
published rounded fractional coordinates are:

- Cu1–O11W and Cu1–O11Wᶦ: 2.3982416098 Å.
- Cu1–O12W and Cu1–O12Wᶦ: 1.9350881438 Å.
- Cu1–O13W and Cu1–O13Wᶦ: 1.9789150660 Å.

These agree with the published distances within 0.0006 Å. Exactly six
non-hydrogen neighbors lie within 2.500 Å; exactly four lie within 2.100 Å.
The next non-hydrogen neighbor is at 3.9372672202 Å. Inversion-pair checks pass.

**Interpretation boundary:** 2.100 Å selects the four shorter donor positions
for a geometric comparison. It does not reassign the chemically described
six-coordinate ion to a preferred CN4 state. CShM values for different donor
counts concern different point sets and should not be interpreted as a
competition that determines the chemical coordination number.

Q-Shape does not expand crystal symmetry. The complete sphere is prepared
externally before XYZ import. Original CIF donor labels are mapped in the
derivation record because Q-Shape's XYZ selector uses atom indices and elements,
while its 3D labels show only element symbols.

## Browser execution

`serve-browser.cjs` serves a frozen production build and starts an isolated
headless Chromium instance on localhost port 8788 / debugging port 9238.
It does not attach to the user's browser. `browser-workflow.cjs` performs file
upload, metal/radius selection, ranking-row selection and export through the
real application's controls. Read-only React state inspection retains exact
unrounded production values and selected inputs; it never creates results or
alters application state. Raw screenshots, text, state and native exports are
written under `output/playwright`.

The final frozen source identity and observed results will be recorded in
`browser-handoff.json` after the actual browser run. A build or screenshot
alone does not establish figure approval.

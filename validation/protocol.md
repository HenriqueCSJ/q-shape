# Q-Shape numerical validation protocol

Status: preregistered working protocol. Passing software tests or the direct
campaign below is necessary but is not, by itself, validation on independent
chemical structures.

## 1. Validation question and claim boundary

The validation asks whether the production Q-Shape calculation path reproduces
SHAPE 2.1 continuous shape measures and geometry rankings, remains invariant to
coordinate representation, and behaves reproducibly in supported browsers.

The comparison executable is the installed SHAPE 2.1 binary identified by
SHA-256. It is third-party software, is not redistributed, and no license file
was found in the audited local installation. The Q-Shape fixtures and its 87
reference geometries are internal evidence, not an independent chemical oracle.

Three statuses must remain distinct:

- `package_status`: whether the evidence package is complete and internally
  verifiable;
- `campaign_gate_status`: whether the campaign-specific numerical gates pass;
- `overall_validation_status`: whether every preregistered evidence stratum has
  been completed. Direct parity alone must retain `incomplete` here.

## 2. Frozen comparison boundary

Every run records and rechecks at both start and finish:

- the exact Q-Shape commit, clean-worktree state, relevant source snapshots,
  dependency lockfile, and hashes;
- the SHAPE version banner, executable hash, registered WSL distribution,
  guest operating system, locale, and executable metadata;
- every SHAPE control/input, raw standard stream, exit code, `.out`, and `.tab`;
- the center and ordered ligands, with the exact decimal tokens supplied;
- the exact binary64 reference coordinates and Q-Shape result bits;
- all parser, runner, analyzer, and independent-verifier sources.

The expected SHAPE executable hash is mandatory and is checked before the first
execution. Any timeout, nonzero exit, parse failure, count/set mismatch, source
change, executable change, or interrupted run produces an aborted package with a
durable failure record and partial manifest. It cannot silently become a PASS.

## 3. Evidence strata

### 3.1 Direct canonical census

The frozen direct campaign contains:

- all 87 shared reference geometries from CN 2 through CN 12 as ideal inputs;
- one retained fixture for each CN, giving 11 additional inputs;
- 98 cases in total;
- every case evaluated against every target of the same CN, giving 952 matched
  target evaluations per program (865 ideal and 87 fixture evaluations);
- 15 SHAPE batches per repetition because a control accepts at most 12 targets;
- two clean SHAPE repetitions, giving 30 invocations and 1,904 raw values;
- two independent Node.js worker processes following the production Q-Shape
  optimizer path, giving 1,904 raw Q-Shape values.

The reference binding is preregistered by both code and ordinal. Eighty-four
codes are identical. The only allowed aliases are:

```text
CN3 fac-vOC-3 -> fvOC-3
CN3 mer-vOC-3 -> mvOC-3
CN8 JBTP-8    -> JBTPR-8
```

Each structure is translated to place the selected center at zero and is then
serialized once to 15 decimal places. Those same ligand tokens feed both
programs. Q-Shape reference targets retain their exact binary64 round-trip
tokens and hexadecimal bits separately.

The production calculation path does not receive an explicit optimizer seed.
It deterministically derives its pseudo-random sequence from the normalized
input/reference pair-distance signatures and mode. The direct primary endpoint
therefore records `seed_policy=input-derived`; it does not substitute the
different explicit-seed API path. Explicit seeds, including `0x51534850`, belong
to the optimizer-sensitivity stratum and must be reported separately.

### 3.2 Metamorphic and adversarial family

For each of the 87 reference geometries, generate exactly 30 main positive
cases. Except for the two explicitly parented families below, transforms start
from the canonical center-relative coordinates. Each final coordinate set is
serialized once to fixed 15-decimal tokens. The `precision-*` cases start from
the serialized fixed-15 tokens of `rotation-a`, and `distorted-twin` starts from
the serialized fixed-15 tokens of `mixed-plus-0.05`.
The main recipes, in manifested order, are:

1. one canonical case;
2. six representation-preserving cases:
   rotation about `[1,2,3]` by `0.417` rad; isotropic scale `5e-5`;
   deterministic ligand permutation; rotation about `[-3,1,4]` by `1.913`
   rad plus scale `2.5`; rotation about `[5,-2,1]` by `4.207` rad plus
   permutation; and rotation about `[7,-4,9]` by `2.731` rad plus scale
   `5e-5` and permutation;
3. three input-precision cases obtained by rounding the common `rotation-a`
   parent to 9, 6, and 3 decimal places before the fixed-15 serialization;
4. six one-ligand radial perturbations, paired at fractions
   `[-0.001,+0.001]`, `[-0.02,+0.02]`, and `[-0.10,+0.10]`;
5. six one-ligand tangential rotations, paired at radians
   `[-0.001,+0.001]`, `[-0.02,+0.02]`, and `[-0.10,+0.10]`;
6. six mixed radial/tangential perturbations, paired at
   `[-0.005,+0.005]`, `[-0.05,+0.05]`, and `[-0.25,+0.25]`; each case acts
   on up to three deterministically selected ligands and alternates the local
   sign across those ligands;
7. one representation-preserving twin of the `mixed-plus-0.05` case, using
   rotation about `[7,-3,2]` by `2.731` rad, scale `0.37`, and permutation;
8. one reflection by `diag(-1,1,1)`, interpreted with the manifested point
   group and chirality rather than assumed invariant to its parent. Chirality
   is classified from the frozen `POINT_GROUPS` map: only `Cn`, `Dn`, `T`,
   `O`, and `I` groups without improper symmetry are chiral.

The positive main family contains 2,610 structures and 25,950 matched target
evaluations per program because every structure is compared with every same-CN
target. The systematic radial and angular perturbations act on individual
ligands and therefore are not aliases for isotropic scaling or rigid rotation.
For an angular case, up to three deterministic tangent-axis candidates are
tested in order; the first is accepted only if it changes the sorted,
center-inclusive pair-distance multiset normalized by the parent RMS radius by
more than `1e-12`. Failure to find such an axis aborts generation. The same
non-congruence gate is tested after fixed-15 serialization for all 18 radial,
angular, and mixed cases.

A separate positive adversarial supplement contains exactly three additional
cases per reference: (i) two selected ligands separated by `1e-6` times the
parent RMS ligand radius, (ii) two selected ligand directions separated by
`0.00017453292519943296` rad (0.01 degree) while retaining the moved ligand's
radius, and (iii) a center/ligand swap in which one original ligand becomes the
new origin and the old center becomes a ligand. The swap changes the physical
environment and is therefore a parity-only trap, never a parent-invariance
test. The CN2 near-collinear case is labelled
`structurally_degenerate_cn2_stress`. All positive adversarial coordinates must
remain finite and all ligand points must remain distinct.

The supplement adds 261 structures and 2,595 matched evaluations, for a frozen
positive total of 2,871 structures and 28,545 matched evaluations per program.
Malformed-input controls are a separate rejection package and are not counted
as positive cases.

Generation uses SHA-256 of
`campaign_id NUL CN NUL reference_code NUL seed_key`, taking the first unsigned
big-endian 32 bits. Sign-paired recipes share a `seed_key`, so they select the
same ligand(s) and tangential axis or axes. Permutations use Fisher-Yates driven
by the frozen 32-bit recurrence `state = 1664525*state + 1013904223 (mod 2^32)`;
if Fisher-Yates returns the identity, a one-position left rotation makes the
permutation non-identity.
Each case stores its seed key, seed, selected indices, axes, operations, parent
ID, exact tokens, and recipe parameters. The independent verifier recomputes
every transform from the parent and recipe; stored final coordinates alone are
not sufficient evidence.

Run two primary repetitions of both programs over all 28,545 pairs. Q-Shape's
primary path remains `input-derived`. In addition, run one Q-Shape sensitivity
execution for every pair at each explicit uint32 seed `0`, `0x51534850`, and
`0xffffffff`; SHAPE has no corresponding seed. Thus the campaign contains
57,090 primary Q-Shape rows, 85,635 sensitivity rows, 142,725 Q-Shape rows in
total, and 57,090 SHAPE values. With at most 12 same-CN target references per
SHAPE control, the frozen partition has 15 target batches per recipe,
`33 * 15 = 495` invocations per repetition and 990 SHAPE invocations in total.
The pretty-printed generated input document for campaign
`qshape-metamorphic-adversarial-v1` is frozen at SHA-256
`102895a86a32a9b44410d72781ba9373e887b49686e247b3c9a2f6c047aaffcd`;
any change requires a new campaign identifier and preregistration.

### 3.3 External chemical holdout

Freeze approximately 200-250 coordination environments from open, citable
crystallographic sources before evaluating them. When availability permits,
include at least ten environments for every CN from 2 through 12 and allocate
the remainder to common CN 4-8 classes. Preserve identifiers, citations,
disorder/occupancy decisions, center/ligand selections, and exclusions.

Two independent users reproduce center and ligand selection for a stratified
subset. Resolve and report selection disagreements before either program is
run. Algorithm changes after opening the holdout create a new candidate and
require all validation strata to be rerun.

### 3.4 Browser and user workflow

Exercise import, center selection, ligand selection, calculation, ranking,
export, invalid-input handling, and recovery in every supported browser. Match
exported values to the calculation service using the same frozen inputs. Record
browser and operating-system versions, accessibility results, and independent
user task outcomes.

## 4. Preregistered numerical gates

### 4.1 Direct campaign

The direct campaign passes only if all conditions hold:

- every matched target has absolute Q-Shape-minus-SHAPE error `<0.01` CShM;
- every CShM is finite and lies in the mathematical domain `[0, 100]`;
- an ideal Q-Shape self-measure is `<1e-8`, while the corresponding five-decimal
  SHAPE value is `<0.01`;
- define the SHAPE best-geometry tie set as all targets within
  `gamma = 0.02001` CShM of its minimum; the Q-Shape minimum belongs to that set;
- every SHAPE-resolved target pair with `|delta_SHAPE| > gamma` retains the same
  strict sign in Q-Shape; inversion and collapse to an exact tie both fail;
- Q-Shape repetitions have identical IEEE-754 binary64 hexadecimal bits;
- SHAPE repetitions have identical five-decimal CShM tokens;
- every `.tab` token is a non-negative fixed three-decimal value, and its
  printed-value interval overlaps the corresponding `.out` interval, implemented
  as `|out - tab| <= 0.000505` CShM;
- the central atom remains position 1 in every SHAPE control and input;
- all expected structures and targets occur exactly once in every repetition;
- every operational or parsing failure remains in the durable package rather
  than being converted into a missing row or a numerical PASS.

Generated `.dat` files must be byte-identical across repetitions. Byte identity
of `.out` and `.tab` is retained as a warning-level diagnostic: numerical token
repeatability is the scientific gate because symmetry-equivalent fitted
coordinates may differ without changing CShM. Standard output is not a byte gate.

`campaign_gate_status` is intentionally limited to this numerical direct
campaign. Its results may be used only when `package_status=complete` and the
independent verifier accepts the sealed package. The full automated suite,
critical-kernel coverage, production build, online CI, and browser checks belong
to broader release-readiness and overall-validation gates; they cannot be
inferred from a direct-campaign PASS.

### 4.2 Metamorphic, adversarial, and seed-sensitivity campaign

Every positive metamorphic or adversarial comparison must independently pass
the applicable direct gates for finite domain, Q-Shape-minus-SHAPE error,
ranking/ties, strict resolved-pair ordering, exact expected sets and
multiplicities, repeatability, `.tab` consistency, and durable failures. The
ideal self-measure gate applies only to canonical and representation-preserving
children of an ideal parent.

Additional relational gates are:

- for each of the six representation-preserving canonical children and every
  same-CN target, SHAPE must retain the identical five-decimal CShM token and
  Q-Shape must differ from the parent by at most `1e-8` under each *same*
  explicit sensitivity seed;
- the distorted twin obeys those same parent-child gates relative to
  `mixed-plus-0.05`;
- input-derived parent and child Q-Shape results are not used for a relational
  invariance gate because the production seed is derived from the input;
- precision, radial, angular, mixed, reflection, near-degenerate,
  near-collinear, and center/ligand-swap cases receive independent parity and
  ranking gates but no parent-equality requirement;
- reflection preserves the center and records the determinant-minus-one matrix
  and reference chirality; it is never silently treated as invariant;
- every explicit Q-Shape seed (`0`, `0x51534850`, `0xffffffff`) must pass the
  error, domain, ranking/tie, and resolved-pair gates separately; seeds are
  neither averaged nor selected post hoc;
- seed zero must be recorded and tested as an explicit uint32 seed, never
  interpreted as the input-derived mode;
- positive adversarial cases must contain only finite tokens and distinct
  ligand points; a rejection or operational failure is retained as a failed
  case, never removed from the denominator.

Malformed-input controls require a typed expected rejection, no partial
numerical rows, and a durable failure/rejection ledger. At minimum they cover a
missing or misplaced center, incorrect point count, non-finite token, duplicate
or effectively zero-length ligand, and unsupported coordination number. They
are reported separately and cannot be converted to positive numerical passes.

## 5. Analysis plan

Report signed bias, mean absolute error, root-mean-square error, median absolute
error, P95, P99, and maximum absolute error. Report exact best-label agreement
separately from membership in the SHAPE tie set. For every case, report
gamma-aware Kendall tau-b, concordant/discordant pairs, SHAPE-only ties,
Q-Shape-only ties, joint ties, and the stricter resolved-pair gate.

Stratify by CN, evidence stratum, main versus adversarial-positive family,
geometry family, distortion type/sign/magnitude, input precision, optimizer
seed mode/value, browser, and execution mode. Report paired-sign deltas without
claiming a physical response model from the synthetic perturbations. Runtime is
diagnostic and is reported separately from numerical accuracy. Threshold
comparisons use exact decimal arithmetic on retained lexical tokens.

## 6. Required evidence package and independent verification

The direct package contains:

- `manifest.json` and its checksum with exact listed/present file equality;
- `references.json` with the frozen 87-entry code/index map and exact target
  binary64 coordinates;
- `cases.json` with stable IDs, provenance, center selection, and input tokens;
- `oracle/` with controls, inputs, outputs, metadata, both repetitions, and no
  SHAPE executable;
- `qshape/` with raw process-level results, binary64 bits, production seed
  policy, and repeatability evidence;
- `inputs/candidate-snapshot/` with the relevant committed source and lockfile;
- `reports/` with tidy matched-target data, case rankings, summary statistics,
  and a never-omitted failure ledger;
- `run-state.json`, including durable abort evidence when applicable.

The metamorphic package is separate from the sealed direct package and adds:

- `recipes.json` and generated `cases.json`, including the 30-case main family,
  three-case adversarial-positive supplement, parent relationships, exact
  transformation fields, recipe-registry hashes, and frozen count contracts;
- two raw SHAPE repetitions partitioned into exactly 990 invocations, retaining
  controls, `.dat`, `.out`, `.tab`, stdout, stderr, exit codes, and hashes;
- two primary input-derived Q-Shape repetitions plus three explicit-seed
  sensitivity streams, with seed mode/value and binary64 bits on every row;
- a separate malformed-input control package with expected rejection codes,
  observed outcomes, and proof that no partial result rows were accepted;
- reports stratified by recipe, parent, sign, magnitude, precision, adversarial
  class, CN, target, and seed, including relational and per-seed gate columns;
- a data dictionary and failure ledger that account for every expected case,
  target, repetition, seed stream, and SHAPE invocation.

The independent verifier uses only Node.js core modules and must not import the
runner, its core parser, its analyzer, Q-Shape source, or `decimal.js`. It
independently checks hashes, safe paths, exact sets and multiplicities, controls,
coordinates, transformation reconstruction, raw outputs, result bits, gates,
summaries, CSVs, and manifest counts. The metamorphic verifier also reconstructs
the 2,871 positive cases from the 87 parents and recipe registries, checks the
28,545-pair census and all parent-child/seed relations, and never imports the
input generator. After sealing the manifest, each runner automatically invokes
its verifier and writes a deterministic, timestamp-free receipt to the sibling
file `<package-directory>.verification.json`. Keeping the receipt outside the
sealed directory avoids a manifest/receipt hash cycle. A run is accepted only
when the verifier exit code, manifest hash, campaign and overall statuses,
verified counts, and sorted warnings all satisfy the frozen contract.
Every later CLI verification also revalidates an existing sibling sidecar byte
for byte against the freshly reconstructed receipt, so post-run sidecar changes
are detected.

Verifier exit codes are normative:

```text
0   package internally valid and its numerical campaign passes
2   package internally valid but a scientific numerical gate fails
3   package invalid or unverifiable
64  command-line usage error
70  verifier internal error
```

Even exit 0 leaves `overall_validation_status=incomplete` until the metamorphic,
external-holdout, browser, and independent-user strata are complete.

## 7. Manuscript claim boundary

Before all strata pass on one frozen candidate, the supported claim is limited
to the specific evidence completed—for example, direct implementation agreement
with SHAPE 2.1 on the shared canonical census and retained fixtures. “Validated
replacement for SHAPE,” “numerically identical,” and broad chemical-validity
claims remain unsupported until the full protocol is complete.

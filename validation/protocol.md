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

For each of the 87 reference geometries, generate exactly 30 manifested cases:

- 1 canonical case;
- 6 representation-preserving cases spanning rotation, isotropic scale,
  ligand permutation, and combined transforms;
- 3 input-precision cases;
- 18 radial, angular, and mixed distortions at preregistered magnitudes and
  stored generation seeds;
- 1 representation-preserving twin of a distorted case;
- 1 reflected case, interpreted with the reference's chirality.

This produces 2,610 structures and 25,950 matched target evaluations because
every generated structure is compared with all same-CN targets. Include
near-degenerate assignments, nearly collinear inputs, center/ligand swap traps,
scales down to at least `5e-5` of the retained molecular-coordinate scale, and
an explicit optimizer-seed sensitivity analysis. Generation seeds, recipes,
parent IDs, and coordinates are immutable evidence.

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

## 4. Preregistered direct-campaign gates

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

## 5. Analysis plan

Report signed bias, mean absolute error, root-mean-square error, median absolute
error, P95, P99, and maximum absolute error. Report exact best-label agreement
separately from membership in the SHAPE tie set. For every case, report
gamma-aware Kendall tau-b, concordant/discordant pairs, SHAPE-only ties,
Q-Shape-only ties, joint ties, and the stricter resolved-pair gate.

Stratify by CN, evidence stratum, geometry family, distortion type/magnitude,
input precision, browser, and execution mode. Runtime is diagnostic and is
reported separately from numerical accuracy. Threshold comparisons use exact
decimal arithmetic on retained lexical tokens.

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

The independent verifier uses only Node.js core modules and must not import the
runner, its core parser, its analyzer, Q-Shape source, or `decimal.js`. It
independently checks hashes, safe paths, exact sets and multiplicities, controls,
coordinates, raw outputs, result bits, gates, summaries, CSVs, and manifest
counts. After sealing the manifest, the runner automatically invokes this
verifier and writes its deterministic, timestamp-free receipt to the sibling
file `<package-directory>.verification.json`. Keeping the receipt outside the
sealed directory avoids a manifest/receipt hash cycle. A run is accepted only
when the verifier exit code, manifest hash, campaign and overall statuses,
verified counts, and sorted warnings all satisfy the frozen contract.
Every later CLI verification also revalidates an existing sibling sidecar byte
for byte against the freshly reconstructed receipt, so post-run sidecar changes
are detected.

Verifier exit codes are normative:

```text
0   package internally valid and direct campaign passes
2   package internally valid but a scientific direct gate fails
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

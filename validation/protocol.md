# Q-Shape numerical validation protocol

Status: working protocol for preregistration before manuscript analyses. Passing
the existing unit tests is necessary, but is not by itself scientific
validation.

## 1. Validation question

Does Q-Shape reproduce the continuous shape measures and geometry rankings of
SHAPE 2.1, while remaining invariant to coordinate representation and producing
repeatable results in its supported browser environments?

The comparison target is the installed, unmodified SHAPE 2.1 executable. The
Q-Shape implementation, its test fixtures, and ideal geometries are not an
independent oracle.

## 2. Frozen comparison boundary

Each validation release must record:

- the exact Q-Shape commit and dependency lockfile;
- the SHAPE version, executable checksum, operating system, control file, input
  file, raw standard output, and output files;
- the atom chosen as the coordination center and the ordered coordinating-atom
  selection;
- all parser and runner versions used to assemble the comparison data;
- a manifest linking every reported value to its raw Q-Shape and SHAPE result.

The proprietary SHAPE executable must not be redistributed. Its checksum and
the redistributable inputs, controls, and outputs are sufficient to identify
the oracle run.

## 3. Evidence strata

### 3.1 Direct SHAPE parity

Run the same structures through Q-Shape and SHAPE 2.1 for every available
reference geometry at the relevant coordination number. Begin with the eleven
retained fixtures spanning CN 2 through CN 12, then extend the oracle set with
chemically varied structures.

The primary numerical endpoint is absolute CShM error. Also retain the complete
within-CN ranking, the best geometry, the best-versus-second-best margin, and
runtime. No comparison may rely only on rounded values copied into source code.

### 3.2 Metamorphic and adversarial validation

For all 87 SHAPE reference geometries from CN 2 through CN 12, generate a
manifested test family containing:

- rigid rotations;
- isotropic rescaling;
- ligand-order permutations;
- combined rotation, scaling, and permutation;
- controlled radial, angular, and mixed distortions at preregistered levels;
- near-degenerate assignments and nearly collinear coordinate sets;
- center/ligand swap traps;
- mirrored inputs for references where chirality makes reflection relevant;
- truncated-coordinate variants that quantify input-precision sensitivity.

The initial target is 90 manifested variants per reference (7,830 structures).
Randomized distortions must use stored seeds. All references of the same CN are
evaluated for each structure so that both values and rankings are tested.

### 3.3 External chemical holdout

Curate a development-frozen holdout of approximately 200-250 coordination
environments from open, citable crystallographic sources. Include at least ten
examples for every CN from 2 through 12 when availability permits, and allocate
the remainder to the more common CN 4-8 classes. Preserve structure identifiers,
source citations, disorder/occupancy decisions, coordinating-atom selections,
and exclusion reasons.

Two independent users must reproduce the center and ligand selection for a
stratified subset. Disagreements are resolved before either program is run and
are reported separately as input-definition uncertainty.

### 3.4 Browser workflow validation

Exercise file import, center selection, ligand selection, calculation, ranking,
export, and error handling in the supported browsers. Compare exported numbers
with the calculation-service results from the same frozen inputs. Record browser
and operating-system versions and include accessibility and failure-recovery
checks.

## 4. Preregistered acceptance gates

The release candidate passes only if all of the following hold:

- every direct oracle comparison has absolute error below 0.01 CShM;
- the best-geometry label agrees with SHAPE for every direct-parity case;
- full rankings have no unexplained inversions larger than the joint numerical
  tolerance; near-ties are reported with their margins rather than forced into
  a categorical success/failure claim;
- ideal self-comparisons have CShM below 1e-8;
- rigid rotation, isotropic scale, and ligand permutation change CShM by less
  than 1e-8 for ideal cases and less than 0.01 for distorted oracle cases,
  including uniformly rescaled coordinates down to at least 5e-5 of the
  retained molecular-coordinate scale;
- repeated calculations are bitwise identical for the same release, input,
  mode, and explicit seed;
- the central atom is always mapped to the reference center;
- Kabsch rotations are proper rotations (determinant +1 within numerical
  tolerance), including rank-deficient inputs;
- the complete automated test suite and production build pass from a clean
  dependency installation;
- every failed, excluded, or manually adjudicated case remains visible in the
  released manifest and report.

These are release gates, not a license to claim exact algorithmic identity.
Residual differences below the gates must still be summarized by maximum,
median, 95th percentile, and signed error.

## 5. Analysis plan

Report direct-oracle absolute and signed errors, geometry-label agreement,
Kendall rank correlation within each CN, and best-versus-second-best margin
agreement. Stratify all results by CN, geometry family, distortion type and
magnitude, input precision, and execution mode. Report median and 95th
percentile runtime separately from numerical accuracy.

Do not tune the optimizer on the external holdout. Any algorithm change after
the holdout is opened creates a new release candidate and requires the complete
validation to be rerun.

## 6. Required release package

The validation release should contain:

- `manifest.json` with stable case identifiers and provenance;
- `oracle/` with SHAPE controls, inputs, raw outputs, executable metadata, and
  checksums, but not the executable itself;
- `qshape/` with raw machine-readable Q-Shape results;
- `generated/` with distortion recipes, seeds, and generated coordinates;
- `holdout/` with source metadata and documented atom selections;
- `reports/` with machine-generated summaries and an explicit failure ledger;
- a single command that regenerates all derived results from the frozen raw
  evidence.

## 7. Claim boundary for the manuscript

Until every gate above has been executed on a frozen commit, the defensible
claim is that Q-Shape is a working candidate with encouraging direct parity and
metamorphic evidence. “Validated replacement for SHAPE” and “numerically
identical to SHAPE” are not yet supported claims.

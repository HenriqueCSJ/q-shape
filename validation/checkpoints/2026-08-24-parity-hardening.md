# Parity-hardening checkpoint — 2026-08-24

Status: working candidate; full scientific protocol not yet executed.

## Direct findings that motivated this checkpoint

- Fresh SHAPE 2.1 reruns of the retained CN9 and CN12 inputs were byte-identical
  to their retained output files.
- The retained CN9 MFF reference is valid: SHAPE 2.1 reports CShM 0 for MFF-9.
- The prior default high-CN optimizer could miss that narrow rotational basin;
  in an observed 200-run audit it failed 49 times and ranked CSAPR-9 first on
  those runs.
- The CN12 discrepancy was caused primarily by coordinates rounded
  independently of the SHAPE oracle run; restoring the retained precision
  reduced the mismatch to well below 0.01 CShM.
- Three rank-deficient Kabsch tests exposed improper or unstable rotations.
- A distorted CN11 JAPPR case exposed a secondary default-mode basin at
  21.76343 versus the SHAPE value 21.67256.

## Candidate changes

- deterministic high-CN pair-frame seeding followed by alternating
  Hungarian-assignment/Kabsch polishing;
- exact post-grid assignment/rotation polishing before annealing;
- ligand-order canonicalization from rotation-, scale-, and
  permutation-invariant distance signatures;
- deterministic pseudo-random sequence derived from invariant distance
  signatures, with optional explicit seed injection;
- center-to-center assignment fixed before ligand Hungarian assignment;
- robust, scale-independent proper-rotation construction for rank-deficient
  Kabsch inputs;
- relative center/ligand degeneracy detection, including finite-input checks;
- removal of the redundant angular refinement after exhaustive
  permutation/Kabsch alignment;
- full-precision CN12 fixture and matching inline benchmark coordinates;
- strict absolute-error, reference-presence, repeatability, center-mapping, and
  metamorphic tests.

The candidate default calculation now gives 21.67264 for the distorted
JAPPR-11 fixture, an absolute difference of approximately 0.00008 from SHAPE
2.1. It gives 17.93583 for JBAPPR-12 versus SHAPE 17.93587. The retained CN9
MFF fixture is bitwise repeatable, remains at CShM 0, and remains the top-ranked
shape across the explicit seeds exercised by the test suite.

## Automated evidence at this checkpoint

- 116 focused tests passed across Kabsch, parity benchmarks, and deterministic
  high-CN tests.
- All 15 discovered Jest suites passed in three non-overlapping groups: 377
  tests passed and none failed.
- The metamorphic suite covers all 59 reference geometries at CN 8-12 under
  three combined rotation/scale/permutation transformations (177 cases).
- MFF-9 also remains invariant after a combined rotation, ligand permutation,
  and isotropic scale factor of 5e-5.
- Exact reference self-comparisons are required to remain below 1e-8 CShM.
- CN11 and CN12 direct parity tests now use an absolute 0.01 CShM gate.
- The optimized production build completed successfully (206.12 kB gzipped
  JavaScript and 2.16 kB gzipped CSS). Only stale browser-database and a Node
  deprecation warning were emitted.
- Two independent read-only code audits found no blocking regression in the
  final numerical diff.

This checkpoint must not be cited as completion of the validation protocol.
External chemical holdout, full oracle packaging, browser workflow validation,
and independent-user atom-selection checks remain outstanding.

# Q-Shape rc.2 source-bound computation evidence

This directory contains working computational evidence, not formal figure,
table, layout, or release approval.

## Source and input boundaries

- Numerical low-CN campaigns were executed from clean commit
  `7a995b93731f94ab7c0f4eeb72f18391f116cd7b`.
- Release/build commit `9c6a8397be05ad3580269c1b6734cdf5319d2d9b`
  differs only by adding the word `validation` to the `.zenodo.json` candidate
  description. `checks/release-metadata-continuity.diff` retains that exact diff.
  Application source and numerical harness files are unchanged. The high-CN
  campaign records its actual source commit independently.
- `inputs/bridge-cases.json` and `inputs/bridge-shape-oracle.json` are byte-for-byte
  copies of the historical 98-input/952-pair corpus and parsed SHAPE results.
  Actual raw SHAPE input/output files are retained in `inputs/oracle/raw`.
  **The low-CN SHAPE oracle was not rerun.** Current target coordinates come from
  the corrected application library. Four historical ideal Johnson inputs
  therefore retain the earlier coordinates.
- `inputs/current-ideal-cases.json` instead contains 87 current-library ideal
  inputs for separate self-recovery. It has no reused SHAPE oracle. A SHAPE
  cross-comparison of the four changed ideal inputs would require 46 new rows:
  seven JASPC-11 input/target fits plus three sets of thirteen CN12 fits.
- The 18 robustness base environments and all six representations are retained
  unchanged. Their original SHAPE input/output files are in
  `inputs/raw`. This gives 172 base fits, 108 represented inputs,
  1,032 target executions, and 860 comparisons with their base representation.
- High-CN input design is five references × three geometries (ideal, 2%, 5%) ×
  three representations (base, two rotations/permutations): 15 base geometries
  and 45 target executions. Perturbation RMS is exactly the stated fraction of
  the original center-to-donor RMS before fixed15 serialization; seeds,
  rotations, and known donor correspondence are retained with each input.

## Primary reference identity

The complete primary coordinate file is pinned to Cosymlib commit
`10620130be0e3a42593debe54df50bdd3de7a1ec`; its exact URL is in
`primary/source.json`. `reference-superposition.json` compares all 92 references
with fixed designated-center correspondence and all-point centroid/RMS
normalization. It retains direct coordinate residuals and donor mappings rather
than relying on cancellation-prone near-zero overlap scores. The four changed
arrays include the nonzero center coordinates exactly as tabulated.

## Authoritative outputs

Completed campaign records belong under `final/`. Raw per-execution values,
transforms, matchings, parity branches, and direct-residual checks are in each
campaign's append-only `results.jsonl`, metadata, and summary. A convenience
`results.json` duplicate may be omitted from a compact archive; the analysis
and verification scripts support either form. Descriptive output
files produced by `scripts/summarize-campaigns.py` are:

- `final/summary.json`: counts, statistics, timing policy, exact source identities;
- `final/signed-score-comparisons.csv`: all 952 signed Q-Shape − SHAPE differences;
- `final/cn-summary.csv`: CN-resolved comparison counts and descriptive statistics;
- `final/near-degenerate-cases.csv`: exact first/second scores and gaps;
- `final/representation-differences.csv` and `final/reflection-differences.csv`;
- `final/high-cn-results.csv`: 45 actual fits and independently specified bounds.

In every CSV, CShM values and differences are dimensionless; runtime is in
milliseconds. The ±0.000005 band denotes half the SHAPE printed increment,
not a confidence interval or statistical uncertainty. Signed difference is
always Q-Shape minus SHAPE. A negative value does not establish a global
minimum. Raw numeric tokens are retained alongside derived binary64 values.
Blank `priorRmsResidual` cells in the reference audit mean no retained old
high-CN reference row was provided, not zero or failed measurement.

The high-CN SHAPE runs use `%fixperm` and the exact current-library custom
reference, with the known donor correspondence. These are attainable bounds,
not unrestricted/global SHAPE minima. A separate full-precision fixed-pairing
SVD residual is a diagnostic bound and is never substituted for the Q-Shape
production result. High-CN results remain provisional beyond the tested cases.

Low-CN campaigns and engineering tests ran concurrently. Their measured fit
times are not isolated speed benchmarks. The high-CN production fits run
serially after the other numerical campaigns complete.

`superseded_partial_a8e292/` contains cancelled intermediate runs and must not
be pooled with final results. `final/high-shape-invocation-diagnostic/` records
one unsuccessful invocation caused by SHAPE's filename truncation; the 45
successful reruns use short invocation stems in `final/high-shape/`.

## Reproduction

Use Node.js with dependencies installed from the source `package-lock.json`.
The run used bundled Node v24.19.0; scientific Python helpers used the available
NumPy/SciPy environment for direct SVD and summaries. No optimizer code was
rewritten. `campaign.cjs` imports the actual application calculator through the
repository's established Babel source loader, checks the exact clean commit,
and checks every target coordinate against the active application module.

Set `QSHAPE_SOURCE` to the clean source checkout,
`QSHAPE_EXPECTED_COMMIT` to its exact commit, and `QSHAPE_OUTPUT_ROOT` to a new
output directory. Run `node scripts/campaign.cjs MODE` for each of `bridge1`,
`bridge2`, `robustness`, `reflection`, `self`, and `high`. Run `high` serially
after other numerical processes finish if comparing the retained runtime policy.
The default output location is `final/`; existing output directories are refused.
Choose a fresh output directory outside the source checkout so subsequent
clean-tree checks remain meaningful. In an extracted source archive without
Git, also set `QSHAPE_ARCHIVE_REVISION` to the exact documented archive revision.
That is explicitly recorded as a declared revision, not an observed Git commit.

For a new high-CN SHAPE control run, set `QSHAPE_SHAPE_OUTPUT` to the new
output directory's `high-shape` child, `SHAPE_BIN` to the installed Linux SHAPE
executable, and optionally `WSL_DISTRO` (default `Ubuntu-22.04`). Run
`python scripts/run-high-shape.py`. The 45 short input/output stems are mapped
back to their full case IDs in its results JSON. Absolute paths in retained
execution records describe the original run; the corresponding files remain
available by basename in the same retained `high-shape` directory after copying.

To recalculate descriptive summaries from retained records, run
`python scripts/summarize-campaigns.py`, then `python scripts/verify-evidence.py`.
These scripts read either the full JSON records or compact JSONL + summary
records. The analysis requires NumPy; the reference-superposition diagnostic
also requires SciPy and PyYAML. The replay itself does not require Python.

`scripts/export-references.cjs` and `scripts/audit-reference-library.py` are
portable diagnostics using the supplied inputs and primary coordinate file.
The one-time `correct-references.py` and `prepare-inputs.py` working helpers
record the development preparation, require the original working directory,
and are not needed in a compact reproduction archive: all their calculation
inputs are retained explicitly. `scripts/run-high-shape.py`
documents the actual WSL SHAPE invocation and requires the separately installed
licensed SHAPE executable. It does not redistribute that executable.

The runtime dependency link `previous-dependency-link`, if present, points to
the old shared dependency installation and is **not evidence**. Automatic
approval review blocked deletion of that link; exclude it from any archive.

# Test coverage policy

The continuous-integration coverage report includes the complete production
source tree under `src`, apart from application bootstrap files and test-only
utilities. It must not be described as coverage of only a selected subset.

The global thresholds are regression floors derived from the full-source
baseline. They are not a claim that the current application-wide coverage is
adequate for publication. As tests are added, these floors should only move
upward.

The two numerical kernels directly responsible for continuous shape measures
have additional per-file gates, enforced after Jest by
`scripts/check-critical-coverage.cjs`. Keeping this check separate is
intentional: Jest subtracts files with path-specific thresholds from the
`global` pool, which would make the global percentage cease to describe the
complete source tree.

The critical-kernel gates are:

- `shapeCalculator.js`: at least 95% statements and lines, 90% branches, and
  100% functions;
- `kabsch.js`: at least 95% statements, branches, and lines, and 100%
  functions.

The Codecov upload and README badge are labeled `full-source` so that their
scope cannot be mistaken for application-wide coverage inferred from a narrow
allowlist.

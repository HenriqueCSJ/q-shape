# Q-Shape 1.6.0-rc.2 reproduction data

This directory is included in the tagged source archive so both software and retained computational evidence are preserved by the release DOI. It contains public reference/test coordinates, production-path scores, raw SHAPE outputs, scripts, and the deposited experimental illustration. It contains no SHAPE executable, dependencies or manuscript drafts.

## What was run

The 952-pair bridge was evaluated twice; 18 robustness environments supply172distinct base fits and six representations each (1032 executions). Reflection checks and87current-library self-recovery cases are separate controls. The high-CN campaign evaluates five references at three distortions and three representations (15geometries/45 executions), with newly run SHAPE fixed-pairing controls. Low-CN SHAPE outputs were retained, not rerun. These finite tests are not global-convergence proofs or a sample of experimental structural diversity.

Low-CN runs and their metadata identify7a995b93731f94ab7c0f4eeb72f18391f116cd7b. High-CN runs and browser captures identify9c6a8397be05ad3580269c1b6734cdf5319d2d9b. The only change between those revisions is one word in the Zenodo description. The release adds this reproduction directory without changing application source or numerical harness. Original per-run identities remain in the records; they are not rewritten to the archival commit.

## Replay with Git

Clone the Q-Shape repository and checkout the release tag. Install dependencies using npm ci at the repository root. Set QSHAPE_SOURCE to that absolute checkout, QSHAPE_EXPECTED_COMMIT to its full Git commit, and QSHAPE_OUTPUT_ROOT to a fresh absolute directory. From this directory run:

    node numerics/scripts/campaign.cjs bridge1

Use a different fresh output root for a new replay. Other modes:bridge2, robustness, reflection, self, high. Run high serially after other numerical campaigns if comparing timing. The source loader imports the actual application calculator and checks target coordinates against the supplied active library.

## Replay from the Zenodo source archive

Extract the release source, install its Node dependencies, set QSHAPE_SOURCE to the extracted root, set QSHAPE_EXPECTED_COMMIT to the release's full commit, and set QSHAPE_ARCHIVE_REVISION to the same commit. This is an explicitly declared archive identity, not an observed Git checkout. Choose a new QSHAPE_OUTPUT_ROOT, then run the same command. Python helpers require NumPy, SciPy and PyYAML. The supplied inputs are authoritative; original-workspace preparation helpers are not part of this portable replay.

All numerical sources/units, reference provenance, raw-oracle locations and limits are described in numerics/README.md. Per-row results are JSONL; duplicate results.json files are omitted where JSONL and a summary provide the same records. The fixed-pairing SHAPE controls retain their raw input/output and results.json. The reference audit helper here uses the packaged historical reference input; that path adjustment changes no calculation.

The experimental CIF is IUCr hp2072sup1.cif, DOI10.1107/S2056989015018629, CCDC1429506. The script and derived XYZ preserve the complete symmetry-expanded CuO6 sphere. The app's basic CIF importer does not itself expand symmetry. Its visible coordinates/scores are rounded; native CSV and the HTML report's retained JSON carry fullprecision.

## Engineering checks

Full validation163/163passed. The initial fullJest run passed552/553 with a metadata-description wording assertion; the one-word correction passed the three metadata tests. The final9c6a839 GitHub TestSuite passed on Node18 and20: https://github.com/HenriqueCSJ/q-shape/actions/runs/41057430825 . Build/deploy also passed. Scientific numerical comparisons remain distinct from engineering checks.

Original software is MIT licensed. Credit primary Cosymlib coordinate source and the IUCr experimental deposition as specified in their retained metadata. The SHAPE executable must be obtained separately under its own distribution terms.

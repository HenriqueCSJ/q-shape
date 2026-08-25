# Structural Summary Statistics

Q-Shape reports the Continuous Shape Measure (CShM) together with direct
descriptive statistics of the coordination sphere selected by the user. These
quantities have different meanings and are kept separate.

## Continuous Shape Measure

CShM is the dimensionless geometry-comparison result. A smaller valid CShM
indicates a closer match to the selected same-coordination-number reference
shape. Q-Shape reports the numerical value for every evaluated reference.

Q-Shape does not convert CShM ranges into qualitative classes, probabilities,
confidence estimates, or universal chemical decision thresholds.

## Direct structural summaries

For the metal-ligand distances in the selected coordination sphere, Q-Shape
reports the arithmetic mean, population standard deviation, minimum, and
maximum in ångströms.

For every unique ligand-metal-ligand pair, Q-Shape reports the number of
angles, arithmetic mean, population standard deviation, minimum, and maximum
in degrees.

These statistics describe the selected coordinates directly. They are not
combined into a geometry-assignment or sample-quality score.

## Outputs intentionally not reported

Q-Shape does not report an Overall Quality Score, a CShM-derived RMSD, a
polyhedral volume ratio, a shape-deviation parameter, or a confidence
percentage for a geometry interpretation. The earlier implementations of
those fields were heuristic, approximate, or placeholders and were removed to
avoid presenting them as validated physical observables.

---

*Previous: [Reference Geometries](04-Reference-Geometries.md)*

*Next: [Ring Detection & Hapticity](06-Ring-Detection-Hapticity.md)*

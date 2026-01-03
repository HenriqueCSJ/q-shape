# SHAPE v2.1 Parity Test Structures

These XYZ files contain the molecular structures used to validate Q-Shape against SHAPE v2.1 (the reference Fortran implementation by Alvarez et al., Universitat de Barcelona).

## Test Structures

| File | CN | Metal | Best Geometry | SHAPE CShM |
|------|----|----|---------------|------------|
| CN2-CuCl2.xyz | 2 | Cu | vT-2 (V-shape) | 0.10827 |
| CN3-NH3.xyz | 3 | N | vT-3 (Pyramid) | 0.02875 |
| CN4-CuCl4.xyz | 4 | Cu | SP-4 (Square Planar) | 0.02657 |
| CN5-AgL5.xyz | 5 | Ag | SPY-5 (Square Pyramidal) | 4.22501 |
| CN6-NiN4O2.xyz | 6 | Ni | OC-6 (Octahedral) | 0.21577 |
| CN7-FeL7.xyz | 7 | Fe | PBPY-7 (Pentagonal Bipyramidal) | 0.00000 |
| CN8-FeL8.xyz | 8 | Fe | SAPR-8 (Square Antiprism) | 0.09337 |
| CN9-CrL9.xyz | 9 | Cr | MFF-9 (Muffin) | 0.00000 |
| CN10-FeL10.xyz | 10 | Fe | HD-10 (Hexadecahedron) | 16.93361 |
| CN11-NbL11.xyz | 11 | Nb | JAPPR-11 (Aug. Pent. Prism) | 21.67256 |
| CN12-NbL12.xyz | 12 | Nb | JBAPPR-12 (Biaug. Pent. Prism) | 17.93587 |

## Usage

These structures can be loaded directly into Q-Shape or used with the parity benchmark tests:

```bash
npm test -- --testPathPattern="shapeParityBenchmark"
```

## Reproducibility

All SHAPE v2.1 reference values were obtained using SHAPE v2.1 (June 2013 release) with default settings. The test structures were selected to cover:

1. **Low CN (2-4)**: Simple geometries with clear best matches
2. **Medium CN (5-8)**: Common coordination environments in transition metal chemistry
3. **High CN (9-12)**: Complex polyhedra including Johnson solids

## Validation Results

Q-Shape achieves < 0.1% relative error compared to SHAPE v2.1 for all test structures. See the main README for detailed parity tables.

## References

1. Alvarez, S. et al. *Coord. Chem. Rev.* **2005**, 249, 1693-1708. DOI: [10.1016/j.ccr.2005.03.031](https://doi.org/10.1016/j.ccr.2005.03.031)
2. SHAPE v2.1: http://www.ee.ub.edu/index.php?option=com_content&view=article&id=90&Itemid=117

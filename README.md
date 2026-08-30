# Q-Shape - Quantitative Shape Analyzer

<div align="center">

![Q-Shape Logo](https://img.shields.io/badge/Q--Shape-Molecular%20Geometry%20Analysis-blue?style=for-the-badge&logo=react&logoColor=white)

[![Candidate](https://img.shields.io/badge/candidate-1.6.0--rc.1-orange.svg?style=flat-square)](validation/protocol.md)
[![Archived release](https://img.shields.io/badge/archived%20release-1.5.0-blue.svg?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/releases/tag/v1.5.0)
[![Archived v1.5.0 DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18209621.svg)](https://doi.org/10.5281/zenodo.18209621)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://choosealicense.com/licenses/mit/)
[![Website](https://img.shields.io/website?down_color=red&down_message=offline&style=flat-square&up_color=green&up_message=online&url=https%3A%2F%2Fhenriquecsj.github.io%2Fq-shape)](https://henriquecsj.github.io/q-shape)
[![Tests](https://github.com/HenriqueCSJ/q-shape/actions/workflows/test.yml/badge.svg)](https://github.com/HenriqueCSJ/q-shape/actions/workflows/test.yml)
[![Full-source coverage](https://codecov.io/gh/HenriqueCSJ/q-shape/graph/badge.svg?flag=full-source)](https://codecov.io/gh/HenriqueCSJ/q-shape)

**🔬 Advanced Coordination Geometry Analysis for Inorganic Chemistry**

[**Archived v1.5.0 web app**](https://henriquecsj.github.io/q-shape) · [**Report Bug**](https://github.com/HenriqueCSJ/q-shape/issues) · [**Request Feature**](https://github.com/HenriqueCSJ/q-shape/issues)

</div>

---

## Overview

**Q-Shape** is a web-based tool for quantitative analysis of coordination geometries in metal complexes. It determines how closely your molecular structure matches ideal coordination polyhedra using Continuous Shape Measures (CShM), a rigorous mathematical framework developed by Pinsky & Avnir.

### Why Q-Shape?

- **🌐 Browser-Based**: No installation required - runs entirely in your web browser
- **🔒 Privacy First**: All calculations performed locally on your device. Your structures never leave your computer
- **📊 Comprehensive**: 92 reference geometries covering CN 2-12, plus fullerenes (CN 20, 24, 48, 60)
- **🎯 Quantitative**: Reports Continuous Shape Measures using Kabsch alignment and assignment optimization
- **📈 Exportable Results**: Generate HTML/print reports and CSV files with CShM values and structural summaries
- **⚡ Dual Modes**: Standard and extended-search analysis modes

---

## Key Features

### Analysis Capabilities

✅ **92 Reference Geometries Implemented** - CN 2-12 plus high-CN fullerenes; release-candidate qualification is tracked separately
✅ **Continuous Shape Measures (CShM)** - Quantify deviation from ideal geometry
✅ **Auto-Detection** - Automatically identifies metal centers and coordination spheres
✅ **Smart Radius Control** - Fine-tune coordination sphere or find optimal radius by CN
✅ **Interactive 3D Visualization** - Real-time molecular viewer with ideal geometry overlay
✅ **Structural Summaries** - Direct bond-length and ligand-metal-ligand angle statistics
✅ **Reports and CSV** - Numerical CShM values, structural summaries, and provenance

### Multi-Structure Batch Analysis (v1.5.0)

✅ **Batch Processing** - Analyze multiple structures from a single file
✅ **Multi-Structure XYZ Support** - Load multi-frame XYZ files
⚠️ **Basic CIF Import** - Reads Cartesian atom-site rows and converts fractional coordinates from the unit cell; no symmetry or periodic-image expansion
✅ **Batch Summary Table** - Visual overview of all analyzed structures at a glance
✅ **Batch Analysis** - Run intensive analysis on all structures with progress tracking
✅ **Batch Print Reports** - Print-ready HTML reports with per-structure details; save as PDF from the browser print dialog
✅ **CSV Export** - Detailed geometry results for all processed structures, including retained failures
✅ **Structure Selector** - Navigate between structures with instant visualization updates

### Analysis Modes

**Standard Mode**
- Uses the default bounded search configuration
- Evaluates the references available for the selected coordination number

**Extended-Search Mode**
- Uses a larger bounded search configuration and may take longer
- Does not guarantee a global minimum; compare retained same-CN results directly

---

## Quick Start

### Deployed archived version

The current public site is the archived **v1.5.0** application, not this
`1.6.0-rc.1` candidate: **[https://henriquecsj.github.io/q-shape](https://henriquecsj.github.io/q-shape)**.

> 🔒 **Privacy Notice:** Q-Shape runs entirely in your browser. **No data is uploaded or transmitted**. Your molecular structures remain completely private on your device.

### Basic Workflow

1. **Upload** an XYZ file, or a basic CIF containing Cartesian or fractional atom-site coordinates
2. **Select** metal center (auto-detected or manual selection)
3. **Adjust** coordination sphere radius if needed
4. **Run** analysis (standard or intensive mode)
5. **Visualize** results in 3D and review shape measures
6. **Export** a print-ready report and save it as PDF from the browser print dialog

### Batch Analysis Workflow (v1.5.0)

1. **Upload** a multi-frame XYZ file or a multi-block basic CIF
2. **Review** the batch summary table showing all structures
3. **Run Batch Analysis** to analyze all structures with intensive mode
4. **Navigate** between structures using the structure selector
5. **Export** a batch print report or detailed CSV with all processed results

---

## Scientific Basis

### Continuous Shape Measures (CShM)

Q-Shape uses the CShM methodology to quantify geometric distortion:

**S(Q,P) = min[Σᵢ|qᵢ - pᵢ|² / Σᵢ|q₀ᵢ|²] × 100**

Where:
- **Q** = your actual molecular structure (normalized)
- **P** = ideal reference geometry (normalized)
- Minimization over all atom permutations **σ**, rotations **R**, and isotropic scaling **c**

### Numerical CShM reporting

Q-Shape reports finite CShM values in the mathematical domain `[0, 100]`.
Scientific interpretation should compare the numerical values for the relevant
same-CN reference geometries directly. Q-Shape does not convert CShM ranges
into qualitative classes, probabilities, or confidence estimates.

### Algorithms

Q-Shape currently implements the following computational methods:

- **Kabsch Algorithm**: Optimal rotation via Singular Value Decomposition
- **Hungarian Algorithm**: Optimal atom-to-vertex assignment (munkres-js library)
- **Multi-Stage Optimization**: Bounded deterministic search and iterative refinement for the lowest value found
- **Simulated Annealing**: Escape local minima in intensive mode

### Validation

The `1.6.0-rc.1` lineage is a **pre-release validation candidate**, not a
validated release. The authoritative [validation protocol](validation/protocol.md)
keeps engineering tests separate from scientific parity. Current boundaries:

- automated unit, validation, coverage, and build checks test the code but do
  not by themselves establish SHAPE parity;
- completed direct-parity evidence belongs to an earlier candidate and cannot
  be transferred silently to this lineage;
- final metamorphic, external chemical holdout, browser, and independent-user
  campaigns remain incomplete or unexecuted for this candidate;
- a final archival DOI will be minted only after the release identity and its
  required validation evidence are fixed.

<details>
<summary><strong>Historical v1.5 exploratory SHAPE comparisons (not release-candidate qualification)</strong></summary>

The values below are retained for historical transparency. They do not validate
`1.6.0-rc.1`, do not replace the frozen campaigns, and must not be summarized as
holdout or full-census evidence.

#### CN=2 - CuCl₂ (Bent Dihalide)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| L-2 (Linear) | 11.96378 | 11.96364 | 0.00% |

#### CN=3 - NH₃ (Ammonia)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| TP-3 (Trigonal Planar) | 3.63845 | 3.63858 | 0.00% |

#### CN=4 - CuCl₄ (Square Planar)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| SP-4 (Square Planar) | 0.02656 | 0.02657 | 0.05% |
| SS-4 (Seesaw) | 17.86068 | 17.86037 | 0.00% |
| T-4 (Tetrahedral) | 31.94415 | 31.94357 | 0.00% |

#### CN=6 - NiN₄O₂ (Octahedral)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| OC-6 (Octahedral) | 0.21578 | 0.21577 | 0.00% |
| TPR-6 (Trigonal Prism) | 15.86082 | 15.86037 | 0.00% |
| PPY-6 (Pentagonal Pyramid) | 29.25438 | 29.25337 | 0.00% |

#### CN=7 - FeL₇ (Pentagonal Bipyramidal)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| PBPY-7 (Pentagonal Bipyramidal) | 0.00000 | 0.00000 | 0.00% |
| JPBPY-7 (Johnson J13) | 3.61602 | 3.61603 | 0.00% |
| CTPR-7 (Capped Trigonal Prism) | 6.67472 | 6.67493 | 0.00% |
| COC-7 (Capped Octahedral) | 8.58135 | 8.58154 | 0.00% |

#### CN=8 - FeL₈ (Square Antiprism)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| SAPR-8 (Square Antiprism) | 0.09336 | 0.09337 | 0.01% |
| BTPR-8 (Biaugmented Trigonal Prism) | 2.34967 | 2.34967 | 0.00% |
| TDD-8 (Triangular Dodecahedron) | 2.66307 | 2.66300 | 0.00% |
| CU-8 (Cube) | 10.43338 | 10.43287 | 0.00% |
| ETBPY-8 (Elongated Trigonal Bipyramid) | 24.78388 | 24.78340 | 0.00% |

#### CN=9 - CrL₉ (Muffin)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| MFF-9 (Muffin) | 0.00000 | 0.00000 | 0.00% |
| CSAPR-9 (Capped Square Antiprism) | 0.81738 | 0.81738 | 0.00% |
| TCTPR-9 (Tricapped Trigonal Prism) | 2.04462 | 2.04462 | 0.00% |
| CCU-9 (Capped Cube) | 9.68808 | 9.68808 | 0.00% |

#### CN=10 - FeL₁₀ (Hexadecahedron)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| HD-10 (Hexadecahedron) | 16.93346 | 16.93361 | 0.00% |
| SDD-10 (Staggered Dodecahedron) | 17.12465 | 17.12464 | 0.00% |
| PAPR-10 (Pentagonal Antiprism) | 17.29546 | 17.29565 | 0.00% |
| PPR-10 (Pentagonal Prism) | 19.80444 | 19.80407 | 0.00% |

#### CN=11 - NbL₁₁ (Augmented Pentagonal Prism)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| JAPPR-11 (Augmented Pentagonal Prism, J52) | 21.67264 | 21.67256 | 0.00% |
| JCPPR-11 (Capped Pentagonal Prism, J9) | 24.85788 | 24.85845 | 0.00% |
| JCPAPR-11 (Capped Pentagonal Antiprism, J11) | 27.02151 | 27.02164 | 0.00% |
| JASPC-11 (Augmented Sphenocorona, J87) | 28.15989 | 28.15981 | 0.00% |

#### CN=12 - NbL₁₂ (Biaugmented Pentagonal Prism)
| Geometry | Q-Shape | SHAPE | Rel.Err |
|----------|---------|-------|---------|
| JBAPPR-12 (Biaugmented Pentagonal Prism, J53) | 17.93564 | 17.93587 | 0.00% |
| TT-12 (Truncated Tetrahedron) | 19.71221 | 19.71226 | 0.00% |
| COC-12 (Cuboctahedral) | 21.69394 | 21.69330 | 0.00% |
| IC-12 (Icosahedral) | 25.52546 | 25.52485 | 0.00% |
| JSC-12 (Square Cupola, J4) | 25.96272 | 25.96201 | 0.00% |
| JSPMC-12 (Sphenomegacorona, J88) | 26.77879 | 26.77845 | 0.00% |

</details>

---

## Input Format

Q-Shape accepts standard XYZ molecular structure files:

```xyz
<number of atoms>
<comment line (optional)>
<element> <x-coordinate> <y-coordinate> <z-coordinate>
...
```

### Example: Octahedral Iron Complex

```xyz
7
Iron hexaaqua complex
Fe   0.000   0.000   0.000
O    2.100   0.000   0.000
O   -2.100   0.000   0.000
O    0.000   2.100   0.000
O    0.000  -2.100   0.000
O    0.000   0.000   2.100
O    0.000   0.000  -2.100
```

**Expected Result**: CShM(Octahedron) ≈ 0.00-0.10 (perfect geometry)

---

## Reference Geometries

Q-Shape includes 92 reference geometries organized by coordination number:

| CN | Count | Key Geometries |
|----|-------|----------------|
| 2 | 3 | Linear, V-shape |
| 3 | 4 | Trigonal planar, T-shaped, Trigonal pyramid |
| 4 | 4 | Tetrahedral, Square planar, Seesaw |
| 5 | 5 | Trigonal bipyramidal, Square pyramidal |
| 6 | 5 | **Octahedral**, Trigonal prism, Pentagonal pyramid |
| 7 | 7 | Pentagonal bipyramid, Capped octahedron |
| 8 | 13 | **Cubic**, Square antiprism, Triangular dodecahedron |
| 9 | 13 | Tricapped trigonal prism, Capped square antiprism |
| 10 | 13 | Pentagonal prism/antiprism, Bicapped cube |
| 11 | 7 | Various capped polyhedra |
| 12 | 13 | **Icosahedral**, Cuboctahedron, Hexagonal prism |
| 20 | 1 | Dodecahedron (Platonic solid) |
| 24 | 2 | Truncated cube, Truncated octahedron |
| 48 | 1 | Truncated cuboctahedron (Archimedean solid) |
| 60 | 1 | Truncated icosahedron (C₆₀ fullerene) |

**Source**: 87 geometries from SHAPE 2.1 + 5 high-CN geometries from CoSyMlib

---

## Advanced Features

### Precision Radius Control

Fine-tune your coordination sphere definition:
- **Direct Input**: Enter exact radius values (e.g., 3.456 Å)
- **Step Controls**: Adjust by ±0.50, ±0.10, ±0.05, or ±0.01 Å
- **Real-time Update**: Coordination sphere updates instantly

### Find Radius by CN

Automatically determine the optimal radius for a target coordination number:
- Uses gap detection algorithm to analyze neighbor distances
- Reports the selected radius and neighboring-distance separation
- Supports CN 2-24

### Report Generation

Click "📄 Generate Report" to open a comprehensive print-ready report that can be saved as PDF from the browser dialog, including:
- 3D structure visualization with ideal geometry overlay
- Complete shape measure table for all geometries
- Numerical dimensionless CShM values without qualitative or confidence columns
- Bond-length and angle statistics plus the coordination table
- Proper citation information

---

## Installation (Local Development)

```bash
# Clone repository
git clone https://github.com/HenriqueCSJ/q-shape.git
cd q-shape

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### System Requirements

- **Node.js**: 18.x or 20.x (current CI matrix)
- **npm**: 10.8.2 (pinned by the lockfile workflow)
- **Browser**: Modern browser with WebGL support

---

## Performance

No runtime or memory benchmark is currently frozen for `1.6.0-rc.1`.
Performance depends on coordination number, selected mode, browser, and
hardware; quantitative claims will be added only from a version-bound protocol.

### Browser Compatibility

The build targets current mainstream browser families through `browserslist`,
but the frozen cross-browser qualification campaign has not yet been executed
for this release candidate. Until that campaign passes, compatibility is a
target rather than a validated support claim.

| Browser family | Build target | Candidate qualification |
|----------------|--------------|-------------------------|
| Chromium / Chrome | Yes | Pending |
| Chromium / Edge | Yes | Pending |
| Firefox | Yes | Pending |
| WebKit / Safari | Yes | Pending |

---

## Citation

The DOI below identifies the archived **v1.5.0** release only. It must not be
used to identify `1.6.0-rc.1`. Until the final candidate receives its own
persistent archive, cite the repository, the displayed candidate version, and
the exact Git commit used.

For the archived v1.5.0 release, cite:

**APA:**
```
Castro Silva Junior, H. (2026). Q-Shape - Quantitative Shape Analyzer (v1.5.0).
Zenodo. https://doi.org/10.5281/zenodo.18209621
```

**BibTeX:**
```bibtex
@software{qshape2026,
  author = {Castro Silva Junior, Henrique},
  title = {Q-Shape - Quantitative Shape Analyzer},
  version = {1.5.0},
  year = {2026},
  doi = {10.5281/zenodo.18209621},
  url = {https://doi.org/10.5281/zenodo.18209621},
  publisher = {Zenodo}
}
```

### Related Publications

1. **Pinsky, M.; Avnir, D.** *Inorg. Chem.* **1998**, 37, 5575-5582.
   DOI: [10.1021/ic9804925](https://doi.org/10.1021/ic9804925)
   *Original CShM methodology*

2. **Alvarez, S. et al.** *Coord. Chem. Rev.* **2005**, 249, 1693-1708.
   DOI: [10.1016/j.ccr.2005.03.031](https://doi.org/10.1016/j.ccr.2005.03.031)
   *SHAPE software and reference geometries*

3. **Casanova, D. et al.** *Chem. Eur. J.* **2005**, 11, 1479-1494.
   DOI: [10.1002/chem.200400799](https://doi.org/10.1002/chem.200400799)
   *Minimal distortion pathways*

---

## Contributing

We welcome contributions from the community! Whether it's bug reports, feature requests, or code contributions, your input helps improve Q-Shape.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

```
MIT License
Copyright (c) 2026 Henrique C. S. Junior

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

## Author

<div align="center">

**Prof. Dr. Henrique C. S. Junior**

[![ORCID](https://img.shields.io/badge/ORCID-0000--0003--1453--7274-green?style=for-the-badge&logo=orcid)](https://orcid.org/0000-0003-1453-7274)
[![Email](https://img.shields.io/badge/Email-henriquecsj%40ufrrj.br-red?style=for-the-badge&logo=gmail)](mailto:henriquecsj@ufrrj.br)
[![GitHub](https://img.shields.io/badge/GitHub-HenriqueCSJ-181717?style=for-the-badge&logo=github)](https://github.com/HenriqueCSJ)

**Universidade Federal Rural do Rio de Janeiro (UFRRJ)**
Department of Fundamental Chemistry
Seropédica, RJ, Brazil

</div>

---

## Acknowledgments

- 🏛️ **UFRRJ** - Universidade Federal Rural do Rio de Janeiro
- 🧪 **Department of Fundamental Chemistry**
- 📚 **SHAPE Developers** - Universitat de Barcelona (original SHAPE software)
- 📊 **CoSyMlib** - High-CN reference geometries
- 🎨 **Three.js Community** - 3D visualization framework
- 🤝 **All Contributors** - Thank you for improving Q-Shape

---

## Support

Need help? Have questions?

- 📖 [Documentation](https://github.com/HenriqueCSJ/q-shape/wiki)
- 🐛 [Report Issues](https://github.com/HenriqueCSJ/q-shape/issues)
- 💬 [Discussions](https://github.com/HenriqueCSJ/q-shape/discussions)
- 📧 [Email](mailto:henriquecsj@ufrrj.br)

---

<div align="center">

**Made with ❤️ for the Inorganic Chemistry Community**

[![GitHub Stars](https://img.shields.io/github/stars/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/network/members)
[![GitHub Watchers](https://img.shields.io/github/watchers/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/watchers)

[⭐ Star this project](https://github.com/HenriqueCSJ/q-shape) if you find it useful!

</div>

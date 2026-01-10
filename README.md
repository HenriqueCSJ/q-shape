# Q-Shape - Quantitative Shape Analyzer

<div align="center">

![Q-Shape Logo](https://img.shields.io/badge/Q--Shape-Molecular%20Geometry%20Analysis-blue?style=for-the-badge&logo=react&logoColor=white)

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/releases/tag/v1.5.0)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18209621.svg)](https://doi.org/10.5281/zenodo.18209621)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://choosealicense.com/licenses/mit/)
[![Website](https://img.shields.io/website?down_color=red&down_message=offline&style=flat-square&up_color=green&up_message=online&url=https%3A%2F%2Fhenriquecsj.github.io%2Fq-shape)](https://henriquecsj.github.io/q-shape)
[![Tests](https://github.com/HenriqueCSJ/q-shape/actions/workflows/test.yml/badge.svg)](https://github.com/HenriqueCSJ/q-shape/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/HenriqueCSJ/q-shape/graph/badge.svg)](https://codecov.io/gh/HenriqueCSJ/q-shape)

**🔬 Advanced Coordination Geometry Analysis for Inorganic Chemistry**

[**Try it Now**](https://henriquecsj.github.io/q-shape) · [**Report Bug**](https://github.com/HenriqueCSJ/q-shape/issues) · [**Request Feature**](https://github.com/HenriqueCSJ/q-shape/issues)

</div>

---

## Overview

**Q-Shape** is a web-based tool for quantitative analysis of coordination geometries in metal complexes. It determines how closely your molecular structure matches ideal coordination polyhedra using Continuous Shape Measures (CShM), a rigorous mathematical framework developed by Pinsky & Avnir.

### Why Q-Shape?

- **🌐 Browser-Based**: No installation required - runs entirely in your web browser
- **🔒 Privacy First**: All calculations performed locally on your device. Your structures never leave your computer
- **📊 Comprehensive**: 92 reference geometries covering CN 2-12, plus fullerenes (CN 20, 24, 48, 60)
- **🎯 Accurate**: Implements optimal algorithms (Kabsch alignment, Hungarian matching) for rigorous results
- **📈 Publication-Ready**: Generate professional PDF reports with 3D visualizations and statistics
- **⚡ Dual Modes**: Fast analysis for routine work, intensive mode for publication-quality results

---

## Key Features

### Analysis Capabilities

✅ **92 Reference Geometries** - Complete SHAPE 2.1 coverage plus high-CN fullerenes
✅ **Continuous Shape Measures (CShM)** - Quantify deviation from ideal geometry
✅ **Auto-Detection** - Automatically identifies metal centers and coordination spheres
✅ **Smart Radius Control** - Fine-tune coordination sphere or find optimal radius by CN
✅ **Interactive 3D Visualization** - Real-time molecular viewer with ideal geometry overlay
✅ **Comprehensive Metrics** - Bond statistics, angular distortion, quality scoring
✅ **PDF Reports** - Professional output suitable for publication

### Multi-Structure Batch Analysis (v1.5.0)

✅ **Batch Processing** - Analyze multiple structures from a single file
✅ **Multi-Structure XYZ/CIF Support** - Load files with multiple conformers or structures
✅ **Batch Summary Table** - Visual overview of all analyzed structures at a glance
✅ **Parallel Analysis** - Run intensive analysis on all structures with progress tracking
✅ **Batch PDF Reports** - Comprehensive reports with per-structure details
✅ **CSV Export** - Wide summary or detailed geometry results for all structures
✅ **Structure Selector** - Navigate between structures with instant visualization updates

### Analysis Modes

**Standard Mode** (~5-10 seconds)
- Fast analysis using optimized algorithms
- Sufficient for most coordination complexes
- Ideal for routine characterization work

**Intensive Mode** (~20-30 seconds)
- Extended optimization with global search
- Publication-quality precision
- Recommended for highly distorted or ambiguous geometries

---

## Quick Start

### Online Version (Recommended)

Visit **[https://henriquecsj.github.io/q-shape](https://henriquecsj.github.io/q-shape)**

> 🔒 **Privacy Notice:** Q-Shape runs entirely in your browser. **No data is uploaded or transmitted**. Your molecular structures remain completely private on your device.

### Basic Workflow

1. **Upload** your XYZ or CIF file (drag-and-drop or file picker)
2. **Select** metal center (auto-detected or manual selection)
3. **Adjust** coordination sphere radius if needed
4. **Run** analysis (standard or intensive mode)
5. **Visualize** results in 3D and review shape measures
6. **Export** PDF report for your records

### Batch Analysis Workflow (v1.5.0)

1. **Upload** a multi-structure XYZ or CIF file
2. **Review** the batch summary table showing all structures
3. **Run Batch Analysis** to analyze all structures with intensive mode
4. **Navigate** between structures using the structure selector
5. **Export** batch PDF report or CSV files with all results

---

## Scientific Basis

### Continuous Shape Measures (CShM)

Q-Shape uses the CShM methodology to quantify geometric distortion:

**S(Q,P) = min[Σᵢ|qᵢ - pᵢ|² / Σᵢ|q₀ᵢ|²] × 100**

Where:
- **Q** = your actual molecular structure (normalized)
- **P** = ideal reference geometry (normalized)
- Minimization over all atom permutations **σ** and rotations **R**

### Interpretation Guide

| CShM Range | Quality | Meaning |
|------------|---------|---------|
| 0.00-0.10 | Perfect | Negligible distortion from ideal |
| 0.10-1.50 | Excellent | Near-ideal coordination |
| 1.50-3.00 | Good | Slight distortion, geometry clear |
| 3.00-7.50 | Moderate | Notable distortion |
| 7.50-15.0 | Poor | Significant distortion |
| >15.0 | Very Poor | No clear match to this geometry |

### Algorithms

Q-Shape implements state-of-the-art computational methods:

- **Kabsch Algorithm**: Optimal rotation via Singular Value Decomposition
- **Hungarian Algorithm**: Optimal atom-to-vertex assignment (munkres-js library)
- **Multi-Stage Optimization**: Iterative refinement for global minimum
- **Simulated Annealing**: Escape local minima in intensive mode

### Validation

Q-Shape has been validated against SHAPE 2.1 (Fortran reference implementation):
- **Mean absolute error**: < 0.01 CShM units
- **Correlation**: R² > 0.9999
- **Test coverage**: CN=2-12 with real coordination complexes

<details>
<summary><strong>SHAPE v2.1 Parity Test Results (Click to expand)</strong></summary>

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
- Reports confidence based on separation quality
- Supports CN 2-24

### Report Generation

Click "📄 Generate Report" to create a comprehensive PDF including:
- 3D structure visualization with ideal geometry overlay
- Complete shape measure table for all geometries
- Quality metrics and interpretation
- Bond length statistics and coordination table
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

- **Node.js**: 16.0+
- **npm**: 8.0+
- **Browser**: Modern browser with WebGL support
- **Memory**: 4GB+ RAM recommended

---

## Performance

### Analysis Time

| Coordination Number | Standard Mode | Intensive Mode |
|---------------------|---------------|----------------|
| CN 4 | ~2 seconds | ~8 seconds |
| CN 6 | ~5 seconds | ~20 seconds |
| CN 8 | ~18 seconds | ~55 seconds |
| CN 12 | ~65 seconds | ~200 seconds |

*Times measured on M1 MacBook Pro. Performance varies with hardware and browser.*

### Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 90+ | ✅ Recommended | Best performance |
| Firefox 88+ | ✅ Excellent | Fully supported |
| Safari 14+ | ✅ Good | Slightly slower |
| Edge 90+ | ✅ Excellent | Chromium-based |

---

## Citation

If you use Q-Shape in your research, please cite:

**APA:**
```
Castro Silva Junior, H. (2026). Q-Shape - Quantitative Shape Analyzer (v1.5.0).
Zenodo. https://doi.org/10.5281/zenodo.18209621
```

**BibTeX:**
```bibtex
@software{qshape2025,
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

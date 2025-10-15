# Q-Shape - Quantitative Shape Analyzer

<div align="center">

![Q-Shape Logo](https://img.shields.io/badge/Q--Shape-Molecular%20Geometry%20Analysis-blue?style=for-the-badge&logo=react&logoColor=white)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://choosealicense.com/licenses/mit/)
[![React Version](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r147-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/graphs/commit-activity)
[![Website](https://img.shields.io/website?down_color=red&down_message=offline&style=flat-square&up_color=green&up_message=online&url=https%3A%2F%2Fhenriquecsj.github.io%2Fq-shape)](https://henriquecsj.github.io/q-shape)
[![GitHub Stars](https://img.shields.io/github/stars/HenriqueCSJ/q-shape?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/HenriqueCSJ/q-shape?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/HenriqueCSJ/q-shape?style=flat-square)](https://github.com/HenriqueCSJ/q-shape/commits/main)

**🔬 Advanced Coordination Geometry Analysis with Complete SHAPE 2.1 Coverage**

[**Live Demo**](https://henriquecsj.github.io/q-shape) · [**Report Bug**](https://github.com/HenriqueCSJ/q-shape/issues) · [**Request Feature**](https://github.com/HenriqueCSJ/q-shape/issues)

<img src="https://github.com/HenriqueCSJ/q-shape/assets/demo.gif" alt="Q-Shape Demo" width="800"/>

</div>

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [💻 Installation](#-installation)
- [📖 Documentation](#-documentation)
- [🧪 Usage Examples](#-usage-examples)
- [⚙️ Technical Details](#️-technical-details)
- [📊 Performance](#-performance)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👨‍🔬 Author](#-author)
- [🙏 Acknowledgments](#-acknowledgments)

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Core Features
- ✅ **82 Reference Geometries** (CN 2-12)
- ✅ **Improved Kabsch Alignment**
- ✅ **Optimized Hungarian Algorithm**
- ✅ **Multi-stage Optimization**
- ✅ **Real-time 3D Visualization**
- ✅ **Automatic Metal Detection**
- ✅ **Smart Radius Optimization**
- ✅ **Dual Analysis Modes**

</td>
<td width="50%">

### 📊 Analysis Metrics
- 📈 Continuous Shape Measures (CShM)
- 📐 Angular Distortion Index
- 📏 Bond Length Statistics
- 🎯 Quality Scoring System
- 📉 RMSD Calculations
- 🔄 Bond Uniformity Index
- 📊 L-M-L Angle Analysis
- 📄 Professional PDF Reports

</td>
</tr>
</table>

### 🎨 Visual Features

<div align="center">
<img src="https://img.shields.io/badge/3D%20Rendering-Three.js-black?style=for-the-badge&logo=three.js"/>
<img src="https://img.shields.io/badge/Interactive-OrbitControls-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Overlays-Ideal%20Geometries-green?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Labels-Atomic%20Symbols-red?style=for-the-badge"/>
</div>

---

## 🚀 Quick Start

### Online Version (Recommended)
Visit [https://henriquecsj.github.io/q-shape](https://henriquecsj.github.io/q-shape)

### Local Installation

```bash
# Clone and setup
git clone https://github.com/HenriqueCSJ/q-shape.git
cd q-shape
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Installation

### System Requirements

![Node.js](https://img.shields.io/badge/Node.js-16.0%2B-339933?style=flat-square&logo=node.js)
![npm](https://img.shields.io/badge/npm-8.0%2B-CB3837?style=flat-square&logo=npm)
![Memory](https://img.shields.io/badge/RAM-4GB%2B-blue?style=flat-square)
![Browser](https://img.shields.io/badge/WebGL-Required-orange?style=flat-square)

### Detailed Setup

```bash
# Clone repository
git clone https://github.com/HenriqueCSJ/q-shape.git
cd q-shape

# Install dependencies
npm install
# or using yarn
yarn install

# Development server with hot reload
npm start
# or
yarn start

# Production build
npm run build
# or
yarn build

# Run tests
npm test
# or
yarn test

# Deploy to GitHub Pages
npm run deploy
# or
yarn deploy
```

### Docker Installation

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npx", "serve", "-s", "build"]
```

```bash
docker build -t q-shape .
docker run -p 3000:3000 q-shape
```

---

## 📖 Documentation

### Input Format

Q-Shape accepts standard XYZ molecular structure files:

```xyz
<number of atoms>
<comment line (optional)>
<element> <x-coordinate> <y-coordinate> <z-coordinate>
...
```

#### Example Files

<details>
<summary>📁 Octahedral Fe Complex</summary>

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

</details>

<details>
<summary>📁 Square Planar Pt Complex</summary>

```xyz
5
Platinum tetrachloride
Pt   0.000   0.000   0.000
Cl   2.300   0.000   0.000
Cl  -2.300   0.000   0.000
Cl   0.000   2.300   0.000
Cl   0.000  -2.300   0.000
```

</details>

### Output Interpretation

| CShM Range | Quality | Description | Color |
|------------|---------|-------------|-------|
| 0.00-0.10 | Perfect | Ideal geometry | 🟢 Green |
| 0.10-0.50 | Excellent | Near-ideal | 🟢 Green |
| 0.50-1.50 | Very Good | Minimal distortion | 🟢 Green |
| 1.50-3.00 | Good | Slight distortion | 🟡 Yellow |
| 3.00-7.50 | Moderate | Notable distortion | 🟡 Yellow |
| 7.50-15.0 | Poor | Significant distortion | 🟠 Orange |
| >15.0 | Very Poor | No match | 🔴 Red |

---

## 🧪 Usage Examples

### Basic Workflow

```javascript
// 1. Load your XYZ file
// 2. Auto-detection finds metal center
// 3. Coordination sphere identified
// 4. Analysis runs automatically
// 5. Results displayed in real-time
```

### Analysis Modes

#### Standard Mode (Default)
- ⚡ Fast analysis (~5-10 seconds)
- ✅ Good for routine work
- 📊 Sufficient for most structures

#### Intensive Mode
- 🔬 High precision (~20-30 seconds)
- 📈 Extended optimization cycles
- 📚 Publication-quality results
- 🎯 Recommended for distorted geometries

### Report Generation

Click **"📄 Generate Report"** to create a comprehensive PDF including:
- 3D structure visualization
- Complete geometry analysis
- Quality metrics
- Bond statistics
- Coordinating atoms table
- Citation information

---

## ⚙️ Technical Details

### Algorithms Implementation

<details>
<summary>🔧 Shape Measure Calculation</summary>

The continuous shape measure S(Q,P) quantifies deviation from ideal geometry P:

```math
S(Q,P) = min[Σ|Qi - Pi|²/Σ|Q0i|²] × 100
```

Where:
- Q = actual geometry (normalized)
- P = reference geometry
- Minimization over all permutations σ and rotations R

</details>

<details>
<summary>🔧 Kabsch Alignment with Jacobi SVD</summary>

```javascript
// Improved numerical stability using Jacobi SVD
function kabschAlignment(P, Q) {
    // 1. Center both point sets
    // 2. Compute covariance matrix H
    // 3. Jacobi SVD: H = UΣV^T
    // 4. Optimal rotation: R = VU^T
    // 5. Handle reflection cases (det(R) < 0)
}
```

</details>

<details>
<summary>🔧 Optimization Pipeline</summary>

1. **Initial Alignment**: Kabsch method with Hungarian pre-matching
2. **Grid Search**: Systematic Euler angle sampling
3. **Simulated Annealing**: Temperature-based global optimization
4. **Local Refinement**: Gradient descent fine-tuning

</details>

### Reference Geometries (SHAPE 2.1)

| CN | Count | Examples |
|----|-------|----------|
| 2 | 3 | Linear, V-shape, L-shape |
| 3 | 4 | Trigonal planar, Pyramid, T-shaped |
| 4 | 4 | Tetrahedral, Square planar, Seesaw |
| 5 | 5 | Trigonal bipyramidal, Square pyramid |
| 6 | 5 | Octahedral, Trigonal prism |
| 7 | 7 | Pentagonal bipyramid, Capped octahedron |
| 8 | 13 | Cube, Square antiprism, Dodecahedron |
| 9 | 13 | Tricapped trigonal prism, Capped cube |
| 10 | 13 | Pentagonal prism/antiprism, Bicapped cube |
| 11 | 7 | Various capped structures |
| 12 | 13 | Icosahedron, Cuboctahedron, Hexagonal prism |

**Total: 82 reference geometries**

---

## 📊 Performance

### Benchmarks

| Structure Size | Standard Mode | Intensive Mode | Memory Usage |
|---------------|---------------|----------------|--------------|
| Small (< 20 atoms) | 2-5 sec | 10-15 sec | ~50 MB |
| Medium (20-50 atoms) | 5-10 sec | 15-25 sec | ~100 MB |
| Large (50-100 atoms) | 10-20 sec | 25-45 sec | ~200 MB |

### Browser Compatibility

| Browser | Support | Performance |
|---------|---------|-------------|
| Chrome 90+ | ✅ Full | Excellent |
| Firefox 88+ | ✅ Full | Excellent |
| Safari 14+ | ✅ Full | Good |
| Edge 90+ | ✅ Full | Excellent |
| Opera 76+ | ✅ Full | Good |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

### Development Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/q-shape.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git add .
git commit -m 'Add amazing feature'

# Push to branch
git push origin feature/amazing-feature

# Open Pull Request
```

### Code Style

- 📝 ESLint configuration included
- 🎨 Prettier for formatting
- 📖 JSDoc comments required
- ✅ Tests for new features

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

```
MIT License

Copyright (c) 2025 Henrique C. S. Junior

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 👨‍🔬 Author

<div align="center">

**Prof. Dr. Henrique C. S. Junior**

[![ORCID](https://img.shields.io/badge/ORCID-0000--0000--0000--0000-green?style=for-the-badge&logo=orcid)](https://orcid.org/YOUR-ORCID)
[![Email](https://img.shields.io/badge/Email-henrique%40ufrrj.br-red?style=for-the-badge&logo=gmail)](mailto:henrique@ufrrj.br)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/YOUR-PROFILE)

**Universidade Federal Rural do Rio de Janeiro (UFRRJ)**  
Department of Fundamental Chemistry  
Seropédica, RJ, Brazil

</div>

---

## 🙏 Acknowledgments

- 🏛️ **UFRRJ** - Universidade Federal Rural do Rio de Janeiro
- 🧪 **Department of Fundamental Chemistry**
- 📚 Original SHAPE developers (Universitat de Barcelona)
- 🎨 Three.js community
- 🤝 All contributors and users

### Citations

If you use Q-Shape, please cite:

```bibtex
@software{qshape2025,
  author = {Junior, Henrique C. S.},
  title = {Q-Shape: Quantitative Shape Analyzer},
  year = {2025},
  url = {https://github.com/HenriqueCSJ/q-shape}
}
```

### Related Publications

1. Pinsky & Avnir, *Inorg. Chem.* **1998**, 37, 5575
2. Alvarez et al., *Coord. Chem. Rev.* **2005**, 249, 1693
3. SHAPE 2.1, Universitat de Barcelona, 2013

---

<div align="center">

**Made with ❤️ at UFRRJ**

[![GitHub Watchers](https://img.shields.io/github/watchers/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/watchers)
[![GitHub Forks](https://img.shields.io/github/forks/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/network/members)
[![GitHub Stars](https://img.shields.io/github/stars/HenriqueCSJ/q-shape?style=social)](https://github.com/HenriqueCSJ/q-shape/stargazers)

</div>

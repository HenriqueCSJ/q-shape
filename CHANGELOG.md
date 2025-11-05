# Changelog

All notable changes to Q-Shape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-05

### 🐛 Critical Bug Fixes

#### Fixed: ALL_METALS Incorrectly Included Nonmetals (CRITICAL)
- **Problem:** The filter `data.type.toLowerCase().includes('metal')` matched 'Nonmetal' and 'Metalloid'
- **Impact:** H, C, N, O, P, S and 13 other nonmetals were classified as metals
- **Fix:** Changed to `data.type.endsWith(' Metal')` to match only actual metals
- **Result:** ALL_METALS reduced from 99 (incorrect) to 85 (correct) elements
- **File:** `src/constants/atomicData.js`

#### Fixed: Metal Detection Selected Ligands Over Metals (CRITICAL)
- **Problem:** Highly-coordinated nitrogen atoms could be selected over transition metals, lanthanides, and actinides
- **Impact:** User's La complex selected N instead of La; any bridging ligand could outscore the metal
- **Fix:** Implemented weighted scoring system (metals: base 1000 + neighbors; non-metals: 0 + neighbors)
- **Result:** Metals ALWAYS selected unless structure contains no metals
- **File:** `src/services/coordination/metalDetector.js`

#### Fixed: Polyhedron Vanishing After Intensive Analysis (CRITICAL)
- **Problem:** Intensive analysis results didn't include `refCoords` property required for rendering
- **Impact:** Ideal geometry overlay disappeared after running intensive analysis
- **Fix:** Added `refCoords` to all result objects in pattern geometry builders
- **Result:** Polyhedron persists correctly after intensive analysis
- **Files:** `src/services/coordination/patterns/geometryBuilder.js`

#### Fixed: State Cleanup on File Upload
- **Problem:** Intensive analysis metadata lingered when loading new structures
- **Fix:** Added reset for `intensiveMetadata` and `intensiveProgress` on file upload
- **File:** `src/App.js`

### ✨ New Features

#### Comprehensive Test Suite
- Added **116 automated tests** covering critical functionality
- **88 tests** for `atomicData.js` and ALL_METALS bug fix
- **28 tests** for `metalDetector.js` and scoring system
- All tests passing ✅
- Tests ensure bugs stay fixed forever

#### GitHub Actions CI/CD
- Automated testing on every commit
- Tests run on Node.js 18 and 20
- Build verification before merging
- Prevents regressions and ensures code quality

#### Enhanced PDF Reports
- Added intensive analysis metadata section
- Shows detected structural patterns (sandwich, piano stool, macrocycle)
- Displays ligand group details and ring information
- Highlights sandwich structures with explanatory text

### 📖 Documentation

- Added comprehensive publication roadmap (`docs/development/PUBLICATION_ROADMAP.md`)
- Documented all bug fixes in detail (`docs/development/BUGFIX_FERROCENE_20250105.md`)
- Created session progress reports
- Organized development documentation in `docs/development/`

### 🔧 Improvements

- Fixed two-column grid layout for intensive analysis metadata
- Improved metal detection logging with detailed scores
- Better edge case handling (NaN, Infinity coordinates)

### 📦 Internal

- Reorganized development documentation
- Simplified CI/CD workflows for reliability
- Removed Node 16 support (EOL)

### 🧪 Testing

Run the test suite:
```bash
npm test
```

All 116 tests pass ✅

### 📊 Statistics

- **Bugs fixed:** 3 critical
- **Tests added:** 116
- **Files modified:** 11
- **Lines of code added:** ~1,400
- **Test coverage:** Critical paths 100%

---

## [1.2.1] - 2024-10-27

### Fixed
- Critical infinite loops in coordination sphere detection
- Auto-radius toggle state management
- Button states that broke functionality in v1.1.0

### Improved
- Modular architecture with clean separation of concerns
- Comprehensive inline documentation

### Added
- Precise radius control with text input
- Adjustable step size (±0.50, ±0.10, ±0.05, ±0.01 Å)
- Find Radius by CN feature with gap detection algorithm
- Official Zenodo DOI: [10.5281/zenodo.17448252](https://doi.org/10.5281/zenodo.17448252)

---

## [1.1.0] - 2024-10-20

### Added
- Enhanced radius control system
- Find optimal radius by coordination number
- Step size selector for fine-tuned adjustments
- Modular codebase architecture

---

## [1.0.0] - 2024-09-15

### Added
- Initial release
- 87 reference geometries (CN 2-12)
- Continuous Shape Measure (CShM) analysis
- Interactive 3D visualization
- Automatic metal detection
- PDF report generation
- Real-time geometry analysis
- Dual analysis modes (standard/intensive)

---

## Links

- **Repository:** https://github.com/HenriqueCSJ/q-shape
- **Live Demo:** https://henriquecsj.github.io/q-shape
- **DOI:** https://doi.org/10.5281/zenodo.17448252
- **Issues:** https://github.com/HenriqueCSJ/q-shape/issues
- **Changelog:** https://github.com/HenriqueCSJ/q-shape/blob/main/CHANGELOG.md

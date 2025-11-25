# Changelog

All notable changes to Q-Shape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2025-11-25

### 🎯 Overview

**Publication-Ready Refactoring Release** - This release transforms Q-Shape into publication-quality scientific software through comprehensive refactoring, proper algorithm implementation, and extensive testing. All 4 publication blockers identified in code review have been resolved.

### 🏗️ Major Refactoring

#### App.js Decomposition (1,809 → 416 lines, -77%)
- **Extracted 5 new React components:**
  - `src/components/AnalysisControls.jsx` (185 lines) - Analysis mode and settings
  - `src/components/CoordinationSummary.jsx` (351 lines) - Coordination sphere display
  - `src/components/FileUploadSection.jsx` (26 lines) - File upload handling
  - `src/components/ResultsDisplay.jsx` (192 lines) - Shape analysis results
  - `src/components/Visualization3D.jsx` (100 lines) - 3D molecular viewer
- **Extracted report generator service:**
  - `src/services/reportGenerator.js` (711 lines) - PDF generation logic
- **Benefits:**
  - Clean separation of concerns
  - Improved testability
  - Better maintainability
  - Follows React best practices

### 🐛 Critical Algorithm Fix

#### Hungarian Algorithm Replacement (CRITICAL)
- **Problem:** Previous implementation only used greedy matching with incomplete Hungarian fallback
- **Impact:** Could produce suboptimal atom-vertex assignments for coordination numbers > 3
- **Fix:** Replaced with `munkres-js` library - industry-standard, well-tested implementation
- **Result:** Guarantees optimal assignment in O(n³) time
- **File:** `src/services/algorithms/hungarian.js`
- **References:**
  - Kuhn, H. W. (1955). "The Hungarian Method for the assignment problem"
  - munkres-js: https://github.com/addaleax/munkres-js

### 🔧 Code Quality Improvements

#### Magic Numbers Extraction
- **Created:** `src/constants/algorithmConstants.js` (517 lines)
- **Centralized configuration for:**
  - Kabsch algorithm parameters (convergence thresholds, tolerances)
  - Shape measure quality score ranges
  - Numerical stability constants
  - Ring detection parameters
  - Gap detection thresholds
- **Benefits:**
  - No more hardcoded values scattered in code
  - Single source of truth for all constants
  - Better maintainability and documentation
- **Files modified:** 5 algorithm files updated to use centralized constants

### 🧪 Comprehensive Testing

#### Added 5 New Test Suites (142 additional tests)
- **`src/services/algorithms/kabsch.test.js`** (604 lines, 40+ tests)
  - Rotation matrix alignment correctness
  - Orthogonality verification
  - RMSD calculations
  - Edge cases (collinear points, numerical stability)

- **`src/services/shapeAnalysis/shapeCalculator.test.js`** (557 lines, 50+ tests)
  - Shape measure calculations
  - Perfect geometry validation (S ≈ 0)
  - Distorted geometry detection
  - Edge cases (duplicate atoms, degenerate cases)

- **`src/services/coordination/ringDetector.test.js`** (499 lines, 30+ tests)
  - Cyclopentadienyl ring detection
  - Ferrocene analysis (staggered/eclipsed)
  - Bond connectivity
  - Ring planarity validation

- **`src/utils/fileParser.test.js`** (366 lines, 25+ tests)
  - XYZ file format parsing
  - Coordinate validation
  - Error handling
  - Edge cases (malformed files, special characters)

- **`src/services/algorithms/hungarian.test.js`** (271 lines, 20+ tests)
  - Assignment optimality verification
  - Cost matrix handling
  - munkres-js integration testing

#### Test Statistics
- **Total tests:** 258 (was 116, +122%)
- **Test files:** 7 (was 2, +250%)
- **All tests passing:** ✅
- **Coverage:** Critical algorithms 100%

### 📖 Documentation

#### Publication Readiness Assessment
- **Added:** `docs/development/CODE_REVIEW_PUBLICATION_READINESS.md` (440 lines)
- **Contents:**
  - Comprehensive code quality assessment
  - Identified 4 publication blockers
  - Detailed remediation plan
  - All blockers now resolved

#### Updated Files
- `README.md` - v1.4.0 release highlights
- `CITATION.cff` - Version and date updated
- `.zenodo.json` - Version metadata updated
- `package.json` - Version bump

### 📊 Statistics

- **Files changed:** 23 files
- **Lines added:** +5,043
- **Lines removed:** -1,612
- **Net change:** +3,431 lines
- **Commits:** 6 refactoring commits
- **Build time:** 6.4 seconds
- **Bundle size:** 193.16 kB (gzipped)

### ✅ Quality Assurance

- [x] All 258 tests passing
- [x] Production build successful
- [x] No console errors or warnings
- [x] Code follows ESLint guidelines
- [x] Breaking changes: None
- [x] Backward compatible: Yes

### 🔬 Publication Impact

This release resolves all publication blockers:

1. ✅ **Hungarian algorithm** - Now properly implemented with proven library
2. ✅ **App.js monolith** - Decomposed into modular, testable components
3. ✅ **Test coverage** - Comprehensive tests for all critical algorithms
4. ✅ **Magic numbers** - Centralized in dedicated constants file

**The codebase is now ready for peer-reviewed journal submission.**

### 🚀 Migration Guide

No breaking changes. Update by:
```bash
git pull origin main
npm install  # munkres-js added as dependency
npm test     # Verify all 258 tests pass
npm run build  # Build for production
```

---

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

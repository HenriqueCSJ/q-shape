# Changelog

All notable changes to Q-Shape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-01-28

### 🎯 Overview

**Multi-Structure Batch Analysis & Piano Stool Complex Support** - This major release introduces comprehensive batch analysis for multi-structure files (XYZ and CIF), along with support for half-sandwich (piano stool) complexes.

### ✨ New Features

#### Multi-Structure Batch Analysis (Major Feature)
- **Problem:** Users could only analyze one structure at a time, making it tedious to analyze files with multiple conformers or structures
- **Solution:** Full batch analysis mode with parallel structure handling
- **Implementation:**
  - New `useFileUpload` hook with multi-structure support
  - New `useBatchAnalysis` hook for orchestrating batch operations
  - Unified input parser supporting multi-structure XYZ and CIF files
  - New data model with `Structure` and `ParsedFile` types

**New Components:**
- `BatchModePanel.jsx` - Structure selector and batch controls
- `BatchSummaryTable.jsx` - Visual overview of all analyzed structures
- `ManualOverridePanel.jsx` - Per-structure parameter overrides

**Batch Report Features:**
- Comprehensive batch PDF report with per-structure details
- Q-Shape analysis overview for each structure
- Quality Metrics, Bond Statistics, Coordinating Atoms tables
- Ligand Groups Analysis section
- Wide summary CSV export (one row per structure)
- Long detailed CSV export (all geometries for all structures)

**UI Improvements:**
- Context-aware action buttons (batch vs single mode)
- Progress tracking for batch operations
- Softer color scheme for selected rows
- TrackballControls for unrestricted 360° 3D rotation

#### Piano Stool (Half-Sandwich) Complex Recognition
- **Problem:** Piano stool complexes like [CpMn(CO)₃] were analyzed as CN=8 (all atoms separately), giving poor CShM values (>15.0)
- **Solution:** Automatic pattern detection and geometry-aware analysis
- **Implementation:**
  - Added `PIANO_STOOL_GEOMETRIES` mapping to `algorithmConstants.js`
  - Enhanced `buildPianoStoolGeometry()` function in `geometryBuilder.js`
  - Intelligent geometry selection based on coordination number

**Piano Stool Geometry Mappings:**
- **CN=3:** T-shaped (vT-3), Trigonal planar (TP-3)
- **CN=4:** Vacant trigonal bipyramid (vTBPY-4), Seesaw (SS-4), Tetrahedral (T-4)
- **CN=5:** Square pyramidal (SPY-5), Trigonal bipyramid (TBPY-5), Vacant octahedron (vOC-5)
- **CN=6:** Vacant pentagonal bipyramid (vPBP-6), Octahedral (OC-6)
- **CN=7:** Pentagonal bipyramid (PBPY-7), Capped octahedron (COC-7)

**Improvement in Results:**
| Complex | Before (Point-Based) | After (Centroid-Based) | Improvement |
|---------|---------------------|------------------------|-------------|
| [CpMn(CO)₃] | CN=8, CShM≈18.5 (Very Poor) | CN=4, CShM≈2.1 (Good) | **16.4 points** |
| [CpFe(CO)₂I] | CN=8, CShM≈16.2 (Very Poor) | CN=4, CShM≈3.4 (Good) | **12.8 points** |

### 📝 Documentation

#### New Documentation Files
- **`docs/development/PIANO_STOOL_SUPPORT.md`** - Comprehensive documentation:
  - Overview of piano stool complexes
  - Implementation details
  - Centroid-based analysis explanation
  - Usage examples and expected results
  - Comparison with SHAPE 2.1
  - Literature references

### 🧪 Testing

#### New Test Files
- **`tests/test-piano-stool.js`** - Piano stool complex validation
  - Pattern detection verification
  - Coordination number analysis
  - Geometry selection testing

- **`tests/CpMn_CO3.xyz`** - Test structure for [CpMn(CO)₃] (Cymantrene)

### 🔧 Technical Details

**Modified Files:**
- `src/constants/algorithmConstants.js` - Added `PIANO_STOOL_GEOMETRIES` constant
- `src/services/coordination/patterns/geometryBuilder.js` - Implemented intelligent geometry filtering

**Key Algorithm Changes:**
1. Piano stool patterns detected with 85% confidence
2. Centroid-based coordination number calculation
3. Geometry filtering to piano stool-appropriate shapes
4. In intensive mode, all geometries evaluated for comparison
5. Results sorted by CShM (best match first)

### 🎨 Benefits

**Advantages over SHAPE 2.1:**
1. ✅ **Automatic recognition** of piano stool patterns
2. ✅ **Intelligent geometry selection** based on structure type
3. ✅ **Better CShM values** through centroid-based analysis
4. ✅ **Faster analysis** by testing only relevant geometries
5. ✅ **Clear interpretation** with pattern-specific feedback

**Common Piano Stool Examples Now Supported:**
- [CpMn(CO)₃] - Cymantrene
- [CpFe(CO)₂X] - Monosubstituted ferrocene derivatives
- [(η⁶-C₆H₆)Ru(Cl)₃]⁺ - Ruthenium arene complexes
- [(η⁵-Cp)Rh(C₂H₄)₂] - Rhodium half-sandwich complexes
- [CpMo(CO)₃H] - Molybdenum piano stool hydrides

### 📚 References

**Literature:**
- Cotton, F. A. et al. (1999). *Advanced Inorganic Chemistry*, 6th ed.
- Housecroft, C. E. & Sharpe, A. G. (2012). *Inorganic Chemistry*, 4th ed.

**Related Features:**
- Sandwich complex support (ferrocene, etc.)
- Macrocycle support (porphyrins, corrins)
- Ring detection (η³-η⁷ hapto ligands)
- Intensive analysis system

---

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
- Official Zenodo DOI: [10.5281/zenodo.17717110](https://doi.org/10.5281/zenodo.17717110)

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
- **DOI:** https://doi.org/10.5281/zenodo.17717110
- **Issues:** https://github.com/HenriqueCSJ/q-shape/issues
- **Changelog:** https://github.com/HenriqueCSJ/q-shape/blob/main/CHANGELOG.md

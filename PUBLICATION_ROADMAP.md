# Q-Shape Publication Roadmap

## Target: High-Impact Computational Chemistry Journal
**Estimated Timeline:** 6-12 months

---

## Phase 1: Critical Fixes & Stabilization (1-2 months)

### 1.1 Code Stability ✅ COMPLETED
- [x] Fix ALL_METALS bug (H, C, N, O incorrectly classified)
- [x] Fix ferrocene analysis (property name mismatch)
- [x] Fix polyhedron rendering (missing refCoords)
- [x] Fix state cleanup on file upload

### 1.2 Remaining Code Quality (2 weeks)
- [ ] Add comprehensive error handling
- [ ] Remove all console warnings visible to users
- [ ] Refactor long functions (>100 lines)
- [ ] Add input validation for all user inputs
- [ ] Implement proper loading states
- [ ] Add user-friendly error messages

### 1.3 Testing Framework (2 weeks)
- [ ] Set up Jest for unit testing
- [ ] Write tests for all utility functions
  - [ ] kabsch.js (100% coverage)
  - [ ] hungarian.js (100% coverage)
  - [ ] metalDetector.js (100% coverage)
  - [ ] ringDetector.js (100% coverage)
  - [ ] patterns/*.js (100% coverage)
- [ ] Integration tests for full workflow
- [ ] Edge case tests
- [ ] Set up GitHub Actions for CI/CD

---

## Phase 2: Validation & Benchmarking (2-3 months)

### 2.1 Benchmark Dataset Creation (3 weeks)
- [ ] Collect 100-200 structures from CSD
- [ ] Include diverse coordination numbers (CN 2-12)
- [ ] Include diverse metals (3d, 4d, 5d, f-block)
- [ ] Include edge cases:
  - [ ] Jahn-Teller distorted
  - [ ] π-coordinated (ferrocenes, sandwich)
  - [ ] Macrocycles (porphyrins)
  - [ ] Highly distorted geometries
  - [ ] Perfect ideal geometries
- [ ] Obtain SHAPE 2.1 results for all structures
- [ ] Document CSD refcodes and literature sources
- [ ] Upload dataset to Zenodo with DOI

### 2.2 Systematic Validation (4 weeks)
- [ ] Run Q-Shape on all benchmark structures
- [ ] Compare with SHAPE 2.1 outputs
- [ ] Statistical analysis:
  - [ ] Mean absolute error (MAE)
  - [ ] Root mean square error (RMSE)
  - [ ] Correlation coefficient (R²)
  - [ ] Paired t-tests
  - [ ] Bland-Altman plots
- [ ] Categorize by coordination number
- [ ] Identify problematic cases
- [ ] Document discrepancies and explanations

### 2.3 Fix Geometric Discrepancies (3 weeks)
- [ ] Investigate 4 problematic ML8 geometries:
  - [ ] JBTP-8 (68.9% error)
  - [ ] JSD-8 (81.5% error)
  - [ ] BTPR-8 (36.4% error)
  - [ ] JGBF-8 (61.6% error)
- [ ] Contact SHAPE developers or cosymlib team
- [ ] Obtain correct reference coordinates
- [ ] Validate against literature values
- [ ] Re-run validation after fixes

### 2.4 Performance Benchmarking (2 weeks)
- [ ] Time all 100-200 benchmark structures
- [ ] Compare with SHAPE 2.1 execution times
- [ ] Analyze scalability (CN 2-12)
- [ ] Memory usage profiling
- [ ] Browser compatibility testing
- [ ] Create performance comparison tables
- [ ] Generate timing plots

---

## Phase 3: Enhanced Features & Documentation (1-2 months)

### 3.1 New Features (Optional but valuable)
- [ ] Batch analysis mode (multiple files)
- [ ] JSON export format
- [ ] Command-line interface (Node.js)
- [ ] REST API endpoint (optional)
- [ ] Uncertainty quantification
- [ ] Ensemble analysis

### 3.2 Comprehensive Documentation (4 weeks)
- [ ] User Manual (20-30 pages)
  - [ ] Installation guide
  - [ ] Step-by-step tutorial
  - [ ] Example workflows
  - [ ] FAQ section
  - [ ] Troubleshooting guide
- [ ] Developer Guide
  - [ ] Architecture overview
  - [ ] API documentation
  - [ ] Contributing guidelines
  - [ ] Code style guide
- [ ] Theory Documentation
  - [ ] Mathematical foundations
  - [ ] Algorithm descriptions
  - [ ] Validation methodology
- [ ] Video Tutorial (10-15 min)

### 3.3 Reproducibility Package (2 weeks)
- [ ] Docker container
  - [ ] Dockerfile with all dependencies
  - [ ] docker-compose for easy deployment
  - [ ] Testing instructions
- [ ] Package version locking
  - [ ] Commit package-lock.json
  - [ ] Document all dependencies
  - [ ] Test on clean install
- [ ] Archived release
  - [ ] Create v2.0.0 release
  - [ ] Upload to Zenodo
  - [ ] Update DOI in manuscript

---

## Phase 4: Manuscript Preparation (2-3 months)

### 4.1 Manuscript Structure

**Title:** "Q-Shape: A Web-Based Tool for Continuous Shape Measure Analysis with Enhanced Support for π-Coordinated Structures"

**Sections:**

1. **Abstract** (250 words)
   - Brief background
   - Problem statement
   - Novel contributions
   - Key results
   - Significance

2. **Introduction** (1-2 pages)
   - Importance of coordination geometry
   - Limitations of existing tools (SHAPE 2.1)
   - Need for web-based, accessible software
   - Novel contributions (pattern-based, centroid-based)

3. **Methods** (3-4 pages)
   - CShM theory
   - Kabsch algorithm implementation
   - Hungarian algorithm optimization
   - Pattern detection algorithms
   - Centroid-based analysis for π-coordination
   - Software architecture
   - Validation methodology

4. **Results** (3-4 pages)
   - Validation against SHAPE 2.1
   - Benchmark dataset analysis
   - Performance comparisons
   - Case studies (ferrocene, porphyrins, etc.)
   - Statistical analysis

5. **Discussion** (2-3 pages)
   - Accuracy and reliability
   - Advantages over SHAPE 2.1
   - Limitations
   - Future developments

6. **Conclusions** (1 page)
   - Summary of achievements
   - Impact on field
   - Availability

7. **Supporting Information** (online)
   - Full benchmark dataset
   - Complete validation tables
   - Algorithm pseudocode
   - User manual
   - Source code availability

### 4.2 Figures & Tables (High-Quality)

**Required Figures:**
- [ ] Figure 1: Software architecture diagram
- [ ] Figure 2: Workflow schematic
- [ ] Figure 3: Validation scatter plots (Q-Shape vs SHAPE)
- [ ] Figure 4: Bland-Altman plot
- [ ] Figure 5: Case study examples (ferrocene, etc.)
- [ ] Figure 6: Performance benchmarks
- [ ] Figure 7: UI screenshots

**Required Tables:**
- [ ] Table 1: Reference geometries (all 87)
- [ ] Table 2: Validation statistics by CN
- [ ] Table 3: Benchmark results (top 20 structures)
- [ ] Table 4: Performance comparison
- [ ] Table 5: Feature comparison with existing tools

### 4.3 Target Journals (Ranked)

**Tier 1 (High Impact):**
1. **Journal of Chemical Information and Modeling** (IF ~5.5)
   - Ideal fit for computational chemistry software
   - Emphasis on validation and benchmarking
2. **Journal of Computational Chemistry** (IF ~3.0)
   - Established journal for software papers
   - Good peer-review process
3. **Chemical Science** (IF ~9.0)
   - Open access, high visibility
   - Edge article format suitable

**Tier 2 (Specialized):**
4. **Journal of Applied Crystallography** (IF ~4.0)
   - Geometry analysis focus
   - Computational tools section
5. **Inorganic Chemistry** (IF ~5.0)
   - If emphasizing coordination chemistry
6. **SoftwareX** (IF ~2.5)
   - Dedicated software journal
   - Lower barrier, faster publication

### 4.4 Manuscript Writing Timeline

| Week | Task |
|------|------|
| 1-2 | Methods section draft |
| 3-4 | Results section + figures |
| 5-6 | Introduction + discussion |
| 7 | Abstract + conclusions |
| 8 | Supporting information |
| 9 | Internal review + revisions |
| 10 | Final proofreading |
| 11 | Submission preparation |
| 12 | Submit! |

---

## Phase 5: Submission & Revision (3-6 months)

### 5.1 Pre-Submission Checklist
- [ ] All authors approved
- [ ] Conflicts of interest declared
- [ ] Data availability statement
- [ ] Code availability statement
- [ ] Funding acknowledgments
- [ ] ORCID IDs for all authors
- [ ] Cover letter prepared
- [ ] Suggested reviewers list
- [ ] Figures in correct format
- [ ] SI files prepared

### 5.2 Response to Reviewers
- [ ] Address all reviewer comments point-by-point
- [ ] Run additional validations if requested
- [ ] Revise manuscript
- [ ] Update SI
- [ ] Prepare rebuttal letter

---

## Critical Success Factors

### Must-Have for Acceptance:
1. ✅ All critical bugs fixed
2. ❌ Comprehensive validation (>100 structures)
3. ❌ Statistical analysis of accuracy
4. ❌ Performance benchmarks vs SHAPE 2.1
5. ❌ Geometric discrepancies resolved (ML8)
6. ❌ Automated testing (CI/CD)
7. ❌ Reproducibility package (Docker)
8. ❌ Complete documentation
9. ❌ Well-written manuscript

### Nice-to-Have (Strengthens Paper):
- [ ] Novel algorithms (pattern detection formalized)
- [ ] Machine learning integration
- [ ] Multi-threading / WebAssembly optimization
- [ ] Comparison with 3+ other tools
- [ ] Community validation (external users)
- [ ] Case studies from real research

---

## Estimated Total Effort

**Full-time equivalent:** 4-6 months
**Part-time (50%):** 8-12 months

**Breakdown:**
- Validation & benchmarking: 40%
- Manuscript writing: 25%
- Code quality & testing: 20%
- Documentation: 10%
- Revision & submission: 5%

---

## Immediate Next Steps (Priority Order)

### Week 1-2: Foundation
1. Set up Jest testing framework
2. Write unit tests for critical functions
3. Set up GitHub Actions CI/CD
4. Create benchmark dataset spreadsheet

### Week 3-4: Validation
5. Collect 50 CSD structures (start small)
6. Run SHAPE 2.1 on all 50
7. Run Q-Shape on all 50
8. Create comparison tables

### Week 5-6: Fixes
9. Analyze discrepancies
10. Fix ML8 geometries if possible
11. Document limitations if unfixable

### Week 7-8: Documentation
12. Write user manual draft
13. Create tutorial videos
14. Document all algorithms mathematically

---

## Success Metrics

**Minimum Acceptable for Publication:**
- Mean error vs SHAPE < 5%
- 90% of structures match within 10%
- Test coverage > 80%
- Documented with full user manual
- Reproducible (Docker + tests pass)

**Ideal for High-Impact Journal:**
- Mean error vs SHAPE < 2%
- 95% of structures match within 5%
- Test coverage > 95%
- Novel contribution clearly demonstrated
- Community adoption (GitHub stars, users)

---

## Risk Mitigation

### Risk 1: Geometric Discrepancies Can't Be Resolved
**Mitigation:** Document as known limitations, explain mathematical reasons

### Risk 2: Validation Shows Systematic Errors
**Mitigation:** Identify patterns, fix if possible, or adjust claims

### Risk 3: Reviewers Demand Comparison with Unavailable Software
**Mitigation:** Explain access limitations, compare with available tools

### Risk 4: Timeline Extends Beyond 12 Months
**Mitigation:** Target lower-tier journal (SoftwareX) for faster publication

---

## Conclusion

Q-Shape has **strong potential** but requires **substantial work** before submission. The novel contributions (pattern-based analysis, centroid-based for π-coordination) are valuable, but the foundation must be solid.

**Realistic Assessment:**
- Current state: 60% ready
- Needed work: 4-6 months full-time equivalent
- Success probability: High IF validation and testing are thorough

**Recommended Path:**
1. Complete Phase 1-2 thoroughly (validation is CRITICAL)
2. Write manuscript during Phase 3-4
3. Target Journal of Chemical Information and Modeling or JCC
4. Expect 1-2 rounds of revisions
5. Publication in 12-18 months from now


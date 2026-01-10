# Q-Shape v1.5.0 Testing Checklist

## Automated Tests

Run all tests with:
```bash
npm test
```

### Unit Test Coverage

#### 1. File Parser (`src/utils/parseInput.test.js`)
- [x] Single XYZ parsing
- [x] Multi-frame XYZ parsing (frame count, IDs, warnings)
- [x] CIF parsing with Cartesian coordinates
- [x] CIF parsing with fractional coordinates (unit cell conversion)
- [x] Multiple CIF data blocks handling
- [x] Format auto-detection from content and extension
- [x] Error handling for malformed files
- [x] Element symbol normalization
- [x] Large coordinate warnings

#### 2. Batch Analysis
- [x] Batch run returns results per structure
- [x] Progress tracking during batch operations
- [x] Structure override storage and retrieval
- [x] Apply override to all structures

#### 3. Report Generation
- [x] Long-format CSV contains all (structure, geometry) rows
- [x] Wide-format CSV contains one row per structure
- [x] Batch PDF includes all geometries per structure

---

## Manual E2E Checklist

### Setup
1. Run `npm start`
2. Open browser to http://localhost:3000

### A. Single Structure XYZ Upload
- [ ] Upload a single-structure `.xyz` file
- [ ] Verify metal center auto-detection
- [ ] Verify coordination radius auto-detection
- [ ] Verify geometry analysis completes
- [ ] Verify 3D visualization renders correctly
- [ ] Verify "Single Structure Mode" indicator shows
- [ ] Run intensive analysis
- [ ] Generate PDF report - verify ALL geometries are included
- [ ] Export CSV - verify all geometry results are included

### B. Multi-Structure XYZ Upload
- [ ] Upload a multi-frame `.xyz` file (trajectory)
- [ ] Verify "Batch Mode: X structures detected" message appears
- [ ] Verify structure selector dropdown appears with all frames
- [ ] Switch between structures using selector
- [ ] Verify 3D visualization updates on each structure switch
- [ ] Verify analysis results update for each structure
- [ ] Verify structure ID shows in results panel
- [ ] Click "Analyze All Structures"
- [ ] Verify progress indicator shows
- [ ] Verify batch summary table populates with results
- [ ] Verify clicking a row in summary table selects that structure
- [ ] Verify selected row is highlighted in batch summary

### C. CIF File Upload
- [ ] Upload a single-block `.cif` file
- [ ] Verify atoms are NOT cramped together (proper Cartesian conversion)
- [ ] Verify metal center and geometry detection work
- [ ] Upload a multi-block `.cif` file
- [ ] Verify all blocks appear as separate structures
- [ ] Verify batch mode activates

### D. Manual Override Panel
- [ ] Click "Show Manual Overrides"
- [ ] Change metal center
- [ ] Verify analysis reruns with new metal
- [ ] Change coordination radius
- [ ] Verify CN updates
- [ ] Use "Find Radius for Target CN" feature
- [ ] In batch mode: click "Apply to all" for metal
- [ ] In batch mode: click "Apply to all" for radius

### E. Batch Export (Batch Mode Only)
- [ ] Click "Batch PDF Report"
- [ ] Verify PDF contains batch summary table
- [ ] Verify PDF contains per-structure detail sections with ALL geometries
- [ ] Click "Summary CSV (Wide)"
- [ ] Verify one row per structure with best match
- [ ] Click "All Geometries CSV (Long)"
- [ ] Verify multiple rows per structure (all geometries)
- [ ] Verify structure IDs are correct in CSV

### F. State Reset on New Upload
- [ ] Upload file A
- [ ] Run analysis, get results
- [ ] Upload file B (different file)
- [ ] Verify batch results from file A are cleared
- [ ] Verify selected structure resets to 0
- [ ] Verify no lingering data from previous file

### G. 3D Visualization Re-render
- [ ] Upload multi-structure file
- [ ] Select structure 1 - verify 3D renders correctly
- [ ] Select structure 2 - verify 3D updates/realigns
- [ ] Select structure 3 - verify 3D updates/realigns
- [ ] Select geometry 2 in results - verify ideal polyhedron updates
- [ ] Select geometry 1 in results - verify ideal polyhedron updates

### H. Intensive Analysis in Batch Mode
- [ ] Upload multi-structure file
- [ ] Select structure 2
- [ ] Run intensive analysis
- [ ] Verify intensive analysis runs for structure 2 (not structure 1)
- [ ] Verify results show for structure 2
- [ ] Verify batch results for structure 2 are updated

---

## Regression Checklist

These are bugs that occurred during development and must be prevented:

1. [ ] CIF upload does NOT produce "Invalid atom count in XYZ header" error
2. [ ] Batch UI controls appear BEFORE batch results exist (not gated on batchResults.length > 0)
3. [ ] No JSX syntax errors ("Adjacent JSX elements must be wrapped")
4. [ ] No reportGenerator.js syntax errors on build
5. [ ] No ESLint undefined variable errors (additionalMetrics, permCount)
6. [ ] No runtime error "prev is not iterable" after CIF load
7. [ ] Report/CSV exports include ALL geometries, not just best match
8. [ ] Batch results clear on new file upload
9. [ ] Polyhedra alignment updates for ALL structures/geometries selected

---

## Performance Notes

- Multi-frame files with >50 structures may be slow to batch analyze
- Intensive analysis takes ~5-30 seconds per structure depending on CN
- Batch PDF generation may take a few seconds for many structures

---

## Browser Compatibility

Tested on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

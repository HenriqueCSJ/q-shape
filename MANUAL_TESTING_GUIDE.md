# Manual Testing Guide for Phase 2 Refactoring

This guide provides step-by-step instructions for manually testing the Q-Shape application after Phase 2 refactoring.

---

## Prerequisites

- Node.js and npm installed
- Web browser (Chrome, Firefox, or Safari recommended)
- Test XYZ files (provided in this repository)

---

## Step 1: Start the Development Server

### Option A: Standard Development Server

```bash
# Make sure you're in the q-shape directory
cd /home/user/q-shape

# Start the development server
npm start
```

This will:
- Start the React development server
- Automatically open your browser to `http://localhost:3000`
- Enable hot-reloading (changes auto-refresh)

### Option B: Production Build Testing

```bash
# Build the production version
npm run build

# Serve the production build (you'll need a static server)
npx serve -s build -l 3000
```

---

## Step 2: Access the Application

Once the server starts, open your browser to:
- **URL**: `http://localhost:3000/q-shape/` or `http://localhost:3000`
- **Expected**: You should see the Q-Shape application interface

---

## Step 3: Core Functionality Testing

### Test 1: File Upload and Auto-Detection

**Test Files Provided:**
- `test-octahedral.xyz` - Fe(II) octahedral complex (CN=6)
- `test-square-planar.xyz` - Pt(II) square planar complex (CN=4)

**Steps:**
1. Click "Choose File" button
2. Select `test-octahedral.xyz`
3. File should upload successfully

**Expected Results:**
- ✅ File name appears: "test-octahedral"
- ✅ Metal center auto-detected: Fe (iron) at index 0
- ✅ Suggested radius applied automatically (should be ~2.0-3.0 Å)
- ✅ 3D visualization shows:
  - Central Fe atom (emissive metallic sphere)
  - 6 surrounding N atoms (blue spheres)
  - Bonds connecting Fe to each N
  - Atom labels (Fe, N, N, N, N, N, N)

**What to Check:**
- [ ] No errors in browser console (F12 → Console tab)
- [ ] Metal dropdown shows "Atom 0 (Fe)"
- [ ] Coordination radius field shows a value
- [ ] 3D scene renders without errors
- [ ] Can rotate the molecule with mouse drag

---

### Test 2: Shape Analysis (Standard Mode)

**Prerequisites:** Test 1 completed successfully

**Steps:**
1. Ensure "Standard" analysis mode is selected
2. Click "Calculate Shape Measures" button
3. Wait for analysis to complete

**Expected Results:**
- ✅ Progress indicator appears during analysis
- ✅ Analysis completes in 1-3 seconds
- ✅ Results table appears with multiple geometries
- ✅ Best geometry highlighted (should be "OC-6" - Octahedron)
- ✅ Shape measure values displayed (lower = better match)
- ✅ Best geometry shows green "Perfect Match!" or "Excellent Match"
- ✅ Bond statistics appear (mean distance, std dev, etc.)
- ✅ Quality score shown (0-100)

**What to Check:**
- [ ] OC-6 (Octahedron) is the best match
- [ ] Shape measure for OC-6 is close to 0.000 (perfect geometry)
- [ ] Other geometries have higher shape measures
- [ ] No errors in console

---

### Test 3: Shape Analysis (Intensive Mode)

**Prerequisites:** Test 2 completed

**Steps:**
1. Change analysis mode to "Intensive"
2. Click "Calculate Shape Measures" again
3. Wait for analysis (may take longer)

**Expected Results:**
- ✅ Analysis runs with more detailed optimization
- ✅ May take 5-10 seconds
- ✅ Results may be slightly more accurate
- ✅ Cache is cleared when switching modes

**What to Check:**
- [ ] Progress shows different stages (Kabsch, Grid Search, etc.)
- [ ] Results update after completion
- [ ] No errors during analysis

---

### Test 4: Precise Radius Input (v1.1.0 Feature)

**Prerequisites:** File uploaded

**Steps:**
1. Locate "Coordination Radius" text input field
2. Click the field and type a new value (e.g., `2.5`)
3. Press Enter or click outside the field

**Expected Results:**
- ✅ Radius updates to your entered value
- ✅ 3D visualization updates immediately
- ✅ Coordination sphere adjusts to new radius
- ✅ Coordination number updates
- ✅ Shape analysis results clear (need to re-run)

**Edge Cases to Test:**
- [ ] Enter value below 1.8 → Should warn and constrain to 1.8
- [ ] Enter value above 5.5 → Should warn and constrain to 5.5
- [ ] Enter invalid text (e.g., "abc") → Should reject
- [ ] Enter negative number → Should reject

---

### Test 5: Step Controls (v1.1.0 Feature)

**Prerequisites:** File uploaded

**Steps:**
1. Note the current radius value
2. Click the "+" button next to radius
3. Observe the radius increase
4. Click the "−" button
5. Observe the radius decrease
6. Change the step size dropdown (0.05, 0.1, 0.2, 0.5)
7. Click +/− buttons again

**Expected Results:**
- ✅ "+" button increments radius by step amount
- ✅ "−" button decrements radius by step amount
- ✅ Step size changes affect increment/decrement amount
- ✅ Radius cannot go below 1.8 or above 5.5
- ✅ Visualization updates with each change
- ✅ Coordination number updates dynamically

**What to Check:**
- [ ] Buttons work smoothly
- [ ] Step size changes take effect
- [ ] Min/max constraints enforced
- [ ] No lag or performance issues

---

### Test 6: Find Radius by CN (v1.1.0 Feature)

**Prerequisites:** `test-octahedral.xyz` uploaded

**Steps:**
1. In the "Find Radius by CN" section
2. Enter target CN: `6` (for octahedral)
3. Click "Find Optimal Radius" button
4. Observe the result

**Expected Results:**
- ✅ Algorithm finds optimal radius for CN=6
- ✅ Radius is adjusted automatically
- ✅ Message appears: "Radius set to X.XX Å for CN=6"
- ✅ Coordination sphere shows exactly 6 atoms
- ✅ Gap detection identifies the separation between inner/outer spheres

**Additional Tests:**
- **Test 6A:** Enter CN=4, click Find → Should find radius for 4 coordinating atoms
- **Test 6B:** Enter CN=10 → Should warn "Not enough neighbors"
- **Test 6C:** Test with `test-square-planar.xyz`, CN=4 → Should work perfectly

**What to Check:**
- [ ] Gap detection algorithm runs correctly
- [ ] Radius is adjusted to match target CN
- [ ] Feedback messages are clear
- [ ] Edge cases handled gracefully

---

### Test 7: 3D Visualization Controls

**Prerequisites:** File uploaded and rendered

**Steps:**
1. **Mouse Controls:**
   - Left click + drag → Rotate camera
   - Right click + drag → Pan camera
   - Scroll wheel → Zoom in/out

2. **Toggle Controls:**
   - Click "Show Labels" checkbox → Labels should appear/disappear
   - Click "Show Ideal Geometry" checkbox → Magenta overlay appears/disappears
   - Click "Auto-Rotate" checkbox → Camera should rotate automatically

**Expected Results:**
- ✅ Camera rotation is smooth
- ✅ Panning works correctly
- ✅ Zoom respects min/max distance (5-50 units)
- ✅ Labels appear above atoms when enabled
- ✅ Ideal geometry overlay shows magenta spheres + wireframe when enabled
- ✅ Auto-rotation rotates around metal center

**What to Check:**
- [ ] No lag during rotation
- [ ] Labels readable and positioned correctly
- [ ] Ideal geometry aligned with actual geometry
- [ ] Auto-rotation speed is reasonable (~1.0 speed)

---

### Test 8: PDF Report Generation

**Prerequisites:** Shape analysis completed

**Steps:**
1. Scroll to bottom of page
2. Click "Generate PDF Report" button
3. Wait for PDF generation

**Expected Results:**
- ✅ PDF downloads automatically
- ✅ File named: `{filename}_coordination_report.pdf`
- ✅ PDF contains:
   - Molecular structure info
   - 3D visualization snapshot
   - Coordination sphere details
   - Best geometry result
   - Full geometry comparison table
   - Bond statistics
   - Quality metrics
   - Analysis parameters
   - Generation timestamp

**What to Check:**
- [ ] PDF opens without errors
- [ ] All sections present and formatted correctly
- [ ] 3D snapshot captured correctly
- [ ] Data matches what's shown in the application

---

## Step 4: Advanced Testing

### Test 9: Cache Verification

**Purpose:** Verify results caching works correctly

**Steps:**
1. Upload `test-octahedral.xyz`
2. Run shape analysis (standard mode)
3. Note the time it takes
4. Change radius to 2.8 Å
5. Change radius back to original value
6. Click "Calculate Shape Measures" again

**Expected Results:**
- ✅ First analysis: Takes 1-3 seconds
- ✅ Second analysis (same params): Instant (from cache)
- ✅ Results identical both times

**What to Check:**
- [ ] Cache works (second run is instant)
- [ ] Results are identical
- [ ] No console errors

---

### Test 10: Error Handling

**Purpose:** Verify error handling is robust

**Tests to Perform:**

**10A: Invalid File Format**
- Try uploading a .txt file with random text
- Expected: Error message displayed

**10B: Empty File**
- Try uploading an empty .xyz file
- Expected: Error message about invalid format

**10C: Malformed XYZ**
- Create XYZ with wrong atom count
- Expected: Validation error

**10D: No Metal Center**
- XYZ with only non-metal atoms
- Expected: Warning about no metal detected

**What to Check:**
- [ ] Errors are user-friendly
- [ ] Application doesn't crash
- [ ] Can recover and upload valid file after error

---

### Test 11: State Management

**Purpose:** Verify state updates propagate correctly

**Steps:**
1. Upload file
2. Run analysis
3. Change metal center in dropdown
4. Observe updates
5. Change radius
6. Observe updates

**Expected Results:**
- ✅ Changing metal center:
  - Clears previous results
  - Updates visualization
  - Recalculates coordination sphere

- ✅ Changing radius:
  - Updates coordination sphere
  - Clears previous results
  - Updates visualization

**What to Check:**
- [ ] All state changes propagate correctly
- [ ] No stale data displayed
- [ ] Visualizations sync with state

---

### Test 12: Performance Testing

**Purpose:** Verify no performance regressions

**Steps:**
1. Upload file
2. Run intensive analysis
3. Monitor browser performance

**What to Check:**
- [ ] Analysis completes in reasonable time (<10 seconds)
- [ ] No frame drops during 3D rotation
- [ ] Memory doesn't grow excessively
- [ ] CPU usage returns to normal after analysis

**Tools:**
- Chrome DevTools → Performance tab
- Chrome DevTools → Memory tab
- React DevTools → Profiler tab

---

## Step 5: Browser Compatibility

Test on multiple browsers:

### Chrome/Edge (Chromium)
- [ ] All features work
- [ ] 3D rendering smooth
- [ ] No console errors

### Firefox
- [ ] All features work
- [ ] 3D rendering smooth
- [ ] No console errors

### Safari (Mac only)
- [ ] All features work
- [ ] 3D rendering smooth
- [ ] No console errors

---

## Step 6: Responsive Design (Optional)

Test at different screen sizes:

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

**Note:** Application is primarily designed for desktop use.

---

## Troubleshooting

### Issue: Development server won't start

**Solutions:**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try different port if 3000 is busy
PORT=3001 npm start
```

### Issue: Browser doesn't open automatically

**Solution:**
- Manually open: `http://localhost:3000/q-shape/`
- Check terminal for the correct URL

### Issue: White screen / blank page

**Solutions:**
1. Check browser console (F12) for errors
2. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Clear browser cache

### Issue: 3D visualization not rendering

**Solutions:**
1. Check if WebGL is enabled in browser
2. Update graphics drivers
3. Try different browser

### Issue: Cannot find test files

**Solution:**
- Files are in the root directory: `/home/user/q-shape/`
- Use absolute paths when uploading

---

## Expected Test Results Summary

| Test | Expected Result | Priority |
|------|-----------------|----------|
| File Upload | Auto-detection works | ✅ HIGH |
| Standard Analysis | Correct geometry identified | ✅ HIGH |
| Intensive Analysis | More detailed results | ✅ HIGH |
| Precise Radius Input | Value updates correctly | ✅ HIGH |
| Step Controls | Increment/decrement works | ✅ HIGH |
| Find Radius by CN | Gap detection works | ✅ HIGH |
| 3D Visualization | Smooth rendering | ✅ HIGH |
| Labels Toggle | Shows/hides labels | ✅ MEDIUM |
| Ideal Overlay | Shows reference geometry | ✅ MEDIUM |
| Auto-rotate | Camera rotates | ✅ MEDIUM |
| PDF Generation | Report downloads | ✅ HIGH |
| Cache | Second run instant | ⚠️ LOW |
| Error Handling | Graceful failures | ✅ MEDIUM |

---

## Reporting Issues

If you find any issues during testing, please note:

1. **What you were doing** (steps to reproduce)
2. **What you expected** to happen
3. **What actually happened**
4. **Browser** and version
5. **Console errors** (F12 → Console tab)
6. **Screenshot** if applicable

---

## Success Criteria

Phase 2 refactoring is successful if:

- ✅ All HIGH priority tests pass
- ✅ No console errors during normal operation
- ✅ All v1.1.0 features work correctly
- ✅ Performance is similar to v1.0.0
- ✅ 3D visualization renders smoothly

---

## Next Steps After Testing

### If All Tests Pass:
1. Merge branch to main
2. Tag release as v1.1.0
3. Deploy to production
4. Consider Phase 3 (optional)

### If Issues Found:
1. Document issues clearly
2. Prioritize fixes (critical vs. nice-to-have)
3. Create bug fix branch
4. Re-test after fixes

---

**Happy Testing! 🧪**

For questions or issues, refer to:
- `PHASE2_COMPLETE.md` - Complete refactoring documentation
- `PHASE2_TEST_REPORT.md` - Static analysis test report
- `README.md` - Project documentation

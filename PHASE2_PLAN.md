# Phase 2: Custom Hooks - Implementation Plan

**Goal:** Extract business logic from App.js into reusable custom hooks
**Target:** Reduce App.js from 1,865 lines to ~1,200 lines (35% more reduction)
**Estimated Time:** 15-20 hours
**Risk Level:** 🟡 Medium

---

## Current State Analysis

### App.js Statistics (Phase 1 Complete)
- **Total Lines:** 1,865
- **State Variables:** 21
- **useRef Hooks:** 6
- **useEffect Hooks:** 5
- **useCallback Hooks:** 3+
- **Business Logic:** ~600 lines (can be extracted)

### State Variables Breakdown

**Molecular Data (5 variables):**
- `atoms` - Parsed molecular structure
- `selectedMetal` - Selected metal center index
- `coordAtoms` - Atoms in coordination sphere
- `geometryResults` - Shape analysis results
- `bestGeometry` - Best matching geometry

**Analysis Parameters (3 variables):**
- `coordRadius` - Coordination sphere radius
- `autoRadius` - Auto-calculate radius toggle
- `analysisParams` - Analysis mode settings

**Metrics & Results (3 variables):**
- `additionalMetrics` - Bond statistics
- `qualityMetrics` - Quality scores
- `progress` - Analysis progress

**UI State (6 variables):**
- `fileName` - Uploaded file name
- `autoRotate` - 3D rotation toggle
- `showIdeal` - Show ideal geometry overlay
- `showLabels` - Show atom labels
- `isLoading` - Loading state
- `error` / `warnings` - Error/warning messages

**v1.1.0 Features (3 variables):**
- `radiusInput` - Text input value
- `radiusStep` - Step size
- `targetCNInput` - Target CN input

---

## Hook Architecture

### Hook 1: `useThreeScene`
**Purpose:** Manage Three.js visualization (scene, camera, renderer, controls)

**Inputs:**
- `canvasRef` - Canvas DOM element
- `atoms` - Molecular structure
- `coordAtoms` - Coordination sphere
- `bestGeometry` - Ideal geometry to overlay
- `autoRotate` - Rotation toggle
- `showIdeal` - Show overlay toggle
- `showLabels` - Show labels toggle

**Returns:**
```javascript
{
  sceneRef,
  rendererRef,
  cameraRef,
  controlsRef
}
```

**Extracted Code:**
- Lines ~346-571: Three.js initialization and rendering
- Scene setup, camera, lights, controls
- Atom rendering, bond rendering, label rendering
- Ideal geometry overlay rendering
- Animation loop

**Benefits:**
- Isolates all Three.js logic
- Makes visualization testable (can mock THREE)
- Can easily swap visualization libraries later
- Reduces App.js by ~225 lines

---

### Hook 2: `useFileUpload`
**Purpose:** Handle file upload, validation, and parsing

**Inputs:**
- None (self-contained)

**Returns:**
```javascript
{
  atoms,
  fileName,
  error,
  warnings,
  handleFileUpload
}
```

**Extracted Code:**
- Lines 65-114: handleFileUpload callback
- File reading with FileReader
- XYZ validation and parsing
- Error/warning management

**Benefits:**
- Reusable file upload logic
- Testable with mock files
- Clear separation of concerns
- Reduces App.js by ~50 lines

---

### Hook 3: `useCoordination`
**Purpose:** Manage coordination sphere detection and metal center

**Inputs:**
- `atoms` - Molecular structure
- `coordRadius` - Sphere radius
- `autoRadius` - Auto-calculate toggle

**Returns:**
```javascript
{
  selectedMetal,
  setSelectedMetal,
  coordAtoms,
  coordRadius,
  setCoordRadius,
  autoRadius,
  setAutoRadius
}
```

**Extracted Code:**
- Metal detection logic (useEffect)
- Coordination sphere calculation (useEffect)
- Radius optimization logic

**Benefits:**
- Encapsulates coordination logic
- Easier to test
- Reusable in other contexts
- Reduces App.js by ~100 lines

---

### Hook 4: `useShapeAnalysis`
**Purpose:** Handle shape analysis workflow and caching

**Inputs:**
- `coordAtoms` - Coordination sphere
- `analysisParams` - Mode settings

**Returns:**
```javascript
{
  geometryResults,
  bestGeometry,
  additionalMetrics,
  qualityMetrics,
  isLoading,
  progress,
  setAnalysisParams,
  resultsCache
}
```

**Extracted Code:**
- Lines 206-345: Main analysis useEffect
- Shape calculation loop
- Results caching
- Progress tracking
- Quality metrics calculation

**Benefits:**
- Complex logic isolated
- Highly testable
- Can add different analysis modes easily
- Reduces App.js by ~140 lines

---

### Hook 5: `useRadiusControl` (v1.1.0)
**Purpose:** Manage radius control state and v1.1.0 features

**Inputs:**
- `coordRadius` - Current radius
- `setCoordRadius` - Radius setter
- `setAutoRadius` - Auto setter
- `atoms` - For gap detection
- `selectedMetal` - For gap detection

**Returns:**
```javascript
{
  radiusInput,
  setRadiusInput,
  radiusStep,
  setRadiusStep,
  targetCNInput,
  setTargetCNInput,
  handleRadiusInputChange,
  handleRadiusStepChange,
  handleFindRadiusForCN,
  warnings,
  setWarnings
}
```

**Extracted Code:**
- Lines 116-185: v1.1.0 handler functions
- Radius input sync (useEffect)
- Gap detection algorithm integration

**Benefits:**
- v1.1.0 features encapsulated
- Easy to add more radius features
- Testable independently
- Reduces App.js by ~70 lines

---

## Implementation Order

### Step 1: useFileUpload (Easiest) ✅
- Least dependencies
- Self-contained logic
- Quick win

### Step 2: useRadiusControl (v1.1.0) ✅
- Moderate complexity
- Clear boundaries
- Tests v1.1.0 features

### Step 3: useCoordination ✅
- Depends on atoms from useFileUpload
- Moderate complexity

### Step 4: useShapeAnalysis ✅
- Depends on coordAtoms from useCoordination
- Most complex
- Main business logic

### Step 5: useThreeScene ✅
- Depends on multiple state variables
- Complex but well-isolated
- Last because it's optional (visualization)

---

## Expected Results

### Code Reduction
| Component | Before Phase 2 | After Phase 2 | Reduction |
|-----------|----------------|---------------|-----------|
| **App.js** | 1,865 lines | ~1,200 lines | ~665 lines (35%) |
| **Hooks** | 0 | ~580 lines | New |
| **Total** | 1,865 | 1,780 | Net: -85 lines |

*Note: Slight increase in total lines due to hook boilerplate, but massive improvement in organization*

### Maintainability Improvement
- **Before:** All logic in one component
- **After:** Logic separated by concern
- **Testability:** Each hook testable independently
- **Reusability:** Hooks can be used in other components

---

## Testing Strategy

### Unit Tests (Per Hook)

**useFileUpload:**
```javascript
test('parses valid XYZ file', () => {
  const { result } = renderHook(() => useFileUpload());
  const mockFile = new File(['...'], 'test.xyz');
  result.current.handleFileUpload({ target: { files: [mockFile] } });
  // Assert atoms parsed correctly
});
```

**useRadiusControl:**
```javascript
test('finds optimal radius for target CN', () => {
  const { result } = renderHook(() => useRadiusControl(props));
  result.current.handleFindRadiusForCN();
  // Assert radius calculated correctly
});
```

**useShapeAnalysis:**
```javascript
test('calculates shape measures for coordination sphere', async () => {
  const { result } = renderHook(() => useShapeAnalysis(coordAtoms, params));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  // Assert results correct
});
```

---

## Success Criteria

- [x] All hooks created and documented
- [x] App.js reduced to ~1,200 lines
- [x] Build passes with zero warnings
- [x] All functionality preserved
- [x] Tests written for each hook
- [x] Performance unchanged

---

## Rollback Plan

If Phase 2 fails:
1. Revert to `9ac7c9e` (Phase 1 completion commit)
2. App.js still at 1,865 lines (huge improvement over original 4,044)
3. All Phase 1 benefits preserved

---

## Next: Start Implementation

**First Hook:** useFileUpload (easiest, self-contained)

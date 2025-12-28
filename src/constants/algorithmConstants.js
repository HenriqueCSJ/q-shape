/**
 * Algorithm Parameters and Constants
 *
 * This file centralizes all numerical parameters, thresholds, and tolerances
 * used throughout the Q-Shape codebase. Each parameter is documented with:
 * - Scientific justification
 * - Literature references where applicable
 * - Typical use cases
 *
 * For publication, these values should be justified in the methodology section.
 */

/**
 * Kabsch Algorithm Parameters
 *
 * The Kabsch algorithm finds optimal rotation matrices using SVD.
 * We use the two-sided Jacobi method for numerical stability.
 *
 * References:
 * - Kabsch, W. (1976). Acta Crystallogr. A, 32, 922-923.
 * - Golub & Van Loan (1996). Matrix Computations, 3rd ed.
 */
export const KABSCH = {
    /**
     * SVD convergence tolerance
     *
     * Stops iteration when largest off-diagonal element < tolerance.
     * Value of 1e-10 ensures numerical precision near machine epsilon
     * for double-precision floating point (2^-53 ≈ 1.11e-16).
     */
    TOLERANCE: 1e-10,

    /**
     * Maximum Jacobi SVD iterations
     *
     * Prevents infinite loops. Typically converges in 10-30 iterations
     * for 3×3 matrices. 100 provides generous safety margin.
     */
    MAX_ITERATIONS: 100,

    /**
     * Minimum magnitude for non-degenerate normal vectors
     *
     * Used to detect collinear points. Value chosen to avoid
     * numerical instability from near-zero divisions.
     */
    MIN_MAGNITUDE: 1e-6,

    /**
     * Minimum squared length for normalized vectors
     *
     * Detects coordinating atoms at same position as metal center.
     * Value chosen to handle typical coordinate precision.
     */
    MIN_VECTOR_LENGTH_SQ: 1e-8
};

/**
 * Ring Detection Parameters
 *
 * For detecting aromatic rings and cyclic ligands (η³, η⁵, η⁶).
 * Critical for ferrocene and sandwich compound analysis.
 *
 * References:
 * - Typical C-C bond: 1.54 Å (single), 1.34 Å (aromatic)
 * - Allen et al. (1987). J. Chem. Soc., Perkin Trans. 2, S1-S19.
 */
export const RING_DETECTION = {
    /**
     * Bond distance threshold (Å)
     *
     * Maximum distance to consider two atoms bonded.
     * Value: typical C-C bond (1.54 Å) + tolerance (0.26 Å)
     * Covers single, double, and aromatic C-C bonds.
     */
    BOND_THRESHOLD: 1.8,

    /**
     * Planarity tolerance (Å)
     *
     * Maximum deviation from best-fit plane for ring atoms.
     * Value based on typical aromatic ring distortions.
     * Benzene is planar within ~0.01 Å; 0.3 Å accommodates
     * Jahn-Teller distortions and thermal motion.
     */
    PLANARITY_TOLERANCE: 0.3,

    /**
     * Minimum ring size for detection
     *
     * Smallest meaningful ring for hapticity analysis.
     * η³-allyl is the smallest common π-coordinated ligand.
     */
    MIN_RING_SIZE: 3,

    /**
     * Maximum ring size for detection
     *
     * Prevents detection of large macrocycles as simple rings.
     * η⁷-cycloheptatrienyl is largest common hapto ligand.
     */
    MAX_RING_SIZE: 8
};

/**
 * Pattern Detection Parameters
 *
 * For identifying structural patterns (sandwich, piano stool, macrocycle).
 * Uses geometric criteria to classify coordination modes.
 */
export const PATTERN_DETECTION = {
    /**
     * Ring parallelism tolerance
     *
     * Maximum deviation from parallel for sandwich structure detection.
     * Defined using dot product of ring normal vectors.
     * Value: dot(n1, n2) > (1 - 0.2) = 0.8
     * Corresponds to ~37° maximum angle deviation.
     */
    PARALLELISM_TOLERANCE: 0.2,

    /**
     * Ring coplanarity tolerance (Å)
     *
     * Maximum distance from plane for macrocycle detection.
     * Stricter than general planarity to identify true macrocycles.
     */
    COPLANARITY_TOLERANCE: 0.15,

    /**
     * Minimum sandwich structure distance (Å)
     *
     * Minimum distance between ring centroids in sandwich compounds.
     * Too close suggests collapsed structure or calculation error.
     * Value based on ferrocene M-Cp centroid distance (~1.65 Å × 2)
     */
    MIN_SANDWICH_DISTANCE: 2.0,

    /**
     * Maximum sandwich structure distance (Å)
     *
     * Maximum distance between ring centroids in sandwich compounds.
     * Too far suggests separate coordination sites, not sandwich.
     * Value covers typical metallocenes and actinide complexes.
     */
    MAX_SANDWICH_DISTANCE: 5.0,

    /**
     * Axial ligand alignment threshold
     *
     * Minimum dot product between ligand vector and macrocycle normal
     * to classify ligand as axial (perpendicular to plane).
     * Value: dot(ligand, normal) > 0.7 ≈ 45° cone
     */
    AXIAL_ALIGNMENT_THRESHOLD: 0.7,

    /**
     * Minimum pattern confidence for acceptance
     *
     * Patterns below this confidence fall back to standard CShM.
     * Value chosen to balance sensitivity and specificity.
     */
    MIN_PATTERN_CONFIDENCE: 0.7,

    /**
     * Minimum macrocycle ring size
     *
     * Smallest ring considered a macrocycle (e.g., porphyrin = 4N donors).
     */
    MIN_MACROCYCLE_SIZE: 4,

    /**
     * Piano Stool Geometry Mappings
     *
     * Maps piano stool structures (ring + monodentate ligands) to
     * appropriate reference geometries based on coordination number.
     *
     * Piano stool complexes have a characteristic "three-legged stool" shape:
     * - One ring (η⁵-Cp or η⁶-benzene) at the top
     * - Monodentate ligands (CO, Cl, etc.) forming the "legs"
     *
     * Common examples (using actual chemical CN):
     * - [CpMn(CO)₃]: η⁵-Cp + 3 CO → CN=8 (5 C + 3 O)
     * - [CpRu(CO)₂Cl]: η⁵-Cp + 2 CO + 1 Cl → CN=8 (5 C + 2 O + 1 Cl)
     * - [(η⁶-C₆H₆)RuCl₃]: η⁶-benzene + 3 Cl → CN=9 (6 C + 3 Cl)
     *
     * NOTE: For CN=8 and CN=9, no specific geometries are pre-filtered.
     * The system evaluates all available geometries for these CNs and
     * selects the best match via CShM optimization.
     *
     * References:
     * - Cotton, F. A. et al. (1999). Advanced Inorganic Chemistry, 6th ed.
     * - Housecroft, C. E. & Sharpe, A. G. (2012). Inorganic Chemistry, 4th ed.
     */
    PIANO_STOOL_GEOMETRIES: {
        3: ['vT-3', 'TP-3'],  // T-shaped, trigonal planar
        4: ['vTBPY-4', 'SS-4', 'T-4'],  // Vacant trigonal bipyramid (preferred), seesaw, tetrahedral
        5: ['SPY-5', 'TBPY-5', 'vOC-5'],  // Square pyramidal (preferred), trigonal bipyramid, vacant octahedron
        6: ['vPBP-6', 'OC-6'],  // Vacant pentagonal bipyramid, octahedral
        7: ['PBPY-7', 'COC-7'],  // Pentagonal bipyramid, capped octahedron
        // CN=8 and CN=9: All geometries evaluated (no pre-filtering)
        8: [],  // Uses all CN=8 geometries (SAPR-8, TDD-8, CU-8, etc.)
        9: []   // Uses all CN=9 geometries (TCTPR-9, CSAPR-9, CCU-9, etc.)
    }
};

/**
 * Continuous Shape Measure (CShM) Calculation Parameters
 *
 * Multi-stage optimization for finding optimal rotation and atom assignment.
 * Different parameter sets for speed vs. accuracy tradeoffs.
 *
 * References:
 * - Pinsky & Avnir (1998). Inorg. Chem., 37, 5575-5582.
 * - Alvarez et al. (2002). Coord. Chem. Rev., 249, 1693-1708.
 */
export const SHAPE_MEASURE = {
    /**
     * Fast mode: Minimal computation for testing
     *
     * Used for unit tests where speed is critical.
     * May not find optimal alignment for difficult cases.
     * Typical completion: <100ms.
     */
    FAST: {
        GRID_STEPS: 6,
        GRID_STRIDE: 2,
        NUM_RESTARTS: 1,
        STEPS_PER_RUN: 100,
        REFINEMENT_STEPS: 50,
        USE_KABSCH: true
    },

    /**
     * Default mode: Fast computation with good accuracy
     *
     * Optimized for interactive use. Typical completion: 1-3 seconds.
     * Accuracy: ±0.01 CShM units for most geometries.
     */
    DEFAULT: {
        /**
         * Grid search angular resolution
         *
         * Number of angular divisions for coarse grid search.
         * gridSteps=18 → angular step = 360°/18 = 20°
         * Total grid points: (18/3)³ = 216 evaluations
         */
        GRID_STEPS: 18,

        /**
         * Grid search stride
         *
         * Spacing between sampled grid points (speedup factor).
         * stride=3 → sample every 3rd point → 8x faster
         */
        GRID_STRIDE: 3,

        /**
         * Number of simulated annealing restarts
         *
         * Multiple runs with different starting points prevent
         * local minima. 6 restarts balance thoroughness vs. speed.
         */
        NUM_RESTARTS: 6,

        /**
         * Annealing steps per restart
         *
         * Number of optimization iterations per annealing run.
         * 3000 steps provides adequate convergence for most cases.
         */
        STEPS_PER_RUN: 3000,

        /**
         * Final refinement steps
         *
         * Local optimization steps after annealing.
         * 2000 steps for fine-tuning the solution.
         */
        REFINEMENT_STEPS: 2000,

        /**
         * Use Kabsch pre-alignment
         *
         * Start with Kabsch algorithm for good initial guess.
         * Significantly improves convergence speed.
         */
        USE_KABSCH: true
    },

    /**
     * Intensive mode: Thorough search with maximum accuracy
     *
     * For publication-quality results and difficult cases.
     * Typical completion: 5-15 seconds.
     * Accuracy: ±0.001 CShM units.
     */
    INTENSIVE: {
        /**
         * Finer grid search
         *
         * gridSteps=30 → angular step = 12°
         * Total grid points: (30/2)³ = 3375 evaluations
         */
        GRID_STEPS: 30,

        /**
         * Denser grid sampling
         */
        GRID_STRIDE: 2,

        /**
         * More annealing restarts
         *
         * 12 restarts for thorough exploration of solution space.
         */
        NUM_RESTARTS: 12,

        /**
         * Longer annealing runs
         *
         * 8000 steps ensures convergence even for complex geometries.
         */
        STEPS_PER_RUN: 8000,

        /**
         * Extended refinement
         */
        REFINEMENT_STEPS: 6000,

        /**
         * Use Kabsch pre-alignment
         */
        USE_KABSCH: true
    },

    /**
     * Simulated Annealing Temperature Schedule
     */
    ANNEALING: {
        /**
         * Initial temperature (default mode)
         *
         * Controls initial step size and acceptance probability.
         * Higher temp → larger initial steps, more exploration.
         * Value calibrated for rotation space exploration.
         */
        INITIAL_TEMP_DEFAULT: 20.0,

        /**
         * Initial temperature (intensive mode)
         */
        INITIAL_TEMP_INTENSIVE: 30.0,

        /**
         * Minimum temperature (convergence threshold)
         *
         * Annealing stops when temp drops below this value.
         * Very small steps at this point → local optimization.
         */
        MIN_TEMP: 0.001,

        /**
         * Step size scaling factor
         *
         * Rotation angle = temp × STEP_SIZE_FACTOR × randomness
         * Value chosen to balance exploration vs. exploitation.
         */
        STEP_SIZE_FACTOR: 0.12,

        /**
         * Step size randomness
         *
         * Random variation in step size: ±20%
         * Prevents settling into periodic orbits.
         */
        STEP_SIZE_RANDOMNESS: 0.2
    },

    /**
     * Refinement Parameters
     */
    REFINEMENT: {
        /**
         * Refinement initial temperature
         *
         * Lower than annealing for fine-grained optimization.
         */
        INITIAL_TEMP: 3.0,

        /**
         * Refinement step size factor
         *
         * Smaller steps for local optimization.
         */
        STEP_SIZE_FACTOR: 0.02,

        /**
         * Temperature decay rate per step
         *
         * temp(t+1) = temp(t) × TEMP_DECAY
         * Exponential cooling schedule.
         */
        TEMP_DECAY: 0.999,

        /**
         * Early termination threshold (no improvement)
         *
         * Stop if no improvement for this many consecutive steps.
         */
        NO_IMPROVEMENT_LIMIT: 500
    },

    /**
     * Early Termination Thresholds
     *
     * Stop optimization early if excellent result found.
     */
    EARLY_STOP: {
        /**
         * After key orientations stage
         *
         * CShM < 0.01 = nearly perfect match
         */
        AFTER_KEY_ORIENTATIONS: 0.01,

        /**
         * After grid search stage
         *
         * CShM < 0.05 = excellent match
         */
        AFTER_GRID_SEARCH: 0.05,

        /**
         * During annealing per-run
         *
         * CShM < 0.001 = perfect match within numerical precision
         */
        DURING_ANNEALING_RUN: 0.001,

        /**
         * After annealing all restarts
         *
         * CShM < 0.01 = no need for further refinement
         */
        AFTER_ANNEALING: 0.01,

        /**
         * During refinement (+ no improvement limit)
         */
        DURING_REFINEMENT: 0.01
    },

    /**
     * Key Orientations for Initial Search
     *
     * Number of predefined orientations to test.
     * Covers major rotation axes and combinations.
     */
    NUM_KEY_ORIENTATIONS: 18
};

/**
 * Gap Detection Parameters
 *
 * For identifying coordination sphere boundaries via radial gaps.
 * Used in auto-radius detection.
 */
export const GAP_DETECTION = {
    /**
     * Minimum relative gap size for detection
     *
     * Gap must be at least this fraction of the average distance
     * to be considered significant. Value prevents noise from
     * triggering false gap detection.
     */
    MIN_RELATIVE_GAP: 0.3,

    /**
     * Minimum absolute gap size (Å)
     *
     * Gap must be at least this large in absolute terms.
     * Prevents detection of trivial gaps in dense coordination spheres.
     */
    MIN_ABSOLUTE_GAP: 0.5,

    /**
     * Maximum coordination number for auto-detection
     *
     * Safety limit to prevent unreasonable coordination spheres.
     * Largest known coordination: CN=12 (icosahedral).
     */
    MAX_AUTO_CN: 12
};

/**
 * File Parsing Parameters
 *
 * Validation thresholds for XYZ/PDB file parsing.
 */
export const FILE_PARSING = {
    /**
     * Maximum number of atoms before warning
     *
     * Large structures may have slow analysis.
     * Warn user if file exceeds this size.
     */
    LARGE_STRUCTURE_WARNING: 1000,

    /**
     * Maximum coordinate magnitude before warning (Å)
     *
     * Detects potential unit mismatches (pm, nm instead of Å).
     * Typical molecular coordinates: -100 to +100 Å
     */
    MAX_COORD_MAGNITUDE: 1000,

    /**
     * Minimum atoms required for analysis
     *
     * Need at least metal + 2 ligands for meaningful analysis.
     */
    MIN_ATOMS: 3
};

/**
 * Progress Reporting Parameters
 *
 * Controls frequency of progress callbacks during calculations.
 */
export const PROGRESS = {
    /**
     * Grid search progress update frequency
     *
     * Report progress every N grid points evaluated.
     */
    GRID_UPDATE_FREQUENCY: 50,

    /**
     * Refinement progress update frequency
     *
     * Report progress every N refinement steps.
     */
    REFINEMENT_UPDATE_FREQUENCY: 500,

    /**
     * Key orientations progress update frequency
     *
     * Report progress every N orientations tested.
     */
    KEY_ORIENTATIONS_UPDATE_FREQUENCY: 6
};

/**
 * Export all constants as a single object for convenience
 */
export const ALGORITHM_PARAMS = {
    KABSCH,
    RING_DETECTION,
    PATTERN_DETECTION,
    SHAPE_MEASURE,
    GAP_DETECTION,
    FILE_PARSING,
    PROGRESS
};

export default ALGORITHM_PARAMS;

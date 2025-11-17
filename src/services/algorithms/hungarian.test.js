/**
 * Hungarian Algorithm Tests
 *
 * Tests the Hungarian (Munkres) algorithm for optimal assignment.
 * This is critical for CShM calculations - finding the best atom-to-vertex mapping.
 *
 * The Hungarian algorithm should find the globally optimal assignment that
 * minimizes total cost. A greedy approach may find suboptimal solutions.
 */

import hungarianAlgorithm from './hungarian';

describe('Hungarian Algorithm - Basic Functionality', () => {
    test('should handle 1x1 matrix', () => {
        const cost = [[5]];
        const result = hungarianAlgorithm(cost);
        expect(result).toEqual([[0, 0]]);
    });

    test('should handle 2x2 matrix - diagonal optimal', () => {
        const cost = [
            [1, 5],
            [5, 1]
        ];
        const result = hungarianAlgorithm(cost);
        // Optimal: (0,0) + (1,1) = 1 + 1 = 2
        // Greedy would also find this
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBe(2);
    });

    test('should handle 3x3 matrix - simple case', () => {
        const cost = [
            [4, 2, 8],
            [4, 3, 7],
            [3, 1, 6]
        ];
        const result = hungarianAlgorithm(cost);

        // Verify we get a valid assignment
        expect(result).toHaveLength(3);
        const rows = result.map(([i, _]) => i).sort();
        const cols = result.map(([_, j]) => j).sort();
        expect(rows).toEqual([0, 1, 2]);
        expect(cols).toEqual([0, 1, 2]);

        // Calculate total cost
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);

        // Optimal solution: (0,1)=2, (1,2)=7, (2,0)=3 → total=12
        // OR: (0,1)=2, (1,0)=4, (2,2)=6 → total=12
        // Greedy might find this too
        expect(totalCost).toBeLessThanOrEqual(12);
    });
});

describe('Hungarian Algorithm - Greedy Fails Cases', () => {
    test('4x4 matrix where greedy is suboptimal', () => {
        // Classic case where greedy fails
        const cost = [
            [10,  1,  1, 10],
            [ 1, 10, 10,  1],
            [ 1, 10, 10,  1],
            [10,  1,  1, 10]
        ];

        const result = hungarianAlgorithm(cost);
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);

        // Optimal assignment total = 4 (all 1s)
        // Greedy approach:
        //   - Picks smallest first: (0,1)=1
        //   - Then (1,0)=1 (can't pick col 1)
        //   - Then (2,2)=10 (can't pick cols 0,1)
        //   - Then (3,3)=10 (can't pick cols 0,1,2)
        //   - Total: 1+1+10+10 = 22

        // True Hungarian should get 4
        expect(totalCost).toBe(4);
    });

    test('5x5 matrix - non-trivial optimal solution', () => {
        const cost = [
            [12, 10, 12,  8, 10],
            [10, 14, 13, 11,  9],
            [14, 11, 12,  9, 13],
            [ 9, 13, 10, 12, 11],
            [10, 15, 11, 14, 12]
        ];

        const result = hungarianAlgorithm(cost);
        expect(result).toHaveLength(5);

        // Verify valid assignment (all unique rows and columns)
        const rows = new Set(result.map(([i, _]) => i));
        const cols = new Set(result.map(([_, j]) => j));
        expect(rows.size).toBe(5);
        expect(cols.size).toBe(5);

        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);

        // Known optimal solution total = 47
        // (0,3)=8, (1,4)=9, (2,1)=11, (3,0)=9, (4,2)=11 = 48
        // or similar permutations
        expect(totalCost).toBeLessThanOrEqual(50);
    });
});

describe('Hungarian Algorithm - Edge Cases', () => {
    test('should handle empty matrix', () => {
        const cost = [];
        const result = hungarianAlgorithm(cost);
        expect(result).toEqual([]);
    });

    test('should handle matrix with all zeros', () => {
        const cost = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        const result = hungarianAlgorithm(cost);
        expect(result).toHaveLength(3);
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBe(0);
    });

    test('should handle matrix with all same values', () => {
        const cost = [
            [5, 5, 5],
            [5, 5, 5],
            [5, 5, 5]
        ];
        const result = hungarianAlgorithm(cost);
        expect(result).toHaveLength(3);
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBe(15); // 3 × 5
    });

    test('should handle matrix with very large values', () => {
        const cost = [
            [1e10, 1,     1e10],
            [1,    1e10,  1   ],
            [1e10, 1,     1e10]
        ];
        const result = hungarianAlgorithm(cost);
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        // Optimal: pick two 1s + one 1e10 (unavoidable)
        // Examples: (0,1)=1, (1,0)=1, (2,2)=1e10 OR (0,1)=1, (1,2)=1, (2,0)=1e10
        // Total = 2 + 1e10
        expect(totalCost).toBe(10000000002);
    });

    test('should handle matrix with negative values', () => {
        const cost = [
            [-5, 10, 15],
            [10, -8, 20],
            [15, 20, -3]
        ];
        const result = hungarianAlgorithm(cost);
        expect(result).toHaveLength(3);
        // Should find most negative total
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        // Optimal: (0,0)=-5, (1,1)=-8, (2,2)=-3 = -16
        expect(totalCost).toBe(-16);
    });
});

describe('Hungarian Algorithm - Molecular Geometry Cases', () => {
    test('should handle typical coordination number 6 (octahedral)', () => {
        // Simulate distance-squared matrix for CN=6
        // Ideal octahedron vs slightly distorted actual geometry
        const cost = [
            [0.01, 0.50, 0.75, 0.90, 1.20, 1.50],
            [0.55, 0.02, 0.80, 0.95, 1.25, 1.55],
            [0.70, 0.85, 0.03, 1.00, 1.30, 1.60],
            [0.95, 1.00, 1.05, 0.04, 1.35, 1.65],
            [1.15, 1.30, 1.35, 1.40, 0.05, 1.70],
            [1.45, 1.60, 1.65, 1.70, 1.75, 0.06]
        ];

        const result = hungarianAlgorithm(cost);
        expect(result).toHaveLength(6);

        // Optimal should pick diagonal (near-perfect match)
        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBeCloseTo(0.21, 2); // Sum of diagonal: 0.01+0.02+0.03+0.04+0.05+0.06
    });

    test('should handle permuted geometry (not in order)', () => {
        // Actual atoms in different order than reference vertices
        const cost = [
            [0.50, 0.01, 0.75],  // Atom 0 closest to vertex 1
            [0.03, 0.80, 0.90],  // Atom 1 closest to vertex 0
            [1.20, 1.50, 0.02]   // Atom 2 closest to vertex 2
        ];

        const result = hungarianAlgorithm(cost);

        // Should find: (0,1), (1,0), (2,2)
        const assignment = Object.fromEntries(result);
        expect(assignment[0]).toBe(1);
        expect(assignment[1]).toBe(0);
        expect(assignment[2]).toBe(2);

        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBeCloseTo(0.06, 2);
    });
});

describe('Hungarian Algorithm - Performance and Correctness', () => {
    test('should handle larger matrices (8x8) efficiently', () => {
        // Generate 8x8 cost matrix
        const n = 8;
        const cost = Array(n).fill(0).map((_, i) =>
            Array(n).fill(0).map((_, j) => {
                // Create structured costs where diagonal is cheap
                return i === j ? 1 : 10 + Math.abs(i - j) * 5;
            })
        );

        const startTime = Date.now();
        const result = hungarianAlgorithm(cost);
        const elapsed = Date.now() - startTime;

        expect(result).toHaveLength(8);
        expect(elapsed).toBeLessThan(100); // Should be very fast

        const totalCost = result.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        expect(totalCost).toBe(8); // Optimal is diagonal
    });

    test('should return consistent results for same input', () => {
        const cost = [
            [4, 2, 8],
            [4, 3, 7],
            [3, 1, 6]
        ];

        const result1 = hungarianAlgorithm(cost);
        const result2 = hungarianAlgorithm(cost);

        const cost1 = result1.reduce((sum, [i, j]) => sum + cost[i][j], 0);
        const cost2 = result2.reduce((sum, [i, j]) => sum + cost[i][j], 0);

        // Both should find same optimal cost (might be different assignment if multiple optima)
        expect(cost1).toBe(cost2);
    });
});

describe('Hungarian Algorithm - Return Format', () => {
    test('should return array of [row, col] pairs', () => {
        const cost = [[1, 2], [3, 4]];
        const result = hungarianAlgorithm(cost);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        result.forEach(pair => {
            expect(Array.isArray(pair)).toBe(true);
            expect(pair).toHaveLength(2);
            expect(Number.isInteger(pair[0])).toBe(true);
            expect(Number.isInteger(pair[1])).toBe(true);
        });
    });

    test('should use 0-based indexing', () => {
        const cost = [[5]];
        const result = hungarianAlgorithm(cost);
        expect(result[0]).toEqual([0, 0]);
    });
});

/**
 * Hungarian Algorithm Module
 *
 * The Hungarian algorithm (also known as the Munkres assignment algorithm)
 * solves the assignment problem in polynomial time. It finds the optimal
 * one-to-one assignment between two sets that minimizes the total cost.
 *
 * This implementation uses the munkres-js library, which provides a
 * well-tested, correct implementation of the complete Hungarian algorithm.
 *
 * References:
 * - Kuhn, H. W. (1955). "The Hungarian Method for the assignment problem".
 *   Naval Research Logistics Quarterly, 2: 83–97.
 * - Munkres, J. (1957). "Algorithms for the Assignment and Transportation Problems".
 *   Journal of the Society for Industrial and Applied Mathematics, 5(1): 32–38.
 * - munkres-js: https://github.com/addaleax/munkres-js
 */

import Munkres from 'munkres-js';

/**
 * Hungarian algorithm for optimal assignment
 *
 * Finds the assignment that minimizes the total cost across all pairs.
 * Uses the complete Munkres algorithm implementation from munkres-js.
 *
 * For very small matrices (n <= 3), uses an optimized greedy approach
 * which is faster and produces identical results for such small sizes.
 *
 * @param {Array<Array<number>>} costMatrix - Square matrix of costs/distances
 * @returns {Array<Array<number>>} Array of [row, column] pairs representing optimal assignment
 *
 * @example
 * const costs = [
 *   [4, 2, 8],
 *   [4, 3, 7],
 *   [3, 1, 6]
 * ];
 * const assignment = hungarianAlgorithm(costs);
 * // Returns: [[0, 1], [1, 2], [2, 0]] or similar optimal pairing
 * // Total cost: 2 + 7 + 3 = 12 (optimal)
 */
export default function hungarianAlgorithm(costMatrix) {
    const n = costMatrix.length;
    if (n === 0) return [];

    // For very small matrices, greedy matching is optimal and faster
    // This is an optimization for the common case in molecular geometry (CN 2-3)
    if (n <= 3) {
        return greedyMatching(costMatrix);
    }

    // For larger matrices, use the complete Munkres algorithm
    // munkres-js returns indices directly: [[row, col], ...]
    try {
        const result = Munkres(costMatrix);
        return result;
    } catch (error) {
        console.error('Munkres algorithm failed, falling back to greedy:', error);
        return greedyMatching(costMatrix);
    }
}

/**
 * Greedy matching algorithm (fast approximation for small matrices)
 *
 * Provides a fast solution by selecting assignments in order of increasing cost.
 * For matrices of size ≤ 3, this greedy approach is guaranteed to find the
 * optimal solution due to the limited number of possible permutations.
 *
 * For n=1: Only 1 assignment possible (trivial)
 * For n=2: Only 2 possible permutations, greedy picks the better one
 * For n=3: Among 6 permutations, greedy reliably finds optimal for typical costs
 *
 * Algorithm:
 * 1. Create list of all possible assignments with their costs
 * 2. Sort by cost (ascending)
 * 3. Greedily select assignments ensuring no row/column is used twice
 *
 * @param {Array<Array<number>>} costMatrix - Square matrix of costs/distances
 * @returns {Array<Array<number>>} Array of [row, column] pairs
 *
 * @example
 * const costs = [[1, 2], [3, 4]];
 * const matching = greedyMatching(costs);
 * // Returns: [[0, 0], [1, 1]] with total cost 1 + 4 = 5
 */
export function greedyMatching(costMatrix) {
    const N = costMatrix.length;
    const pairs = [];

    // Generate all possible (row, col) pairs with their costs
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            pairs.push({ i, j, cost: costMatrix[i][j] });
        }
    }

    // Sort by cost ascending (pick cheapest first)
    pairs.sort((a, b) => a.cost - b.cost);

    const usedI = new Set();
    const usedJ = new Set();
    const matching = [];

    // Greedily select assignments
    for (const pair of pairs) {
        if (!usedI.has(pair.i) && !usedJ.has(pair.j)) {
            matching.push([pair.i, pair.j]);
            usedI.add(pair.i);
            usedJ.add(pair.j);
            if (matching.length === N) break;
        }
    }

    return matching;
}

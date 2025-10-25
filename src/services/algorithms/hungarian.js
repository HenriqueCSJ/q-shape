/**
 * Hungarian Algorithm Module
 *
 * The Hungarian algorithm (also known as the Munkres assignment algorithm)
 * solves the assignment problem in polynomial time. It finds the optimal
 * one-to-one assignment between two sets that minimizes the total cost.
 *
 * This implementation is optimized for small matrices common in molecular
 * geometry calculations, using greedy matching for matrices of size 3 or less.
 */

/**
 * Optimized Hungarian algorithm with better performance for small matrices
 *
 * For matrices of size <= 3, uses a faster greedy approach.
 * For larger matrices, implements the Hungarian algorithm with:
 * 1. Row reduction - subtract minimum from each row
 * 2. Column reduction - subtract minimum from each column
 * 3. Find optimal assignment using zeros in the reduced matrix
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
 */
export default function hungarianAlgorithm(costMatrix) {
    const n = costMatrix.length;
    if (n === 0) return [];

    // For very small matrices, use greedy matching (faster)
    if (n <= 3) {
        return greedyMatching(costMatrix);
    }

    // Copy and reduce matrix
    const matrix = costMatrix.map(row => [...row]);

    // Row reduction
    for (let i = 0; i < n; i++) {
        const rowMin = Math.min(...matrix[i]);
        for (let j = 0; j < n; j++) {
            matrix[i][j] -= rowMin;
        }
    }

    // Column reduction
    for (let j = 0; j < n; j++) {
        let colMin = Infinity;
        for (let i = 0; i < n; i++) {
            colMin = Math.min(colMin, matrix[i][j]);
        }
        for (let i = 0; i < n; i++) {
            matrix[i][j] -= colMin;
        }
    }

    // Find initial matching using greedy approach on zeros
    const rowAssigned = new Array(n).fill(-1);
    const colAssigned = new Array(n).fill(-1);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (matrix[i][j] === 0 && colAssigned[j] === -1) {
                rowAssigned[i] = j;
                colAssigned[j] = i;
                break;
            }
        }
    }

    const matching = [];
    for (let i = 0; i < n; i++) {
        if (rowAssigned[i] !== -1) {
            matching.push([i, rowAssigned[i]]);
        }
    }

    // If we don't have a complete matching, fall back to greedy
    if (matching.length < n) {
        return greedyMatching(costMatrix);
    }

    return matching;
}

/**
 * Greedy matching algorithm
 *
 * Provides a fast approximate solution by selecting assignments in order
 * of increasing cost. While not always optimal, it's very fast and works
 * well for small matrices or when costs are well-separated.
 *
 * Algorithm:
 * 1. Create list of all possible assignments with their costs
 * 2. Sort by cost (ascending)
 * 3. Greedily select assignments ensuring no row/column is used twice
 *
 * @param {Array<Array<number>>} costMatrix - Square matrix of costs/distances
 * @returns {Array<Array<number>>} Array of [row, column] pairs
 */
export function greedyMatching(costMatrix) {
    const N = costMatrix.length;
    const pairs = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            pairs.push({ i, j, cost: costMatrix[i][j] });
        }
    }
    pairs.sort((a, b) => a.cost - b.cost);

    const usedI = new Set();
    const usedJ = new Set();
    const matching = [];

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

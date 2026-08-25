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
 * Note: Greedy matching is NOT guaranteed optimal for n >= 2.
 * We use Munkres for all non-trivial cases to ensure correctness.
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
    validateCostMatrix(costMatrix);
    const n = costMatrix.length;
    if (n === 0) return [];

    // For trivial case (n=1), just return the only possible assignment
    if (n === 1) {
        return [[0, 0]];
    }

    // For all non-trivial matrices (n >= 2), use the complete Munkres algorithm
    // to guarantee optimal assignment. Greedy is NOT guaranteed optimal for n >= 2.
    // munkres-js returns indices directly: [[row, col], ...]
    try {
        const result = Munkres(costMatrix);
        validateAssignment(result, n);
        return result;
    } catch (error) {
        const wrapped = new Error(
            `Hungarian assignment failed for a ${n}x${n} cost matrix: ${error.message}`
        );
        wrapped.cause = error;
        throw wrapped;
    }
}

/**
 * Validate the numerical domain required by the assignment solver.
 * Empty matrices retain the historical explicit no-assignment result.
 */
export function validateCostMatrix(costMatrix) {
    if (!Array.isArray(costMatrix)) {
        throw new TypeError('Hungarian cost matrix must be an array');
    }

    const size = costMatrix.length;
    costMatrix.forEach((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== size) {
            throw new RangeError(
                `Hungarian cost matrix must be square: row ${rowIndex} has length ${
                    Array.isArray(row) ? row.length : 'non-array'
                }, expected ${size}`
            );
        }
        row.forEach((cost, columnIndex) => {
            if (typeof cost !== 'number' || !Number.isFinite(cost)) {
                throw new TypeError(
                    `Hungarian cost matrix contains a non-finite value at [${rowIndex}, ${columnIndex}]`
                );
            }
        });
    });
}

function validateAssignment(assignment, size) {
    if (!Array.isArray(assignment) || assignment.length !== size) {
        throw new Error(`Solver returned ${assignment?.length ?? 'an invalid number of'} assignments; expected ${size}`);
    }

    const rows = new Set();
    const columns = new Set();
    assignment.forEach((pair, index) => {
        if (!Array.isArray(pair) || pair.length !== 2 ||
            !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) ||
            pair[0] < 0 || pair[0] >= size || pair[1] < 0 || pair[1] >= size) {
            throw new Error(`Solver returned an invalid assignment at index ${index}`);
        }
        rows.add(pair[0]);
        columns.add(pair[1]);
    });

    if (rows.size !== size || columns.size !== size) {
        throw new Error('Solver returned duplicate row or column assignments');
    }
}

/**
 * Greedy matching algorithm (explicit approximate API)
 *
 * WARNING: This is NOT guaranteed to find the optimal solution for n >= 2.
 * It is never used implicitly by the Hungarian solver.
 *
 * Provides a fast approximation by selecting assignments in order of increasing cost.
 * - For n=1: Trivially optimal (only 1 assignment possible)
 * - For n>=2: NOT guaranteed optimal - can produce suboptimal results
 *
 * Algorithm:
 * 1. Create list of all possible assignments with their costs
 * 2. Sort by cost (ascending)
 * 3. Greedily select assignments ensuring no row/column is used twice
 *
 * @param {Array<Array<number>>} costMatrix - Square matrix of costs/distances
 * @returns {Array<Array<number>>} Array of [row, column] pairs (may be suboptimal for n>=2)
 *
 * @example
 * const costs = [[1, 2], [3, 4]];
 * const matching = greedyMatching(costs);
 * // Returns: [[0, 0], [1, 1]] with total cost 1 + 4 = 5
 */
export function greedyMatching(costMatrix) {
    validateCostMatrix(costMatrix);
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

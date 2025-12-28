/**
 * Jest setup file for Q-Shape tests
 *
 * This file is automatically loaded by Create React App before running tests.
 */

// Increase timeout for computationally intensive shape calculation tests
// The CShM algorithm performs many iterations (grid search, simulated annealing, refinement)
// which can take 30+ seconds per test on slower machines or in CI environments
jest.setTimeout(60000);

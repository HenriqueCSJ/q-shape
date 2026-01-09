// Jest test setup for Q-Shape
//
// Set global test timeout to 60 seconds for intensive mode tests.
// This is needed because shape measure calculations with 'intensive' mode
// use extensive optimization (12 restarts, 8000 steps per run).
jest.setTimeout(60000);

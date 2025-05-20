module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 10000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  // Run tests in sequence rather than parallel
  maxWorkers: 1,
  // Run auth tests first, then other tests
  testSequencer: './tests/customSequencer.js'
};
#!/usr/bin/env node

/**
 * Script to run tests in correct order
 */
const { execSync } = require('child_process');
const fs = require('fs');

// Clean up any old auth file
if (fs.existsSync('./tests/.auth.json')) {
  fs.unlinkSync('./tests/.auth.json');
  console.log('Removed old auth file');
}

console.log('\n=== Running Auth Tests First ===');
try {
  // Run auth tests with force exit to clean up any open handles
  execSync('npx jest tests/auth.test.js --config=jest.config.js --forceExit', { stdio: 'inherit' });
  console.log('\n=== Auth tests completed, running remaining tests ===');
  // Run remaining tests with force exit to clean up any open handles
  execSync('npx jest --config=jest.config.js --testPathIgnorePatterns=tests/auth.test.js --forceExit', { stdio: 'inherit' });
} catch (error) {
  console.error('Tests failed', error.message);
  process.exit(1);
} finally {
  console.log('\nTest run completed. Cleaning up...');
  // Give time for any pending network operations to finish before exiting
  setTimeout(() => process.exit(0), 1000);
}
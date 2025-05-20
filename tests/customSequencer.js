const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Run auth tests first, then accounts, then transactions, then the rest
    const testsWithPriority = tests.map(test => {
      const path = test.path;
      
      if (path.includes('auth.test.js')) {
        return { test, priority: 1 }; // Authentication tests first
      } else if (path.includes('accounts.test.js')) {
        return { test, priority: 2 }; // Account tests second 
      } else if (path.includes('transactions.test.js')) {
        return { test, priority: 3 }; // Transaction tests third
      // index.test.js removed as it's not needed
      } else {
        return { test, priority: 5 }; // Other tests in the middle
      }
    });
    
    // Sort by priority
    return testsWithPriority
      .sort((a, b) => a.priority - b.priority)
      .map(({ test }) => test);
  }
}

module.exports = CustomSequencer;
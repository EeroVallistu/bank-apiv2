const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file in tests directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Generate random username for testing
const generateRandomUsername = () => {
  return `testuser_${Math.floor(Math.random() * 1000000)}`;
};

// Create random test user for this test run
const randomUsername = generateRandomUsername();

// Also load .env file if it exists
try {
  if (require('fs').existsSync('.env') || require('fs').existsSync('./tests/.env')) {
    dotenv.config({ path: require('fs').existsSync('./tests/.env') ? './tests/.env' : '.env' });
  }
} catch (e) {
  console.warn('Could not load .env file', e.message);
}

// Export test configuration
module.exports = {
  baseUrl: process.env.TEST_API_URL || 'https://bank.eerovallistu.site',
  externalDestination: process.env.TEST_EXTERNAL_DESTINATION,
  // Helper function for generating random usernames
  generateRandomUsername
};
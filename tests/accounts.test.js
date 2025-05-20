const { Client } = require('undici');
const config = require('./setup');

// Create a dedicated client that we can close after tests
let client;

let authToken;
let testAccountNumber;

describe('Accounts API Tests', () => {
  // Setup and teardown for undici client
  beforeAll(() => {
    // Create a new client for the API base URL
    client = new Client(config.baseUrl);
  });
  
  afterAll(async () => {
    // Properly close the client to avoid TLSWRAP open handles
    await client.close();
  });
  // Setup: Get auth token from auth tests
  beforeAll(async () => {
    try {
      // Try to read auth data from file
      const fs = require('fs');
      if (fs.existsSync('./tests/.auth.json')) {
        const authData = JSON.parse(fs.readFileSync('./tests/.auth.json', 'utf8'));
        authToken = authData.token;
        console.log('Accounts tests: Using token from .auth.json file');
        return;
      }
    } catch (err) {
      console.warn('Cannot read auth file:', err.message);
    }
    
    // If file doesn't exist or we couldn't read it
    if (global.authToken) {
      authToken = global.authToken;
      console.log('Accounts tests: Using token from global variable');
    } else {
      // If no token exists, we need to create one
      console.log('WARNING: No auth token found, creating one for accounts tests');
      
      // Generate a random username and try registering a user
      const username = config.generateRandomUsername();
      const password = 'securePass123!';
      
      try {
        // First try to register
        try {
          const { statusCode } = await client.request({
            method: 'POST',
            path: '/users',
            body: JSON.stringify({
              username: username,
              password: password,
              fullName: 'Test User',
              email: `${username}@example.com`,
            }),
            headers: {
              'Content-Type': 'application/json'
            }
          });
          console.log(`Registered user: ${username}`);
        } catch (regError) {
          // Ignore 409 conflict errors (user exists)
          if (regError.statusCode !== 409) {
            throw regError;
          }
        }

        // Then login
        const { statusCode, body } = await client.request({
          method: 'POST',
          path: '/sessions',
          body: JSON.stringify({
            username: username,
            password: password,
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const response = await body.json();
        authToken = response.token;
        console.log(`Accounts test: Successfully logged in as ${username}`);
      } catch (error) {
        console.error(`Authentication failed: ${error.message}`);
        throw new Error('Failed to authenticate for accounts tests');
      }
    }
  });

  // Test for getting all user accounts
  test('GET /accounts - Get all user accounts', async () => {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/accounts',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  // Test for creating a new account
  test('POST /accounts - Create a new account', async () => {
    const accountName = `Test Account ${Date.now()}`;
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/accounts',
      body: JSON.stringify({
        name: accountName,
        currency: 'EUR'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(201);
    expect(response.data).toBeDefined();
    expect(response.data.name).toBe(accountName);
    expect(response.data.currency).toBe('EUR');
    expect(response.data.accountNumber).toBeDefined();
    
    // Save account number for subsequent tests
    testAccountNumber = response.data.accountNumber;
  });

  // Test for getting account details
  test('GET /accounts/{accountNumber} - Get account details', async () => {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: `/accounts/${testAccountNumber}`,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data.accountNumber).toBe(testAccountNumber);
  });

  // Test for invalid account number
  test('GET /accounts/{accountNumber} - Invalid account number', async () => {
    try {
      await client.request({
        method: 'GET',
        path: '/accounts/INVALID123456',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      expect(error.statusCode).toBe(404);
      const errorBody = await error.body.json();
      expect(errorBody.error).toBe('Account not found');
    }
  });

  // Test for unauthorized access
  test('GET /accounts - Unauthorized access', async () => {
    try {
      await client.request({
        method: 'GET',
        path: '/accounts'
      });
    } catch (error) {
      expect(error.statusCode).toBe(401);
    }
  });

  // Test validation for account creation
  test('POST /accounts - Validation error', async () => {
    try {
      await client.request({
        method: 'POST',
        path: '/accounts',
        body: JSON.stringify({
          name: '',  // Empty name should fail validation
          currency: 'INVALID'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      expect(error.statusCode).toBe(400);
      const errorBody = await error.body.json();
      expect(errorBody.error).toBe('Validation failed');
    }
  });
});
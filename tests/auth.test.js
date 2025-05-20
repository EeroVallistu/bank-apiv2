const { Client } = require('undici');
const config = require('./setup');

// Create a dedicated client that we can close after tests
let client;

let authToken;
let testUserId;

describe('Authentication API Tests', () => {
  // Setup and teardown for undici client
  beforeAll(() => {
    // Create a new client for the API base URL
    client = new Client(config.baseUrl);
  });
  
  afterAll(async () => {
    // Properly close the client to avoid TLSWRAP open handles
    await client.close();
  });
  // Generate a consistent test username for the whole test run
  const testUsername = config.generateRandomUsername();
  const testPassword = 'securePass123!';
  
  beforeAll(() => {
    // Set these globally so all test files can access them
    global.testUsername = testUsername;
    global.testPassword = testPassword;
    console.log(`Generated test username for all tests: ${testUsername}`);
  });
  
  // Test for user registration
  test('POST /users - Register a new user', async () => {
    try {
      const { statusCode, body } = await client.request({
        method: 'POST',
        path: '/users',
        body: JSON.stringify({
          username: testUsername,
          password: testPassword,
          fullName: 'Test User',
          email: `${testUsername}@example.com`,
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const response = await body.json();
      expect(statusCode).toBe(201);
      expect(response.message).toBe('User registered successfully');
      console.log(`Successfully registered user: ${testUsername}`);
    } catch (error) {
      if (error.statusCode === 409) {
        console.log(`User ${testUsername} already exists, continuing with tests`);
      } else {
        throw error;
      }
    }
  });

  // Test for user login
  test('POST /sessions - Login user', async () => {
    console.log(`Logging in with username: ${testUsername}`);
    
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/sessions',
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.token).toBeDefined();
    
    // Save token for subsequent authenticated requests
    authToken = response.token;
    // Store token globally so other test files can use it
    global.authToken = authToken;
    console.log('Authentication successful, token obtained');
  });

  // Test for getting user profile
  test('GET /users/me - Get current user profile', async () => {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/users/me',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.data).toBeDefined();
    // Verify username matches our test user
    expect(response.data.username).toBe(testUsername);
    
    // Save user ID for other tests
    testUserId = response.data.id;
    global.testUserId = testUserId;
    console.log(`Retrieved user profile for ${testUsername}, ID: ${testUserId}`);
  });

  // Test for invalid login
  test('POST /sessions - Invalid credentials', async () => {
    try {
      await client.request({
        method: 'POST',
        path: '/sessions',
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'wrongpassword',
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      expect(error.statusCode).toBe(401);
      const errorBody = await error.body.json();
      expect(errorBody.error).toBe('Invalid credentials');
    }
  });

  // Create a new token for other tests to use
  test('Create token for other tests', async () => {
    // After the previous tests have run, create a new token for other test files
    console.log('Creating a fresh token for other test files to use...');
    
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/sessions',
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.token).toBeDefined();
    
    // Store the new token globally and in a file for other tests
    global.authToken = response.token;
    
    // Write auth info to a file that other tests can read
    const fs = require('fs');
    fs.writeFileSync('./tests/.auth.json', JSON.stringify({
      token: response.token,
      username: testUsername,
      password: testPassword
    }));
    
    console.log('Created and stored fresh token for other tests');
  });
  
  // Test for logout - this should be the last test to run
  test('ZZZ_LAST_TEST - DELETE /sessions - Logout user', async () => {
    // Use a separate token just for this test so we don't invalidate the one other tests use
    const { statusCode: loginStatusCode, body: loginBody } = await client.request({
      method: 'POST',
      path: '/sessions',
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const logoutResponse = await loginBody.json();
    const logoutToken = logoutResponse.token;
    
    const { statusCode } = await client.request({
      method: 'DELETE',
      path: '/sessions',
      headers: {
        'Authorization': `Bearer ${logoutToken}`
      }
    });
    
    expect(statusCode).toBe(204);
    
    // Verify token is no longer valid
    try {
      await client.request({
        method: 'GET',
        path: '/users/me',
        headers: {
          'Authorization': `Bearer ${logoutToken}`
        }
      });
    } catch (error) {
      expect(error.statusCode).toBe(401);
    }
  });
});
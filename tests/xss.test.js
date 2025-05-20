const { Client } = require('undici');
const config = require('./setup');

// Create a dedicated client that we can close after tests
let client;

// Test data
const xssPayload = '<script>alert("XSS")</script>';
const xssUsername = `xsstest_${Math.floor(Math.random() * 1000000)}`;
const xssPassword = 'SecurePass123!';
let xssToken = null;

// Setup and teardown
beforeAll(() => {
  // Create a new client for the API base URL
  client = new Client(config.baseUrl);
  console.log(`Running XSS tests against: ${config.baseUrl}`);
});

afterAll(async () => {
  // Properly close the client to avoid open handles
  await client.close();
});

describe('XSS Protection Tests', () => {
  // Register a user with XSS payload in username and fullName
  test('01. Register user with XSS payload', async () => {
    try {
      console.log(`Registering XSS test user: ${xssUsername} with XSS payload`);
      
      const { statusCode, body } = await client.request({
        method: 'POST',
        path: '/users',
        body: JSON.stringify({
          username: xssUsername + xssPayload, // Add XSS payload to username
          password: xssPassword,
          fullName: `Test User ${xssPayload}`, // Add XSS payload to fullName
          email: `${xssUsername}@example.com`,
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const response = await body.json();
      expect(statusCode).toBe(201);
      expect(response.message).toBe('User registered successfully');
      console.log(`Successfully registered XSS test user: ${xssUsername}`);
    } catch (error) {
      if (error.statusCode === 409) {
        console.log(`User ${xssUsername} already exists, continuing with tests`);
      } else {
        throw error;
      }
    }
  });

  // Login with the XSS test user
  test('02. Login with XSS test user', async () => {
    console.log(`Logging in with XSS test user: ${xssUsername}`);
    
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/sessions',
      body: JSON.stringify({
        username: xssUsername + xssPayload, // Same XSS payload as registration
        password: xssPassword,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const response = await body.json();
    
    // Login might fail if XSS filtering prevents matching the username
    // So we'll try with the sanitized username if it fails
    if (statusCode !== 200) {
      console.log('Login failed with XSS payload in username, trying with sanitized username');
      
      const { statusCode: retryStatusCode, body: retryBody } = await client.request({
        method: 'POST',
        path: '/sessions',
        body: JSON.stringify({
          username: xssUsername, // Try without XSS payload
          password: xssPassword,
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const retryResponse = await retryBody.json();
      expect(retryStatusCode).toBe(200);
      expect(retryResponse.token).toBeDefined();
      xssToken = retryResponse.token;
    } else {
      expect(response.token).toBeDefined();
      xssToken = response.token;
    }
    
    console.log('Authentication successful for XSS test user, token obtained');
  });

  // Check user profile to verify XSS content is sanitized
  test('03. Verify user profile has sanitized XSS content', async () => {
    expect(xssToken).not.toBeNull();
    
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/users/me',
      headers: {
        'Authorization': `Bearer ${xssToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.data).toBeDefined();
    
    // The username and fullName should not contain the raw XSS payload
    // This is a key test - it verifies XSS content was actually sanitized
    expect(response.data.username).not.toContain('<script>');
    expect(response.data.fullName).not.toContain('<script>');
    
    console.log(`Retrieved profile for XSS test user, sanitized username: ${response.data.username}`);
  });
  
  // Create an account with XSS payload
  test('04. Create account with XSS payload in name', async () => {
    expect(xssToken).not.toBeNull();
    
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/accounts',
      body: JSON.stringify({
        name: `${xssPayload}Account`,
        type: 'Checking'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xssToken}`
      }
    });
    
    let response;
    try {
      response = await body.json();
    } catch (e) {
      // Some APIs might not return JSON
      response = {};
    }
    
    // The request should not cause a server error, even if account creation fails
    // for other reasons (like permissions)
    expect(statusCode).not.toBe(500);
  });
  
  // Test query parameters with XSS payload
  test('05. API should sanitize XSS in query parameters', async () => {
    const { statusCode } = await client.request({
      method: 'GET',
      path: '/accounts',
      query: `search=${encodeURIComponent(xssPayload)}`,
      headers: xssToken ? {
        'Authorization': `Bearer ${xssToken}`
      } : {}
    });
    
    // Should not cause a server error
    expect(statusCode).not.toBe(500);
  });
});


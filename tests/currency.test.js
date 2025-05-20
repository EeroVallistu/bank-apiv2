const { Client } = require('undici');
const config = require('./setup');

// Create a dedicated client that we can close after tests
let client;

describe('Currency API Tests', () => {
  // Setup and teardown for undici client
  beforeAll(() => {
    // Create a new client for the API base URL
    client = new Client(config.baseUrl);
  });
  
  afterAll(async () => {
    // Properly close the client to avoid TLSWRAP open handles
    await client.close();
  });
  // Test for getting exchange rates with base currency
  test('GET /exchange-rates - Get all exchange rates for base currency', async () => {
    const { statusCode, body } = await client.request({
      path: '/exchange-rates?base=EUR',
      method: 'GET'
    });
    const response = { status: statusCode, data: await body.json() };
    
    expect(response.status).toBe(200);
    expect(response.data.base).toBe('EUR');
    expect(response.data.rates).toBeDefined();
    
    // Check that rates object contains other currencies
    const currencies = ['USD', 'GBP', 'SEK'];
    currencies.forEach(currency => {
      expect(response.data.rates).toHaveProperty(currency);
      expect(typeof response.data.rates[currency]).toBe('number');
    });
  });

  // Test for getting specific exchange rate
  test('GET /exchange-rates - Get specific exchange rate', async () => {
    const { statusCode, body } = await client.request({
      path: '/exchange-rates?base=EUR&target=USD',
      method: 'GET'
    });
    const response = { status: statusCode, data: await body.json() };
    
    expect(response.status).toBe(200);
    expect(response.data.base).toBe('EUR');
    expect(response.data.rates).toBeDefined();
    expect(response.data.rates).toHaveProperty('USD');
    expect(typeof response.data.rates['USD']).toBe('number');
  });

  // Test with invalid base currency
  test('GET /exchange-rates - Invalid base currency', async () => {
    try {
      await client.request({
        path: '/exchange-rates?base=XXX',
        method: 'GET'
      });
    } catch (error) {
      expect(error.statusCode).toBe(400);
      const errorBody = await error.body.json();
      expect(errorBody.error).toBe('Validation failed');
    }
  });

  // Test with invalid target currency
  test('GET /exchange-rates - Invalid target currency', async () => {
    try {
      await client.request({
        path: '/exchange-rates?base=EUR&target=XXX',
        method: 'GET'
      });
    } catch (error) {
      expect(error.statusCode).toBe(400);
      const errorBody = await error.body.json();
      expect(errorBody.error).toBe('Validation failed');
    }
  });
});
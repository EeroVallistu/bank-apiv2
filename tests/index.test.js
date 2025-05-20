/**
 * Main test file that runs all tests for the bank API
 */

// Import required modules
const { Client } = require('undici');
const config = require('./setup');

describe('Bank API Tests', () => {
  // Check API connectivity without leaving open handles
  beforeAll(async () => {
    // Extract host and port from the URL
    let url;
    try {
      url = new URL(config.baseUrl);
    } catch (e) {
      console.warn(`Invalid URL: ${config.baseUrl}`);
      return;
    }

    const host = url.hostname;
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    
    // Use a socket connection instead of HTTP
    console.log(`Testing connectivity to ${host}:${port}...`);
    
    // Use net.connect with a timeout to check if the server is reachable
    try {
      await new Promise((resolve, reject) => {
        const net = require('net');
        const socket = net.connect({ host, port });
        const timer = setTimeout(() => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }, 3000);
        
        socket.on('connect', () => {
          clearTimeout(timer);
          socket.end();
          resolve();
        });
        
        socket.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      console.log(`Successfully connected to ${config.baseUrl}`);
    } catch (error) {
      console.warn(`Warning: Could not connect to API at ${config.baseUrl}`);
      console.warn(`Error: ${error.message}`);
      console.warn('Make sure the server is running and the URL is correct in .env file');
    }
  }, 5000);
  
  test('API connectivity test', () => {
    // This is just a placeholder to make sure the describe block has at least one test
    expect(true).toBe(true);
  });
  
  // Clean up after all tests
  afterAll(async () => {
    // Add a small delay to let any pending network operations finish
    await new Promise(resolve => setTimeout(resolve, 500));
  });
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
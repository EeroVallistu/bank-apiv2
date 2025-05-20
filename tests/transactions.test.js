const { Client } = require('undici');
const config = require('./setup');

// Create a dedicated client that we can close after tests
let client;

let authToken;
let testAccountNumber;
let testTransactionId;

describe('Transactions API Tests', () => {
  // Setup and teardown for undici client
  beforeAll(() => {
    // Create a new client for the API base URL
    client = new Client(config.baseUrl);
  });
  
  afterAll(async () => {
    // Properly close the client to avoid TLSWRAP open handles
    await client.close();
  });
  // Setup: Login and create an account
  beforeAll(async () => {
    try {
      // Try to read auth data from file
      const fs = require('fs');
      if (fs.existsSync('./tests/.auth.json')) {
        const authData = JSON.parse(fs.readFileSync('./tests/.auth.json', 'utf8'));
        authToken = authData.token;
        console.log('Transactions tests: Using token from .auth.json file');
        // Don't return early, continue to account creation
      }
    } catch (err) {
      console.warn('Cannot read auth file:', err.message);
    }

    // If file doesn't exist or we couldn't read it
    if (global.authToken) {
      authToken = global.authToken;
      console.log('Transactions tests: Using token from global variable');
    } else {
      // If no token exists, we need to create one
      console.log('WARNING: No auth token found, creating one for transactions tests');
      
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
        
        const loginResponse = await body.json();
        authToken = loginResponse.token;
        console.log(`Transactions test: Successfully logged in as ${username}`);
      } catch (error) {
        console.error(`Authentication failed: ${error.message}`);
        throw new Error('Failed to authenticate for transactions tests');
      }
    }
    
    // Create test accounts for internal transfers
    try {
      // Create fresh test accounts if not defined in environment
      const accountName = `Test Account ${Date.now()}`;
      console.log(`Creating test account: ${accountName}`);
      
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
      
      const accountResponse = await body.json();
      testAccountNumber = accountResponse.data.accountNumber;
      console.log(`Created source account: ${testAccountNumber}`);

      // Create a second account as well for transfers
      const destinationAccountName = `Destination Account ${Date.now()}`;
      const { statusCode: destStatusCode, body: destBody } = await client.request({
        method: 'POST',
        path: '/accounts',
        body: JSON.stringify({
          name: destinationAccountName,
          currency: 'EUR'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      const destinationResponse = await destBody.json();
      global.destinationAccountNumber = destinationResponse.data.accountNumber;
      console.log(`Created destination account: ${global.destinationAccountNumber}`);
      
      // Check if we have an external destination for testing external transfers
      if (config.externalDestination) {
        global.externalDestinationAccount = config.externalDestination;
        console.log(`Using external destination account: ${global.externalDestinationAccount}`);
      }
    } catch (error) {
      console.error('Failed to setup test accounts:', error.message);
      throw new Error('Cannot continue transaction tests without accounts');
    }
  });

  // Test fetching all transactions
  test('GET /transfers - Get all user transactions', async () => {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/transfers',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  // Test internal transfer
  test('POST /transfers - Create internal transaction', async () => {
    // Use the accounts created in beforeAll
    const destinationAccountNumber = global.destinationAccountNumber;
    
    if (!testAccountNumber || !destinationAccountNumber) {
      throw new Error('Missing account numbers for transfer test');
    }
    
    console.log(`Transfer from ${testAccountNumber} to ${destinationAccountNumber}`);
    
    // Create internal transfer using unified endpoint
    const { statusCode, body } = await client.request({
      method: 'POST',
      path: '/transfers',
      body: JSON.stringify({
        fromAccount: testAccountNumber,
        toAccount: destinationAccountNumber,
        amount: 10.00,
        explanation: 'Test internal transfer'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(201);
    expect(response.data).toBeDefined();
    expect(response.data.fromAccount).toBe(testAccountNumber);
    expect(response.data.toAccount).toBe(destinationAccountNumber);
    
    // Save transaction ID for later tests
    testTransactionId = response.data.id;
  });

  // Test external transfer (if external account is configured)
  test('POST /transfers - Send to external bank', async () => {
    // Skip test if no external destination account is configured
    if (!global.externalDestinationAccount) {
      console.log('Skipping external transfer test - no external account configured');
      return;
    }
    
    console.log(`Testing external transfer to: ${global.externalDestinationAccount}`);
    
    // Create external transfer using unified endpoint
    try {
      const { statusCode, body } = await client.request({
        method: 'POST',
        path: '/transfers',
        body: JSON.stringify({
          fromAccount: testAccountNumber,
          toAccount: global.externalDestinationAccount,
          amount: 1.00, // Small amount for testing
          explanation: 'Test external transfer'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const response = await body.json();
      expect(statusCode).toBe(201);
      expect(response.data).toBeDefined();
      expect(response.data.fromAccount).toBe(testAccountNumber);
      expect(response.data.toAccount).toBe(global.externalDestinationAccount);
      
      console.log('External transfer test succeeded');
    } catch (error) {
      if (error.statusCode) {
        const errorBody = await error.body?.json();
        console.error(`External transfer failed: ${error.statusCode} - ${JSON.stringify(errorBody)}`);
      }
      throw error;
    }
  });

  // Test unified transfer endpoint (which determines if internal or external)
  test('POST /transfers - Create transfer (auto-detect internal)', async () => {
    // For this test, we need a second account to transfer to (reuse from previous test)
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/accounts',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    // Get all accounts
    const accounts = response.data;
    console.log(`Found ${accounts.length} accounts for transfer test`);
    
    // If we don't have at least 2 accounts, create another one
    if (accounts.length < 2) {
      console.log('Creating additional account for transfer test');
      const newAccountName = `Additional Account ${Date.now()}`;
      const { statusCode: createStatusCode, body: createBody } = await client.request({
        method: 'POST',
        path: '/accounts',
        body: JSON.stringify({
          name: newAccountName,
          currency: 'EUR'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const newAccountResponse = await createBody.json();
      // Add the new account to our array
      accounts.push(newAccountResponse.data);
      console.log(`Created additional account: ${newAccountResponse.data.accountNumber}`);
    }
    
    // Now we should have at least 2 accounts
    expect(accounts.length).toBeGreaterThanOrEqual(2);
    
    const sourceAccount = accounts[0];
    const destinationAccount = accounts[1];
    
    // Create transfer using main endpoint
    const { statusCode: transferStatusCode, body: transferBody } = await client.request({
      method: 'POST',
      path: '/transfers',
      body: JSON.stringify({
        fromAccount: sourceAccount.accountNumber,
        toAccount: destinationAccount.accountNumber,
        amount: 5.00,
        explanation: 'Test auto-detect internal transfer'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const transferResponse = await transferBody.json();
    expect(transferStatusCode).toBe(201);
    expect(transferResponse.data).toBeDefined();
    expect(transferResponse.data.fromAccount).toBe(sourceAccount.accountNumber);
    expect(transferResponse.data.toAccount).toBe(destinationAccount.accountNumber);
  });

  // Test transaction validation failures
  test('POST /transfers - Validation errors', async () => {
    try {
      await client.request({
        method: 'POST',
        path: '/transfers',
        body: JSON.stringify({
          // Missing required fields
          fromAccount: testAccountNumber,
          // Missing toAccount
          amount: -5.00, // Invalid amount
          // Missing explanation
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

  // Negative test - insufficient funds
  test('POST /transfers - Insufficient funds', async () => {
    try {
      // Get all accounts
      const { statusCode: accStatusCode, body: accBody } = await client.request({
        method: 'GET',
        path: '/accounts',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const accountsResponse = await accBody.json();
      const accounts = accountsResponse.data;
      console.log(`Found ${accounts.length} accounts for insufficient funds test`);
      
      // If we don't have at least 2 accounts, create another one
      if (accounts.length < 2) {
        console.log('Creating additional account for insufficient funds test');
        const newAccountName = `Additional Account ${Date.now()}`;
        const { statusCode: newAccStatusCode, body: newAccBody } = await client.request({
          method: 'POST',
          path: '/accounts',
          body: JSON.stringify({
            name: newAccountName,
            currency: 'EUR'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const newAccountResponse = await newAccBody.json();
        // Add the new account to our array
        accounts.push(newAccountResponse.data);
        console.log(`Created additional account: ${newAccountResponse.data.accountNumber}`);
      }
      
      // Now we should have at least 2 accounts
      expect(accounts.length).toBeGreaterThanOrEqual(2);
      
      const sourceAccount = accounts[0];
      const destinationAccount = accounts[1];
      const sourceAccountBalance = sourceAccount.balance;
      
      // Try to transfer more than available balance
      await client.request({
        method: 'POST',
        path: '/transfers',
        body: JSON.stringify({
          fromAccount: sourceAccount.accountNumber,
          toAccount: destinationAccount.accountNumber,
          amount: sourceAccountBalance + 1000,
          explanation: 'Should fail - insufficient funds'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      // Handle the insufficient funds error, but also allow for other errors
      if (error.statusCode) {
        expect(error.statusCode).toBe(402);
        const errorBody = await error.body.json();
        expect(errorBody.error).toBe('Insufficient funds');
      } else {
        console.error('Unexpected error in insufficient funds test:', error.message);
        throw error; // Re-throw to fail the test properly
      }
    }
  });

  // Get transaction details using ID from previous test
  test('GET /transfers/{id} - Get transaction details', async () => {
    // Skip if we don't have a transaction ID from previous tests
    if (!testTransactionId) {
      console.log('Getting all transactions to find a valid transaction ID');
      
      // If no specific transaction ID, we'll get all transactions and use the first one
      const { statusCode: txStatusCode, body: txBody } = await client.request({
        method: 'GET',
        path: '/transfers',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const transactionsResponse = await txBody.json();
      const transactions = transactionsResponse.data;
      if (transactions && transactions.length > 0) {
        testTransactionId = transactions[0].id;
        console.log(`Found transaction ID: ${testTransactionId}`);
      } else {
        console.log('No existing transactions found, creating a transfer to test');
        
        // First ensure we have accounts to transfer between
        if (!testAccountNumber || !global.destinationAccountNumber) {
          console.log('Creating accounts for transaction details test');
          
          // Create source account if needed
          if (!testAccountNumber) {
            const { statusCode: srcStatusCode, body: srcBody } = await client.request({
              method: 'POST',
              path: '/accounts',
              body: JSON.stringify({
                name: `Source Account ${Date.now()}`,
                currency: 'EUR'
              }),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              }
            });
            const srcAccountResponse = await srcBody.json();
            testAccountNumber = srcAccountResponse.data.accountNumber;
            console.log(`Created source account: ${testAccountNumber}`);
          }
          
          // Create destination account if needed
          if (!global.destinationAccountNumber) {
            const { statusCode: dstStatusCode, body: dstBody } = await client.request({
              method: 'POST',
              path: '/accounts',
              body: JSON.stringify({
                name: `Destination Account ${Date.now()}`,
                currency: 'EUR'
              }),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              }
            });
            const dstAccountResponse = await dstBody.json();
            global.destinationAccountNumber = dstAccountResponse.data.accountNumber;
            console.log(`Created destination account: ${global.destinationAccountNumber}`);
          }
        }
        
        console.log(`Creating a transaction between accounts to test transaction details`);
        const { statusCode: transferStatusCode, body: transferBody } = await client.request({
          method: 'POST',
          path: '/transfers',
          body: JSON.stringify({
            fromAccount: testAccountNumber,
            toAccount: global.destinationAccountNumber,
            amount: 1.00,
            explanation: 'Test transaction for details endpoint'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const transferResponse = await transferBody.json();
        testTransactionId = transferResponse.data.id;
        console.log(`Created test transaction with ID: ${testTransactionId}`);
      }
    }
    
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: `/transfers/${testTransactionId}`,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const response = await body.json();
    expect(statusCode).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testTransactionId);
  });
});
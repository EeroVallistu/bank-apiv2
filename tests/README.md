# Bank API Test Suite Documentation

## Overview

This document explains the test suite for the Bank API, including what the tests request, expected outputs, authentication flow, and test setup.

## Test Organization

The test suite is organized into several test files, each focusing on different aspects of the API:

1. **auth.test.js** - Authentication endpoints (registration, login, logout)
2. **accounts.test.js** - Account management endpoints
3. **transactions.test.js** - Money transfer operations
4. **currency.test.js** - Exchange rate functionality
5. **b2b.test.js** - Bank-to-bank communication endpoints
6. **index.test.js** - Core API connectivity tests

## Common Test Patterns

### HTTP Client

Tests use the `undici` HTTP client to make requests to the API. Each test file creates a dedicated client that is properly closed after tests complete:

```javascript
const { Client } = require('undici');
const client = new Client(config.baseUrl);

// After tests
await client.close();
```

### Authentication

Most tests require authentication. The `auth.test.js` file creates a token that's stored both globally and in a `.auth.json` file for other test files to use.

```javascript
// Token retrieval example
let authToken;
try {
  const fs = require('fs');
  if (fs.existsSync('./tests/.auth.json')) {
    const authData = JSON.parse(fs.readFileSync('./tests/.auth.json', 'utf8'));
    authToken = authData.token;
  }
} catch (err) {
  // Fallback to global token or create new one
}
```

### Request/Response Patterns

Tests follow a consistent pattern for API requests:

```javascript
const { statusCode, body } = await client.request({
  method: 'POST',  // or GET, DELETE, etc.
  path: '/endpoint',
  body: JSON.stringify(payload),  // for POST/PUT requests
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`  // for authenticated requests
  }
});

const response = await body.json();
```

## Test Files Explained

### auth.test.js

Tests authentication functionality, including user registration, login, profile retrieval, and logout.

#### Key Test Cases

1. **User Registration (`POST /users`):**
   - **Request:** Username, password, full name, email
   - **Expected Response:** 201 status code, success message
   - **Validation:** User creation confirmation

2. **User Login (`POST /sessions`):**
   - **Request:** Username, password
   - **Expected Response:** 200 status code with JWT token
   - **Validation:** Token exists and is stored for future tests

3. **User Profile (`GET /users/me`):**
   - **Request:** Authenticated request
   - **Expected Response:** 200 status code with user details
   - **Validation:** Profile contains correct username

4. **Invalid Login:**
   - **Request:** Invalid credentials
   - **Expected Response:** 401 status code with error message

5. **User Logout (`DELETE /sessions`):**
   - **Request:** Authenticated request to terminate session
   - **Expected Response:** 204 status code
   - **Validation:** Token becomes invalid after logout

### accounts.test.js

Tests account management functionality, including creating and retrieving accounts.

#### Key Test Cases

1. **List Accounts (`GET /accounts`):**
   - **Request:** Authenticated request
   - **Expected Response:** 200 status code with array of accounts
   - **Validation:** Response contains array of account objects

2. **Create Account (`POST /accounts`):**
   - **Request:** Account name and currency
   - **Expected Response:** 201 status code with account details
   - **Validation:** Account has correct name, currency, and a valid account number

3. **Get Account Details (`GET /accounts/{accountNumber}`):**
   - **Request:** Authenticated request with account number
   - **Expected Response:** 200 status code with account details
   - **Validation:** Account details match expected account

4. **Invalid Account Request:**
   - **Request:** Invalid account number
   - **Expected Response:** 404 status code

5. **Validation Errors:**
   - **Request:** Invalid account data
   - **Expected Response:** 400 status code with validation errors

### transactions.test.js

Tests money transfer operations between accounts.

#### Key Test Cases

1. **View Transactions (`GET /transfers`):**
   - **Request:** Authenticated request
   - **Expected Response:** 200 status code with transaction history
   - **Validation:** Response contains array of transactions

2. **Unified Transfer (`POST /transfers`):**
   - **Request:** Source account, destination account, amount, explanation
   - **Expected Response:** 201 status code with transaction details
   - **Validation:** System correctly handles both internal and external transfers
   - **Note:** This unified endpoint replaces the separate internal and external endpoints

3. **Transfer Details (`GET /transfers/{id}`):**
   - **Request:** Authenticated request with transaction ID
   - **Expected Response:** 200 status code with transaction details
   - **Validation:** Transaction details match the expected transaction

4. **Validation and Insufficient Funds:**
   - **Request:** Invalid transfer data or amount exceeding balance
   - **Expected Response:** 400 status code for validation errors, 402 for insufficient funds

### currency.test.js

Tests exchange rate functionality and currency conversion.

#### Key Test Cases

1. **Get Exchange Rates (`GET /exchange-rates`):**
   - **Request:** Base currency parameter
   - **Expected Response:** 200 status code with exchange rates
   - **Validation:** Response contains base currency and rates for other currencies

2. **Specific Exchange Rate (`GET /exchange-rates?base=X&target=Y`):**
   - **Request:** Base and target currency parameters
   - **Expected Response:** 200 status code with specific rate
   - **Validation:** Response contains correct currencies and rate

3. **Invalid Currency:**
   - **Request:** Invalid currency code
   - **Expected Response:** 400 status code with validation error

### b2b.test.js

Tests bank-to-bank communication endpoints for interbank transactions.

#### Key Test Cases

1. **B2B Transaction (`POST /transactions/b2b`):**
   - **Request:** JWT token from partner bank
   - **Expected Response:** 200 status code with transaction details
   - **Validation:** Response contains receiver name and transaction ID

2. **Invalid B2B Requests:**
   - **Request:** Invalid or missing JWT token
   - **Expected Response:** 400 status code with appropriate error message

## Test Setup

### Prerequisites

1. The bank API server must be running
2. A database with test data should be available
3. Environment variables should be properly configured

### Environment Configuration

Create a `.env` file based on the `.env.example` file with appropriate settings for:

- API endpoint URL
- Test user credentials (if needed)
- External bank configuration (if testing B2B)

### Running Tests

Use the following commands to run the tests:

```bash
# Run all tests
bun run test

# Run specific test file
bun run test tests/auth.test.js
```

### Test Order

Tests should be run in the following order due to dependencies:

1. `auth.test.js` (creates authentication tokens needed by other tests)
2. Any other test files

## Error Handling

The tests handle errors in a consistent way:

```javascript
try {
  // Make API request
} catch (error) {
  expect(error.statusCode).toBe(expectedErrorCode);
  const errorBody = await error.body.json();
  expect(errorBody.error).toBe('Expected error message');
}
```

## Test Data Management

The tests create their own test data when possible. Account numbers and transaction IDs are saved during test execution for use in subsequent tests.

## Cleanup

Resources created during tests (like test accounts) are not automatically deleted to allow for manual inspection if needed.
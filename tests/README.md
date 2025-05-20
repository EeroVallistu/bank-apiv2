# Testing Guide

## XSS Testing Workflow

The XSS tests create actual users with XSS payloads in the username and fullName fields.

### Configuration

1. Copy `.env.example` to `.env` in the tests directory
2. Configure the API URL to test in setup.js or via environment variables

```
# Base URL for the API to test (default: https://bank.eerovallistu.site)
TEST_API_URL=https://your-bank-api.com
```

### Running Tests

```bash
# Run all tests including XSS tests
bun run test

# Run only XSS tests
bun run test tests/xss.test.js
```

### Test Workflow

The XSS tests perform the following validations:

1. Create a user with XSS payload in username and fullName
2. Login with the created user credentials
3. Verify that the XSS content is properly sanitized in the user profile
4. Attempt to create an account with XSS payload in the name
5. Test that query parameters with XSS content are handled properly

### Test Implementation Details

- The test creates a unique random username with XSS payload appended
- It verifies that the XSS content is sanitized by checking the user profile
- All tests run against the API URL specified in the configuration
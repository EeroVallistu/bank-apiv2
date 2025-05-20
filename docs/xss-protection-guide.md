# XSS Protection Guide

## What We've Implemented

We've added comprehensive Cross-Site Scripting (XSS) protection to the bank API by implementing:

1. **Global Sanitization Middleware**: All request bodies, URL parameters, and query parameters are automatically sanitized
2. **XSS Library**: Using the `xss` NPM package which escapes potentially malicious HTML
3. **Recursive Object Sanitization**: Protection works for deeply nested objects and arrays

## How to Test XSS Protection

### 1. Run the Automated Test

We've included a Jest test that verifies XSS protection is working:

```bash
bun test tests/xss.test.js
```

This test sends XSS payloads to various endpoints and verifies the server processes them properly.

### 2. Manual Testing

We've created a script that tests XSS payloads against various endpoints. It:
- Tests unauthenticated endpoints
- Logs in to get an auth token
- Tests authenticated endpoints with XSS payloads

To run the manual test:

```bash
# Start the server in one terminal
bun run dev

# In another terminal, run the test script
node tests/manual/test-xss-simple.js
```

### 3. What to Look For

When checking if XSS protection is working:

1. **No 500 Errors**: The server should handle XSS payloads without crashing
2. **Sanitized Output**: XSS payloads should be converted to harmless text
3. **Encoded Characters**: Look for `&lt;` and `&gt;` which indicate HTML encoding is working

Example of sanitized XSS output:
- Original payload: `<script>alert("XSS")</script>`
- Sanitized result: `&lt;script&gt;alert("XSS")&lt;/script&gt;`

## Verifying All Endpoints

To thoroughly test your API, modify the test script to try different endpoints:

1. **Replace Credentials**: Update the login function with valid credentials
2. **Add More Endpoints**: Test XSS protection on all critical endpoints
3. **Check Responses**: Verify no raw XSS payloads appear in responses

## Security Best Practices

In addition to XSS protection, remember these security practices:

1. Always validate input on the server side
2. Use content security policies (CSP) for frontend applications
3. Set secure and HttpOnly cookies
4. Keep the XSS library updated to the latest version
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

You can manually test XSS protection through the Swagger UI or API client:

1. **Using Swagger UI**:
   - Go to `/docs` in your browser
   - Try entering XSS payloads into form fields
   - Check responses to verify sanitization

2. **Using cURL or Postman**:
   - Send requests with XSS payloads in various fields
   - Check for sanitized outputs in responses

Example XSS payloads to try:
```
<script>alert('XSS Test')</script>
<img src=x onerror=alert('XSS')>
```

### 3. What to Look For

When checking if XSS protection is working:

1. **No 500 Errors**: The server should handle XSS payloads without crashing
2. **Sanitized Output**: XSS payloads should be converted to harmless text
3. **Encoded Characters**: Look for `&lt;` and `&gt;` which indicate HTML encoding is working

Example of sanitized XSS output:
- Original payload: `<script>alert('XSS')</script>`
- Sanitized result: `&lt;script&gt;alert('XSS')&lt;/script&gt;`

You can also check the database directly to see how XSS attempts are stored - they should be properly encoded.

## Verifying All Endpoints

To thoroughly test your API for XSS vulnerabilities:

1. **Test All Input Fields**: Try XSS payloads in every user input field
2. **Check Database**: Verify that stored data is properly sanitized
3. **Test Authentication**: Pay special attention to login/registration fields
4. **API Parameters**: Test all query parameters and path variables

## Security Best Practices

In addition to XSS protection, remember these security practices:

1. Always validate input on the server side
2. Use content security policies (CSP) for frontend applications
3. Set secure and HttpOnly cookies
4. Keep the XSS library updated to the latest version
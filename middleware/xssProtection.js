/**
 * XSS Protection Middleware
 * Sanitizes request body, query parameters, and URL parameters to prevent XSS attacks
 */

const expressSanitizer = require('express-sanitizer');

function sanitizeObject(obj) {
  if (!obj) return obj;
  
  const result = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // Sanitize string values using the sanitizer function
      // Create a mock request object that express-sanitizer can work with
      const req = {
        body: { field: value }
      };
      const res = {};
      const next = () => {};
      
      // Apply the sanitizer middleware to our mock request
      expressSanitizer()(req, res, next);
      
      // Extract the sanitized value
      result[key] = req.body.field;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      result[key] = sanitizeObject(value);
    } else {
      // Keep non-string values as is
      result[key] = value;
    }
  });
  
  return result;
}

function xssProtection(req, res, next) {
  // Sanitize request body if it exists
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters if they exist
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters if they exist
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

module.exports = xssProtection;
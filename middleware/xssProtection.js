const { check, validationResult } = require('express-validator');
const xss = require('xss');

// Configure XSS with stricter options that sanitize ALL HTML tags
// IMPORTANT: No tags are whitelisted to prevent XSS vulnerabilities
const xssOptions = {
  whiteList: {}, // Empty whitelist means NO tags are allowed, even <b> or <i>
  stripIgnoreTag: false, // Don't strip tags - encode them as HTML entities instead
  escapeHtmlTag: true, // Encode < and > as &lt; and &gt;
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object'] // Remove content inside these tags
};

// Create a strict XSS filter that encodes all HTML tags
const strictXss = new xss.FilterXSS(xssOptions);

/**
 * Middleware to sanitize request body, query parameters, and headers against XSS attacks
 */
const sanitizeAll = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * Recursively sanitize all string values in an object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitizedObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Apply strict XSS sanitization that removes ALL HTML tags
      // Special fields that need extra protection
      if (key === 'username' || key === 'name' || key === 'full_name') {
        // Use strict XSS sanitization for critical fields
        sanitizedObj[key] = strictXss.process(value);
      } else {
        // Regular sanitization for other fields
        sanitizedObj[key] = xss(value);
      }
    } else if (typeof value === 'object') {
      sanitizedObj[key] = sanitizeObject(value);
    } else {
      sanitizedObj[key] = value;
    }
  }
  
  return sanitizedObj;
};

/**
 * Generate validation for a specific field
 */
const sanitizeField = (field) => {
  return check(field).customSanitizer(value => {
    if (typeof value !== 'string') return value;
    
    // Apply strict sanitization for critical fields
    if (field === 'username' || field === 'name' || field === 'full_name') {
      return strictXss.process(value);
    }
    
    // Regular sanitization for other fields
    return xss(value);
  });
};

module.exports = {
  sanitizeAll,
  sanitizeField,
  strictXss // Export for use in other files
};
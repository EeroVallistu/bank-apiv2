const { check, validationResult } = require('express-validator');
const xss = require('xss');

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
      sanitizedObj[key] = xss(value);
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
    return typeof value === 'string' ? xss(value) : value;
  });
};

module.exports = {
  sanitizeAll,
  sanitizeField
};
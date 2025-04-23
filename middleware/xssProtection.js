/**
 * XSS Protection Middleware
 * Sanitizes request body, query parameters, and URL parameters to prevent XSS attacks
 */

const expressSanitizer = require('express-sanitizer');
const htmlEntities = require('html-entities');

function sanitizeObject(obj) {
  if (!obj) return obj;
  
  const result = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // First encode HTML entities
      let sanitizedValue = htmlEntities.encode(value);
      
      // Then use express-sanitizer for additional protection
      const req = {
        body: { field: sanitizedValue }
      };
      const res = {};
      const next = () => {};
      
      expressSanitizer()(req, res, next);
      
      // Additional custom sanitization
      sanitizedValue = req.body.field
        .replace(/javascript:/gi, '')  // Remove javascript: protocol
        .replace(/data:/gi, '')       // Remove data: protocol
        .replace(/vbscript:/gi, '')   // Remove vbscript: protocol
        .replace(/onclick/gi, '')      // Remove onclick handlers
        .replace(/onload/gi, '')       // Remove onload handlers
        .replace(/onerror/gi, '')      // Remove onerror handlers
        .replace(/onmouseover/gi, '')  // Remove onmouseover handlers
        .trim();                       // Trim whitespace
      
      result[key] = sanitizedValue;
    } else if (Array.isArray(value)) {
      // Handle arrays by sanitizing each element
      result[key] = value.map(item => 
        typeof item === 'object' ? sanitizeObject(item) : 
        typeof item === 'string' ? htmlEntities.encode(item) : item
      );
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
  try {
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
    
    // Add security headers if not already set by helmet
    if (!res.getHeader('X-XSS-Protection')) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = xssProtection;
/**
 * Utility functions for sanitizing data to prevent XSS
 */

/**
 * Escapes HTML special characters in a string to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for inclusion in HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Recursively sanitizes objects by escaping HTML in string values
 * @param {object} obj - Object to sanitize
 * @returns {object} - Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        result[key] = escapeHtml(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Middleware to sanitize response body before sending to client
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
function sanitizeResponseMiddleware(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(body) {
    const sanitizedBody = sanitizeObject(body);
    return originalJson.call(this, sanitizedBody);
  };
  
  next();
}

module.exports = {
  escapeHtml,
  sanitizeObject,
  sanitizeResponseMiddleware
};
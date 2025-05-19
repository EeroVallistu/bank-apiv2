const { APIError } = require('../utils/errors');

/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error caught by error handler:', err);
  
  // Default status code and message
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let errors = null;
  
  // Handle API errors
  if (err instanceof APIError) {
    status = err.status;
    message = err.message;
    code = err.code;
    errors = err.errors;
  } 
  // Handle validation errors from express-validator
  else if (err.array && typeof err.array === 'function') {
    status = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = err.array();
  } 
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } 
  else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }
  // Handle Not Found errors
  else if (err.name === 'NotFoundError') {
    status = 404;
    message = err.message || 'Resource not found';
    code = 'NOT_FOUND';
  }
  // Handle network/external service errors
  else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    status = 502;
    message = 'External service unavailable';
    code = 'BAD_GATEWAY';
  }
  
  // New error response format
  let errorResponse;
  if (errors) {
    errorResponse = { error: message, details: errors };
  } else {
    errorResponse = { error: message };
  }
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  res.status(status).json(errorResponse);
}

module.exports = errorHandler;

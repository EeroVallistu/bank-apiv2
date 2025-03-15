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
  
  // Handle specific database errors
  // (Would be expanded for Sequelize or other database-specific errors)
  
  // Create response object
  const errorResponse = {
    status: 'error',
    message,
    code
  };
  
  // Add stack trace in development mode only
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  // Add validation errors if present
  if (errors) {
    errorResponse.errors = errors;
  }
  
  res.status(status).json(errorResponse);
}

module.exports = errorHandler;

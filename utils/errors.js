/**
 * Custom error classes for consistent error handling across the API
 */

// Base API error class
class APIError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// HTTP 400 - Bad Request errors
class ValidationError extends APIError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

// HTTP 401 - Unauthorized errors
class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

// HTTP 403 - Forbidden errors
class ForbiddenError extends APIError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

// HTTP 404 - Not Found errors
class NotFoundError extends APIError {
  constructor(resource = 'Resource', message = null) {
    super(message || `${resource} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

// HTTP 409 - Conflict errors
class ConflictError extends APIError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

// HTTP 402 - Payment Required (for insufficient funds)
class InsufficientFundsError extends APIError {
  constructor(message = 'Insufficient funds') {
    super(message, 402, 'INSUFFICIENT_FUNDS');
  }
}

// HTTP 429 - Too Many Requests
class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Utilities for working with errors
const errorUtils = {
  handleValidationErrors(errors) {
    if (errors && !errors.isEmpty) {
      throw new ValidationError('Validation failed', errors.array());
    }
  }
};

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InsufficientFundsError,
  RateLimitError,
  errorUtils
};

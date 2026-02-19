// server/src/utils/errors.js

/**
 * Base application error.
 * All custom errors extend this class.
 *
 * @extends Error
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code
   * @param {Object} [details=null] - Additional error details (validation errors, etc.)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 -- Validation error (bad request body, query, or params).
 * @extends AppError
 */
export class ValidationError extends AppError {
  /**
   * @param {string} [message='Validation failed']
   * @param {Array<{field: string, message: string}>} [errors=[]]
   */
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
  }
}

/**
 * 401/403 -- Authentication or authorization error.
 * @extends AppError
 */
export class AuthError extends AppError {
  /**
   * @param {string} [message='Authentication required']
   * @param {number} [statusCode=401]
   */
  constructor(message = 'Authentication required', statusCode = 401) {
    super(message, statusCode, statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');
  }
}

/**
 * 404 -- Resource not found.
 * @extends AppError
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message='Resource not found']
   */
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 429 -- Rate limit exceeded.
 * @extends AppError
 */
export class RateLimitError extends AppError {
  /**
   * @param {string} [message='Rate limit exceeded']
   */
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * 409 -- Conflict (duplicate resource, version mismatch).
 * @extends AppError
 */
export class ConflictError extends AppError {
  /**
   * @param {string} [message='Resource conflict']
   */
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 402 -- Payment required (insufficient credits, subscription expired).
 * @extends AppError
 */
export class PaymentRequiredError extends AppError {
  /**
   * @param {string} [message='Payment required']
   */
  constructor(message = 'Payment required') {
    super(message, 402, 'PAYMENT_REQUIRED');
  }
}

/**
 * 503 -- Service unavailable (external dependency down).
 * @extends AppError
 */
export class ServiceUnavailableError extends AppError {
  /**
   * @param {string} [message='Service temporarily unavailable']
   */
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

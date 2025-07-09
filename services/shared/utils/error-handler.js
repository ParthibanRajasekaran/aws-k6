/**
 * Error Handler Utility
 * Centralized error handling for Lambda functions
 * 
 * @module shared/utils/error-handler
 */

class ErrorHandler {
  /**
   * Handle errors and return formatted HTTP response
   * @param {Error} error - The error to handle
   * @returns {Object} HTTP response object
   */
  static handleError(error) {
    console.error('Error occurred:', error);

    // Determine error type and status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = error.message;
    } else if (error.name === 'NotFoundError' || error.Code === 'NoSuchKey') {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      message = 'Unauthorized access';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
      message = 'Forbidden access';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      errorCode = 'CONFLICT';
      message = 'Resource conflict';
    } else if (error.message && error.message.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
      message = 'Request timeout';
    }

    const response = {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        error: {
          code: errorCode,
          message,
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        }
      })
    };

    return response;
  }

  /**
   * Create custom error types
   */
  static createValidationError(message) {
    const error = new Error(message);
    error.name = 'ValidationError';
    return error;
  }

  static createNotFoundError(message) {
    const error = new Error(message);
    error.name = 'NotFoundError';
    return error;
  }

  static createUnauthorizedError(message) {
    const error = new Error(message);
    error.name = 'UnauthorizedError';
    return error;
  }

  static createForbiddenError(message) {
    const error = new Error(message);
    error.name = 'ForbiddenError';
    return error;
  }

  static createConflictError(message) {
    const error = new Error(message);
    error.name = 'ConflictError';
    return error;
  }
}

module.exports = { ErrorHandler };

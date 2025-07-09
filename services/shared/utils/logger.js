/**
 * Enterprise Logger - Structured logging with correlation IDs
 * @module shared/utils/logger
 */

class Logger {
  constructor(service = 'unknown') {
    this.service = service;
    this.correlationId = null;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Set correlation ID for request tracing
   * @param {string} correlationId - Unique request identifier
   */
  setCorrelationId(correlationId) {
    this.correlationId = correlationId;
  }

  /**
   * Check if log level should be printed
   * @param {string} level - Log level to check
   * @returns {boolean} Whether to log
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  /**
   * Create structured log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Error|Object} dataOrError - Additional data or error object
   * @param {Object} additionalData - Additional context data
   */
  log(level, message, dataOrError = {}, additionalData = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: this.service,
      message,
      correlationId: this.correlationId,
      ...additionalData
    };

    // Handle error objects
    if (dataOrError instanceof Error) {
      logEntry.error = {
        name: dataOrError.name,
        message: dataOrError.message,
        stack: dataOrError.stack,
        statusCode: dataOrError.statusCode
      };
    } else if (dataOrError && typeof dataOrError === 'object') {
      Object.assign(logEntry, dataOrError);
    }

    // Add environment context
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      logEntry.lambda = {
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        region: process.env.AWS_REGION
      };
    }

    // Output to console (CloudWatch Logs in AWS)
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} additionalData - Additional context
   */
  error(message, error = null, additionalData = {}) {
    this.log('error', message, error, additionalData);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.log('info', message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Additional context to include in all logs
   * @returns {Logger} Child logger instance
   */
  child(context = {}) {
    const childLogger = new Logger(this.service);
    childLogger.correlationId = this.correlationId;
    childLogger.logLevel = this.logLevel;
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Log request/response for API operations
   * @param {Object} request - Request object
   * @param {Object} response - Response object
   * @param {number} duration - Request duration in ms
   */
  logApiCall(request, response, duration) {
    this.info('API call completed', {
      request: {
        method: request.method,
        path: request.path,
        headers: this.sanitizeHeaders(request.headers)
      },
      response: {
        statusCode: response.statusCode,
        headers: this.sanitizeHeaders(response.headers)
      },
      duration
    });
  }

  /**
   * Sanitize headers to remove sensitive information
   * @param {Object} headers - Headers object
   * @returns {Object} Sanitized headers
   */
  sanitizeHeaders(headers = {}) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = {};
    
    Object.keys(headers).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = headers[key];
      }
    });
    
    return sanitized;
  }
}

module.exports = { Logger };

/**
 * Validation Service - Handles input validation and sanitization
 * @module lambda-s3/services/validation-service
 */

const { Logger } = require('../../../shared/utils/logger');

const logger = new Logger('validation-service');

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

class ValidationService {
  constructor() {
    this.maxFilenameLength = 255;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedExtensions = [
      'txt', 'json', 'html', 'css', 'js', 'xml', 'csv',
      'png', 'jpg', 'jpeg', 'gif', 'webp',
      'pdf', 'doc', 'docx', 'zip'
    ];
    this.forbiddenPatterns = [
      /\.\./,  // Path traversal
      /[<>:"|?*]/,  // Invalid filename characters
      /^\s/,  // Leading whitespace
      /\s$/   // Trailing whitespace
    ];
  }

  /**
   * Validate Lambda event structure
   * @param {Object} event - Lambda event object
   * @throws {ValidationError} If event is invalid
   */
  validateEvent(event) {
    if (!event) {
      throw new ValidationError('Event object is required');
    }

    if (!event.httpMethod) {
      throw new ValidationError('HTTP method is required', 'httpMethod');
    }

    const validMethods = ['GET', 'POST', 'DELETE', 'OPTIONS'];
    if (!validMethods.includes(event.httpMethod)) {
      throw new ValidationError(`Invalid HTTP method: ${event.httpMethod}`, 'httpMethod');
    }

    logger.debug('Event validation passed', { httpMethod: event.httpMethod });
  }

  /**
   * Validate file upload request
   * @param {string} filename - File name
   * @param {string|Buffer} content - File content
   * @throws {ValidationError} If request is invalid
   */
  validateUploadRequest(filename, content) {
    this.validateFilename(filename);
    this.validateFileContent(content);
    this.validateFileSize(content);

    logger.debug('Upload request validation passed', {
      filename,
      contentLength: content?.length || 0
    });
  }

  /**
   * Validate file download request
   * @param {string} filename - File name
   * @throws {ValidationError} If request is invalid
   */
  validateDownloadRequest(filename) {
    this.validateFilename(filename);

    logger.debug('Download request validation passed', { filename });
  }

  /**
   * Validate file deletion request
   * @param {string} filename - File name
   * @throws {ValidationError} If request is invalid
   */
  validateDeleteRequest(filename) {
    this.validateFilename(filename);

    logger.debug('Delete request validation passed', { filename });
  }

  /**
   * Validate filename
   * @param {string} filename - File name to validate
   * @throws {ValidationError} If filename is invalid
   */
  validateFilename(filename) {
    if (!filename) {
      throw new ValidationError('Filename is required', 'filename');
    }

    if (typeof filename !== 'string') {
      throw new ValidationError('Filename must be a string', 'filename');
    }

    if (filename.length > this.maxFilenameLength) {
      throw new ValidationError(
        `Filename too long. Maximum length is ${this.maxFilenameLength} characters`,
        'filename'
      );
    }

    // Check for forbidden patterns
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(filename)) {
        throw new ValidationError('Filename contains invalid characters', 'filename');
      }
    }

    // Validate file extension
    const extension = this.getFileExtension(filename);
    if (extension && !this.allowedExtensions.includes(extension)) {
      throw new ValidationError(
        `File extension '${extension}' is not allowed. Allowed extensions: ${this.allowedExtensions.join(', ')}`,
        'filename'
      );
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExtension = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExtension)) {
      throw new ValidationError('Filename uses a reserved name', 'filename');
    }
  }

  /**
   * Validate file content
   * @param {string|Buffer} content - File content
   * @throws {ValidationError} If content is invalid
   */
  validateFileContent(content) {
    if (content === null || content === undefined) {
      throw new ValidationError('File content is required', 'content');
    }

    if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
      throw new ValidationError('File content must be a string or Buffer', 'content');
    }
  }

  /**
   * Validate file size
   * @param {string|Buffer} content - File content
   * @throws {ValidationError} If file is too large
   */
  validateFileSize(content) {
    const size = content?.length || 0;
    
    if (size > this.maxFileSize) {
      throw new ValidationError(
        `File too large. Maximum size is ${this.formatBytes(this.maxFileSize)}`,
        'content'
      );
    }

    if (size === 0) {
      throw new ValidationError('File cannot be empty', 'content');
    }
  }

  /**
   * Get file extension from filename
   * @param {string} filename - File name
   * @returns {string|null} File extension or null
   */
  getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : null;
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted size string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sanitize filename for safe storage
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    return filename
      .trim()
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }
}

module.exports = { ValidationService, ValidationError };

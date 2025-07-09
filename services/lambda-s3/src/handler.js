/**
 * Lambda S3 Handler - Enterprise Version
 * Handles file upload and download operations with S3
 * 
 * @module lambda-s3/handler
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Logger } = require('../../shared/utils/logger');
const { MetricsCollector } = require('../../shared/utils/metrics');
const { ErrorHandler } = require('../../shared/utils/error-handler');
const { ValidationService } = require('./services/validation-service');
const { S3Service } = require('./services/s3-service');

const logger = new Logger('lambda-s3-handler');
const metrics = new MetricsCollector();

class LambdaS3Handler {
  constructor() {
    this.s3Service = new S3Service();
    this.validationService = new ValidationService();
  }

  /**
   * Main Lambda handler function
   * @param {Object} event - Lambda event object
   * @param {Object} context - Lambda context object
   * @returns {Object} HTTP response
   */
  async handler(event, context) {
    const correlationId = context.awsRequestId;
    logger.setCorrelationId(correlationId);
    
    const startTime = Date.now();
    
    try {
      logger.info('Processing request', {
        httpMethod: event.httpMethod,
        path: event.path,
        correlationId
      });

      // Validate event structure
      this.validationService.validateEvent(event);

      let response;
      
      switch (event.httpMethod) {
        case 'POST':
          response = await this.handleUpload(event);
          break;
        case 'GET':
          response = await this.handleDownload(event);
          break;
        case 'DELETE':
          response = await this.handleDelete(event);
          break;
        case 'OPTIONS':
          response = this.handleOptions();
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${event.httpMethod}`);
      }

      // Record metrics
      metrics.recordLatency('lambda.duration', Date.now() - startTime);
      metrics.recordCount('lambda.invocations', 1, {
        method: event.httpMethod,
        status: 'success'
      });

      logger.info('Request processed successfully', {
        statusCode: response.statusCode,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      metrics.recordCount('lambda.errors', 1, {
        method: event.httpMethod,
        errorType: error.constructor.name
      });

      logger.error('Request processing failed', error, {
        duration: Date.now() - startTime
      });

      return ErrorHandler.handleError(error);
    }
  }

  /**
   * Handle file upload to S3
   * @param {Object} event - Lambda event
   * @returns {Object} HTTP response
   */
  async handleUpload(event) {
    const { filename } = event.queryStringParameters || {};
    const body = event.body || '';

    this.validationService.validateUploadRequest(filename, body);

    const result = await this.s3Service.uploadFile(filename, body);
    
    return {
      statusCode: 200,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        message: 'File uploaded successfully',
        filename,
        size: body.length,
        etag: result.ETag,
        timestamp: new Date().toISOString()
      })
    };
  }

  /**
   * Handle file download from S3
   * @param {Object} event - Lambda event
   * @returns {Object} HTTP response
   */
  async handleDownload(event) {
    const { filename } = event.queryStringParameters || {};

    this.validationService.validateDownloadRequest(filename);

    const result = await this.s3Service.downloadFile(filename);
    
    return {
      statusCode: 200,
      headers: {
        ...this.getCorsHeaders(),
        'Content-Type': result.ContentType || 'application/octet-stream',
        'Content-Length': result.ContentLength?.toString() || '0'
      },
      body: result.Body
    };
  }

  /**
   * Handle file deletion from S3
   * @param {Object} event - Lambda event
   * @returns {Object} HTTP response
   */
  async handleDelete(event) {
    const { filename } = event.queryStringParameters || {};

    this.validationService.validateDeleteRequest(filename);

    await this.s3Service.deleteFile(filename);
    
    return {
      statusCode: 200,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        message: 'File deleted successfully',
        filename,
        timestamp: new Date().toISOString()
      })
    };
  }

  /**
   * Handle OPTIONS requests for CORS
   * @returns {Object} HTTP response
   */
  handleOptions() {
    return {
      statusCode: 200,
      headers: this.getCorsHeaders(),
      body: ''
    };
  }

  /**
   * Get CORS headers
   * @returns {Object} CORS headers
   */
  getCorsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }
}

// Export handler instance
const handlerInstance = new LambdaS3Handler();

/**
 * Lambda entry point
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Object} HTTP response
 */
exports.handler = async (event, context) => {
  return handlerInstance.handler(event, context);
};

// Export class for testing
exports.LambdaS3Handler = LambdaS3Handler;

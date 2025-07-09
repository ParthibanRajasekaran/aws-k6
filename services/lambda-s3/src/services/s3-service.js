/**
 * S3 Service - Handles all S3 operations
 * @module lambda-s3/services/s3-service
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Logger } = require('../../../shared/utils/logger');
const { MetricsCollector } = require('../../../shared/utils/metrics');

const logger = new Logger('s3-service');
const metrics = new MetricsCollector();

class S3Service {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
      }
    });
    
    this.bucketName = process.env.BUCKET_NAME || process.env.BUCKET || 'default-bucket';
    
    logger.info('S3Service initialized', {
      bucketName: this.bucketName,
      endpoint: process.env.ENDPOINT,
      region: process.env.AWS_REGION
    });
  }

  /**
   * Upload file to S3
   * @param {string} filename - File name
   * @param {string|Buffer} content - File content
   * @returns {Object} S3 upload result
   */
  async uploadFile(filename, content) {
    const startTime = Date.now();
    
    try {
      logger.info('Uploading file to S3', { filename, size: content.length });

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: content,
        ContentType: this.getContentType(filename),
        Metadata: {
          uploadedAt: new Date().toISOString(),
          originalSize: content.length.toString()
        }
      });

      const result = await this.s3Client.send(command);
      
      metrics.recordLatency('s3.upload.duration', Date.now() - startTime);
      metrics.recordCount('s3.upload.success', 1);
      metrics.recordGauge('s3.upload.size', content.length);

      logger.info('File uploaded successfully', {
        filename,
        etag: result.ETag,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      metrics.recordCount('s3.upload.error', 1);
      logger.error('Failed to upload file', error, { filename });
      throw error;
    }
  }

  /**
   * Download file from S3
   * @param {string} filename - File name
   * @returns {Object} S3 download result
   */
  async downloadFile(filename) {
    const startTime = Date.now();
    
    try {
      logger.info('Downloading file from S3', { filename });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filename
      });

      const result = await this.s3Client.send(command);
      
      // Convert stream to string if needed
      if (result.Body && typeof result.Body.transformToString === 'function') {
        result.Body = await result.Body.transformToString();
      }
      
      metrics.recordLatency('s3.download.duration', Date.now() - startTime);
      metrics.recordCount('s3.download.success', 1);
      metrics.recordGauge('s3.download.size', result.ContentLength || 0);

      logger.info('File downloaded successfully', {
        filename,
        contentLength: result.ContentLength,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      metrics.recordCount('s3.download.error', 1);
      logger.error('Failed to download file', error, { filename });
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {string} filename - File name
   * @returns {Object} S3 delete result
   */
  async deleteFile(filename) {
    const startTime = Date.now();
    
    try {
      logger.info('Deleting file from S3', { filename });

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filename
      });

      const result = await this.s3Client.send(command);
      
      metrics.recordLatency('s3.delete.duration', Date.now() - startTime);
      metrics.recordCount('s3.delete.success', 1);

      logger.info('File deleted successfully', {
        filename,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      metrics.recordCount('s3.delete.error', 1);
      logger.error('Failed to delete file', error, { filename });
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} filename - File name
   * @returns {string} Content type
   */
  getContentType(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const contentTypes = {
      'txt': 'text/plain',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'zip': 'application/zip'
    };

    return contentTypes[extension] || 'application/octet-stream';
  }

  /**
   * Health check for S3 service
   * @returns {boolean} Service health status
   */
  async healthCheck() {
    try {
      // Try to list objects to verify connectivity
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: '__health_check__'
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      // Expected if health check file doesn't exist
      if (error.name === 'NoSuchKey') {
        return true;
      }
      logger.error('S3 health check failed', error);
      return false;
    }
  }
}

module.exports = { S3Service };

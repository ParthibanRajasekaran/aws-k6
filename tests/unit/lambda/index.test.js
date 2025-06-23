const { handler } = require('../../../lambda/index');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('Lambda Handler Tests', () => {
  let mockSend;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock for S3Client.send method
    mockSend = jest.fn();
    S3Client.prototype.send = mockSend;
    
    // Clear cache before each test
    const handler_module = require('../../../lambda/index');
    if (handler_module.cache) {
      handler_module.cache.clear();
    }
  });

  describe('POST requests (file upload)', () => {
    test('should upload file successfully', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'dGVzdCBjb250ZW50' // base64 encoded "test content"
        })
      };

      mockSend.mockResolvedValue({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'File uploaded',
        filename: 'test.txt'
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });

    test('should return 400 for missing filename', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          content: 'dGVzdCBjb250ZW50'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Missing filename or content'
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should return 400 for missing content', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.txt'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Missing filename or content'
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should handle S3 upload errors', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'dGVzdCBjb250ZW50'
        })
      };

      const s3Error = new Error('S3 upload failed');
      s3Error.$metadata = { httpStatusCode: 403 };
      s3Error.name = 'AccessDenied';
      mockSend.mockRejectedValue(s3Error);

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toEqual({
        error: 'S3 upload failed',
        code: 'AccessDenied'
      });
    });
  });

  describe('GET requests (file download)', () => {
    test('should download file successfully', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          filename: 'test.txt'
        }
      };

      const mockStream = Buffer.from('test content');
      mockSend.mockResolvedValue({
        Body: mockStream
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.filename).toBe('test.txt');
      expect(responseBody.content).toBe('dGVzdCBjb250ZW50'); // base64 encoded "test content"
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    test('should return cached file when available', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          filename: 'cached-test.txt'
        }
      };

      // First call to populate cache
      const mockStream = Buffer.from('cached content');
      mockSend.mockResolvedValue({
        Body: mockStream
      });

      await handler(event);

      // Second call should use cache
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.filename).toBe('cached-test.txt');
      // Should only call S3 once (first call), second should use cache
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should return 400 for missing filename parameter', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: null
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Missing filename parameter'
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should handle S3 download errors', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          filename: 'nonexistent.txt'
        }
      };

      const s3Error = new Error('The specified key does not exist.');
      s3Error.$metadata = { httpStatusCode: 404 };
      s3Error.name = 'NoSuchKey';
      mockSend.mockRejectedValue(s3Error);

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'The specified key does not exist.',
        code: 'NoSuchKey'
      });
    });
  });

  describe('Other HTTP methods', () => {
    test('should return 405 for unsupported methods', async () => {
      const event = {
        httpMethod: 'DELETE'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Method not allowed'
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle generic errors', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'dGVzdCBjb250ZW50'
        })
      };

      const genericError = new Error('Something went wrong');
      mockSend.mockRejectedValue(genericError);

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Something went wrong',
        code: 'Error'
      });
    });

    test('should handle malformed JSON in POST body', async () => {
      const event = {
        httpMethod: 'POST',
        body: 'invalid json'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Unexpected token');
    });
  });
});

// Import the handler module with its s3Client export
const lambdaModule = require('../../../lambda/index');
const { handler } = lambdaModule;
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Don't mock the AWS SDK completely, just create a mock client
console.log('Setting up test environment');

describe('Lambda Handler Tests', () => {
  let mockSend;
  let mockClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    console.log('Test setup: Mocks cleared');
    
    // Create a mock S3 client with a mock send function
    mockSend = jest.fn();
    mockClient = {
      send: mockSend
    };
    
    // Replace the module's S3 client with our mock
    console.log('Test setup: Replacing S3 client with mock');
    lambdaModule.s3Client = mockClient;
    
    // Clear cache before each test
    if (lambdaModule.cache) {
      lambdaModule.cache.clear();
      console.log('Test setup: Cache cleared');
    }
    
    // Ensure NODE_ENV is set to 'test'
    process.env.NODE_ENV = 'test';
  });

  // CRITICAL TEST: File Upload
  describe('POST requests (file upload)', () => {
    test('should upload file successfully', async () => {
      console.log('Starting POST test');
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.txt',
          content: 'dGVzdCBjb250ZW50' // base64 encoded "test content"
        })
      };

      console.log('Setting up mock for S3 PUT operation');
      mockSend.mockResolvedValue({});

      console.log('Calling lambda handler');
      const result = await handler(event);
      console.log('Lambda handler returned:', result);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'File uploaded',
        filename: 'test.txt'
      });
      // Verify the mock was called - we don't need to verify the exact command type
      expect(mockSend).toHaveBeenCalled();
      console.log('POST test completed successfully');
    });
  });

  // CRITICAL TEST: File Download 
  describe('GET requests (file download)', () => {
    test('should download file successfully', async () => {
      console.log('Starting GET test');
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          filename: 'test.txt'
        }
      };

      console.log('Setting up mock for S3 GET operation');
      const mockStream = Buffer.from('test content');
      mockSend.mockResolvedValue({
        Body: mockStream
      });

      console.log('Calling lambda handler');
      const result = await handler(event);
      console.log('Lambda handler returned:', result);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.filename).toBe('test.txt');
      expect(responseBody.content).toBe('dGVzdCBjb250ZW50'); // base64 encoded "test content"
      // Verify the mock was called - we don't need to verify the exact command type
      expect(mockSend).toHaveBeenCalled();
      console.log('GET test completed successfully');
    });
  });
});

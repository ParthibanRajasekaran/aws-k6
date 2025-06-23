/**
 * Integration tests for Lambda with S3 using LocalStack
 * These tests actually connect to LocalStack to verify end-to-end functionality
 */

const { S3Client, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const http = require('http');

// LocalStack configuration
const LOCALSTACK_ENDPOINT = process.env.ENDPOINT || 'http://localhost:4566';
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.BUCKET || 'test-bucket';

describe('Lambda S3 Integration Tests', () => {
  let s3Client;
  let lambdaClient;
  
  beforeAll(async () => {
    console.log('🚀 Setting up integration tests with LocalStack');
    console.log(`LocalStack endpoint: ${LOCALSTACK_ENDPOINT}`);
    console.log(`Region: ${REGION}`);
    console.log(`Bucket: ${BUCKET_NAME}`);
    
    // Configure AWS clients for LocalStack with extended timeout
    const config = {
      region: REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      },
      maxAttempts: 5,
      retryMode: 'standard',
      requestHandler: {
        timeoutInMs: 15000
      }
    };
    
    console.log('Creating S3 and Lambda clients...');
    s3Client = new S3Client(config);
    lambdaClient = new LambdaClient(config);
    
    // Wait for LocalStack to be ready with extended timeout
    console.log('Waiting for LocalStack to be ready...');
    await waitForLocalStack();
    
    // Ensure S3 bucket exists
    console.log(`Ensuring S3 bucket '${BUCKET_NAME}' exists...`);
    try {
      const createBucketResponse = await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log('✅ S3 bucket created successfully:', createBucketResponse);
    } catch (error) {
      // Bucket might already exist, which is fine
      if (!error.message.includes('BucketAlreadyExists') && !error.message.includes('BucketAlreadyOwnedByYou')) {
        console.warn('⚠️ S3 bucket creation warning:', error.message);
        console.log('Attempting to list buckets to verify connectivity...');
        try {
          const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
          console.log('Current buckets:', listBucketsResponse.Buckets.map(b => b.Name));
        } catch (listError) {
          console.error('❌ Failed to list buckets:', listError.message);
        }
      } else {
        console.log('ℹ️ Bucket already exists, continuing...');
      }
    }
    
    console.log('✅ Integration test setup completed');
  }, 90000); // Extend beforeAll timeout to 90 seconds

  // Helper function to wait for LocalStack to be ready
  async function waitForLocalStack(maxRetries = 60, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Connecting to LocalStack at: ${LOCALSTACK_ENDPOINT}`);
        const response = await makeHttpRequest(`${LOCALSTACK_ENDPOINT}/_localstack/health`);
        const health = JSON.parse(response);
        console.log(`LocalStack health status: ${JSON.stringify(health)}`);
        
        if (health.services && health.services.s3 === 'available' && health.services.lambda === 'available') {
          console.log('✅ LocalStack is ready');
          return;
        } else {
          const s3Status = health.services?.s3 || 'unknown';
          const lambdaStatus = health.services?.lambda || 'unknown';
          console.log(`⚠️ LocalStack services not fully ready: S3=${s3Status}, Lambda=${lambdaStatus}`);
        }
      } catch (error) {
        console.log(`⚠️ LocalStack not ready yet: ${error.message}`);
      }
      
      console.log(`Waiting for LocalStack... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log('❌ LocalStack did not become available in time');
    throw new Error('LocalStack did not become available in time');
  }

  // Helper function to make HTTP requests with improved error handling
  function makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      console.log(`Making HTTP request to ${url}`);
      const request = http.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          console.log(`Received response from ${url}: status=${response.statusCode}`);
          if (response.statusCode >= 400) {
            reject(new Error(`HTTP error ${response.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
      });
      
      request.on('error', (error) => {
        console.log(`HTTP request error for ${url}: ${error.message}`);
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        console.log(`HTTP request timeout for ${url}`);
        request.destroy();
        reject(new Error(`Request timeout for ${url}`));
      });
    });
  }

  // Helper function to invoke Lambda via API Gateway simulation
  async function invokeLambdaViaApi(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  describe('S3 Upload Functionality', () => {
    test('should upload file to S3 via Lambda', async () => {
      const testData = {
        filename: `integration-test-${Date.now()}.txt`,
        content: Buffer.from('Integration test content').toString('base64')
      };

      const response = await invokeLambdaViaApi('POST', '/upload', JSON.stringify(testData));
      
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('File uploaded');
      expect(responseBody.filename).toBe(testData.filename);
    });

    test('should handle large file uploads', async () => {
      const largeContent = 'A'.repeat(10000); // 10KB file
      const testData = {
        filename: `large-file-${Date.now()}.txt`,
        content: Buffer.from(largeContent).toString('base64')
      };

      const response = await invokeLambdaViaApi('POST', '/upload', JSON.stringify(testData));
      
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('File uploaded');
      expect(responseBody.filename).toBe(testData.filename);
    });

    test('should reject upload with missing filename', async () => {
      const testData = {
        content: Buffer.from('Test content').toString('base64')
        // Missing filename
      };

      const response = await invokeLambdaViaApi('POST', '/upload', JSON.stringify(testData));
      
      expect(response.statusCode).toBe(400);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('Missing filename or content');
    });
  });

  describe('S3 Download Functionality', () => {
    let uploadedFilename;

    beforeEach(async () => {
      // Upload a test file first
      const testData = {
        filename: `download-test-${Date.now()}.txt`,
        content: Buffer.from('Download test content').toString('base64')
      };

      const uploadResponse = await invokeLambdaViaApi('POST', '/upload', JSON.stringify(testData));
      expect(uploadResponse.statusCode).toBe(200);
      
      uploadedFilename = testData.filename;
    });

    test('should download file from S3 via Lambda', async () => {
      const response = await invokeLambdaViaApi('GET', `/download?filename=${uploadedFilename}`);
      
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.filename).toBe(uploadedFilename);
      expect(responseBody.content).toBeTruthy();
      
      // Verify content can be decoded
      const decodedContent = Buffer.from(responseBody.content, 'base64').toString();
      expect(decodedContent).toBe('Download test content');
    });

    test('should return 400 for download without filename', async () => {
      const response = await invokeLambdaViaApi('GET', '/download');
      
      expect(response.statusCode).toBe(400);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('Missing filename parameter');
    });

    test('should return 404 for non-existent file', async () => {
      const response = await invokeLambdaViaApi('GET', '/download?filename=non-existent-file.txt');
      
      expect(response.statusCode).toBe(404);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.code).toBe('NoSuchKey');
    });
  });

  describe('Caching Functionality', () => {
    test('should cache files for subsequent downloads', async () => {
      // Upload a test file
      const testData = {
        filename: `cache-test-${Date.now()}.txt`,
        content: Buffer.from('Cache test content').toString('base64')
      };

      await invokeLambdaViaApi('POST', '/upload', JSON.stringify(testData));

      // First download
      const startTime1 = Date.now();
      const response1 = await invokeLambdaViaApi('GET', `/download?filename=${testData.filename}`);
      const duration1 = Date.now() - startTime1;
      
      expect(response1.statusCode).toBe(200);

      // Second download (should be faster due to caching)
      const startTime2 = Date.now();
      const response2 = await invokeLambdaViaApi('GET', `/download?filename=${testData.filename}`);
      const duration2 = Date.now() - startTime2;
      
      expect(response2.statusCode).toBe(200);
      
      // Both responses should have the same content
      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);
      expect(body1.content).toBe(body2.content);
      
      console.log(`First download: ${duration1}ms, Second download: ${duration2}ms`);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await invokeLambdaViaApi('POST', '/upload', 'invalid json');
      
      expect(response.statusCode).toBe(500);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toContain('Unexpected token');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await invokeLambdaViaApi('DELETE', '/upload');
      
      expect(response.statusCode).toBe(405);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('Method not allowed');
    });
  });
});

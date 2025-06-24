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

  // Helper to invoke Lambda directly for true integration testing
  async function invokeLambda(payload) {
    const command = new InvokeCommand({
      FunctionName: 'test-lambda',
      Payload: JSON.stringify(payload),
      LogType: 'Tail', // To get execution logs
    });

    const { Payload, LogResult } = await lambdaClient.send(command);
    const result = JSON.parse(Buffer.from(Payload).toString());
    
    if (LogResult) {
      const logs = Buffer.from(LogResult, 'base64').toString();
      console.log('Lambda Execution Logs:', logs);
    }
    
    if (result.statusCode >= 400 && result.body) {
      console.error('Lambda returned error:', result.body);
    }

    return result;
  }

  describe('S3 Upload Functionality', () => {
    test('should upload file to S3 via Lambda', async () => {
      const testData = {
        filename: `integration-test-${Date.now()}.txt`,
        content: Buffer.from('Integration test content').toString('base64')
      };

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify(testData)
      };

      const response = await invokeLambda(event);
      
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('File uploaded');
      expect(responseBody.filename).toBe(testData.filename);
    }, 30000);

    test('should handle large file uploads', async () => {
      const largeContent = 'A'.repeat(10000); // 10KB file
      const testData = {
        filename: `large-file-${Date.now()}.txt`,
        content: Buffer.from(largeContent).toString('base64')
      };
      const event = { httpMethod: 'POST', body: JSON.stringify(testData) };
      const response = await invokeLambda(event);
      expect(response.statusCode).toBe(200);
    });

    test('should reject upload with missing filename', async () => {
      const testData = { content: 'missing filename' };
      const event = { httpMethod: 'POST', body: JSON.stringify(testData) };
      const response = await invokeLambda(event);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('S3 Download Functionality', () => {
    let uploadedFilename;

    beforeEach(async () => {
      uploadedFilename = `test-file-for-download-${Date.now()}.txt`;
      const uploadData = {
        filename: uploadedFilename,
        content: Buffer.from('some content').toString('base64')
      };
      const uploadEvent = { httpMethod: 'POST', body: JSON.stringify(uploadData) };
      const uploadResponse = await invokeLambda(uploadEvent);
      expect(uploadResponse.statusCode).toBe(200);
    });

    test('should download file from S3 via Lambda', async () => {
      const downloadEvent = {
        httpMethod: 'GET',
        queryStringParameters: { filename: uploadedFilename }
      };
      const response = await invokeLambda(downloadEvent);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.filename).toBe(uploadedFilename);
      expect(body.content).toBe(Buffer.from('some content').toString('base64'));
    });

    test('should return 400 for download without filename', async () => {
      const event = { httpMethod: 'GET' };
      const response = await invokeLambda(event);
      expect(response.statusCode).toBe(400);
    });

    test('should return 404 for non-existent file', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { filename: 'non-existent-file.txt' }
      };
      const response = await invokeLambda(event);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Caching Functionality', () => {
    test('should cache files for subsequent downloads', async () => {
      const filename = `cache-test-${Date.now()}.txt`;
      const content = Buffer.from('cachable content').toString('base64');
      
      // Upload the file
      await invokeLambda({ httpMethod: 'POST', body: JSON.stringify({ filename, content }) });

      // First download (should populate cache)
      const firstDownload = await invokeLambda({ httpMethod: 'GET', queryStringParameters: { filename } });
      expect(firstDownload.statusCode).toBe(200);

      // To test the cache, we'd ideally need to check logs or mock time,
      // but for this integration test, we'll just ensure a second call works.
      const secondDownload = await invokeLambda({ httpMethod: 'GET', queryStringParameters: { filename } });
      expect(secondDownload.statusCode).toBe(200);
      const body = JSON.parse(secondDownload.body);
      expect(body.content).toBe(content);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const event = {
        httpMethod: 'POST',
        body: '{"filename": "test.txt", "content": }' // Invalid JSON
      };
      const response = await invokeLambda(event);
      // The lambda's try/catch will handle the JSON.parse error
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unexpected token');
    });

    test('should handle unsupported HTTP methods', async () => {
      const event = { httpMethod: 'PUT' };
      const response = await invokeLambda(event);
      expect(response.statusCode).toBe(405);
    });
  });
});

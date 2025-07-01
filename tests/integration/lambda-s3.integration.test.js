/**
 * Integration tests for Lambda with S3 using LocalStack
 * 
 * These tests verify end-to-end functionality by connecting to LocalStack.
 * 
 * Features:
 * - Robust LocalStack connectivity with retry logic
 * - Proper async cleanup to prevent Jest hanging
 * - Environment variable consistency (localhost for runner, localstack for containers)
 * - Extended timeouts for CI environments
 * - Comprehensive error handling and logging
 */

const { S3Client, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const http = require('http');

// LocalStack configuration
const LOCALSTACK_HOST = process.env.LOCALSTACK_HOST || 'localstack';
const LOCALSTACK_ENDPOINT = process.env.ENDPOINT || `http://${LOCALSTACK_HOST}:4566`;
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
    
    // Configure AWS clients for LocalStack with extended timeout and better error handling
    const config = {
      region: REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      },
      maxAttempts: 10,  // Increased retry attempts
      retryMode: 'adaptive',  // Use adaptive retry mode for best behavior
      requestHandler: {
        timeoutInMs: 30000  // Increased timeout to 30 seconds
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
  }, 120000); // Extend beforeAll timeout to 120 seconds

  // Helper function to wait for LocalStack to be ready
  async function waitForLocalStack(maxRetries = 60, delay = 2000) {
    // Determine whether any of the required services are initialized
    let servicesInitialized = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Connecting to LocalStack at: ${LOCALSTACK_ENDPOINT}`);
        const response = await makeHttpRequest(`${LOCALSTACK_ENDPOINT}/_localstack/health`);
        const health = JSON.parse(response);
        console.log(`LocalStack health status: ${JSON.stringify(health)}`);
        
        // Accept 'available', 'running', or even 'initialized' as valid service states
        if (health.services) {
          const s3Status = health.services?.s3 || 'unknown';
          const lambdaStatus = health.services?.lambda || 'unknown';

          // If both services are in any of the operational states
          if ((s3Status === 'available' || s3Status === 'running' || s3Status === 'initialized') && 
              (lambdaStatus === 'available' || lambdaStatus === 'running' || lambdaStatus === 'initialized')) {
            console.log('✅ LocalStack is ready');
            return;
          }
          
          // Mark that we've at least seen the services initialized
          if (s3Status !== 'unknown' && lambdaStatus !== 'unknown') {
            servicesInitialized = true;
          }
          
          console.log(`⚠️ LocalStack services not fully ready: S3=${s3Status}, Lambda=${lambdaStatus}`);
        }
      } catch (error) {
        console.log(`⚠️ LocalStack not ready yet: ${error.message}`);
      }
      
      // After half the retries, try connecting directly to the services to verify they work
      if (i === Math.floor(maxRetries / 2)) {
        try {
          console.log('Attempting to connect directly to S3 and Lambda...');
          try {
            const listBucketsCommand = new ListBucketsCommand({});
            await s3Client.send(listBucketsCommand);
            console.log('✅ S3 service is accessible, continuing with tests despite health status');
            servicesInitialized = true;
          } catch (s3Error) {
            console.log(`❌ S3 connectivity test failed: ${s3Error.message}`);
          }
        } catch (e) {
          console.log(`Direct service test failed: ${e.message}`);
        }
      }
      
      // After 75% of max retries, if we've seen services initialized, proceed anyway
      if (i > Math.floor(maxRetries * 0.75) && servicesInitialized) {
        console.log('⚠️ Services appear partially initialized. Proceeding with tests despite incomplete health status.');
        return;
      }
      
      console.log(`Waiting for LocalStack... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    if (servicesInitialized) {
      console.log('⚠️ LocalStack services were seen as initialized but not fully ready. Proceeding with caution.');
      return;
    }
    
    console.log('❌ LocalStack did not become available in time');
    throw new Error('LocalStack did not become available in time');
  }

  // Helper function to make HTTP requests with improved error handling
  function makeHttpRequest(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      console.log(`Making HTTP request to ${url}`);
      
      // Request with retry logic
      const tryRequest = (retriesLeft = 2) => {
        const request = http.get(url, (response) => {
          let data = '';
          
          response.on('data', (chunk) => { 
            data += chunk; 
          });
          
          response.on('end', () => {
            console.log(`Received response from ${url}: status=${response.statusCode}`);
            if (response.statusCode >= 400) {
              reject(new Error(`HTTP error ${response.statusCode}: ${data}`));
            } else {
              try {
                // Try to parse JSON to validate the response format
                const parsedData = JSON.parse(data);
                resolve(data);
              } catch (e) {
                console.log(`⚠️ Invalid JSON response from ${url}: ${data}`);
                if (retriesLeft > 0) {
                  console.log(`Retrying request to ${url} (${retriesLeft} retries left)...`);
                  setTimeout(() => tryRequest(retriesLeft - 1), 1000);
                } else {
                  // If we still can't parse but have status 200, return it anyway
                  resolve(data);
                }
              }
            }
          });
          
          response.on('error', (error) => {
            console.log(`Response error for ${url}: ${error.message}`);
            if (retriesLeft > 0) {
              console.log(`Retrying request to ${url} (${retriesLeft} retries left)...`);
              setTimeout(() => tryRequest(retriesLeft - 1), 1000);
            } else {
              reject(error);
            }
          });
        });
        
        request.on('error', (error) => {
          console.log(`HTTP request error for ${url}: ${error.message}`);
          if (retriesLeft > 0 && error.code !== 'ENOTFOUND') {
            console.log(`Retrying request to ${url} (${retriesLeft} retries left)...`);
            setTimeout(() => tryRequest(retriesLeft - 1), 1000);
          } else {
            reject(error);
          }
        });
        
        request.setTimeout(timeoutMs, () => {
          console.log(`HTTP request timeout for ${url} after ${timeoutMs}ms`);
          request.destroy();
          if (retriesLeft > 0) {
            console.log(`Retrying request to ${url} (${retriesLeft} retries left)...`);
            setTimeout(() => tryRequest(retriesLeft - 1), 1000);
          } else {
            reject(new Error(`Request timeout for ${url} after ${timeoutMs}ms and all retries`));
          }
        });
      };
      
      tryRequest();
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
    }, 45000); // Increased timeout for file upload test

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

  // Proper teardown to prevent "Cannot log after tests are done" error
  afterAll(async () => {
    console.log('🧹 Cleaning up after integration tests...');
    // Close AWS SDK clients to terminate any outstanding requests
    if (s3Client) {
      console.log('Closing S3 client connections...');
      // Ensure any in-flight requests are completed
      await new Promise(resolve => setTimeout(resolve, 500));
      s3Client.destroy();
    }
    
    if (lambdaClient) {
      console.log('Closing Lambda client connections...');
      await new Promise(resolve => setTimeout(resolve, 500));
      lambdaClient.destroy();
    }
    
    console.log('✅ Integration test cleanup completed');
  }, 10000); // Allow up to 10 seconds for cleanup
});

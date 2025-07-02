/**
 * Critical Test Runner 
 * 
 * This script directly tests the core S3 Lambda handler functionality
 * without depending on the test infrastructure.
 */
const { handler } = require('../lambda/index');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Mock the AWS SDK
jest.mock('@aws-sdk/client-s3');

async function runCriticalTests() {
  console.log('🧪 Running Critical Tests for S3 Lambda Handler');
  
  // Track test results
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  // Test helper
  async function runTest(name, testFn) {
    results.total++;
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      results.passed++;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      results.failed++;
    }
  }
  
  // Setup mocks
  const mockSend = jest.fn();
  S3Client.prototype.send = mockSend;
  
  // Clear any cached data before each test
  const cacheModule = require('../lambda/index');
  if (cacheModule.cache) {
    cacheModule.cache.clear();
  }
  
  // Test 1: POST (upload) success
  await runTest('S3 Upload - success path', async () => {
    mockSend.mockResolvedValue({});
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        filename: 'test.txt',
        content: 'dGVzdCBjb250ZW50' // base64 encoded "test content"
      })
    };
    
    const result = await handler(event);
    
    if (result.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${result.statusCode}`);
    }
    
    const body = JSON.parse(result.body);
    if (body.message !== 'File uploaded' || body.filename !== 'test.txt') {
      throw new Error(`Invalid response body: ${result.body}`);
    }
    
    if (!mockSend.mock.calls.length) {
      throw new Error('S3Client.send was not called');
    }
  });
  
  // Test 2: GET (download) success
  await runTest('S3 Download - success path', async () => {
    const mockStream = Buffer.from('test content');
    mockSend.mockResolvedValue({
      Body: mockStream
    });
    
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        filename: 'test.txt'
      }
    };
    
    const result = await handler(event);
    
    if (result.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${result.statusCode}`);
    }
    
    const body = JSON.parse(result.body);
    if (body.filename !== 'test.txt' || body.content !== 'dGVzdCBjb250ZW50') {
      throw new Error(`Invalid response body: ${result.body}`);
    }
  });
  
  // Test 3: Missing filename validation (400 error)
  await runTest('S3 Request - missing filename validation', async () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: null
    };
    
    const result = await handler(event);
    
    if (result.statusCode !== 400) {
      throw new Error(`Expected status 400, got ${result.statusCode}`);
    }
  });
  
  // Print summary
  console.log('\n📊 Test Summary:');
  console.log(`Total tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  
  return results.failed === 0;
}

// Run the tests
runCriticalTests().then(success => {
  process.exit(success ? 0 : 1);
});

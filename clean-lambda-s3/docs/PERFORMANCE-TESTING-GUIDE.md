# AWS Lambda S3 Performance Testing Guide

This guide provides comprehensive information on how to perform performance testing on the AWS Lambda + S3 integration using K6.

## Testing Architecture

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   K6 Tests    │──────►  API Gateway  │──────►    Lambda     │
└───────────────┘      │  Simulation   │      └───────┬───────┘
                       └───────────────┘              │
                                                      │
                                                      ▼
                                               ┌───────────────┐
                                               │  LocalStack   │
                                               │      S3       │
                                               └───────────────┘
```

## Test Scenarios

The project includes two main test scenarios:

### Upload (POST) Tests
Tests the file upload flow from API Gateway through Lambda to S3:
- Simulates realistic file sizes (1KB - 10KB)
- Gradually increases load from 5 to 50 virtual users
- Tests latency, throughput, and error rates

### Download (GET) Tests
Tests the file retrieval flow from S3 through Lambda to API Gateway:
- Retrieves previously uploaded files
- Tests with higher concurrency (up to 100 virtual users)
- Measures download speeds and cache effectiveness

## Running Tests

You can run tests either through the comprehensive script or individually:

### Comprehensive Test Run
```bash
./run-lambda-s3.sh
```

### Individual Test Components
Start API Gateway simulation:
```bash
npm run start
```

Run upload tests:
```bash
npm run test:post
```

Run download tests:
```bash
npm run test:get
```

## Test Configuration

Test parameters are configured in `config/k6-config.json`:

```json
{
  "stages": [
    { "duration": "30s", "target": 10 },
    { "duration": "1m", "target": 50 },
    { "duration": "2m", "target": 50 },
    { "duration": "30s", "target": 0 }
  ],
  "thresholds": {
    "upload_duration": ["p(95)<3000"],
    "download_duration": ["p(95)<2000"],
    "upload_failures": ["rate<0.01"],
    "download_failures": ["rate<0.01"],
    "http_req_duration": ["p(95)<2000"]
  }
}
```

### Key Parameters

- **stages**: Defines the load profile over time
  - **duration**: How long each stage lasts
  - **target**: Number of virtual users to simulate
- **thresholds**: Pass/fail criteria for the tests
  - **p(95)<3000**: 95% of requests should complete in under 3 seconds
  - **rate<0.01**: Error rate should be less than 1%

## Key Test Utilities

The test framework includes several utilities for better testing:

### Retry Logic
```javascript
const retryableRequest = (requestFn, options = {}) => {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1;
  
  let attempt = 0;
  let lastError;
  
  while (attempt < maxRetries) {
    try {
      const result = requestFn();
      if (result.status >= 200 && result.status < 300) {
        return result;
      }
      lastError = new Error(`HTTP error ${result.status}`);
    } catch (err) {
      lastError = err;
    }
    
    attempt++;
    if (attempt < maxRetries) {
      console.log(`Request failed, retrying (${attempt}/${maxRetries})...`);
      sleep(retryDelay);
    }
  }
  
  throw lastError;
};
```

### Performance Measurement
```javascript
const measureDuration = (fn, metricObj, operation) => {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  
  metricObj.add(duration);
  
  return result;
};
```

## Understanding Test Reports

After running the tests, reports are generated in the `reports/` directory:

- **Individual Test Reports**: In `reports/post/` and `reports/get/`
- **Consolidated Report**: In `reports/consolidated/`

### Key Metrics to Review

- **Response time**: p95 and p99 times (how fast the system responds)
- **Throughput**: Requests per second the system can handle
- **Error rate**: Percentage of failed requests
- **Resource utilization**: CPU, memory usage during tests

### Sample Test Report Analysis

```
=== Test Summary ===
✅ Upload Performance: PASSED
   - p95 response time: 1250ms (under 3000ms threshold)
   - Max throughput: 45 req/sec
   - Error rate: 0.2%

✅ Download Performance: PASSED
   - p95 response time: 980ms (under 2000ms threshold)
   - Max throughput: 92 req/sec
   - Error rate: 0.0%
```

## Performance Optimization Techniques

The system includes several optimizations:

1. **Connection Pooling**: The S3 client uses connection pooling to reduce connection setup overhead
   ```javascript
   const s3Client = new S3Client({
     maxConnections: 50
   });
   ```

2. **Caching**: Frequently accessed files are cached in memory
   ```javascript
   const cache = new LRU.LRUCache({
     max: 500,
     ttl: 1000 * 60 * 5
   });
   ```

3. **Retry Logic**: Both Lambda and tests include retry logic for transient errors
   ```javascript
   retryMode: 'standard',
   maxAttempts: 3
   ```

4. **Resource Optimization**: Lambda memory and timeout settings are optimized for the workload

## Troubleshooting

### Common Test Issues

1. **High Error Rates**
   - Check LocalStack health with `node ./scripts/verify-localstack.js`
   - Verify API Gateway simulation is running
   - Check Lambda deployment with `aws --endpoint-url=http://localhost:4566 lambda list-functions`

2. **Slow Response Times**
   - Check resource utilization in Docker with `docker stats`
   - Consider increasing Lambda memory allocation
   - Review cache hit ratio in logs

3. **Test Setup Failures**
   - Verify Docker is running with `docker ps`
   - Check logs in `api-gateway.log`
   - Confirm connectivity with `curl http://localhost:3000/health`

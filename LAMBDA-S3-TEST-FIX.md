# Lambda S3 Integration Test Fixes

This document outlines the fixes made to the Lambda + S3 integration tests to resolve issues with CI/CD pipeline failures.

## Issue Summary

The integration tests were failing in CI/CD with the following issues:

1. Tests were waiting for LocalStack services to be in "available" state, but they were reporting as "running"
2. "Cannot log after tests are done" errors due to async operations continuing after test completion
3. Timeout issues with HTTP requests to LocalStack health endpoint
4. AWS SDK configuration not optimized for test environment

## Fixes Implemented

### 1. LocalStack Service State Detection

- Modified `waitForLocalStack()` function to accept multiple valid service states:
  - "available"
  - "running"
  - "initialized"
- Added fallback mechanism to proceed after 75% of max retries if services are seen at least once
- Added direct connection test to verify service accessibility regardless of health check status

### 2. Async Cleanup

- Added proper `afterAll()` handler to clean up AWS SDK connections
- Added delays in teardown to ensure in-flight requests complete
- Explicitly called `destroy()` on AWS clients

### 3. HTTP Request Improvements

- Implemented retry logic in `makeHttpRequest()` function
- Added better error handling and connection timeout management
- Added JSON validation of responses with fallback

### 4. AWS SDK Configuration

- Increased `maxAttempts` from 5 to 10
- Changed retry mode from "standard" to "adaptive"
- Increased request timeout from 15s to 30s

### 5. Test Timeouts

- Increased `beforeAll` timeout from 90s to 120s
- Increased upload test timeout from 30s to 45s
- Added 10s timeout for proper cleanup in `afterAll`

## Debugging Tips

If tests still fail in CI/CD:

1. Check LocalStack health endpoint response:
   ```
   curl http://localhost:4566/_localstack/health
   ```

2. Verify services are running:
   ```
   aws --endpoint-url=http://localhost:4566 s3 ls
   aws --endpoint-url=http://localhost:4566 lambda list-functions
   ```

3. Look for "Cannot log after tests are done" errors, which indicate async leaks

4. Check for any errors in the Lambda execution logs

## Future Improvements

- Consider mocking S3 and Lambda for unit tests to reduce dependency on LocalStack
- Implement circuit breaker pattern for more resilient service interaction
- Add more diagnostic information during test execution

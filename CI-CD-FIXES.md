# CI/CD Pipeline Fixes

## Issues Fixed

### 1. Lambda to LocalStack Connection Issue
The primary issue was that Lambda functions running in containers couldn't connect to LocalStack.
Error: `connect ECONNREFUSED 127.0.0.1:4566`

**Solution:**
- Updated Lambda function to use `localstack` as hostname instead of `127.0.0.1` or `localhost`
- Modified Docker networking settings in GitHub Actions workflow
- Added proper environment variables to Lambda functions

### 2. Missing IAM Policy Files
Error: `Unable to load paramfile file://./iam/lambda-role-policy.json: [Errno 2] No such file or directory`

**Solution:**
- Created required IAM policy files:
  - `iam/lambda-role-policy.json` - For Lambda execution role
  - `iam/lambda-s3-policy.json` - For S3 access
  - `iam/dynamodb-write-policy.json` - For DynamoDB access

### 3. Integration Test Network Configuration
Updated integration tests to properly handle Docker networking and use the correct hostnames.

## Files Modified

1. `/lambda/index.js`
   - Updated S3Client to use `localstack` hostname

2. `/.github/workflows/best-practices-ci-cd.yml`
   - Updated LocalStack configuration with proper Docker networking
   - Added environment variables to Lambda functions
   - Fixed integration test commands to use correct endpoints

3. `/tests/integration/lambda-s3.integration.test.js`
   - Updated to use proper LocalStack hostname

4. Added new files:
   - `/iam/lambda-role-policy.json`
   - `/iam/lambda-s3-policy.json`
   - `/iam/dynamodb-write-policy.json`

## Testing the Fix

The CI/CD pipeline should now run successfully. If you encounter any issues:

1. Verify Docker networking is correctly configured
2. Check that environment variables are properly passed to Lambda
3. Ensure all IAM policies are in place
4. Validate that LocalStack services are running properly before tests begin

All Lambda functions now correctly connect to LocalStack services through Docker's internal network.

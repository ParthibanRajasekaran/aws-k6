# Lambda + S3 Integration

This document explains how to run and test the Lambda + S3 integration with LocalStack.

## Overview

This project provides a Lambda function that integrates with S3, allowing you to:
- Upload files to S3 via POST requests
- Download files from S3 via GET requests

The Lambda function includes optimizations:
- Connection pooling for the S3 client
- LRU caching for frequently accessed files
- Error handling and proper HTTP response formatting

## Setup 

### Prerequisites
- Node.js 18 or 20
- Docker and Docker Compose
- AWS CLI

### Environment Setup

1. **Start LocalStack:**
   ```bash
   docker-compose up -d
   ```

2. **Deploy Lambda + S3 infrastructure:**
   ```bash
   npm run deploy:lambda-s3
   ```

3. **Start API Gateway simulation:**
   ```bash
   npm start
   ```

## Testing

### Manual Testing

1. **Upload a file:**
   ```bash
   curl -X POST http://localhost:3000/upload \
     -H "Content-Type: application/json" \
     -d '{"filename":"example.txt", "content":"SGVsbG8gZnJvbSBMYW1iZGEgUzMh"}'
   ```

2. **Download a file:**
   ```bash
   curl http://localhost:3000/download?filename=example.txt
   ```

### Automated Testing

1. **Run K6 performance tests:**
   ```bash
   # Test POST endpoint
   npm run test:post
   
   # Test GET endpoint
   npm run test:get
   ```

2. **Run integration tests:**
   ```bash
   npm run test:integration
   ```

## Troubleshooting

### IAM Issues
If you encounter IAM policy errors, ensure that:
- The `lambda-role-policy.json` file exists in the `iam` directory
- The S3 access policy is correctly attached to the Lambda role

You can manually recreate these with:
```bash
# Create IAM role with trust policy
aws --endpoint-url=http://localhost:4566 iam create-role \
  --role-name lambda-role \
  --assume-role-policy-document file://./iam/lambda-role-policy.json

# Create and attach S3 policy
aws --endpoint-url=http://localhost:4566 iam create-policy \
  --policy-name s3-access-policy \
  --policy-document file://./iam/lambda-s3-policy.json

aws --endpoint-url=http://localhost:4566 iam attach-role-policy \
  --role-name lambda-role \
  --policy-arn arn:aws:iam::000000000000:policy/s3-access-policy
```

### LocalStack Connectivity
If LocalStack services aren't available:
```bash
# Check LocalStack health
curl http://localhost:4566/_localstack/health | jq

# Wait for services to be ready
npm run wait:localstack
```

### Lambda Deployment Issues
If Lambda fails to deploy:
```bash
# Verify Lambda package contents
unzip -l function.zip | grep -E 'lru-cache|@aws-sdk'

# Manually deploy Lambda
aws --endpoint-url=http://localhost:4566 lambda create-function \
  --function-name test-lambda \
  --runtime nodejs20.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://function.zip
```

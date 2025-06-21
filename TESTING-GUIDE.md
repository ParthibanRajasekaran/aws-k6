# AWS K6 LocalStack Performance Testing

This project provides a framework for testing AWS Lambda and Step Functions using K6 and LocalStack. It includes simulation of S3 integration and provides comprehensive performance reports.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Verify system requirements:**
   - Node.js 16+
   - Docker and Docker Compose
   - K6 (for load testing)

## Running Tests

### Quick Start

To get started quickly, use our fix and setup script:

```bash
npm run fix
```

This will:
- Check and create necessary configuration files
- Ensure LocalStack is running correctly
- Create required S3 buckets
- Verify API Gateway simulation
- Test basic functionality
- Fix common issues

### Step-by-Step Approach

#### Lambda with S3 Tests

1. **Start LocalStack:**
   ```bash
   docker-compose -f docker-compose.lambda-s3.yml up -d
   ```

2. **Deploy S3 bucket:**
   ```bash
   npm run deploy:localstack
   ```

3. **Start API Gateway simulation:**
   ```bash
   npm start
   ```

4. **Run tests:**
   - Upload test: `npm run test:post`
   - Download test: `npm run test:get`
   - All tests: `npm run test:all`

#### Step Functions Tests

1. **Start LocalStack with Step Functions:**
   ```bash
   docker-compose -f docker-compose.step-fns.yml up -d
   ```

2. **Deploy Lambda functions and Step Functions workflow:**
   ```bash
   npm run deploy:workflow
   ```

3. **Run Step Functions test:**
   ```bash
   npm run test:stepfn
   ```

### Generating Reports

Generate individual test reports:
```bash
npm run report
```

Generate a consolidated report for all tests:
```bash
npm run report:consolidated
```

## Troubleshooting

If you encounter issues, try the following:

1. **Verify LocalStack connectivity:**
   ```bash
   npm run verify:localstack
   ```

2. **Run API Gateway with debug logging:**
   ```bash
   npm run debug
   ```

3. **Reset environment:**
   ```bash
   npm run reset
   ```

4. **Fix common issues automatically:**
   ```bash
   npm run fix
   ```

## Report Locations

- Lambda+S3 Reports: `reports/lambda-s3/`
- Step Functions Reports: `reports/step-functions/`
- Consolidated Report: `reports/consolidated/index.html`

## Testing Structure

- **Lambda+S3 Tests:**
  - `k6/post-test.js`: Tests uploading files to S3 via Lambda
  - `k6/get-test.js`: Tests downloading files from S3 via Lambda

- **Step Functions Tests:**
  - `k6/stepfn-test.js`: Tests execution of the Step Function workflow
  - **Unit Tests:**
    - `tests/unit/lambda1/`: Unit tests for the validation Lambda
    - `tests/unit/lambda2/`: Unit tests for the processing Lambda
    - `tests/unit/lambda3/`: Unit tests for the database Lambda
    - `tests/unit/workflow/`: Local integration tests for the workflow

## Unit Testing

This project includes comprehensive unit tests following AWS best practices:

1. **Individual Lambda Tests:**
   ```bash
   npm run test:unit:lambda1
   npm run test:unit:lambda2
   npm run test:unit:lambda3
   ```

2. **Local Workflow Integration Test:**
   ```bash
   npm test tests/unit/workflow
   ```

3. **Complete Unit Test Suite with Coverage:**
   ```bash
   npm run test:unit:coverage
   ```

Unit test reports are generated in `reports/coverage/`.

### Unit Testing Best Practices

- **Lambda Function Testing**: Each Lambda function is tested in isolation with mocked dependencies
- **AWS Service Mocking**: AWS SDK calls are mocked to prevent actual service calls during testing
- **Integration Testing**: The complete workflow is tested locally without AWS service dependencies
- **Code Coverage**: Tests aim for high code coverage to ensure quality and reliability

## Automated Test Pipeline

To run a complete test suite with all components:

```bash
./run-complete-tests.sh
```

For specific test scenarios:
```bash
./run-complete-tests.sh --lambda-s3-only
./run-complete-tests.sh --step-functions-only
./run-complete-tests.sh --unit-tests-only
```

### AWS Best Practice Testing Approach

We provide a dedicated script that demonstrates the AWS best practice approach to testing Lambda and Step Functions:

```bash
./run-best-practice-tests.sh
```

This script follows the AWS recommended testing strategy:
1. Unit tests for individual Lambda functions (isolated, with mocked dependencies)
2. Local integration tests for the Step Function workflow (with mocked AWS services)
3. Integration tests using K6 and LocalStack (full end-to-end testing)

This approach provides:
- Fast feedback cycles during development (unit tests)
- Comprehensive test coverage (all Lambda functions tested individually)
- Integration validation (workflow tested as a whole)
- Performance insights (through K6 metrics)

### When to Use Each Test Type

- **Unit Tests**: Use during development for fast feedback on Lambda function behavior
- **Local Integration Tests**: Use to validate workflow logic without deploying
- **K6 Integration Tests**: Use to validate end-to-end performance with LocalStack

This multi-layered approach ensures comprehensive test coverage without overtesting.

## Configuration

You can configure the testing environment by:

1. Creating a `.env` file in the project root
2. Adjusting performance thresholds in `config/performance-thresholds.json`
3. Modifying test parameters in `config/k6-config.json`

## License

MIT

# AWS Lambda Performance Testing Suite

A comprehensive performance testing suite for AWS Lambda and S3 operations, using k6 and LocalStack for local development and testing.

## Overview

- REST API endpoints for file upload and download operations
- Scalable Express.js API Gateway simulation
- LocalStack integration for AWS services simulation
- Detailed performance metrics and reporting
- Configurable test scenarios and thresholds

## Prerequisites

- Node.js 16+
- Docker and Docker Compose
- k6 (for performance testing)
- jq (optional, for JSON processing)

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd aws-k6
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Running Tests

### Quick Start
```bash
# Run complete test suite (recommended)
./run-complete-tests.sh

# Or step by step:
npm run test:verify        # Verify setup
npm run validate          # Pre-test validation
npm test                  # Run complete suite
```

### Individual Test Scenarios
```bash
# Lambda + S3 tests only
./run-complete-tests.sh --lambda-s3-only

# Step Functions tests only  
./run-complete-tests.sh --step-functions-only

# Individual test types
npm run test:post         # POST upload tests
npm run test:get          # GET download tests
npm run test:stepfn       # Step Functions tests
```

### Setup Verification
```bash
# Verify all components
./verify-setup.sh

# Test individual components
./verify-setup.sh --localstack    # Test LocalStack
./verify-setup.sh --lambda        # Test Lambda deployment
./verify-setup.sh --api           # Test API Gateway
./verify-setup.sh --k6             # Test k6 scripts
./verify-setup.sh --reports       # Test report generation
```

### Advanced Usage
```bash
# Skip cleanup (for debugging)
./run-complete-tests.sh --no-cleanup

# Real-time test monitoring
npm run analyze watch reports/

# Generate reports manually
npm run report                    # Individual reports
npm run report:consolidated       # Consolidated report
```

## Test Execution Workflow

The complete test suite performs the following automated steps:

1. **Pre-Test Validation** - Validates environment, tools, and configuration
2. **Infrastructure Setup** - Starts LocalStack, deploys Lambda functions, creates S3 bucket and DynamoDB table
3. **API Gateway Simulation** - Starts Express.js server for Lambda+S3 tests
4. **Real-Time Monitoring** - Launches test analyzer for live insights
5. **Lambda+S3 Performance Tests** - Runs POST (upload) and GET (download) scenarios
6. **Step Functions Performance Tests** - Runs 3-Lambda workflow with DynamoDB integration
7. **Results Analysis** - Generates performance insights and grades
8. **Consolidated Reporting** - Creates comprehensive HTML reports with cross-scenario comparisons
9. **Cleanup** - Stops services and cleans up resources

### What We Do Beyond Setup/Teardown

**During Test Execution:**
- **Real-time performance monitoring** with live metrics and alerts
- **Automated health checks** ensuring all services remain responsive
- **Dynamic threshold analysis** providing immediate feedback on performance degradation
- **Cross-scenario comparison** identifying performance patterns between simple Lambda and Step Functions
- **Resource utilization tracking** monitoring data transfer and response times

**For Enhanced Test Insights:**
- **Performance grading system** (A-F grades based on configurable thresholds)
- **Bottleneck identification** highlighting slow components in the workflow
- **Error pattern analysis** detecting and categorizing failure modes
- **Trend analysis** comparing performance across different test runs
- **Capacity planning insights** suggesting optimal configurations

**Automated Decision Making:**
- **Adaptive retry logic** for transient failures
- **Service readiness verification** before proceeding with tests
- **Result validation** ensuring test data integrity
- **Performance regression detection** comparing against baseline metrics
   ```bash
   npm start
   ```

4. Run performance tests:
   ```bash
   ./scripts/run-k6-tests.sh k6/post-test.js
   ./scripts/run-k6-tests.sh k6/get-test.js
   ```

## Test Configuration

Performance test configurations are stored in `config/k6-config.json`. Modify the stages and thresholds according to your requirements.

## Reports

Test reports are generated in the `reports/` directory:
- JSON results: `reports/k6-results.json`
- HTML dashboard: `reports/dashboard/`
- Endpoint specific reports in `reports/get/` and `reports/post/`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
# Force workflow trigger - Sun Jun 22 11:32:05 BST 2025

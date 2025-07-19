# AWS Lambda S3 Performance Testing Suite

Enterprise-grade performance testing suite for AWS Lambda functions with S3 integration, using LocalStack for local development and K6 for load testing.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   K6 Load       │    │   API Gateway   │    │   LocalStack    │
│   Testing       │───▶│   Simulation    │───▶│   (Lambda + S3) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Features

- **Lambda S3 Integration**: Complete Lambda function with S3 upload/download capabilities
- **Performance Testing**: K6-based load testing for both upload and download operations
- **LocalStack Integration**: Full local AWS service simulation
- **Enterprise Standards**: Clean, modular, and well-documented codebase
- **Containerized**: Docker-based deployment for consistent environments
- **Comprehensive Reporting**: Detailed performance metrics and analysis

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- K6 (for standalone testing)

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd aws-lambda-s3-performance-testing
npm install
```

### 2. Run Complete Test Suite

```bash
# Run all tests with infrastructure setup
./run-lambda-s3-clean.sh
```

### 3. Individual Test Commands

```bash
# Setup infrastructure
npm run setup

# Run upload tests
npm run test:post

# Run download tests
npm run test:get

# Run both tests
npm run test:both

# Teardown infrastructure
npm run teardown
```

## 📁 Project Structure

```
aws-lambda-s3-performance-testing/
├── lambda/
│   ├── index.js              # Lambda function handler
│   └── package.json          # Lambda dependencies
├── k6/
│   ├── post-test.js          # Upload performance tests
│   ├── get-test.js           # Download performance tests
│   └── utils.js              # Shared testing utilities
├── config/
│   ├── k6-config.json        # K6 configuration
│   └── performance-thresholds.json
├── reports/                  # Generated test reports
├── api-gateway-sim.js        # API Gateway simulation
├── docker-compose.clean.yml  # Clean Docker Compose setup
├── Dockerfile.clean          # Clean API container
├── run-lambda-s3-clean.sh    # Main test runner
└── package.json              # Project dependencies
```

## 🧪 Testing

### Performance Tests

The suite includes comprehensive performance tests for:

- **Upload Operations**: File upload to S3 via Lambda
- **Download Operations**: File download from S3 via Lambda
- **Concurrent Users**: Simulated load with multiple virtual users
- **Response Times**: P95, P99, and average response time metrics
- **Error Rates**: Success/failure rates and error analysis

### Test Scenarios

1. **Upload Test (`k6/post-test.js`)**
   - Uploads files of various sizes to S3
   - Tests concurrent upload operations
   - Measures upload response times and success rates

2. **Download Test (`k6/get-test.js`)**
   - Downloads files from S3
   - Tests concurrent download operations
   - Measures download response times and success rates

## 📊 Performance Metrics

Key metrics collected:

- **Response Time**: P50, P95, P99 percentiles
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Data Transfer**: Upload/download speeds
- **Resource Utilization**: Memory and CPU usage

## 🔧 Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
BUCKET=lambda-s3-test-bucket
AWS_ENDPOINT_URL=http://localhost:4566

# API Configuration
API_PORT=3000
LOCALSTACK_HOST=localhost
```

### Performance Thresholds

Configure performance thresholds in `config/performance-thresholds.json`:

```json
{
  "http_req_duration": ["p(95)<3000"],
  "http_req_failed": ["rate<0.01"],
  "upload_duration": ["p(95)<5000"],
  "download_duration": ["p(95)<2000"]
}
```

## 📈 Reporting

Test reports are generated in the `reports/` directory:

- **JSON Reports**: Detailed K6 metrics in JSON format
- **Summary Reports**: Human-readable test summaries
- **Performance Trends**: Historical performance data
- **Coverage Reports**: Code coverage for Lambda functions

## 🔒 Security

- Non-root container execution
- Minimal container image with only necessary dependencies
- Secure LocalStack configuration
- Input validation and sanitization

## 🚀 CI/CD Integration

The suite is designed for easy CI/CD integration:

```yaml
# Example GitHub Actions workflow
- name: Run Lambda S3 Performance Tests
  run: |
    ./run-lambda-s3-clean.sh
    
- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: performance-reports
    path: reports/
```

## 📚 API Reference

### Lambda Function Endpoints

- `POST /upload` - Upload file to S3
- `GET /download/:filename` - Download file from S3
- `GET /health` - Health check endpoint

### K6 Test Configuration

Tests can be configured via environment variables:

```bash
export K6_VUS=50              # Virtual users
export K6_DURATION=5m         # Test duration
export K6_RATE=100            # Requests per second
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Adding New Tests

1. Create test file in `k6/` directory
2. Import utilities from `k6/utils.js`
3. Add test script to package.json
4. Update main test runner

## 📋 Troubleshooting

### Common Issues

1. **LocalStack not starting**: Check Docker daemon and available ports
2. **Tests failing**: Verify LocalStack health and API connectivity
3. **Performance degradation**: Check system resources and Docker limits

### Debug Commands

```bash
# Check service health
npm run health

# View LocalStack logs
docker logs aws-lambda-s3-performance-testing_localstack_1

# View API Gateway logs
docker logs aws-lambda-s3-performance-testing_api-gateway_1
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the full test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the existing documentation

---

**Enterprise-grade AWS Lambda S3 Performance Testing Suite** - Built with ❤️ for scalable performance testing

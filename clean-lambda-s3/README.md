# AWS Lambda S3 Performance Testing Suite

A comprehensive, enterprise-grade testing suite for AWS Lambda functions with S3 integration.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start LocalStack
docker compose -f docker-compose.lambda-s3.yml up -d

# Deploy Lambda function
npm run deploy

# Run all tests
npm test

# Run performance tests
npm run test:both
```

## 📋 Features

- **AWS Lambda S3 Integration**: Upload and download files with S3
- **Performance Testing**: K6 load testing with configurable scenarios
- **Unit & Integration Tests**: Comprehensive Jest test suite
- **LocalStack Support**: Local AWS service simulation
- **Docker Compose**: Easy development environment setup
- **Performance Monitoring**: Built-in metrics and thresholds
- **Clean Architecture**: Modular, enterprise-ready code structure

## 🧪 Testing

- **Unit Tests**: `npm run test:unit`
- **Performance Tests**: `npm run test:both`
- **Coverage Report**: `npm run test:coverage`
- **Comprehensive Test Suite**: `./scripts/run-lambda-s3-tests.sh`

## 📊 Performance Benchmarks

- **Upload Performance**: 100+ requests/second
- **Download Performance**: 150+ requests/second
- **Average Response Time**: <200ms
- **Success Rate**: >95%

## 🏗️ Architecture

```
clean-lambda-s3/
├── lambda/                 # Lambda function code
├── tests/                  # Test suites
├── k6/                     # Performance tests
├── config/                 # Configuration files
├── scripts/                # Deployment scripts
├── docs/                   # Documentation
├── iam/                    # IAM policies
└── reports/                # Test reports
```

## 📚 Documentation

- [Lambda S3 Guide](docs/LAMBDA-S3-GUIDE.md)
- [Performance Testing Guide](docs/PERFORMANCE-TESTING-GUIDE.md)

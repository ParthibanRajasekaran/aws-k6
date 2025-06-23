# AWS Lambda S3 Integration with K6 Testing

[![CI Pipeline](https://github.com/username/aws-k6/actions/workflows/ci.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/ci.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-92.59%25-brightgreen)](./reports/coverage/index.html)
[![Performance Tests](https://img.shields.io/badge/performance-passing-brightgreen)](./reports/)
[![Code Quality](https://img.shields.io/badge/quality-A-brightgreen)](./eslint.config.js)

## 🚀 CI/CD Pipeline Overview

This project features a comprehensive CI/CD pipeline with multiple workflows designed for different scenarios:

### 🔄 Available Workflows

| Workflow | Purpose | Trigger | Duration | Status |
|----------|---------|---------|----------|--------|
| **CI Pipeline** | Fast feedback for all commits | Push/PR | ~10-15 min | [![CI](https://github.com/username/aws-k6/actions/workflows/ci.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/ci.yml) |
| **Comprehensive CI/CD** | Full testing suite with security | Push to main | ~45-60 min | [![Comprehensive](https://github.com/username/aws-k6/actions/workflows/comprehensive-ci-cd.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/comprehensive-ci-cd.yml) |
| **Test Pipeline** | Matrix testing & benchmarks | Daily/Manual | ~30-45 min | [![Tests](https://github.com/username/aws-k6/actions/workflows/test-ci-cd-pipeline.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/test-ci-cd-pipeline.yml) |
| **Production Deploy** | Production deployments | Release/Manual | ~20-30 min | [![Deploy](https://github.com/username/aws-k6/actions/workflows/production-ready-ci-cd.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/production-ready-ci-cd.yml) |
| **Smoke Tests** | Quick validation | Push to main | ~5 min | [![Smoke](https://github.com/username/aws-k6/actions/workflows/smoke.yml/badge.svg)](https://github.com/username/aws-k6/actions/workflows/smoke.yml) |

### 📊 Test Coverage Summary

```
Statements   : 92.59% (50/54)
Branches     : 78.12% (25/32)
Functions    : 100% (6/6)
Lines        : 92.45% (49/53)
```

**Test Categories:**
- ✅ **Unit Tests**: 29 tests across all Lambda functions
- ✅ **Integration Tests**: 9 tests with LocalStack
- ✅ **Performance Tests**: K6 load testing for all endpoints
- ✅ **Security Tests**: Vulnerability scanning and code analysis
- ✅ **E2E Tests**: Complete workflow validation

### 🏗️ Pipeline Features

#### ✨ **Core Features:**
- **Parallel Execution** - Jobs run concurrently for faster feedback
- **LocalStack Integration** - Real AWS service simulation
- **Multi-Environment Support** - Staging and production deployments
- **Performance Testing** - K6 integration with configurable thresholds
- **Security Scanning** - Automated vulnerability detection
- **Matrix Testing** - Multiple Node.js versions (16, 18, 20)
- **Artifact Management** - Test reports, coverage, and build packages
- **Notification System** - Success/failure alerts

#### 🛡️ **Security & Quality:**
- **Dependency Scanning** - npm audit with severity levels
- **Code Quality** - ESLint with comprehensive rules  
- **SARIF Integration** - GitHub Security tab integration
- **Secret Management** - Secure AWS credential handling
- **CodeQL Analysis** - Advanced code security scanning

#### 🚀 **Deployment Strategy:**
```
Feature Branch → Main Branch → Staging → Production
     ↓              ↓           ↓          ↓
  Unit Tests    Integration   Smoke    Full Test
                  Tests      Tests     Suite
```

### 📈 **Performance Metrics**

Recent K6 performance test results:
- **Upload Endpoint**: ✅ All thresholds met
- **Download Endpoint**: ✅ All thresholds met  
- **Step Functions**: ✅ Workflow execution within limits
- **Error Rate**: 0% across all test scenarios

### 🔧 **Quick Start**

#### Local Development:
```bash
# Setup
npm install
npm run setup

# Run tests
npm run test:unit          # Unit tests only
npm run test:unit:coverage # With coverage
npm run test:all          # All performance tests
npm run test:robust       # Complete test suite

# Development
npm start                 # Start API gateway simulation
npm run deploy:localstack # Deploy to LocalStack
```

#### CI/CD Usage:
- **Automatic**: Triggered on push to main/develop
- **Manual**: Use "Run workflow" in GitHub Actions
- **Scheduled**: Daily comprehensive testing at 2 AM UTC
- **Release**: Automatic production deployment on release creation

### 📋 **Pipeline Jobs Breakdown**

#### 1. **Fast Feedback Loop** (runs on every commit)
- Code quality checks (linting, audit)
- Unit tests with coverage
- Basic integration validation
- Build artifact creation

#### 2. **Comprehensive Testing** (runs on main branch)
- Extended integration tests with LocalStack
- Performance benchmarking with K6
- Security vulnerability scanning
- End-to-end workflow validation
- Consolidated reporting

#### 3. **Production Pipeline** (manual/release triggered)
- Pre-deployment validation
- AWS Lambda function updates
- Step Functions state machine updates
- Smoke tests in target environment
- Automatic rollback on failure

### 📊 **Monitoring & Reports**

#### Available Reports:
- **Test Coverage**: `reports/coverage/index.html`
- **Performance Results**: `reports/consolidated/`
- **Security Scan**: GitHub Security tab
- **Build Artifacts**: Available for 30 days
- **Test Results**: Downloadable from Actions

#### Key Metrics Tracked:
- Test coverage percentage and trends
- Performance benchmarks over time
- Build success/failure rates
- Deployment frequency and reliability
- Security vulnerability count

### 🔍 **Troubleshooting**

#### Common Issues:
1. **LocalStack Timeout**: Integration tests failing due to service startup
   - **Solution**: Increase timeout in workflow or check health endpoint

2. **Performance Test Failures**: K6 thresholds not met
   - **Solution**: Review performance thresholds in `config/performance-thresholds.json`

3. **Coverage Below Threshold**: Unit test coverage dropped
   - **Solution**: Add tests for uncovered lines (currently lines 34-38 in main lambda)

#### Debug Commands:
```bash
npm run debug              # Debug mode for API gateway
npm run verify:localstack  # Check LocalStack health
npm run fix               # Run automated issue fixes
npm run analyze:enhanced  # Enhanced test analysis
```

### 🎯 **Next Steps & Improvements**

#### Immediate (High Priority):
- [ ] Fix LocalStack timing issues in integration tests
- [ ] Improve branch coverage to 85%+
- [ ] Add contract testing with Pact
- [ ] Implement canary deployments

#### Medium-term:
- [ ] Add chaos engineering tests
- [ ] Multi-region deployment support
- [ ] Advanced performance regression detection
- [ ] Enhanced monitoring and alerting

#### Long-term:
- [ ] Self-healing pipeline capabilities
- [ ] ML-based test optimization
- [ ] Advanced analytics and predictions
- [ ] Cross-platform testing (Windows, macOS)

---

For detailed documentation, see [TEST-COVERAGE-ANALYSIS.md](./TEST-COVERAGE-ANALYSIS.md)

**Pipeline Status**: 🟢 All systems operational
**Last Updated**: $(date)
**Next Scheduled Run**: Daily at 2:00 AM UTC

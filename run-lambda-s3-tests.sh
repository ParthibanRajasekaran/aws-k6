#!/usr/bin/env bash

# AWS Lambda S3 Test Runner
# This script runs all Lambda S3 related tests

set -e

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Print formatted message
print_message() {
  echo -e "${GREEN}==>${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ️${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

# Function to run a test and capture results
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  print_info "Running $test_name..."
  
  if eval "$test_command"; then
    print_success "$test_name passed"
    return 0
  else
    print_error "$test_name failed"
    return 1
  fi
}

# Main test runner
main() {
  print_message "🧪 Running AWS Lambda S3 Test Suite"
  print_info "Testing all Lambda S3 functionality..."
  
  local total_tests=0
  local passed_tests=0
  local failed_tests=0
  
  # Test 1: Unit Tests (Lambda Handler)
  total_tests=$((total_tests + 1))
  if run_test "Lambda S3 Unit Tests" "npx jest tests/unit/lambda/index.test.js"; then
    passed_tests=$((passed_tests + 1))
  else
    failed_tests=$((failed_tests + 1))
  fi
  
  # Test 2: Critical Tests Script
  total_tests=$((total_tests + 1))
  if run_test "Critical Tests Script" "./run-critical-tests.sh"; then
    passed_tests=$((passed_tests + 1))
  else
    failed_tests=$((failed_tests + 1))
  fi
  
  # Test 3: Lambda Package Verification
  total_tests=$((total_tests + 1))
  if run_test "Lambda Package Creation" "node scripts/package-lambda.js"; then
    passed_tests=$((passed_tests + 1))
  else
    failed_tests=$((failed_tests + 1))
  fi
  
  # Test 4: Package Verification
  total_tests=$((total_tests + 1))
  if run_test "Package Verification" "node scripts/verify-lambda.js"; then
    passed_tests=$((passed_tests + 1))
  else
    failed_tests=$((failed_tests + 1))
  fi
  
  # Test 5: K6 Configuration Check
  total_tests=$((total_tests + 1))
  if run_test "K6 Configuration Check" "[ -f k6/get-test.js ] && [ -f k6/post-test.js ]"; then
    passed_tests=$((passed_tests + 1))
  else
    failed_tests=$((failed_tests + 1))
  fi
  
  # Print summary
  echo ""
  print_message "📊 Test Results Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "Total Tests:   ${BLUE}$total_tests${NC}"
  echo -e "Passed:        ${GREEN}$passed_tests${NC}"
  echo -e "Failed:        ${RED}$failed_tests${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ $failed_tests -eq 0 ]; then
    print_success "All Lambda S3 tests passed!"
    echo ""
    print_message "🚀 Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Start LocalStack: docker-compose up -d"
    echo "2. Deploy Lambda: npm run deploy:lambda-s3"
    echo "3. Start API Gateway: npm start"
    echo "4. Run K6 tests: npm run test:post && npm run test:get"
    echo ""
    return 0
  else
    print_error "Some tests failed. Please check the output above."
    return 1
  fi
}

# Run main function
main "$@"

#!/bin/bash

# Simple Lambda S3 Test Runner for Clean Repository
# This script runs focused tests for the clean Lambda S3 structure

set -e

echo "==> 🧪 Running Clean Lambda S3 Test Suite"
echo "ℹ️ Testing core Lambda S3 functionality..."

# Initialize test counters
total_tests=0
passed_tests=0
failed_tests=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo "ℹ️ Running $test_name..."
    total_tests=$((total_tests + 1))
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo "✅ $test_name passed"
        passed_tests=$((passed_tests + 1))
    else
        echo "❌ $test_name failed"
        failed_tests=$((failed_tests + 1))
    fi
}

# Test 1: Lambda Unit Tests
run_test "Lambda Unit Tests" "npx jest --testMatch='**/tests/unit/**/*.test.js' --silent"

# Test 2: Lambda Handler Validation
run_test "Lambda Handler Validation" "node -e 'const lambda = require(\"./lambda/index.js\"); console.log(\"Handler:\", typeof lambda.handler);'"

# Test 3: Package Dependencies Check
run_test "Package Dependencies Check" "npm ls aws-sdk @aws-sdk/client-s3 --depth=0"

# Test 4: K6 Configuration Check
run_test "K6 Configuration Check" "test -f config/k6-config.json && test -f k6/post-test.js && test -f k6/get-test.js"

# Test 5: Docker Compose Validation
run_test "Docker Compose Validation" "docker-compose -f docker-compose.lambda-s3.yml config --quiet"

# Display results
echo ""
echo "==> 📊 Test Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests:   $total_tests"
echo "Passed:        $passed_tests"
echo "Failed:        $failed_tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $failed_tests -eq 0 ]; then
    echo "🎉 All tests passed! Clean Lambda S3 structure is ready."
    exit 0
else
    echo "❌ Some tests failed. Please check the output above."
    exit 1
fi

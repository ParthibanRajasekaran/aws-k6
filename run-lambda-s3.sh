#!/usr/bin/env bash
# run.sh - Complete setup and test execution script for AWS Lambda with S3

# Exit on error
set -e

# Print each command
set -x

# Configuration
ENDPOINT="http://localhost:4566"
BUCKET_NAME="test-bucket"
LAMBDA_NAME="file-processor"
API_PORT=3000
DOCKER_STACK="aws-k6"

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Print formatted message
print_message() {
  echo -e "${GREEN}==>${NC} $1"
}

# Print error message and exit
print_error() {
  echo -e "${RED}ERROR:${NC} $1"
  exit 1
}

# Print warning message
print_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
}

# Check if Docker is running
check_docker() {
  print_message "Checking Docker status..."
  if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
  fi
  print_message "Docker is running"
}

# Start LocalStack and services
start_services() {
  print_message "Starting LocalStack services..."
  docker compose -f docker-compose.lambda-s3.yml up -d
  
  # Wait for LocalStack to be ready
  print_message "Waiting for LocalStack to be ready..."
  ./scripts/wait-for-services.sh --host=localhost --port=4566 --service=LocalStack --timeout=60
  
  # Check if LocalStack is healthy
  print_message "Checking LocalStack health..."
  node ./scripts/verify-localstack.js
}

# Deploy Lambda and create S3 bucket
deploy_resources() {
  print_message "Deploying resources to LocalStack..."
  node ./scripts/deploy-lambda-s3.js
}

# Start API Gateway simulation
start_api_gateway() {
  print_message "Starting API Gateway simulation..."
  npm run start &
  API_PID=$!
  
  # Wait for API Gateway to be ready
  print_message "Waiting for API Gateway to be ready..."
  ./scripts/wait-for-services.sh --host=localhost --port=3000 --service=APIGateway --timeout=30
}

# Run K6 tests
run_k6_tests() {
  print_message "Running K6 tests..."
  
  # First run POST (upload) tests
  print_message "Running upload tests..."
  npm run test:post
  
  # Then run GET (download) tests
  print_message "Running download tests..."
  npm run test:get
}

# Generate test reports
generate_reports() {
  print_message "Generating test reports..."
  npm run report:consolidated
  
  # Display summary
  if [ -f "./reports/consolidated/summary.txt" ]; then
    cat ./reports/consolidated/summary.txt
  else
    print_warning "Report summary not generated. Check for errors in test execution."
  fi
}

# Clean up resources
cleanup() {
  print_message "Cleaning up resources..."
  
  # Kill API Gateway process if running
  if [ ! -z "$API_PID" ]; then
    kill -9 $API_PID || true
  fi
  
  # Stop Docker containers
  docker compose -f docker-compose.lambda-s3.yml down
}

# Main execution
main() {
  print_message "Starting AWS Lambda with S3 performance test suite"
  
  check_docker
  start_services
  deploy_resources
  start_api_gateway
  run_k6_tests
  generate_reports
  
  print_message "Tests completed successfully!"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main

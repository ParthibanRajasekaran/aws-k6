#!/bin/bash

# This script demonstrates the AWS best practice testing approach
# for Lambda and Step Functions by running both unit tests and integration tests

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AWS Best Practice Testing for Lambda and Step Functions ===${NC}"
echo -e "${BLUE}This script demonstrates the recommended testing strategy:${NC}"
echo -e "1. Unit tests for individual Lambda functions"
echo -e "2. Local integration tests for the workflow"
echo -e "3. Integration tests using K6 and LocalStack"
echo

# Run unit tests first - they're fast and provide immediate feedback
echo -e "${BLUE}Running unit tests for individual Lambda functions...${NC}"
npm run test:unit
echo

# Start LocalStack and run integration tests
echo -e "${BLUE}Running integration tests with LocalStack...${NC}"
echo -e "This demonstrates full end-to-end testing of the Step Function workflow"
./run-complete-tests.sh --step-functions-only

echo -e "${GREEN}✓ Testing completed successfully!${NC}"
echo 
echo -e "Best practices for AWS Lambda and Step Functions testing:"
echo -e "1. Write focused unit tests for each Lambda function"
echo -e "2. Mock external dependencies in unit tests"
echo -e "3. Test the workflow integration locally"
echo -e "4. Run end-to-end tests with LocalStack for integration testing"
echo -e "5. Analyze performance metrics from both approaches"

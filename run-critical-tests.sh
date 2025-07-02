#!/usr/bin/env bash

# Run Critical S3 Lambda Tests
# This script provides a simple way to run only the critical S3 Lambda tests
# that verify the upload and download functionality.

# Ensure NODE_ENV is set to test
export NODE_ENV=test

echo "🧪 Running Critical S3 Lambda Tests"

# Run the focused Lambda tests
echo "🔍 Running unit tests for Lambda handler..."
npm run test:unit -- tests/unit/lambda/index.test.js

# Check the exit code
if [ $? -eq 0 ]; then
  echo -e "\n✅ Critical tests passed!"
  echo -e "\n📋 Test Summary:"
  echo "  • ✅ POST (upload) functionality verified"
  echo "  • ✅ GET (download) functionality verified"
  
  echo -e "\n🚀 Next Steps:"
  echo "  1. Deploy with: npm run deploy:localstack"
  echo "  2. Run the API Gateway simulation: npm run start"
  echo "  3. Test with curl or Postman"
  echo "  4. Run K6 load tests: npm run test:post && npm run test:get"
  exit 0
else
  echo -e "\n❌ Tests failed. Fix errors before proceeding."
  exit 1
fi

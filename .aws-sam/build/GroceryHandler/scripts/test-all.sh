#!/bin/bash
# Run all test types for local development
set -e

# 1. Unit tests
npm run test:unit

# 2. Direct Lambda invocation
npm run test:lambda:direct


# 3. Wait for API Gateway simulation to be up
echo "\nWaiting for API Gateway simulation (SAM/LocalStack) to be up at http://localhost:3000/grocery..."
./scripts/wait-for-url.sh http://localhost:3000/grocery 180

# 4. Karate acceptance (API Gateway)
npm run test:acceptance

# 5. K6 performance (API Gateway)
npm run test:performance:api

echo "\nAll test types completed."

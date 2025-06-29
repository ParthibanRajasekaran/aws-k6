#!/bin/bash

# Script to verify Lambda packaging and test configuration
# This script verifies the local fixes before committing to the CI/CD pipeline

set -e  # Exit on first error

echo "🔍 Testing Lambda packaging and integration test fixes..."

# Step 1: Test the Lambda packaging script
echo "📦 Testing Lambda packaging script..."
node scripts/package-lambda.js

if [ ! -f function.zip ]; then
  echo "❌ Lambda packaging failed! function.zip not found."
  exit 1
fi

# Verify the package has the required dependencies
echo "🔍 Verifying package contents..."
if ! unzip -l function.zip | grep -q "node_modules/lru-cache"; then
  echo "❌ Lambda package is missing lru-cache dependency!"
  exit 1
fi

if ! unzip -l function.zip | grep -q "node_modules/@aws-sdk"; then
  echo "❌ Lambda package is missing AWS SDK dependencies!"
  exit 1
fi

echo "✅ Lambda packaging test successful"

# Step 2: Test the Jest configuration with new testMatch pattern
echo "🧪 Testing Jest integration test configuration..."
npm run test:integration -- --listTests

echo "✅ Jest integration test configuration successful"

echo "✅ All local verification tests passed!"

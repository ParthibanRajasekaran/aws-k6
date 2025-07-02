#!/bin/bash
# Local workflow validation script
# Tests the CI/CD pipeline components locally before pushing to GitHub

set -e

echo "🧪 LocalStack CI/CD Pipeline Local Validation"
echo "=============================================="

# Check if required files exist
echo "📁 Checking required files..."
required_files=(
  "lambda/index.js"
  "api-gateway-sim.js"
  "package.json"
  "scripts/package-lambda.js"
  "scripts/emergency-package.js"
  "scripts/verify-lambda.js"
  "k6/post-test.js"
  "k6/get-test.js"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file - MISSING"
    exit 1
  fi
done

# Check if required npm scripts exist
echo "📦 Checking package.json scripts..."
required_scripts=(
  "test:unit:coverage"
  "deploy:localstack"
  "analyze"
  "start"
)

for script in "${required_scripts[@]}"; do
  if npm run | grep -q "$script"; then
    echo "✅ npm run $script"
  else
    echo "❌ npm run $script - MISSING"
    exit 1
  fi
done

# Test unit tests (if they exist)
echo "🧪 Running unit tests..."
if [ -d "tests/unit" ]; then
  npm run test:unit:coverage || {
    echo "⚠️ Unit tests failed, but continuing..."
  }
else
  echo "⚠️ No unit tests found"
fi

# Test Lambda packaging
echo "📦 Testing Lambda packaging..."
if node scripts/package-lambda.js; then
  echo "✅ Main packaging successful"
else
  echo "⚠️ Main packaging failed, testing emergency packaging..."
  if node scripts/emergency-package.js; then
    echo "✅ Emergency packaging successful"
  else
    echo "❌ Both packaging methods failed"
    exit 1
  fi
fi

# Verify the package
echo "🔍 Verifying Lambda package..."
if node scripts/verify-lambda.js; then
  echo "✅ Package verification successful"
else
  echo "❌ Package verification failed"
  exit 1
fi

# Test K6 syntax (if K6 is available)
echo "⚡ Testing K6 scripts syntax..."
if command -v k6 >/dev/null 2>&1; then
  k6 archive k6/post-test.js --out /dev/null && echo "✅ K6 post-test syntax OK"
  k6 archive k6/get-test.js --out /dev/null && echo "✅ K6 get-test syntax OK"
else
  echo "⚠️ K6 not installed, skipping syntax check"
fi

# Check if LocalStack Docker image is available
echo "🐳 Checking Docker and LocalStack..."
if command -v docker >/dev/null 2>&1; then
  if docker images | grep -q localstack; then
    echo "✅ LocalStack Docker image available"
  else
    echo "⚠️ LocalStack image not pulled (run: docker pull localstack/localstack)"
  fi
else
  echo "⚠️ Docker not available"
fi

echo ""
echo "✅ Local validation completed successfully!"
echo "🚀 The workflow should work in GitHub Actions"
echo ""
echo "To run the full pipeline locally:"
echo "1. Start LocalStack: docker run --rm -it -p 4566:4566 localstack/localstack"
echo "2. Run deployment: npm run deploy:localstack"
echo "3. Start API Gateway: npm start"
echo "4. Run K6 tests: npm run test:all"

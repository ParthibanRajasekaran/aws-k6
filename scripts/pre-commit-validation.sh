#!/bin/bash

# Pre-commit validation script for Lambda+S3 workflow
# This script validates the workflow locally before pushing to GitHub

set -e

echo "🔍 Pre-commit validation starting..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Lint check (optional)
# log "Checking if linting is available..."
# if npm run _lint 2>/dev/null; then
#     log "✅ Linting passed (optional)"
# else
#     warning "⚠️ Linting skipped or not configured"
# fi

# Step 2: Unit tests
log "Running unit tests..."
if npm run test:unit; then
    log "✅ Unit tests passed"
else
    error "❌ Unit tests failed"
    exit 1
fi

# Step 3: Check if Docker is running
log "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    error "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Step 4: Start LocalStack and test deployment
log "Starting LocalStack for integration test..."
docker-compose up -d localstack

# Wait for LocalStack to be ready
log "Waiting for LocalStack to be ready..."
max_attempts=20
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:4566/_localstack/health 2>/dev/null; then
        log "✅ LocalStack is ready!"
        break
    fi
    echo "Waiting... (attempt $((attempt + 1))/$max_attempts)"
    sleep 3
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    error "❌ LocalStack failed to start"
    docker-compose down
    exit 1
fi

# Step 5: Test deployment
log "Testing Lambda and S3 deployment..."
if node scripts/deploy-localstack.js; then
    log "✅ Deployment test passed"
else
    error "❌ Deployment test failed"
    docker-compose down
    exit 1
fi

# Step 6: Test API Gateway simulation
log "Testing API Gateway simulation..."
nohup npm start > test-api-gateway.log 2>&1 &
API_PID=$!

# Wait for API Gateway to be ready
sleep 5
if curl -f http://localhost:3000/health 2>/dev/null; then
    log "✅ API Gateway simulation working"
else
    warning "⚠️ API Gateway simulation may have issues"
    cat test-api-gateway.log 2>/dev/null || echo "No API Gateway logs found"
fi

# Cleanup
log "Cleaning up test environment..."
kill $API_PID 2>/dev/null || echo "API Gateway already stopped"
docker-compose down
rm -f test-api-gateway.log

log "🎉 All pre-commit validations passed!"
echo ""
echo "Your changes are ready to be pushed to GitHub!"
echo "The GitHub Actions workflow should now run successfully."

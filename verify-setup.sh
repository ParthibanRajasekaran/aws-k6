#!/bin/bash

# Quick Test Verification Script
# Tests individual components before running the full suite

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# Test LocalStack
test_localstack() {
    log "Testing LocalStack..."
    
    if ! docker-compose ps | grep -q localstack; then
        log "Starting LocalStack..."
        docker-compose up -d
        sleep 10
    fi
    
    # Wait for health check
    local retries=0
    while [ $retries -lt 20 ]; do
        if curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            success "LocalStack is healthy"
            return 0
        fi
        log "Waiting for LocalStack... (attempt $((retries + 1))/20)"
        sleep 3
        retries=$((retries + 1))
    done
    
    error "LocalStack health check failed"
    return 1
}

# Test Lambda deployment
test_lambda_deployment() {
    log "Testing Lambda deployment..."
    
    if npm run deploy:localstack; then
        success "Lambda+S3 deployment successful"
    else
        error "Lambda+S3 deployment failed"
        return 1
    fi
    
    if npm run deploy:workflow; then
        success "Step Functions deployment successful"
    else
        error "Step Functions deployment failed"
        return 1
    fi
}

# Test API Gateway
test_api_gateway() {
    log "Testing API Gateway simulation..."
    
    # Start API Gateway in background
    npm start &
    API_PID=$!
    sleep 3
    
    # Test health endpoint
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
        success "API Gateway is responding"
        kill $API_PID 2>/dev/null || true
        return 0
    else
        error "API Gateway is not responding"
        kill $API_PID 2>/dev/null || true
        return 1
    fi
}

# Test k6 scripts
test_k6_scripts() {
    log "Testing k6 scripts syntax..."
    
    local scripts=("k6/post-test.js" "k6/get-test.js" "k6/stepfn-test.js")
    
    for script in "${scripts[@]}"; do
        if k6 run --dry-run "$script" >/dev/null 2>&1; then
            success "k6 script $script syntax is valid"
        else
            error "k6 script $script has syntax errors"
            return 1
        fi
    done
}

# Test report generation
test_report_generation() {
    log "Testing report generation..."
    
    # Create dummy results for testing
    mkdir -p reports/test
    echo '{"metrics":{"http_reqs":{"values":{"count":100}},"http_req_failed":{"values":{"rate":0.01}},"http_req_duration":{"values":{"avg":150,"p95":300}}}}' > reports/test/dummy-results.json
    
    if node scripts/generate-report.js; then
        success "Report generation works"
        rm -rf reports/test
        return 0
    else
        error "Report generation failed"
        rm -rf reports/test
        return 1
    fi
}

# Main test function
run_tests() {
    log "🧪 Running component verification tests..."
    
    local failed_tests=()
    
    # Run individual tests
    test_localstack || failed_tests+=("LocalStack")
    test_lambda_deployment || failed_tests+=("Lambda Deployment")
    test_api_gateway || failed_tests+=("API Gateway")
    test_k6_scripts || failed_tests+=("k6 Scripts")
    test_report_generation || failed_tests+=("Report Generation")
    
    # Summary
    if [ ${#failed_tests[@]} -eq 0 ]; then
        success "All component tests passed! ✨"
        log "You can now run: ./run-complete-tests.sh"
        return 0
    else
        error "Failed tests: ${failed_tests[*]}"
        warning "Please fix the issues before running the complete test suite"
        return 1
    fi
}

# Handle command line options
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help"
        echo "  --localstack        Test only LocalStack"
        echo "  --lambda            Test only Lambda deployment"
        echo "  --api               Test only API Gateway"
        echo "  --k6                Test only k6 scripts"
        echo "  --reports           Test only report generation"
        echo ""
        exit 0
        ;;
    --localstack)
        test_localstack
        ;;
    --lambda)
        test_lambda_deployment
        ;;
    --api)
        test_api_gateway
        ;;
    --k6)
        test_k6_scripts
        ;;
    --reports)
        test_report_generation
        ;;
    "")
        run_tests
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

#!/bin/bash

# AWS K6 Complete Test Suite Runner
# Orchestrates both Lambda+S3 and Step Function testing scenarios with enhanced resilience

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration with more flexibility
LOCALSTACK_HEALTH_TIMEOUT=${LOCALSTACK_HEALTH_TIMEOUT:-60}
RETRY_DELAY=${RETRY_DELAY:-5}
MAX_RETRIES=${MAX_RETRIES:-10}
ENABLE_REPORTS=${ENABLE_REPORTS:-true}
ENABLE_ANALYSIS=${ENABLE_ANALYSIS:-true}
VUS=${VUS:-""}
DURATION=${DURATION:-""}
LOG_LEVEL=${LOG_LEVEL:-"info"}

# Test scenarios - can be overridden via environment variables
LAMBDA_S3_TESTS=(${LAMBDA_S3_TESTS:-"k6/post-test.js" "k6/get-test.js"})
STEP_FUNCTION_TESTS=(${STEP_FUNCTION_TESTS:-"k6/stepfn-test.js"})

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Health check function
check_localstack_health() {
    log "Checking LocalStack health..."
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            success "LocalStack is healthy"
            return 0
        fi
        
        warning "LocalStack not ready, retrying in ${RETRY_DELAY}s... (attempt $((retries + 1))/$MAX_RETRIES)"
        sleep $RETRY_DELAY
        retries=$((retries + 1))
    done
    
    error "LocalStack health check failed after $MAX_RETRIES attempts"
    return 1
}

# Validate environment
validate_environment() {
    log "Validating environment..."
    
    # Check if required tools are installed
    command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed."; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || { error "Docker Compose is required but not installed."; exit 1; }
    command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed."; exit 1; }
    command -v jq >/dev/null 2>&1 || { warning "jq is not installed. JSON processing may be limited."; }
    
    success "Environment validation passed"
}

# Setup function
setup_infrastructure() {
    log "Setting up infrastructure..."
    
    # Create reports directory
    mkdir -p reports/{lambda-s3,step-functions,consolidated}
    
    # Start LocalStack services
    log "Starting LocalStack services..."
    docker-compose up -d
    
    # Wait for LocalStack to be ready
    check_localstack_health || exit 1
    
    # Deploy Lambda+S3 infrastructure
    log "Deploying Lambda+S3 infrastructure..."
    npm run deploy:localstack
    
    # Deploy Step Functions infrastructure
    log "Deploying Step Functions infrastructure..."
    npm run deploy:workflow
    
    # Start API Gateway simulation
    log "Starting API Gateway simulation..."
    npm start &
    API_GATEWAY_PID=$!
    sleep 3
    
    # Verify API Gateway is running
    if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
        warning "API Gateway health check failed, continuing anyway..."
    else
        success "API Gateway is running"
    fi
    
    export API_GATEWAY_PID
    success "Infrastructure setup complete"
}

# Run Lambda+S3 tests
run_lambda_s3_tests() {
    log "Running Lambda+S3 performance tests..."
    
    local test_results=()
    
    for test_file in "${LAMBDA_S3_TESTS[@]}"; do
        local test_name=$(basename "$test_file" .js)
        log "Running $test_name test..."
        
        local output_file="reports/lambda-s3/${test_name}-results.json"
        
        if k6 run \
            --out json="$output_file" \
            "$test_file"; then
            success "$test_name test completed successfully"
            test_results+=("$test_name:PASS")
        else
            error "$test_name test failed"
            test_results+=("$test_name:FAIL")
        fi
        
        sleep 2  # Brief pause between tests
    done
    
    # Store results for later use
    printf '%s\n' "${test_results[@]}" > reports/lambda-s3/test-summary.txt
    
    success "Lambda+S3 test suite completed"
}

# Run Step Functions tests
run_step_function_tests() {
    log "Running Step Functions performance tests..."
    
    local test_results=()
    
    for test_file in "${STEP_FUNCTION_TESTS[@]}"; do
        local test_name=$(basename "$test_file" .js)
        log "Running $test_name test..."
        
        local output_file="reports/step-functions/${test_name}-results.json"
        
        if k6 run \
            --out json="$output_file" \
            "$test_file"; then
            success "$test_name test completed successfully"
            test_results+=("$test_name:PASS")
        else
            error "$test_name test failed"
            test_results+=("$test_name:FAIL")
        fi
        
        sleep 2  # Brief pause between tests
    done
    
    # Store results for later use
    printf '%s\n' "${test_results[@]}" > reports/step-functions/test-summary.txt
    
    success "Step Functions test suite completed"
}

# Run unit tests
run_unit_tests() {
    log "Running unit tests for Lambda functions..."
    
    mkdir -p reports/unit-tests
    
    log "Running Lambda1 unit tests..."
    if npm run test:unit:lambda1; then
        success "Lambda1 unit tests passed"
    else
        error "Lambda1 unit tests failed"
    fi
    
    log "Running Lambda2 unit tests..."
    if npm run test:unit:lambda2; then
        success "Lambda2 unit tests passed"
    else
        error "Lambda2 unit tests failed"
    fi
    
    log "Running Lambda3 unit tests..."
    if npm run test:unit:lambda3; then
        success "Lambda3 unit tests passed"
    else
        error "Lambda3 unit tests failed"
    fi
    
    log "Running workflow integration tests..."
    if npx jest tests/unit/workflow; then
        success "Workflow integration tests passed"
    else
        error "Workflow integration tests failed"
    fi
    
    log "Generating test coverage report..."
    npm run test:unit:coverage
    
    success "Unit test suite completed"
}

# Generate consolidated report
generate_consolidated_report() {
    log "Generating consolidated performance report..."
    
    # Generate individual reports first
    node scripts/generate-report.js
    
    # Create consolidated report
    node scripts/generate-consolidated-report.js
    
    success "Consolidated report generated at reports/consolidated/index.html"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Stop test analyzer if it's running
    if [ ! -z "$ANALYZER_PID" ]; then
        kill $ANALYZER_PID 2>/dev/null || true
        success "Test analyzer stopped"
    fi
    
    # Stop API Gateway if it's running
    if [ ! -z "$API_GATEWAY_PID" ]; then
        kill $API_GATEWAY_PID 2>/dev/null || true
        success "API Gateway stopped"
    fi
    
    # Run cleanup script
    npm run clean
    
    success "Cleanup completed"
}

# Trap to ensure cleanup runs on exit
trap cleanup EXIT

# Main execution flow
main() {
    log "Starting AWS K6 Complete Test Suite"
    
    # Run pre-test validation
    log "Running pre-test validation..."
    if ! node scripts/pre-test-validation.js; then
        error "Pre-test validation failed. Please resolve issues before continuing."
        exit 1
    fi
    
    validate_environment
    setup_infrastructure
    
    # Start real-time test analyzer in background
    log "Starting real-time test analyzer..."
    node scripts/test-analyzer.js watch reports &
    ANALYZER_PID=$!
    
    # Run test suites
    if [ "$RUN_LAMBDA_S3" = true ]; then
        run_lambda_s3_tests
    fi
    
    if [ "$RUN_STEP_FUNCTION" = true ]; then
        run_step_function_tests
    fi
    
    if [ "$RUN_UNIT_TESTS" = true ]; then
        run_unit_tests
    fi
    
    # Stop the analyzer
    if [ ! -z "$ANALYZER_PID" ]; then
        kill $ANALYZER_PID 2>/dev/null || true
    fi
    
    # Generate reports
    generate_consolidated_report
    
    # Generate final analysis summary
    log "Generating final performance analysis..."
    
    if [ "$RUN_LAMBDA_S3" = true ]; then
        node scripts/test-analyzer.js analyze reports/lambda-s3/post-test-results.json post lambda_s3 2>/dev/null || true
        node scripts/test-analyzer.js analyze reports/lambda-s3/get-test-results.json get lambda_s3 2>/dev/null || true
    fi
    
    if [ "$RUN_STEP_FUNCTION" = true ]; then
        node scripts/test-analyzer.js analyze reports/step-functions/stepfn-test-results.json stepfn step_functions 2>/dev/null || true
    fi
    
    # Display summary
    log "Test execution completed!"
    log "View results at:"
    
    if [ "$RUN_LAMBDA_S3" = true ]; then
        log "  - Lambda+S3 Reports: reports/lambda-s3/"
    fi
    
    if [ "$RUN_STEP_FUNCTION" = true ]; then
        log "  - Step Functions Reports: reports/step-functions/"
    fi
    
    if [ "$RUN_LAMBDA_S3" = true ] || [ "$RUN_STEP_FUNCTION" = true ]; then
        log "  - Consolidated Report: reports/consolidated/index.html"
    fi
    
    if [ "$RUN_UNIT_TESTS" = true ]; then
        log "  - Unit Test Coverage: reports/coverage/index.html"
    fi
    
    success "All tests completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h              Show this help message"
        echo "  --lambda-s3-only        Run only Lambda+S3 tests"
        echo "  --step-functions-only   Run only Step Functions tests"
        echo "  --unit-tests-only       Run only Lambda unit tests"
        echo "  --no-unit-tests         Skip unit tests"
        echo "  --no-cleanup            Skip cleanup on exit"
        echo ""
        exit 0
        ;;
    --lambda-s3-only)
        validate_environment
        setup_infrastructure
        run_lambda_s3_tests
        generate_consolidated_report
        ;;
    --step-functions-only)
        validate_environment
        setup_infrastructure
        run_step_function_tests
        generate_consolidated_report
        ;;
    --unit-tests-only)
        validate_environment
        run_unit_tests
        ;;
    --no-cleanup)
        trap - EXIT
        main
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

run_k6_test() {
    local test_file=$1
    log "Running k6 test: $test_file..."
    
    # Build k6 command
    local k6_command="run /scripts/${test_file##*/}"
    if [ -n "$VUS" ]; then
        k6_command+=" --vus $VUS"
    fi
    if [ -n "$DURATION" ]; then
        k6_command+=" --duration $DURATION"
    fi

    docker-compose run --rm k6 $k6_command

    if [ $? -eq 0 ]; then
        success "k6 test completed: $test_file"
    else
        error "k6 test failed: $test_file"
        return 1
    fi
}
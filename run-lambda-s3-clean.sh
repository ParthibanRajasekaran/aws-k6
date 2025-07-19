#!/usr/bin/env bash
# run-lambda-s3-clean.sh - Clean Lambda S3 test runner

set -e

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMPOSE_FILE="docker-compose.clean.yml"
readonly LOCALSTACK_ENDPOINT="http://localhost:4566"
readonly API_ENDPOINT="http://localhost:3000"
readonly BUCKET_NAME="lambda-s3-test-bucket"
readonly REPORTS_DIR="./reports"

# Colors
readonly GREEN="\033[0;32m"
readonly YELLOW="\033[0;33m"
readonly RED="\033[0;31m"
readonly NC="\033[0m"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    log_info "All dependencies are available"
}

cleanup() {
    log_info "Cleaning up resources..."
    docker-compose -f "$COMPOSE_FILE" down --volumes --remove-orphans > /dev/null 2>&1 || true
}

wait_for_service() {
    local endpoint="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$endpoint" > /dev/null 2>&1; then
            log_info "$service_name is ready"
            return 0
        fi
        
        log_warn "Attempt $attempt/$max_attempts: $service_name not ready yet"
        sleep 2
        ((attempt++))
    done
    
    log_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

setup_infrastructure() {
    log_info "Setting up infrastructure..."
    
    # Create reports directory
    mkdir -p "$REPORTS_DIR"
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services
    wait_for_service "$LOCALSTACK_ENDPOINT/_localstack/health" "LocalStack"
    wait_for_service "$API_ENDPOINT/health" "API Gateway"
    
    log_info "Infrastructure setup complete"
}

run_tests() {
    log_info "Running Lambda S3 performance tests..."
    
    # Create timestamped report directory
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local test_report_dir="$REPORTS_DIR/lambda-s3-$timestamp"
    mkdir -p "$test_report_dir"
    
    # Run POST test (Upload)
    log_info "Running POST test (S3 Upload)..."
    docker-compose -f "$COMPOSE_FILE" run --rm k6-runner \
        run /scripts/post-test.js \
        --out json="/reports/lambda-s3-$timestamp/post-results.json" \
        --summary-trend-stats="min,med,avg,p(95),p(99),max"
    
    # Run GET test (Download)
    log_info "Running GET test (S3 Download)..."
    docker-compose -f "$COMPOSE_FILE" run --rm k6-runner \
        run /scripts/get-test.js \
        --out json="/reports/lambda-s3-$timestamp/get-results.json" \
        --summary-trend-stats="min,med,avg,p(95),p(99),max"
    
    # Generate summary report
    log_info "Generating test summary..."
    echo "Lambda S3 Performance Test Summary" > "$test_report_dir/summary.txt"
    echo "=================================" >> "$test_report_dir/summary.txt"
    echo "Test Date: $(date)" >> "$test_report_dir/summary.txt"
    echo "Reports Location: $test_report_dir" >> "$test_report_dir/summary.txt"
    
    log_info "Tests completed successfully"
    log_info "Reports saved to: $test_report_dir"
}

main() {
    log_info "Starting Lambda S3 Performance Testing Suite"
    
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Execute test pipeline
    check_dependencies
    setup_infrastructure
    run_tests
    
    log_info "Lambda S3 performance testing completed successfully"
}

# Run main function
main "$@"

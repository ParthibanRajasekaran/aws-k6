#!/bin/bash

# Enhanced K6 Test Runner with better configuration and debugging options

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command-line arguments
VERBOSE=false
DEBUG=false
LOG_LEVEL="info"
VUS=""
DURATION=""
THRESHOLDS_PASSTHROUGH=false

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --verbose)
      VERBOSE=true
      shift
      ;;
    --debug)
      DEBUG=true
      LOG_LEVEL="debug"
      shift
      ;;
    --vus=*)
      VUS="${key#*=}"
      shift
      ;;
    --duration=*)
      DURATION="${key#*=}"
      shift
      ;;
    --no-thresholds)
      THRESHOLDS_PASSTHROUGH=true
      shift
      ;;
    --*)
      echo "Unknown option: $key"
      shift
      ;;
    *)
      # Save remaining args for k6
      break
      ;;
  esac
done

# Environment variables with defaults
export API_URL=${API_URL:-http://localhost:3000}
export BUCKET=${BUCKET:-test-bucket}
export REGION=${REGION:-us-east-1}
export ENDPOINT=${ENDPOINT:-http://localhost:4566}
export LOG_LEVEL=${LOG_LEVEL:-"info"}
export WARMUP_ENABLED=${WARMUP_ENABLED:-"true"}

# Create directories based on test name
TEST_NAME=$(basename "${1%.*}" || echo "test")
REPORT_DIR="reports/${TEST_NAME}"
mkdir -p "$REPORT_DIR"

# Build K6 arguments
K6_ARGS=()

# Add output options
K6_ARGS+=("--out" "json=${REPORT_DIR}/${TEST_NAME}-results.json")
K6_ARGS+=("--out" "web-dashboard=${REPORT_DIR}/dashboard")

# Add VUs if specified
if [ ! -z "$VUS" ]; then
  K6_ARGS+=("--vus" "$VUS")
fi

# Add duration if specified
if [ ! -z "$DURATION" ]; then
  K6_ARGS+=("--duration" "$DURATION")
fi

# Skip thresholds enforcement during development/debugging if requested
if [ "$THRESHOLDS_PASSTHROUGH" = true ]; then
  K6_ARGS+=("--no-thresholds")
fi

# Setup log level
if [ "$DEBUG" = true ]; then
  K6_ARGS+=("--verbose")
elif [ "$VERBOSE" = true ]; then
  K6_ARGS+=("--verbose")
fi

echo -e "${BLUE}Running K6 test: ${TEST_NAME}${NC}"
echo -e "${BLUE}Environment: API_URL=${API_URL}, ENDPOINT=${ENDPOINT}${NC}"
echo -e "${BLUE}Report directory: ${REPORT_DIR}${NC}"

# Run the test with all arguments
k6 run "${K6_ARGS[@]}" "$@"

RESULT=$?

# Show test results summary if available
if [ -f "${REPORT_DIR}/${TEST_NAME}-results.json" ]; then
  echo -e "\n${GREEN}Test results available at: ${REPORT_DIR}/${TEST_NAME}-results.json${NC}"
  echo -e "${YELLOW}Running quick analysis...${NC}"
  node scripts/enhanced-analyzer.js analyze "${REPORT_DIR}/${TEST_NAME}-results.json" "$TEST_NAME" 2>/dev/null || true
fi

exit $RESULT

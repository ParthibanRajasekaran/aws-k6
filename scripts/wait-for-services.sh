#!/bin/bash

# wait-for-services.sh
# A robust script for waiting for services to be ready before proceeding
# Useful for ensuring dependencies are available before running tests

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TIMEOUT=120
QUIET=0
STRICT=0
PROTOCOL=tcp
HOST=""
PORT=""
SERVICE_NAME=""
WAIT_INTERVAL=1

# Usage information
usage() {
  cat << EOF
Usage: $0 [options] [-- command]
  -h, --help              Show this help
  -H, --host=HOST         Host or IP to check (required)
  -p, --port=PORT         TCP port to check (required)
  -s, --service=NAME      Service name for display purposes
  -t, --timeout=SECONDS   Timeout in seconds (default: $TIMEOUT)
  -q, --quiet             Don't output any status messages
  -S, --strict            Strict mode - exit with 1 on failure
  -- COMMAND              Command to execute if the service is ready
EOF
  exit 1
}

log() {
  if [ $QUIET -eq 0 ]; then
    echo -e "$@"
  fi
}

wait_for_service() {
  local start_time=$(date +%s)
  local end_time=$((start_time + TIMEOUT))
  local current_time=$start_time
  local is_ready=0
  
  log "${BLUE}[$(date +"%H:%M:%S")]${NC} Waiting for ${SERVICE_NAME:-$HOST:$PORT} to become available..."
  
  # Listen for Ctrl+C
  trap 'log "${RED}Operation aborted by user${NC}"; exit 1' INT
  
  # Wait for the service to become available
  while [ $current_time -lt $end_time ]; do
    if nc -z "$HOST" "$PORT" > /dev/null 2>&1; then
      is_ready=1
      break
    fi
    
    elapsed=$((current_time - start_time))
    
    # Print dots to show progress, clear line first to handle terminal width
    if [ $QUIET -eq 0 ]; then
      printf "\r%-60s" "   Waiting ${elapsed}s/${TIMEOUT}s..."
      for i in $(seq 0 $((elapsed / 2 % 20))); do
        printf "."
      done
    fi
    
    sleep $WAIT_INTERVAL
    current_time=$(date +%s)
  done
  
  echo # New line after progress dots
  
  if [ $is_ready -eq 1 ]; then
    local elapsed=$((current_time - start_time))
    log "${GREEN}✅ Service ${SERVICE_NAME:-$HOST:$PORT} is available after ${elapsed}s${NC}"
    
    if [ ! -z "$1" ]; then
      log "${BLUE}Executing command: $@${NC}"
      exec "$@"
    fi
    
    return 0
  else
    log "${RED}❌ Timeout reached: ${SERVICE_NAME:-$HOST:$PORT} is not available after ${TIMEOUT}s${NC}"
    
    if [ $STRICT -eq 1 ]; then
      exit 1
    fi
    
    return 1
  fi
}

# Parse command line parameters
while [ $# -gt 0 ]; do
  case "$1" in
    --host=*)
      HOST="${1#*=}"
      shift 1
      ;;
    -H)
      HOST="$2"
      if [ "$HOST" == "" ]; then
        usage
      fi
      shift 2
      ;;
    --port=*)
      PORT="${1#*=}"
      shift 1
      ;;
    -p)
      PORT="$2"
      if [ "$PORT" == "" ]; then
        usage
      fi
      shift 2
      ;;
    --service=*)
      SERVICE_NAME="${1#*=}"
      shift 1
      ;;
    -s)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --timeout=*)
      TIMEOUT="${1#*=}"
      shift 1
      ;;
    -t)
      TIMEOUT="$2"
      if [ "$TIMEOUT" == "" ]; then
        usage
      fi
      shift 2
      ;;
    --quiet)
      QUIET=1
      shift 1
      ;;
    -q)
      QUIET=1
      shift 1
      ;;
    --strict)
      STRICT=1
      shift 1
      ;;
    -S)
      STRICT=1
      shift 1
      ;;
    --help)
      usage
      ;;
    -h)
      usage
      ;;
    --)
      shift
      break
      ;;
    *)
      log "${RED}Unknown parameter: $1${NC}"
      usage
      ;;
  esac
done

# Check required parameters
if [ "$HOST" == "" -o "$PORT" == "" ]; then
  log "${RED}Error: You must specify a host and port${NC}"
  usage
fi

wait_for_service "$@"

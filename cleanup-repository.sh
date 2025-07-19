#!/usr/bin/env bash
# cleanup-repository.sh - Clean up repository to focus on Lambda S3 only

set -e

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

print_message() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

# Create backup directory
print_message "Creating backup directory..."
mkdir -p ./backup-$(date +%Y%m%d-%H%M%S)

# Files and directories to KEEP for Lambda S3 functionality
KEEP_FILES=(
    "lambda/"
    "k6/post-test.js"
    "k6/get-test.js"
    "k6/utils.js"
    "api-gateway-sim.js"
    "docker-compose.lambda-s3.yml"
    "Dockerfile.api"
    "package.json"
    "package-lock.json"
    "README.md"
    "run-lambda-s3.sh"
    "eslint.config.js"
    "jest.config.js"
    ".gitignore"
    ".github/"
    "config/k6-config.json"
    "config/performance-thresholds.json"
    "localstack-s3-data/"
)

# Create a temporary directory for files to keep
print_message "Creating temporary directory for essential files..."
mkdir -p ./temp-lambda-s3

# Copy essential files to temporary directory
for item in "${KEEP_FILES[@]}"; do
    if [ -f "$item" ]; then
        print_message "Preserving file: $item"
        cp -r "$item" ./temp-lambda-s3/
    elif [ -d "$item" ]; then
        print_message "Preserving directory: $item"
        cp -r "$item" ./temp-lambda-s3/
    else
        print_warning "File/directory not found: $item"
    fi
done

# Clean up reports directory but keep structure
print_message "Cleaning up reports directory..."
if [ -d "reports" ]; then
    mkdir -p ./temp-lambda-s3/reports
    # Keep only lambda-s3 related reports
    if [ -d "reports/lambda-s3" ]; then
        cp -r reports/lambda-s3 ./temp-lambda-s3/reports/
    fi
fi

# Clean up scripts directory but keep essential ones
print_message "Cleaning up scripts directory..."
if [ -d "scripts" ]; then
    mkdir -p ./temp-lambda-s3/scripts
    # Keep only essential scripts
    for script in deploy-lambda-s3.js run-k6-tests.sh wait-for-services.sh; do
        if [ -f "scripts/$script" ]; then
            cp "scripts/$script" ./temp-lambda-s3/scripts/
        fi
    done
fi

print_message "Repository cleanup complete! Essential Lambda S3 files preserved in ./temp-lambda-s3/"
print_message "Review the contents and then run 'mv temp-lambda-s3/* . && rm -rf temp-lambda-s3' to apply changes"

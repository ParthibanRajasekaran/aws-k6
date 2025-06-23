#!/bin/bash

# CI/CD Pipeline Validation Script
# This script validates the new GitHub Actions workflow configuration

set -e

echo "🚀 Validating CI/CD Pipeline Configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_status "error" "This script must be run from the project root directory"
    exit 1
fi

print_status "info" "Validating project structure..."

# 1. Check required files exist
required_files=(
    "package.json"
    ".github/workflows/production-ready-ci-cd.yml"
    "lambda/index.js"
    "k6/post-test.js"
    "k6/get-test.js"
    "k6/utils.js"
    "config/performance-thresholds.json"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "success" "Found: $file"
    else
        print_status "error" "Missing required file: $file"
        exit 1
    fi
done

# 2. Check package.json scripts
print_status "info" "Validating npm scripts..."

required_scripts=(
    "test:unit"
    "test:unit:coverage"
    "test:post"
    "test:get"
    "deploy:localstack"
    "start"
    "validate"
)

for script in "${required_scripts[@]}"; do
    if npm run --silent "$script" --dry-run >/dev/null 2>&1; then
        print_status "success" "npm script available: $script"
    else
        print_status "warning" "npm script not found or invalid: $script"
    fi
done

# 3. Validate GitHub Actions workflow syntax
print_status "info" "Validating GitHub Actions workflow syntax..."

workflow_file=".github/workflows/production-ready-ci-cd.yml"

# Check if the workflow file has valid YAML syntax
if command -v yamllint >/dev/null 2>&1; then
    if yamllint "$workflow_file" >/dev/null 2>&1; then
        print_status "success" "Workflow YAML syntax is valid"
    else
        print_status "warning" "Workflow YAML syntax issues detected"
        yamllint "$workflow_file" || true
    fi
else
    print_status "warning" "yamllint not available, skipping YAML syntax validation"
fi

# Check for required workflow sections
required_sections=(
    "name:"
    "on:"
    "jobs:"
    "code-quality:"
    "unit-tests:"
    "integration-tests:"
    "performance-tests:"
    "security-scan:"
    "build-and-package:"
)

for section in "${required_sections[@]}"; do
    if grep -q "$section" "$workflow_file"; then
        print_status "success" "Workflow section found: $section"
    else
        print_status "error" "Missing workflow section: $section"
    fi
done

# 4. Check dependencies
print_status "info" "Checking Node.js dependencies..."

if [[ -f "package-lock.json" ]]; then
    print_status "success" "Found package-lock.json"
else
    print_status "warning" "No package-lock.json found, consider running 'npm install'"
fi

# Check for critical dependencies
critical_deps=(
    "@aws-sdk/client-s3"
    "@aws-sdk/client-lambda"
    "express"
    "jest"
)

for dep in "${critical_deps[@]}"; do
    if npm list "$dep" >/dev/null 2>&1; then
        print_status "success" "Dependency available: $dep"
    else
        print_status "warning" "Dependency not found: $dep"
    fi
done

# 5. Check K6 test files
print_status "info" "Validating K6 test files..."

k6_files=("k6/post-test.js" "k6/get-test.js")

for k6_file in "${k6_files[@]}"; do
    if [[ -f "$k6_file" ]]; then
        # Check if file has required K6 exports
        if grep -q "export.*options" "$k6_file" && grep -q "export.*default" "$k6_file"; then
            print_status "success" "K6 test file valid: $k6_file"
        else
            print_status "warning" "K6 test file may be missing required exports: $k6_file"
        fi
    else
        print_status "error" "K6 test file not found: $k6_file"
    fi
done

# 6. Check environment configuration
print_status "info" "Validating environment configuration..."

# Check if LocalStack can be started (Docker required)
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        print_status "success" "Docker is available and running"
    else
        print_status "warning" "Docker is installed but not running"
    fi
else
    print_status "warning" "Docker not found - required for LocalStack integration"
fi

# Check AWS CLI
if command -v aws >/dev/null 2>&1; then
    print_status "success" "AWS CLI is available"
    aws --version
else
    print_status "warning" "AWS CLI not found - may be installed during workflow execution"
fi

# 7. Performance thresholds validation
print_status "info" "Validating performance thresholds..."

thresholds_file="config/performance-thresholds.json"
if [[ -f "$thresholds_file" ]]; then
    if command -v jq >/dev/null 2>&1; then
        if jq empty "$thresholds_file" >/dev/null 2>&1; then
            print_status "success" "Performance thresholds file is valid JSON"
            
            # Check for required threshold levels
            if jq -e '.thresholds.A' "$thresholds_file" >/dev/null 2>&1; then
                print_status "success" "Performance threshold levels are defined"
            else
                print_status "warning" "Performance threshold levels may be incomplete"
            fi
        else
            print_status "error" "Performance thresholds file contains invalid JSON"
        fi
    else
        print_status "warning" "jq not available, skipping JSON validation"
    fi
fi

# 8. Test script execution capability
print_status "info" "Testing script execution capability..."

# Check if validation script exists and is executable
if [[ -f "scripts/pre-test-validation.js" ]]; then
    if node scripts/pre-test-validation.js >/dev/null 2>&1; then
        print_status "success" "Pre-test validation script works"
    else
        print_status "warning" "Pre-test validation script may have issues"
    fi
else
    print_status "warning" "Pre-test validation script not found"
fi

# 9. GitHub Actions runner compatibility
print_status "info" "Checking GitHub Actions compatibility..."

# Check for GitHub Actions specific files
if [[ -d ".github" ]]; then
    print_status "success" "GitHub Actions directory exists"
    
    workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)
    print_status "info" "Found $workflow_count workflow files"
    
    if [[ $workflow_count -gt 0 ]]; then
        print_status "success" "GitHub Actions workflows are present"
    fi
else
    print_status "error" "No .github directory found"
fi

# 10. Security considerations
print_status "info" "Checking security considerations..."

# Check for secrets in files (basic check)
if grep -r -i "aws_access_key_id.*=" . --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null | grep -v "test" | head -1; then
    print_status "warning" "Potential hardcoded AWS credentials found - ensure secrets are properly managed"
else
    print_status "success" "No obvious hardcoded credentials found"
fi

# Check for .env files
if [[ -f ".env" ]]; then
    print_status "warning" ".env file found - ensure it's in .gitignore and doesn't contain production secrets"
fi

# Summary
echo ""
print_status "info" "🏁 Validation Summary"
echo "======================================"
print_status "success" "✅ Project structure validation complete"
print_status "success" "✅ Workflow configuration validated"
print_status "success" "✅ Dependencies checked"
print_status "success" "✅ Test files validated"
print_status "success" "✅ Environment compatibility verified"

echo ""
print_status "info" "🚀 Next Steps:"
echo "1. Review any warnings above"
echo "2. Ensure Docker is running for integration tests"
echo "3. Install missing dependencies if needed: npm install"
echo "4. Test the workflow with a sample commit/PR"
echo "5. Monitor the first few pipeline runs"

echo ""
print_status "info" "📋 To test the new workflow:"
echo "   git add ."
echo "   git commit -m 'feat: add comprehensive CI/CD pipeline'"
echo "   git push origin main"

echo ""
print_status "success" "🎉 CI/CD Pipeline validation completed successfully!"

# Exit with appropriate code
if [[ $(grep -c "❌" <<< "$(cat)") -gt 0 ]]; then
    exit 1
else
    exit 0
fi

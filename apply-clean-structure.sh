#!/usr/bin/env bash
# apply-clean-structure.sh - Apply the clean repository structure

set -e

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

# Backup current state
backup_current() {
    local backup_dir="backup-$(date +%Y%m%d-%H%M%S)"
    log_info "Creating backup: $backup_dir"
    
    # Create backup directory
    mkdir -p "$backup_dir"
    
    # Backup key files
    local files_to_backup=(
        "package.json"
        "docker-compose.yml"
        "docker-compose.lambda-s3.yml"
        "Dockerfile.api"
        "README.md"
        "run-lambda-s3.sh"
    )
    
    for file in "${files_to_backup[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$backup_dir/"
            log_info "Backed up: $file"
        fi
    done
    
    log_info "Backup completed: $backup_dir"
}

# Apply clean files
apply_clean_files() {
    log_info "Applying clean file structure..."
    
    # Replace main files with clean versions
    if [ -f "package-clean.json" ]; then
        mv "package-clean.json" "package.json"
        log_info "Applied clean package.json"
    fi
    
    if [ -f "docker-compose.clean.yml" ]; then
        mv "docker-compose.clean.yml" "docker-compose.yml"
        log_info "Applied clean docker-compose.yml"
    fi
    
    if [ -f "Dockerfile.clean" ]; then
        mv "Dockerfile.clean" "Dockerfile.api"
        log_info "Applied clean Dockerfile.api"
    fi
    
    if [ -f "README-clean.md" ]; then
        mv "README-clean.md" "README.md"
        log_info "Applied clean README.md"
    fi
    
    if [ -f "run-lambda-s3-clean.sh" ]; then
        mv "run-lambda-s3-clean.sh" "run-lambda-s3.sh"
        chmod +x "run-lambda-s3.sh"
        log_info "Applied clean run-lambda-s3.sh"
    fi
    
    if [ -f "deploy-clean.sh" ]; then
        mv "deploy-clean.sh" "deploy-lambda-s3.sh"
        chmod +x "deploy-lambda-s3.sh"
        log_info "Applied clean deploy-lambda-s3.sh"
    fi
}

# Create clean directory structure
create_clean_structure() {
    log_info "Creating clean directory structure..."
    
    # Create essential directories
    mkdir -p {reports,config,tests,scripts}
    
    # Create config files
    if [ ! -f "config/k6-config.json" ]; then
        cat > "config/k6-config.json" << 'EOF'
{
  "stages": [
    { "duration": "30s", "target": 10 },
    { "duration": "1m", "target": 20 },
    { "duration": "2m", "target": 30 },
    { "duration": "30s", "target": 0 }
  ],
  "thresholds": {
    "http_req_duration": ["p(95)<3000"],
    "http_req_failed": ["rate<0.01"]
  }
}
EOF
        log_info "Created k6-config.json"
    fi
    
    if [ ! -f "config/performance-thresholds.json" ]; then
        cat > "config/performance-thresholds.json" << 'EOF'
{
  "upload": {
    "http_req_duration": ["p(95)<5000"],
    "http_req_failed": ["rate<0.01"],
    "upload_duration": ["p(95)<4000"]
  },
  "download": {
    "http_req_duration": ["p(95)<2000"],
    "http_req_failed": ["rate<0.01"],
    "download_duration": ["p(95)<1500"]
  }
}
EOF
        log_info "Created performance-thresholds.json"
    fi
    
    # Create scripts directory structure
    mkdir -p scripts
    
    # Create a simple K6 test runner script
    cat > "scripts/run-k6-tests.sh" << 'EOF'
#!/usr/bin/env bash
# K6 test runner script

set -e

TEST_FILE="$1"
OUTPUT_DIR="./reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$TEST_FILE" ]; then
    echo "Usage: $0 <test-file>"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Running K6 test: $TEST_FILE"
k6 run "$TEST_FILE" --out json="$OUTPUT_DIR/$(basename "$TEST_FILE" .js)-$TIMESTAMP.json"
EOF
    chmod +x "scripts/run-k6-tests.sh"
    log_info "Created run-k6-tests.sh"
}

# Clean up unnecessary files
cleanup_files() {
    log_info "Cleaning up unnecessary files..."
    
    # Files to remove (keeping only Lambda S3 essentials)
    local files_to_remove=(
        # CI/CD files (keep only essential ones)
        "CI-CD-*.md"
        "GITHUB-ACTIONS-*.md"
        "LAMBDA-S3-*.md"
        "LOCALSTACK-*.md"
        "OPTIMIZATION-*.md"
        "PERFORMANCE-*.md"
        "PIPELINE-*.md"
        "PRODUCTION-*.md"
        "TEST-*.md"
        "TESTING-*.md"
        "WORKFLOW-*.md"
        
        # Step Functions files
        "docker-compose.step-fns.yml"
        "state-machine-definition.json"
        "k6/stepfn-test.js"
        
        # Multiple lambda directories (keep only main one)
        "lambda1/"
        "lambda2/"
        "lambda3/"
        "lambda*.zip"
        
        # Other unnecessary files
        "*.log"
        "test-*.txt"
        "downloaded.txt"
        "verify-*.sh"
        "run-*.sh"
        "validate-*.sh"
        "run-best-practice-tests.sh"
        "run-complete-tests.sh"
        "run-critical-tests.js"
        "run-critical-tests.sh"
        "emergency-package.js"
        "fix-test-issues.js"
        "enhanced-analyzer.js"
        "cleanup-workflow.js"
        "diagnose-localstack-dns.sh"
        "get-results.json"
        "post-results.json"
        
        # Keep only essential docker-compose files
        "docker-compose.improved.yml"
        "docker-compose.step-fns.yml"
    )
    
    for pattern in "${files_to_remove[@]}"; do
        if ls $pattern > /dev/null 2>&1; then
            rm -rf $pattern
            log_info "Removed: $pattern"
        fi
    done
    
    # Clean up directories but keep structure
    if [ -d "reports" ]; then
        find reports -name "*.json" -type f -delete 2>/dev/null || true
        log_info "Cleaned up reports directory"
    fi
    
    if [ -d "localstack-s3-data" ]; then
        rm -rf localstack-s3-data/*
        log_info "Cleaned up localstack-s3-data"
    fi
    
    # Remove large script directories but keep essential ones
    if [ -d "scripts" ]; then
        # Keep only essential scripts
        find scripts -name "*.js" -not -name "deploy-lambda-s3.js" -delete 2>/dev/null || true
        find scripts -name "*.sh" -not -name "run-k6-tests.sh" -not -name "wait-for-services.sh" -delete 2>/dev/null || true
        log_info "Cleaned up scripts directory"
    fi
    
    # Remove testing directories except for unit tests
    if [ -d "testing" ]; then
        rm -rf testing
        log_info "Removed testing directory"
    fi
    
    # Clean up services directory
    if [ -d "services" ]; then
        rm -rf services
        log_info "Removed services directory"
    fi
    
    # Clean up infrastructure directory
    if [ -d "infrastructure" ]; then
        rm -rf infrastructure
        log_info "Removed infrastructure directory"
    fi
    
    # Clean up iam directory
    if [ -d "iam" ]; then
        rm -rf iam
        log_info "Removed iam directory"
    fi
    
    # Clean up demo directory
    if [ -d "demo" ]; then
        rm -rf demo
        log_info "Removed demo directory"
    fi
    
    # Clean up html-report directory
    if [ -d "html-report" ]; then
        rm -rf html-report
        log_info "Removed html-report directory"
    fi
    
    # Clean up localstack directories except main one
    if [ -d "localstack" ]; then
        rm -rf localstack
        log_info "Removed localstack directory"
    fi
    
    if [ -d "localstack-sfn" ]; then
        rm -rf localstack-sfn
        log_info "Removed localstack-sfn directory"
    fi
}

# Update package.json dependencies
update_dependencies() {
    log_info "Updating dependencies..."
    
    # Install only necessary dependencies
    if [ -f "package.json" ]; then
        npm install
        log_info "Dependencies updated"
    fi
}

# Create .gitignore for clean repo
create_gitignore() {
    log_info "Creating .gitignore..."
    
    cat > ".gitignore" << 'EOF'
# Dependencies
node_modules/
lambda/node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime
*.log
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Reports and outputs
reports/
!reports/.gitkeep
*.json
!package*.json
!config/*.json

# LocalStack data
localstack-s3-data/
!localstack-s3-data/.gitkeep

# Docker
.docker/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Build artifacts
dist/
build/
*.zip
*.tar.gz

# Coverage
coverage/

# Temporary files
tmp/
temp/
*.tmp
*.temp

# Backup files
backup-*/
EOF
    
    log_info "Created .gitignore"
}

# Create placeholder files
create_placeholders() {
    log_info "Creating placeholder files..."
    
    # Create placeholder files to maintain directory structure
    touch "reports/.gitkeep"
    touch "localstack-s3-data/.gitkeep"
    
    log_info "Created placeholder files"
}

main() {
    log_info "Starting repository cleanup and restructuring..."
    
    # Confirm with user
    echo
    log_warn "This will clean up the repository and focus only on Lambda S3 functionality."
    log_warn "Current files will be backed up."
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    # Execute cleanup steps
    backup_current
    apply_clean_files
    create_clean_structure
    cleanup_files
    create_gitignore
    create_placeholders
    update_dependencies
    
    log_info "Repository cleanup completed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Review the cleaned repository structure"
    log_info "2. Run tests with: ./run-lambda-s3.sh"
    log_info "3. Check the new README.md for documentation"
    log_info ""
    log_info "To test the setup immediately:"
    log_info "  docker-compose up -d"
    log_info "  ./deploy-lambda-s3.sh"
    log_info "  ./run-lambda-s3.sh"
}

# Run main function
main "$@"

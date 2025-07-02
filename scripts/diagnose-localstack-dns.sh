#!/bin/bash
#
# Advanced LocalStack DNS & Connectivity Diagnostics
# v2.0 - Handles both local development and GitHub Actions environments
#

# Exit on command errors
set -e

# Configuration
HOSTS_TO_TEST=("localhost" "localstack" "127.0.0.1" "host.docker.internal")
PORTS_TO_TEST=(4566 4572)
ENDPOINT=${ENDPOINT:-}
LOCALSTACK_HOST=${LOCALSTACK_HOST:-localstack}
BUCKET_NAME=${BUCKET:-test-bucket}

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️ $1${NC}"; }
info() { echo -e "${BLUE}🔍 $1${NC}"; }

# Check for CI environment
if [[ -n "$GITHUB_ACTIONS" ]]; then
    ENVIRONMENT="GitHub Actions"
elif [[ -n "$CI" ]]; then
    ENVIRONMENT="CI environment"
else
    ENVIRONMENT="Local development"
fi

echo "==============================================="
echo "   LocalStack DNS & Connectivity Diagnostics   "
echo "==============================================="
echo "Date: $(date)"
echo "Environment: $ENVIRONMENT"
echo "System: $(uname -a)"
echo ""

info "Environment Variables:"
echo "- ENDPOINT=$ENDPOINT"
echo "- LOCALSTACK_HOST=$LOCALSTACK_HOST"
echo "- AWS_REGION=${AWS_REGION:-not set}"
echo "- BUCKET=${BUCKET_NAME}"
echo "- NODE_ENV=${NODE_ENV:-not set}"
echo ""

# Check for GitHub Actions specific environment
if [[ "$ENVIRONMENT" == "GitHub Actions" ]]; then
    echo "GitHub Actions Environment Details:"
    echo "- Runner: $RUNNER_OS"
    echo "- Workflow: $GITHUB_WORKFLOW"
    echo "- Job: $GITHUB_JOB"
    echo "- Repository: $GITHUB_REPOSITORY"
    echo ""
fi

# Network information
info "Network Information:"
echo "Hostname: $(hostname)"
echo "Host IP: $(hostname -I 2>/dev/null || echo "Command not supported")"
echo "DNS Servers:"
cat /etc/resolv.conf | grep nameserver || echo "  Could not read DNS servers"
echo ""

# Check if Docker is running
if command -v docker &> /dev/null; then
    info "Docker Status:"
    docker --version
    
    echo "Docker containers running:"
    docker ps --filter "name=localstack" --format "{{.ID}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}" || error "Error accessing Docker"
    
    echo "Docker networks:"
    docker network ls || error "Error listing Docker networks"
    
    # Get detailed info for localstack container if available
    if docker ps --format '{{.Names}}' | grep -q "localstack"; then
        echo ""
        info "LocalStack Container Details:"
        docker inspect localstack --format '{{json .NetworkSettings.Networks}}' | jq . || echo "  Could not parse container network details"
        echo ""
        echo "LocalStack Environment Variables:"
        docker exec localstack env | grep -E 'AWS|LOCALSTACK|ENDPOINT|HOST' || echo "  Could not read container environment"
    fi
    
    echo ""
fi

info "DNS Resolution Tests:"
for host in "${HOSTS_TO_TEST[@]}"; do
    echo "Testing DNS resolution for: $host"
    if $(nslookup $host &> /dev/null); then
        ip=$(nslookup $host 2>/dev/null | grep -A1 'Name:' | tail -n1 | awk '{print $2}')
        success "DNS resolution successful: $host → $ip"
    else
        error "DNS resolution failed for $host"
        
        # For GitHub Actions, provide specific guidance
        if [[ "$ENVIRONMENT" == "GitHub Actions" && "$host" == "localstack" ]]; then
            warn "GitHub Actions doesn't have DNS entries for 'localstack'. Use 'localhost' instead."
        fi
    fi
    
    # Test HTTP connectivity on relevant ports
    for port in "${PORTS_TO_TEST[@]}"; do
        echo "  Testing HTTP connectivity to $host:$port"
        if curl -s -m 2 -o /dev/null -w "%{http_code}" http://$host:$port/_localstack/health &> /dev/null; then
            status=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://$host:$port/_localstack/health)
            success "  HTTP connectivity successful: $host:$port (Status: $status)"
        else
            error "  HTTP connectivity failed for $host:$port"
        fi
    done
done

echo ""
info "LocalStack Health Check:"

# Try different endpoint variations
endpoints=()
if [[ -n "$ENDPOINT" ]]; then
    endpoints+=("$ENDPOINT")
fi
endpoints+=("http://${LOCALSTACK_HOST}:4566" "http://localhost:4566" "http://127.0.0.1:4566")

for endpoint in "${endpoints[@]}"; do
    echo "Testing endpoint: $endpoint"
    
    # Use a timeout and capture the output
    health_output=$(curl -s -m 5 "$endpoint/_localstack/health" 2>&1)
    if [[ $? -eq 0 ]]; then
        success "  Endpoint accessible: $endpoint"
        echo "  Health response:"
        echo "$health_output" | jq . 2>/dev/null || echo "$health_output"
        
        # Save working endpoint for further tests
        WORKING_ENDPOINT=$endpoint
        break
    else
        error "  Endpoint not accessible: $endpoint"
        echo "  Error: $health_output"
    fi
done

# Exit if no endpoints are working
if [[ -z "$WORKING_ENDPOINT" ]]; then
    warn "No working LocalStack endpoints found! Further tests will be skipped."
else
    info "Using working endpoint for further tests: $WORKING_ENDPOINT"
fi

# Test services if we have a working endpoint
if [[ -n "$WORKING_ENDPOINT" ]]; then
    echo ""
    info "LocalStack Service Tests:"
    
    # Test S3
    echo "Testing S3 service..."
    s3_status=$(curl -s "$WORKING_ENDPOINT/_localstack/health" | jq -r '.services.s3 // "unknown"')
    echo "  S3 status: $s3_status"
    
    # Test Lambda
    echo "Testing Lambda service..."
    lambda_status=$(curl -s "$WORKING_ENDPOINT/_localstack/health" | jq -r '.services.lambda // "unknown"')
    echo "  Lambda status: $lambda_status"
    
    # Test IAM
    echo "Testing IAM service..."
    iam_status=$(curl -s "$WORKING_ENDPOINT/_localstack/health" | jq -r '.services.iam // "unknown"')
    echo "  IAM status: $iam_status"
fi

# Test AWS CLI connectivity if available
if command -v aws &> /dev/null; then
    echo ""
    info "AWS CLI Connectivity Tests:"
    
    # Use the working endpoint if found
    if [[ -n "$WORKING_ENDPOINT" ]]; then
        echo "Testing AWS CLI with working endpoint: $WORKING_ENDPOINT"
        if aws --endpoint-url="$WORKING_ENDPOINT" s3 ls &> /dev/null; then
            success "  AWS CLI with working endpoint works"
            
            # Try creating a test bucket
            echo "  Creating test bucket: ${BUCKET_NAME}-cli-test"
            if aws --endpoint-url="$WORKING_ENDPOINT" s3 mb s3://${BUCKET_NAME}-cli-test &> /dev/null; then
                success "  Successfully created test bucket"
                
                # List buckets
                echo "  Listing buckets:"
                aws --endpoint-url="$WORKING_ENDPOINT" s3 ls
                
                # Upload test file
                echo "  Uploading test file..."
                echo "Test content" > /tmp/localstack-test-file.txt
                if aws --endpoint-url="$WORKING_ENDPOINT" s3 cp /tmp/localstack-test-file.txt s3://${BUCKET_NAME}-cli-test/ &> /dev/null; then
                    success "  Successfully uploaded test file"
                else
                    error "  Failed to upload test file"
                fi
            else
                error "  Failed to create test bucket"
            fi
        else
            error "  AWS CLI with working endpoint failed"
        fi
    else
        # Try standard endpoints if no working one was found
        for endpoint in "http://${LOCALSTACK_HOST}:4566" "http://localhost:4566" "http://127.0.0.1:4566"; do
            echo "Testing AWS CLI with endpoint: $endpoint"
            if aws --endpoint-url="$endpoint" s3 ls &> /dev/null; then
                success "  AWS CLI with $endpoint works"
            else
                error "  AWS CLI with $endpoint failed"
            fi
        done
    fi
fi

echo ""
info "NodeJS SDK Test:"
# Create a temporary script to test AWS SDK connectivity
cat << EOF > /tmp/test-aws-sdk.js
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// Try multiple endpoints
const endpoints = [
  process.env.ENDPOINT,
  \`http://\${process.env.LOCALSTACK_HOST || 'localstack'}:4566\`,
  'http://localhost:4566',
  'http://127.0.0.1:4566'
];

async function testEndpoints() {
  for (const endpoint of endpoints) {
    if (!endpoint) continue;
    
    console.log(\`Testing endpoint: \${endpoint}\`);
    
    const client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      forcePathStyle: true
    });
    
    try {
      const response = await client.send(new ListBucketsCommand({}));
      console.log(\`✅ Connection successful to \${endpoint}\`);
      console.log(\`  Buckets: \${response.Buckets?.map(b => b.Name).join(', ') || 'none'}\`);
      return;
    } catch (error) {
      console.log(\`❌ Connection failed to \${endpoint}: \${error.message}\`);
    }
  }
  
  console.log("❌ All endpoints failed!");
}

testEndpoints();
EOF

# Only run the test if we have Node.js installed
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    node /tmp/test-aws-sdk.js
else
    warn "NodeJS not found, skipping SDK test"
fi

echo ""
info "System Network Information:"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Network interfaces:"
    ip addr || ifconfig || true
    echo ""
    echo "Route table:"
    ip route || netstat -rn || true
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Network interfaces:"
    ifconfig || true
    echo ""
    echo "Route table:"
    netstat -rn || true
fi

echo ""
info "Network Connectivity Test:"
echo "Testing outbound connectivity..."
curl -s -m 5 -o /dev/null -w "Status: %{http_code}\n" https://www.google.com || echo "Failed to connect to www.google.com"
echo ""

echo "========================================"
info "Diagnosis Summary and Recommendations:"

# Evaluate environment and provide recommendations
if [[ "$ENVIRONMENT" == "GitHub Actions" ]]; then
    echo "Running in GitHub Actions:"
    echo "1. Use 'localhost' instead of 'localstack' in GitHub Actions workflows"
    echo "2. Make sure LocalStack container is started with proper port mapping:"
    echo "   - Run: docker run -d -p 4566:4566 localstack/localstack"
    echo "3. Wait for LocalStack to be fully initialized before running tests"
    echo "4. Set environment variables explicitly in workflow steps:"
    echo "   LOCALSTACK_HOST=localhost"
    echo "   ENDPOINT=http://localhost:4566"
    
    # Create additional GitHub Actions YAML snippet for reference
    echo ""
    echo "Suggested workflow step:"
    echo "```yaml"
    echo "- name: Start and configure LocalStack"
    echo "  run: |"
    echo "    docker run -d --name localstack -p 4566:4566 localstack/localstack"
    echo "    echo \"Waiting for LocalStack to start...\""
    echo "    while ! curl -s http://localhost:4566/_localstack/health | grep -q '\"s3\": \"running\"'; do"
    echo "      sleep 2"
    echo "    done"
    echo "    echo \"LocalStack is ready!\""
    echo "  env:"
    echo "    LOCALSTACK_HOST: localhost"
    echo "    ENDPOINT: http://localhost:4566"
    echo "```"
elif [[ "$ENVIRONMENT" == "Local development" ]]; then
    echo "Running in local development environment:"
    echo "1. In Docker Compose, ensure service is named 'localstack'"
    echo "2. For Lambda and application containers, set:"
    echo "   - LOCALSTACK_HOST=localstack"
    echo "   - ENDPOINT=http://localstack:4566"
    echo "3. For host machine running tests directly, use:"
    echo "   - LOCALSTACK_HOST=localhost"
    echo "   - ENDPOINT=http://localhost:4566"
    
    # Create Docker Compose snippet for reference
    echo ""
    echo "Suggested Docker Compose configuration:"
    echo "```yaml"
    echo "services:"
    echo "  localstack:"
    echo "    image: localstack/localstack"
    echo "    ports:"
    echo "      - \"4566:4566\""
    echo "    environment:"
    echo "      - SERVICES=s3,lambda,iam"
    echo "      - HOSTNAME_EXTERNAL=localstack"
    echo ""
    echo "  app:"
    echo "    # Your app service"
    echo "    environment:"
    echo "      - LOCALSTACK_HOST=localstack"
    echo "      - ENDPOINT=http://localstack:4566"
    echo "    depends_on:"
    echo "      - localstack"
    echo "```"
fi

echo ""
echo "📋 If problems persist:"
echo "1. Check for network conflicts or firewall rules blocking connections"
echo "2. Ensure LocalStack is properly initialized before running tests"
echo "3. Try setting explicit endpoint URLs instead of relying on hostname resolution"
echo "4. Add retry logic to your code for better resilience"
echo ""

exit 0

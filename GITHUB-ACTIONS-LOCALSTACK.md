# GitHub Actions LocalStack Integration Guide

This guide provides best practices for running LocalStack in GitHub Actions CI/CD pipelines.

## Common Issues

GitHub Actions environments have specific networking configurations that differ from local Docker environments, causing common issues like:

1. **DNS Resolution Failures**: `getaddrinfo EAI_AGAIN localstack` errors when services can't resolve the `localstack` hostname
2. **Network Timeouts**: Services may fail to communicate in the default network setup
3. **Inconsistent Environment Variables**: Settings may vary between local and CI environments

## Best Practices

### 1. Workflow Environment Setup

```yaml
env:
  # Host Settings - set to 'localhost' for GitHub Actions
  LOCALSTACK_HOST: localhost
  ENDPOINT: http://localhost:4566
  
  # Service Credentials - consistent values across environments
  AWS_REGION: us-east-1
  AWS_ACCESS_KEY_ID: test
  AWS_SECRET_ACCESS_KEY: test
  
  # Dynamic bucket name avoids conflicts between runs
  BUCKET_NAME: test-bucket-${{ github.run_id }}
```

### 2. LocalStack Service Setup

```yaml
steps:
  - name: Start LocalStack
    run: |
      docker run -d \
        --name localstack \
        -p 4566:4566 \
        -e SERVICES=lambda,s3,iam \
        -e DEFAULT_REGION=us-east-1 \
        -e HOSTNAME_EXTERNAL=localhost \
        -e DEBUG=1 \
        localstack/localstack

  - name: Wait for LocalStack to be ready
    run: |
      # Wait for health check to return 200
      count=0
      while [[ $(curl -s -o /dev/null -w "%{http_code}" http://localhost:4566/_localstack/health) != "200" ]]
      do
        if [[ $count -gt 30 ]]; then
          echo "LocalStack failed to start in time"
          curl -s http://localhost:4566/_localstack/health || true
          exit 1
        fi
        count=$((count + 1))
        echo "Waiting for LocalStack to start... ($count/30)"
        sleep 2
      done
      echo "LocalStack is ready!"
```

### 3. Configure AWS CLI and SDK

```yaml
- name: Configure AWS CLI
  run: |
    aws --endpoint-url=http://localhost:4566 configure set aws_access_key_id test
    aws --endpoint-url=http://localhost:4566 configure set aws_secret_access_key test
    aws --endpoint-url=http://localhost:4566 configure set region us-east-1
    
    # Test connectivity
    aws --endpoint-url=http://localhost:4566 s3 ls
```

### 4. Error Diagnostics

Add a diagnostics step to help debug issues:

```yaml
- name: Diagnostic Info
  if: always()
  run: |
    echo "=== LocalStack Diagnostics ==="
    curl -s http://localhost:4566/_localstack/health | jq .
    echo "=== LocalStack Logs ==="
    docker logs localstack
    echo "=== Network Information ==="
    docker network ls
    docker inspect localstack --format '{{ .NetworkSettings.Networks }}'
```

## Complete Workflow Example

```yaml
name: LocalStack Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  LOCALSTACK_HOST: localhost
  ENDPOINT: http://localhost:4566
  AWS_REGION: us-east-1
  AWS_ACCESS_KEY_ID: test
  AWS_SECRET_ACCESS_KEY: test
  BUCKET_NAME: test-bucket-${{ github.run_id }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start LocalStack
        run: |
          docker run -d \
            --name localstack \
            -p 4566:4566 \
            -e SERVICES=lambda,s3,iam \
            -e DEFAULT_REGION=us-east-1 \
            -e DEBUG=1 \
            localstack/localstack
            
      - name: Wait for LocalStack
        run: |
          count=0
          while [[ $(curl -s -o /dev/null -w "%{http_code}" http://localhost:4566/_localstack/health) != "200" ]]
          do
            if [[ $count -gt 30 ]]; then
              echo "LocalStack failed to start in time"
              exit 1
            fi
            count=$((count + 1))
            echo "Waiting for LocalStack... ($count/30)"
            sleep 2
          done
            
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Create S3 bucket
        run: |
          aws --endpoint-url=http://localhost:4566 s3 mb s3://$BUCKET_NAME
        
      - name: Deploy Lambda function
        run: |
          zip -j function.zip lambda/index.js
          aws --endpoint-url=http://localhost:4566 lambda create-function \
            --function-name test-lambda \
            --runtime nodejs20.x \
            --handler index.handler \
            --zip-file fileb://function.zip \
            --role arn:aws:iam::000000000000:role/lambda-role
        
      - name: Run Integration Tests
        run: |
          npm run test:integration
        env:
          LOCALSTACK_HOST: localhost
          ENDPOINT: http://localhost:4566
          BUCKET: $BUCKET_NAME
          
      - name: Diagnostic Info
        if: always()
        run: |
          curl -s http://localhost:4566/_localstack/health | jq . || true
          docker logs localstack || true
```

## Networking Troubleshooting

If you still experience DNS resolution issues, try these approaches:

1. **Use IP Address**: Replace `localhost` with `127.0.0.1` in your environment variables
2. **Docker Network Inspection**: Check network settings with `docker inspect localstack`
3. **Run DiagnoseLocalStack**: Add our diagnostic script to the workflow:

```yaml
- name: Run LocalStack Diagnostics
  run: ./scripts/diagnose-localstack-dns.sh
```

## Testing Connectivity

Test direct connectivity to verify service availability:

```bash
curl -v http://localhost:4566/_localstack/health
aws --endpoint-url=http://localhost:4566 s3 ls
```

## Common Error Solutions

| Error | Solution |
|-------|----------|
| `getaddrinfo EAI_AGAIN localstack` | Use `localhost` instead of `localstack` in GitHub Actions |
| `Connection refused` | Ensure LocalStack container is running and port is exposed |
| `Unknown service` | Check that required services are enabled in LocalStack |

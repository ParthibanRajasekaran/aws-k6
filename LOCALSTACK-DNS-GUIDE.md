# LocalStack DNS Resolution Guide

This guide addresses the DNS resolution issues that can occur when using LocalStack in different environments.

## The Problem

When running integration tests, you might see errors like:
```
getaddrinfo EAI_AGAIN localstack
```

This happens because the hostname `localstack` cannot be resolved properly in certain environments, especially:
- GitHub Actions
- Some CI/CD environments
- Local development environments without Docker network configuration

## The Solution

We've implemented a multi-layered approach to handle DNS issues:

### 1. Hostname Fallback Strategy

Both Lambda functions and integration tests will try multiple hostnames in this order:
1. Explicit `ENDPOINT` environment variable if provided
2. Hostname from `LOCALSTACK_HOST` environment variable 
3. Default hostname (`localstack` for Docker, `localhost` otherwise)

### 2. Configuration Recommendations

#### For Local Development:
```bash
export LOCALSTACK_HOST=localhost
export ENDPOINT=http://localhost:4566
```

#### For Docker Compose:
```yaml
services:
  localstack:
    # ...
    environment:
      # ...
      - HOSTNAME_EXTERNAL=localstack
      - LAMBDA_DOCKER_FLAGS=-e LOCALSTACK_HOST=localstack

  your-application:
    # ...
    environment:
      - LOCALSTACK_HOST=localstack
      - ENDPOINT=http://localstack:4566
```

#### For GitHub Actions:
```yaml
env:
  LOCALSTACK_HOST: localhost
  ENDPOINT: http://localhost:4566
```

### 3. DNS Diagnostics

We've added a diagnostic script to help troubleshoot LocalStack DNS issues:

```bash
./scripts/diagnose-localstack-dns.sh
```

This will:
- Test DNS resolution for common LocalStack hostnames
- Check HTTP connectivity to LocalStack endpoints
- Test AWS CLI connectivity
- Provide recommendations based on the detected environment

## Implementation Details

1. **Lambda Handler**: Now has built-in fallback handling and logging for endpoint resolution.
   
2. **Integration Tests**: Use an improved `waitForLocalStack()` function with hostname fallback logic.

3. **Docker Compose**: The improved configuration ensures proper hostname resolution between containers.

## Common Errors and Solutions

| Error | Solution |
|-------|----------|
| `getaddrinfo EAI_AGAIN localstack` | Use `localhost` instead of `localstack` if not in Docker |
| `ECONNREFUSED` | Check if LocalStack is running on the expected port |
| `Invalid endpoint` | Ensure AWS SDK is using the correct endpoint format |

## Testing Changes

After making changes to endpoint resolution, test with:

```bash
# Test local endpoint
export ENDPOINT=http://localhost:4566
npm run test:integration

# Test Docker hostname
export LOCALSTACK_HOST=localstack
npm run test:integration

# Test with DNS diagnostics
./scripts/diagnose-localstack-dns.sh
```

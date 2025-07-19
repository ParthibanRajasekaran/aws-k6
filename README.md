# Grocery List Microservice (API Gateway → Lambda → S3)

## Overview
A production-grade Node.js microservice to accept a list of grocery items via API Gateway or direct Lambda invocation and store them in S3. Local development and testing are supported via LocalStack.

## Architecture
- **API Gateway** → **Lambda (Node.js)** → **S3**
- Local emulation with LocalStack

## Project Structure
```
src/
  lambda/           # Lambda handler
  services/         # Business logic
  utils/            # AWS SDK wrappers

test/
  unit/             # ViTest unit tests
  acceptance/       # Karate acceptance tests
  performance/      # K6 performance tests
  contract/         # (Optional) Pact contract tests
```

## Local Development
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start LocalStack, create S3 bucket, and run Lambda locally:**
   ```sh
   npm run start
   ```

3. **Run unit tests:**
   ```sh
   npm run test:unit
   ```
4. **Run acceptance tests (Karate via Docker):**
   ```sh
   npm run test:acceptance
   ```
5. **Run performance tests (K6 via Docker):**
   ```sh
   npm run test:performance
   ```

---

**Karate and K6 are run via Docker for local and CI/CD compatibility.**

If you want to run them manually:

- **Karate:**
  ```sh
  docker run --rm -v $PWD/test/acceptance:/src -v $PWD/target:/src/target karate/karate karate /src
  ```
- **K6 (API Gateway):**
  ```sh
  docker run --rm -v $PWD:/scripts grafana/k6 run /scripts/test/performance/perf-api-gateway.js
  ```
- **K6 (Lambda):**
  ```sh
  docker run --rm -v $PWD:/scripts grafana/k6 run /scripts/test/performance/perf-lambda.js
  ```

These commands are also used in the npm scripts for CI/CD.

## Deployment
Deploy to AWS using SAM:
```sh
npm run deploy
```

## Environment Variables
- `GROCERY_BUCKET`: S3 bucket name (default: `grocery-list-bucket`)
- `LOCALSTACK_HOSTNAME`: Set by LocalStack for local emulation


## Testing

This project uses a multi-layered testing strategy to ensure robustness, automation, and enterprise-grade quality:

- **Unit tests** (`test/unit/`): Fast, isolated tests for Lambda handler and service logic using ViTest. Run with `npm run test:unit`.
- **Acceptance tests** (`test/acceptance/`): End-to-end API tests using Karate (via Docker) to validate API Gateway → Lambda → S3 integration. Run with `npm run test:acceptance`.
- **Performance tests** (`test/performance/`): Load tests using K6 (via Docker) to measure throughput and latency for both API Gateway and direct Lambda invocation. Run with `npm run test:performance`.
- **Direct Lambda invocation** (`test/direct-lambda-invoke.js`): Node.js script to invoke the Lambda directly for integration/contract checks.

### Test Orchestration

All test types can be run in sequence using:

```sh
npm test
# or
./scripts/test-all.sh
```

This script:
- Starts LocalStack and the local API Gateway/Lambda (if not already running)
- Waits for the API endpoint to be healthy using `scripts/wait-for-url.sh` (health check)
- Runs unit, acceptance, performance, and direct Lambda tests
- Ensures robust, non-brittle test execution for both local and CI/CD environments

### Test Philosophy

- **Robustness:** Health checks and endpoint waits prevent race conditions and flaky tests.
- **Automation:** All tests are scriptable and run in CI/CD (see `.github/workflows/ci.yml`).
- **Isolation:** Unit tests mock AWS SDK; acceptance/performance tests use LocalStack for full local emulation.
- **Code Quality:** Linting and formatting enforced via `npm run lint` and `npm run format`. (Consider adding a pre-push hook for automation.)

### API and Lambda Testing

- API endpoint: `POST /grocery` (body: `{ "items": ["apple", "banana"] }`)
- Lambda can be invoked directly with `{ items: [...] }`

---

All tests and scripts are ready for local and CI/CD use.

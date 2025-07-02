/**
 * Critical Tests Runner Script
 * This script runs only the critical S3 Lambda handler tests using Jest
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Critical Tests for S3 Lambda Handler');

try {
  // Find locally installed jest in node_modules
  const jestBinPath = path.resolve(__dirname, 'node_modules/.bin/jest');
  
  // Run only the lambda/index.test.js file which contains our critical tests
  // We've already reduced this file to just the critical tests
  execSync(`NODE_ENV=test ${jestBinPath} tests/unit/lambda/index.test.js`, {
    stdio: 'inherit', // This will show output in real-time
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  console.log('✅ Critical tests completed successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Critical tests failed');
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Run Critical S3 Lambda Tests
 * 
 * This script provides a simple way to run only the critical S3 Lambda tests
 * that verify the upload and download functionality.
 */

console.log('🧪 Running Critical S3 Lambda Tests');

const { execSync } = require('child_process');

// Run the focused Lambda tests
try {
  console.log('🔍 Running unit tests for Lambda handler...');
  execSync('NODE_ENV=test npm run test:unit -- tests/unit/lambda/index.test.js', {
    stdio: 'inherit'
  });
  
  console.log('\n✅ Critical tests passed!');
  console.log('\n📋 Test Summary:');
  console.log('  • ✅ POST (upload) functionality verified');
  console.log('  • ✅ GET (download) functionality verified');
  
  console.log('\n🚀 Next Steps:');
  console.log('  1. Deploy with: npm run deploy:localstack');
  console.log('  2. Run the API Gateway simulation: npm run start');
  console.log('  3. Test with curl or Postman');
  console.log('  4. Run K6 load tests: npm run test:post && npm run test:get');
} catch (error) {
  console.error('\n❌ Tests failed. Fix errors before proceeding.');
  process.exit(1);
}

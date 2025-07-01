/**
 * LocalStack Connectivity Verification Tool
 * Tests each service endpoint and reports status
 */

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { SFNClient, ListStateMachinesCommand } = require('@aws-sdk/client-sfn');
const http = require('http');

// Set up configuration
const endpoint = process.env.ENDPOINT || 'http://localhost:4566';
const region = process.env.REGION || 'us-east-1';
const credentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test'
};

// Test S3 connection
async function testS3() {
  console.log('Testing S3 connection...');
  console.log(`Endpoint: ${endpoint}, Region: ${region}`);
  
  const s3Client = new S3Client({ 
    region, 
    endpoint, 
    credentials,
    forcePathStyle: true // Required for LocalStack
  });
  
  try {
    console.log('Sending ListBucketsCommand...');
    const response = await s3Client.send(new ListBucketsCommand({}));
    console.log(`✅ S3 connection successful. Found ${response.Buckets?.length || 0} buckets.`);
    if (response.Buckets?.length > 0) {
      console.log(`   Buckets: ${response.Buckets.map(b => b.Name).join(', ')}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ S3 connection failed: ${error.message}`);
    console.error(`Error details: ${JSON.stringify(error)}`);
    return false;
  }
}

// Test Lambda connection
async function testLambda() {
  console.log('Testing Lambda connection...');
  console.log(`Endpoint: ${endpoint}, Region: ${region}`);
  
  const lambdaClient = new LambdaClient({ 
    region, 
    endpoint, 
    credentials,
    maxAttempts: 3,
    retryMode: 'standard'
  });
  
  try {
    console.log('Sending ListFunctionsCommand...');
    const response = await lambdaClient.send(new ListFunctionsCommand({}));
    console.log(`✅ Lambda connection successful. Found ${response.Functions?.length || 0} functions.`);
    if (response.Functions?.length > 0) {
      console.log(`   Functions: ${response.Functions.map(f => f.FunctionName).join(', ')}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Lambda connection failed: ${error.message}`);
    console.error(`Error details: ${JSON.stringify(error)}`);
    return false;
  }
}

// Test Step Functions connection
async function testStepFunctions() {
  console.log('Testing Step Functions connection...');
  console.log(`Endpoint: ${endpoint}, Region: ${region}`);
  
  const sfnClient = new SFNClient({ 
    region, 
    endpoint, 
    credentials,
    maxAttempts: 3,
    retryMode: 'standard'
  });
  
  try {
    console.log('Sending ListStateMachinesCommand...');
    const response = await sfnClient.send(new ListStateMachinesCommand({}));
    console.log(`✅ Step Functions connection successful. Found ${response.stateMachines?.length || 0} state machines.`);
    if (response.stateMachines?.length > 0) {
      console.log(`   State Machines: ${response.stateMachines.map(sm => sm.name).join(', ')}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Step Functions connection failed: ${error.message}`);
    console.error(`Error details: ${JSON.stringify(error)}`);
    return false;
  }
}

// Test API Gateway
function testAPIGateway() {
  return new Promise((resolve) => {
    console.log('Testing API Gateway simulation...');
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    http.get(`${apiUrl}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ API Gateway simulation is running: ${data}`);
          resolve(true);
        } else {
          console.error(`❌ API Gateway returned non-200 status: ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ API Gateway connection failed: ${err.message}`);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('🔍 Running LocalStack connectivity tests...\n');
  console.log(`⚙️ Configuration:`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Region: ${region}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);
  
  const results = {};
  
  // Test core services first (fail fast)
  console.log('🚀 Testing core services (S3, Lambda)...');
  results.s3 = await testS3();
  results.lambda = await testLambda();
  
  // If core services fail, exit immediately
  if (!results.s3 || !results.lambda) {
    console.log('\n❌ Core services (S3, Lambda) failed - stopping tests');
    console.log('\n📊 Quick Connectivity Test Summary:');
    console.log(`S3: ${results.s3 ? '✅ Connected' : '❌ Failed'}`);
    console.log(`Lambda: ${results.lambda ? '✅ Connected' : '❌ Failed'}`);
    console.log('\n⚠️ Please ensure LocalStack is running and accessible at:', endpoint);
    console.log('💡 Try running: docker-compose up -d localstack');
    process.exit(1);
  }
  
  // Test additional services
  console.log('\n🔄 Core services OK - testing additional services...');
  results.stepFunctions = await testStepFunctions();
  results.apiGateway = await testAPIGateway();
  
  console.log('\n📊 Connectivity Test Summary:');
  console.log(`S3: ${results.s3 ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Lambda: ${results.lambda ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Step Functions: ${results.stepFunctions ? '✅ Connected' : '❌ Failed'}`);
  console.log(`API Gateway Sim: ${results.apiGateway ? '✅ Connected' : '❌ Failed'}`);
  
  // Check if critical services are working
  const criticalServices = [results.s3, results.lambda];
  const allCriticalWorking = criticalServices.every(Boolean);
  
  if (!allCriticalWorking) {
    console.log('\n❌ Critical services failed! LocalStack setup issues detected.');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if LocalStack is running: curl http://localhost:4566/_localstack/health');
    console.log('2. Restart LocalStack: docker-compose down && docker-compose up -d');
    console.log('3. Check LocalStack logs: docker-compose logs localstack');
    process.exit(1);
  }
  
  // Warn about non-critical service failures
  if (!results.stepFunctions) {
    console.log('\n⚠️ Step Functions not accessible - some tests may fail');
  }
  
  if (!results.apiGateway) {
    console.log('\n⚠️ API Gateway simulation not running - start with: npm start');
  }
  
  console.log('\n🎉 Critical services are accessible and ready for testing!');
  console.log('✅ LocalStack connectivity verification passed');
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('Error during tests:', err);
  process.exit(1);
});

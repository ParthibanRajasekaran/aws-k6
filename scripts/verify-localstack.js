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
  
  const s3Success = await testS3();
  const lambdaSuccess = await testLambda();
  const sfnSuccess = await testStepFunctions();
  const apiGatewaySuccess = await testAPIGateway();
  
  console.log('\n📊 Connectivity Test Summary:');
  console.log(`S3: ${s3Success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Lambda: ${lambdaSuccess ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Step Functions: ${sfnSuccess ? '✅ Connected' : '❌ Failed'}`);
  console.log(`API Gateway Sim: ${apiGatewaySuccess ? '✅ Connected' : '❌ Failed'}`);
  
  if (!s3Success || !lambdaSuccess || !apiGatewaySuccess) {
    console.log('\n⚠️  Some services are not accessible! Please check your LocalStack setup.');
    process.exit(1);
  } else {
    console.log('\n🎉 All services are accessible and ready for testing!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Error during tests:', err);
  process.exit(1);
});

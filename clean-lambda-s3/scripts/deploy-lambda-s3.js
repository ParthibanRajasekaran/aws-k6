const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Lambda with S3 integration to LocalStack...');

// Configuration
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4566';
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET || 'test-bucket';
const ROLE_NAME = 'lambda-role';
const FUNCTION_NAME = 'test-lambda';

// Ensure environment variables for AWS CLI
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';

// Helper function to run AWS CLI commands
function awsCommand(command) {
  const fullCommand = `aws --endpoint-url=${ENDPOINT} ${command}`;
  console.log(`> ${fullCommand}`);
  try {
    return execSync(fullCommand, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Command failed: ${fullCommand}`);
    console.error(error.stderr || error.message);
    return null;
  }
}

// Check LocalStack health
console.log('🔍 Checking LocalStack health...');
try {
  const healthCheck = execSync(`curl -s ${ENDPOINT}/_localstack/health`, { encoding: 'utf8' });
  console.log('LocalStack health:', JSON.parse(healthCheck).services);
} catch (error) {
  console.error('❌ Error checking LocalStack health:', error.message);
  process.exit(1);
}

// Create IAM role
console.log('👤 Creating IAM role for Lambda...');
try {
  const rolePolicy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'lambda.amazonaws.com'
        },
        Action: 'sts:AssumeRole'
      }
    ]
  });
  
  awsCommand(`iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document '${rolePolicy}'`);
  console.log('✅ IAM role created');
  
  // Create S3 access policy
  console.log('📜 Creating S3 access policy...');
  const s3Policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket'
        ],
        Resource: [
          `arn:aws:s3:::${BUCKET}`,
          `arn:aws:s3:::${BUCKET}/*`
        ]
      }
    ]
  });
  
  awsCommand(`iam create-policy --policy-name s3-access-policy --policy-document '${s3Policy}'`);
  
  // Attach policies to role
  console.log('🔗 Attaching policies to role...');
  awsCommand(`iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn arn:aws:iam::000000000000:policy/s3-access-policy`);
  awsCommand(`iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`);
} catch (error) {
  console.error('❌ Error setting up IAM role:', error.message);
  console.log('⚠️ Continuing with deployment...');
}

// Create S3 bucket
console.log('🪣 Creating S3 bucket...');
awsCommand(`s3 mb s3://${BUCKET}`);
awsCommand(`s3api put-bucket-acl --bucket ${BUCKET} --acl public-read`);

// Package Lambda function
console.log('📦 Packaging Lambda function...');
const lambdaDir = path.resolve(__dirname, '..', 'lambda');
const zipFile = path.resolve(__dirname, '..', 'lambda.zip');

// Remove existing zip if it exists
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

// Create zip with dependencies
try {
  // First, copy package.json to lambda directory if not already there
  const projectPackageJson = path.resolve(__dirname, '..', 'package.json');
  const lambdaPackageJson = path.resolve(lambdaDir, 'package.json');
  
  if (!fs.existsSync(lambdaPackageJson)) {
    console.log('📄 Copying package.json to lambda directory...');
    fs.copyFileSync(projectPackageJson, lambdaPackageJson);
  }
  
  // Install dependencies in the lambda directory
  console.log('📚 Installing Lambda dependencies...');
  execSync('npm install --production', { cwd: lambdaDir });
  
  // Create zip file
  console.log('🗜️ Creating zip file...');
  execSync(`cd ${lambdaDir} && zip -r ${zipFile} .`);
  
  console.log(`✅ Lambda package created at ${zipFile}`);
} catch (error) {
  console.error('❌ Error packaging Lambda:', error.message);
  process.exit(1);
}

// Deploy Lambda function
console.log('🚀 Deploying Lambda function...');
try {
  awsCommand(`lambda delete-function --function-name ${FUNCTION_NAME}`);
} catch (error) {
  // Function may not exist, ignore
}

const deployResult = awsCommand(
  `lambda create-function --function-name ${FUNCTION_NAME} --runtime nodejs20.x --role arn:aws:iam::000000000000:role/${ROLE_NAME} --handler index.handler --zip-file fileb://${zipFile} --environment Variables="{BUCKET=${BUCKET},ENDPOINT=${ENDPOINT},AWS_REGION=${REGION}}"`
);

if (deployResult) {
  console.log('✅ Lambda function deployed successfully!');
  
  // Test Lambda function
  console.log('🧪 Testing Lambda function...');
  
  // Create a test file in S3
  const testPayload = JSON.stringify({
    httpMethod: 'POST',
    body: JSON.stringify({
      filename: 'test.txt',
      content: Buffer.from('Hello from Lambda test!').toString('base64')
    })
  });
  
  // Store the test payload in a temporary file
  const testPayloadPath = path.resolve(__dirname, '..', 'test-payload.json');
  fs.writeFileSync(testPayloadPath, testPayload);
  
  // Invoke Lambda function
  const invokeResult = awsCommand(`lambda invoke --function-name ${FUNCTION_NAME} --payload file://${testPayloadPath} /tmp/lambda-result.json`);
  
  if (invokeResult) {
    console.log('✅ Lambda invocation successful!');
    console.log('Check the S3 bucket for the test file:');
    console.log(`aws --endpoint-url=${ENDPOINT} s3 ls s3://${BUCKET}`);
  } else {
    console.error('❌ Lambda invocation failed!');
  }
  
  // Clean up temporary file
  fs.unlinkSync(testPayloadPath);
} else {
  console.error('❌ Lambda deployment failed!');
  process.exit(1);
}

console.log('🎉 Deployment completed successfully!');


/**
 * Step Functions Integration Tests
 * 
 * Tests the complete Step Functions workflow including:
 * - Lambda function deployment and execution
 * - State machine creation and execution
 * - DynamoDB data persistence
 * 
 * Features:
 * - Async setup/teardown with proper error handling
 * - Timeout management for CI environments  
 * - Resource cleanup with graceful failure handling
 * - Environment variable consistency
 */

const {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
} = require("@aws-sdk/client-sfn");
const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { execSync } = require("child_process");

// Environment configuration - consistent with other tests
const LOCALSTACK_HOST = process.env.LOCALSTACK_HOST || 'localhost';
const LOCALSTACK_ENDPOINT = process.env.ENDPOINT || `http://${LOCALSTACK_HOST}:4566`;
const REGION = process.env.AWS_REGION || 'us-east-1';

const sfnClient = new SFNClient({
  region: REGION,
  endpoint: LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  },
  maxAttempts: 5,
  retryMode: 'adaptive'
});

const dynamoDBClient = new DynamoDBClient({
  region: REGION,
  endpoint: LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  },
  maxAttempts: 5,
  retryMode: 'adaptive'
});

const STATE_MACHINE_ARN =
  "arn:aws:states:us-east-1:000000000000:stateMachine:MyStateMachine";

describe("Step Functions Integration Test", () => {
  beforeAll(async () => {
    console.log('🚀 Setting up Step Functions workflow...');
    console.log(`LocalStack endpoint: ${LOCALSTACK_ENDPOINT}`);
    console.log(`Region: ${REGION}`);
    
    try {
      // Deploy the step function and lambdas with extended timeout
      execSync("node scripts/deploy-workflow.js", { 
        stdio: "inherit",
        timeout: 180000, // 3 minutes timeout
        env: { ...process.env, ENDPOINT: LOCALSTACK_ENDPOINT, AWS_REGION: REGION }
      });
      console.log('✅ Step Functions workflow deployed successfully');
    } catch (error) {
      console.error('❌ Failed to deploy Step Functions workflow:', error.message);
      throw error;
    }
  }, 120000); // 2 minute timeout for beforeAll

  afterAll(async () => {
    console.log('🧹 Cleaning up Step Functions resources...');
    try {
      // Cleanup resources with error handling for missing resources
      execSync("node scripts/cleanup-workflow.js", { 
        stdio: "inherit",
        timeout: 60000, // 1 minute timeout
        env: { ...process.env, ENDPOINT: LOCALSTACK_ENDPOINT, AWS_REGION: REGION }
      });
      console.log('✅ Step Functions cleanup completed successfully');
    } catch (error) {
      // Log warning but don't fail the test if cleanup fails
      console.warn('⚠️ Cleanup encountered issues (this may be expected):', error.message);
    }
    
    // Close AWS SDK clients to prevent hanging connections
    if (sfnClient) {
      console.log('Closing Step Functions client...');
      sfnClient.destroy();
    }
    
    if (dynamoDBClient) {
      console.log('Closing DynamoDB client...');
      dynamoDBClient.destroy();
    }
    
    // Add delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Step Functions test cleanup completed');
  }, 30000); // 30 second timeout for afterAll

  it("should execute the state machine successfully and save data to DynamoDB", async () => {
    console.log('🚀 Starting Step Functions execution test...');
    
    const input = {
      inputValue: 123,
    };

    console.log('📤 Starting state machine execution...');
    const startExecutionCommand = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify(input),
    });

    const { executionArn } = await sfnClient.send(startExecutionCommand);
    console.log(`✅ Execution started: ${executionArn}`);

    let status = "RUNNING";
    let output;
    let attempts = 0;
    const maxAttempts = 30; // Maximum 30 attempts (30 seconds)

    console.log('⏳ Waiting for execution to complete...');
    while (status === "RUNNING" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      
      try {
        const describeExecutionCommand = new DescribeExecutionCommand({
          executionArn,
        });
        const executionDetails = await sfnClient.send(describeExecutionCommand);
        status = executionDetails.status;
        
        console.log(`📊 Execution status check ${attempts}/${maxAttempts}: ${status}`);
        
        if (status === "SUCCEEDED") {
          output = JSON.parse(executionDetails.output);
          console.log('🎉 Execution completed successfully!');
        } else if (status === "FAILED" || status === "TIMED_OUT" || status === "ABORTED") {
          console.error(`❌ Execution failed with status: ${status}`);
          if (executionDetails.error) {
            console.error(`Error details: ${executionDetails.error}`);
          }
          throw new Error(`Execution failed with status: ${status}`);
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          console.error(`❌ Failed to get execution status after ${maxAttempts} attempts`);
          throw error;
        }
        console.warn(`⚠️ Temporary error getting execution status (attempt ${attempts}): ${error.message}`);
      }
    }
    
    if (status === "RUNNING") {
      throw new Error(`Execution timed out after ${maxAttempts} seconds`);
    }

    // Verify execution results
    console.log('🔍 Verifying execution results...');
    expect(status).toBe("SUCCEEDED");
    expect(output.validated).toBe(true);
    expect(output.processedValue).toBe(246);
    expect(output.dbStatus).toBe("Saved");

    // Verify data in DynamoDB
    console.log('🗃️ Verifying data was saved to DynamoDB...');
    const queryCommand = new QueryCommand({
      TableName: "workflow-results",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": { S: output.id },
      },
    });

    const { Items } = await dynamoDBClient.send(queryCommand);
    expect(Items.length).toBe(1);
    const savedItem = JSON.parse(Items[0].input.S);
    expect(savedItem.processedValue).toBe(246);
    
    console.log('✅ Step Functions test completed successfully!');
  }, 60000); // Increased timeout to 60 seconds
});

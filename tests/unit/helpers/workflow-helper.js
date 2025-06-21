/**
 * End-to-end test helper for executing the Step Function workflow locally
 * Tests the complete workflow with mocked AWS services
 */

const path = require('path');

// Mock the AWS SDK v3 modules
jest.mock('@aws-sdk/client-dynamodb', () => {
  // Mock implementation of DynamoDBClient
  const mockSend = jest.fn().mockResolvedValue({});
  
  return {
    DynamoDBClient: jest.fn(() => ({
      send: mockSend
    })),
    PutItemCommand: jest.fn((params) => ({
      input: params
    }))
  };
});

/**
 * Execute the Step Function workflow locally
 * @param {Object} initialInput The initial input to the workflow
 * @returns {Object} The final result of the workflow
 */
async function executeWorkflowLocally(initialInput) {
  // Dynamic import the Lambda functions
  const lambda1 = require(path.join(process.cwd(), 'lambda1/index'));
  const lambda2 = require(path.join(process.cwd(), 'lambda2/index'));
  const lambda3 = require(path.join(process.cwd(), 'lambda3/index'));

  try {
    // Capture console logs for testing
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Execute the workflow manually
    console.log('Starting local workflow execution');
    console.log('Input:', initialInput);
    
    // Step 1: ValidateInput (lambda1)
    const step1Result = await lambda1.handler(initialInput);
    console.log('Step 1 result:', step1Result);

    // Step 2: ProcessData (lambda2)
    const step2Result = await lambda2.handler(step1Result);
    console.log('Step 2 result:', step2Result);

    // Step 3: SaveToDB (lambda3)
    const step3Result = await lambda3.handler(step2Result);
    console.log('Step 3 result:', step3Result);

    // Restore console logs
    consoleLogSpy.mockRestore();
    
    return step3Result;
  } catch (error) {
    console.error('Workflow execution failed:', error);
    throw error;
  }
}

module.exports = {
  executeWorkflowLocally
};

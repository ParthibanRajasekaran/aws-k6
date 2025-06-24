
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

const sfnClient = new SFNClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
});
const dynamoDBClient = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
});

const STATE_MACHINE_ARN =
  "arn:aws:states:us-east-1:000000000000:stateMachine:MyStateMachine";

describe("Step Functions Integration Test", () => {
  beforeAll(() => {
    // Deploy the step function and lambdas
    execSync("node scripts/deploy-workflow.js");
  });

  afterAll(() => {
    // Cleanup resources
    execSync("node scripts/cleanup-workflow.js");
  });

  it("should execute the state machine successfully and save data to DynamoDB", async () => {
    const input = {
      inputValue: 123,
    };

    const startExecutionCommand = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify(input),
    });

    const { executionArn } = await sfnClient.send(startExecutionCommand);

    let status = "RUNNING";
    let output;

    while (status === "RUNNING") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const describeExecutionCommand = new DescribeExecutionCommand({
        executionArn,
      });
      const executionDetails = await sfnClient.send(describeExecutionCommand);
      status = executionDetails.status;
      if (status === "SUCCEEDED") {
        output = JSON.parse(executionDetails.output);
      } else if (status === "FAILED" || status === "TIMED_OUT" || status === "ABORTED") {
        throw new Error(`Execution failed with status: ${status}`);
      }
    }

    expect(status).toBe("SUCCEEDED");
    expect(output.validated).toBe(true);
    expect(output.processedValue).toBe(246);
    expect(output.dbStatus).toBe("Saved");

    // Verify data in DynamoDB
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
  }, 30000);
});

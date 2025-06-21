require("dotenv").config();
const minimist = require("minimist");

const {
  LambdaClient,
  DeleteFunctionCommand,
} = require("@aws-sdk/client-lambda");
const {
  DynamoDBClient,
  DeleteTableCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  SFNClient,
  ListStateMachinesCommand,
  DeleteStateMachineCommand,
} = require("@aws-sdk/client-sfn");

const args = minimist(process.argv.slice(2));

const region = process.env.REGION || "us-east-1";
const endpoint = process.env.ENDPOINT || "http://localhost:4566";
const stepFunctionName = process.env.STEP_FUNCTION_NAME || "ThreeStepWorkflow";

const credentials = {
  accessKeyId: "test",
  secretAccessKey: "test",
};

const lambdaClient = new LambdaClient({ region, endpoint, credentials });
const dynamoClient = new DynamoDBClient({ region, endpoint, credentials });
const sfnClient = new SFNClient({ region, endpoint, credentials });

const LAMBDAS = ["lambda1", "lambda2", "lambda3"];
const TABLE_NAME = "workflow-results";

async function deleteLambdas() {
  for (const name of LAMBDAS) {
    console.log(`🗑️  Deleting Lambda: ${name}`);
    try {
      await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: name }));
    } catch (err) {
      if (err.name === "ResourceNotFoundException") {
        console.warn(`⚠️  Lambda ${name} not found, skipping.`);
      } else {
        throw err;
      }
    }
  }
}

async function deleteDynamoTable() {
  console.log(`🗑️  Deleting DynamoDB table: ${TABLE_NAME}`);
  try {
    await dynamoClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.warn(`⚠️  Table ${TABLE_NAME} not found, skipping.`);
    } else {
      throw err;
    }
  }
}

async function deleteStateMachine() {
  console.log(`🗑️  Deleting Step Function: ${stepFunctionName}`);

  const result = await sfnClient.send(new ListStateMachinesCommand({}));
  const sm = result.stateMachines.find((m) => m.name === stepFunctionName);

  if (sm) {
    await sfnClient.send(
      new DeleteStateMachineCommand({ stateMachineArn: sm.stateMachineArn })
    );
    console.log(`✅ Step Function deleted: ${sm.stateMachineArn}`);
  } else {
    console.log("⚠️  Step Function not found, skipping.");
  }
}

(async () => {
  try {
    if (!args["skip-lambdas"]) await deleteLambdas();
    else console.log("⏭️  Skipping Lambda deletion");

    if (!args["skip-dynamo"]) await deleteDynamoTable();
    else console.log("⏭️  Skipping DynamoDB deletion");

    if (!args["skip-stepfn"]) await deleteStateMachine();
    else console.log("⏭️  Skipping Step Function deletion");

    console.log("✅ Cleanup complete.");
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message);
  }
})();

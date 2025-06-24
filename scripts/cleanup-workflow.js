require("dotenv").config();
const minimist = require("minimist");
const { execSync } = require("child_process");

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

const cleanup = () => {
  console.log("Cleaning up Step Functions workflow...");
  try {
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 stepfunctions delete-state-machine --state-machine-arn arn:aws:states:us-east-1:000000000000:stateMachine:MyStateMachine", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda1", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda2", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda3", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 dynamodb delete-table --table-name workflow-results", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam detach-role-policy --role-name lambda-ex --policy-arn arn:aws:iam::000000000000:policy/DynamoDBWritePolicy", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-policy --policy-arn arn:aws:iam::000000000000:policy/DynamoDBWritePolicy", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-role --role-name lambda-ex", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam detach-role-policy --role-name StepFunctionsRole --policy-arn arn:aws:iam::000000000000:policy/LambdaInvokePolicy", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-policy --policy-arn arn:aws:iam::000000000000:policy/LambdaInvokePolicy", { stdio: "inherit" });
    execSync("aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-role --role-name StepFunctionsRole", { stdio: "inherit" });
    console.log("Cleanup successful.");
  } catch (error) {
    console.error("Cleanup failed:", error);
    // Do not exit with error code, as some resources might have been already deleted
  }
};

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
  cleanup();
})();

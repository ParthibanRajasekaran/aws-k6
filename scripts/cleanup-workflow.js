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

const cleanup = async () => {
  console.log("🧹 Cleaning up Step Functions workflow...");
  
  const cleanupCommands = [
    {
      name: "Delete State Machine",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 stepfunctions delete-state-machine --state-machine-arn arn:aws:states:us-east-1:000000000000:stateMachine:MyStateMachine"
    },
    {
      name: "Delete Lambda Function 1",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda1"
    },
    {
      name: "Delete Lambda Function 2", 
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda2"
    },
    {
      name: "Delete Lambda Function 3",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda delete-function --function-name lambda3"
    },
    {
      name: "Delete DynamoDB Table",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 dynamodb delete-table --table-name workflow-results"
    },
    {
      name: "Detach DynamoDB Policy from Lambda Role",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam detach-role-policy --role-name lambda-ex --policy-arn arn:aws:iam::000000000000:policy/DynamoDBWritePolicy"
    },
    {
      name: "Delete DynamoDB Policy",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-policy --policy-arn arn:aws:iam::000000000000:policy/DynamoDBWritePolicy"
    },
    {
      name: "Delete Lambda Role",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-role --role-name lambda-ex"
    },
    {
      name: "Detach Lambda Invoke Policy from Step Functions Role", 
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam detach-role-policy --role-name StepFunctionsRole --policy-arn arn:aws:iam::000000000000:policy/LambdaInvokePolicy"
    },
    {
      name: "Delete Lambda Invoke Policy",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-policy --policy-arn arn:aws:iam::000000000000:policy/LambdaInvokePolicy"
    },
    {
      name: "Delete Step Functions Role",
      command: "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam delete-role --role-name StepFunctionsRole"
    }
  ];

  let successCount = 0;
  let warningCount = 0;

  for (const { name, command } of cleanupCommands) {
    try {
      console.log(`🗑️ ${name}...`);
      execSync(command, { stdio: "pipe" }); // Use pipe to suppress output
      console.log(`✅ ${name} completed`);
      successCount++;
    } catch (error) {
      // Most cleanup errors are expected (resources already deleted)
      console.warn(`⚠️ ${name} failed (resource may not exist): ${error.message.split('\n')[0]}`);
      warningCount++;
    }
  }
  
  console.log(`📊 Cleanup summary: ${successCount} successful, ${warningCount} warnings`);
  console.log("✅ Cleanup process completed");
};

(async () => {
  try {
    if (!args["skip-lambdas"]) await deleteLambdas();
    else console.log("⏭️  Skipping Lambda deletion");

    if (!args["skip-dynamo"]) await deleteDynamoTable();
    else console.log("⏭️  Skipping DynamoDB deletion");

    if (!args["skip-stepfn"]) await deleteStateMachine();
    else console.log("⏭️  Skipping Step Function deletion");

    console.log("✅ SDK-based cleanup complete.");
  } catch (err) {
    console.error("❌ SDK-based cleanup failed:", err.message);
  }
  
  // Run additional AWS CLI cleanup to ensure everything is cleaned up
  await cleanup();
})();

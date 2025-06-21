const {
  LambdaClient,
  CreateFunctionCommand,
} = require("@aws-sdk/client-lambda");
const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  SFNClient,
  CreateStateMachineCommand,
  StartExecutionCommand,
} = require("@aws-sdk/client-sfn");
const { readFileSync, existsSync, unlinkSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const minimist = require("minimist");

const args = minimist(process.argv.slice(2));

// LocalStack configuration
const endpoint = "http://localhost:4566";
const region = "us-east-1";
const credentials = {
  accessKeyId: "test",
  secretAccessKey: "test",
};

const lambdaClient = new LambdaClient({ region, endpoint, credentials });
const dynamoClient = new DynamoDBClient({ region, endpoint, credentials });
const sfnClient = new SFNClient({ region, endpoint, credentials });

// Lambda function definitions
const LAMBDAS = [
  { name: "lambda1", handler: "index.handler", path: "./lambda1" },
  { name: "lambda2", handler: "index.handler", path: "./lambda2" },
  { name: "lambda3", handler: "index.handler", path: "./lambda3" },
];

// Deploy Lambda functions
async function deployLambdas() {
  console.log("📦 Deploying Lambda functions...");
  for (const { name, handler, path: lambdaPath } of LAMBDAS) {
    const zipPath = path.resolve(__dirname, "..", `${name}.zip`);

    if (!existsSync(zipPath)) {
      console.log(`  ➤ Zipping ${name}...`);
      execSync(`cd ${lambdaPath} && zip -r ../${name}.zip .`);
    } else {
      console.log(`  ➤ Using existing zip for ${name}`);
    }

    const zipFile = readFileSync(zipPath);
    console.log(`  ➤ Creating Lambda ${name}...`);

    try {
      await lambdaClient.send(
        new CreateFunctionCommand({
          FunctionName: name,
          Runtime: "nodejs18.x",
          Role: "arn:aws:iam::000000000000:role/fake-role",
          Handler: handler,
          Code: { ZipFile: zipFile },
          Publish: true,
        })
      );
      console.log(`    ✅ ${name} deployed`);
    } catch (err) {
      if (err.name === "ResourceConflictException") {
        console.log(`    ⚠️ ${name} already exists, skipping`);
      } else {
        throw err;
      }
    }

    // Cleanup
    if (existsSync(zipPath)) {
      unlinkSync(zipPath);
      console.log(`    🧹 Cleaned up ${name}.zip`);
    }
  }
}

// Create DynamoDB table
async function createDynamoDB() {
  console.log("\n🗄️  Creating DynamoDB table...");
  try {
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: "workflow-results",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      })
    );
    console.log("    ✅ DynamoDB table created");
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("    ⚠️ Table already exists, skipping");
    } else {
      throw err;
    }
  }
}

// Deploy Step Function
async function deployStepFunction() {
  console.log("\n🔁 Deploying Step Function...");
  const definition = readFileSync(
    path.resolve(__dirname, "..", "state-machine-definition.json"),
    "utf-8"
  );

  try {
    await sfnClient.send(
      new CreateStateMachineCommand({
        name: "ThreeStepWorkflow",
        definition,
        roleArn: "arn:aws:iam::000000000000:role/fake-role",
        type: "STANDARD",
      })
    );
    console.log("    ✅ Step Function created");
  } catch (err) {
    if (err.name === "StateMachineAlreadyExists") {
      console.log("    ⚠️ Step Function already exists, skipping");
    } else {
      throw err;
    }
  }
}

// Start Step Function execution (optional)
async function startExecution() {
  console.log("\n🚀 Starting Step Function execution...");
  try {
    const result = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn:
          "arn:aws:states:us-east-1:000000000000:stateMachine:ThreeStepWorkflow",
        input: JSON.stringify({ inputValue: 21 }),
      })
    );
    console.log("    ✅ Execution started:", result.executionArn);
  } catch (err) {
    console.error("    ❌ Failed to start execution:", err.message);
    console.error(err.stack);
  }
}

// Main run
(async () => {
  try {
    await deployLambdas();

    if (!args["skip-dynamo"]) {
      await createDynamoDB();
    } else {
      console.log("⏭️  Skipping DynamoDB creation");
    }

    await deployStepFunction();

    if (!args["skip-execution"]) {
      await startExecution();
    } else {
      console.log("⏭️  Skipping Step Function execution");
    }

    console.log("\n🎉 All resources deployed successfully.");
    console.log("🧭 View dashboard: http://localhost:4000");
  } catch (err) {
    console.error("\n❌ Deployment failed:", err.message);
    console.error(err.stack);
  }
})();

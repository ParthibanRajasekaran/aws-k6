require("dotenv").config(); // Load .env variables
const minimist = require("minimist");
const { readFileSync, existsSync, unlinkSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");
const { LambdaClient, CreateFunctionCommand } = require("@aws-sdk/client-lambda");

// Load CLI args
const args = minimist(process.argv.slice(2));

// Load env
const region = process.env.REGION || "us-east-1";
const endpoint = process.env.ENDPOINT || "http://localhost:4566";
const bucketName = process.env.BUCKET || "test-bucket";
const skipBucketCreation =
  args["no-bucket"] || process.env.SKIP_BUCKET_CREATION === "true";
const skipLambdaDeploy =
  args["no-lambda"] || process.env.SKIP_LAMBDA_DEPLOY === "true";

const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const lambdaClient = new LambdaClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

async function createBucket() {
  try {
    console.log(`Creating bucket: ${bucketName}`);
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log("✅ S3 bucket created successfully");
  } catch (error) {
    if (
      error.name === "BucketAlreadyExists" ||
      error.name === "BucketAlreadyOwnedByYou"
    ) {
      console.log("✅ Bucket already exists");
    } else {
      console.error("❌ Error creating bucket:", error);
      throw error;
    }
  }
}

async function deployLambda() {
  const lambdaPath = path.resolve(__dirname, "..", "lambda");
  const zipPath = path.resolve(__dirname, "..", "lambda.zip");
  
  try {
    console.log("📦 Creating Lambda deployment package...");
    
    // Create zip file
    if (!existsSync(zipPath)) {
      console.log("  ➤ Zipping Lambda function...");
      execSync(`cd ${lambdaPath} && zip -r ../lambda.zip .`);
    } else {
      console.log("  ➤ Using existing Lambda zip");
    }

    const zipFile = readFileSync(zipPath);
    console.log("  ➤ Deploying Lambda function...");

    await lambdaClient.send(
      new CreateFunctionCommand({
        FunctionName: "test-lambda",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/fake-role",
        Handler: "index.handler",
        Code: { ZipFile: zipFile },
        Publish: true,
        Environment: {
          Variables: {
            BUCKET: bucketName,
            ENDPOINT: endpoint,
            AWS_REGION: region,
          },
        },
      })
    );
    
    console.log("✅ Lambda function deployed successfully");
    
    // Cleanup zip file
    if (existsSync(zipPath)) {
      unlinkSync(zipPath);
      console.log("🧹 Cleaned up deployment package");
    }
    
  } catch (error) {
    if (error.name === "ResourceConflictException") {
      console.log("✅ Lambda function already exists");
    } else {
      console.error("❌ Error deploying Lambda:", error);
      throw error;
    }
  }
}

(async () => {
  try {
    if (!skipBucketCreation) {
      await createBucket();
    } else {
      console.log("⏭️  Skipping bucket creation as requested");
    }

    if (!skipLambdaDeploy) {
      await deployLambda();
    } else {
      console.log("⏭️  Skipping Lambda deployment as requested");
    }

    console.log("✅ Setup complete.");
  } catch (err) {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  }
})();

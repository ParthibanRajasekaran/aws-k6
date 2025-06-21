require("dotenv").config(); // Load .env variables
const minimist = require("minimist");

const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");

// Load CLI args
const args = minimist(process.argv.slice(2));

// Load env
const region = process.env.REGION || "us-east-1";
const endpoint = process.env.ENDPOINT || "http://localhost:4566";
const bucketName = process.env.BUCKET || "test-bucket";
const skipBucketCreation =
  args["no-bucket"] || process.env.SKIP_BUCKET_CREATION === "true";

const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
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

(async () => {
  try {
    if (!skipBucketCreation) {
      await createBucket();
    } else {
      console.log("⏭️  Skipping bucket creation as requested");
    }

    console.log("✅ Setup complete.");
  } catch (err) {
    console.error("❌ Setup failed:", err);
  }
})();

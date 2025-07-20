

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Create S3 client with configuration that reads environment at runtime
 */
function createS3Client() {
  // Create S3 client configuration
  const s3Config = {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    forcePathStyle: true, // Required for LocalStack
  };

  // Set endpoint for LocalStack
  if (process.env.AWS_ENDPOINT_URL) {
    s3Config.endpoint = process.env.AWS_ENDPOINT_URL;
  }

  // Set credentials explicitly for LocalStack or when provided
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }

  console.log('S3 Client Configuration:', {
    region: s3Config.region,
    endpoint: s3Config.endpoint || 'default AWS',
    hasCredentials: !!s3Config.credentials,
    accessKeyId: s3Config.credentials?.accessKeyId || 'default'
  });

  return new S3Client(s3Config);
}

/**
 * Put object to S3
 */
async function putObjectToS3(bucket, key, body) {
  const s3Client = createS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  });
  await s3Client.send(command);
}

module.exports = { putObjectToS3 };



const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Create S3 client with LocalStack endpoint if specified
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL || undefined,
  forcePathStyle: true, // Required for LocalStack
  credentials: process.env.AWS_ENDPOINT_URL ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  } : undefined
});

/**
 * Put object to S3
 */
async function putObjectToS3(bucket, key, body) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  });
  await s3Client.send(command);
}

module.exports = { putObjectToS3 };

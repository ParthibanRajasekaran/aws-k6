

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Always use LocalStack endpoint if running locally or in SAM

let endpoint = process.env.AWS_ENDPOINT_URL;
if (!endpoint) {
  if (process.env.AWS_SAM_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === true) {
    endpoint = 'http://host.docker.internal:4566';
  } else if (process.env.LOCALSTACK_HOSTNAME) {
    endpoint = `http://${process.env.LOCALSTACK_HOSTNAME}:4566`;
  } else {
    endpoint = 'http://localhost:4566';
  }
}

const s3Client = new S3Client({
  endpoint,
  forcePathStyle: true,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
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

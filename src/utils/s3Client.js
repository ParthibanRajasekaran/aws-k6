
const AWS = require('aws-sdk');

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

const s3 = new AWS.S3({
  endpoint,
  s3ForcePathStyle: true,
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
});

/**
 * Put object to S3
 */
async function putObjectToS3(bucket, key, body) {
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  }).promise();
}

module.exports = { putObjectToS3 };

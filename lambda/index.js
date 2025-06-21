const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const LRU = require('lru-cache');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.BUCKET || 'test-bucket';

// Configure connection pooling for S3 client
const s3Client = new S3Client({
  region: REGION,
  endpoint: process.env.ENDPOINT || (process.env.LOCALSTACK_HOST ? `http://${process.env.LOCALSTACK_HOST}:4566` : 'http://localhost:4566'),
  forcePathStyle: true,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  maxConnections: 50,  // Increase max connections
  retryMode: 'standard',
  maxAttempts: 3, // Add retry capability
});

// Add caching for frequently accessed files
const cache = new LRU.LRUCache({
  max: 500,                    // Store max 500 items
  ttl: 1000 * 60 * 5,         // Items expire in 5 minutes
  updateAgeOnGet: true,        // Reset TTL on access
  // Use proper size calculation for LRU-cache v7+
  sizeCalculation: (value) => {
    // Calculate size of cached content (base64 encoded)
    return value ? value.length : 1;
  },
  maxSize: 50 * 1024 * 1024   // 50MB total size
});

// Optimize buffer handling
const streamToBuffer = async (stream) => {
  if (stream instanceof Buffer) return stream;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'POST') {
      const { filename, content } = JSON.parse(event.body);
      if (!filename || !content) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing filename or content' })
        };
      }

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: filename,
        Body: Buffer.from(content, 'base64'),
        ContentType: 'application/octet-stream'
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'File uploaded', filename })
      };
    }

    if (event.httpMethod === 'GET') {
      const filename = event.queryStringParameters?.filename;
      if (!filename) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing filename parameter' })
        };
      }

      // Check cache first
      const cachedFile = cache.get(filename);
      if (cachedFile) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, content: cachedFile })
        };
      }

      const { Body } = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: filename
      }));

      const buffer = await streamToBuffer(Body);
      const content = buffer.toString('base64');

      // Update cache with new file
      cache.set(filename, content);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content })
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.$metadata?.httpStatusCode || 500,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        code: error.name
      })
    };
  }
};

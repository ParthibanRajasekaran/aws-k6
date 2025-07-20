


/**
 * Lambda handler for both API Gateway and direct invocation
 */

function makeHandler(groceryService = require('../services/groceryService')) {
  return async (event) => {
    console.log('Lambda Environment Variables:');
    console.log('AWS_REGION:', process.env.AWS_REGION);
    console.log('AWS_DEFAULT_REGION:', process.env.AWS_DEFAULT_REGION);
    console.log('AWS_ENDPOINT_URL:', process.env.AWS_ENDPOINT_URL);
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '[SET]' : '[NOT SET]');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '[SET]' : '[NOT SET]');
    console.log('GROCERY_BUCKET:', process.env.GROCERY_BUCKET);

    // Test network connectivity to LocalStack
    if (process.env.AWS_ENDPOINT_URL) {
      try {
        const https = require('http');
        const url = new URL(process.env.AWS_ENDPOINT_URL);
        console.log(`Testing connectivity to LocalStack at ${process.env.AWS_ENDPOINT_URL}...`);
        const req = https.get(`${process.env.AWS_ENDPOINT_URL}/_localstack/health`, (res) => {
          console.log('LocalStack connectivity test - Status:', res.statusCode);
        });
        req.on('error', (err) => {
          console.log('LocalStack connectivity test failed:', err.message);
        });
        req.setTimeout(2000, () => {
          req.destroy();
          console.log('LocalStack connectivity test timed out');
        });
      } catch (err) {
        console.log('Error testing LocalStack connectivity:', err.message);
      }
    }

    // Health check: respond to GET /grocery
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', message: 'Grocery API is healthy' })
      };
    }
    let items;
    // Support both API Gateway and direct Lambda invocation
    if (event.body) {
      // API Gateway
      items = JSON.parse(event.body).items;
    } else {
      // Direct Lambda
      items = event.items;
    }
    if (!Array.isArray(items)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input: items must be an array' })
      };
    }
    try {
      const s3Key = await groceryService.storeGroceryList(items);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Grocery list stored successfully', s3Key })
      };
    } catch (err) {
      console.log('Handler caught error:', err);
      // If error is already a response, return it (for test mocks)
      if (err && err.isMockResponse) {
        return err.response;
      }
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to store grocery list', error: err.message })
      };
    }
  };
}

exports.handler = makeHandler();
exports.makeHandler = makeHandler;

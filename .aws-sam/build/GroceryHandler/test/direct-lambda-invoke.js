// Direct Lambda invocation test for groceryHandler
const { makeHandler } = require('../src/lambda/groceryHandler');

async function run() {
  const handler = makeHandler();
  const event = { items: ['apple', 'banana', 'carrot'] };
  const res = await handler(event);
  console.log('Lambda direct invocation result:', res);
  if (res.statusCode === 200 && JSON.parse(res.body).s3Key) {
    console.log('✅ Lambda direct invocation succeeded.');
    process.exit(0);
  } else {
    console.error('❌ Lambda direct invocation failed:', res);
    process.exit(1);
  }
}

run();

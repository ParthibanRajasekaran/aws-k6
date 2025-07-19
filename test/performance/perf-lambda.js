import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export let options = {
  vus: 10,
  duration: '10s',
};

const lambda = new LambdaClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

export default async function () {
  const input = { items: ['apple', 'banana', 'carrot'] };
  const command = new InvokeCommand({
    FunctionName: 'groceryHandler',
    Payload: Buffer.from(JSON.stringify(input)),
  });
  const res = await lambda.send(command);
  check(res, {
    'status is 200': (r) => r.StatusCode === 200,
  });
  sleep(1);
}

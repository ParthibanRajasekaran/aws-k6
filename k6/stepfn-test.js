import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// --- Simple .env loader (using built-in open()) ---
function loadEnv(path) {
  const content = open(path);
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .reduce((env, line) => {
      const idx = line.indexOf('=');
      env[line.slice(0, idx)] = line.slice(idx + 1);
      return env;
    }, {});
}

const env = loadEnv('../.env');

// Pick up your settings
const REGION         = env.REGION            || 'us-east-1';
const ENDPOINT       = env.ENDPOINT          || 'http://localhost:4566';
const SFN_ARN        = env.SFN_ARN 
  || `arn:aws:states:${REGION}:000000000000:stateMachine:${env.STEP_FUNCTION_NAME}`;
const SKIP_EXECUTION = env.SKIP_EXECUTION === 'true';

// k6 config
export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    execution_time:    ['p(95)<5000'],
    failed_executions: ['rate<0.01'],
  },
};

// Metrics
const executionTime    = new Trend('execution_time');
const failedExecutions = new Counter('failed_executions');

export default function () {
  if (SKIP_EXECUTION) {
    return;
  }

  // 1) StartExecution
  const startBody = JSON.stringify({
    stateMachineArn: SFN_ARN,
    input:            JSON.stringify({ user: __VU, ts: Date.now() }),
  });
  const startHeaders = {
    // THIS Host header is required for LocalStack routing:
    'Host':           `states.${REGION}.amazonaws.com`,
    'Content-Type':   'application/x-amz-json-1.0',
    'X-Amz-Target':   'AWSStepFunctions.StartExecution',
  };
  const startRes = http.post(ENDPOINT, startBody, { headers: startHeaders });
  if (startRes.status !== 200) {
    failedExecutions.add(1);
    return;
  }
  check(startRes, { 'started execution': (r) => r.status === 200 });

  const executionArn = startRes.json('executionArn');

  // 2) Poll DescribeExecution
  const descBody    = JSON.stringify({ executionArn });
  const descHeaders = {
    'Host':           `states.${REGION}.amazonaws.com`,
    'Content-Type':   'application/x-amz-json-1.0',
    'X-Amz-Target':   'AWSStepFunctions.DescribeExecution',
  };

  let status;
  do {
    const descRes = http.post(ENDPOINT, descBody, { headers: descHeaders });
    if (descRes.status !== 200) {
      failedExecutions.add(1);
      break;
    }
    const data = descRes.json();
    status = data.status;

    if (status === 'RUNNING') {
      sleep(0.2);
    } else {
      if (data.startDate && data.stopDate) {
        const ms = Date.parse(data.stopDate) - Date.parse(data.startDate);
        executionTime.add(ms);
      } else {
        failedExecutions.add(1);
      }
    }
  } while (status === 'RUNNING');
}

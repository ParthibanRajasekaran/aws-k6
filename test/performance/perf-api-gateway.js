import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '10s',
};

export default function () {
  const url = 'http://localhost:3000/grocery';
  const payload = JSON.stringify({ items: ['apple', 'banana', 'carrot'] });
  const params = { headers: { 'Content-Type': 'application/json' } };
  let res = http.post(url, payload, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has s3Key': (r) => JSON.parse(r.body).s3Key !== undefined,
  });
  sleep(1);
}

import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test - sudden increase in load
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Normal load: 10 users
    { duration: '30s', target: 100 }, // Spike: 100 users
    { duration: '1m', target: 100 },  // Stay at spike
    { duration: '30s', target: 10 },  // Back to normal
    { duration: '1m', target: 10 },   // Stay normal
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Allow higher latency during spike
    http_req_failed: ['rate<0.10'],     // Allow 10% error rate during spike
  },
};

const BASE_URL = __ENV.APP_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_USER_EMAIL || 'peter.kirby85@gmail.com';
const TEST_PASSWORD = __ENV.TEST_USER_PASSWORD || 'BeynacCastle2!';

export function setup() {
  // Login to get authentication token
  const loginRes = http.post(`${BASE_URL}/api/auth`, JSON.stringify({
    action: 'login',
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    if (body.success && body.token) {
      return { token: body.token };
    }
  }
  
  throw new Error('Failed to authenticate in setup');
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Mix of different API calls
  const endpoints = [
    { method: 'GET', url: `${BASE_URL}/api/user`, name: 'GetUser' },
    { method: 'GET', url: `${BASE_URL}/api/credits`, name: 'GetCredits' },
    { method: 'GET', url: `${BASE_URL}/api/scan-history`, name: 'GetScanHistory' },
    { method: 'GET', url: `${BASE_URL}/api/backlog`, name: 'GetBacklog' },
    { method: 'GET', url: `${BASE_URL}/api/issues-board`, name: 'GetIssuesBoard' },
  ];

  // Randomly select an endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(endpoint.url, {
    headers: headers,
    tags: { name: endpoint.name },
  });

  check(res, {
    [`${endpoint.name} status is 200`]: (r) => r.status === 200,
  });

  sleep(1);
}


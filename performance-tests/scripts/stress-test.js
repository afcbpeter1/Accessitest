import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress test - gradually increase load until breaking point
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Start with 10 users
    { duration: '1m', target: 20 },   // Increase to 20
    { duration: '1m', target: 30 },   // Increase to 30
    { duration: '1m', target: 40 },   // Increase to 40
    { duration: '1m', target: 50 },   // Increase to 50
    { duration: '2m', target: 50 },   // Stay at 50 to see stability
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Higher threshold for stress test
    http_req_failed: ['rate<0.20'],   // Allow up to 20% failure during stress
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

  // Test multiple endpoints in sequence
  const userRes = http.get(`${BASE_URL}/api/user`, {
    headers: headers,
    tags: { name: 'GetUser' },
  });

  check(userRes, {
    'get user status is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  const creditsRes = http.get(`${BASE_URL}/api/credits`, {
    headers: headers,
    tags: { name: 'GetCredits' },
  });

  check(creditsRes, {
    'get credits status is 200': (r) => creditsRes.status === 200,
  });

  sleep(0.5);

  const backlogRes = http.get(`${BASE_URL}/api/backlog`, {
    headers: headers,
    tags: { name: 'GetBacklog' },
  });

  check(backlogRes, {
    'get backlog status is 200': (r) => backlogRes.status === 200,
  });

  sleep(1);
}


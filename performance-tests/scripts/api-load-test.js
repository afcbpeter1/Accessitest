import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const apiSuccessRate = new Rate('api_success');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m', target: 5 },     // Stay at 5 users
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    api_success: ['rate>0.95'],
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

  // Test 1: Get User Info
  const userRes = http.get(`${BASE_URL}/api/user`, {
    headers: headers,
    tags: { name: 'GetUser' },
  });

  check(userRes, {
    'get user status is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // Test 2: Get Credits
  const creditsRes = http.get(`${BASE_URL}/api/credits`, {
    headers: headers,
    tags: { name: 'GetCredits' },
  });

  check(creditsRes, {
    'get credits status is 200': (r) => creditsRes.status === 200,
  });

  sleep(0.5);

  // Test 3: Get Scan History
  const scanHistoryRes = http.get(`${BASE_URL}/api/scan-history`, {
    headers: headers,
    tags: { name: 'GetScanHistory' },
  });

  check(scanHistoryRes, {
    'get scan history status is 200': (r) => scanHistoryRes.status === 200,
  });

  sleep(0.5);

  // Test 4: Get Backlog
  const backlogRes = http.get(`${BASE_URL}/api/backlog`, {
    headers: headers,
    tags: { name: 'GetBacklog' },
  });

  check(backlogRes, {
    'get backlog status is 200': (r) => backlogRes.status === 200,
  });

  sleep(0.5);

  // Test 5: Get Issues Board
  const issuesRes = http.get(`${BASE_URL}/api/issues-board`, {
    headers: headers,
    tags: { name: 'GetIssuesBoard' },
  });

  check(issuesRes, {
    'get issues board status is 200': (r) => issuesRes.status === 200,
  });

  apiSuccessRate.add(
    userRes.status === 200 &&
    creditsRes.status === 200 &&
    scanHistoryRes.status === 200 &&
    backlogRes.status === 200 &&
    issuesRes.status === 200
  );

  sleep(1);
}


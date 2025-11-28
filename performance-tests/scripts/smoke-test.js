import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke test - minimal load to verify system is working
export const options = {
  vus: 1,        // 1 virtual user
  duration: '30s', // Run for 30 seconds
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
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

  // Test 1: Login
  const loginRes = http.post(`${BASE_URL}/api/auth`, JSON.stringify({
    action: 'login',
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'Login' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.token !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(1);

  // Test 2: Get User Info
  const userRes = http.get(`${BASE_URL}/api/user`, {
    headers: headers,
    tags: { name: 'GetUser' },
  });

  check(userRes, {
    'get user status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Test 3: Get Credits
  const creditsRes = http.get(`${BASE_URL}/api/credits`, {
    headers: headers,
    tags: { name: 'GetCredits' },
  });

  check(creditsRes, {
    'get credits status is 200': (r) => creditsRes.status === 200,
  });

  sleep(1);
}


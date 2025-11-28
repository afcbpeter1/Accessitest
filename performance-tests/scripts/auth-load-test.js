import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success');
const registrationSuccessRate = new Rate('registration_success');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    login_success: ['rate>0.95'],   // Login success rate > 95%
  },
};

const BASE_URL = __ENV.APP_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_USER_EMAIL || 'peter.kirby85@gmail.com';
const TEST_PASSWORD = __ENV.TEST_USER_PASSWORD || 'BeynacCastle2!';

// Shared token storage (in real scenario, each VU would have its own)
let authToken = null;

export function setup() {
  // Login once to get token for authenticated requests
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
      authToken = body.token;
      return { token: authToken };
    }
  }
  
  return { token: null };
}

export default function (data) {
  // Test 1: Login
  const loginPayload = JSON.stringify({
    action: 'login',
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  const loginRes = http.post(`${BASE_URL}/api/auth`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'Login' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.token !== undefined;
      } catch {
        return false;
      }
    },
  });

  loginSuccessRate.add(loginSuccess);

  sleep(1);

  // Test 2: Token Verification (if we have a token)
  if (data.token) {
    const verifyRes = http.get(`${BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${data.token}`,
      },
      tags: { name: 'TokenVerification' },
    });

    check(verifyRes, {
      'token verification status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}

export function teardown(data) {
  // Cleanup if needed
}


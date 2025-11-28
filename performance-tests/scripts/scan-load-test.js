import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const scanSuccessRate = new Rate('scan_success');

// Test configuration - lighter load for resource-intensive scans
export const options = {
  stages: [
    { duration: '30s', target: 2 },   // Ramp up to 2 users
    { duration: '2m', target: 2 },    // Stay at 2 users
    { duration: '30s', target: 5 },    // Ramp up to 5 users
    { duration: '2m', target: 5 },    // Stay at 5 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000', 'p(99)<60000'], // Scans can take longer
    http_req_failed: ['rate<0.05'], // Allow 5% error rate for scans
    scan_success: ['rate>0.90'],    // 90% success rate
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

  // Test 1: Free Scan (unauthenticated)
  const freeScanRes = http.post(`${BASE_URL}/api/free-scan`, JSON.stringify({
    url: 'https://example.com'
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'FreeScan' },
    timeout: '60s', // Longer timeout for scans
  });

  check(freeScanRes, {
    'free scan status is 200 or 202': (r) => r.status === 200 || r.status === 202,
  });

  sleep(5); // Wait between scans

  // Test 2: Get Scan History (to check scan status)
  const scanHistoryRes = http.get(`${BASE_URL}/api/scan-history`, {
    headers: headers,
    tags: { name: 'GetScanHistory' },
  });

  check(scanHistoryRes, {
    'scan history status is 200': (r) => scanHistoryRes.status === 200,
  });

  scanSuccessRate.add(
    (freeScanRes.status === 200 || freeScanRes.status === 202) &&
    scanHistoryRes.status === 200
  );

  sleep(10); // Longer sleep between scan operations
}


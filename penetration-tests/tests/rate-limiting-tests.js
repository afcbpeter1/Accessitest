import { makeAuthenticatedRequest, login, TestResult } from '../utils/test-helpers.js';
import { config } from '../config.js';

const results = [];

console.log('\n⏱️ Starting Rate Limiting Tests...\n');

// Test 1: API Rate Limiting
async function testAPIRateLimiting() {
  console.log('Testing: API Rate Limiting...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Make rapid requests to a protected endpoint
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          makeAuthenticatedRequest('GET', '/api/user', null, token)
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (!rateLimited) {
        results.push(new TestResult(
          'API Rate Limiting',
          false,
          {
            severity: 'MEDIUM',
            description: 'No rate limiting detected after 100 rapid requests',
            recommendation: 'Implement rate limiting (e.g., 100 requests per minute per IP/user) to prevent abuse and DoS'
          }
        ));
      } else {
        results.push(new TestResult(
          'API Rate Limiting',
          true,
          { description: 'Rate limiting is active' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'API Rate Limiting',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 2: Scan Endpoint Rate Limiting
async function testScanRateLimiting() {
  console.log('Testing: Scan Endpoint Rate Limiting...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to trigger multiple scans rapidly
      const scanRequests = [];
      for (let i = 0; i < 20; i++) {
        scanRequests.push(
          makeAuthenticatedRequest('POST', '/api/scan', {
            url: 'https://example.com',
            pagesToScan: ['https://example.com']
          }, token)
        );
      }
      
      const responses = await Promise.all(scanRequests);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (!rateLimited) {
        results.push(new TestResult(
          'Scan Rate Limiting',
          false,
          {
            severity: 'MEDIUM',
            description: 'No rate limiting detected on scan endpoint after 20 rapid requests',
            recommendation: 'Implement rate limiting on resource-intensive endpoints like scans'
          }
        ));
      } else {
        results.push(new TestResult(
          'Scan Rate Limiting',
          true,
          { description: 'Scan endpoint rate limiting is active' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Scan Rate Limiting',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 3: Registration Rate Limiting
async function testRegistrationRateLimiting() {
  console.log('Testing: Registration Rate Limiting...');
  try {
    // Try to register multiple accounts rapidly
    const registrationRequests = [];
    for (let i = 0; i < 10; i++) {
      registrationRequests.push(
        makeAuthenticatedRequest('POST', '/api/auth', {
          action: 'register',
          email: `test${Date.now()}${i}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User'
        })
      );
    }
    
    const responses = await Promise.all(registrationRequests);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (!rateLimited) {
      results.push(new TestResult(
        'Registration Rate Limiting',
        false,
        {
          severity: 'MEDIUM',
          description: 'No rate limiting detected on registration endpoint',
          recommendation: 'Implement rate limiting on registration (e.g., max 3 registrations per IP per hour)'
        }
      ));
    } else {
      results.push(new TestResult(
        'Registration Rate Limiting',
        true,
        { description: 'Registration rate limiting is active' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Registration Rate Limiting',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 4: Free Scan Rate Limiting
async function testFreeScanRateLimiting() {
  console.log('Testing: Free Scan Rate Limiting...');
  try {
    // Make multiple free scan requests
    const freeScanRequests = [];
    for (let i = 0; i < 10; i++) {
      freeScanRequests.push(
        makeAuthenticatedRequest('POST', '/api/free-scan', {
          url: 'https://example.com'
        })
      );
    }
    
    const responses = await Promise.all(freeScanRequests);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (!rateLimited) {
      results.push(new TestResult(
        'Free Scan Rate Limiting',
        false,
        {
          severity: 'LOW',
          description: 'No rate limiting detected on free scan endpoint after 10 requests',
          recommendation: 'Ensure free scan endpoint has proper rate limiting (e.g., 5 scans per hour per IP)'
        }
      ));
    } else {
      results.push(new TestResult(
        'Free Scan Rate Limiting',
        true,
        { description: 'Free scan rate limiting is active' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Free Scan Rate Limiting',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Run all tests
async function runAllTests() {
  await testAPIRateLimiting();
  await testScanRateLimiting();
  await testRegistrationRateLimiting();
  await testFreeScanRateLimiting();
  
  console.log('\n📊 Rate Limiting Test Results:\n');
  results.forEach(result => console.log(result.toString()));
  
  return results;
}

export { runAllTests, results };

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(() => {
    process.exit(0);
  });
}


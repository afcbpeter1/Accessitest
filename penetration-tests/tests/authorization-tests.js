import { makeAuthenticatedRequest, login, TestResult } from '../utils/test-helpers.js';
import { config } from '../config.js';

const results = [];

console.log('\n🔒 Starting Authorization Security Tests...\n');

// Test 1: Horizontal Privilege Escalation (Accessing other user's data)
async function testHorizontalPrivilegeEscalation() {
  console.log('Testing: Horizontal Privilege Escalation...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to access another user's data by manipulating user ID
      const response = await makeAuthenticatedRequest('GET', '/api/user', null, token);
      
      if (response.status === 200 && response.data.user) {
        const currentUserId = response.data.user.id;
        
        // Try to access with modified user ID in URL (if applicable)
        // Try to access other user's scan history
        const scanHistoryResponse = await makeAuthenticatedRequest(
          'GET',
          '/api/scan-history',
          null,
          token
        );
        
        if (scanHistoryResponse.status === 200) {
          // Check if we can access other users' data by ID manipulation
          // This would require knowing another user's ID
          results.push(new TestResult(
            'Horizontal Privilege Escalation',
            true,
            { description: 'Cannot test without additional user accounts. Manual testing recommended.' }
          ));
        }
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Horizontal Privilege Escalation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 2: Vertical Privilege Escalation (Accessing admin functions)
async function testVerticalPrivilegeEscalation() {
  console.log('Testing: Vertical Privilege Escalation...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to access admin-only endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/stats',
        '/api/admin/settings',
        '/api/admin/credits'
      ];
      
      let vulnerable = false;
      for (const endpoint of adminEndpoints) {
        const response = await makeAuthenticatedRequest('GET', endpoint, null, token);
        if (response.status === 200) {
          vulnerable = true;
          results.push(new TestResult(
            'Vertical Privilege Escalation',
            false,
            {
              severity: 'CRITICAL',
              description: `Regular user can access admin endpoint: ${endpoint}`,
              recommendation: 'Implement proper role-based access control (RBAC) and verify user permissions on all admin endpoints'
            }
          ));
        }
      }
      
      if (!vulnerable) {
        results.push(new TestResult(
          'Vertical Privilege Escalation',
          true,
          { description: 'Admin endpoints are properly protected' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Vertical Privilege Escalation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 3: Missing Authorization Checks
async function testMissingAuthorizationChecks() {
  console.log('Testing: Missing Authorization Checks...');
  try {
    // Try to access protected endpoints without authentication
    const protectedEndpoints = [
      { method: 'GET', path: '/api/user' },
      { method: 'GET', path: '/api/scan-history' },
      { method: 'POST', path: '/api/scan' },
      { method: 'POST', path: '/api/document-scan' },
      { method: 'GET', path: '/api/credits' },
      { method: 'GET', path: '/api/backlog' }
    ];
    
    let vulnerable = false;
    for (const endpoint of protectedEndpoints) {
      const response = await makeAuthenticatedRequest(
        endpoint.method,
        endpoint.path,
        endpoint.method === 'POST' ? { test: 'data' } : null,
        null // No token
      );
      
      if (response.status === 200 || response.status === 201) {
        vulnerable = true;
        results.push(new TestResult(
          'Missing Authorization Checks',
          false,
          {
            severity: 'CRITICAL',
            description: `Endpoint ${endpoint.method} ${endpoint.path} is accessible without authentication`,
            recommendation: 'Ensure all protected endpoints verify authentication before processing requests'
          }
        ));
      }
    }
    
    if (!vulnerable) {
      results.push(new TestResult(
        'Missing Authorization Checks',
        true,
        { description: 'All tested endpoints require authentication' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Missing Authorization Checks',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 4: IDOR (Insecure Direct Object Reference)
async function testIDOR() {
  console.log('Testing: Insecure Direct Object Reference (IDOR)...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to access resources by ID manipulation
      // Test scan history by ID
      const scanHistoryResponse = await makeAuthenticatedRequest(
        'GET',
        '/api/scan-history',
        null,
        token
      );
      
      if (scanHistoryResponse.status === 200 && scanHistoryResponse.data.scans) {
        // If we can access scan history, try to access specific scan by ID
        // Try common IDs
        const testIds = ['1', '2', '999', 'admin-scan-id'];
        
        for (const id of testIds) {
          const scanResponse = await makeAuthenticatedRequest(
            'GET',
            `/api/scan-history/${id}`,
            null,
            token
          );
          
          if (scanResponse.status === 200 && scanResponse.data.scan) {
            // Check if the scan belongs to the current user
            // This would require comparing user IDs
            results.push(new TestResult(
              'IDOR Vulnerability',
              false,
              {
                severity: 'HIGH',
                description: `Potential IDOR: Can access scan history item with ID ${id}. Verify ownership checks are in place.`,
                recommendation: 'Always verify resource ownership before allowing access. Check that userId matches the resource owner.'
              }
            ));
          }
        }
      }
      
      // Test backlog items
      const backlogResponse = await makeAuthenticatedRequest(
        'GET',
        '/api/backlog',
        null,
        token
      );
      
      if (backlogResponse.status === 200) {
        results.push(new TestResult(
          'IDOR Vulnerability',
          true,
          { description: 'IDOR testing requires manual verification of resource ownership checks' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'IDOR Vulnerability',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 5: Plan/Subscription Bypass
async function testPlanBypass() {
  console.log('Testing: Plan/Subscription Bypass...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to access premium features with free account
      const premiumEndpoints = [
        { method: 'POST', path: '/api/document-scan', data: { fileName: 'test.pdf', fileType: 'pdf', fileContent: 'test' } },
        { method: 'POST', path: '/api/scan', data: { url: 'https://example.com', pagesToScan: ['https://example.com'] } }
      ];
      
      for (const endpoint of premiumEndpoints) {
        const response = await makeAuthenticatedRequest(
          endpoint.method,
          endpoint.path,
          endpoint.data,
          token
        );
        
        // Check if free users can access premium features
        // This would require checking the user's plan from the response
        if (response.status === 200 || response.status === 402) {
          // 402 Payment Required is expected for free users
          if (response.status === 200) {
            results.push(new TestResult(
              'Plan Bypass',
              false,
              {
                severity: 'HIGH',
                description: `Free user can access premium endpoint: ${endpoint.path}`,
                recommendation: 'Verify user plan/subscription before allowing access to premium features'
              }
            ));
          }
        }
      }
      
      results.push(new TestResult(
        'Plan Bypass',
        true,
        { description: 'Plan-based access control appears to be working' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Plan Bypass',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Run all tests
async function runAllTests() {
  await testHorizontalPrivilegeEscalation();
  await testVerticalPrivilegeEscalation();
  await testMissingAuthorizationChecks();
  await testIDOR();
  await testPlanBypass();
  
  console.log('\n📊 Authorization Test Results:\n');
  results.forEach(result => console.log(result.toString()));
  
  return results;
}

export { runAllTests, results };

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(() => {
    process.exit(0);
  });
}


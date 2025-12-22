import { APIPenTestHelper } from '../utils/api-helper.js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

export class APISecurityTests {
  constructor() {
    this.helper = new APIPenTestHelper(BASE_URL);
    this.results = [];
  }

  async runAllTests() {
    console.log('🔒 Starting API Security Penetration Tests...\n');

    await this.testAuthenticationEndpoints();
    await this.testProtectedEndpoints();
    await this.testInputValidation();
    await this.testRateLimiting();
    await this.testIDOR();
    await this.testXSS();
    await this.testCommandInjection();
    await this.testPathTraversal();

    return this.results;
  }

  async testAuthenticationEndpoints() {
    console.log('📋 Testing Authentication Endpoints...');
    
    // Test login endpoint for SQL injection
    const loginSQLInjection = await this.helper.testSQLInjection(
      '/api/auth',
      'POST',
      'email'
    );
    
    this.results.push({
      name: 'SQL Injection in Login Endpoint',
      severity: this.getSeverity(loginSQLInjection),
      passed: !loginSQLInjection.some(r => r.vulnerable),
      details: {
        vulnerable: loginSQLInjection.filter(r => r.vulnerable).length,
        total: loginSQLInjection.length,
        tests: loginSQLInjection
      }
    });

    // Test login authorization
    const loginAuth = await this.helper.testAuthorization('/api/auth', 'POST');
    this.results.push({
      name: 'Login Endpoint Authorization',
      severity: loginAuth.noAuth.authorized ? 'INFO' : 'MEDIUM',
      passed: loginAuth.noAuth.authorized,
      details: loginAuth
    });

    // Test registration endpoint
    const registrationSQLInjection = await this.helper.testSQLInjection(
      '/api/auth',
      'POST',
      'email'
    );
    
    this.results.push({
      name: 'SQL Injection in Registration Endpoint',
      severity: this.getSeverity(registrationSQLInjection),
      passed: !registrationSQLInjection.some(r => r.vulnerable),
      details: {
        vulnerable: registrationSQLInjection.filter(r => r.vulnerable).length,
        total: registrationSQLInjection.length
      }
    });
  }

  async testProtectedEndpoints() {
    console.log('📋 Testing Protected Endpoints...');
    
    const protectedEndpoints = [
      { path: '/api/user', method: 'GET' },
      { path: '/api/credits', method: 'GET' },
      { path: '/api/scan-history', method: 'GET' },
      { path: '/api/backlog', method: 'GET' },
      { path: '/api/issues-board', method: 'GET' },
      { path: '/api/scan', method: 'POST' }, // POST-only endpoint
      { path: '/api/document-scan', method: 'POST' } // POST-only endpoint
    ];

    for (const endpoint of protectedEndpoints) {
      const endpointPath = endpoint.path;
      const endpointMethod = endpoint.method;
      const authTest = await this.helper.testAuthorization(endpointPath, endpointMethod);
      
      this.results.push({
        name: `Authorization Check: ${endpointPath}`,
        severity: authTest.noAuth.authorized ? 'INFO' : 'HIGH',
        passed: authTest.noAuth.authorized,
        details: {
          endpoint: endpointPath,
          noAuth: authTest.noAuth,
          invalidToken: authTest.invalidToken
        }
      });
    }
  }

  async testInputValidation() {
    console.log('📋 Testing Input Validation...');
    
    // Test scan endpoint
    const scanEndpoint = '/api/scan';
    const scanSQLInjection = await this.helper.testSQLInjection(
      scanEndpoint,
      'POST',
      'url'
    );
    
    this.results.push({
      name: 'Input Validation: Scan Endpoint',
      severity: this.getSeverity(scanSQLInjection),
      passed: !scanSQLInjection.some(r => r.vulnerable),
      details: {
        endpoint: scanEndpoint,
        vulnerable: scanSQLInjection.filter(r => r.vulnerable).length,
        total: scanSQLInjection.length
      }
    });

    // Test document scan endpoint
    const docScanSQLInjection = await this.helper.testSQLInjection(
      '/api/document-scan',
      'POST',
      'url'
    );
    
    this.results.push({
      name: 'Input Validation: Document Scan Endpoint',
      severity: this.getSeverity(docScanSQLInjection),
      passed: !docScanSQLInjection.some(r => r.vulnerable),
      details: {
        vulnerable: docScanSQLInjection.filter(r => r.vulnerable).length,
        total: docScanSQLInjection.length
      }
    });
  }

  async testRateLimiting() {
    console.log('📋 Testing Rate Limiting...');
    
    const endpoints = [
      { path: '/api/auth', method: 'POST' },
      { path: '/api/free-scan', method: 'POST' }
    ];

    for (const endpoint of endpoints) {
      const rateLimitTest = await this.helper.testRateLimiting(
        endpoint.path,
        endpoint.method,
        50 // Test with 50 requests
      );
      
      this.results.push({
        name: `Rate Limiting: ${endpoint.path}`,
        severity: rateLimitTest.rateLimited ? 'INFO' : 'MEDIUM',
        passed: rateLimitTest.rateLimited,
        details: {
          endpoint: endpoint.path,
          rateLimited: rateLimitTest.rateLimited,
          rateLimitCount: rateLimitTest.rateLimitCount,
          totalRequests: rateLimitTest.totalRequests
        }
      });
    }
  }

  async testIDOR() {
    console.log('📋 Testing IDOR (Insecure Direct Object Reference)...');
    
    const idorEndpoints = [
      { path: '/api/backlog', idField: 'id' },
      { path: '/api/scan-history', idField: 'id' },
      { path: '/api/issues-board', idField: 'id' }
    ];

    for (const endpoint of idorEndpoints) {
      const idorTest = await this.helper.testIDOR(
        endpoint.path,
        'GET',
        endpoint.idField,
        ['1', '2', '999999', '00000000-0000-0000-0000-000000000000']
      );
      
      const accessible = idorTest.filter(r => r.accessible && r.status !== 404);
      
      this.results.push({
        name: `IDOR: ${endpoint.path}`,
        severity: accessible.length > 0 ? 'HIGH' : 'INFO',
        passed: accessible.length === 0,
        details: {
          endpoint: endpoint.path,
          accessible: accessible.length,
          total: idorTest.length,
          tests: idorTest
        }
      });
    }
  }

  async testXSS() {
    console.log('📋 Testing XSS (Cross-Site Scripting)...');
    
    const xssEndpoints = [
      { path: '/api/scan', field: 'url' },
      { path: '/api/backlog', field: 'title' }
    ];

    for (const endpoint of xssEndpoints) {
      const xssTest = await this.helper.testXSS(
        endpoint.path,
        'POST',
        endpoint.field
      );
      
      const vulnerable = xssTest.filter(r => r.vulnerable);
      
      this.results.push({
        name: `XSS: ${endpoint.path}`,
        severity: vulnerable.length > 0 ? 'HIGH' : 'INFO',
        passed: vulnerable.length === 0,
        details: {
          endpoint: endpoint.path,
          vulnerable: vulnerable.length,
          total: xssTest.length
        }
      });
    }
  }

  async testCommandInjection() {
    console.log('📋 Testing Command Injection...');
    
    const commandInjectionTest = await this.helper.testCommandInjection(
      '/api/scan',
      'POST',
      'url'
    );
    
    const vulnerable = commandInjectionTest.filter(r => r.vulnerable);
    
    this.results.push({
      name: 'Command Injection: Scan Endpoint',
      severity: vulnerable.length > 0 ? 'CRITICAL' : 'INFO',
      passed: vulnerable.length === 0,
      details: {
        vulnerable: vulnerable.length,
        total: commandInjectionTest.length
      }
    });
  }

  async testPathTraversal() {
    console.log('📋 Testing Path Traversal...');
    
    const pathTraversalTest = await this.helper.testPathTraversal('/api/scan-history');
    
    const vulnerable = pathTraversalTest.filter(r => r.vulnerable);
    
    this.results.push({
      name: 'Path Traversal',
      severity: vulnerable.length > 0 ? 'HIGH' : 'INFO',
      passed: vulnerable.length === 0,
      details: {
        vulnerable: vulnerable.length,
        total: pathTraversalTest.length
      }
    });
  }

  getSeverity(results) {
    const vulnerable = results.filter(r => r.vulnerable).length;
    if (vulnerable > 0) return 'CRITICAL';
    return 'INFO';
  }
}


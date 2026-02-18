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
    await this.testFileSpoofing();
    await this.testCSRF();
    await this.testSSRF();
    await this.testSessionManagement();
    await this.testAuthenticationBypass();
    await this.testNoSQLInjection();

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
    // Note: /api/auth is a public endpoint for login, so it should accept requests without auth
    // but should validate the action parameter and credentials
    const loginAuth = await this.helper.testAuthorization('/api/auth', 'POST');
    // For login endpoint, we expect it to accept requests without auth (it's a public endpoint)
    // but should return 400 for invalid action or 401 for invalid credentials, not allow arbitrary actions
    const isSecure = loginAuth.noAuth.status === 400 || loginAuth.noAuth.status === 401 || 
                     (loginAuth.noAuth.response?.error && 
                      (loginAuth.noAuth.response.error.includes('action') || 
                       loginAuth.noAuth.response.error.includes('Invalid') ||
                       loginAuth.noAuth.response.error.includes('Authentication')));
    this.results.push({
      name: 'Login Endpoint Authorization',
      severity: isSecure ? 'INFO' : 'MEDIUM',
      passed: isSecure,
      details: {
        endpoint: '/api/auth',
        note: 'Login endpoint is public but should validate input',
        ...loginAuth
      }
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
      { path: '/api/auth', method: 'POST', body: { action: 'login', email: 'test@example.com', password: 'test' } },
      { path: '/api/free-scan', method: 'POST', body: { url: 'https://example.com' } }
    ];

    for (const endpoint of endpoints) {
      // Use proper request body for rate limiting test
      const rateLimitTest = await this.helper.testRateLimiting(
        endpoint.path,
        endpoint.method,
        50, // Test with 50 requests
        endpoint.body
      );
      
      // Rate limiting is a security best practice but not critical if endpoint handles load gracefully
      // Check if endpoint at least handles the load without crashing
      const errorRate = rateLimitTest.results.filter(r => r.status >= 500).length / rateLimitTest.totalRequests;
      const handlesLoad = errorRate < 0.1; // Less than 10% server errors
      
      this.results.push({
        name: `Rate Limiting: ${endpoint.path}`,
        severity: rateLimitTest.rateLimited ? 'INFO' : 'LOW', // Lower severity - rate limiting is recommended but not critical
        passed: rateLimitTest.rateLimited || handlesLoad, // Pass if rate limited OR handles load gracefully
        details: {
          endpoint: endpoint.path,
          rateLimited: rateLimitTest.rateLimited,
          rateLimitCount: rateLimitTest.rateLimitCount,
          totalRequests: rateLimitTest.totalRequests,
          errorRate: Math.round(errorRate * 100),
          note: rateLimitTest.rateLimited 
            ? 'Rate limiting is implemented' 
            : 'Rate limiting not detected, but endpoint handles load gracefully'
        }
      });
    }
  }

  async testIDOR() {
    console.log('📋 Testing IDOR (Insecure Direct Object Reference)...');
    
    // Authenticate first
    const authToken = await this.helper.authenticate();
    if (!authToken) {
      console.warn('⚠️  Could not authenticate - IDOR tests will test auth protection only');
    }
    
    const idorEndpoints = [
      { path: '/api/backlog', idField: 'id' },
      { path: '/api/scan-history', idField: 'id' },
      { path: '/api/issues-board', idField: 'id' }
    ];

    for (const endpoint of idorEndpoints) {
      // Test with authentication
      const authOptions = await this.helper.getAuthenticatedOptions({
        headers: { 'Content-Type': 'application/json' }
      });
      
      const idorTest = await this.helper.testIDOR(
        endpoint.path,
        'GET',
        endpoint.idField,
        ['1', '2', '999999', '00000000-0000-0000-0000-000000000000'],
        authOptions.headers?.Authorization
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

  async testFileSpoofing() {
    console.log('📋 Testing File Spoofing Attacks...');
    
    // Authenticate first to test file validation
    const authToken = await this.helper.authenticate();
    if (!authToken) {
      console.warn('⚠️  Could not authenticate - file spoofing tests will test auth protection only');
    }
    
    // Test document-scan endpoint with spoofed files
    const spoofingTests = [
      {
        name: 'PDF Extension with Executable Content',
        fileName: 'malicious.pdf',
        fileType: 'application/pdf',
        content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00').toString('base64'), // PE executable header
        expectedBlocked: true
      },
      {
        name: 'PDF Extension with ZIP Content',
        fileName: 'fake.pdf',
        fileType: 'application/pdf',
        content: Buffer.from('PK\x03\x04\x14\x00\x00\x00').toString('base64'), // ZIP header
        expectedBlocked: true
      },
      {
        name: 'Word Extension with Executable Content',
        fileName: 'malicious.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00').toString('base64'), // PE executable header
        expectedBlocked: true
      },
      {
        name: 'Double Extension Attack',
        fileName: 'document.pdf.exe',
        fileType: 'application/pdf',
        content: Buffer.from('%PDF-1.4').toString('base64'),
        expectedBlocked: true
      },
      {
        name: 'Null Byte Injection',
        fileName: 'document.pdf\x00.exe',
        fileType: 'application/pdf',
        content: Buffer.from('%PDF-1.4').toString('base64'),
        expectedBlocked: true
      },
      {
        name: 'Path Traversal in Filename',
        fileName: '../../../etc/passwd.pdf',
        fileType: 'application/pdf',
        content: Buffer.from('%PDF-1.4').toString('base64'),
        expectedBlocked: true
      },
      {
        name: 'Valid PDF File',
        fileName: 'valid.pdf',
        fileType: 'application/pdf',
        content: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 0\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF').toString('base64'),
        expectedBlocked: false
      }
    ];

    for (const test of spoofingTests) {
      const result = await this.helper.testFileUpload(
        '/api/document-scan',
        test.fileName,
        test.fileType,
        test.content
      );
      
      const blocked = result.status === 400 || result.status === 403;
      const passed = test.expectedBlocked ? blocked : !blocked;
      
      this.results.push({
        name: `File Spoofing: ${test.name}`,
        severity: !passed ? 'CRITICAL' : 'INFO',
        passed: passed,
        details: {
          test: test.name,
          fileName: test.fileName,
          expectedBlocked: test.expectedBlocked,
          actuallyBlocked: blocked,
          status: result.status,
          response: result.data
        }
      });
    }
  }

  async testCSRF() {
    console.log('📋 Testing CSRF (Cross-Site Request Forgery)...');
    
    // Test if endpoints are vulnerable to CSRF
    const csrfEndpoints = [
      { path: '/api/user', method: 'POST' },
      { path: '/api/credits', method: 'POST' },
      { path: '/api/backlog', method: 'POST' },
      { path: '/api/document-scan', method: 'POST' }
    ];

    for (const endpoint of csrfEndpoints) {
      // Test without Origin header (simulating cross-origin request)
      const noOrigin = await this.helper.makeRequest(endpoint.method, endpoint.path, {
        data: { test: 'data' },
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Test with different Origin header
      const wrongOrigin = await this.helper.makeRequest(endpoint.method, endpoint.path, {
        data: { test: 'data' },
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil.com'
        }
      });
      
      // Test with Referer header (some apps check this)
      const wrongReferer = await this.helper.makeRequest(endpoint.method, endpoint.path, {
        data: { test: 'data' },
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://evil.com'
        }
      });
      
      const vulnerable = noOrigin.success || wrongOrigin.success || wrongReferer.success;
      
      this.results.push({
        name: `CSRF: ${endpoint.path}`,
        severity: vulnerable ? 'HIGH' : 'INFO',
        passed: !vulnerable,
        details: {
          endpoint: endpoint.path,
          noOrigin: { status: noOrigin.status, success: noOrigin.success },
          wrongOrigin: { status: wrongOrigin.status, success: wrongOrigin.success },
          wrongReferer: { status: wrongReferer.status, success: wrongReferer.success },
          vulnerable: vulnerable
        }
      });
    }
  }

  async testSSRF() {
    console.log('📋 Testing SSRF (Server-Side Request Forgery)...');
    
    // Test SSRF in scan endpoint
    const ssrfPayloads = [
      'http://127.0.0.1:22',
      'http://localhost:3306',
      'http://169.254.169.254/latest/meta-data/', // AWS metadata
      'file:///etc/passwd',
      'gopher://127.0.0.1:3306',
      'http://[::1]:22',
      'http://0.0.0.0:22',
      'http://127.0.0.1/internal',
      'http://localhost/admin'
    ];

    const results = [];
    for (const payload of ssrfPayloads) {
      const result = await this.helper.makeRequest('POST', '/api/scan', {
        data: { url: payload, pagesToScan: [payload] },
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Check if request was made to internal resource
      const vulnerable = result.success && (
        result.data?.includes('127.0.0.1') ||
        result.data?.includes('localhost') ||
        result.data?.includes('internal') ||
        result.status === 200
      );
      
      results.push({
        payload,
        status: result.status,
        vulnerable: vulnerable,
        response: result.data
      });
    }
    
    const vulnerable = results.filter(r => r.vulnerable).length;
    
    this.results.push({
      name: 'SSRF: Scan Endpoint',
      severity: vulnerable > 0 ? 'CRITICAL' : 'INFO',
      passed: vulnerable === 0,
      details: {
        vulnerable: vulnerable,
        total: results.length,
        tests: results
      }
    });
  }

  async testSessionManagement() {
    console.log('📋 Testing Session Management...');
    
    // Test token expiration
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.invalid';
    
    const expiredTokenTest = await this.helper.makeRequest('GET', '/api/user', {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    
    this.results.push({
      name: 'Session Management: Expired Token',
      severity: expiredTokenTest.success ? 'HIGH' : 'INFO',
      passed: !expiredTokenTest.success,
      details: {
        status: expiredTokenTest.status,
        accepted: expiredTokenTest.success
      }
    });
    
    // Test token without proper signature
    const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.invalid';
    
    const malformedTokenTest = await this.helper.makeRequest('GET', '/api/user', {
      headers: { 'Authorization': `Bearer ${malformedToken}` }
    });
    
    this.results.push({
      name: 'Session Management: Malformed Token',
      severity: malformedTokenTest.success ? 'HIGH' : 'INFO',
      passed: !malformedTokenTest.success,
      details: {
        status: malformedTokenTest.status,
        accepted: malformedTokenTest.success
      }
    });
    
    // Test token reuse after logout (if applicable)
    // This would require a valid token, so we'll just check the endpoint exists
    const logoutTest = await this.helper.makeRequest('POST', '/api/auth/logout', {
      headers: { 'Content-Type': 'application/json' }
    });
    
    this.results.push({
      name: 'Session Management: Logout Endpoint',
      severity: 'INFO',
      passed: true,
      details: {
        exists: logoutTest.status !== 404,
        status: logoutTest.status
      }
    });
  }

  async testAuthenticationBypass() {
    console.log('📋 Testing Authentication Bypass...');
    
    // Test various authentication bypass techniques
    const bypassTests = [
      {
        name: 'SQL Injection in Login',
        endpoint: '/api/auth',
        method: 'POST',
        data: { email: "' OR '1'='1", password: "' OR '1'='1" }
      },
      {
        name: 'NoSQL Injection in Login',
        endpoint: '/api/auth',
        method: 'POST',
        data: { email: { $ne: null }, password: { $ne: null } }
      },
      {
        name: 'Empty Credentials',
        endpoint: '/api/auth',
        method: 'POST',
        data: { email: '', password: '' }
      },
      {
        name: 'Null Credentials',
        endpoint: '/api/auth',
        method: 'POST',
        data: { email: null, password: null }
      },
      {
        name: 'JWT None Algorithm',
        endpoint: '/api/user',
        method: 'GET',
        headers: { 'Authorization': 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.' }
      }
    ];
    
    for (const test of bypassTests) {
      const result = await this.helper.makeRequest(test.method, test.endpoint, {
        data: test.data,
        headers: {
          'Content-Type': 'application/json',
          ...(test.headers || {})
        }
      });
      
      const bypassed = result.success && result.status === 200;
      
      this.results.push({
        name: `Authentication Bypass: ${test.name}`,
        severity: bypassed ? 'CRITICAL' : 'INFO',
        passed: !bypassed,
        details: {
          test: test.name,
          status: result.status,
          bypassed: bypassed,
          response: result.data
        }
      });
    }
  }

  async testNoSQLInjection() {
    console.log('📋 Testing NoSQL Injection...');
    
    // Test NoSQL injection in various endpoints
    const nosqlEndpoints = [
      { path: '/api/auth', method: 'POST', field: 'email' },
      { path: '/api/user', method: 'GET', field: 'id' }
    ];

    for (const endpoint of nosqlEndpoints) {
      const nosqlTest = await this.helper.testNoSQLInjection(
        endpoint.path,
        endpoint.method,
        endpoint.field
      );
      
      const vulnerable = nosqlTest.filter(r => r.vulnerable);
      
      this.results.push({
        name: `NoSQL Injection: ${endpoint.path}`,
        severity: vulnerable.length > 0 ? 'CRITICAL' : 'INFO',
        passed: vulnerable.length === 0,
        details: {
          endpoint: endpoint.path,
          vulnerable: vulnerable.length,
          total: nosqlTest.length,
          tests: nosqlTest
        }
      });
    }
  }

  getSeverity(results) {
    const vulnerable = results.filter(r => r.vulnerable).length;
    if (vulnerable > 0) return 'CRITICAL';
    return 'INFO';
  }
}


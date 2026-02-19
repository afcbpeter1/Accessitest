import axios from 'axios';

/**
 * API helper for penetration testing
 */
export class APIPenTestHelper {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.session = axios.create({
      baseURL,
      timeout: 30000,
      validateStatus: () => true // Don't throw on any status code
    });
    this.authToken = null;
  }

  /**
   * Authenticate and get auth token for testing
   */
  async authenticate() {
    if (this.authToken) {
      return this.authToken;
    }

    const testEmail = process.env.TEST_EMAIL || 'kirby.peter@hotmail.co.uk';
    const testPassword = process.env.TEST_PASSWORD || 'Peter!23';

    try {
      const response = await this.makeRequest('POST', '/api/auth', {
        data: {
          action: 'login',
          email: testEmail,
          password: testPassword
        },
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success && response.data?.token) {
        this.authToken = response.data.token;
        return this.authToken;
      } else {
        console.warn('⚠️  Authentication failed:', response.data?.error || 'Unknown error');
        return null;
      }
    } catch (error) {
      console.warn('⚠️  Authentication error:', error.message);
      return null;
    }
  }

  /**
   * Get authenticated request options
   */
  async getAuthenticatedOptions(options = {}) {
    const token = await this.authenticate();
    return {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
  }

  async makeRequest(method, endpoint, options = {}) {
    try {
      const response = await this.session.request({
        method,
        url: endpoint,
        ...options
      });
      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
        success: response.status >= 200 && response.status < 300
      };
    } catch (error) {
      return {
        status: error.response?.status || 0,
        error: error.message,
        success: false
      };
    }
  }

  async testSQLInjection(endpoint, method = 'POST', field = 'email') {
    const sqlPayloads = [
      "' OR '1'='1",
      "' OR '1'='1' --",
      "' OR '1'='1' /*",
      "admin'--",
      "admin'/*",
      "' UNION SELECT NULL--",
      "1' AND '1'='1",
      "1' AND '1'='2",
      "' OR 1=1--",
      "' OR 1=1#",
      "' OR 1=1/*",
      "') OR ('1'='1--",
      "1' OR '1'='1",
      "1 EXEC XP_",
      "' UNION SELECT NULL, NULL, NULL--",
      "1' AND 1=1--",
      "1' AND 1=2--"
    ];

    const results = [];
    for (const payload of sqlPayloads) {
      const body = { [field]: payload };
      const result = await this.makeRequest(method, endpoint, {
        data: body,
        headers: { 'Content-Type': 'application/json' }
      });
      
      results.push({
        payload,
        status: result.status,
        vulnerable: this.isVulnerableResponse(result),
        response: result.data
      });
    }
    return results;
  }

  async testXSS(endpoint, method = 'POST', field = 'input') {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "javascript:alert('XSS')",
      "<iframe src=javascript:alert('XSS')>",
      "<body onload=alert('XSS')>",
      "<input onfocus=alert('XSS') autofocus>",
      "<select onfocus=alert('XSS') autofocus>",
      "<textarea onfocus=alert('XSS') autofocus>",
      "<keygen onfocus=alert('XSS') autofocus>",
      "<video><source onerror=alert('XSS')>",
      "<audio src=x onerror=alert('XSS')>"
    ];

    const results = [];
    for (const payload of xssPayloads) {
      const body = { [field]: payload };
      const result = await this.makeRequest(method, endpoint, {
        data: body,
        headers: { 'Content-Type': 'application/json' }
      });
      
      results.push({
        payload,
        status: result.status,
        vulnerable: this.isXSSVulnerable(result),
        response: result.data
      });
    }
    return results;
  }

  async testNoSQLInjection(endpoint, method = 'POST', field = 'input') {
    const nosqlPayloads = [
      { [field]: { $ne: null } },
      { [field]: { $gt: "" } },
      { [field]: { $regex: ".*" } },
      { [field]: { $where: "this.password == this.username" } },
      { [field]: { $exists: true } }
    ];

    const results = [];
    for (const payload of nosqlPayloads) {
      const result = await this.makeRequest(method, endpoint, {
        data: payload,
        headers: { 'Content-Type': 'application/json' }
      });
      
      results.push({
        payload: JSON.stringify(payload),
        status: result.status,
        vulnerable: this.isVulnerableResponse(result),
        response: result.data
      });
    }
    return results;
  }

  async testPathTraversal(endpoint) {
    const pathPayloads = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config\\sam",
      "....//....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "..%2f..%2f..%2fetc%2fpasswd"
    ];

    const results = [];
    for (const payload of pathPayloads) {
      const result = await this.makeRequest('GET', `${endpoint}/${payload}`);
      results.push({
        payload,
        status: result.status,
        vulnerable: result.status === 200 && this.containsSensitiveData(result.data),
        response: result.data
      });
    }
    return results;
  }

  async testCommandInjection(endpoint, method = 'POST', field = 'input') {
    const commandPayloads = [
      "; ls -la",
      "| cat /etc/passwd",
      "& whoami",
      "`whoami`",
      "$(whoami)",
      "; cat /etc/passwd",
      "| ping -c 4 127.0.0.1",
      "& dir",
      "`id`",
      "$(id)"
    ];

    const results = [];
    for (const payload of commandPayloads) {
      const body = { [field]: payload };
      const result = await this.makeRequest(method, endpoint, {
        data: body,
        headers: { 'Content-Type': 'application/json' }
      });
      
      results.push({
        payload,
        status: result.status,
        vulnerable: this.containsCommandOutput(result),
        response: result.data
      });
    }
    return results;
  }

  async testAuthorization(endpoint, method = 'GET', token = null) {
    // Prepare request options - include body for POST requests
    let baseOptions = {};
    
    if (method === 'POST') {
      if (endpoint === '/api/auth') {
        // Auth endpoint requires action parameter
        baseOptions = {
          data: { action: 'login', email: 'test@example.com', password: 'test' },
          headers: { 'Content-Type': 'application/json' }
        };
      } else if (endpoint === '/api/scan') {
        baseOptions = {
          data: { url: 'https://example.com', pagesToScan: ['https://example.com'] },
          headers: { 'Content-Type': 'application/json' }
        };
      } else {
        baseOptions = {
          data: {},
      headers: { 'Content-Type': 'application/json' }
        };
      }
    }
    
    // Test without authentication
    const noAuth = await this.makeRequest(method, endpoint, baseOptions);
    
    // Test with invalid token
    const invalidTokenOptions = {
      ...baseOptions,
      headers: {
        ...baseOptions.headers,
        'Authorization': 'Bearer invalid_token_12345'
      }
    };
    const invalidToken = await this.makeRequest(method, endpoint, invalidTokenOptions);

    // Test with malformed token
    const malformedTokenOptions = {
      ...baseOptions,
      headers: {
        ...baseOptions.headers,
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      }
    };
    const malformedToken = await this.makeRequest(method, endpoint, malformedTokenOptions);

    // Test with valid token - try to authenticate if not provided
    let validToken = null;
    if (!token) {
      token = await this.authenticate();
    }
    if (token) {
      validToken = await this.makeRequest(method, endpoint, {
        ...baseOptions,
        headers: {
          ...baseOptions.headers,
          'Authorization': `Bearer ${token}`
        }
      });
    }

    return {
      noAuth: {
        status: noAuth.status,
        authorized: noAuth.status === 401 || noAuth.status === 403,
        response: noAuth.data
      },
      invalidToken: {
        status: invalidToken.status,
        authorized: invalidToken.status === 401 || invalidToken.status === 403,
        response: invalidToken.data
      },
      malformedToken: {
        status: malformedToken.status,
        authorized: malformedToken.status === 401 || malformedToken.status === 403,
        response: malformedToken.data
      },
      validToken: validToken ? {
        status: validToken.status,
        authorized: validToken.success,
        response: validToken.data
      } : null
    };
  }

  async testRateLimiting(endpoint, method = 'POST', requests = 100, body = null) {
    const results = [];
    let rateLimited = false;
    let rateLimitCount = 0;

    const requestBody = body || { test: 'data' };

    for (let i = 0; i < requests; i++) {
      const result = await this.makeRequest(method, endpoint, {
        data: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (result.status === 429) {
        rateLimited = true;
        rateLimitCount++;
      }
      
      results.push({
        request: i + 1,
        status: result.status,
        rateLimited: result.status === 429
      });

      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      rateLimited,
      rateLimitCount,
      totalRequests: requests,
      results
    };
  }

  async testIDOR(endpoint, method = 'GET', idField = 'id', testIds = ['1', '2', '999999']) {
    const results = [];
    
    for (const id of testIds) {
      const url = endpoint.includes('?') 
        ? `${endpoint}&${idField}=${id}`
        : `${endpoint}?${idField}=${id}`;
      
      const result = await this.makeRequest(method, url);
      results.push({
        id,
        status: result.status,
        accessible: result.success && result.status !== 403 && result.status !== 404,
        response: result.data
      });
    }
    
    return results;
  }

  isVulnerableResponse(result) {
    // Check if response indicates SQL injection vulnerability
    if (!result.data) return false;
    const dataStr = JSON.stringify(result.data).toLowerCase();
    const errorIndicators = [
      'sql syntax',
      'mysql',
      'postgresql',
      'ora-',
      'sqlite',
      'sql error',
      'database error',
      'query failed'
    ];
    return errorIndicators.some(indicator => dataStr.includes(indicator));
  }

  isXSSVulnerable(result) {
    if (!result.data) return false;
    const dataStr = JSON.stringify(result.data);
    return dataStr.includes('<script>') || dataStr.includes('onerror=') || dataStr.includes('javascript:');
  }

  containsSensitiveData(result) {
    if (!result.data) return false;
    const dataStr = JSON.stringify(result.data).toLowerCase();
    return dataStr.includes('root:') || dataStr.includes('password') || dataStr.includes('secret');
  }

  containsCommandOutput(result) {
    if (!result.data) return false;
    const dataStr = JSON.stringify(result.data).toLowerCase();
    return dataStr.includes('uid=') || dataStr.includes('gid=') || dataStr.includes('groups=');
  }

  async testFileUpload(endpoint, fileName, fileType, base64Content) {
    try {
      const body = {
        fileName: fileName,
        fileType: fileType,
        fileContent: base64Content,
        fileSize: Buffer.from(base64Content, 'base64').length
      };
      
      // Get authenticated options
      const authOptions = await this.getAuthenticatedOptions({
        data: body,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await this.makeRequest('POST', endpoint, authOptions);
      
      return result;
    } catch (error) {
      return {
        status: 0,
        error: error.message,
        success: false
      };
    }
  }
}


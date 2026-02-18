import autocannon from 'autocannon';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * Load Test Suite
 * Tests API endpoints under various load conditions
 */
export class LoadTests {
  constructor() {
    this.baseURL = BASE_URL;
    this.results = [];
    this.authToken = null;
  }

  /**
   * Authenticate and get auth token
   */
  async authenticate() {
    if (this.authToken) {
      return this.authToken;
    }

    const testEmail = process.env.TEST_EMAIL || 'kirby.peter@hotmail.co.uk';
    const testPassword = process.env.TEST_PASSWORD || 'Peter!23';

    try {
      const response = await axios.post(`${this.baseURL}/api/auth`, {
        action: 'login',
        email: testEmail,
        password: testPassword
      }, {
        validateStatus: () => true // Don't throw on any status
      });

      if (response.status === 200 && response.data?.success && response.data?.token) {
        this.authToken = response.data.token;
        console.log(`✅ Authenticated as ${testEmail}`);
        return this.authToken;
      } else {
        console.warn(`⚠️  Authentication failed: Status ${response.status}, Response:`, response.data);
        return null;
      }
    } catch (error) {
      console.warn('⚠️  Authentication error:', error.message);
      if (error.response) {
        console.warn(`   Status: ${error.response.status}, Data:`, error.response.data);
      }
      return null;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Load Tests...\n');

    // Authenticate first
    console.log('🔐 Authenticating test user...');
    const token = await this.authenticate();
    if (token) {
      console.log('✅ Authentication successful\n');
    } else {
      console.warn('⚠️  Authentication failed - some tests will be skipped\n');
    }

    await this.testAuthenticationLoad();
    await this.testAPILoad();
    await this.testConcurrentRequests();
    await this.testSustainedLoad();

    return this.results;
  }

  /**
   * Test authentication endpoint under load
   */
  async testAuthenticationLoad() {
    console.log('📋 Testing Authentication Endpoint Load...');

    const instance = autocannon({
      url: `${this.baseURL}/api/auth`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'login',
        email: 'test@example.com',
        password: 'testpassword123'
      }),
      connections: 10, // 10 concurrent connections
      duration: 30, // 30 seconds
      pipelining: 1
    });

    const result = await this.waitForResult(instance, 'Authentication Load Test');
    
    this.results.push({
      name: 'Authentication Load Test',
      ...result,
      threshold: {
        requestsPerSecond: 50,
        latency: 1000, // 1 second
        errors: 0.01 // 1% error rate
      }
    });
  }

  /**
   * Test general API endpoints under load
   */
  async testAPILoad() {
    console.log('📋 Testing API Endpoints Load...');

    const endpoints = [
      { path: '/api/user', method: 'GET', requiresAuth: true },
      { path: '/api/credits', method: 'GET', requiresAuth: true },
      { path: '/api/scan-history', method: 'GET', requiresAuth: true },
      { path: '/api/backlog', method: 'GET', requiresAuth: true }
    ];

    // Use authenticated token
    const authToken = this.authToken;

    for (const endpoint of endpoints) {
      if (endpoint.requiresAuth && !authToken) {
        console.log(`⏭️  Skipping ${endpoint.path} - requires authentication`);
        continue;
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const instance = autocannon({
        url: `${this.baseURL}${endpoint.path}`,
        method: endpoint.method,
        headers,
        connections: 5,
        duration: 20,
        pipelining: 1
      });

      const result = await this.waitForResult(instance, `${endpoint.method} ${endpoint.path}`);
      
      this.results.push({
        name: `API Load: ${endpoint.path}`,
        ...result,
        threshold: {
          requestsPerSecond: 100,
          latency: 500,
          errors: 0.01
        }
      });
    }
  }

  /**
   * Test concurrent request handling
   */
  async testConcurrentRequests() {
    console.log('📋 Testing Concurrent Request Handling...');

    const instance = autocannon({
      url: `${this.baseURL}/api/free-scan`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com'
      }),
      connections: 20, // 20 concurrent connections
      duration: 15,
      pipelining: 1
    });

    const result = await this.waitForResult(instance, 'Concurrent Requests Test');
    
    this.results.push({
      name: 'Concurrent Requests Test',
      ...result,
      threshold: {
        requestsPerSecond: 1, // Free-scan is a heavy operation
        latency: 15000, // 15 seconds for heavy operations
        errors: 0.50 // 50% error rate acceptable for heavy operations
      }
    });
  }

  /**
   * Test sustained load over time
   */
  async testSustainedLoad() {
    console.log('📋 Testing Sustained Load...');

    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const instance = autocannon({
      url: `${this.baseURL}/api/user`,
      method: 'GET',
      headers,
      connections: 5,
      duration: 60, // 1 minute sustained load
      pipelining: 1
    });

    const result = await this.waitForResult(instance, 'Sustained Load Test');
    
    this.results.push({
      name: 'Sustained Load Test',
      ...result,
      threshold: {
        requestsPerSecond: 50,
        latency: 1000,
        errors: 0.01
      }
    });
  }

  /**
   * Wait for autocannon result and format it
   */
  waitForResult(instance, testName) {
    return new Promise((resolve) => {
      let result = null;

      instance.on('done', (result) => {
        resolve({
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            mean: result.requests.mean,
            p99: result.requests.p99,
            p95: result.requests.p95,
            p90: result.requests.p90
          },
          latency: {
            mean: result.latency.mean,
            p99: result.latency.p99,
            p95: result.latency.p95,
            p90: result.latency.p90,
            min: result.latency.min,
            max: result.latency.max
          },
          throughput: {
            average: result.throughput.average,
            mean: result.throughput.mean
          },
          errors: result.errors,
          timeouts: result.timeouts,
          duration: result.duration,
          requestsPerSecond: result.requests.average,
          bytesPerSecond: result.throughput.average
        });
      });

      instance.on('error', (error) => {
        console.error(`Error in ${testName}:`, error.message);
        resolve({
          error: error.message,
          requests: { total: 0 },
          latency: { mean: 0 },
          throughput: { average: 0 },
          errors: 1,
          timeouts: 0
        });
      });
    });
  }
}


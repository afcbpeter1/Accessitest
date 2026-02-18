import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * Performance Test Suite
 * Tests API endpoints for response times, throughput, and resource usage
 */
export class PerformanceTests {
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
    console.log('⚡ Starting Performance Tests...\n');

    // Authenticate first
    console.log('🔐 Authenticating test user...');
    const token = await this.authenticate();
    if (token) {
      console.log('✅ Authentication successful\n');
    } else {
      console.warn('⚠️  Authentication failed - some tests will be skipped\n');
    }

    await this.testResponseTimes();
    await this.testEndpointPerformance();
    await this.testDatabaseQueryPerformance();
    await this.testMemoryUsage();
    await this.testErrorHandlingPerformance();

    return this.results;
  }

  /**
   * Test response times for various endpoints
   */
  async testResponseTimes() {
    console.log('📋 Testing Response Times...');

    const endpoints = [
      { path: '/api/auth', method: 'POST', body: { action: 'login', email: 'test@example.com', password: 'test' } },
      { path: '/api/free-scan', method: 'POST', body: { url: 'https://example.com' } },
      { path: '/api/user', method: 'GET', requiresAuth: true },
      { path: '/api/credits', method: 'GET', requiresAuth: true }
    ];

    for (const endpoint of endpoints) {
      if (endpoint.requiresAuth && !this.authToken) {
        console.log(`⏭️  Skipping ${endpoint.path} - requires authentication`);
        continue;
      }

      const times = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.path}`,
            data: endpoint.body,
            headers: {
              'Content-Type': 'application/json',
              ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
            },
            validateStatus: () => true // Don't throw on any status
          });
          const endTime = Date.now();
          times.push(endTime - startTime);
        } catch (error) {
          times.push(-1); // Error
        }
      }

      const validTimes = times.filter(t => t > 0);
      const average = validTimes.length > 0 
        ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length 
        : 0;
      const min = validTimes.length > 0 ? Math.min(...validTimes) : 0;
      const max = validTimes.length > 0 ? Math.max(...validTimes) : 0;
      const sorted = [...validTimes].sort((a, b) => a - b);
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
      const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

      this.results.push({
        name: `Response Time: ${endpoint.path}`,
        endpoint: endpoint.path,
        method: endpoint.method,
        average: Math.round(average),
        min: Math.round(min),
        max: Math.round(max),
        p95: Math.round(p95),
        p99: Math.round(p99),
        successRate: (validTimes.length / iterations) * 100,
        iterations,
        passed: average < 2000 && (validTimes.length / iterations) > 0.9, // < 2s average, > 90% success
        threshold: {
          average: 2000,
          p95: 3000,
          p99: 5000,
          successRate: 90
        }
      });
    }
  }

  /**
   * Test endpoint performance under normal load
   */
  async testEndpointPerformance() {
    console.log('📋 Testing Endpoint Performance...');

    const endpoints = [
      { path: '/api/scan-history', method: 'GET', requiresAuth: true },
      { path: '/api/backlog', method: 'GET', requiresAuth: true },
      { path: '/api/issues-board', method: 'GET', requiresAuth: true }
    ];

    for (const endpoint of endpoints) {
      if (endpoint.requiresAuth && !this.authToken) {
        console.log(`⏭️  Skipping ${endpoint.path} - requires authentication`);
        continue;
      }

      const concurrentRequests = 5;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.path}`,
            headers: {
              'Content-Type': 'application/json',
              ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
            },
            validateStatus: () => true
          }).catch((error) => {
            // Preserve actual response status if available
            const status = error.response?.status || 500;
            return { status, data: error.response?.data || { error: error.message } };
          })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      const successCount = responses.filter(r => r.status >= 200 && r.status < 300).length;
      const successRate = (successCount / concurrentRequests) * 100;
      
      // Log authentication issues for debugging
      if (successRate === 0 && endpoint.requiresAuth) {
        const authErrors = responses.filter(r => r.status === 401 || r.status === 403);
        if (authErrors.length > 0) {
          console.warn(`⚠️  ${endpoint.path} returned ${authErrors[0].status}: ${JSON.stringify(authErrors[0].data)}`);
        }
      }

      this.results.push({
        name: `Endpoint Performance: ${endpoint.path}`,
        endpoint: endpoint.path,
        concurrentRequests,
        totalTime: Math.round(totalTime),
        averageTime: Math.round(averageTime),
        successRate: Math.round(successRate),
        successCount,
        passed: averageTime < 1000 && successRate > 90,
        threshold: {
          averageTime: 1000,
          successRate: 90
        }
      });
    }
  }

  /**
   * Test database query performance (indirectly through API)
   */
  async testDatabaseQueryPerformance() {
    console.log('📋 Testing Database Query Performance...');

    if (!this.authToken) {
      console.log('⏭️  Skipping database query tests - requires authentication');
      return;
    }

    // Test endpoints that perform database queries
    const endpoints = [
      { path: '/api/scan-history', name: 'Scan History Query' },
      { path: '/api/backlog', name: 'Backlog Query' },
      { path: '/api/issues-board', name: 'Issues Board Query' }
    ];

    for (const endpoint of endpoints) {
      const times = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        try {
          const response = await axios({
            method: 'GET',
            url: `${this.baseURL}${endpoint.path}`,
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true
          });
          const endTime = Date.now();
          // Only count successful responses
          if (response.status >= 200 && response.status < 300) {
            times.push(endTime - startTime);
          } else {
            times.push(-1);
          }
        } catch (error) {
          times.push(-1);
        }
      }

      const validTimes = times.filter(t => t > 0);
      const average = validTimes.length > 0 
        ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length 
        : 0;

      this.results.push({
        name: `Database Query: ${endpoint.name}`,
        endpoint: endpoint.path,
        averageQueryTime: Math.round(average),
        iterations,
        successRate: (validTimes.length / iterations) * 100,
        passed: average < 500, // < 500ms for DB queries
        threshold: {
          averageQueryTime: 500
        }
      });
    }
  }

  /**
   * Test memory usage patterns (basic check)
   */
  async testMemoryUsage() {
    console.log('📋 Testing Memory Usage...');

    const initialMemory = process.memoryUsage();
    
    // Make multiple requests to check for memory leaks
    const requests = 20;
    const promises = [];

    for (let i = 0; i < requests; i++) {
      promises.push(
        axios({
          method: 'GET',
          url: `${this.baseURL}/api/free-scan`,
          validateStatus: () => true
        }).catch(() => ({}))
      );
    }

    await Promise.all(promises);

    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalMemory = process.memoryUsage();
    const memoryIncrease = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss
    };

    this.results.push({
      name: 'Memory Usage Test',
      initialMemory: {
        heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024), // MB
        external: Math.round(initialMemory.external / 1024 / 1024),
        rss: Math.round(initialMemory.rss / 1024 / 1024)
      },
      finalMemory: {
        heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
        external: Math.round(finalMemory.external / 1024 / 1024),
        rss: Math.round(finalMemory.rss / 1024 / 1024)
      },
      memoryIncrease: {
        heapUsed: Math.round(memoryIncrease.heapUsed / 1024 / 1024),
        external: Math.round(memoryIncrease.external / 1024 / 1024),
        rss: Math.round(memoryIncrease.rss / 1024 / 1024)
      },
      requests,
      passed: memoryIncrease.heapUsed < 50 * 1024 * 1024, // < 50MB increase
      threshold: {
        maxMemoryIncrease: 50 // MB
      }
    });
  }

  /**
   * Test error handling performance
   */
  async testErrorHandlingPerformance() {
    console.log('📋 Testing Error Handling Performance...');

    // Test invalid requests
    const invalidRequests = [
      { path: '/api/auth', method: 'POST', body: { action: 'invalid' } },
      { path: '/api/user', method: 'GET', requiresAuth: false }, // No auth token
      { path: '/api/nonexistent', method: 'GET' }
    ];

    for (const request of invalidRequests) {
      const startTime = Date.now();
      try {
        await axios({
          method: request.method,
          url: `${this.baseURL}${request.path}`,
          data: request.body,
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
      } catch (error) {
        // Expected
      }
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      this.results.push({
        name: `Error Handling: ${request.path}`,
        endpoint: request.path,
        responseTime: Math.round(responseTime),
        passed: responseTime < 2000, // Errors should be reasonably fast
        threshold: {
          maxResponseTime: 2000
        }
      });
    }
  }
}


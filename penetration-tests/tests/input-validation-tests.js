import { makeAuthenticatedRequest, login, generateXSSPayloads, TestResult } from '../utils/test-helpers.js';
import { config } from '../config.js';

const results = [];

console.log('\n📝 Starting Input Validation Tests...\n');

// Test 1: XSS in User Input Fields
async function testXSSInUserInput() {
  console.log('Testing: XSS in User Input Fields...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      const xssPayloads = generateXSSPayloads().slice(0, 5);
      let vulnerable = false;
      
      for (const payload of xssPayloads) {
        const response = await makeAuthenticatedRequest('PUT', '/api/user', {
          firstName: payload,
          lastName: payload,
          company: payload
        }, token);
        
        if (response.status === 200) {
          // Check if payload is stored and reflected
          const getUserResponse = await makeAuthenticatedRequest('GET', '/api/user', null, token);
          
          if (getUserResponse.status === 200 && getUserResponse.data.user) {
            const userData = getUserResponse.data.user;
            if (userData.firstName?.includes(payload) || 
                userData.lastName?.includes(payload) || 
                userData.company?.includes(payload)) {
              vulnerable = true;
              results.push(new TestResult(
                'XSS in User Input',
                false,
                {
                  severity: 'HIGH',
                  description: `XSS payload stored in user profile: ${payload.substring(0, 30)}...`,
                  recommendation: 'Sanitize and validate all user input. Use Content Security Policy (CSP) headers. Escape output when rendering.'
                }
              ));
              break;
            }
          }
        }
      }
      
      if (!vulnerable) {
        results.push(new TestResult(
          'XSS in User Input',
          true,
          { description: 'XSS payloads are properly sanitized or rejected' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'XSS in User Input',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 2: Input Length Validation
async function testInputLengthValidation() {
  console.log('Testing: Input Length Validation...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Test extremely long inputs
      const longString = 'A'.repeat(10000);
      
      const response = await makeAuthenticatedRequest('PUT', '/api/user', {
        firstName: longString,
        lastName: longString,
        company: longString
      }, token);
      
      if (response.status === 200) {
        results.push(new TestResult(
          'Input Length Validation',
          false,
          {
            severity: 'MEDIUM',
            description: 'Extremely long input (10,000 chars) was accepted without validation',
            recommendation: 'Implement maximum length validation for all input fields'
          }
        ));
      } else if (response.status === 400) {
        results.push(new TestResult(
          'Input Length Validation',
          true,
          { description: 'Input length validation is working' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Input Length Validation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 3: Email Validation
async function testEmailValidation() {
  console.log('Testing: Email Validation...');
  try {
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'test@',
      'test..test@example.com',
      'test@example',
      'test@example..com',
      'test @example.com',
      'test@exam ple.com'
    ];
    
    let invalidEmailAccepted = false;
    for (const email of invalidEmails) {
      const response = await makeAuthenticatedRequest('POST', '/api/auth', {
        action: 'register',
        email: email,
        password: 'ValidPassword123!',
        name: 'Test User'
      });
      
      if (response.status === 200 && response.data.success) {
        invalidEmailAccepted = true;
        results.push(new TestResult(
          'Email Validation',
          false,
          {
            severity: 'MEDIUM',
            description: `Invalid email format accepted: ${email}`,
            recommendation: 'Implement strict email validation using regex or a validation library'
          }
        ));
        break;
      }
    }
    
    if (!invalidEmailAccepted) {
      results.push(new TestResult(
        'Email Validation',
        true,
        { description: 'Email validation is working correctly' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Email Validation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 4: URL Validation
async function testURLValidation() {
  console.log('Testing: URL Validation...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      const invalidUrls = [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'http://[::1]',
        'http://localhost:3000',
        'http://127.0.0.1',
        'http://192.168.1.1',
        'http://10.0.0.1',
        'not-a-url',
        'http://',
        'https://example.com:99999'
      ];
      
      let invalidUrlAccepted = false;
      for (const url of invalidUrls) {
        const response = await makeAuthenticatedRequest('POST', '/api/scan', {
          url: url,
          pagesToScan: [url]
        }, token);
        
        // Check if invalid URL is accepted
        if (response.status === 200 || (response.status !== 400 && response.status !== 422)) {
          // Some URLs might be valid (like localhost for testing), so be careful
          if (url.startsWith('javascript:') || url.startsWith('file://')) {
            invalidUrlAccepted = true;
            results.push(new TestResult(
              'URL Validation',
              false,
              {
                severity: 'HIGH',
                description: `Dangerous URL scheme accepted: ${url}`,
                recommendation: 'Whitelist allowed URL schemes (http, https) and validate URL format strictly'
              }
            ));
            break;
          }
        }
      }
      
      if (!invalidUrlAccepted) {
        results.push(new TestResult(
          'URL Validation',
          true,
          { description: 'URL validation appears to be working' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'URL Validation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 5: Type Confusion
async function testTypeConfusion() {
  console.log('Testing: Type Confusion...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try sending wrong data types
      const typeConfusionTests = [
        { firstName: 12345, lastName: 'Test', company: 'Test' },
        { firstName: null, lastName: 'Test', company: 'Test' },
        { firstName: {}, lastName: 'Test', company: 'Test' },
        { firstName: [], lastName: 'Test', company: 'Test' }
      ];
      
      let typeConfusionVulnerable = false;
      for (const testData of typeConfusionTests) {
        const response = await makeAuthenticatedRequest('PUT', '/api/user', testData, token);
        
        if (response.status === 200) {
          typeConfusionVulnerable = true;
          results.push(new TestResult(
            'Type Confusion',
            false,
            {
              severity: 'MEDIUM',
              description: 'Invalid data types accepted without validation',
              recommendation: 'Implement strict type validation using schema validation (e.g., Zod, Joi)'
            }
          ));
          break;
        }
      }
      
      if (!typeConfusionVulnerable) {
        results.push(new TestResult(
          'Type Confusion',
          true,
          { description: 'Type validation is working' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Type Confusion',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Run all tests
async function runAllTests() {
  await testXSSInUserInput();
  await testInputLengthValidation();
  await testEmailValidation();
  await testURLValidation();
  await testTypeConfusion();
  
  console.log('\n📊 Input Validation Test Results:\n');
  results.forEach(result => console.log(result.toString()));
  
  return results;
}

export { runAllTests, results };

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(() => {
    process.exit(0);
  });
}


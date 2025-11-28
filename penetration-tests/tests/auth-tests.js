import { makeAuthenticatedRequest, login, register, createManipulatedToken, TestResult } from '../utils/test-helpers.js';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const results = [];

console.log('\n🔐 Starting Authentication Security Tests...\n');

// Test 1: Weak JWT Secret
async function testWeakJWTSecret() {
  console.log('Testing: Weak JWT Secret...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to verify with default/weak secrets
      const weakSecrets = [
        'your-secret-key-change-in-production',
        'secret',
        'password',
        '123456',
        '',
        config.jwtSecret
      ];
      
      let vulnerable = false;
      for (const secret of weakSecrets) {
        try {
          jwt.verify(token, secret);
          vulnerable = true;
          results.push(new TestResult(
            'Weak JWT Secret',
            false,
            {
              severity: 'CRITICAL',
              description: `JWT token can be verified with weak/default secret: ${secret}`,
              recommendation: 'Use a strong, randomly generated JWT_SECRET (minimum 32 characters)'
            }
          ));
          break;
        } catch {}
      }
      
      if (!vulnerable) {
        results.push(new TestResult(
          'Weak JWT Secret',
          true,
          { description: 'JWT secret appears to be strong' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Weak JWT Secret',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 2: JWT Token Manipulation
async function testJWTManipulation() {
  console.log('Testing: JWT Token Manipulation...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      // Try to manipulate token to escalate privileges
      const manipulatedTokens = [
        createManipulatedToken(token, { plan: 'complete_access' }),
        createManipulatedToken(token, { emailVerified: true }),
        createManipulatedToken(token, { userId: 'admin-user-id' })
      ];
      
      let vulnerable = false;
      for (const manipulatedToken of manipulatedTokens) {
        if (manipulatedToken) {
          const response = await makeAuthenticatedRequest(
            'GET',
            '/api/user',
            null,
            manipulatedToken
          );
          
          if (response.status === 200) {
            vulnerable = true;
            results.push(new TestResult(
              'JWT Token Manipulation',
              false,
              {
                severity: 'CRITICAL',
                description: 'Manipulated JWT token was accepted by the server',
                recommendation: 'Always verify JWT signature on the server side. Never trust client-provided tokens without verification.'
              }
            ));
            break;
          }
        }
      }
      
      if (!vulnerable) {
        results.push(new TestResult(
          'JWT Token Manipulation',
          true,
          { description: 'JWT tokens are properly validated' }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'JWT Token Manipulation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 3: Token Expiration
async function testTokenExpiration() {
  console.log('Testing: Token Expiration...');
  try {
    const token = await login(config.testUser.email, config.testUser.password);
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const expirationTime = decoded.exp * 1000;
        const now = Date.now();
        const timeUntilExpiry = expirationTime - now;
        
        if (timeUntilExpiry > 24 * 60 * 60 * 1000) {
          results.push(new TestResult(
            'Token Expiration',
            false,
            {
              severity: 'MEDIUM',
              description: `JWT token expires in ${Math.round(timeUntilExpiry / (60 * 60 * 1000))} hours (too long)`,
              recommendation: 'Reduce token expiration time to 15-30 minutes for better security'
            }
          ));
        } else {
          results.push(new TestResult(
            'Token Expiration',
            true,
            { description: 'Token expiration time is reasonable' }
          ));
        }
      } else {
        results.push(new TestResult(
          'Token Expiration',
          false,
          {
            severity: 'HIGH',
            description: 'JWT token has no expiration time',
            recommendation: 'Always set expiration time (exp) in JWT tokens'
          }
        ));
      }
    }
  } catch (error) {
    results.push(new TestResult(
      'Token Expiration',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 4: Brute Force Protection
async function testBruteForceProtection() {
  console.log('Testing: Brute Force Protection...');
  try {
    let failedAttempts = 0;
    const maxAttempts = 10;
    
    for (let i = 0; i < maxAttempts; i++) {
      const response = await makeAuthenticatedRequest('POST', '/api/auth', {
        action: 'login',
        email: config.testUser.email,
        password: 'wrongpassword123'
      });
      
      if (response.status === 401) {
        failedAttempts++;
      } else if (response.status === 429) {
        results.push(new TestResult(
          'Brute Force Protection',
          true,
          { description: 'Rate limiting is active after multiple failed attempts' }
        ));
        return;
      }
    }
    
    if (failedAttempts === maxAttempts) {
      results.push(new TestResult(
        'Brute Force Protection',
        false,
        {
          severity: 'HIGH',
          description: `No rate limiting detected after ${maxAttempts} failed login attempts`,
          recommendation: 'Implement rate limiting for authentication endpoints (e.g., max 5 attempts per IP per 15 minutes)'
        }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Brute Force Protection',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 5: Password Strength
async function testPasswordStrength() {
  console.log('Testing: Password Strength Validation...');
  try {
    const weakPasswords = [
      '123456',
      'password',
      'abc123',
      'qwerty',
      'password123'
    ];
    
    let weakPasswordAccepted = false;
    for (const weakPassword of weakPasswords) {
      const response = await register(
        `test${Date.now()}@example.com`,
        weakPassword,
        'Test User'
      );
      
      if (response.status === 200 && response.data.success) {
        weakPasswordAccepted = true;
        results.push(new TestResult(
          'Password Strength Validation',
          false,
          {
            severity: 'MEDIUM',
            description: `Weak password "${weakPassword}" was accepted during registration`,
            recommendation: 'Enforce strong password requirements (min 12 chars, uppercase, lowercase, number, special char)'
          }
        ));
        break;
      }
    }
    
    if (!weakPasswordAccepted) {
      results.push(new TestResult(
        'Password Strength Validation',
        true,
        { description: 'Password strength validation is working' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Password Strength Validation',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Test 6: Account Enumeration
async function testAccountEnumeration() {
  console.log('Testing: Account Enumeration...');
  try {
    const existingUserResponse = await makeAuthenticatedRequest('POST', '/api/auth', {
      action: 'login',
      email: config.testUser.email,
      password: 'wrongpassword'
    });
    
    const nonExistingUserResponse = await makeAuthenticatedRequest('POST', '/api/auth', {
      action: 'login',
      email: `nonexistent${Date.now()}@example.com`,
      password: 'wrongpassword'
    });
    
    // Check if error messages differ (indicating account enumeration vulnerability)
    if (existingUserResponse.data.error !== nonExistingUserResponse.data.error) {
      results.push(new TestResult(
        'Account Enumeration',
        false,
        {
          severity: 'MEDIUM',
          description: 'Different error messages for existing vs non-existing users allow account enumeration',
          recommendation: 'Use generic error messages: "Invalid email or password" for both cases'
        }
      ));
    } else {
      results.push(new TestResult(
        'Account Enumeration',
        true,
        { description: 'Account enumeration protection is working' }
      ));
    }
  } catch (error) {
    results.push(new TestResult(
      'Account Enumeration',
      false,
      { severity: 'MEDIUM', description: `Test failed: ${error.message}` }
    ));
  }
}

// Run all tests
async function runAllTests() {
  await testWeakJWTSecret();
  await testJWTManipulation();
  await testTokenExpiration();
  await testBruteForceProtection();
  await testPasswordStrength();
  await testAccountEnumeration();
  
  console.log('\n📊 Authentication Test Results:\n');
  results.forEach(result => console.log(result.toString()));
  
  return results;
}

// Export for use in main test runner
export { runAllTests, results };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(() => {
    process.exit(0);
  });
}


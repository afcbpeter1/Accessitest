import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Make an authenticated API request
 */
export async function makeAuthenticatedRequest(method, endpoint, data = null, token = null) {
  const url = `${config.baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await axios({
      method,
      url,
      data,
      headers,
      validateStatus: () => true, // Don't throw on any status
      timeout: config.timeout
    });
    
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { error: error.message },
      error: error.message
    };
  }
}

/**
 * Login and get JWT token
 */
export async function login(email, password) {
  const response = await makeAuthenticatedRequest('POST', '/api/auth', {
    action: 'login',
    email,
    password
  });
  
  if (response.status === 200 && response.data.success) {
    return response.data.token;
  }
  
  return null;
}

/**
 * Register a new user
 */
export async function register(email, password, name, company = null) {
  return await makeAuthenticatedRequest('POST', '/api/auth', {
    action: 'register',
    email,
    password,
    name,
    company
  });
}

/**
 * Create a manipulated JWT token
 */
export function createManipulatedToken(originalToken, modifications = {}) {
  try {
    // Decode without verification
    const decoded = jwt.decode(originalToken, { complete: true });
    
    if (!decoded) {
      return null;
    }
    
    // Modify payload
    const payload = {
      ...decoded.payload,
      ...modifications
    };
    
    // Sign with known secret (or try to sign without secret)
    try {
      return jwt.sign(payload, config.jwtSecret);
    } catch {
      // If signing fails, return the modified payload as base64
      return Buffer.from(JSON.stringify(payload)).toString('base64');
    }
  } catch (error) {
    return null;
  }
}

/**
 * Test result formatter
 */
export class TestResult {
  constructor(name, passed, details = {}) {
    this.name = name;
    this.passed = passed;
    this.severity = details.severity || (passed ? 'INFO' : 'HIGH');
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
  
  toString() {
    const status = this.passed ? '✓ PASS' : '✗ FAIL';
    const severity = `[${this.severity}]`;
    return `${status} ${severity} ${this.name}`;
  }
}

/**
 * Generate SQL injection payloads
 */
export function generateSQLInjectionPayloads() {
  return [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' OR '1'='1' /*",
    "admin'--",
    "admin'/*",
    "' UNION SELECT NULL--",
    "1' OR '1'='1",
    "1' UNION SELECT username, password FROM users--",
    "'; DROP TABLE users; --",
    "' OR 1=1--",
    "' OR 'a'='a",
    "' OR 1=1#",
    "') OR ('1'='1",
    "1' AND '1'='1",
    "1' AND '1'='2",
    "' OR SLEEP(5)--",
    "'; WAITFOR DELAY '00:00:05'--"
  ];
}

/**
 * Generate XSS payloads
 */
export function generateXSSPayloads() {
  return [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<body onload=alert('XSS')>",
    "<iframe src=javascript:alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<select onfocus=alert('XSS') autofocus>",
    "<textarea onfocus=alert('XSS') autofocus>",
    "<keygen onfocus=alert('XSS') autofocus>",
    "<video><source onerror=alert('XSS')>",
    "<audio src=x onerror=alert('XSS')>",
    "<details open ontoggle=alert('XSS')>",
    "<marquee onstart=alert('XSS')>",
    "<div onmouseover=alert('XSS')>",
    "<style>@import'javascript:alert(\"XSS\")';</style>"
  ];
}

/**
 * Generate path traversal payloads
 */
export function generatePathTraversalPayloads() {
  return [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%2f..%2f..%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd"
  ];
}


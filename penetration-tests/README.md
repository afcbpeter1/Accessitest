# Penetration Testing Suite for Accessitest

This comprehensive penetration testing suite tests your application for common security vulnerabilities.

## Setup

1. Install dependencies:
```bash
cd penetration-tests
npm install
```

2. Configure test settings in `config.js` or set environment variables:
```bash
export APP_URL=http://localhost:3000
export TEST_USER_EMAIL=test@example.com
export TEST_USER_PASSWORD=YourTestPassword123!
export JWT_SECRET=your-jwt-secret-if-known
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:auth          # Authentication tests
npm run test:authorization  # Authorization tests
npm run test:injection     # Injection attack tests
npm run test:input          # Input validation tests
npm run test:file           # File upload tests
npm run test:rate-limit     # Rate limiting tests
npm run test:payment        # Payment security tests
```

## Test Coverage

### Authentication Tests
- Weak JWT secret detection
- JWT token manipulation
- Token expiration validation
- Brute force protection
- Password strength validation
- Account enumeration

### Authorization Tests
- Horizontal privilege escalation
- Vertical privilege escalation
- Missing authorization checks
- IDOR (Insecure Direct Object Reference)
- Plan/subscription bypass

### Injection Tests
- SQL injection
- Command injection
- NoSQL injection (if applicable)

### Input Validation Tests
- XSS (Cross-Site Scripting)
- Input length validation
- Email validation
- URL validation
- Type confusion

### File Upload Tests
- File type validation
- File size limits
- Path traversal
- Filename sanitization
- Malicious file content

### Rate Limiting Tests
- API rate limiting
- Scan endpoint rate limiting
- Registration rate limiting
- Free scan rate limiting

### Payment Security Tests
- Webhook signature verification
- Price manipulation
- Credit manipulation
- Payment amount validation
- Replay attack protection

## Understanding Results

- **✓ PASS**: Test passed, no vulnerability detected
- **✗ FAIL**: Test failed, potential vulnerability found

### Severity Levels
- **CRITICAL**: Immediate security risk, fix immediately
- **HIGH**: Significant security risk, fix as soon as possible
- **MEDIUM**: Moderate risk, should be addressed
- **LOW**: Minor issue, consider fixing

## Report

After running tests, a detailed JSON report is generated: `penetration-test-report.json`

## Important Notes

1. **Test Environment**: Run these tests against a development/staging environment, not production
2. **Test Accounts**: Create dedicated test accounts for testing
3. **Data Safety**: Some tests may create test data - clean up after testing
4. **Rate Limiting**: Tests may trigger rate limits - wait between test runs if needed
5. **Manual Verification**: Some vulnerabilities require manual verification

## Recommendations

After reviewing the test results:
1. Prioritize fixing CRITICAL and HIGH severity issues
2. Review recommendations provided for each failed test
3. Implement security best practices
4. Re-run tests after fixes to verify
5. Consider professional security audit for production

## Disclaimer

This testing suite is designed to help identify common security vulnerabilities. It is not a substitute for professional security audits. Always follow security best practices and consider engaging security professionals for production applications.


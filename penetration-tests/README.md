# Penetration Test Suite

This directory contains comprehensive penetration tests for the AccessScan SaaS platform, covering both API security and database security.

## Overview

The penetration test suite includes:
- **API Security Tests**: Authentication, authorization, input validation, rate limiting, IDOR, XSS, command injection, and path traversal
- **Database Security Tests**: SQL injection protection, privilege escalation, schema enumeration, data exposure, and access control

## Setup

1. Install dependencies:
```bash
cd penetration-tests
npm install
```

2. Configure environment variables (create `.env` file):
```env
TEST_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:port/database
```

## Running Tests

### Run All Tests
```bash
npm test
# or
node test-runner.js
```

### Run Only API Tests
```bash
npm run test:api
# or
node test-runner.js --type api
```

### Run Only Database Tests
```bash
npm run test:db
# or
node test-runner.js --type db
```

## Test Results

Test results are saved to `penetration-test-report.json` in the penetration-tests directory.

## Recent Test Results Summary

### API Security Tests
- **Total Tests**: 21
- **Passed**: 13 ✅
- **Failed**: 8 ❌

**Critical Findings:**
1. **HIGH**: `/api/issues-board` endpoint is accessible without authentication
2. **HIGH**: IDOR vulnerability - can access issues with different IDs
3. **MEDIUM**: Rate limiting may not be working on some endpoints
4. **MEDIUM**: Some endpoints return 500 errors instead of proper 401/403

### Database Security Tests
- **Total Tests**: 31
- **Passed**: 11 ✅
- **Failed**: 20 ❌

**Critical Findings:**
1. **CRITICAL**: Password hash access is possible
2. **HIGH**: Can access system tables (pg_user, pg_shadow, pg_roles, etc.)
3. **HIGH**: Can create/drop tables
4. **HIGH**: Can access sensitive tables (users, user_passwords, user_credits, etc.)
5. **HIGH**: Can modify data in tables

**Note**: Many database findings are expected if the database user has full privileges. In production, the database user should have limited privileges and only access to necessary tables/functions.

## Recommendations

### API Security
1. **Fix `/api/issues-board` endpoint**: Add proper authentication middleware
2. **Implement proper authorization**: Ensure users can only access their own data
3. **Add rate limiting**: Implement rate limiting on all public endpoints
4. **Improve error handling**: Return proper 401/403 status codes instead of 500

### Database Security
1. **Limit database user privileges**: Create a dedicated database user with minimal required privileges
2. **Use read-only connections**: For queries that don't modify data
3. **Implement row-level security**: Use PostgreSQL RLS policies to restrict data access
4. **Audit database access**: Log all database queries and access attempts
5. **Encrypt sensitive data**: Ensure password hashes and API tokens are properly encrypted

## Test Structure

```
penetration-tests/
├── tests/
│   ├── api-security-tests.js    # API security test suite
│   └── database-security-tests.js # Database security test suite
├── utils/
│   ├── api-helper.js             # API testing utilities
│   └── db-helper.js              # Database testing utilities
├── test-runner.js                # Main test runner
├── package.json                  # Dependencies
└── penetration-test-report.json # Test results
```

## Security Best Practices

1. Always run tests in a test/staging environment, never in production
2. Review test results carefully and prioritize critical/high severity issues
3. Fix security issues before deploying to production
4. Run tests regularly as part of CI/CD pipeline
5. Keep test suite updated with latest security vulnerabilities

## Safety Guarantees

✅ **All tests are SAFE and NON-DESTRUCTIVE:**

- **Database tests**: READ-ONLY only (SELECT queries, COUNT queries, metadata queries)
- **Write operations**: Use transactions with automatic ROLLBACK (no data modified)
- **API tests**: Only send HTTP requests (no database access)
- **No data corruption**: All tests designed to be safe for production-like environments

See [SAFETY.md](./SAFETY.md) for detailed safety information.

## About the Terminal Errors

The errors you see in the terminal (like "❌ Auth middleware - no token found") are **EXPECTED and GOOD**:
- They show your authentication is working correctly
- They show unauthorized access is being blocked
- These are the results of penetration tests trying to access protected endpoints

These are not actual errors - they're proof that your security is working!


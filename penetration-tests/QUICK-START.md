# Quick Start Guide - Penetration Testing

## Setup (Already Done ✅)

Dependencies have been installed. You're ready to run tests!

## Running Tests

### 1. Configure Test Settings

Create a `.env` file in the `penetration-tests` directory or set environment variables:

```bash
# Required
APP_URL=http://localhost:3000  # Your app URL

# Optional (for more accurate testing)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=YourTestPassword123!
JWT_SECRET=your-jwt-secret-if-known
```

### 2. Run All Tests

```bash
cd penetration-tests
npm test
```

This will run all test suites and generate a report.

### 3. Run Individual Test Suites

```bash
npm run test:auth          # Authentication tests
npm run test:authorization  # Authorization tests
npm run test:injection      # SQL/Command injection tests
npm run test:input          # Input validation & XSS tests
npm run test:file           # File upload security tests
npm run test:rate-limit      # Rate limiting tests
npm run test:payment         # Payment security tests
```

## Understanding Results

- **✓ PASS**: No vulnerability detected
- **✗ FAIL**: Potential vulnerability found

### Severity Levels:
- **CRITICAL**: Fix immediately
- **HIGH**: Fix as soon as possible
- **MEDIUM**: Should be addressed
- **LOW**: Consider fixing

## Report

After running tests, check:
- Console output for immediate results
- `penetration-test-report.json` for detailed JSON report

## Important Notes

⚠️ **Run tests against development/staging, NOT production!**

⚠️ Some tests may create test data - clean up after testing.

⚠️ Tests may trigger rate limits - wait between runs if needed.

## Next Steps

1. Review `SECURITY-ANALYSIS.md` in the root directory for detailed security findings
2. Fix critical and high-severity issues
3. Re-run tests to verify fixes
4. Consider professional security audit for production


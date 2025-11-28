# Playwright E2E Tests

End-to-end functional tests for A11ytest.ai using Playwright.

## Prerequisites

1. **Install dependencies:**
   ```bash
   cd e2e-tests
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

3. **Ensure your app is running:**
   ```bash
   # In the main project directory
   npm run dev
   ```

## Test Configuration

Test credentials are configured in `config.js`:
- Email: `peter.kirby85@gmail.com`
- Password: `BeynacCastle2!`

You can override with environment variables:
```bash
export TEST_USER_EMAIL="your-email@example.com"
export TEST_USER_PASSWORD="YourPassword"
export APP_URL="http://localhost:3000"
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in UI mode (recommended for development)
```bash
npm run test:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Run tests in debug mode
```bash
npm run test:debug
```

### Run specific test suites
```bash
npm run test:auth      # Authentication tests
npm run test:scan      # Scan tests
npm run test:dashboard # Dashboard tests
npm run test:backlog   # Backlog tests
npm run test:issues    # Issues board tests
npm run test:sprint    # Sprint board tests
npm run test:settings  # Settings tests
```

### Run a specific test file
```bash
npx playwright test tests/auth.spec.js
```

## Test Coverage

### ✅ Authentication
- Login with valid credentials
- Login with invalid credentials
- Logout functionality
- Signup page display
- Navigation between login/signup

### ✅ Dashboard
- Dashboard display after login
- User information display
- Navigation sidebar
- Navigation to different pages
- Credits display

### ✅ Scans
- **Free Scan**: Unauthenticated scanning on home page
- **Web Scan**: Authenticated web scanning
- **Document Scan**: Document upload and scanning
- Scan history display
- Scan results viewing

### ✅ Product Backlog
- Backlog page display
- Creating new backlog items
- Editing backlog items
- Deleting backlog items

### ✅ Issues Board
- Issues board display
- Issue columns (Kanban)
- Moving issues between columns
- Filtering issues

### ✅ Sprint Board
- Sprint board display
- Sprint information
- Creating new sprints
- Sprint columns display

### ✅ Settings
- Settings page navigation
- Profile information display
- Updating profile
- Password change
- Notification preferences
- Account deletion option

### ❌ Not Tested (as requested)
- Payment flows
- Checkout process
- Subscription management

## Test Structure

```
e2e-tests/
├── tests/
│   ├── auth.spec.js           # Authentication tests
│   ├── dashboard.spec.js      # Dashboard tests
│   ├── scan/
│   │   ├── free-scan.spec.js  # Free scan tests
│   │   ├── web-scan.spec.js   # Web scan tests
│   │   └── document-scan.spec.js # Document scan tests
│   ├── scan-history.spec.js   # Scan history tests
│   ├── backlog.spec.js        # Product backlog tests
│   ├── issues-board.spec.js   # Issues board tests
│   ├── sprint-board.spec.js   # Sprint board tests
│   └── settings.spec.js       # Settings tests
├── utils/
│   ├── auth.js                # Authentication helpers
│   └── helpers.js              # General test helpers
├── config.js                   # Test configuration
├── playwright.config.js        # Playwright configuration
└── README.md                   # This file
```

## Writing New Tests

### Example Test
```javascript
import { test, expect } from '@playwright/test';
import { login } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.locator('h1')).toHaveText('My Page');
  });
});
```

## Best Practices

1. **Use helpers**: Import and use helper functions from `utils/`
2. **Wait for elements**: Always wait for elements to be visible before interacting
3. **Use data-testid**: Prefer `data-testid` attributes for selectors when possible
4. **Handle async**: Use `await` for all async operations
5. **Clean up**: Tests automatically clear storage in `beforeEach` hooks

## Debugging

### View test report
```bash
npm run report
```

### Run with trace
Tests automatically capture traces on failure. View them in the HTML report.

### Screenshots and videos
Screenshots and videos are automatically captured on test failure.

### Debug mode
```bash
npm run test:debug
```
This opens Playwright Inspector where you can step through tests.

## CI/CD Integration

Tests are configured to:
- Run in parallel (except on CI)
- Retry failed tests (2 retries on CI)
- Generate HTML reports
- Capture screenshots and videos on failure

### GitHub Actions Example
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run tests
  run: npm test

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests timing out
- Ensure your app is running on `http://localhost:3000`
- Check network connectivity
- Increase timeout in `playwright.config.js`

### Authentication failures
- Verify test credentials in `config.js`
- Ensure test user account is verified
- Check that JWT tokens are being set correctly

### Element not found
- Use `test:ui` mode to see what's happening
- Check if selectors need to be updated
- Wait for elements with `waitFor()` before interacting

### Flaky tests
- Add explicit waits for network requests
- Use `waitForLoadState('networkidle')` when needed
- Check for race conditions in test logic

## Notes

- Tests use a single authenticated user account
- Some tests may be skipped if features aren't available
- Tests are designed to be non-destructive (won't delete important data)
- Payment flows are intentionally excluded from testing


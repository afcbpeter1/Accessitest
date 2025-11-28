# k6 Load Testing Suite

Comprehensive load testing suite for A11ytest.ai using k6.

## Prerequisites

Install k6:
- **Windows**: Download from [k6.io](https://k6.io/docs/getting-started/installation/) or use `choco install k6`
- **macOS**: `brew install k6`
- **Linux**: Follow [k6 installation guide](https://k6.io/docs/getting-started/installation/)

## Quick Start

1. **Ensure your app is running:**
   ```bash
   # In the main project directory
   npm run dev
   ```

2. **Run a smoke test (verify everything works):**
   ```bash
   cd performance-tests
   npm run test:smoke
   ```

3. **Run full API load test:**
   ```bash
   npm test
   ```

## Test Scripts

### Smoke Test
Minimal load to verify system is working (1 user, 30 seconds)
```bash
npm run test:smoke
```

### API Load Test
Standard load test for API endpoints (ramps up to 20 users)
```bash
npm run test:api
# or
npm test
```

### Authentication Load Test
Tests login and token verification under load
```bash
npm run test:auth
```

### Scan Load Test
Load test for scan endpoints (lighter load, longer timeouts)
```bash
npm run test:scan
```

### Spike Test
Tests system behavior under sudden traffic spikes
```bash
npm run test:spike
```

### Stress Test
Gradually increases load to find breaking point
```bash
npm run test:stress
```

## Configuration

### Environment Variables

Set these in your environment or `.env` file:

```bash
APP_URL=http://localhost:3000
TEST_USER_EMAIL=peter.kirby85@gmail.com
TEST_USER_PASSWORD=BeynacCastle2!
```

Or edit `config.js` directly.

### Test Credentials

Default credentials are set in `config.js`:
- Email: `peter.kirby85@gmail.com`
- Password: `BeynacCastle2!`

You can override with environment variables:
```bash
export TEST_USER_EMAIL="your-email@example.com"
export TEST_USER_PASSWORD="YourPassword"
```

## Understanding Results

k6 outputs metrics including:

- **http_req_duration**: Response time statistics
  - `p(95)`: 95th percentile (95% of requests are faster)
  - `p(99)`: 99th percentile
  - `avg`, `min`, `max`

- **http_req_failed**: Error rate (should be < 1%)

- **http_reqs**: Total requests and requests per second

- **vus**: Virtual users (concurrent users)

### Example Output

```
✓ login status is 200
✓ get user status is 200
✓ get credits status is 200

checks.........................: 100% ✓ 150      ✗ 0
data_received..................: 45 kB  1.5 kB/s
data_sent......................: 12 kB  400 B/s
http_req_duration..............: avg=234.5ms min=120ms med=220ms max=500ms p(95)=450ms p(99)=480ms
http_req_failed................: 0.00%  ✓ 0       ✗ 50
http_reqs......................: 50     1.67/s
vus............................: 5      min=1     max=5
```

## Customizing Tests

Edit the test scripts in `scripts/` to:
- Adjust load patterns (stages)
- Change thresholds
- Add more endpoints
- Modify test scenarios

### Example: Adjusting Load

In any test script, modify the `stages` array:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp to 10 users over 1 minute
    { duration: '2m', target: 10 },  // Stay at 10 users for 2 minutes
    { duration: '1m', target: 0 },   // Ramp down over 1 minute
  ],
};
```

## Thresholds

Each test defines performance thresholds:

- **http_req_duration**: Response time limits
- **http_req_failed**: Maximum error rate
- **Custom metrics**: Success rates for specific operations

Tests will pass/fail based on these thresholds.

## Tips

1. **Start with smoke test** to verify setup
2. **Run during off-peak hours** for production testing
3. **Monitor your application** while tests run
4. **Adjust thresholds** based on your requirements
5. **Use spike tests** to verify rate limiting works

## Troubleshooting

### "Failed to authenticate in setup"
- Check that your app is running
- Verify credentials in `config.js` or environment variables
- Ensure the user account is verified and active

### High error rates
- Check if rate limiting is too aggressive
- Verify database connection pool size
- Check application logs for errors

### Tests timing out
- Increase timeout values in test scripts
- Reduce concurrent users
- Check network connectivity

## Advanced Usage

### Running with custom options

```bash
k6 run --vus 50 --duration 5m scripts/api-load-test.js
```

### Exporting results

```bash
k6 run --out json=results.json scripts/api-load-test.js
```

### Cloud execution

k6 can be run in k6 Cloud for distributed load testing. See [k6 Cloud documentation](https://k6.io/docs/cloud/).

## Test Coverage

- ✅ Authentication (login, token verification)
- ✅ User endpoints (user info, credits)
- ✅ Scan endpoints (scan history, free scans)
- ✅ Backlog and issues board
- ✅ Load patterns (smoke, load, spike, stress)

## Notes

- Tests use a single authenticated user account
- For multi-user scenarios, modify scripts to create/use multiple accounts
- Resource-intensive operations (scans) use lighter load patterns
- All tests include proper error handling and checks


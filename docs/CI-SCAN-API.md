# CI Scan API

Use the CI Scan API to run accessibility checks from your build pipeline. The same endpoint works for **subscription customers** (using API keys from your AccessScan account) and for **RapidAPI** (using RapidAPI auth headers).

## Use in any pipeline

**Setup is the same for every pipeline.** You only need two values and one HTTP call; the only difference is how your CI system injects them.

**1. Get your two values (same everywhere)**  
- **Base URL** – Your app origin (e.g. `https://yourapp.com`) or RapidAPI proxy URL. (One value: where you send the request. To scan multiple pages, use the `urls` array in the request body—see Request.)  
- **API key** – From **Settings → API Keys** (subscription) or from RapidAPI.

**2. Store them as secrets in your CI** (each system has its own UI for “secrets” or “variables”):

| Pipeline | Where to store | How to reference in script |
|----------|----------------|----------------------------|
| GitHub Actions | Repo or org **Secrets** | `${{ secrets.ACCESSSCAN_API_URL }}`, `${{ secrets.ACCESSSCAN_API_KEY }}` |
| GitLab CI | **CI/CD → Variables** (masked) | `$ACCESSSCAN_API_URL`, `$ACCESSSCAN_API_KEY` |
| Azure Pipelines | **Pipeline variables** (secret) | `$(ACCESSSCAN_API_URL)`, `$(ACCESSSCAN_API_KEY)` |
| Jenkins | **Credentials** or **Environment** | `$ACCESSSCAN_API_URL`, `$ACCESSSCAN_API_KEY` |
| Others | That system’s secrets/env | Same two env vars in your shell |

**3. Run the same script** in a shell step (see **Universal example** below). No pipeline-specific API logic—only the way you pass the two values in step 2 changes.

## Endpoint

```
POST /api/ci/scan
```

Base URL: your app origin (e.g. `https://yourapp.com`) or the RapidAPI proxy URL when using RapidAPI. You only have one base URL (where you send the request). To scan **multiple pages** in one request, send a `urls` array in the JSON body—see **Request** below (max 50 URLs per request).

## Authentication

### Subscription customers (your site)

- **Header**: `Authorization: Bearer <your-api-key>` or `X-API-Key: <your-api-key>`
- **API keys**: Create and manage keys under **Settings → API Keys**. You need an active subscription to create keys.
- **Rate limit**: 30 requests per minute per API key. On exceedance you receive `429` with `Retry-After` (seconds).

### RapidAPI

- Requests are sent through RapidAPI’s proxy. Use the **X-RapidAPI-Proxy-Secret** (or other headers per RapidAPI’s docs) as configured in your RapidAPI app.
- Rate limits follow your RapidAPI plan.

## Request

**Body (JSON):**

| Field   | Type     | Required | Description |
|--------|----------|----------|-------------|
| `url`  | string   | No*      | Single page URL to scan. |
| `urls` | string[] | No*      | Multiple page URLs to scan (max 50 per request). Duplicates are removed. |
| `failOn` | string | No     | `"critical"` = fail only if any critical issue. `"criticalAndSerious"` (default) = fail if any critical or serious issue. |

*At least one of `url` or `urls` is required. If both are present, `urls` is used. All URLs must be `http` or `https`; localhost and private IPs are rejected.

**Single URL example:**

```json
{
  "url": "https://staging.example.com",
  "failOn": "criticalAndSerious"
}
```

**Multiple URLs example:**

Use the **`urls`** array. Do not send multiple `"url"` keys — in JSON the second overwrites the first, so only one page would be scanned.

```json
{
  "urls": [
    "https://staging.example.com",
    "https://staging.example.com/pricing",
    "https://staging.example.com/login"
  ],
  "failOn": "criticalAndSerious"
}
```

## Response

**Success (HTTP 200)**

The response returns 200 when all scans completed. Use the top-level `passed` field to gate your build.

**Single URL:** You get the same shape as before, plus `results`:

| Field       | Type    | Description |
|------------|---------|-------------|
| `passed`   | boolean | `true` if the page passed the chosen `failOn` criteria. |
| `url`      | string  | Final URL after redirects. |
| `summary`  | object  | `total`, `critical`, `serious`, `moderate`, `minor` issue counts. |
| `issues`   | array   | List of issues (rule id, impact, description, help, helpUrl, nodes, suggestions). |
| `reportUrl`| string  | Link to the full report page for this scan. |
| `results`  | array   | One element: same as above (for consistency with multi-URL). |

**Multiple URLs:** You get an overall pass/fail and per-page results:

| Field     | Type    | Description |
|----------|---------|-------------|
| `passed` | boolean | `true` only if **every** page passed the `failOn` criteria. |
| `results`| array   | One object per URL: `url`, `passed`, `summary`, `issues`, `reportUrl`. |

Each `reportUrl` is a permanent link to a human-readable report for that page (e.g. `https://yourapp.com/reports/<id>`).

**Single-URL response example:**

```json
{
  "passed": false,
  "url": "https://staging.example.com",
  "summary": {
    "total": 3,
    "critical": 0,
    "serious": 2,
    "moderate": 1,
    "minor": 0
  },
  "issues": [...],
  "reportUrl": "https://yourapp.com/reports/abc-123",
  "results": [{ "url": "https://staging.example.com", "passed": false, "summary": {...}, "issues": [...], "reportUrl": "..." }]
}
```

**Multi-URL response example:**

```json
{
  "passed": false,
  "results": [
    { "url": "https://staging.example.com", "passed": true, "summary": {...}, "issues": [], "reportUrl": "https://yourapp.com/reports/id1" },
    { "url": "https://staging.example.com/pricing", "passed": false, "summary": {...}, "issues": [...], "reportUrl": "https://yourapp.com/reports/id2" }
  ]
}
```

## Pass/fail criteria

- **`failOn: "critical"`**  
  Each page passes when it has **no critical** issues. Overall `passed` is true only if every page passes.

- **`failOn: "criticalAndSerious"`** (default)  
  Each page passes when it has **no critical and no serious** issues. Overall `passed` is true only if every page passes.

Use the top-level `passed` in CI to fail the build (e.g. exit non-zero when `passed === false`).

## Timeout and errors

- **Timeout**: A scan is aborted after **90 seconds**. You receive HTTP **408** with `code: "TIMEOUT"`.
- **4xx/5xx** responses use a stable JSON shape: `{ "error": "<message>", "code": "<optional_code>" }`.

| Status | Meaning |
|--------|--------|
| 400    | Bad request (missing/invalid URL(s), URL not allowed e.g. localhost, or more than 50 URLs). |
| 401    | Missing or invalid API key. |
| 403    | API key valid but organization does not have API access (e.g. no active subscription). |
| 408    | Scan timed out. |
| 429    | Rate limit exceeded; check `Retry-After` header. |
| 500    | Server or scan error. |

## Example: cURL (manual test)

```bash
curl -X POST "https://yourapp.com/api/ci/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ask_your_api_key_here" \
  -d '{"url":"https://staging.example.com"}'
```

## Universal pipeline example (same for all CI systems)

Use this script in **any** pipeline. Only the way you set `API_URL` and `API_KEY` changes—see the table in **Use in any pipeline** (e.g. GitHub: `${{ secrets.ACCESSSCAN_API_URL }}`, GitLab: `$ACCESSSCAN_API_URL`, Azure: `$(ACCESSSCAN_API_URL)`).

**Single URL** (set `SCAN_URL` to the page to check):

```bash
RESP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/ci/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"url\":\"${SCAN_URL}\"}")
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
echo "$BODY" | jq .
[ "$HTTP_CODE" = "200" ] && [ "$(echo "$BODY" | jq -r .passed)" = "true" ] || exit 1
```

**Multiple URLs** (set `SCAN_URLS` to a JSON array, e.g. `'["https://a.com","https://a.com/b"]'`):

```bash
RESP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/ci/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"urls\":${SCAN_URLS}}")
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
echo "$BODY" | jq .
[ "$HTTP_CODE" = "200" ] && [ "$(echo "$BODY" | jq -r .passed)" = "true" ] || exit 1
```

You do **not** need separate instructions per pipeline—just plug in your CI’s way of supplying `API_URL` and `API_KEY` (and `SCAN_URL` or `SCAN_URLS`) from the table above.

## RapidAPI

- Use the **same** `POST /api/ci/scan` endpoint and request/response format.
- Authentication is handled by RapidAPI (proxy secret or their headers). Configure the base URL and auth in your RapidAPI app.
- Rate limits and billing are managed by your RapidAPI plan.

# Set up and run the A11ytest.ai CI Scan API

Quick guide: what you need, how to run a scan, and what to put in your pipeline YAML.

## What you need

| What | Where to get it |
|------|-----------------|
| **Base URL** | Your app origin, e.g. `https://a11ytest.ai` (no trailing slash). |
| **API key** | **A11ytest.ai** → sign in → **Settings → API Keys** → create a key. You need an active subscription. |

## Where to store them in your CI

Put the **base URL** and **API key** in your pipeline’s **secrets** (or secret variables). Never commit them.

| Pipeline | Where | How to use in the job |
|----------|--------|------------------------|
| **GitHub Actions** | Repo **Settings → Secrets and variables → Actions** | `${{ secrets.A11YTEST_API_URL }}`, `${{ secrets.A11YTEST_API_KEY }}` |
| **Azure Pipelines** | **Pipelines → Library** (variable group) or secret variable | `$(A11YTEST_API_URL)`, `$(A11YTEST_API_KEY)` |
| **GitLab CI** | **Settings → CI/CD → Variables** (masked) | `$A11YTEST_API_URL`, `$A11YTEST_API_KEY` |

Use the same two values in every pipeline; only the syntax to reference them changes (see examples below).

## How to run a scan

**Endpoint:** `POST <base-url>/api/ci/scan`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <your-api-key>`  
  (or `X-API-Key: <your-api-key>`)

**Body (JSON):**
- `url` – single URL (string), or  
- `urls` – multiple URLs (array, max 50)
- `failOn` (optional) – `"critical"` or `"criticalAndSerious"` (default)

**Success:** HTTP 200, JSON with `passed` (true/false) and `results` (per-page summary and issues). Fail the build when `passed === false`.

**Manual test (curl) – single URL:**
```bash
curl -X POST "https://a11ytest.ai/api/ci/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"url":"https://example.com"}'
```

**Manual test (curl) – list of URLs:**
```bash
curl -X POST "https://a11ytest.ai/api/ci/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"urls":["https://example.com","https://example.com/about","https://example.com/contact"]}'
```

---

## What to put in your YAML

### GitHub Actions

Add secrets: `A11YTEST_API_URL` (e.g. `https://a11ytest.ai`) and `A11YTEST_API_KEY`.

```yaml
- name: A11ytest accessibility scan
  env:
    API_URL: ${{ secrets.A11YTEST_API_URL }}
    API_KEY: ${{ secrets.A11YTEST_API_KEY }}
  run: |
    RESP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/ci/scan" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d '{"urls":["https://your-site.com","https://your-site.com/about"]}')
    HTTP_CODE=$(echo "$RESP" | tail -n1)
    BODY=$(echo "$RESP" | sed '$d')
    echo "$BODY"
    if [ "$HTTP_CODE" != "200" ]; then
      echo "::error::CI scan returned HTTP $HTTP_CODE"
      exit 1
    fi
    PASSED=$(echo "$BODY" | jq -r .passed)
    if [ "$PASSED" != "true" ]; then
      echo "::error::Accessibility scan failed (critical/serious issues)"
      exit 1
    fi
```

Replace the `urls` array with the pages you want to check.

### Azure Pipelines

Use a variable group (e.g. `a11ytest-secrets`) with `A11YTEST_API_KEY`, or a secret variable. Base URL can be a variable or hardcoded.

```yaml
variables:
  - group: a11ytest-secrets   # contains A11YTEST_API_KEY
  - name: API_URL
    value: 'https://a11ytest.ai'

steps:
  - script: |
      set -e
      RESP=$(curl -s -w "\n%{http_code}" -X POST "$(API_URL)/api/ci/scan" \
        -H "Authorization: Bearer $(A11YTEST_API_KEY)" \
        -H "Content-Type: application/json" \
        -d '{"urls":["https://your-site.com","https://your-site.com/about"]}')
      HTTP_CODE=$(echo "$RESP" | tail -n1)
      echo "$RESP" | sed '$d' > scan-result.json
      cat scan-result.json
      if [ "$HTTP_CODE" != "200" ]; then
        echo "##vso[task.logissue type=error]CI scan returned HTTP $HTTP_CODE"
        exit 1
      fi
    displayName: 'A11ytest accessibility scan'

  - script: |
      PASSED=$(python3 -c "import json; print(json.load(open('scan-result.json')).get('passed', False))")
      if [ "$PASSED" != "True" ]; then
        echo "##vso[task.logissue type=error]Accessibility scan failed"
        exit 1
      fi
    displayName: 'Check scan result'
```

### GitLab CI

Add variables `A11YTEST_API_URL` and `A11YTEST_API_KEY` (masked). Use the same `curl` + status check as in the GitHub example, with `$A11YTEST_API_URL` and `$A11YTEST_API_KEY`.

---

For full API details (rate limits, errors, multi-URL response shape, RapidAPI), see [CI-SCAN-API.md](CI-SCAN-API.md).

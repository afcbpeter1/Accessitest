/**
 * API penetration / security tests.
 * Run against a live server: npm run dev (in one terminal) then npm run pen-test
 * Base URL: API_BASE_URL env or http://localhost:3000
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:3000'

type Result = { name: string; ok: boolean; expected: string; actual: string }

async function fetchJson(
  url: string,
  opts: RequestInit & { expectStatus?: number } = {}
): Promise<{ status: number; body: unknown }> {
  const { expectStatus, ...init } = opts
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { status: res.status, body }
}

function pass(name: string, expected: string): Result {
  return { name, ok: true, expected, actual: expected }
}
function fail(name: string, expected: string, actual: string): Result {
  return { name, ok: false, expected, actual }
}

const results: Result[] = []

function assert(
  name: string,
  condition: boolean,
  expected: string,
  actual: string
): void {
  results.push(condition ? pass(name, expected) : fail(name, expected, actual))
}

// --- CI Scan API (POST /api/ci/scan) ---
async function testCiScanAuth(): Promise<void> {
  const url = `${BASE}/api/ci/scan`

  // No auth
  const noAuth = await fetchJson(url, {
    method: 'POST',
    body: JSON.stringify({ url: 'https://example.com' })
  })
  assert(
    'CI scan: no API key → 401',
    noAuth.status === 401,
    '401',
    String(noAuth.status)
  )
  const noAuthBody = noAuth.body as { error?: string }
  assert(
    'CI scan: error message mentions API key',
    typeof noAuthBody?.error === 'string' && noAuthBody.error.toLowerCase().includes('api key'),
    'error mentions API key',
    String(noAuthBody?.error ?? 'none')
  )

  // Invalid API key
  const badKey = await fetchJson(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ask_invalid_fake_key_1234567890ab' },
    body: JSON.stringify({ url: 'https://example.com' })
  })
  assert(
    'CI scan: invalid API key → 401',
    badKey.status === 401,
    '401',
    String(badKey.status)
  )

  // Wrong header (empty Bearer)
  const emptyBearer = await fetchJson(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' },
    body: JSON.stringify({ url: 'https://example.com' })
  })
  assert(
    'CI scan: empty Bearer → 401',
    emptyBearer.status === 401,
    '401',
    String(emptyBearer.status)
  )
}

async function testCiScanInputValidation(): Promise<void> {
  const url = `${BASE}/api/ci/scan`
  const hasValidKey = Boolean(process.env.PEN_TEST_API_KEY)
  const auth: Record<string, string> = hasValidKey
    ? { Authorization: `Bearer ${process.env.PEN_TEST_API_KEY!}` }
    : { 'X-API-Key': 'ask_dummy_key_for_validation_tests_only' }

  // Without valid key we get 401 before URL validation; with valid key we expect 400 for bad URLs
  const expectBadUrl = hasValidKey ? 400 : 401

  // SSRF: localhost
  const localhost = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ url: 'http://localhost:3000' })
  })
  assert(
    'CI scan: localhost URL rejected (SSRF)',
    localhost.status === expectBadUrl,
    String(expectBadUrl),
    String(localhost.status)
  )

  // SSRF: 127.0.0.1
  const loopback = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ url: 'https://127.0.0.1/' })
  })
  assert(
    'CI scan: 127.0.0.1 URL rejected (SSRF)',
    loopback.status === expectBadUrl,
    String(expectBadUrl),
    String(loopback.status)
  )

  // Private network
  const privateNet = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ url: 'http://192.168.1.1/' })
  })
  assert(
    'CI scan: private network URL rejected (SSRF)',
    privateNet.status === expectBadUrl,
    String(expectBadUrl),
    String(privateNet.status)
  )

  // Invalid protocol
  const fileProto = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ url: 'file:///etc/passwd' })
  })
  assert(
    'CI scan: file:// URL rejected',
    fileProto.status === expectBadUrl,
    String(expectBadUrl),
    String(fileProto.status)
  )

  // Too many URLs (needs valid key to reach this check; otherwise 401)
  const manyUrls = Array.from({ length: 51 }, (_, i) => `https://example-${i}.com`)
  const tooMany = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ urls: manyUrls })
  })
  assert(
    'CI scan: 51 URLs → 400 or 401',
    tooMany.status === 400 || tooMany.status === 401,
    '400 or 401',
    String(tooMany.status)
  )

  // Empty body / no URL
  const noUrl = await fetchJson(url, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({})
  })
  assert(
    'CI scan: no url/urls → 400 or 401',
    noUrl.status === 400 || noUrl.status === 401,
    '400 or 401',
    String(noUrl.status)
  )

  // Malformed JSON
  const malformed = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: 'not json'
  })
  assert(
    'CI scan: malformed JSON → 400 or 401',
    malformed.status === 400 || malformed.status === 401,
    '400 or 401',
    String(malformed.status)
  )
}

async function testCiScanMethod(): Promise<void> {
  const url = `${BASE}/api/ci/scan`
  const get = await fetch(url, { method: 'GET' })
  assert(
    'CI scan: GET not allowed (405 or 401)',
    get.status === 405 || get.status === 401,
    '405 or 401',
    String(get.status)
  )
}

// --- Reports API (GET /api/reports/[id]) ---
async function testReports(): Promise<void> {
  // Non-existent but valid-format UUID → 404
  const randomUuid = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
  const res = await fetch(`${BASE}/api/reports/${randomUuid}`)
  assert(
    'Reports: unknown ID → 404',
    res.status === 404,
    '404',
    String(res.status)
  )

  // SQL injection attempt / invalid ID format → 400 (validated before DB)
  const sqlInjectionId = "'; DROP TABLE ci_scan_reports;--"
  const encoded = encodeURIComponent(sqlInjectionId)
  const inj = await fetch(`${BASE}/api/reports/${encoded}`)
  assert(
    'Reports: invalid ID format (e.g. SQL-injection-like) → 400, no 500',
    inj.status === 400,
    '400',
    String(inj.status)
  )
}

// --- API Keys (require session auth) ---
async function testApiKeysAuth(): Promise<void> {
  // GET without auth
  const get = await fetchJson(`${BASE}/api/api-keys`, { method: 'GET' })
  assert(
    'API keys GET: no auth → 401',
    get.status === 401,
    '401',
    String(get.status)
  )

  // POST without auth
  const post = await fetchJson(`${BASE}/api/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name: 'pen-test-key' })
  })
  assert(
    'API keys POST: no auth → 401',
    post.status === 401,
    '401',
    String(post.status)
  )

  // DELETE without auth
  const del = await fetch(`${BASE}/api/api-keys/some-id`, { method: 'DELETE' })
  assert(
    'API keys DELETE: no auth → 401',
    del.status === 401,
    '401',
    String(del.status)
  )
}

async function runAll(): Promise<void> {
  console.log('API security pen tests')
  console.log('Base URL:', BASE)
  console.log('')

  await testCiScanMethod()
  await testCiScanAuth()
  await testCiScanInputValidation()
  await testReports()
  await testApiKeysAuth()

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  results.forEach((r) => {
    const icon = r.ok ? '✓' : '✗'
    console.log(`${icon} ${r.name}`)
    if (!r.ok) console.log(`    expected: ${r.expected}, got: ${r.actual}`)
  })

  console.log('')
  console.log(`Result: ${passed}/${results.length} passed`)
  if (failed.length > 0) {
    console.log('Failed:', failed.map((f) => f.name).join(', '))
    process.exit(1)
  }
}

runAll().catch((err) => {
  console.error('Pen test run failed:', err)
  process.exit(1)
})

import crypto from 'crypto'
import { query, queryOne } from '@/lib/database'

const KEY_PREFIX = 'ask_'
const KEY_BYTES = 24
const PREFIX_LENGTH = 12
const RATE_LIMIT_REQUESTS_PER_MINUTE = 30
const HASH_ALGORITHM = 'sha256'

export interface ApiKeyRecord {
  id: string
  organization_id: string
  name: string | null
  key_prefix: string
  created_at: Date
  last_used_at: Date | null
  rate_limit_tier: string
}

export interface CreateApiKeyResult {
  key: string
  id: string
  key_prefix: string
  name: string | null
  created_at: Date
}

/**
 * Generate a new API key (plain) and return hash + prefix for storage.
 */
function hashKey(plainKey: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(plainKey).digest('hex')
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

/**
 * Create a new API key for an organization. Caller must ensure org has subscription/API access.
 * Returns the plain key once; store only the hash.
 */
export async function createApiKey(
  organizationId: string,
  name?: string | null
): Promise<CreateApiKeyResult> {
  const plainKey = KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString('hex')
  const keyHash = hashKey(plainKey)
  const keyPrefix = plainKey.substring(0, PREFIX_LENGTH)

  const row = await queryOne(
    `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, rate_limit_tier)
     VALUES ($1, $2, $3, $4, 'default')
     RETURNING id, organization_id, name, key_prefix, created_at`,
    [organizationId, name || null, keyHash, keyPrefix]
  )

  return {
    key: plainKey,
    id: row.id,
    key_prefix: row.key_prefix,
    name: row.name,
    created_at: row.created_at
  }
}

/**
 * Look up an API key by plain key. Returns the record if valid; updates last_used_at.
 * Use prefix first for cheap lookup, then verify full hash.
 */
export async function lookupApiKey(plainKey: string): Promise<ApiKeyRecord | null> {
  if (!plainKey || !plainKey.startsWith(KEY_PREFIX) || plainKey.length < PREFIX_LENGTH) {
    return null
  }
  const keyPrefix = plainKey.substring(0, PREFIX_LENGTH)
  const keyHash = hashKey(plainKey)

  const row = await queryOne(
    `SELECT id, organization_id, name, key_prefix, created_at, last_used_at, rate_limit_tier
     FROM api_keys
     WHERE key_prefix = $1`,
    [keyPrefix]
  )
  if (!row) return null

  const storedHashRow = await queryOne(
    `SELECT key_hash FROM api_keys WHERE id = $1`,
    [row.id]
  )
  if (!storedHashRow || !constantTimeCompare(keyHash, storedHashRow.key_hash)) {
    return null
  }

  await query(
    `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
    [row.id]
  )

  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    rate_limit_tier: row.rate_limit_tier || 'default'
  }
}

/**
 * Check rate limit for this API key. Uses 1-minute sliding window in api_key_usage.
 * Returns true if request is allowed, false if rate limited.
 */
export async function checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const windowStartStr = windowStart.toISOString()

  await query(
    `INSERT INTO api_key_usage (api_key_id, window_start, request_count)
     VALUES ($1, $2::timestamptz, 1)
     ON CONFLICT (api_key_id, window_start)
     DO UPDATE SET request_count = api_key_usage.request_count + 1`,
    [apiKeyId, windowStartStr]
  )

  const row = await queryOne(
    `SELECT request_count FROM api_key_usage
     WHERE api_key_id = $1 AND window_start = $2::timestamptz`,
    [apiKeyId, windowStartStr]
  )
  const count = row?.request_count ?? 0
  if (count > RATE_LIMIT_REQUESTS_PER_MINUTE) {
    const retryAfter = 60 - (Date.now() / 1000) % 60
    return { allowed: false, retryAfter: Math.ceil(retryAfter) }
  }
  return { allowed: true }
}

/**
 * List API keys for an organization (prefix, name, last_used_at only; never the key).
 */
export async function listApiKeys(organizationId: string): Promise<ApiKeyRecord[]> {
  const res = await query(
    `SELECT id, organization_id, name, key_prefix, created_at, last_used_at, rate_limit_tier
     FROM api_keys
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  )
  return (res as { rows: ApiKeyRecord[] }).rows ?? []
}

/**
 * Delete an API key by id. Caller should verify the key belongs to the org.
 */
export async function deleteApiKey(apiKeyId: string, organizationId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM api_keys WHERE id = $1 AND organization_id = $2`,
    [apiKeyId, organizationId]
  )
  return ((result as { rowCount?: number }).rowCount ?? 0) > 0
}

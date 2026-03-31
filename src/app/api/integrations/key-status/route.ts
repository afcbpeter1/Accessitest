import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import crypto from 'crypto'

function deriveKeyMeta() {
  const integrationKey = process.env.INTEGRATION_ENCRYPTION_KEY
  const jiraKey = process.env.JIRA_ENCRYPTION_KEY
  const selected = integrationKey ?? jiraKey

  const keySource = integrationKey
    ? 'INTEGRATION_ENCRYPTION_KEY'
    : jiraKey
      ? 'JIRA_ENCRYPTION_KEY'
      : 'DEFAULT_DEV_KEY'

  const keyLength = selected ? selected.length : 0
  const looksHex64 = !!selected && keyLength === 64 && /^[0-9a-f]+$/i.test(selected)

  // Mirror jira-encryption-service behavior (without decrypting anything)
  let derivedKey: Buffer
  if (!selected) {
    derivedKey = crypto.scryptSync('default-dev-key-change-in-production', 'salt', 32)
  } else if (keyLength === 64) {
    // Note: in encryption service, ANY 64-char string is treated as hex.
    derivedKey = Buffer.from(selected, 'hex')
  } else {
    derivedKey = crypto.scryptSync(selected, 'jira-encryption-salt', 32)
  }

  const keyId = crypto.createHash('sha256').update(derivedKey).digest('hex').substring(0, 16)

  return {
    nodeEnv: process.env.NODE_ENV ?? null,
    keySource,
    hasIntegrationKey: !!integrationKey,
    hasJiraKey: !!jiraKey,
    selectedKeyLength: keyLength,
    selectedLooksHex64: looksHex64,
    derivedKeyId: keyId
  }
}

/**
 * GET /api/integrations/key-status
 * Debug endpoint: shows which encryption key is being used (no secrets).
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    return NextResponse.json({ success: true, ...deriveKeyMeta() })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get key status'
      },
      { status: 401 }
    )
  }
}


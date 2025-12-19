import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For AES, this is always 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

/**
 * Get encryption key from environment variable
 * Falls back to a default key if not set (for development only)
 * In production, this should always be set via environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.JIRA_ENCRYPTION_KEY
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JIRA_ENCRYPTION_KEY environment variable is required in production')
    }
    // Development fallback - warn but allow
    console.warn('⚠️  JIRA_ENCRYPTION_KEY not set, using default key (development only)')
    // Use a default key for development (32 bytes)
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH)
  }
  
  // If key is provided as hex string, convert it
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  
  // Otherwise, derive key from the string
  return crypto.scryptSync(key, 'jira-encryption-salt', KEY_LENGTH)
}

/**
 * Encrypt a Jira API token
 * @param plaintextToken - The plaintext API token to encrypt
 * @returns Object containing encrypted token, IV, and auth tag
 */
export function encryptToken(plaintextToken: string): {
  encrypted: string
  iv: string
  tag: string
  keyId: string
} {
  if (!plaintextToken) {
    throw new Error('Token cannot be empty')
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintextToken, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Generate a key ID for tracking (hash of the key, truncated)
  const keyId = crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    keyId
  }
}

/**
 * Decrypt a Jira API token
 * @param encryptedData - Object containing encrypted token, IV, and auth tag
 * @returns The decrypted plaintext token
 */
export function decryptToken(encryptedData: {
  encrypted: string
  iv: string
  tag: string
}): string {
  if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.tag) {
    throw new Error('Invalid encrypted data format')
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(encryptedData.iv, 'hex')
  const tag = Buffer.from(encryptedData.tag, 'hex')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Encrypt token for database storage
 * Combines encrypted data into a single JSON string
 */
export function encryptTokenForStorage(plaintextToken: string): string {
  const encrypted = encryptToken(plaintextToken)
  return JSON.stringify({
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag
  })
}

/**
 * Decrypt token from database storage
 * Parses JSON string and decrypts
 */
export function decryptTokenFromStorage(storedToken: string): string {
  try {
    const encryptedData = JSON.parse(storedToken)
    return decryptToken(encryptedData)
  } catch (error) {
    throw new Error(`Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}


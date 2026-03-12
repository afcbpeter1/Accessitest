/**
 * URL normalization utilities for handling various URL formats
 */

/** Max URL length to avoid abuse and ReDoS risk */
const MAX_URL_LENGTH = 2048

/**
 * Regex for valid website URL (after normalization to http/https).
 * - Protocol: http or https only
 * - Hostname: one or more labels (alphanumeric + hyphens, no leading/trailing hyphen per label), dots between
 * - Optional port (1-5 digits)
 * - Optional path, query, fragment (no unencoded spaces)
 */
const WEBSITE_URL_REGEX = /^https?:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*(?::[0-9]{1,5})?(\/[^\s#?]*)?(\?[^\s#]*)?(#.*)?$/

/**
 * Normalizes a URL by adding protocol if missing
 * Handles cases like:
 * - thelearningmanager.co.uk -> https://thelearningmanager.co.uk
 * - www.example.com -> https://www.example.com
 * - example.com -> https://example.com
 * - https://example.com -> https://example.com (unchanged)
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string')
  }

  // Trim whitespace
  const trimmedUrl = url.trim()
  
  if (!trimmedUrl) {
    throw new Error('URL cannot be empty')
  }

  // If URL already has protocol, return as-is (only http/https)
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl
  }

  // Add https:// protocol by default
  return `https://${trimmedUrl}`
}

/**
 * Validates if a string is an acceptable website URL.
 * - Only http and https are allowed (rejects javascript:, data:, file:, etc.)
 * - Requires a valid hostname (labels with letters, digits, hyphens; no empty or invalid labels)
 * - Optional port, path, query, fragment
 * - Max length 2048 characters
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false

  let normalized: string
  try {
    normalized = normalizeUrl(trimmed)
  } catch {
    return false
  }

  if (!WEBSITE_URL_REGEX.test(normalized)) return false

  try {
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    if (!parsed.hostname || parsed.hostname.length < 1) return false
    return true
  } catch {
    return false
  }
}

/**
 * Validates URL and returns an error message if invalid (for form validation).
 */
export function validateWebsiteUrl(url: string): { valid: true; normalized: string } | { valid: false; error: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Please enter a URL.' }
  }
  const trimmed = url.trim()
  if (!trimmed) {
    return { valid: false, error: 'Please enter a URL.' }
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL is too long.' }
  }
  let normalized: string
  try {
    normalized = normalizeUrl(trimmed)
  } catch {
    return { valid: false, error: 'URL cannot be empty.' }
  }
  if (!WEBSITE_URL_REGEX.test(normalized)) {
    return { valid: false, error: 'Please enter a valid URL (e.g. example.com or https://example.com).' }
  }
  try {
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http and https URLs are allowed.' }
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'Please enter a valid domain.' }
    }
    return { valid: true, normalized }
  } catch {
    return { valid: false, error: 'Please enter a valid URL (e.g. example.com or https://example.com).' }
  }
}

/**
 * Extracts domain from URL for display purposes
 */
export function extractDomain(url: string): string {
  try {
    const normalizedUrl = normalizeUrl(url)
    const urlObj = new URL(normalizedUrl)
    return urlObj.hostname
  } catch {
    return url
  }
}

/**
 * Gets display-friendly URL (removes protocol for cleaner display)
 */
export function getDisplayUrl(url: string): string {
  try {
    const normalizedUrl = normalizeUrl(url)
    const urlObj = new URL(normalizedUrl)
    return urlObj.hostname + urlObj.pathname
  } catch {
    return url
  }
}


/**
 * URL normalization utilities for handling various URL formats
 */

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

  // If URL already has protocol, return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl
  }

  // Add https:// protocol by default
  return `https://${trimmedUrl}`
}

/**
 * Validates if a URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(normalizeUrl(url))
    return true
  } catch {
    return false
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


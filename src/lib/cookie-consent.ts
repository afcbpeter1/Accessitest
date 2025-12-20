/**
 * Cookie Consent Utilities
 * Functions to check and manage cookie consent status
 */

const COOKIE_CONSENT_KEY = 'cookie-consent-given'
const COOKIE_CONSENT_DATE_KEY = 'cookie-consent-date'

export type CookieConsentStatus = 'accepted' | 'rejected' | null

/**
 * Get the current cookie consent status
 */
export function getCookieConsent(): CookieConsentStatus {
  if (typeof window === 'undefined') return null
  
  const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
  return consent as CookieConsentStatus
}

/**
 * Check if user has accepted cookies
 */
export function hasAcceptedCookies(): boolean {
  return getCookieConsent() === 'accepted'
}

/**
 * Check if user has rejected cookies
 */
export function hasRejectedCookies(): boolean {
  return getCookieConsent() === 'rejected'
}

/**
 * Check if user has given any response (accepted or rejected)
 */
export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null
}

/**
 * Get the date when consent was given
 */
export function getCookieConsentDate(): Date | null {
  if (typeof window === 'undefined') return null
  
  const dateStr = localStorage.getItem(COOKIE_CONSENT_DATE_KEY)
  if (!dateStr) return null
  
  try {
    return new Date(dateStr)
  } catch {
    return null
  }
}

/**
 * Clear cookie consent (useful for testing or reset)
 */
export function clearCookieConsent(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(COOKIE_CONSENT_KEY)
  localStorage.removeItem(COOKIE_CONSENT_DATE_KEY)
}

/**
 * Set cookie consent status
 */
export function setCookieConsent(status: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(COOKIE_CONSENT_KEY, status)
  localStorage.setItem(COOKIE_CONSENT_DATE_KEY, new Date().toISOString())
}





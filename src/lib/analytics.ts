/**
 * Analytics Service
 * Handles analytics tracking based on cookie consent
 */

import { hasAcceptedCookies } from './cookie-consent'

// Analytics event types
export type AnalyticsEvent = 
  | 'page_view'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_cancelled'
  | 'document_uploaded'
  | 'credit_purchased'
  | 'subscription_started'
  | 'button_click'
  | 'form_submitted'
  | 'error_occurred'

interface AnalyticsEventData {
  event: AnalyticsEvent
  properties?: Record<string, any>
  userId?: string
  timestamp?: number
}

class AnalyticsService {
  private initialized = false
  private consentGiven = false

  /**
   * Initialize analytics (only if consent is given)
   */
  init() {
    // Re-check consent status
    this.consentGiven = hasAcceptedCookies()
    
    if (!this.consentGiven) {
      if (this.initialized) {
        // User revoked consent - disable analytics
        this.disable()
      }
      console.log('📊 Analytics disabled: User has not accepted cookies')
      return
    }

    // Initialize analytics services here
    // Example: Google Analytics, Mixpanel, etc.
    this.initialized = true
    console.log('📊 Analytics initialized with user consent')
    
    // You can add actual analytics initialization here:
    // - Google Analytics: gtag('config', 'GA_MEASUREMENT_ID')
    // - Mixpanel: mixpanel.init('MIXPANEL_TOKEN')
    // - Custom API endpoint: fetch('/api/analytics/init')
    
    // Track that analytics was initialized
    this.trackPageView(window.location.pathname, document.title)
  }

  /**
   * Disable analytics (when user rejects cookies)
   */
  private disable() {
    this.initialized = false
    this.consentGiven = false
    
    // Disable analytics services
    // Example: Clear analytics cookies, reset tracking, etc.
    console.log('📊 Analytics disabled: User consent revoked')
  }

  /**
   * Track an event (only if consent is given)
   */
  track(event: AnalyticsEvent, properties?: Record<string, any>) {
    if (!this.consentGiven || !this.initialized) {
      // Silently ignore if consent not given
      return
    }

    const eventData: AnalyticsEventData = {
      event,
      properties,
      timestamp: Date.now()
    }

    // Log for debugging (remove in production)
    console.log('📊 Analytics Event:', eventData)

    // Send to analytics service
    // Example implementations:
    // - Google Analytics: gtag('event', event, properties)
    // - Mixpanel: mixpanel.track(event, properties)
    // - Custom API: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(eventData) })
  }

  /**
   * Track page views
   */
  trackPageView(path: string, title?: string) {
    this.track('page_view', {
      path,
      title: title || document.title
    })
  }

  /**
   * Track scan events
   */
  trackScanStarted(scanType: 'web' | 'document', url?: string, fileName?: string) {
    this.track('scan_started', {
      scan_type: scanType,
      url,
      file_name: fileName
    })
  }

  trackScanCompleted(scanType: 'web' | 'document', issuesFound: number, duration?: number) {
    this.track('scan_completed', {
      scan_type: scanType,
      issues_found: issuesFound,
      duration_ms: duration
    })
  }

  /**
   * Track purchases
   */
  trackCreditPurchase(credits: number, amount: number, currency: string = 'USD') {
    this.track('credit_purchased', {
      credits,
      amount,
      currency
    })
  }

  trackSubscriptionStarted(planType: string, amount: number, currency: string = 'USD') {
    this.track('subscription_started', {
      plan_type: planType,
      amount,
      currency
    })
  }

  /**
   * Track errors
   */
  trackError(error: Error | string, context?: Record<string, any>) {
    this.track('error_occurred', {
      error_message: typeof error === 'string' ? error : error.message,
      error_stack: typeof error === 'object' ? error.stack : undefined,
      ...context
    })
  }

  /**
   * Set user ID for analytics
   */
  setUserId(userId: string) {
    if (!this.consentGiven || !this.initialized) {
      return
    }

    // Set user ID in analytics service
    // Example: mixpanel.identify(userId)
    // Example: gtag('config', 'GA_MEASUREMENT_ID', { user_id: userId })
    console.log('📊 Analytics User ID set:', userId)
  }

  /**
   * Clear user data (for logout)
   */
  clearUser() {
    if (!this.initialized) {
      return
    }

    // Clear user data from analytics
    // Example: mixpanel.reset()
    console.log('📊 Analytics user data cleared')
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.consentGiven && this.initialized
  }
}

// Export singleton instance
export const analytics = new AnalyticsService()

// Initialize on import (will check consent)
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      analytics.init()
    })
  } else {
    analytics.init()
  }

  // Listen for consent changes (if user changes preference later)
  window.addEventListener('storage', (e) => {
    if (e.key === 'cookie-consent-given') {
      // Re-initialize analytics when consent changes
      analytics.init()
    }
  })
}


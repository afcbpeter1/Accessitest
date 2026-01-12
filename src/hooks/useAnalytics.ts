/**
 * React hook for analytics tracking
 * Automatically respects cookie consent
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '@/lib/analytics'

/**
 * Hook to track page views automatically
 */
export function usePageTracking() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page view when pathname changes
    if (pathname) {
      analytics.trackPageView(pathname)
    }
  }, [pathname])
}

/**
 * Hook to track component interactions
 */
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    trackScanStarted: analytics.trackScanStarted.bind(analytics),
    trackScanCompleted: analytics.trackScanCompleted.bind(analytics),
    trackCreditPurchase: analytics.trackCreditPurchase.bind(analytics),
    trackSubscriptionStarted: analytics.trackSubscriptionStarted.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    isEnabled: analytics.isEnabled.bind(analytics)
  }
}










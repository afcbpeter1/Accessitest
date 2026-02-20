'use client'

import { usePageTracking } from '@/hooks/useAnalytics'

/**
 * Client component that tracks page views
 * Only tracks if user has accepted cookies
 */
export default function PageTracker() {
  usePageTracking()
  return null
}






















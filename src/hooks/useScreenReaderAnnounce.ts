import { useEffect } from 'react'

export function useScreenReaderAnnounce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  useEffect(() => {
    if (!message) return

    // Create a live region for announcements
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)

    // Clean up after announcement
    const timer = setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)

    return () => {
      clearTimeout(timer)
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement)
      }
    }
  }, [message, priority])
}

// Hook for form validation errors
export function useFormErrorAnnounce(error: string | null) {
  useScreenReaderAnnounce(error || '', 'assertive')
}

// Token refresh service for sliding expiration with inactivity tracking
class TokenRefreshService {
  private refreshTimer: NodeJS.Timeout | null = null
  private inactivityTimer: NodeJS.Timeout | null = null
  private isRefreshing = false
  private refreshPromise: Promise<string | null> | null = null
  private lastActivityTime: number = Date.now()
  private readonly INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes in milliseconds
  private initialized: boolean = false

  constructor() {
    // Don't initialize during SSR - will be initialized lazily in browser
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  // Initialize timers (called when in browser environment)
  private initialize() {
    if (this.initialized) return
    this.initialized = true
    this.startActivityMonitoring()
    this.startInactivityTracking()
  }

  // Public method to ensure initialization (can be called from browser code)
  public ensureInitialized() {
    if (typeof window !== 'undefined' && !this.initialized) {
      this.initialize()
    }
  }

  // Start monitoring user activity
  private startActivityMonitoring() {
    // Only run in browser environment (not during SSR)
    if (typeof document === 'undefined') {
      return
    }
    
    // Track activity on user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown']
    
    events.forEach(event => {
      document.addEventListener(event, this.handleUserActivity.bind(this), true)
    })

    // Check token expiry every 5 minutes (for active users)
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshToken()
    }, 5 * 60 * 1000) // 5 minutes
  }

  // Track inactivity and logout after 15 minutes
  private startInactivityTracking() {
    // Only run in browser environment (not during SSR)
    if (typeof window === 'undefined') {
      return
    }
    
    // Check for inactivity every minute
    this.inactivityTimer = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime
      
      if (timeSinceLastActivity >= this.INACTIVITY_TIMEOUT) {

        this.logoutDueToInactivity()
      }
    }, 60 * 1000) // Check every minute
  }

  // Handle user activity - update last activity time and refresh token
  private handleUserActivity() {
    // Update last activity time
    this.lastActivityTime = Date.now()
    
    // Debounce activity - only refresh if not already refreshing
    if (!this.isRefreshing) {
      // Clear any existing timeout
      if (this.activityDebounceTimer) {
        clearTimeout(this.activityDebounceTimer)
      }
      
      // Refresh token after 1 minute of activity (to avoid too frequent refreshes)
      // This ensures the token is refreshed while user is active, extending the session
      this.activityDebounceTimer = setTimeout(() => {
        this.checkAndRefreshToken(true) // true = refresh on activity
      }, 1 * 60 * 1000) // 1 minute - refresh token after 1 min of activity
    }
  }

  private activityDebounceTimer: NodeJS.Timeout | null = null

  // Logout due to inactivity
  private logoutDueToInactivity() {
    // Only run in browser environment (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    
    // Show notification using the auth-utils function
    // Dynamically import to avoid circular dependencies
    import('@/lib/auth-utils').then(({ showLogoutNotification }) => {
      showLogoutNotification('You have been logged out due to inactivity. Please log in again.')
    }).catch(() => {
      // Fallback if import fails

    })
    
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
  }

  // Check if token needs refresh and refresh if needed
  private async checkAndRefreshToken(refreshOnActivity: boolean = false) {
    // Only run in browser environment (not during SSR)
    if (typeof window === 'undefined') {
      return
    }
    
    const token = localStorage.getItem('accessToken')
    if (!token) return

    try {
      // Parse token to check expiry
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Date.now() / 1000
      const timeUntilExpiry = payload.exp - now
      
      // Refresh if:
      // 1. User is active and token expires in less than 10 minutes (sliding expiration)
      // 2. OR token expires in less than 5 minutes (periodic check)
      const shouldRefresh = refreshOnActivity 
        ? timeUntilExpiry < 10 * 60  // Refresh on activity if less than 10 min left
        : timeUntilExpiry < 5 * 60    // Periodic check: refresh if less than 5 min left
      
      if (shouldRefresh) {

        await this.refreshToken()
      }
    } catch (error) {
      console.error('Error checking token expiry:', error)
    }
  }

  // Refresh the token
  private async refreshToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshing = true
    this.refreshPromise = this.performTokenRefresh()

    try {
      const newToken = await this.refreshPromise
      return newToken
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  // Perform the actual token refresh
  private async performTokenRefresh(): Promise<string | null> {
    // Only run in browser environment (not during SSR)
    if (typeof window === 'undefined') {
      return null
    }
    
    const token = localStorage.getItem('accessToken')
    if (!token) return null

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.token) {
          // Update stored token
          localStorage.setItem('accessToken', data.token)

          return data.token
        }
      } else {
        console.error('Token refresh failed:', response.status)
        // If refresh fails, user will need to log in again
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
    }

    return null
  }

  // Stop the service
  public stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer)
      this.inactivityTimer = null
    }
    if (this.activityDebounceTimer) {
      clearTimeout(this.activityDebounceTimer)
      this.activityDebounceTimer = null
    }
  }

  // Reset inactivity timer (call this when user logs in)
  public resetInactivityTimer() {
    this.lastActivityTime = Date.now()

  }
}

// Create singleton instance
export const tokenRefreshService = new TokenRefreshService()

// Export for manual refresh if needed
export const refreshToken = () => tokenRefreshService.refreshToken()

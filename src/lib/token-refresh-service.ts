// Token refresh service for sliding expiration
class TokenRefreshService {
  private refreshTimer: NodeJS.Timeout | null = null
  private isRefreshing = false
  private refreshPromise: Promise<string | null> | null = null

  constructor() {
    this.startActivityMonitoring()
  }

  // Start monitoring user activity
  private startActivityMonitoring() {
    // Refresh token on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, this.handleUserActivity.bind(this), true)
    })

    // Check token expiry every 5 minutes
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshToken()
    }, 5 * 60 * 1000) // 5 minutes
  }

  // Handle user activity
  private handleUserActivity() {
    // Debounce activity - only refresh if not already refreshing
    if (!this.isRefreshing) {
      this.checkAndRefreshToken()
    }
  }

  // Check if token needs refresh and refresh if needed
  private async checkAndRefreshToken() {
    const token = localStorage.getItem('accessToken')
    if (!token) return

    try {
      // Parse token to check expiry
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Date.now() / 1000
      const timeUntilExpiry = payload.exp - now
      
      // Refresh if token expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60) {
        console.log('🔄 Token expires soon, refreshing...')
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
          console.log('✅ Token refreshed successfully')
          return data.token
        }
      } else {
        console.error('Token refresh failed:', response.status)
        // If refresh fails, user will need to log in again
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
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
  }
}

// Create singleton instance
export const tokenRefreshService = new TokenRefreshService()

// Export for manual refresh if needed
export const refreshToken = () => tokenRefreshService.refreshToken()

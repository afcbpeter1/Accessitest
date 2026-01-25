// Authentication utility functions for handling token expiry and user sessions

export interface AuthError {
  message: string
  code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'UNAUTHORIZED' | 'NETWORK_ERROR'
}

export class AuthError extends Error {
  code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'UNAUTHORIZED' | 'NETWORK_ERROR'
  
  constructor(message: string, code: AuthError['code']) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

// Enhanced fetch wrapper that handles authentication errors
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('accessToken')
  
  // Quick JWT expiry check before making request
  if (token) {
    try {
      const tokenParts = token.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]))
        const now = Math.floor(Date.now() / 1000)
        
        if (payload.exp && payload.exp < now) {

          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          sessionStorage.setItem('loginMessage', 'Your session has expired. Please log in again.')
          showLogoutNotification('Your session has expired. Please log in again.')
          setTimeout(() => {
            window.location.href = '/login'
          }, 1000)
          throw new AuthError('Your session has expired. Please log in again.', 'TOKEN_EXPIRED')
        }
      }
    } catch (error) {

      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      sessionStorage.setItem('loginMessage', 'Invalid session. Please log in again.')
      showLogoutNotification('Invalid session. Please log in again.')
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
      throw new AuthError('Invalid session. Please log in again.', 'TOKEN_INVALID')
    }
  }
  
  // Add authorization header if token exists
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    // Handle authentication and server errors
    if (response.status === 401 || response.status === 500) {
      const errorData = await response.json().catch(() => ({}))
      
      // Clear stored auth data
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      
      // Determine error type and message
      let errorCode: AuthError['code'] = 'TOKEN_EXPIRED'
      let errorMessage = 'Your session has expired. Please log in again.'
      
      if (response.status === 401) {
        if (errorData.error?.includes('Invalid') || errorData.error?.includes('expired')) {
          errorCode = 'TOKEN_EXPIRED'
          errorMessage = 'Your session has expired. Please log in again.'
        } else if (errorData.error?.includes('verification')) {
          errorCode = 'UNAUTHORIZED'
          errorMessage = 'Email verification required. Please check your email.'
        } else {
          errorCode = 'UNAUTHORIZED'
          errorMessage = 'Authentication required. Please log in.'
        }
      } else if (response.status === 500) {
        errorCode = 'UNAUTHORIZED'
        errorMessage = 'Server error detected. Please log in again to refresh your session.'
      }
      
      // Show user-friendly notification
      showLogoutNotification(errorMessage)
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/home'
      }, 1500)
      
      throw new AuthError(errorMessage, errorCode)
    }
    
    return response
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AuthError('Network error. Please check your connection.', 'NETWORK_ERROR')
    }
    
    throw error
  }
}

// Show user-friendly logout notification
export function showLogoutNotification(message: string) {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = 'fixed top-4 right-4 z-50 max-w-md bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-out'
  notification.innerHTML = `
    <div class="flex items-start space-x-3">
      <div class="flex-shrink-0">
        <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
          <svg class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-red-900 mb-1">Session Expired</h3>
        <p class="text-sm text-red-700">${message}</p>
        <p class="text-xs text-red-600 mt-1">Redirecting to login page...</p>
      </div>
    </div>
  `
  
  // Add to page
  document.body.appendChild(notification)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 5000)
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('accessToken')
  const user = localStorage.getItem('user')
  
  if (!token || !user) return false
  
  try {
    // Basic JWT structure check (has 3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    // Decode payload to check expiry
    const payload = JSON.parse(atob(parts[1]))
    const now = Math.floor(Date.now() / 1000)
    
    // Check if token is expired
    if (payload.exp && payload.exp <= now) {
      // Clean up expired token
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      return false
    }
    
    return true
  } catch (error) {
    // Clean up invalid token
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    return false
  }
}

// Get current user info
export function getCurrentUser(): any {
  try {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  } catch (error) {
    return null
  }
}

// Clear authentication data
export function clearAuthData() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

// Redirect to login with message
export function redirectToLogin(message?: string) {
  if (message) {
    // Store message in sessionStorage to show on login page
    sessionStorage.setItem('loginMessage', message)
  }
  window.location.href = '/login'
}

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { isAuthenticated, getCurrentUser, clearAuthData, showLogoutNotification } from '@/lib/auth-utils'
import { tokenRefreshService } from '@/lib/token-refresh-service'

interface User {
  id: string
  email: string
  plan: string
  emailVerified: boolean
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  logout: (message?: string) => void
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshAuth = () => {
    const authenticated = isAuthenticated()
    const userData = getCurrentUser()
    
    setUser(authenticated ? userData : null)
    setIsLoading(false)
  }

  const logout = (message?: string) => {
    clearAuthData()
    setUser(null)
    
    if (message) {
      showLogoutNotification(message)
    }
    
    // Redirect to home after a short delay
    setTimeout(() => {
      window.location.href = '/home'
    }, message ? 1500 : 0)
  }

  useEffect(() => {
    refreshAuth()
    
    // Ensure token refresh service is initialized in browser
    tokenRefreshService.ensureInitialized()
    
    // Start token refresh service if user is authenticated
    // The service is a singleton and starts automatically, but we verify it's working
    if (isAuthenticated()) {

      // Reset inactivity timer when user is authenticated
      tokenRefreshService.resetInactivityTimer()
    }
    
    // Listen for storage changes (e.g., when user logs in from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'user') {
        refreshAuth()
        // Reset inactivity timer when token is set
        if (e.key === 'accessToken' && e.newValue) {
          tokenRefreshService.resetInactivityTimer()
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
    refreshAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

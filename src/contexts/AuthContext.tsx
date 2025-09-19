'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { isAuthenticated, getCurrentUser, clearAuthData, showLogoutNotification } from '@/lib/auth-utils'

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
    
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/login'
    }, message ? 2000 : 0)
  }

  useEffect(() => {
    refreshAuth()
    
    // Listen for storage changes (e.g., when user logs in from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'user') {
        refreshAuth()
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

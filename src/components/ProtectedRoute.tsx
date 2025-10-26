'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

interface User {
  id: string
  email: string
  name: string
  company?: string
  plan: string
  emailVerified: boolean
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unverified' | 'unauthenticated'>('loading')
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken')
      const userData = localStorage.getItem('user')

      if (!accessToken || !userData) {
        setAuthStatus('unauthenticated')
        router.push('/home')
        return
      }

      try {
        const parsedUser: User = JSON.parse(userData)
        
        // Validate token with server
        const response = await fetch('/api/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!response.ok) {
          // Token is invalid or expired
          console.log('🔍 Authentication failed:', response.status, response.statusText)
          if (response.status === 401) {
            console.log('❌ Token expired or invalid - logging out')
          } else {
            console.log('❌ Server error during authentication - logging out')
          }
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          setAuthStatus('unauthenticated')
          router.push('/home')
          return
        }

        const userResponse = await response.json()
        if (userResponse.success) {
          // Update user data with fresh data from server
          const freshUser = userResponse.user
          
          // Token refresh is handled automatically by tokenRefreshService
          
          // Check email verification
          if (!freshUser.emailVerified) {
            setUser(freshUser)
            setAuthStatus('unverified')
          } else {
            setUser(freshUser)
            setAuthStatus('authenticated')
          }
        } else {
          // Server returned error
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          setAuthStatus('unauthenticated')
          router.push('/home')
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        setAuthStatus('unauthenticated')
        router.push('/home')
      }
    }

    checkAuth()
  }, [router])

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthenticated') {
    return null // Will redirect to login
  }

  if (authStatus === 'unverified') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <img 
                src="/allytest.png" 
                alt="A11ytest.ai Logo" 
                className="h-12 w-auto object-contain" 
              />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Email Verification Required
            </h2>
          </div>

          <div className="bg-white py-8 px-6 shadow rounded-lg">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Please verify your email address
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                We've sent a verification code to <strong>{user?.email}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  You must verify your email address before accessing the dashboard.
                </p>
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Complete Email Verification
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    localStorage.removeItem('accessToken')
                    localStorage.removeItem('user')
                    router.push('/home')
                  }}
                  className="text-sm text-gray-600 hover:text-gray-500"
                >
                  Sign out and try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}


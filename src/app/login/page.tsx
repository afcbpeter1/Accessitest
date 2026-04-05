'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GoogleSignInButton from '@/components/GoogleSignInButton'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoutMessage, setLogoutMessage] = useState('')
  const router = useRouter()

  const redirectAfterLogin = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const rawRedirect = urlParams.get('redirect')
    const redirectPath =
      rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
        ? rawRedirect
        : '/dashboard'
    router.push(redirectPath)
  }, [router])

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setGoogleLoading(true)
      setError('')
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        })
        const data = await response.json()
        if (data.success) {
          localStorage.setItem('accessToken', data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
          const { tokenRefreshService } = await import('@/lib/token-refresh-service')
          tokenRefreshService.resetInactivityTimer()
          redirectAfterLogin()
        } else {
          setError(data.error || 'Google sign-in failed')
        }
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setGoogleLoading(false)
      }
    },
    [redirectAfterLogin]
  )

  // Check for logout message and clear any stale/expired token so "session expired" doesn’t show again
  useEffect(() => {
    const url = new URL(window.location.href)
    const emailParam = url.searchParams.get('email')
    const hadPasswordParam = url.searchParams.has('password')
    const hadEmailParam = url.searchParams.has('email')

    // Never keep credentials or PII in the login URL.
    if (hadEmailParam || hadPasswordParam) {
      if (emailParam) setEmail(emailParam)
      url.searchParams.delete('email')
      url.searchParams.delete('password')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
    if (hadPasswordParam) {
      setError('For security, password query parameters are blocked. Please enter your password in the form.')
    }

    const message = sessionStorage.getItem('loginMessage')
    if (message) {
      setLogoutMessage(message)
      sessionStorage.removeItem('loginMessage')
    }
    const token = localStorage.getItem('accessToken')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
        }
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          email,
          password
        })
      })

      const data = await response.json()

      if (data.success) {
        // Store token and user data
        localStorage.setItem('accessToken', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Reset inactivity timer on login
        const { tokenRefreshService } = await import('@/lib/token-refresh-service')
        tokenRefreshService.resetInactivityTimer()
        
        redirectAfterLogin()
      } else {
        if (data.requiresVerification) {
          // Redirect to signup page for verification
          router.push(`/signup?email=${encodeURIComponent(data.email)}&verification=true`)
        } else {
          setError(data.error || 'Login failed')
        }
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <img 
              src="/allytest.png" 
              alt="A11ytest.ai Logo" 
              className="h-12 w-auto object-contain" 
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Access your accessibility testing dashboard
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Logout Message */}
          {logoutMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-blue-800 text-sm">
                <Shield className="h-4 w-4" />
                <span>{logoutMessage}</span>
              </div>
            </div>
          )}


          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading || googleLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-900 hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className={googleLoading ? 'opacity-60 pointer-events-none' : ''}>
            {googleLoading ? (
              <p className="text-center text-sm text-gray-600">Signing in with Google…</p>
            ) : (
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isLoading || googleLoading} />
            )}
          </div>

          {/* Links */}
          <div className="text-center space-y-2">
            <div className="text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link href="/signup" className="font-medium text-blue-900 hover:text-blue-950">
                Sign up
              </Link>
            </div>
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-blue-900 hover:text-blue-950">
                Forgot your password?
              </Link>
            </div>
          </div>
        </form>

      </div>
    </main>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2 } from 'lucide-react'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const token = localStorage.getItem('accessToken')
      const user = localStorage.getItem('user')

      if (!token || !user) {
        // No token or user data, redirect to home
        router.push('/home')
        return
      }

      // Quick JWT expiry check before redirecting
      try {
        const tokenParts = token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]))
          const now = Math.floor(Date.now() / 1000)
          
          if (payload.exp && payload.exp < now) {

            localStorage.removeItem('accessToken')
            localStorage.removeItem('user')
            router.push('/home')
            return
          }
        }
      } catch (error) {

        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        router.push('/home')
        return
      }

      // Token appears valid, redirect to dashboard
      router.push('/')
    }

    checkAuthAndRedirect()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <img 
          src="/allytest.png" 
          alt="A11ytest.ai Logo" 
          className="h-16 w-auto object-contain mx-auto mb-4" 
        />
        <Loader2 className="h-8 w-8 text-blue-600 mx-auto animate-spin" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}


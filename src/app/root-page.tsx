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

      if (token && user) {
        // User is authenticated, redirect to dashboard
        router.push('/')
      } else {
        // User is not authenticated, redirect to home page
        router.push('/home')
      }
    }

    checkAuthAndRedirect()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <img 
          src="/allytest.png" 
          alt="AccessiTest Logo" 
          className="h-16 w-auto object-contain mx-auto mb-4" 
        />
        <Loader2 className="h-8 w-8 text-blue-600 mx-auto animate-spin" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}


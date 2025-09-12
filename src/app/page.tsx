'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const accessToken = localStorage.getItem('accessToken')
    const userData = localStorage.getItem('user')

    if (accessToken && userData) {
      try {
        const user = JSON.parse(userData)
        if (user.emailVerified) {
          // User is logged in and verified, redirect to dashboard
          router.push('/dashboard')
        } else {
          // User is logged in but not verified, redirect to home
          router.push('/home')
        }
      } catch (error) {
        // Invalid user data, redirect to home
        router.push('/home')
      }
    } else {
      // User is not logged in, redirect to home
      router.push('/home')
    }
  }, [router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

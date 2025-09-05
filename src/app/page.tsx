'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const accessToken = localStorage.getItem('accessToken')
    const user = localStorage.getItem('user')

    if (accessToken && user) {
      // User is authenticated, redirect to dashboard
      router.push('/dashboard')
    } else {
      // User is not authenticated, redirect to home page
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

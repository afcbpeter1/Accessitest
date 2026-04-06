'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'loading' | 'ok' | 'unverified' | 'redirect'

interface WikiAuthGateProps {
  children: React.ReactNode
  /** Path after login, e.g. /wiki/image-alt/edit */
  redirectPath: string
}

/**
 * Requires verified sign-in for wiki editing. Redirects to /login?redirect=...
 */
export default function WikiAuthGate({ children, redirectPath }: WikiAuthGateProps) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const accessToken = localStorage.getItem('accessToken')
      const userData = localStorage.getItem('user')

      if (!accessToken || !userData) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`)
        if (!cancelled) setStatus('redirect')
        return
      }

      try {
        const response = await fetch('/api/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!response.ok) {
          router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`)
          if (!cancelled) setStatus('redirect')
          return
        }

        const data = await response.json()
        if (!data.success || !data.user?.emailVerified) {
          if (!cancelled) setStatus('unverified')
          return
        }

        if (!cancelled) setStatus('ok')
      } catch {
        router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`)
        if (!cancelled) setStatus('redirect')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router, redirectPath])

  if (status === 'loading' || status === 'redirect') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="sr-only">Wiki editor</h1>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0645ad] mx-auto mb-3" />
          <p className="text-sm text-gray-600">Checking your session…</p>
        </div>
      </div>
    )
  }

  if (status === 'unverified') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Verify your email</h1>
        <p className="text-gray-600 mb-6">
          You need a verified email address to edit the wiki. Complete verification, then come back here.
        </p>
        <button
          type="button"
          onClick={() => router.push('/signup')}
          className="inline-flex items-center px-4 py-2 rounded-md bg-[#0645ad] text-white text-sm font-medium hover:bg-[#053a91]"
        >
          Complete verification
        </button>
      </div>
    )
  }

  return <>{children}</>
}

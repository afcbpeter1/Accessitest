'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { isAuthenticated } from '@/lib/auth-utils'

const linkClass = 'block text-[#0645ad] no-underline hover:underline'

/**
 * Contribute sidebar: show sign-in when logged out, sign-out when logged in (token in localStorage).
 */
export default function WikiSidebarAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const refresh = useCallback(() => {
    setSignedIn(isAuthenticated())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      setSignedIn(false)
      router.refresh()
    }
  }

  if (signedIn === null) {
    return (
      <span className="block text-[#72777d]" aria-hidden>
        &nbsp;
      </span>
    )
  }

  if (signedIn) {
    return (
      <button type="button" onClick={() => void handleLogout()} className={`${linkClass} w-full text-left font-[inherit]`}>
        Sign out
      </button>
    )
  }

  const redirect = pathname && pathname.startsWith('/wiki') ? pathname : '/wiki'

  return (
    <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className={linkClass}>
      Sign in to edit
    </Link>
  )
}

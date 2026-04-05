'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: string | number; text?: string; locale?: string }
          ) => void
        }
      }
    }
  }
}

const SCRIPT_ID = 'google-gsi-client'

function getClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || ''
}

type GoogleSignInButtonProps = {
  onCredential: (credential: string) => void
  disabled?: boolean
}

export default function GoogleSignInButton({ onCredential, disabled }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)
  callbackRef.current = onCredential
  const [scriptReady, setScriptReady] = useState(false)
  const clientId = getClientId()

  useEffect(() => {
    if (!clientId || typeof document === 'undefined') return

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (window.google?.accounts?.id) {
        setScriptReady(true)
      } else {
        existing.addEventListener('load', () => setScriptReady(true), { once: true })
      }
      return
    }

    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => setScriptReady(true)
    document.head.appendChild(s)
  }, [clientId])

  useEffect(() => {
    if (!scriptReady || !clientId || disabled || !containerRef.current) return

    const el = containerRef.current
    const g = window.google
    if (!g?.accounts?.id) return
    if (el.childElementCount > 0) return

    g.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) callbackRef.current(response.credential)
      },
    })
    g.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      width: 400,
      text: 'continue_with',
      locale: 'en',
    })
  }, [scriptReady, clientId, disabled])

  if (!clientId) {
    return (
      <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment.
      </p>
    )
  }

  return (
    <div className="w-full flex justify-center overflow-x-auto">
      <div ref={containerRef} className="min-h-[44px] flex justify-center" />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

/**
 * Used by the AccessScan Chrome extension inside the side panel iframe.
 * - If not logged in: redirect to login, then back here.
 * - If logged in: notify the extension and listen for scan submissions.
 * The extension sends scan results via postMessage; this page submits them to the API
 * using the session (localStorage token) so no token is stored in the extension.
 */
export default function ExtensionSessionPage() {
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'ready' | 'error'>('checking')

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) {
      setStatus('redirecting')
      const redirect = encodeURIComponent('/extension-session')
      window.location.href = `/login?redirect=${redirect}`
      return
    }

    // Notify extension (parent when in iframe) that we're ready
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'ACCESSSCAN_READY', loggedIn: true }, '*')
      }
    } catch (_) {}

    setStatus('ready')

    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (data?.type === 'ACCESSSCAN_SUBMIT_SCAN' && typeof data.id !== 'undefined' && data.url) {
        const { id, url, issues = [], summary = {}, multiScanId } = data
        const token = localStorage.getItem('accessToken')
        if (!token) {
          respond(id, { success: false, error: 'Not logged in' })
          return
        }
        try {
          const res = await fetch('/api/extension/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ url, issues, summary, multiScanId })
          })
          const json = await res.json().catch(() => ({}))
          respond(id, json)
        } catch (err) {
          respond(id, { success: false, error: err instanceof Error ? err.message : 'Request failed' })
        }
      }

      function respond(id: string | number, payload: object) {
        try {
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'ACCESSSCAN_SUBMIT_RESPONSE', id, ...payload }, '*')
          }
        } catch (_) {}
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (status === 'checking' || status === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-600">
            {status === 'checking' ? 'Checking…' : 'Redirecting to log in…'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-600">You’re logged in. Use the scan controls above to add pages and run a scan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <p className="text-red-600">Something went wrong. Try logging in again.</p>
      </div>
    </div>
  )
}

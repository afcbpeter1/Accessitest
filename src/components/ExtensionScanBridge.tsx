'use client'

import { useEffect } from 'react'

/**
 * When the app is loaded inside the AccessScan extension iframe, listen for
 * ACCESSSCAN_SUBMIT_SCAN messages and forward them to the API using the session token.
 */
export default function ExtensionScanBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) return

    const handler = async (event: MessageEvent) => {
      const data = event.data
      if (data?.type !== 'ACCESSSCAN_SUBMIT_SCAN' || typeof data.id === 'undefined' || !data.url) return

      const { id, url, issues = [], summary = {}, wcagLevel, selectedTags } = data
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null
      if (!token) {
        respond(id, { success: false, error: 'Not logged in' })
        return
      }

      function respond(idVal: string | number, payload: object) {
        try {
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'ACCESSSCAN_SUBMIT_RESPONSE', id: idVal, ...payload }, '*')
          }
        } catch (_) {}
      }

      try {
        const res = await fetch('/api/extension/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            url,
            issues,
            summary,
            ...(typeof wcagLevel === 'string' && { wcagLevel }),
            ...(Array.isArray(selectedTags) && { selectedTags })
          })
        })
        const json = await res.json().catch(() => ({}))
        respond(id, { ...json, backlogError: json.backlogError || null })
      } catch (err) {
        respond(id, { success: false, error: err instanceof Error ? err.message : 'Request failed' })
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return null
}

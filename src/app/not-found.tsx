'use client'

import { useState, useEffect } from 'react'

export default function NotFound() {
  // Default true so extension iframe never shows "Go Home" (corrected in useEffect when not in iframe)
  const [inIframe, setInIframe] = useState(true)

  useEffect(() => {
    setInIframe(typeof window !== 'undefined' && window.self !== window.top)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
        {inIframe ? (
          <>
            <p className="text-gray-600 mb-8">
              The page you&apos;re looking for doesn&apos;t exist. If you&apos;re using the Chrome extension, make sure the app has been updated and try again.
            </p>
            <a
              href="/login?redirect=%2Fextension"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to extension login
            </a>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </a>
          </>
        )}
      </div>
    </div>
  )
}

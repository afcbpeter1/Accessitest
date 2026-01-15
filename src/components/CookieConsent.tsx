'use client'

import { useState, useEffect } from 'react'
import { Cookie, Shield } from 'lucide-react'
import Link from 'next/link'
import { hasCookieConsent, setCookieConsent } from '@/lib/cookie-consent'
import { analytics } from '@/lib/analytics'

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already given consent
    // Only show if consent hasn't been given
    if (!hasCookieConsent()) {
      setShowBanner(true)
      // Small delay for animation
      setTimeout(() => setIsVisible(true), 100)
    }
  }, [])

  const handleAccept = () => {
    // Store consent with timestamp
    setCookieConsent('accepted')
    
    // Initialize analytics now that consent is given
    analytics.init()
    
    // Track the consent acceptance
    analytics.track('button_click', {
      button_name: 'accept_cookies',
      location: 'cookie_banner'
    })
    
    // Hide banner with animation
    setIsVisible(false)
    setTimeout(() => setShowBanner(false), 300)
  }

  const handleReject = () => {
    // Store rejection with timestamp
    setCookieConsent('rejected')
    
    // Analytics will remain disabled (already checked in init)
    // No need to explicitly disable since it never initialized
    
    // Note: We don't track the rejection itself (respecting user's choice)
    
    // Hide banner with animation
    setIsVisible(false)
    setTimeout(() => setShowBanner(false), 300)
  }

  if (!showBanner) return null

  return (
    <>
      {/* Cookie Banner */}
      <div
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
        className={`fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
              {/* Icon and Content */}
              <div className="flex items-start gap-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Cookie className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 
                    id="cookie-consent-title"
                    className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2"
                  >
                    <Shield className="h-5 w-5 text-blue-600" />
                    We Use Cookies
                  </h3>
                  <p 
                    id="cookie-consent-description"
                    className="text-sm text-gray-600 mb-4 leading-relaxed"
                  >
                    We use cookies and similar technologies to enhance your browsing experience, 
                    analyze site traffic, personalize content, and improve our services. 
                    By clicking "Accept All", you consent to our use of cookies.
                  </p>
                  
                  {/* What We Collect */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">What We Collect:</h4>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                      <li><strong>Essential Cookies:</strong> Required for site functionality (authentication, preferences)</li>
                      <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our site</li>
                      <li><strong>Performance Cookies:</strong> Monitor site performance and optimize user experience</li>
                      <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-3">
                      <Link 
                        href="/cookie-policy" 
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Learn more about our cookie policy
                      </Link>
                    </p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0">
                <button
                  onClick={handleReject}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  aria-label="Reject cookies"
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Accept all cookies"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


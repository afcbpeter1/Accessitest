'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Zap, AlertTriangle, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface CreditData {
  credits: number
  creditsRemaining?: number
  unlimitedCredits: boolean
  planType: string
  canScan: boolean
}

interface CreditDisplayProps {
  className?: string
  showBuyButton?: boolean
}

export default function CreditDisplay({ className = '', showBuyButton = true }: CreditDisplayProps) {
  const [creditData, setCreditData] = useState<CreditData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCreditData()
    
    // Check if we're returning from a successful purchase (check URL params)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      // Poll for credit updates - webhook might take a few seconds
      let attempts = 0
      const maxAttempts = 10 // Try for up to 10 seconds
      
      const pollInterval = setInterval(() => {
        attempts++
        console.log(`🔄 Polling for credit update (attempt ${attempts}/${maxAttempts})...`)
        loadCreditData()
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          console.log('⏱️ Stopped polling for credit updates')
        }
      }, 1000) // Poll every second
      
      // Clean up interval on unmount
      return () => clearInterval(pollInterval)
    }
    
    // Also set up periodic refresh every 30 seconds to catch webhook updates
    const refreshInterval = setInterval(() => {
      loadCreditData()
    }, 30000)
    
    return () => clearInterval(refreshInterval)
  }, [])

  const loadCreditData = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/credits', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store' // Always fetch fresh data
      })

      const data = await response.json()
      if (data.success) {
        console.log('💳 Credit data loaded:', data.credits, 'credits')
        setCreditData(data)
      } else {
        console.error('❌ Failed to load credit data:', data.error)
      }
    } catch (error) {
      console.error('❌ Failed to load credit data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleRefresh = () => {
    console.log('🔄 Manually refreshing credits...')
    loadCreditData(true)
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 w-24 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!creditData) {
    return null
  }

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case 'free': return 'Pay as You Go'
      case 'web_only': return 'Web Only'
      case 'document_only': return 'Document Only'
      case 'complete_access': return 'Unlimited Access'
      default: return 'Pay as You Go'
    }
  }

  const getCreditDisplay = () => {
    if (creditData.unlimitedCredits) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <span className="text-xl font-bold">∞</span>
            {creditData.credits && creditData.credits > 0 && (
              <span className="text-xs text-gray-500">({creditData.credits} saved)</span>
            )}
          </div>
          <div className="h-4 w-px bg-gray-300"></div>
          <span className="text-sm text-gray-600 font-medium">
            {getPlanDisplayName(creditData.planType)}
          </span>
        </div>
      )
    }

    const isLowCredits = creditData.credits <= 1
    const isNoCredits = creditData.credits === 0

    return (
      <div className="flex items-center space-x-2">
        <div className={`flex items-center space-x-1 ${isNoCredits ? 'text-red-600' : isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
          {isNoCredits ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
          <span className="font-medium">{creditData.credits}</span>
          {isLowCredits && !isNoCredits && (
            <span className="text-xs text-orange-500">Low</span>
          )}
        </div>
        <div className="h-4 w-px bg-gray-300"></div>
        <span className="text-sm text-gray-600 font-medium">
          {getPlanDisplayName(creditData.planType)}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {getCreditDisplay()}
      
      <button
        onClick={handleRefresh}
        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
        title="Refresh credits"
        disabled={loading}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
      
      {showBuyButton && !creditData.unlimitedCredits && (
        <Link
          href="/pricing"
          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Buy Credits</span>
        </Link>
      )}
    </div>
  )
}

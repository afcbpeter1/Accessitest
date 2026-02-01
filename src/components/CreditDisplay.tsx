'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Zap, AlertTriangle, Plus } from 'lucide-react'
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
      // Refetch credit data after a short delay to let webhook process
      setTimeout(() => {
        loadCreditData()
      }, 1500)
    }
  }, [])

  const loadCreditData = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/credits', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setCreditData(data)
      }
    } catch (error) {
      console.error('Failed to load credit data:', error)
    } finally {
      setLoading(false)
    }
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-2">
          <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
            <span className="text-xl font-bold">∞</span>
            {creditData.credits && creditData.credits > 0 && (
              <span className="text-xs text-gray-500 whitespace-nowrap">({creditData.credits} saved)</span>
            )}
          </div>
          <div className="h-4 w-px bg-gray-300 flex-shrink-0 hidden sm:block" aria-hidden />
          <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
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
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 ${className}`}>
      {getCreditDisplay()}
      
      {showBuyButton && !creditData.unlimitedCredits && (
        <Link
          href="/pricing"
          className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors min-h-[44px] sm:min-h-0 whitespace-nowrap"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <span>Buy Credits</span>
        </Link>
      )}
    </div>
  )
}

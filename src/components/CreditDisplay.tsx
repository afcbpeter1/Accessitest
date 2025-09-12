'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Zap, AlertTriangle, Plus } from 'lucide-react'
import Link from 'next/link'

interface CreditData {
  credits: number
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

  const getCreditDisplay = () => {
    if (creditData.unlimitedCredits) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <Zap className="h-5 w-5" />
          <span className="font-medium">Unlimited</span>
        </div>
      )
    }

    const isLowCredits = creditData.credits <= 1
    const isNoCredits = creditData.credits === 0

    return (
      <div className={`flex items-center space-x-2 ${isNoCredits ? 'text-red-600' : isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
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
    )
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {getCreditDisplay()}
      
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

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Mail, BadgeCheck, ArrowDown } from 'lucide-react'

export default function ThankYouPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const plan = searchParams.get('plan') || 'Your Purchase'
  const amount = searchParams.get('amount') || '$0.00'
  const type = searchParams.get('type') || 'purchase'
  const billing = searchParams.get('billing')
  const success = searchParams.get('success')

  // Determine if this is a subscription or credit purchase
  const isSubscription = type === 'subscription'
  const isCredits = type === 'credits'

  // Extract credit amount from plan name if it's a credit pack
  const creditAmount = isCredits && plan.includes('Pack') 
    ? plan.match(/\d+/)?.[0] 
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Payment Successful!</h1>
          <p className="text-lg text-gray-600">
            Thank you for your purchase. Your account has been updated.
          </p>
        </div>

        {/* Purchase Summary */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchase Summary</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Plan:</span>
              <span className="font-medium text-gray-900">{plan}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-gray-900">{amount}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium text-gray-900">
                {isSubscription ? 'Subscription' : isCredits ? 'Credit Package' : 'One-time Payment'}
              </span>
            </div>
            
            {billing && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">Billing Period:</span>
                <span className="font-medium text-gray-900">{billing}</span>
              </div>
            )}
            
            {isCredits && creditAmount && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">Credits Added:</span>
                <span className="font-medium text-gray-900">{creditAmount} scans</span>
              </div>
            )}
          </div>
        </div>

        {/* What's Next Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">What's Next?</h2>
          
          <div className="space-y-4">
            {/* Email Receipt */}
            <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Email Receipt</h3>
                <p className="text-gray-600 text-sm">
                  A receipt has been sent to your email address with all the details of your purchase.
                </p>
              </div>
            </div>

            {/* Account Updated */}
            <div className="flex items-start space-x-4 p-4 bg-green-50 rounded-lg">
              <BadgeCheck className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Account Updated</h3>
                <p className="text-gray-600 text-sm">
                  {isSubscription 
                    ? 'Your subscription is now active and you can start using all features immediately.'
                    : 'Your credits have been added to your account and you can start scanning immediately.'
                  }
                </p>
              </div>
            </div>

            {/* Start Scanning */}
            <div className="flex items-start space-x-4 p-4 bg-purple-50 rounded-lg">
              <ArrowDown className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Start Scanning</h3>
                <p className="text-gray-600 text-sm">
                  {isSubscription
                    ? 'You can now access your dashboard and start running accessibility scans with your new plan.'
                    : 'You can now access your dashboard and start running accessibility scans with your new credits.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href="/dashboard"
            className="flex-1 bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-center flex items-center justify-center space-x-2"
          >
            <span>Go to Dashboard</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          
          <Link
            href="/new-scan"
            className="flex-1 bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:border-gray-400 transition-colors text-center"
          >
            Start New Scan
          </Link>
        </div>
      </div>
    </div>
  )
}


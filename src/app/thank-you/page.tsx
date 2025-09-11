'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Mail, CreditCard, Download, ArrowRight } from 'lucide-react'

export default function ThankYouPage() {
  const searchParams = useSearchParams()
  const [purchaseDetails, setPurchaseDetails] = useState<{
    planName?: string
    amount?: string
    email?: string
    type?: 'subscription' | 'credits'
  }>({})

  useEffect(() => {
    // Get purchase details from URL parameters
    const planName = searchParams.get('plan')
    const amount = searchParams.get('amount')
    const email = searchParams.get('email')
    const type = searchParams.get('type') as 'subscription' | 'credits'

    setPurchaseDetails({
      planName: planName || 'Your Plan',
      amount: amount || '$0',
      email: email || '',
      type: type || 'subscription'
    })
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your purchase. Your account has been updated.
          </p>
        </div>

        {/* Purchase Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Purchase Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Plan:</span>
              <span className="font-medium text-gray-900">{purchaseDetails.planName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-gray-900">{purchaseDetails.amount}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium text-gray-900 capitalize">
                {purchaseDetails.type === 'subscription' ? 'Subscription' : 'Credit Package'}
              </span>
            </div>
            {purchaseDetails.email && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-gray-900">{purchaseDetails.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            What's Next?
          </h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-medium text-gray-900">Email Receipt</h3>
                <p className="text-gray-600 text-sm">
                  A receipt has been sent to your email address with all the details of your purchase.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CreditCard className="h-5 w-5 text-green-600 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-medium text-gray-900">Account Updated</h3>
                <p className="text-gray-600 text-sm">
                  {purchaseDetails.type === 'subscription' 
                    ? 'Your subscription is now active and you can start using all features immediately.'
                    : 'Your credits have been added to your account and are ready to use.'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Download className="h-5 w-5 text-purple-600 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-medium text-gray-900">Start Scanning</h3>
                <p className="text-gray-600 text-sm">
                  You can now access your dashboard and start running accessibility scans with your new plan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0B1220] hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0B1220] transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href="/new-scan"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0B1220] transition-colors"
          >
            Start New Scan
          </Link>
        </div>

        {/* Support Section */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Need help or have questions about your purchase?
          </p>
          <Link
            href="/settings"
            className="text-[#0B1220] hover:text-gray-800 font-medium underline focus:outline-none focus:ring-2 focus:ring-[#0B1220] focus:ring-offset-2 rounded"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}

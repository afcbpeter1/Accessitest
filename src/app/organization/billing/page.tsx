'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')

    if (success === 'true') {
      setStatus('success')
      setMessage('Your additional user seats have been successfully added! You will receive a confirmation email shortly.')
      
      // Redirect to organization page after 3 seconds
      setTimeout(() => {
        router.push('/organization?tab=billing&success=true')
      }, 3000)
    } else if (canceled === 'true') {
      setStatus('error')
      setMessage('Payment was canceled. No charges were made.')
      
      // Redirect to organization page after 3 seconds
      setTimeout(() => {
        router.push('/organization?tab=billing&canceled=true')
      }, 3000)
    } else {
      // No params, just redirect
      router.push('/organization?tab=billing')
    }
  }, [searchParams, router])

  return (
    <Sidebar>
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Processing your payment...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to organization page...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Canceled</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to organization page...</p>
            </>
          )}
        </div>
      </div>
    </Sidebar>
  )
}







'use client'

import { useState, useEffect } from 'react'
import { Check, CreditCard, Zap, Shield, FileText, Globe } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { STRIPE_PRICE_IDS } from '@/lib/stripe-config'
import { useAuth } from '@/contexts/AuthContext'

interface PricingPlan {
  name: string
  description: string
  price: number
  yearlyPrice: number
  features: string[]
  popular?: boolean
  credits?: number
  unlimited?: boolean
}

interface CreditPackage {
  name: string
  credits: number
  price: number
  pricePerCredit: number
  savings?: string
}

export default function Pricing() {
  const { user, isLoading } = useAuth()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedCredits, setSelectedCredits] = useState<string | null>(null)

  const subscriptionPlans: PricingPlan[] = [
    {
      name: 'Unlimited Access',
      description: 'Both web and document scanning (prices in GBP, tax excluded)',
      price: 19.99,
      yearlyPrice: 191.90, // £19.99 × 12 × 0.8 ≈ £191.90/year (20% discount)
      features: [
        'Unlimited website scans',
        'Unlimited document scans',
        'WCAG 2.2 + Section 508 compliance',
        'AI-powered recommendations',
        'Multi-page scanning',
        'Detailed issue breakdowns'
      ],
      popular: true,
      unlimited: true
    }
  ]

  const creditPackages: CreditPackage[] = [
    {
      name: 'Starter Pack',
      credits: 5,
      price: 7.50,
      pricePerCredit: 1.50
    },
    {
      name: 'Professional Pack',
      credits: 7,
      price: 10.50,
      pricePerCredit: 1.50
    },
    {
      name: 'Business Pack',
      credits: 9,
      price: 13.50,
      pricePerCredit: 1.50
    },
    {
      name: 'Enterprise Pack',
      credits: 11,
      price: 16.50,
      pricePerCredit: 1.50
    }
  ]

  const handleSubscribe = async (plan: PricingPlan) => {
    // Wait for auth to finish loading
    if (isLoading) {
      return // Don't do anything while loading
    }
    
    // Check if user is authenticated (check localStorage directly as fallback)
    const token = localStorage.getItem('accessToken')
    const userData = localStorage.getItem('user')
    
    if (!user && (!token || !userData)) {
      alert('Please sign in to subscribe. Credits and subscriptions are applied to your account.')
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }
    
    // Get user info from localStorage if useAuth hasn't loaded yet
    let userId: string | undefined = user?.id
    let userEmail: string | undefined = user?.email
    
    if (!userId || !userEmail) {
      try {
        const parsedUser = userData ? JSON.parse(userData) : null
        userId = userId || parsedUser?.id
        userEmail = userEmail || parsedUser?.email
      } catch (e) {
        console.error('Failed to parse user data:', e)
      }
    }
    
    if (!userId || !userEmail) {
      alert('Please sign in to subscribe. Credits and subscriptions are applied to your account.')
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }
    
    setSelectedPlan(plan.name)
    
    try {
      // Determine the correct price ID based on plan and billing cycle
      let priceId = ''
      
      if (plan.name === 'Unlimited Access') {
        priceId = billingCycle === 'monthly'
          ? STRIPE_PRICE_IDS.subscriptions.unlimitedMonthly
          : STRIPE_PRICE_IDS.subscriptions.unlimitedYearly
      }

      // Create checkout session
      // Don't override successUrl - let the API generate it with purchase details
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include auth token if available
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          priceId,
          userId,
          userEmail,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      })

      const data = await response.json()

      if (data.success && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      } else {
        // Check if it's an auth error
        if (data.error?.includes('Authentication') || data.error?.includes('login')) {
          alert('Please sign in to subscribe. Credits and subscriptions are applied to your account.')
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          return
        }
        console.error('Failed to create checkout session:', data.error)
        alert('Failed to start checkout process. Please try again.')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('An error occurred. Please try again.')
    }
  }

  const handleBuyCredits = async (creditPackage: CreditPackage) => {
    // Wait for auth to finish loading
    if (isLoading) {
      return // Don't do anything while loading
    }
    
    // Check if user is authenticated (check localStorage directly as fallback)
    const token = localStorage.getItem('accessToken')
    const userData = localStorage.getItem('user')
    
    if (!user && (!token || !userData)) {
      alert('Please sign in to buy credits. Purchased credits are added to your account.')
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }
    
    // Get user info from localStorage if useAuth hasn't loaded yet
    let userId: string | undefined = user?.id
    let userEmail: string | undefined = user?.email
    
    if (!userId || !userEmail) {
      try {
        const parsedUser = userData ? JSON.parse(userData) : null
        userId = userId || parsedUser?.id
        userEmail = userEmail || parsedUser?.email
      } catch (e) {
        console.error('Failed to parse user data:', e)
      }
    }
    
    if (!userId || !userEmail) {
      alert('Please sign in to buy credits. Purchased credits are added to your account.')
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }
    
    setSelectedCredits(creditPackage.name)
    
    try {
      // Determine the correct price ID based on credit package
      let priceId = ''
      
      if (creditPackage.name === 'Starter Pack') {
        priceId = STRIPE_PRICE_IDS.credits.starterPack
      } else if (creditPackage.name === 'Professional Pack') {
        priceId = STRIPE_PRICE_IDS.credits.professionalPack
      } else if (creditPackage.name === 'Business Pack') {
        priceId = STRIPE_PRICE_IDS.credits.businessPack
      } else if (creditPackage.name === 'Enterprise Pack') {
        priceId = STRIPE_PRICE_IDS.credits.enterprisePack
      }

      // Create checkout session
      // Don't override successUrl - let the API generate it with purchase details
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include auth token if available
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          priceId,
          userId,
          userEmail,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      })

      const data = await response.json()

      if (data.success && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      } else {
        // Check if it's an auth error
        if (data.error?.includes('Authentication') || data.error?.includes('login')) {
          alert('Please sign in to buy credits. Purchased credits are added to your account.')
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          return
        }
        console.error('Failed to create checkout session:', data.error)
        alert('Failed to start checkout process. Please try again.')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('An error occurred. Please try again.')
    }
  }

  return (
    <Sidebar>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include our core accessibility testing features.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6 items-stretch max-w-md mx-auto overflow-visible">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-lg shadow-lg border-2 p-6 flex flex-col h-full overflow-visible ${
                  plan.popular ? 'border-primary-500 pt-8' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-700 mb-4">{plan.description}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      £{(billingCycle === 'monthly' ? plan.price : plan.yearlyPrice).toFixed(2)}
                    </span>
                    <span className="text-gray-700">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600">
                      <p>Save £{((plan.price * 12) - plan.yearlyPrice).toFixed(2)} per year (20% off monthly price)</p>
                      <p className="text-xs text-gray-600 mt-1">Billed annually. Prices exclude tax.</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-800">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan)}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium transition-colors hover:bg-primary-700 mt-auto"
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Credit-Based Scanning */}
        <div id="credit-packages">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Credit Packages</h2>
          <p className="text-center text-gray-700 mb-8 max-w-2xl mx-auto">
            Don't need unlimited access? Buy credits and scan only when you need to. 
            Each scan costs £1.50 regardless of document size or complexity (tax excluded).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creditPackages.map((creditPackage) => (
              <div
                key={creditPackage.name}
                className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{creditPackage.name}</h3>
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {creditPackage.credits}
                  </div>
                  <div className="text-sm text-gray-700">credits</div>
                </div>
                <div className="mb-4">
                  <div className="text-2xl font-bold text-primary-600">
                    £{creditPackage.price.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-700">
                    £{creditPackage.pricePerCredit.toFixed(2)} per credit
                  </div>
                </div>
                <button
                  onClick={() => handleBuyCredits(creditPackage)}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Buy Credits
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Features Comparison */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">What's Included</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <Globe className="h-6 w-6 text-blue-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Website Scans</h3>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li>• WCAG 2.2 Level AA compliance</li>
                <li>• Automated accessibility testing</li>
                <li>• Detailed issue reports</li>
                <li>• AI-powered recommendations</li>
                <li>• Multi-page scanning</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Document Scans</h3>
                </div>
              <ul className="space-y-2 text-gray-700">
                <li>• Section 508 compliance testing</li>
                <li>• PDF, Word, PowerPoint support</li>
                <li>• AI-powered recommendations</li>
                <li>• Detailed accessibility scores</li>
                <li>• Issue categorization & prioritization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">How do credits work?</h3>
              <p className="text-gray-700">
                Each credit allows you to scan one document or website. Credits never expire and can be used for any type of scan.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Can I switch between plans?</h3>
              <p className="text-gray-700">
                Yes! You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-700">
                We use Stripe for secure payments and accept all major credit cards.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  )
}

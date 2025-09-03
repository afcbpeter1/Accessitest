'use client'

import { useState } from 'react'
import { Check, CreditCard, Zap, Shield, FileText, Globe } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedCredits, setSelectedCredits] = useState<string | null>(null)

  const subscriptionPlans: PricingPlan[] = [
    {
      name: 'Web Scan Only',
      description: 'Unlimited website accessibility scans',
      price: 29,
      yearlyPrice: 278, // $29 × 12 × 0.8 = $278.40/year
      features: [
        'Unlimited website scans',
        'WCAG 2.2 compliance testing',
        'Detailed accessibility reports',
        'AI-powered recommendations',
        'Multi-page scanning'
      ],
      unlimited: true
    },
    {
      name: 'Document Scan Only',
      description: 'Unlimited document accessibility scans',
      price: 39,
      yearlyPrice: 374, // $39 × 12 × 0.8 = $374.40/year
      features: [
        'Unlimited document scans',
        'Section 508 compliance testing',
        'PDF, Word, PowerPoint support',
        'AI-powered recommendations',
        'Detailed issue breakdowns'
      ],
      unlimited: true
    },
    {
      name: 'Complete Access',
      description: 'Both web and document scanning',
      price: 59,
      yearlyPrice: 566, // $59 × 12 × 0.8 = $566.40/year
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

  const handleSubscribe = (plan: PricingPlan) => {
    setSelectedPlan(plan.name)
    // Here you would integrate with Stripe or your payment processor
    console.log('Subscribing to:', plan.name, billingCycle)
  }

  const handleBuyCredits = (creditPackage: CreditPackage) => {
    setSelectedCredits(creditPackage.name)
    // Here you would integrate with Stripe or your payment processor
    console.log('Buying credits:', creditPackage.name)
  }

  return (
    <Sidebar>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get comprehensive accessibility testing with flexible pricing options. 
            Subscribe for unlimited access or pay per scan with credits.
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
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
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
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-lg shadow-lg border-2 p-6 flex flex-col h-full ${
                  plan.popular ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.price : plan.yearlyPrice}
                    </span>
                    <span className="text-gray-600">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600">
                      <p>Save ${((plan.price * 12) - plan.yearlyPrice).toFixed(0)} per year</p>
                      <p className="text-xs text-gray-500 mt-1">Billed annually</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan)}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mt-auto ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-blue-700'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Credit-Based Scanning */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Pay Per Scan</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            Don't need unlimited access? Buy credits and scan only when you need to. 
            Each scan costs $1.50 regardless of document size or complexity.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <div className="text-sm text-gray-600">credits</div>
                </div>
                <div className="mb-4">
                  <div className="text-2xl font-bold text-blue-600">
                    ${creditPackage.price}
                  </div>
                  <div className="text-sm text-gray-600">
                    ${creditPackage.pricePerCredit} per credit
                  </div>
                </div>
                <button
                  onClick={() => handleBuyCredits(creditPackage)}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
              <ul className="space-y-2 text-gray-600">
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
              <ul className="space-y-2 text-gray-600">
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
              <p className="text-gray-600">
                Each credit allows you to scan one document or website. Credits never expire and can be used for any type of scan.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Can I switch between plans?</h3>
              <p className="text-gray-600">
                Yes! You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We use Stripe for secure payments and accept all major credit cards.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  )
}

import PricingSection from '@/components/PricingSection'
import Sidebar from '@/components/Sidebar'
import { CheckCircle, Shield, Zap, Users, Globe, ArrowRight } from 'lucide-react'

export default function PricingPage() {
  const features = [
    {
      title: 'WCAG 2.2 Compliance',
      description: 'Test against the latest accessibility standards including Level A, AA, and AAA compliance',
      icon: Shield
    },
    {
      title: 'AI-Powered Fixes',
      description: 'Get intelligent, contextual suggestions for fixing accessibility issues with code examples',
      icon: Zap
    },
    {
      title: 'Multi-Page Scanning',
      description: 'Scan entire websites, not just single pages, with configurable depth and scope',
      icon: Globe
    },
    {
      title: 'Team Collaboration',
      description: 'Share reports, track progress, and collaborate with your team on accessibility improvements',
      icon: Users
    }
  ]

  const faqs = [
    {
      question: 'What is included in the free trial?',
      answer: 'The 7-day free trial includes all features of the Professional plan, allowing you to test up to 50 websites with AI-powered remediation suggestions and detailed compliance reports.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access to your plan until the end of your current billing period.'
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 30-day money-back guarantee. If you\'re not satisfied with our service, contact us within 30 days for a full refund.'
    },
    {
      question: 'What compliance standards do you support?',
      answer: 'We support WCAG 2.2 (Web Content Accessibility Guidelines) including Level A, AA, and AAA compliance. We also support Section 508 and other international accessibility standards.'
    },
    {
      question: 'Can I scan private or password-protected websites?',
      answer: 'Currently, our scanning is limited to publicly accessible websites. We\'re working on adding support for authenticated scanning in future updates.'
    },
    {
      question: 'How accurate are the AI suggestions?',
      answer: 'Our AI-powered suggestions are trained on thousands of accessibility fixes and provide contextual, actionable recommendations with code examples. They achieve over 95% accuracy in identifying and suggesting fixes for common accessibility issues.'
    },
    {
      question: 'What happens if I exceed my monthly scan limit?',
      answer: 'If you exceed your monthly scan limit, you can either upgrade to a higher plan or purchase additional scans. We\'ll notify you when you\'re approaching your limit so you can plan accordingly.'
    },
    {
      question: 'Can I carry over unused scans to the next month?',
      answer: 'Currently, scans are reset monthly and don\'t carry over. This ensures fair usage and helps us maintain consistent service quality for all users.'
    }
  ]

  return (
    <Sidebar>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the perfect plan for your accessibility testing needs. All plans include a 30-day free trial with no credit card required.
          </p>
        </div>

        {/* Pricing Section */}
        <PricingSection />

        {/* Features Section */}
        <div className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Why Choose Our Accessibility Testing Platform?
              </h2>
              <p className="text-xl text-gray-600">
                Professional-grade tools that make accessibility testing simple and effective
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => {
                const IconComponent = feature.icon
                return (
                  <div key={index} className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 text-green-600 mb-4">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {feature.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-gray-600">
                Everything you need to know about our accessibility testing platform
              </p>
            </div>

            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 bg-green-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Improve Your Website's Accessibility?
            </h2>
            <p className="text-xl text-green-100 mb-8">
              Start your free trial today and see how easy it is to make your website accessible to everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 flex items-center justify-center">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors duration-200">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  )
}

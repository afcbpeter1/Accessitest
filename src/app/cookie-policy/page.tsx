import type { Metadata } from 'next'
import Link from 'next/link'
import { Cookie, Shield, BarChart3, Settings, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Cookie Policy - A11ytest.ai',
  description: 'Learn about how we use cookies and similar technologies on A11ytest.ai',
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Cookie Policy</h1>
            </div>
            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Are Cookies?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Cookies are small text files that are placed on your device when you visit a website. 
                They are widely used to make websites work more efficiently and provide information to 
                the website owners.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Cookies</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A11ytest.ai uses cookies and similar technologies to enhance your browsing experience, 
                analyze site traffic, personalize content, and improve our services. We only use cookies 
                that are necessary for the website to function properly and to provide you with the best 
                possible experience.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Types of Cookies We Use</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Lock className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Essential Cookies</h3>
                      <p className="text-gray-700 leading-relaxed mb-3">
                        These cookies are strictly necessary for the website to function properly. 
                        They enable core functionality such as security, network management, and accessibility.
                      </p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li><strong>Authentication:</strong> Remember your login status and session information</li>
                        <li><strong>Security:</strong> Protect against fraud and maintain security</li>
                        <li><strong>Preferences:</strong> Remember your accessibility settings and preferences</li>
                        <li><strong>Cookie Consent:</strong> Remember your cookie preferences</li>
                      </ul>
                      <p className="text-sm text-gray-600 mt-3 italic">
                        These cookies cannot be disabled as they are essential for the website to function.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <BarChart3 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics Cookies</h3>
                      <p className="text-gray-700 leading-relaxed mb-3">
                        These cookies help us understand how visitors interact with our website by 
                        collecting and reporting information anonymously.
                      </p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>Track page views and user interactions</li>
                        <li>Analyze site performance and identify issues</li>
                        <li>Understand user behavior to improve our services</li>
                      </ul>
                      <p className="text-sm text-gray-600 mt-3 italic">
                        These cookies are optional and can be disabled in your cookie preferences.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Settings className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Functional Cookies</h3>
                      <p className="text-gray-700 leading-relaxed mb-3">
                        These cookies enable enhanced functionality and personalization, such as 
                        remembering your preferences and settings.
                      </p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>Remember your accessibility settings (font size, contrast, etc.)</li>
                        <li>Store your scan history preferences</li>
                        <li>Remember your dashboard layout preferences</li>
                      </ul>
                      <p className="text-sm text-gray-600 mt-3 italic">
                        These cookies are optional and can be disabled in your cookie preferences.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Cookies</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the following third-party services that may set cookies:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li><strong>Stripe:</strong> Payment processing cookies for secure transactions</li>
                <li><strong>Adobe PDF Services:</strong> Cookies for PDF processing functionality</li>
                <li><strong>Anthropic Claude API:</strong> No cookies set (API-based service)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                These third-party services have their own privacy policies and cookie practices. 
                We recommend reviewing their policies for more information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Managing Your Cookie Preferences</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You can control and manage cookies in several ways:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li><strong>Browser Settings:</strong> Most browsers allow you to refuse or accept cookies. 
                  You can also delete cookies that have already been set. Please note that blocking 
                  essential cookies may impact your ability to use our website.</li>
                <li><strong>Cookie Banner:</strong> When you first visit our site, you can choose to 
                  accept or reject non-essential cookies through our cookie consent banner.</li>
                <li><strong>Clear Browser Data:</strong> You can clear your browser's cookies and 
                  cache at any time, which will reset your cookie preferences.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Local Storage</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                In addition to cookies, we use browser local storage to store:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Authentication tokens (JWT) for maintaining your login session</li>
                <li>User preferences and accessibility settings</li>
                <li>Cookie consent status</li>
                <li>Temporary scan data (not stored permanently)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You can clear local storage through your browser settings, which will log you out 
                and reset your preferences.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Updates to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in our 
                practices or for other operational, legal, or regulatory reasons. We will notify 
                you of any material changes by posting the new Cookie Policy on this page and 
                updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about our use of cookies, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Email:</strong> <a href="mailto:contact@a11ytest.ai" className="text-blue-600 hover:text-blue-800">contact@a11ytest.ai</a>
                </p>
              </div>
            </section>

            <div className="border-t border-gray-200 pt-8 mt-8">
              <div className="flex flex-wrap gap-4">
                <Link 
                  href="/privacy-policy" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Privacy Policy
                </Link>
                <Link 
                  href="/terms-of-service" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Terms of Service →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




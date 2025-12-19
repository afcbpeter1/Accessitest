import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, Eye, Database, X, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy - A11ytest.ai',
  description: 'Learn how A11ytest.ai collects, uses, and protects your personal information',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
            </div>
            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                At A11ytest.ai, we are committed to protecting your privacy and ensuring the security 
                of your personal information. This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our accessibility testing platform.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using our service, you agree to the collection and use of information in accordance 
                with this policy. We will not use or share your information except as described in this 
                Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    Account Information
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    When you create an account, we collect:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Email address (required for account verification and communication)</li>
                    <li>First name and last name</li>
                    <li>Company name (optional)</li>
                    <li>Password (stored as encrypted hash, never in plain text)</li>
                    <li>IP address (for security and fraud prevention)</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Scan Data
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    When you perform accessibility scans, we store:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Scan metadata (scan type, date, duration, pages analyzed)</li>
                    <li>Accessibility issues found (descriptions, locations, recommendations)</li>
                    <li>Compliance scores and summaries</li>
                    <li>File metadata (filename, file type, file size) - <strong>NOT the actual file content</strong></li>
                    <li>URLs scanned (for web scans)</li>
                    <li>Scan settings and preferences</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    Payment Information
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    For payment processing, we use Stripe. We store:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Stripe subscription ID (for subscription management)</li>
                    <li>Credit transaction history (amount, date, package name)</li>
                    <li>Plan type and subscription status</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-3 italic">
                    <strong>We do NOT store:</strong> Credit card numbers, CVV codes, or any payment card details. 
                    All payment information is processed securely by Stripe and never touches our servers.
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-yellow-600" />
                    Usage Data
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    We automatically collect:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Browser type and version</li>
                    <li>Device information</li>
                    <li>Access times and dates</li>
                    <li>Pages visited and features used</li>
                    <li>Error logs and performance data</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Do NOT Store</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <X className="h-5 w-5 text-red-600" />
                  Data We Never Collect or Store
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>Document Content:</strong> We do NOT store the actual content of PDFs, Word documents, 
                    or other files you upload. Only metadata (filename, type, size) and scan results are stored.</li>
                  <li><strong>Payment Card Details:</strong> We never see or store credit card numbers, CVV codes, 
                    or expiration dates. All payment processing is handled by Stripe.</li>
                  <li><strong>Website Content:</strong> For web scans, we store the URL and scan results, but not 
                    the actual HTML content or page screenshots.</li>
                  <li><strong>Personal Documents:</strong> Any personal or sensitive information contained in scanned 
                    documents is never stored on our servers.</li>
                  <li><strong>Third-Party Credentials:</strong> We do not store passwords or API keys for any 
                    third-party services you may use.</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Service Delivery:</strong> To provide, maintain, and improve our accessibility testing services</li>
                <li><strong>Account Management:</strong> To manage your account, process payments, and provide customer support</li>
                <li><strong>Communication:</strong> To send you verification emails, notifications, and important service updates</li>
                <li><strong>Security:</strong> To detect, prevent, and address security issues and fraudulent activity</li>
                <li><strong>Analytics:</strong> To analyze usage patterns and improve our platform's performance and features</li>
                <li><strong>Compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the following third-party services that may process your data:
              </p>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Stripe</h4>
                  <p className="text-gray-700 text-sm">
                    Payment processing. Stripe handles all payment card information and transactions. 
                    We only receive transaction confirmations and subscription IDs. 
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-1">
                      View Stripe's Privacy Policy
                    </a>
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Adobe PDF Services</h4>
                  <p className="text-gray-700 text-sm">
                    PDF processing and accessibility tagging. PDFs are processed temporarily and not stored by Adobe. 
                    <a href="https://www.adobe.com/privacy.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-1">
                      View Adobe's Privacy Policy
                    </a>
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Anthropic Claude API</h4>
                  <p className="text-gray-700 text-sm">
                    AI-powered remediation suggestions. Scan results are sent to Claude API for analysis. 
                    Data is not used for training and is deleted after processing. 
                    <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-1">
                      View Anthropic's Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  We implement industry-standard security measures to protect your information:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Passwords are hashed using bcrypt with salt (never stored in plain text)</li>
                  <li>All data transmission is encrypted using HTTPS/TLS</li>
                  <li>Database access is restricted and monitored</li>
                  <li>Regular security audits and updates</li>
                  <li>Access controls and authentication required for all data access</li>
                  <li>Secure payment processing through Stripe (PCI DSS compliant)</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain your information for as long as necessary to provide our services:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Account Data:</strong> Retained while your account is active and for 30 days after account deletion</li>
                <li><strong>Scan History:</strong> Retained until you delete the scan or your account is deleted</li>
                <li><strong>Payment Records:</strong> Retained for 7 years as required by tax and accounting regulations</li>
                <li><strong>Logs:</strong> Retained for 90 days for security and troubleshooting purposes</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Portability:</strong> Export your scan history and account data</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails (account-related emails will still be sent)</li>
                <li><strong>Cookie Preferences:</strong> Manage cookie settings through your browser or our cookie banner</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:contact@a11ytest.ai" className="text-blue-600 hover:text-blue-800">contact@a11ytest.ai</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Our service is not intended for users under the age of 18. We do not knowingly collect 
                personal information from children. If you believe we have collected information from a 
                child, please contact us immediately and we will delete the information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material 
                changes by posting the new Privacy Policy on this page and updating the "Last updated" date. 
                We encourage you to review this policy periodically.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
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
                  href="/cookie-policy" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Cookie Policy
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




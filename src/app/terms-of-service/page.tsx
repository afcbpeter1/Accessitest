import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, CreditCard, AlertTriangle, Shield, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service - A11ytest.ai',
  description: 'Terms and conditions for using A11ytest.ai accessibility testing platform',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
            </div>
            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                By accessing or using A11ytest.ai ("Service"), you agree to be bound by these Terms of Service 
                ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A11ytest.ai is an accessibility testing platform that provides:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Automated accessibility scanning for PDF documents and websites</li>
                <li>WCAG 2.2 and Section 508 compliance testing</li>
                <li>AI-powered remediation suggestions</li>
                <li>Scan history and reporting</li>
                <li>Product backlog and sprint management tools</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Accounts</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Requirements</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>You must be at least 18 years old to create an account</li>
                  <li>You must provide accurate and complete information when registering</li>
                  <li>You are responsible for maintaining the security of your account and password</li>
                  <li>You must notify us immediately of any unauthorized use of your account</li>
                  <li>You may not share your account credentials with others</li>
                  <li>You are responsible for all activities that occur under your account</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-blue-600" />
                Payment Terms and Stripe
              </h2>
              
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment Processing</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    All payments are processed securely through Stripe, a third-party payment processor. 
                    By making a purchase, you agree to Stripe's Terms of Service and Privacy Policy.
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>We do not store or have access to your payment card details</li>
                    <li>All payment information is encrypted and processed by Stripe</li>
                    <li>Stripe is PCI DSS Level 1 compliant (the highest level of certification)</li>
                    <li>Payment disputes and refunds are handled according to Stripe's policies</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-3">
                    <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      View Stripe's Terms of Service
                    </a>
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Credit Purchases</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>Credits are purchased in packages and added to your account immediately upon successful payment</li>
                    <li>Credits do not expire and can be used at any time</li>
                    <li>Each scan (web or document) consumes 1 credit</li>
                    <li>Credits are non-refundable except as required by law or at our discretion</li>
                    <li>Unused credits remain in your account even if you cancel your subscription</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Subscriptions</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>Subscriptions are billed annually or monthly as selected</li>
                    <li>Subscriptions automatically renew unless cancelled</li>
                    <li>You can cancel your subscription at any time through your account settings</li>
                    <li>Cancellation takes effect at the end of the current billing period</li>
                    <li>No refunds for partial billing periods unless required by law</li>
                    <li>Subscription plans include unlimited credits for the duration of the subscription</li>
                  </ul>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Refunds</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>Credit purchases are generally non-refundable</li>
                    <li>Subscription refunds may be available within 30 days of purchase at our discretion</li>
                    <li>Refunds for technical issues or service failures will be handled on a case-by-case basis</li>
                    <li>To request a refund, contact us at <a href="mailto:hello@a11ytest.ai" className="text-blue-600 hover:text-blue-800">hello@a11ytest.ai</a></li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptable Use</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">You Agree NOT to:</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Use the Service for any illegal purpose or in violation of any laws</li>
                  <li>Upload malicious files, viruses, or harmful code</li>
                  <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Resell or redistribute the Service without our written permission</li>
                  <li>Upload content that violates intellectual property rights</li>
                  <li>Upload content containing sensitive personal information (SSN, credit card numbers, etc.)</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Limitations</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Important Limitations
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>PDF Size Limits:</strong> Maximum 100MB per PDF file</li>
                  <li><strong>PDF Page Limits:</strong> Maximum 400 pages for standard PDFs, 150 pages for scanned PDFs</li>
                  <li><strong>File Formats:</strong> Currently supports PDF documents only</li>
                  <li><strong>Scan Accuracy:</strong> While we strive for accuracy, automated scans may not catch all accessibility issues</li>
                  <li><strong>Service Availability:</strong> We do not guarantee 100% uptime and may perform maintenance</li>
                  <li><strong>Third-Party Services:</strong> Service depends on third-party APIs (Adobe, Anthropic) which may have their own limitations</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                The Service and its original content, features, and functionality are owned by A11ytest.ai 
                and are protected by international copyright, trademark, patent, trade secret, and other 
                intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed">
                You retain ownership of any content you upload, but grant us a license to use, process, 
                and analyze it solely for the purpose of providing the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Disclaimer of Warranties</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                  EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>We do not guarantee that the Service will be error-free or uninterrupted</li>
                  <li>We do not guarantee that scan results are 100% accurate or complete</li>
                  <li>We are not responsible for accessibility issues that may exist but are not detected</li>
                  <li>We do not guarantee compliance with all accessibility standards</li>
                  <li>You are responsible for verifying scan results and implementing fixes</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, A11YTEST.AI SHALL NOT BE LIABLE FOR:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                  <li>Loss of profits, revenue, data, or business opportunities</li>
                  <li>Damages resulting from your use or inability to use the Service</li>
                  <li>Damages resulting from accessibility issues in your documents or websites</li>
                  <li>Damages resulting from third-party service failures (Stripe, Adobe, Anthropic)</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify and hold harmless A11ytest.ai, its officers, directors, employees, 
                and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) 
                arising out of your use of the Service, violation of these Terms, or infringement of any rights 
                of another.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior 
                notice, for any reason, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>Extended period of account inactivity</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Upon termination, your right to use the Service will cease immediately. You may delete your 
                account at any time through your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
                in which A11ytest.ai operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of any material 
                changes by posting the new Terms on this page and updating the "Last updated" date. Your 
                continued use of the Service after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Email:</strong> <a href="mailto:hello@a11ytest.ai" className="text-blue-600 hover:text-blue-800">hello@a11ytest.ai</a>
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
                  href="/cookie-policy" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Cookie Policy →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}






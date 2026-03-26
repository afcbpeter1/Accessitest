import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - A11ytest.ai',
  description: 'Terms of Service for A11YTEST.AI LTD',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mb-8 text-sm text-gray-600">A11YTEST.AI LTD | Company No. 17070504 | Last updated: March 2026</p>

          <div className="space-y-6 text-gray-700">
            <section><h2 className="text-xl font-semibold text-gray-900">1. About Us</h2><p>A11ytest.ai is operated by A11YTEST.AI LTD, registered in England and Wales (Company No. 17070504), registered address: [YOUR REGISTERED ADDRESS]. Contact: hello@a11ytest.ai.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">2. Agreement to Terms</h2><p>By accessing or using A11ytest.ai (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p><p>These Terms, together with our Privacy Policy and Cookie Policy, form the entire agreement between you and us regarding the Service.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">3. Description of Service</h2><ul className="list-disc pl-6"><li>Automated accessibility scanning for PDF documents and websites</li><li>WCAG 2.2 and Section 508 compliance testing</li><li>AI-powered remediation suggestions</li><li>Scan history, reporting, and product backlog integration</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">4. Account Requirements</h2><ul className="list-disc pl-6"><li>You must be at least 18 years old to create an account</li><li>You must provide accurate and complete information</li><li>You are responsible for account/password security and all activity under your account</li><li>Notify us immediately of unauthorized use at hello@a11ytest.ai</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">5. Payment Terms</h2><p>All payments are processed securely through Stripe (PCI DSS Level 1). We do not store payment card details.</p><p className="font-medium">Credits</p><ul className="list-disc pl-6"><li>Added immediately after successful payment</li><li>Do not expire</li><li>Each scan consumes 1 credit</li><li>Generally non-refundable except where required by law</li></ul><p className="font-medium">Subscriptions</p><ul className="list-disc pl-6"><li>Billed monthly or annually</li><li>Auto-renew unless cancelled</li><li>Cancel anytime; effective end of billing period</li></ul><p className="font-medium">Consumers: 14-day cancellation right</p><p>If you are a consumer, you may cancel within 14 days under the Consumer Contracts Regulations 2013. If you used the Service in that period, refund may be reduced pro-rata.</p><p className="font-medium">Refunds</p><p>Contact hello@a11ytest.ai.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">6. Acceptable Use</h2><ul className="list-disc pl-6"><li>No illegal use or law violations</li><li>No malware/harmful code</li><li>No unauthorized access attempts</li><li>No disruption/interference</li><li>No unauthorized scraping/botting</li><li>No reverse engineering</li><li>No resale without permission</li><li>No uploading sensitive personal information</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">7. Service Limitations</h2><ul className="list-disc pl-6"><li>PDF max size: 100MB</li><li>PDF pages: 400 standard / 150 scanned</li><li>Automated scans are guidance only</li><li>No guarantee of 100% uptime</li><li>Third-party API dependency limits may apply</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">8. Intellectual Property</h2><p>The Service and its features are owned by A11YTEST.AI LTD. You retain ownership of uploaded content and grant us a limited license to process it solely to provide the Service.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">9. Disclaimer of Warranties</h2><p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;. We disclaim all implied warranties to the fullest extent permitted by law. Nothing excludes liability that cannot be excluded under English law.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">10. Limitation of Liability</h2><p>To the maximum extent permitted by English law, total liability is limited to the greater of: (a) amounts paid in the preceding 12 months, or (b) £100. No liability for indirect or consequential losses. Consumer statutory rights are unaffected.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">11. Indemnification</h2><p>You agree to indemnify and hold harmless A11YTEST.AI LTD for claims/losses arising from your use of the Service or violation of these Terms.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">12. Termination</h2><p>We may suspend/terminate for Terms violations, fraud/illegal activity, or non-payment. You may delete your account at any time.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">13. Governing Law and Jurisdiction</h2><p>These Terms are governed by the laws of England and Wales. Courts of England and Wales have exclusive jurisdiction, subject to consumer rights in Scotland/Northern Ireland.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">14. Changes to Terms</h2><p>We may modify Terms with at least 30 days&apos; notice for material changes.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">15. Contact</h2><p>A11YTEST.AI LTD<br />Company No: 17070504<br />Registered address: [YOUR REGISTERED ADDRESS]<br />Email: hello@a11ytest.ai</p></section>
          </div>
        </article>
      </div>
    </div>
  )
}

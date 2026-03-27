import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - A11ytest.ai',
  description: 'Privacy Policy for A11YTEST.AI LTD',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mb-8 text-sm text-gray-600">
            A11YTEST.AI LTD | Company No. 17070504 | Last updated: March 2026
            <br />
            [28 Healdfield Court, Castleford, WF104TU]
          </p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900">1. Who We Are</h2>
              <p>
                A11ytest.ai is operated by A11YTEST.AI LTD, a company registered in England and Wales (Company No. 17070504),
                with registered address at [28 Healdfield Court, Castleford, WF104TU].
              </p>
              <p>
                We are the data controller for the personal data collected through https://a11ytest.ai. If you have any questions about
                this policy or how we handle your data, contact us at hello@a11ytest.ai.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">2. What Data We Collect and Why</h2>
              <p>
                Under UK GDPR Article 6, we must have a lawful basis for processing your personal data. The table below sets out what we
                collect, why, and the legal basis we rely on.
              </p>
              <div className="overflow-x-auto">
                <table tabIndex={0} aria-label="Privacy policy data collection table" className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-gray-200 bg-gray-50 p-2 text-left">Data type</th>
                      <th className="border-b border-gray-200 bg-gray-50 p-2 text-left">Purpose</th>
                      <th className="border-b border-gray-200 bg-gray-50 p-2 text-left">Lawful basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border-b p-2">Email, name, password hash</td><td className="border-b p-2">Account registration and authentication</td><td className="border-b p-2">Contract performance (Art. 6(1)(b))</td></tr>
                    <tr><td className="border-b p-2">Company name</td><td className="border-b p-2">Account personalisation (optional)</td><td className="border-b p-2">Legitimate interests (Art. 6(1)(f))</td></tr>
                    <tr><td className="border-b p-2">IP address</td><td className="border-b p-2">Security and fraud prevention</td><td className="border-b p-2">Legitimate interests (Art. 6(1)(f))</td></tr>
                    <tr><td className="border-b p-2">Scan metadata, results, URLs</td><td className="border-b p-2">Delivering the accessibility scanning service</td><td className="border-b p-2">Contract performance (Art. 6(1)(b))</td></tr>
                    <tr><td className="border-b p-2">Stripe subscription ID, payment history</td><td className="border-b p-2">Subscription management</td><td className="border-b p-2">Contract performance (Art. 6(1)(b))</td></tr>
                    <tr><td className="border-b p-2">Payment records (7 years)</td><td className="border-b p-2">Tax and accounting obligations</td><td className="border-b p-2">Legal obligation (Art. 6(1)(c))</td></tr>
                    <tr><td className="border-b p-2">Browser type, device info, access logs</td><td className="border-b p-2">Platform performance and security</td><td className="border-b p-2">Legitimate interests (Art. 6(1)(f))</td></tr>
                    <tr><td className="p-2">Usage patterns and feature interactions</td><td className="p-2">Improving our service</td><td className="p-2">Legitimate interests (Art. 6(1)(f))</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">3. Data We Do NOT Collect</h2>
              <ul className="list-disc pl-6">
                <li>The actual content of PDFs or files you upload — only metadata (filename, type, size) and scan results</li>
                <li>Credit card numbers, CVV codes, or payment card details — all payments are handled by Stripe</li>
                <li>The HTML content of web pages you scan — only the URL and scan results</li>
                <li>Personal or sensitive information contained within scanned documents</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">4. International Data Transfers</h2>
              <p>Some processors are outside the UK. We use safeguards for all international transfers:</p>
              <ul className="list-disc pl-6">
                <li>Stripe (USA): Covered by the UK-US Data Bridge adequacy decision. See stripe.com/privacy.</li>
                <li>Adobe PDF Services (USA): Governed by Adobe&apos;s Data Processing Agreement and Standard Contractual Clauses. PDFs are processed temporarily and not retained. See adobe.com/privacy.html.</li>
                <li>Anthropic Claude API (USA): Governed by Anthropic&apos;s Data Processing Agreement. Scan results are sent for AI analysis. Data is not used for model training and is deleted after processing. See anthropic.com/privacy.</li>
              </ul>
              <p>Where we rely on Standard Contractual Clauses, copies are available on request by contacting hello@a11ytest.ai.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">5. Data Retention</h2>
              <ul className="list-disc pl-6">
                <li>Account data: Retained while your account is active and for 30 days after account deletion</li>
                <li>Scan history: Retained until you delete the scan or close your account</li>
                <li>Payment records: Retained for 7 years as required by HMRC tax and accounting regulations</li>
                <li>Security logs: Retained for 90 days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">6. Your Rights Under UK GDPR</h2>
              <ul className="list-disc pl-6">
                <li>Right of access (Art. 15)</li>
                <li>Right to rectification (Art. 16)</li>
                <li>Right to erasure (Art. 17)</li>
                <li>Right to data portability (Art. 20)</li>
                <li>Right to restrict processing (Art. 18)</li>
                <li>Right to object (Art. 21)</li>
                <li>Right to opt out of marketing</li>
              </ul>
              <p>To exercise any of these rights, contact us at hello@a11ytest.ai. We will respond within one calendar month.</p>
              <p>Right to complain: You have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO) at ico.org.uk or by calling 0303 123 1113.</p>
            </section>

            <section><h2 className="text-xl font-semibold text-gray-900">7. Automated Decision-Making</h2><p>We do not use automated decision-making or profiling that produces legal or similarly significant effects on you.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">8. Data Security</h2><p>Passwords hashed using bcrypt with salt, HTTPS/TLS encryption, restricted database access, regular security reviews, and Stripe PCI DSS Level 1 processing.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">9. Children&apos;s Privacy</h2><p>Our service is not directed at anyone under the age of 18.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">10. Changes to This Policy</h2><p>We may update this Privacy Policy periodically and will notify material changes by email and updated date.</p></section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900">11. Contact</h2>
              <p>Data Controller: A11YTEST.AI LTD</p>
              <p>Company No: 17070504</p>
              <p>Registered address: [28 Healdfield Court, Castleford, WF104TU]</p>
              <p>Email: hello@a11ytest.ai</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}






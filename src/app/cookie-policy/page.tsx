import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy - A11ytest.ai',
  description: 'Cookie Policy for A11YTEST.AI LTD',
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Cookie Policy</h1>
          <p className="mb-8 text-sm text-gray-600">A11YTEST.AI LTD | Company No. 17070504 | Last updated: March 2026</p>

          <div className="space-y-6 text-gray-700">
            <section><h2 className="text-xl font-semibold text-gray-900">1. What Are Cookies?</h2><p>Cookies are small text files placed on your device when you visit a website. We also use browser local storage for some functionality.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">2. How We Use Cookies</h2><p>We use cookies to keep you logged in, remember preferences, and improve the platform. We do not use third-party advertising or tracking cookies.</p></section>
            <section>
              <h2 className="text-xl font-semibold text-gray-900">3. Cookies We Set</h2>
              <div className="overflow-x-auto">
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead><tr><th className="border-b bg-gray-50 p-2 text-left">Cookie name</th><th className="border-b bg-gray-50 p-2 text-left">Type</th><th className="border-b bg-gray-50 p-2 text-left">Duration</th><th className="border-b bg-gray-50 p-2 text-left">Purpose</th></tr></thead>
                  <tbody>
                    <tr><td className="border-b p-2">session_token</td><td className="border-b p-2">Essential</td><td className="border-b p-2">Session</td><td className="border-b p-2">Maintains login session</td></tr>
                    <tr><td className="border-b p-2">csrf_token</td><td className="border-b p-2">Essential</td><td className="border-b p-2">Session</td><td className="border-b p-2">CSRF protection</td></tr>
                    <tr><td className="border-b p-2">cookie_consent</td><td className="border-b p-2">Essential</td><td className="border-b p-2">12 months</td><td className="border-b p-2">Remembers consent preferences</td></tr>
                    <tr><td className="border-b p-2">accessibility_prefs</td><td className="border-b p-2">Functional</td><td className="border-b p-2">12 months</td><td className="border-b p-2">Stores accessibility settings</td></tr>
                    <tr><td className="p-2">dashboard_prefs</td><td className="p-2">Functional</td><td className="p-2">12 months</td><td className="p-2">Remembers dashboard layout preferences</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section><h2 className="text-xl font-semibold text-gray-900">4. Local Storage</h2><ul className="list-disc pl-6"><li>auth_token (JWT)</li><li>user_preferences</li><li>cookie_consent_status</li></ul><p>You can clear local storage via browser settings.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">5. Third-Party Cookies</h2><p>Stripe may set cookies for secure payment processing (see stripe.com/privacy). Adobe and Anthropic are backend API processors and do not set browser cookies for this service flow.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">6. Analytics</h2><p>We do not currently use third-party analytics cookies. If this changes, we will update this policy and obtain consent.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">7. Managing Your Cookie Preferences</h2><ul className="list-disc pl-6"><li>Cookie banner preferences</li><li>Browser settings</li><li>Clear browser data</li></ul><p>Common links: Chrome `chrome://settings/cookies`, Firefox `about:preferences#privacy`, Edge `edge://settings/privacy`.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">8. Consent</h2><p>We rely on consent (Art. 6(1)(a)) for non-essential cookies. Essential cookies are set under legitimate interests (Art. 6(1)(f)).</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">9. Changes to This Policy</h2><p>Material changes will be communicated via the cookie consent banner.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">10. Contact</h2><p>Questions about this policy: hello@a11ytest.ai</p></section>
          </div>
        </article>
      </div>
    </div>
  )
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
        <p className="text-gray-600 mb-6">Last updated: January 2025</p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. What Are Cookies</h2>
            <p className="text-gray-700 mb-4">
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
            </p>
            <p className="text-gray-700">
              A11ytest.ai uses cookies and similar technologies to enhance your experience, analyze usage, and assist in our marketing efforts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-700 mb-4">We use cookies for the following purposes:</p>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Essential Cookies</h3>
            <p className="text-gray-700 mb-4">
              These cookies are necessary for the Service to function properly. They enable core functionality such as:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>User authentication and session management</li>
              <li>Security features and fraud prevention</li>
              <li>Remembering your preferences and settings</li>
              <li>Load balancing and performance optimization</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Analytics Cookies</h3>
            <p className="text-gray-700 mb-4">
              These cookies help us understand how visitors interact with our Service by collecting and reporting information anonymously. We use this data to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Improve website performance and user experience</li>
              <li>Understand user behavior and preferences</li>
              <li>Identify and fix technical issues</li>
              <li>Optimize our Service features</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.3 Functional Cookies</h3>
            <p className="text-gray-700 mb-4">
              These cookies enable enhanced functionality and personalization, such as:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Remembering your language preferences</li>
              <li>Storing your scan history and preferences</li>
              <li>Maintaining your dashboard settings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Types of Cookies We Use</h2>
            
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">Cookie Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">Purpose</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-700">accessToken</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Authentication and session management</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Session / 15 minutes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-700">user</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Storing user preferences and data</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Persistent</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-700">_ga, _gid</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Google Analytics (if enabled)</td>
                    <td className="px-4 py-3 text-sm text-gray-700">2 years / 24 hours</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Third-Party Cookies</h2>
            <p className="text-gray-700 mb-4">
              In addition to our own cookies, we may also use various third-party cookies to report usage statistics and deliver advertisements. These may include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Payment Processors:</strong> Cookies from Stripe for payment processing</li>
              <li><strong>Analytics Services:</strong> Cookies from analytics providers to understand usage patterns</li>
              <li><strong>Cloud Storage:</strong> Cookies from Cloudinary for document and image processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Managing Cookies</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Browser Settings</h3>
            <p className="text-gray-700 mb-4">
              Most web browsers allow you to control cookies through their settings preferences. You can:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Block all cookies</li>
              <li>Block third-party cookies</li>
              <li>Delete cookies when you close your browser</li>
              <li>Delete existing cookies</li>
            </ul>
            <p className="text-gray-700 mb-4">
              However, please note that blocking or deleting cookies may impact your ability to use certain features of our Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 Opt-Out Links</h3>
            <p className="text-gray-700 mb-4">
              You can opt out of certain third-party cookies:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Google Analytics:</strong> <a href="https://tools.google.com/dlpage/gaoptout" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out</a></li>
              <li><strong>General Opt-out:</strong> Visit <a href="http://www.youronlinechoices.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Your Online Choices</a></li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Local Storage and Similar Technologies</h2>
            <p className="text-gray-700 mb-4">
              In addition to cookies, we use local storage and session storage to store information on your device. This includes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Authentication tokens</li>
              <li>User preferences and settings</li>
              <li>Scan history and results</li>
              <li>Temporary data for improved performance</li>
            </ul>
            <p className="text-gray-700">
              You can clear local storage through your browser settings, but this may require you to log in again and may result in loss of some preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Updates to This Policy</h2>
            <p className="text-gray-700">
              We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about our use of cookies, please contact us:
            </p>
            <p className="text-gray-700">
              <strong>Email:</strong> privacy@a11ytest.ai<br />
              <strong>Website:</strong> https://a11ytest.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}


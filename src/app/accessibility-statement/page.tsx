import type { Metadata } from 'next'
import Link from 'next/link'
import { Accessibility, CheckCircle, Eye, Keyboard, Settings } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Accessibility Statement - A11ytest.ai',
  description: 'Our commitment to digital accessibility and inclusive design',
}

export default function AccessibilityStatementPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Accessibility className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Accessibility Statement</h1>
            </div>
            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Commitment</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A11ytest.ai is committed to ensuring digital accessibility for people with disabilities. 
                We are continually improving the user experience for everyone and applying the relevant 
                accessibility standards to achieve these goals.
              </p>
              <p className="text-gray-700 leading-relaxed">
                This accessibility statement applies to the A11ytest.ai website and platform, located at 
                <a href="https://a11ytest.ai" className="text-blue-600 hover:text-blue-800 ml-1">https://a11ytest.ai</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Conformance Status</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and 
                  developers to improve accessibility for people with disabilities. It defines three levels 
                  of conformance: Level A, Level AA, and Level AAA.
                </p>
                <p className="text-gray-700 leading-relaxed font-semibold">
                  A11ytest.ai is partially conformant with WCAG 2.2 Level AA. Partially conformant means 
                  that some parts of the content do not fully conform to the accessibility standard.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Accessibility Features</h2>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Keyboard className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Keyboard Navigation</h3>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>All interactive elements are keyboard accessible</li>
                        <li>Visible focus indicators on all focusable elements</li>
                        <li>Logical tab order throughout the interface</li>
                        <li>Skip links for main content and navigation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Eye className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Visual Accessibility</h3>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>Sufficient color contrast ratios (WCAG AA compliant)</li>
                        <li>Text can be resized up to 200% without loss of functionality</li>
                        <li>High contrast mode support</li>
                        <li>Grayscale mode for color vision deficiencies</li>
                        <li>Alternative text for images and icons</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <Settings className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Customizable Settings</h3>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>Adjustable font size (up to 200%)</li>
                        <li>Customizable line height and letter spacing</li>
                        <li>High contrast mode toggle</li>
                        <li>Grayscale mode for monochromacy</li>
                        <li>Accessibility settings persist across sessions</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Screen Reader Support</h3>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
                        <li>Semantic HTML structure</li>
                        <li>ARIA labels and roles where appropriate</li>
                        <li>Descriptive link text</li>
                        <li>Form labels and error messages</li>
                        <li>Live regions for dynamic content updates</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Known Issues</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  We are aware of the following accessibility issues and are working to address them:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Some complex data tables may require additional ARIA labels</li>
                  <li>Certain interactive elements may need improved keyboard navigation</li>
                  <li>Some PDF previews may not be fully accessible to screen readers</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  We are committed to addressing these issues in future updates.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Feedback</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We welcome your feedback on the accessibility of A11ytest.ai. If you encounter accessibility 
                barriers, please let us know:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Email:</strong> <a href="mailto:hello@a11ytest.ai" className="text-blue-600 hover:text-blue-800">hello@a11ytest.ai</a>
                </p>
                <p className="text-gray-700 mt-2">
                  Please include:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>The URL or page where you encountered the issue</li>
                  <li>A description of the accessibility barrier</li>
                  <li>Your contact information (optional)</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Assessment Approach</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A11ytest.ai assessed the accessibility of our website using the following approaches:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Automated testing using axe-core accessibility testing engine</li>
                <li>Manual testing with keyboard-only navigation</li>
                <li>Screen reader testing with NVDA and JAWS</li>
                <li>Color contrast analysis</li>
                <li>User feedback and testing</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Content</h2>
              <p className="text-gray-700 leading-relaxed">
                Some content on our website may be provided by third parties (such as embedded content 
                or external links). We are not responsible for the accessibility of third-party content 
                and cannot guarantee its compliance with accessibility standards.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Updates to This Statement</h2>
              <p className="text-gray-700 leading-relaxed">
                We will review and update this accessibility statement regularly to reflect improvements 
                and changes to our website. The "Last updated" date at the top of this page indicates 
                when the statement was last revised.
              </p>
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






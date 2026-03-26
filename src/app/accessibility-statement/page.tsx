import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accessibility Statement - A11ytest.ai',
  description: 'Accessibility Statement for A11YTEST.AI LTD',
}

export default function AccessibilityStatementPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <article className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Accessibility Statement</h1>
          <p className="mb-8 text-sm text-gray-600">A11YTEST.AI LTD | Last updated: March 2026</p>

          <div className="space-y-6 text-gray-700">
            <section><h2 className="text-xl font-semibold text-gray-900">1. Our Commitment</h2><p>A11ytest.ai is committed to ensuring digital accessibility for people with disabilities and continuously improving user experience for everyone.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">2. Conformance Status</h2><p>A11ytest.ai is partially conformant with WCAG 2.2 Level AA.</p></section>
            <section>
              <h2 className="text-xl font-semibold text-gray-900">3. Accessibility Features</h2>
              <p className="font-medium">Keyboard Navigation</p>
              <ul className="list-disc pl-6"><li>All interactive elements keyboard accessible</li><li>Visible focus indicators</li><li>Logical tab order</li><li>Skip links</li></ul>
              <p className="mt-3 font-medium">Visual Accessibility</p>
              <ul className="list-disc pl-6"><li>Colour contrast meets WCAG 2.2 AA</li><li>Text resizable to 200%</li><li>High contrast mode support</li><li>Alt text for images/icons</li></ul>
              <p className="mt-3 font-medium">Screen Reader Support</p>
              <ul className="list-disc pl-6"><li>Semantic HTML</li><li>ARIA labels/roles</li><li>Descriptive links</li><li>Form labels and errors</li><li>Live regions</li></ul>
              <p className="mt-3 font-medium">User Preferences</p>
              <ul className="list-disc pl-6"><li>Adjustable font size</li><li>Customizable spacing</li><li>High contrast and greyscale toggles</li><li>Settings persist across sessions</li></ul>
            </section>
            <section><h2 className="text-xl font-semibold text-gray-900">4. Known Issues</h2><ul className="list-disc pl-6"><li>Some complex tables may require additional ARIA labels</li><li>Certain interactive elements may need improved keyboard handling</li><li>Some PDF previews may not be fully screen-reader accessible</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">5. Technical Specification</h2><ul className="list-disc pl-6"><li>HTML5</li><li>CSS3</li><li>JavaScript (React / Next.js)</li><li>WAI-ARIA 1.2</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">6. Assessment Approach</h2><ul className="list-disc pl-6"><li>Automated testing with axe-core</li><li>Keyboard-only testing</li><li>NVDA and JAWS testing</li><li>Contrast analysis</li><li>User feedback</li></ul></section>
            <section><h2 className="text-xl font-semibold text-gray-900">7. Feedback and Contact</h2><p>Email: hello@a11ytest.ai. Please include URL, issue description, and contact details. We aim to respond within 5 business days.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">8. Enforcement</h2><p>If not satisfied with our response, contact EASS (equalityadvisoryservice.com, 0808 800 0082). In Northern Ireland, contact equalityni.org.</p></section>
            <section><h2 className="text-xl font-semibold text-gray-900">9. Updates to This Statement</h2><p>We review and update this statement after significant platform changes.</p></section>
          </div>
        </article>
      </div>
    </div>
  )
}

export default function Head() {
  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'A11ytest.ai',
    applicationCategory: 'AccessibilityApplication',
    applicationSubCategory: 'Accessibility Testing',
    operatingSystem: 'Web',
    description:
      'A11ytest.ai is an accessibility testing platform and browser extension for a11y audits, color contrast checker workflows, and WCAG compliance.',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 126,
      bestRating: 5,
      worstRating: 1,
    },
  }

  return (
    <>
      <title>A11y Test Accessibility Testing Platform | WCAG Checker & Color Contrast Checker</title>
      <meta
        name="description"
        content="A11ytest.ai is an accessibility testing platform for websites and documents, including a11y test workflows, browser extension scans, a WCAG checker, and a color contrast checker for WCAG compliance."
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
    </>
  )
}

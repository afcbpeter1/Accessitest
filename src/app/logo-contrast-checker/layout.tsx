import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Free Logo Contrast Checker — WCAG 2.2 Color Ratio & Accessibility',
  description:
    'Free online logo contrast checker: upload a PNG, JPEG, GIF, or WebP, extract brand colours, and test WCAG 2.2 contrast ratios (AA & AAA) for logos, icons, and UI. Compare foreground and background hex colours for Section 508 and inclusive design.',
  keywords: [
    'logo contrast checker',
    'WCAG contrast ratio',
    'color contrast calculator',
    'accessibility logo',
    'brand color accessibility',
    'WCAG 2.2 AA AAA',
    'Section 508 contrast',
    'foreground background contrast',
    'hex color contrast test',
    'non-text contrast',
    'inclusive branding',
  ],
  openGraph: {
    title: 'Free Logo Contrast Checker | WCAG 2.2 & Section 508',
    description:
      'Test logo and brand colour pairs against WCAG contrast requirements. Upload an image, pick colours, see AA/AAA results instantly.',
    url: `${baseUrl}/logo-contrast-checker`,
    siteName: 'a11ytest.ai',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Logo Contrast Checker | a11ytest.ai',
    description:
      'Upload your logo, extract colours, and verify WCAG 2.2 contrast ratios for accessible branding.',
  },
  alternates: {
    canonical: `${baseUrl}/logo-contrast-checker`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Logo Contrast Checker',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
  },
  description:
    'Upload a logo image to extract dominant colours and measure WCAG 2.2 contrast ratios between foreground and background colours.',
  url: `${baseUrl}/logo-contrast-checker`,
  provider: {
    '@type': 'Organization',
    name: 'a11ytest.ai',
    url: baseUrl,
  },
}

export default function LogoContrastCheckerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}

import type { MetadataRoute } from 'next'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

// Marketing-only crawling: exclude authenticated areas (dashboard, scan results, org/settings, etc.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/home',
        '/privacy-policy',
        '/terms-of-service',
        '/cookie-policy',
        '/accessibility-statement',
        '/accessibility-issues',
        '/logo-contrast-checker',
        '/playground',
        '/a11y',
        '/wiki',
      ],
      disallow: [
        '/api',
        '/dashboard',
        '/settings',
        '/organization',
        '/new-scan',
        '/scan-history',
        '/reports',
        '/extension-scan',
        '/extension-session',
        '/document-scan',
        '/reset-password',
        '/forgot-password',
        '/login',
        '/signup',
        '/pricing',
        '/extension',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}


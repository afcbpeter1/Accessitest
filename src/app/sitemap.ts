import type { MetadataRoute } from 'next'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  // Marketing-only sitemap (no authenticated scan/report areas)
  const lastModified = new Date()

  const urls: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/home', priority: 1 },
    { path: '/pricing', priority: 0.9 },
    { path: '/privacy-policy', priority: 0.8 },
    { path: '/terms-of-service', priority: 0.8 },
    { path: '/cookie-policy', priority: 0.8 },
    { path: '/accessibility-statement', priority: 0.8 },
    { path: '/accessibility-issues', priority: 0.7 },
    { path: '/logo-contrast-checker', priority: 0.7 },
    { path: '/playground', priority: 0.7 },
    { path: '/extension', priority: 0.7 },
  ]

  return urls.map((u) => ({
    url: `${baseUrl}${u.path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: u.priority,
  }))
}


import type { MetadataRoute } from 'next'
import { queryMany } from '@/lib/database'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  const paths: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/home', priority: 1 },
    { path: '/wiki', priority: 0.72 },
    { path: '/privacy-policy', priority: 0.8 },
    { path: '/terms-of-service', priority: 0.8 },
    { path: '/cookie-policy', priority: 0.8 },
    { path: '/accessibility-statement', priority: 0.8 },
    { path: '/accessibility-issues', priority: 0.7 },
    { path: '/logo-contrast-checker', priority: 0.7 },
    { path: '/playground', priority: 0.7 },
    { path: '/extension', priority: 0.7 },
  ]

  const staticEntries: MetadataRoute.Sitemap = paths.map((u) => ({
    url: `${baseUrl}${u.path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: u.priority,
  }))

  try {
    const rows = (await queryMany('SELECT slug FROM wiki_pages ORDER BY slug ASC', [])) as { slug: string }[]
    const wikiEntries: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${baseUrl}/wiki/${encodeURIComponent(r.slug)}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.65,
    }))
    return [...staticEntries, ...wikiEntries]
  } catch {
    return staticEntries
  }
}

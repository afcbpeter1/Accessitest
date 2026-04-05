import { isValidWikiSlug, normalizeWikiSlug } from '@/lib/wiki/slug'
import { WIKI_BROWSE_CATEGORIES } from '@/lib/wiki/wiki-home-categories'

function displayLabelForSlug(slug: string, rawInput: string): string {
  const curated = WIKI_BROWSE_CATEGORIES.find((c) => c.tagSlug === slug)
  if (curated) return curated.title
  const t = rawInput.trim()
  return t.length > 120 ? `${t.slice(0, 117)}...` : t
}

/** Parse tags from API body: array of strings or comma-separated string. */
export function parseWikiTagsFromRequest(input: unknown): { slug: string; label: string }[] {
  if (input == null) return []
  let parts: string[] = []
  if (Array.isArray(input)) {
    parts = input.map((x) => String(x ?? ''))
  } else if (typeof input === 'string') {
    parts = input.split(/[,;]+/)
  } else {
    return []
  }

  const out: { slug: string; label: string }[] = []
  const seen = new Set<string>()
  for (const raw of parts) {
    const t = raw.trim()
    if (!t) continue
    const slug = normalizeWikiSlug(t)
    if (!isValidWikiSlug(slug)) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    const label = displayLabelForSlug(slug, t)
    out.push({ slug, label })
  }
  return out
}

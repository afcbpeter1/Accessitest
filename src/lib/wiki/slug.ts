const MAX_SLUG_LEN = 120

export function normalizeWikiSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s.slice(0, MAX_SLUG_LEN)
}

export function isValidWikiSlug(slug: string): boolean {
  if (!slug || slug.length > MAX_SLUG_LEN) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

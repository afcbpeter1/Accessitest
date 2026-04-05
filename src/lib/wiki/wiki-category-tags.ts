import { WIKI_BROWSE_CATEGORIES } from '@/lib/wiki/wiki-home-categories'

const CURATED_SLUGS = new Set(WIKI_BROWSE_CATEGORIES.map((c) => c.tagSlug))

/** Split stored tags into wiki-home checkboxes vs freeform “additional topics”. */
export function splitTagsForForm(rows: { slug: string; label: string }[]): {
  selectedSlugs: string[]
  extraTags: string
} {
  const selectedSlugs: string[] = []
  const extraLabels: string[] = []
  for (const t of rows) {
    if (CURATED_SLUGS.has(t.slug)) selectedSlugs.push(t.slug)
    else extraLabels.push(t.label)
  }
  return { selectedSlugs, extraTags: extraLabels.join(', ') }
}

/**
 * Combine checked categories + extra tags for the API.
 * Curated categories are sent as **canonical slugs** (e.g. `wcag-criteria`) so they always match
 * `wiki_tags.slug` — curated slugs are explicit so they match the DB (titles alone can normalize differently).
 */
export function mergeTagsForSave(selectedSlugs: string[], extraTagsString: string): string[] {
  const extras = extraTagsString
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...selectedSlugs, ...extras]
}

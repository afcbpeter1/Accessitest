import { query } from '@/lib/database'
import { normalizeWikiSlug } from '@/lib/wiki/slug'

/** Parse axe WCAG tags like wcag111 → 1.1.1, wcag2412 → 2.4.12 */
export function wcagCriterionFromTags(tags?: string[]): string | null {
  if (!tags?.length) return null
  for (const t of tags) {
    const m = t.match(/^wcag(\d)(\d)(\d+)$/i)
    if (m) {
      return `${m[1]}.${m[2]}.${m[3]}`
    }
  }
  return null
}

function titleFromViolation(description?: string, ruleId?: string): string {
  const d = description?.trim()
  if (d) return d.length > 200 ? `${d.slice(0, 197)}…` : d
  if (!ruleId) return 'Accessibility topic'
  return ruleId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Insert a stub wiki row when a scan rule appears (no revision until someone edits).
 * Safe to call repeatedly — ON CONFLICT DO NOTHING.
 */
export async function stubWikiPageFromViolation(violation: {
  id: string
  description?: string
  tags?: string[]
}): Promise<void> {
  const slug = normalizeWikiSlug(violation.id)
  if (!slug) return

  const wcag = wcagCriterionFromTags(violation.tags)
  const title = titleFromViolation(violation.description, violation.id)

  await query(
    `
    INSERT INTO wiki_pages (slug, title, wcag_criterion, is_stub, created_by)
    VALUES ($1, $2, $3, true, NULL)
    ON CONFLICT (slug) DO NOTHING
    `,
    [slug, title, wcag]
  )
}

export async function stubWikiPagesFromViolations(
  violations: Array<{ id: string; description?: string; tags?: string[] }>
): Promise<void> {
  const seen = new Set<string>()
  for (const v of violations) {
    if (!v?.id || seen.has(v.id)) continue
    seen.add(v.id)
    try {
      await stubWikiPageFromViolation(v)
    } catch {
      // DB unavailable or missing tables — do not fail the scan
    }
  }
}

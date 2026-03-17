/**
 * Standard tags for accessibility issues (from axe-core rule tags).
 * Used to tag web (axe) issues so we can filter and display by standard.
 * Includes WCAG levels, Best Practices, Section 508, EN 301 549, ACT, Trusted Tester, RGAA, Experimental.
 * See: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
 */
export const STANDARD_TAG_IDS = [
  // WCAG 2.0
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag2a-obsolete',
  // WCAG 2.1
  'wcag21a',
  'wcag21aa',
  'wcag21aaa',
  // WCAG 2.2
  'wcag22a',
  'wcag22aa',
  'wcag22aaa',
  // Other standards
  'best-practice',
  'section508',
  'EN-301-549',
  'ACT',
  'TTv5',
  'RGAAv4',
  'experimental'
] as const
export type StandardTagId = (typeof STANDARD_TAG_IDS)[number]

export const STANDARD_DISPLAY_NAMES: Record<StandardTagId, string> = {
  // WCAG 2.0
  wcag2a: 'WCAG 2.0 Level A',
  wcag2aa: 'WCAG 2.0 Level AA',
  wcag2aaa: 'WCAG 2.0 Level AAA',
  'wcag2a-obsolete': 'WCAG 2.0 Level A (obsolete)',
  // WCAG 2.1
  wcag21a: 'WCAG 2.1 Level A',
  wcag21aa: 'WCAG 2.1 Level AA',
  wcag21aaa: 'WCAG 2.1 Level AAA',
  // WCAG 2.2
  wcag22a: 'WCAG 2.2 Level A',
  wcag22aa: 'WCAG 2.2 Level AA',
  wcag22aaa: 'WCAG 2.2 Level AAA',
  // Other
  'best-practice': 'Best Practices',
  section508: 'Section 508',
  'EN-301-549': 'EN 301 549',
  ACT: 'W3C ACT',
  TTv5: 'Trusted Tester v5',
  RGAAv4: 'RGAA',
  experimental: 'Experimental'
}

/** Prefixes that map to a single standard tag for display/filter (e.g. section508.22.a -> section508) */
const STANDARD_TAG_PREFIXES: Array<{ prefix: string; tag: StandardTagId }> = [
  { prefix: 'section508', tag: 'section508' },
  { prefix: 'EN-9', tag: 'EN-301-549' },
  { prefix: 'EN-301-549', tag: 'EN-301-549' },
  { prefix: 'TT', tag: 'TTv5' },
  { prefix: 'RGAA-', tag: 'RGAAv4' }
]

/**
 * Extract standard tags from axe rule tags.
 * - Exact matches from STANDARD_TAG_IDS are included.
 * - Tags starting with section508, EN-9, EN-301-549, TT, or RGAA- are normalized to the parent standard.
 * - Returns deduplicated list for display and filtering.
 */
export function getStandardTagsFromAxeTags(tags: string[] | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return []
  const seen = new Set<string>()

  for (const tag of tags) {
    const trimmed = (tag && String(tag).trim()) || ''
    if (!trimmed) continue

    // Exact match
    if (STANDARD_TAG_IDS.includes(trimmed as StandardTagId)) {
      seen.add(trimmed)
      continue
    }

    // Prefix match for section508.*, EN-9.*, TT*.*, RGAA-*.*
    for (const { prefix, tag: standardTag } of STANDARD_TAG_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        seen.add(standardTag)
        break
      }
    }
  }

  return Array.from(seen)
}

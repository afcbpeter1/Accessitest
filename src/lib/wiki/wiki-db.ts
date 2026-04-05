import { queryMany, queryOne } from '@/lib/database'
import { normalizeWikiSlug } from '@/lib/wiki/slug'

export interface WikiPageView {
  id: string
  slug: string
  title: string
  wcag_criterion: string | null
  is_stub: boolean
  is_locked: boolean
  current_revision_id: string | null
  content: string | null
  edited_at: string | null
  editor_first_name: string | null
  editor_last_name: string | null
  editor_email: string | null
}

export interface WikiListItem {
  id: string
  slug: string
  title: string
  is_stub: boolean
  wcag_criterion: string | null
  last_edited_at: string | null
}

export interface WikiRevisionListItem {
  id: string
  edit_summary: string | null
  edited_at: string
  char_delta: number | null
  editor_first_name: string | null
  editor_last_name: string | null
  editor_email: string | null
}

export async function getWikiPageBySlug(slug: string): Promise<WikiPageView | null> {
  const normalized = normalizeWikiSlug(slug)
  if (!normalized) return null

  const row = await queryOne(
    `
    SELECT
      wp.id,
      wp.slug,
      wp.title,
      wp.wcag_criterion,
      wp.is_stub,
      wp.is_locked,
      wp.current_revision_id,
      wr.content,
      wr.edited_at,
      u.first_name AS editor_first_name,
      u.last_name AS editor_last_name,
      u.email AS editor_email
    FROM wiki_pages wp
    LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
    LEFT JOIN users u ON u.id = wr.edited_by
    WHERE wp.slug = $1
    `,
    [normalized]
  )

  return row ? (row as WikiPageView) : null
}

export async function listWikiPages(limit = 200): Promise<WikiListItem[]> {
  const rows = await queryMany(
    `
    SELECT
      wp.id,
      wp.slug,
      wp.title,
      wp.is_stub,
      wp.wcag_criterion,
      wr.edited_at AS last_edited_at
    FROM wiki_pages wp
    LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
    ORDER BY wr.edited_at DESC NULLS LAST, wp.title ASC
    LIMIT $1
    `,
    [limit]
  )
  return rows as WikiListItem[]
}

export async function listWikiRevisionsForSlug(slug: string): Promise<WikiRevisionListItem[]> {
  const normalized = normalizeWikiSlug(slug)
  if (!normalized) return []

  const rows = await queryMany(
    `
    SELECT
      wr.id,
      wr.edit_summary,
      wr.edited_at,
      wr.char_delta,
      u.first_name AS editor_first_name,
      u.last_name AS editor_last_name,
      u.email AS editor_email
    FROM wiki_revisions wr
    INNER JOIN wiki_pages wp ON wp.id = wr.page_id
    LEFT JOIN users u ON u.id = wr.edited_by
    WHERE wp.slug = $1
    ORDER BY wr.edited_at DESC
    `,
    [normalized]
  )
  return rows as WikiRevisionListItem[]
}

export async function wikiSlugExists(slug: string): Promise<boolean> {
  const normalized = normalizeWikiSlug(slug)
  if (!normalized) return false
  const row = await queryOne('SELECT 1 AS ok FROM wiki_pages WHERE slug = $1', [normalized])
  return !!row
}

export interface WikiHomeStats {
  articleCount: number
  contributorCount: number
}

export async function getWikiHomeStats(): Promise<WikiHomeStats> {
  const row = await queryOne(
    `
    SELECT
      (SELECT COUNT(*)::int FROM wiki_pages) AS article_count,
      (SELECT COUNT(DISTINCT edited_by)::int FROM wiki_revisions) AS contributor_count
    `
  )
  return {
    articleCount: row?.article_count ?? 0,
    contributorCount: row?.contributor_count ?? 0,
  }
}

export interface WikiRecentChange {
  id: string
  slug: string
  title: string
  edited_at: string
  edit_summary: string | null
  editor_first_name: string | null
  editor_last_name: string | null
  editor_email: string | null
}

export async function listRecentWikiChanges(limit = 10): Promise<WikiRecentChange[]> {
  const rows = await queryMany(
    `
    SELECT
      wr.id,
      wp.slug,
      wp.title,
      wr.edited_at,
      wr.edit_summary,
      u.first_name AS editor_first_name,
      u.last_name AS editor_last_name,
      u.email AS editor_email
    FROM wiki_revisions wr
    INNER JOIN wiki_pages wp ON wp.id = wr.page_id
    LEFT JOIN users u ON u.id = wr.edited_by
    ORDER BY wr.edited_at DESC
    LIMIT $1
    `,
    [limit]
  )
  return rows as WikiRecentChange[]
}

export interface WikiTagRow {
  slug: string
  label: string
}

export interface WikiTagWithCount extends WikiTagRow {
  count: number
}

/** Tags on a page (by article slug). Empty if tag tables are missing. */
export async function getWikiTagsForPageSlug(slug: string): Promise<WikiTagRow[]> {
  const normalized = normalizeWikiSlug(slug)
  if (!normalized) return []
  try {
    const rows = await queryMany(
      `
      SELECT wt.slug, wt.label
      FROM wiki_tags wt
      INNER JOIN wiki_page_tags wpt ON wpt.tag_id = wt.id
      INNER JOIN wiki_pages wp ON wp.id = wpt.page_id
      WHERE wp.slug = $1
      ORDER BY wt.label ASC
      `,
      [normalized]
    )
    return rows as WikiTagRow[]
  } catch {
    return []
  }
}

export async function listWikiTagsWithCounts(limit = 24): Promise<WikiTagWithCount[]> {
  try {
    const rows = await queryMany(
      `
      SELECT wt.slug, wt.label, COUNT(wpt.page_id)::int AS count
      FROM wiki_tags wt
      LEFT JOIN wiki_page_tags wpt ON wpt.tag_id = wt.id
      GROUP BY wt.id, wt.slug, wt.label
      ORDER BY COUNT(wpt.page_id) DESC, wt.label ASC
      LIMIT $1
      `,
      [limit]
    )
    return rows as WikiTagWithCount[]
  } catch {
    return []
  }
}

export async function listWikiPagesByTagSlug(tagSlug: string, limit = 200): Promise<WikiListItem[]> {
  const normalized = normalizeWikiSlug(tagSlug)
  if (!normalized) return []
  try {
    const rows = await queryMany(
      `
      SELECT
        wp.id,
        wp.slug,
        wp.title,
        wp.is_stub,
        wp.wcag_criterion,
        wr.edited_at AS last_edited_at
      FROM wiki_pages wp
      INNER JOIN wiki_page_tags wpt ON wpt.page_id = wp.id
      INNER JOIN wiki_tags wt ON wt.id = wpt.tag_id AND wt.slug = $1
      LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
      ORDER BY wp.title ASC
      LIMIT $2
      `,
      [normalized, limit]
    )
    return rows as WikiListItem[]
  } catch {
    return []
  }
}

export async function listWikiStubPages(limit = 100): Promise<WikiListItem[]> {
  try {
    const rows = await queryMany(
      `
      SELECT
        wp.id,
        wp.slug,
        wp.title,
        wp.is_stub,
        wp.wcag_criterion,
        wr.edited_at AS last_edited_at
      FROM wiki_pages wp
      LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
      WHERE wp.is_stub = true
      ORDER BY wp.title ASC
      LIMIT $1
      `,
      [limit]
    )
    return rows as WikiListItem[]
  } catch {
    return []
  }
}

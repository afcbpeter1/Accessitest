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
      u.last_name AS editor_last_name
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

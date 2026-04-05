import pool from '@/lib/database'
import { sanitizeWikiHtml } from '@/lib/wiki/sanitize'
import { normalizeWikiSlug, isValidWikiSlug } from '@/lib/wiki/slug'

export class WikiSaveError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_SLUG' | 'PAGE_LOCKED' | 'VALIDATION'
  ) {
    super(message)
    this.name = 'WikiSaveError'
  }
}

export async function savePage(input: {
  slug: string
  title: string
  content: string
  editSummary: string
  userId: string
  wcagCriterion?: string | null
}) {
  const slug = normalizeWikiSlug(input.slug)
  if (!isValidWikiSlug(slug)) {
    throw new WikiSaveError('Use lowercase letters, numbers, and hyphens only.', 'INVALID_SLUG')
  }

  const title = input.title?.trim()
  if (!title) {
    throw new WikiSaveError('Title is required.', 'VALIDATION')
  }

  const content = sanitizeWikiHtml(input.content || '')
  const editSummary = (input.editSummary || '').trim() || 'No summary provided'
  const wcag =
    input.wcagCriterion && String(input.wcagCriterion).trim()
      ? String(input.wcagCriterion).trim()
      : null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string; is_locked: boolean }>(
      `SELECT id, is_locked FROM wiki_pages WHERE slug = $1`,
      [slug]
    )

    let pageId: string

    if (existing.rows.length === 0) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO wiki_pages (slug, title, wcag_criterion, created_by, is_stub, is_locked)
         VALUES ($1, $2, $3, $4, false, false)
         RETURNING id`,
        [slug, title, wcag, input.userId]
      )
      pageId = ins.rows[0].id
    } else {
      pageId = existing.rows[0].id
      if (existing.rows[0].is_locked) {
        throw new WikiSaveError('This page is locked from editing.', 'PAGE_LOCKED')
      }
      await client.query(
        `UPDATE wiki_pages
         SET title = $1,
             wcag_criterion = COALESCE($2, wcag_criterion),
             is_stub = false
         WHERE id = $3`,
        [title, wcag, pageId]
      )
    }

    const prev = await client.query<{ len: number }>(
      `
      SELECT COALESCE(LENGTH(wr.content), 0) AS len
      FROM wiki_pages wp
      LEFT JOIN wiki_revisions wr ON wr.id = wp.current_revision_id
      WHERE wp.id = $1
      `,
      [pageId]
    )
    const prevLen = prev.rows[0]?.len ?? 0
    const charDelta = content.length - prevLen

    const rev = await client.query<{ id: string }>(
      `INSERT INTO wiki_revisions (page_id, content, edit_summary, edited_by, char_delta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [pageId, content, editSummary, input.userId, charDelta]
    )

    await client.query(`UPDATE wiki_pages SET current_revision_id = $1 WHERE id = $2`, [
      rev.rows[0].id,
      pageId,
    ])

    await client.query('COMMIT')
    return { pageId, revisionId: rev.rows[0].id, slug }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

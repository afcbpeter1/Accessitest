import type { PoolClient } from 'pg'
import pool from '@/lib/database'
import { renderWikiMarkdown } from '@/lib/wiki/markdown'
import { repairWikiHtmlForDisplay } from '@/lib/wiki/repair-wiki-html'
import { sanitizeWikiHtml } from '@/lib/wiki/sanitize'
import { normalizeWikiSlug, isValidWikiSlug } from '@/lib/wiki/slug'
import { parseWikiTagsFromRequest } from '@/lib/wiki/tag-parse'

export class WikiSaveError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_SLUG' | 'PAGE_LOCKED' | 'VALIDATION' | 'DATABASE_UNAVAILABLE'
  ) {
    super(message)
    this.name = 'WikiSaveError'
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mapDatabaseError(e: unknown): Error {
  if (e instanceof WikiSaveError) return e
  const err = e as { code?: string; message?: string }
  const code = err.code
  if (code === '42P01') {
    return new WikiSaveError(
      'Wiki tables are not installed. Run database/wiki-schema.sql on your Postgres database.',
      'DATABASE_UNAVAILABLE'
    )
  }
  if (code === '23503') {
    return new WikiSaveError(
      'Your account could not be linked to this edit. Sign out and sign in again.',
      'VALIDATION'
    )
  }
  if (code === '23505') {
    return new WikiSaveError(
      'This slug already exists or was created in another tab. Refresh and try again.',
      'VALIDATION'
    )
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return new WikiSaveError(
      'Cannot reach the database. Check DATABASE_URL and that Postgres is running.',
      'DATABASE_UNAVAILABLE'
    )
  }
  return e instanceof Error ? e : new Error(String(e))
}

async function safeRollback(client: PoolClient) {
  try {
    await client.query('ROLLBACK')
  } catch {
    /* no active transaction */
  }
}

async function syncWikiPageTags(
  client: PoolClient,
  pageId: string,
  tags: { slug: string; label: string }[]
) {
  try {
    await client.query(`DELETE FROM wiki_page_tags WHERE page_id = $1`, [pageId])
    for (const { slug, label } of tags) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO wiki_tags (slug, label) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label
         RETURNING id`,
        [slug, label]
      )
      const tagId = r.rows[0].id
      await client.query(
        `INSERT INTO wiki_page_tags (page_id, tag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [pageId, tagId]
      )
    }
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === '42P01') {
      if (tags.length > 0) {
        throw new WikiSaveError(
          'Wiki tag tables are missing. Run database/wiki-tags-migration.sql on your Postgres database, then save again.',
          'DATABASE_UNAVAILABLE'
        )
      }
      return
    }
    throw e
  }
}

export async function savePage(input: {
  slug: string
  title: string
  content: string
  /** When `markdown`, `content` is parsed as Markdown (## headings, lists, etc.) then sanitized. */
  contentFormat?: 'html' | 'markdown'
  editSummary: string
  userId: string
  wcagCriterion?: string | null
  /** Tag labels or slugs; comma-separated or string[] from the API. */
  tags?: unknown
}) {
  const slug = normalizeWikiSlug(input.slug)
  if (!isValidWikiSlug(slug)) {
    throw new WikiSaveError('Use lowercase letters, numbers, and hyphens only.', 'INVALID_SLUG')
  }

  const title = input.title?.trim()
  if (!title) {
    throw new WikiSaveError('Title is required.', 'VALIDATION')
  }

  const editSummary = (input.editSummary || '').trim() || 'No summary provided'
  const wcag =
    input.wcagCriterion && String(input.wcagCriterion).trim()
      ? String(input.wcagCriterion).trim()
      : null

  if (!UUID_RE.test(String(input.userId || ''))) {
    throw new WikiSaveError('Invalid session. Sign out and sign in again.', 'VALIDATION')
  }

  const raw = String(input.content ?? '')
  const asMarkdown = input.contentFormat === 'markdown'
  let htmlBeforeSanitize: string
  try {
    htmlBeforeSanitize = asMarkdown ? renderWikiMarkdown(raw) : raw
  } catch (e) {
    console.error('[savePage] Markdown render failed', e)
    throw new WikiSaveError('Could not parse Markdown. Check headings and lists for broken syntax.', 'VALIDATION')
  }

  const content = sanitizeWikiHtml(repairWikiHtmlForDisplay(htmlBeforeSanitize))

  let client: PoolClient | undefined
  try {
    client = await pool.connect()
  } catch (e) {
    throw mapDatabaseError(e)
  }

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

    const tagPairs = parseWikiTagsFromRequest(input.tags)
    await syncWikiPageTags(client, pageId, tagPairs)

    await client.query('COMMIT')
    return { pageId, revisionId: rev.rows[0].id, slug }
  } catch (e) {
    if (client) await safeRollback(client)
    throw mapDatabaseError(e)
  } finally {
    client?.release()
  }
}

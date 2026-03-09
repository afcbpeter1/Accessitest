import crypto from 'crypto'
import { query, queryOne } from '@/lib/database'

const MAX_SNIPPET_LENGTH = 200

/**
 * Normalize HTML for pattern hashing: strip extra whitespace, take first N chars of tag+attributes.
 * No raw HTML is stored in the log; this is only for consistent hashing.
 */
export function normalizeHtmlSnippet(html: string): string {
  if (!html || typeof html !== 'string') return ''
  const trimmed = html.replace(/\s+/g, ' ').trim()
  return trimmed.substring(0, MAX_SNIPPET_LENGTH)
}

/**
 * Compute pattern_hash for logging and lookup (rule_id + normalized snippet).
 */
export function computePatternHash(ruleId: string, html: string): string {
  const snippet = normalizeHtmlSnippet(html)
  return crypto.createHash('sha256').update(ruleId + '\n' + snippet).digest('hex')
}

/**
 * Compute suggestion_signature for logging (hash of description + codeExample).
 */
export function computeSuggestionSignature(description: string, codeExample?: string | null): string {
  const str = (description || '') + '\n' + (codeExample || '')
  return crypto.createHash('sha256').update(str).digest('hex')
}

export interface LearnedSuggestion {
  description: string
  codeExample: string | null
}

/**
 * Get learned suggestion for a rule (and optional pattern).
 * Returns the best match: pattern-specific first, then rule-only (pattern_hash IS NULL).
 */
export async function getLearnedSuggestion(
  ruleId: string,
  patternHash: string | null
): Promise<LearnedSuggestion | null> {
  if (!ruleId) return null
  try {
    // Prefer pattern-specific row; fallback to rule-level (pattern_hash IS NULL).
    const row = await queryOne(
      `SELECT description, code_example
       FROM learned_suggestions
       WHERE rule_id = $1
         AND (pattern_hash = $2 OR pattern_hash IS NULL)
       ORDER BY CASE WHEN pattern_hash IS NOT NULL THEN 0 ELSE 1 END
       LIMIT 1`,
      [ruleId, patternHash ?? null]
    )
    if (!row) return null
    return {
      description: row.description ?? '',
      codeExample: row.code_example ?? null
    }
  } catch (e) {
    console.warn('learned-suggestions getLearnedSuggestion error:', e)
    return null
  }
}

/**
 * Insert one anonymized log row (fire-and-forget; do not throw).
 */
export async function logPipelineSuggestion(
  ruleId: string,
  patternHash: string,
  suggestionSignature: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO pipeline_suggestion_log (rule_id, pattern_hash, suggestion_signature, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [ruleId, patternHash, suggestionSignature]
    )
  } catch (e) {
    console.warn('learned-suggestions logPipelineSuggestion error:', e)
  }
}

/**
 * Get top rule_ids by count from the log (for the learning job).
 */
export async function getTopRulesFromLog(limit: number = 20): Promise<Array<{ rule_id: string; count: number }>> {
  const rows = await query(
    `SELECT rule_id, COUNT(*)::int AS count
     FROM pipeline_suggestion_log
     GROUP BY rule_id
     ORDER BY count DESC
     LIMIT $1`,
    [limit]
  )
  return (rows.rows || []).map((r: any) => ({ rule_id: r.rule_id, count: r.count }))
}

/**
 * Upsert a learned suggestion (used by the learning job).
 */
export async function upsertLearnedSuggestion(
  ruleId: string,
  patternHash: string | null,
  description: string,
  codeExample: string | null
): Promise<void> {
  await query(
    `INSERT INTO learned_suggestions (rule_id, pattern_hash, description, code_example, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (rule_id, pattern_hash)
     DO UPDATE SET description = EXCLUDED.description, code_example = EXCLUDED.code_example, updated_at = NOW()`,
    [ruleId, patternHash ?? null, description, codeExample ?? null]
  )
}

/**
 * Delete old rows from pipeline_suggestion_log so the table doesn't grow forever.
 * Call this from the learning job (e.g. after learning). Retention in days (default 90).
 */
export async function prunePipelineSuggestionLog(retentionDays: number = 90): Promise<number> {
  const days = Math.max(1, retentionDays)
  const result = await query(
    `DELETE FROM pipeline_suggestion_log WHERE created_at < NOW() - (INTERVAL '1 day' * $1)`,
    [days]
  )
  return result.rowCount ?? 0
}

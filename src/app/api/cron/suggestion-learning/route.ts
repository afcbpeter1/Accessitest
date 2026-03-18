import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getTopRulesFromLog, upsertLearnedSuggestion, prunePipelineSuggestionLog } from '@/lib/learned-suggestions-service'
import { ClaudeAPI } from '@/lib/claude-api'

const UNAVAILABLE = () => NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

/**
 * Pipeline suggestion learning job.
 * Operational/background only. Trigger: POST with Authorization: Bearer <CRON_SECRET>
 * (e.g. .github/workflows/suggestion-learning-daily.yml). GET always returns 503.
 */
const CRON_SECRET = process.env.CRON_SECRET ?? process.env.SUGGESTION_LEARNING_JOB_SECRET
const MAX_RULES_PER_RUN = parseInt(process.env.SUGGESTION_LEARNING_MAX_RULES ?? '20', 10) || 20
const LOG_RETENTION_DAYS = parseInt(process.env.SUGGESTION_LEARNING_LOG_RETENTION_DAYS ?? '90', 10) || 90

export async function GET() {
  return UNAVAILABLE()
}

export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction && !CRON_SECRET) return UNAVAILABLE()
  if (!CRON_SECRET) return runJob(request)
  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (bearer !== CRON_SECRET) return UNAVAILABLE()
  return runJob(request)
}

async function runJob(request: NextRequest) {

  try {
    // Pull a larger candidate set from the log, then filter to rules that either:
    // - have no learned suggestion yet (pattern_hash IS NULL), or
    // - have a learned code_example that looks invalid/no-op.
    // This ensures new rule_ids get learned even if they are not "top ranked".
    const logCandidateLimit = Math.max(MAX_RULES_PER_RUN * 5, 25)
    const candidateRules = await getTopRulesFromLog(logCandidateLimit)
    if (candidateRules.length === 0) {
      return NextResponse.json({ ok: true, message: 'No pipeline log data yet', updated: 0 })
    }

    const claude = new ClaudeAPI()
    let updated = 0

    const ruleIds = candidateRules.map((r) => r.rule_id)
    const learnedRows = await query(
      `SELECT rule_id, description, code_example
       FROM learned_suggestions
       WHERE pattern_hash IS NULL
         AND rule_id = ANY($1)`,
      [ruleIds]
    )
    const learnedByRule = new Map<string, { description: string; code_example: string | null }>()
    for (const row of learnedRows.rows || []) {
      learnedByRule.set(row.rule_id, { description: row.description ?? '', code_example: row.code_example ?? null })
    }

    const isInvalidLearnedCodeExample = (ruleId: string, codeExample: string | null | undefined): boolean => {
      if (!codeExample) return true
      const c = String(codeExample).trim()
      if (c.length === 0) return true

      // Target the known no-op case: empty table headers.
      if (ruleId === 'empty-table-header') {
        return /^<th[^>]*>\s*<\/th>$/i.test(c) || /<th[^>]*>\s*<\/th>/i.test(c)
      }

      // Generic heuristic: extremely short snippets are often placeholders.
      if (c.length < 12) return true

      return false
    }

    const rulesToLearn: string[] = []
    for (const { rule_id: ruleId } of candidateRules) {
      const learned = learnedByRule.get(ruleId)
      const hasLearned = Boolean(learned)
      const codeExample = learned?.code_example ?? null

      if (!hasLearned || isInvalidLearnedCodeExample(ruleId, codeExample)) {
        rulesToLearn.push(ruleId)
      }

      if (rulesToLearn.length >= MAX_RULES_PER_RUN) break
    }

    if (rulesToLearn.length === 0) {
      return NextResponse.json({ ok: true, message: 'No learned suggestions needed update', updated: 0 })
    }

    for (const ruleId of rulesToLearn) {
      // Use learned data (if any) to help Claude improve it.
      const existing = learnedByRule.get(ruleId)
      const currentDescription = existing?.description ?? ''
      const currentCodeExample = existing?.code_example ?? null

      const { description, codeExample } = await claude.generateImprovedSuggestionForRule(
        ruleId,
        currentDescription,
        currentCodeExample
      )
      await upsertLearnedSuggestion(ruleId, null, description, codeExample)
      updated++
    }

    const deleted = await prunePipelineSuggestionLog(LOG_RETENTION_DAYS)

    return NextResponse.json({ ok: true, updated, rulesProcessed: rulesToLearn.length, logRowsDeleted: deleted })
  } catch (err) {
    console.error('suggestion-learning job error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

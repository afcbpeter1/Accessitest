import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/database'
import { getTopRulesFromLog, upsertLearnedSuggestion, prunePipelineSuggestionLog } from '@/lib/learned-suggestions-service'
import { ClaudeAPI } from '@/lib/claude-api'

/**
 * Pipeline suggestion learning job.
 * Operational/background only: no user context; AI usage is not counted against any
 * per-user suggestion allowance. Billed to your Anthropic account as a flat cost.
 * Trigger: daily via GitHub Actions (.github/workflows/suggestion-learning-daily.yml), or any cron that
 * calls GET/POST with Authorization: Bearer <CRON_SECRET>.
 */
const CRON_SECRET = process.env.CRON_SECRET ?? process.env.SUGGESTION_LEARNING_JOB_SECRET
const MAX_RULES_PER_RUN = parseInt(process.env.SUGGESTION_LEARNING_MAX_RULES ?? '20', 10) || 20
const LOG_RETENTION_DAYS = parseInt(process.env.SUGGESTION_LEARNING_LOG_RETENTION_DAYS ?? '90', 10) || 90

export async function GET(request: NextRequest) {
  return runJob(request)
}

export async function POST(request: NextRequest) {
  return runJob(request)
}

async function runJob(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction && !CRON_SECRET) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 })
  }
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization')
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (bearer !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const topRules = await getTopRulesFromLog(MAX_RULES_PER_RUN)
    if (topRules.length === 0) {
      return NextResponse.json({ ok: true, message: 'No pipeline log data yet', updated: 0 })
    }

    const claude = new ClaudeAPI()
    let updated = 0

    for (const { rule_id } of topRules) {
      const existing = await queryOne(
        `SELECT description, code_example FROM learned_suggestions WHERE rule_id = $1 AND pattern_hash IS NULL LIMIT 1`,
        [rule_id]
      )
      const currentDescription = existing?.description ?? ''
      const currentCodeExample = existing?.code_example ?? null

      const { description, codeExample } = await claude.generateImprovedSuggestionForRule(
        rule_id,
        currentDescription,
        currentCodeExample
      )
      await upsertLearnedSuggestion(rule_id, null, description, codeExample)
      updated++
    }

    const deleted = await prunePipelineSuggestionLog(LOG_RETENTION_DAYS)

    return NextResponse.json({ ok: true, updated, rulesProcessed: topRules.length, logRowsDeleted: deleted })
  } catch (err) {
    console.error('suggestion-learning job error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

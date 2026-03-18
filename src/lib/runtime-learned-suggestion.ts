import { ClaudeAPI } from './claude-api'
import { queryOne } from './database'
import { upsertLearnedSuggestion } from './learned-suggestions-service'

type LearnedSuggestionResult = { description: string; codeExample: string | null }

export function isNoOpOrInvalidCodeExample(ruleId: string, codeExample: string | null | undefined): boolean {
  if (!codeExample) return true
  const c = String(codeExample).trim()
  if (c.length === 0) return true

  // Generic: extremely short snippets are usually placeholders.
  if (c.length < 10) return true

  // Specific: empty table headers should include discernible text.
  // Examples of bad/no-op: <th scope="col"></th> or <th></th>
  if (ruleId === 'empty-table-header') {
    // Match empty inner content (only whitespace/newlines) inside the first <th>..</th>
    const match = c.match(/<th[^>]*>\s*([\s\S]*?)\s*<\/th>/i)
    if (!match) return false
    return (match[1] || '').trim().length === 0
  }

  return false
}

export async function ensureRuleLevelLearnedSuggestionAtScanTime(params: {
  claude: ClaudeAPI
  ruleId: string
  currentDescription: string
  currentCodeExample: string | null | undefined
}): Promise<LearnedSuggestionResult | null> {
  const { claude, ruleId, currentDescription, currentCodeExample } = params

  // 1) Re-check DB: if a valid rule-level learned suggestion already exists, reuse it.
  const existing = await queryOne(
    `SELECT description, code_example
     FROM learned_suggestions
     WHERE rule_id = $1
       AND pattern_hash IS NULL
     LIMIT 1`,
    [ruleId]
  )

  const existingCode = (existing as any)?.code_example as string | null | undefined
  if (existing && !isNoOpOrInvalidCodeExample(ruleId, existingCode)) {
    return {
      description: ((existing as any)?.description as string) ?? '',
      codeExample: existingCode ?? null
    }
  }

  // 2) Otherwise, ask Claude to improve the existing rule-based suggestion (fast + constrained).
  const improved = await claude.generateImprovedSuggestionForRule(
    ruleId,
    currentDescription,
    currentCodeExample ?? null
  )

  if (!improved.codeExample || isNoOpOrInvalidCodeExample(ruleId, improved.codeExample)) {
    return null
  }

  // 3) Save for future scans.
  await upsertLearnedSuggestion(ruleId, null, improved.description, improved.codeExample)

  return { description: improved.description, codeExample: improved.codeExample }
}


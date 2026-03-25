import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = String(body?.question || '').trim()

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question is required.' },
        { status: 400 }
      )
    }

    // Keep prompts bounded so you don't accidentally burn tokens.
    if (question.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Question is too long.' },
        { status: 400 }
      )
    }

    const claudeAPI = new ClaudeAPI()

    const systemPrompt = `You are an expert web accessibility consultant.

Answer the user's accessibility question with practical, developer-ready guidance.

RESPONSE RULES:
- Keep total response under 220 words.
- If code would help, include at most 1-2 short code blocks using markdown fences:
  - \`\`\`html for HTML/JSX/markup
  - \`\`\`css for CSS-only fixes
  - \`\`\`js for JS-only fixes (not full apps)
- Provide a brief explanation first, then the code blocks (if any), then one short "Why this helps" sentence.

If the question mentions WCAG, ARIA, or keyboard behavior, include the relevant criterion/pattern number(s) and a short summary.`

    const userPrompt = `User question: ${question}`

    const answer = await claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt)

    return NextResponse.json({ success: true, answer })
  } catch (error) {
    console.error('❌ /api/a11y-ask error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


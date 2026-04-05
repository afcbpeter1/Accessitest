import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { savePage, WikiSaveError } from '@/lib/wiki/savePage'

type RouteParams = { params: Promise<{ slug: string }> | { slug: string } }

export async function POST(request: NextRequest, ctx: RouteParams) {
  const params = await Promise.resolve(ctx.params)
  const slug = params.slug

  let user
  try {
    user = await getAuthenticatedUser(request)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('verification')) {
      return NextResponse.json(
        { success: false, error: 'Email verification required', requiresVerification: true },
        { status: 403 }
      )
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, content, contentFormat, editSummary, wcagCriterion, tags } = body as {
      title?: string
      content?: string
      contentFormat?: 'html' | 'markdown'
      editSummary?: string
      wcagCriterion?: string | null
      tags?: unknown
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
    }

    const fmt = contentFormat === 'markdown' ? 'markdown' : 'html'

    const result = await savePage({
      slug,
      title: title || '',
      content,
      contentFormat: fmt,
      editSummary: editSummary || '',
      userId: user.userId,
      wcagCriterion: wcagCriterion ?? null,
      tags,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (e: unknown) {
    if (e instanceof WikiSaveError) {
      const status =
        e.code === 'PAGE_LOCKED' ? 403 : e.code === 'DATABASE_UNAVAILABLE' ? 503 : 400
      return NextResponse.json({ success: false, error: e.message, code: e.code }, { status })
    }
    console.error('Wiki save error:', e)
    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === 'development' && e instanceof Error
            ? e.message
            : 'Failed to save page',
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { savePage, WikiSaveError } from '@/lib/wiki/savePage'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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
    const { title, content, editSummary, wcagCriterion } = body as {
      title?: string
      content?: string
      editSummary?: string
      wcagCriterion?: string | null
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
    }

    const result = await savePage({
      slug: params.slug,
      title: title || '',
      content,
      editSummary: editSummary || '',
      userId: user.userId,
      wcagCriterion: wcagCriterion ?? null,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (e: unknown) {
    if (e instanceof WikiSaveError) {
      const status = e.code === 'PAGE_LOCKED' ? 403 : 400
      return NextResponse.json({ success: false, error: e.message, code: e.code }, { status })
    }
    console.error('Wiki save error:', e)
    return NextResponse.json({ success: false, error: 'Failed to save page' }, { status: 500 })
  }
}

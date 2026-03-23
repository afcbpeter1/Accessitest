import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getUserCredits } from '@/lib/credit-service'
import { queryOne } from '@/lib/database'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function toBase64(uint8: Uint8Array): string {
  return Buffer.from(uint8).toString('base64')
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const headers: Record<string, string> = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ success: false, error: 'Missing text' }, { status: 400, headers })
    }
    if (text.length > 240) {
      return NextResponse.json({ success: false, error: 'Text too long' }, { status: 400, headers })
    }

    const creditInfo = await getUserCredits(user.userId)
    const userInfo = await queryOne('SELECT plan_type FROM users WHERE id = $1', [user.userId])
    const planType = String(userInfo?.plan_type || '').toLowerCase()
    const hasSubscription = creditInfo.unlimited_credits || (planType !== '' && planType !== 'free')
    if (!hasSubscription) {
      return NextResponse.json({ success: false, error: 'Subscription required' }, { status: 403, headers })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID
    if (!apiKey || !voiceId) {
      return NextResponse.json({ success: false, error: 'TTS is not configured' }, { status: 503, headers })
    }

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8
        }
      })
    })

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => '')
      return NextResponse.json(
        { success: false, error: `ElevenLabs failed (${elevenRes.status})`, details: errText.slice(0, 300) },
        { status: 502, headers }
      )
    }

    const audioBuffer = new Uint8Array(await elevenRes.arrayBuffer())
    return NextResponse.json(
      { success: true, audioBase64: toBase64(audioBuffer), mimeType: 'audio/mpeg' },
      { status: 200, headers }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401, headers })
    }
    console.error('Extension reader TTS API error:', error)
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500, headers })
  }
}

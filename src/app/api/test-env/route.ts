import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    claudeUrl: process.env.CLAUDE_API_URL || 'NOT_SET',
    claudeKey: process.env.CLAUDE_API_KEY ? '***' + process.env.CLAUDE_API_KEY.slice(-4) : 'NOT_SET',
    claudeHost: process.env.CLAUDE_API_HOST || 'NOT_SET',
    nodeEnv: process.env.NODE_ENV
  })
}


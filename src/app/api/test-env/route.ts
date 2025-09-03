import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? '***' + process.env.ANTHROPIC_API_KEY.slice(-4) : 'NOT_SET',
    nodeEnv: process.env.NODE_ENV,
    apiProvider: 'Anthropic Official API'
  })
}



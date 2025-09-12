import { NextResponse } from 'next/server'

export async function GET() {
  // Get all environment variables for debugging
  const allEnvVars = Object.keys(process.env)
    .filter(key => key.includes('ANTHROPIC') || key.includes('CLAUDE') || key.includes('API'))
    .reduce((acc, key) => {
      acc[key] = process.env[key] ? '***' + process.env[key]!.slice(-4) : 'NOT_SET'
      return acc
    }, {} as Record<string, string>)

  return NextResponse.json({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? '***' + process.env.ANTHROPIC_API_KEY.slice(-4) : 'NOT_SET',
    nodeEnv: process.env.NODE_ENV,
    apiProvider: 'Anthropic Official API',
    allRelevantEnvVars: allEnvVars,
    totalEnvVars: Object.keys(process.env).length,
    cwd: process.cwd(), // Current working directory
    envFiles: [
      '.env',
      '.env.local', 
      '.env.development',
      '.env.production'
    ]
  })
}












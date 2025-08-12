import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'

export async function POST(request: NextRequest) {
  try {
    const { html, issueType, failureSummary, cssSelector } = await request.json()

    const claudeAPI = new ClaudeAPI()
    
    console.log('🧪 Testing Claude API with:', { issueType, html: html.substring(0, 50) + '...' })
    
    const suggestion = await claudeAPI.generateAccessibilitySuggestion(
      html,
      issueType,
      failureSummary,
      cssSelector
    )

    return NextResponse.json({ 
      success: true, 
      suggestion,
      length: suggestion.length
    })

  } catch (error) {
    console.error('❌ Claude API test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    )
  }
}


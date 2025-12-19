import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'
import { mapIssueToJiraSimple } from '@/lib/jira-mapping-service'

/**
 * POST /api/jira/tickets
 * Create Jira ticket from issue (with duplication prevention)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { issueId } = body

    if (!issueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'issueId is required'
        },
        { status: 400 }
      )
    }

    // Check if issue already has a Jira ticket (duplication prevention)
    const existingMapping = await queryOne(
      `SELECT jtm.*, i.jira_ticket_key 
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueId]
    )

    if (existingMapping) {
      // Return existing ticket info instead of creating duplicate
      return NextResponse.json({
        success: true,
        ticket: {
          key: existingMapping.jira_ticket_key,
          id: existingMapping.jira_ticket_id,
          url: existingMapping.jira_url
        },
        existing: true,
        message: 'Issue already has a Jira ticket'
      })
    }

    // Get user's Jira integration
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token, project_key, issue_type
      FROM jira_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Jira integration not configured. Please set up Jira in settings first.'
        },
        { status: 404 }
      )
    }

    // Get issue details
    const issue = await queryOne(
      `SELECT 
        id, issue_key, rule_id, rule_name, description, impact, wcag_level,
        priority, total_occurrences, affected_pages, help_url, help_text, notes
      FROM issues 
      WHERE id = $1`,
      [issueId]
    )

    if (!issue) {
      return NextResponse.json(
        {
          success: false,
          error: 'Issue not found'
        },
        { status: 404 }
      )
    }

    // Create Jira client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Map issue to Jira format
    const jiraIssue = mapIssueToJiraSimple(
      {
        id: issue.id,
        rule_name: issue.rule_name,
        description: issue.description,
        impact: issue.impact,
        priority: issue.priority,
        wcag_level: issue.wcag_level,
        total_occurrences: issue.total_occurrences,
        affected_pages: issue.affected_pages || [],
        help_url: issue.help_url,
        help_text: issue.help_text,
        notes: issue.notes,
        issue_key: issue.issue_key
      },
      integration.project_key,
      integration.issue_type
    )

    // Create ticket in Jira
    let createdTicket
    try {
      console.log('📝 About to create Jira ticket for issue:', issueId)
      console.log('📝 Mapped Jira issue data:', JSON.stringify(jiraIssue, null, 2))
      createdTicket = await client.createIssue(jiraIssue)
      console.log('✅ Jira ticket created successfully:', createdTicket)
    } catch (error) {
      console.error('❌ Error creating Jira ticket:', error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        issueId,
        projectKey: integration.project_key,
        issueType: integration.issue_type
      })
      
      // Update issue with error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Jira ticket'
      await query(
        `UPDATE issues SET jira_sync_error = $1 WHERE id = $2`,
        [errorMessage, issueId]
      )

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
        { status: 400 } // Return 400 if it's a validation error from Jira
      )
    }

    // Build ticket URL
    const ticketUrl = client.getTicketUrl(createdTicket.key)

    // Store mapping in database
    await query(
      `INSERT INTO jira_ticket_mappings 
      (issue_id, jira_ticket_key, jira_ticket_id, jira_url)
      VALUES ($1, $2, $3, $4)`,
      [issueId, createdTicket.key, createdTicket.id, ticketUrl]
    )

    // Update issue flags
    await query(
      `UPDATE issues 
      SET jira_synced = true, jira_ticket_key = $1, jira_sync_error = NULL 
      WHERE id = $2`,
      [createdTicket.key, issueId]
    )

    return NextResponse.json({
      success: true,
      ticket: {
        key: createdTicket.key,
        id: createdTicket.id,
        url: ticketUrl
      },
      existing: false
    })
  } catch (error) {
    console.error('Error creating Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Jira ticket'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jira/tickets/check/:issueId
 * Check if issue already has a Jira ticket
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')

    if (!issueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'issueId query parameter is required'
        },
        { status: 400 }
      )
    }

    // Check if issue has a Jira ticket
    const mapping = await queryOne(
      `SELECT jtm.jira_ticket_key, jtm.jira_url, i.jira_synced
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueId]
    )

    if (mapping) {
      return NextResponse.json({
        success: true,
        hasTicket: true,
        ticketKey: mapping.jira_ticket_key,
        ticketUrl: mapping.jira_url
      })
    }

    return NextResponse.json({
      success: true,
      hasTicket: false
    })
  } catch (error) {
    console.error('Error checking Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Jira ticket'
      },
      { status: 500 }
    )
  }
}


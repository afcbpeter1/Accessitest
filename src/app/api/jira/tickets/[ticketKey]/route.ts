import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'

/**
 * GET /api/jira/tickets/:ticketKey
 * Get Jira ticket details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ticketKey: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const { ticketKey } = params

    if (!ticketKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'ticketKey is required'
        },
        { status: 400 }
      )
    }

    // Get user's Jira integration
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token
      FROM jira_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Jira integration not configured'
        },
        { status: 404 }
      )
    }

    // Create client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Fetch ticket
    const ticket = await client.getIssue(ticketKey)

    return NextResponse.json({
      success: true,
      ticket: {
        key: ticket.key,
        id: ticket.id,
        url: client.getTicketUrl(ticket.key),
        summary: ticket.fields.summary,
        description: ticket.fields.description,
        status: ticket.fields.status.name,
        priority: ticket.fields.priority?.name
      }
    })
  } catch (error) {
    console.error('Error fetching Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Jira ticket'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/jira/tickets/:ticketKey
 * Update Jira ticket
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { ticketKey: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const { ticketKey } = params
    const body = await request.json()

    if (!ticketKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'ticketKey is required'
        },
        { status: 400 }
      )
    }

    // Get user's Jira integration
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token
      FROM jira_integrations 
      WHERE user_id = $1 AND is_active = true`,
      [user.userId]
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Jira integration not configured'
        },
        { status: 404 }
      )
    }

    // Create client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Update ticket
    await client.updateIssue(ticketKey, body.fields || {})

    return NextResponse.json({
      success: true,
      message: 'Ticket updated successfully'
    })
  } catch (error) {
    console.error('Error updating Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Jira ticket'
      },
      { status: 500 }
    )
  }
}

















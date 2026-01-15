import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export const dynamic = 'force-dynamic'

// GET /api/sprint-board/issues - Get issues for a sprint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sprintId = searchParams.get('sprintId')

    if (!sprintId) {
      return NextResponse.json(
        { error: 'Sprint ID is required' },
        { status: 400 }
      )
    }

    // Get issues for the sprint from sprint_issues table
    const result = await pool.query(`
      SELECT 
        si.id,
        si.sprint_id,
        si.issue_id,
        si.column_id,
        si.position,
        si.assignee_id,
        i.rule_name,
        i.description,
        i.impact,
        i.wcag_level,
        i.status,
        i.priority,
        i.total_occurrences,
        i.affected_pages,
        i.notes,
        i.help_url,
        i.help_text,
        i.story_points,
        i.remaining_points,
        i.assignee,
        i.created_at,
        i.updated_at,
        sh.url,
        sh.scan_results
      FROM sprint_issues si
      JOIN issues i ON si.issue_id = i.id
      JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE si.sprint_id = $1
      ORDER BY si.column_id, si.position ASC
    `, [sprintId])

    // Convert to the exact same format as backlog items
    const sprintIssues = result.rows.map(issue => {
      let domain = 'unknown'
      try {
        if (issue.url) {
          domain = new URL(issue.url).hostname
        }
      } catch (error) {
        // Try to extract domain from the URL string even if it's not a full URL
        if (issue.url && typeof issue.url === 'string') {
          const urlMatch = issue.url.match(/(?:https?:\/\/)?([^\/\s]+)/)
          if (urlMatch) {
            domain = urlMatch[1]
          }
        }
      }
      
      return {
        id: issue.issue_id,
        issue_id: issue.issue_id,
        rule_name: issue.rule_name,
        description: issue.description,
        impact: issue.impact,
        wcag_level: issue.wcag_level,
        element_selector: null,
        element_html: null,
        failure_summary: issue.notes,
        url: issue.url,
        domain: domain,
        story_points: issue.story_points || 1,
        remaining_points: issue.remaining_points ?? issue.story_points,
        assignee: issue.assignee || null,
        priority_rank: issue.position,
        priority: issue.priority || 'medium',
        status: issue.status || 'backlog',
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comment_count: 0,
        // Add fields that CollapsibleIssue expects
        affectedUrls: [], // Empty array for now
        offendingElements: [],
        suggestions: [],
        // Add detailed scan data for the detailed view (same as backlog)
        scan_data: {
          suggestions: issue.scan_results?.remediationReport?.find((r: any) => r.ruleName === issue.rule_name)?.suggestions || [],
          offending_elements: issue.scan_results?.remediationReport?.find((r: any) => r.ruleName === issue.rule_name)?.offendingElements || [],
          total_occurrences: issue.total_occurrences,
          affected_pages: issue.affected_pages,
          help_url: issue.help_url,
          help_text: issue.help_text,
          // Add screenshots from the original scan - results is an array, screenshots are in results[0].screenshots
          screenshots: issue.scan_results?.results?.[0]?.screenshots || null
        },
        // Sprint-specific fields (keep these for sprint board functionality)
        sprint_issue_id: issue.id,
        sprint_id: issue.sprint_id,
        column_id: issue.column_id,
        position: issue.position
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        issues: sprintIssues
      }
    })

  } catch (error) {
    console.error('❌ Error fetching sprint issues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sprint issues' },
      { status: 500 }
    )
  }
}
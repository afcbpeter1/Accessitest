import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// GET /api/backlog - Get all backlog items for the user
export async function GET(request: NextRequest) {
  try {
    console.log('📋 Backlog API called')
    
    // Temporarily bypass authentication for debugging
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // For now, get all issues and convert them to backlog format
    const result = await pool.query(`
      SELECT 
        i.id,
        i.issue_key,
        i.rule_name,
        i.description,
        i.impact,
        i.wcag_level,
        i.help_url,
        i.help_text,
        i.total_occurrences,
        i.affected_pages,
        i.notes,
        i.status,
        i.priority,
        i.rank as priority_rank,
        i.created_at,
        i.updated_at,
        sh.url,
        sh.user_id,
        sh.scan_results
      FROM issues i
      JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE sh.user_id = '09d7030b-e612-4226-b695-beefb3e97936'
      ORDER BY 
        CASE WHEN i.rank IS NOT NULL THEN i.rank ELSE 999999 END ASC,
        i.created_at DESC
    `)

    console.log('📊 Found backlog items:', result.rows.length)
    
    // Debug: Log the first issue's scan results structure
    if (result.rows.length > 0) {
      console.log('🔍 Debug - First issue scan results structure:')
      console.log('Rule name:', result.rows[0].rule_name)
      console.log('Scan results keys:', Object.keys(result.rows[0].scan_results || {}))
      if (result.rows[0].scan_results) {
        console.log('Scan results structure:', JSON.stringify(result.rows[0].scan_results, null, 2))
      }
    }

    // Convert to backlog format
    const backlogItems = result.rows.map(issue => {
      let domain = 'unknown'
      try {
        if (issue.url) {
          domain = new URL(issue.url).hostname
        }
      } catch (error) {
        console.log('⚠️ Invalid URL:', issue.url)
        // Try to extract domain from the URL string even if it's not a full URL
        if (issue.url && typeof issue.url === 'string') {
          const urlMatch = issue.url.match(/(?:https?:\/\/)?([^\/\s]+)/)
          if (urlMatch) {
            domain = urlMatch[1]
          }
        }
      }
      
      return {
        id: issue.id,
        issue_id: issue.issue_key,
        rule_name: issue.rule_name,
        description: issue.description,
        impact: issue.impact,
        wcag_level: issue.wcag_level,
        element_selector: null,
        element_html: null,
        failure_summary: issue.notes,
        url: issue.url,
        domain: domain,
        story_points: 1,
        priority_rank: issue.priority_rank || 999999,
        status: issue.status || 'backlog',
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comment_count: 0,
               // Add detailed scan data for the detailed view
               scan_data: {
                 // Extract offending elements from scan results (same as DetailedReport)
                 suggestions: (() => {
                   try {
                     if (!issue.scan_results) return []
                     
                     const scanData = issue.scan_results
                     
                     // Look for results array with offending elements (this is the actual structure)
                     if (scanData.results && Array.isArray(scanData.results)) {
                       const ruleResults = scanData.results.filter(r => r.ruleName === issue.rule_name)
                       return ruleResults.flatMap((result: any) => {
                         if (result.offendingElements && Array.isArray(result.offendingElements)) {
                           return result.offendingElements.map((element: any) => ({
                             description: element.failureSummary || result.description || issue.description,
                             affectedElement: element.html,
                             selector: element.target ? element.target.join(' ') : null,
                             type: 'Fix Required'
                           }))
                         }
                         return []
                       })
                     }
                     
                     // Fallback: create a basic suggestion from the issue data
                     return [{
                       description: issue.description,
                       affectedElement: null,
                       selector: null,
                       type: 'Fix Required'
                     }]
                   } catch (error) {
                     console.log('Error extracting suggestions:', error)
                     return []
                   }
                 })(),
                 total_occurrences: issue.total_occurrences,
                 affected_pages: issue.affected_pages,
                 help_url: issue.help_url,
                 help_text: issue.help_text,
                 // Add screenshots from the original scan (match actual structure)
                 screenshots: (() => {
                   try {
                     if (!issue.scan_results) return null
                     
                     const scanData = issue.scan_results
                     
                     // Look for screenshots in results array (this is the actual structure)
                     if (scanData.results && Array.isArray(scanData.results)) {
                       const ruleResults = scanData.results.filter(r => r.ruleName === issue.rule_name)
                       if (ruleResults.length > 0 && ruleResults[0].screenshots) {
                         return {
                           viewport: ruleResults[0].screenshots.viewport || ruleResults[0].screenshots.fullPage,
                           elements: ruleResults[0].screenshots.elements ? ruleResults[0].screenshots.elements
                             .filter((el: any) => el.issueId === issue.issue_key || el.selector)
                             .map((el: any) => ({
                               selector: el.selector,
                               screenshot: el.screenshot
                             })) : []
                         }
                       }
                     }
                     
                     return null
                   } catch (error) {
                     console.log('Error extracting screenshots:', error)
                     return null
                   }
                 })()
               }
      }
    })

    return NextResponse.json({
      success: true,
      items: backlogItems
    })

  } catch (error) {
    console.error('❌ Error fetching backlog items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch backlog items' },
      { status: 500 }
    )
  }
}

// POST /api/backlog - Create a new backlog item
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rule_name, description, impact, wcag_level, url, domain } = await request.json()

    if (!rule_name || !description || !impact) {
      return NextResponse.json(
        { error: 'Rule name, description, and impact are required' },
        { status: 400 }
      )
    }

    // Get the next priority rank
    const maxRank = await pool.query(`
      SELECT COALESCE(MAX(priority_rank), 0) as max_rank 
      FROM product_backlog 
      WHERE user_id = $1
    `, [user.userId])

    const nextRank = (maxRank.rows[0]?.max_rank || 0) + 1

    const result = await pool.query(`
      INSERT INTO product_backlog (
        user_id, issue_id, rule_name, description, impact, wcag_level, 
        url, domain, priority_rank, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'backlog', NOW(), NOW()
      ) RETURNING *
    `, [user.userId, `issue_${Date.now()}`, rule_name, description, impact, wcag_level, url, domain, nextRank])

    return NextResponse.json({
      success: true,
      item: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error creating backlog item:', error)
    return NextResponse.json(
      { error: 'Failed to create backlog item' },
      { status: 500 }
    )
  }
}

import { CreateWorkItemRequest } from './azure-devops-client'

export interface LocalIssue {
  id: string
  rule_name?: string
  description?: string
  impact?: string
  priority?: string
  wcag_level?: string
  total_occurrences?: number
  affected_pages?: string[]
  help_url?: string
  help_text?: string
  notes?: string
  issue_key?: string
  offendingElements?: Array<{
    html?: string
    target?: string[]
    failureSummary?: string
    impact?: string
    url?: string
    screenshot?: string
    boundingBox?: any
    pageNumber?: number
  }>
  suggestions?: Array<{
    type?: string
    description?: string
    codeExample?: string
    code?: string
    priority?: string
    text?: string
  }>
  screenshots?: any
}

/**
 * Map local issue priority to Azure DevOps priority
 * Azure DevOps uses numeric priorities: 1 (Critical), 2 (High), 3 (Medium), 4 (Low)
 */
function mapPriority(localPriority?: string): number {
  if (!localPriority) return 3 // Default to Medium
  
  const priorityMap: Record<string, number> = {
    'critical': 1,
    'high': 2,
    'medium': 3,
    'low': 4
  }

  const mapped = priorityMap[localPriority.toLowerCase()]
  return mapped !== undefined ? mapped : 3 // Default to Medium
}

/**
 * Build remediation steps/implementation steps with HTML formatting
 * This will be placed in Repro Steps, Acceptance Criteria, or Description depending on work item type
 * Azure DevOps supports HTML in these fields
 */
function buildRemediationSteps(issue: LocalIssue): string {
  const sections: string[] = []
  
  // Implementation Steps
  if (issue.offendingElements && issue.offendingElements.length > 0) {
    const isDocumentScan = issue.offendingElements.some((e: any) => e.pageNumber !== undefined)
    
    sections.push(`<h3>Implementation Steps</h3>`)
    
    if (isDocumentScan) {
      sections.push(`<p><strong>Document Accessibility Fix Steps:</strong></p>`)
      sections.push(`<ol>`)
      sections.push(`<li>Review the affected sections/pages listed in the description above</li>`)
      sections.push(`<li>Apply the recommended fixes to the document</li>`)
      sections.push(`<li>Update the document structure or content as needed</li>`)
      sections.push(`<li>Verify accessibility improvements using document accessibility checkers</li>`)
      sections.push(`<li>Re-scan the document to confirm the issue is resolved</li>`)
      sections.push(`</ol>`)
    } else {
      sections.push(`<p><strong>Web Accessibility Fix Steps:</strong></p>`)
      sections.push(`<ol>`)
      sections.push(`<li>Review the affected elements listed in the description above</li>`)
      if (issue.suggestions && issue.suggestions.length > 0) {
        sections.push(`<li>Apply the CSS fixes provided in the code examples below</li>`)
      } else {
        sections.push(`<li>Review the issue description and apply appropriate fixes</li>`)
      }
      sections.push(`<li>Test the changes using browser developer tools</li>`)
      sections.push(`<li>Verify the fix meets WCAG ${issue.wcag_level || 'AA'} standards</li>`)
      sections.push(`<li>Test with screen readers and accessibility tools</li>`)
      sections.push(`<li>Re-scan the page to confirm the issue is resolved</li>`)
      sections.push(`</ol>`)
    }
  }

  // AI-Generated Suggested Fix
  if (issue.suggestions && issue.suggestions.length > 0) {
    sections.push(`<h3>AI-Generated Suggested Fix</h3>`)
    
    issue.suggestions.forEach((suggestion: any, index: number) => {
      if (suggestion.description) {
        // Parse the description to split numbered points into separate paragraphs
        const description = suggestion.description.trim()
        
        // Check if description contains numbered points (e.g., "1. ... 2. ... 3. ...")
        // Split on patterns like "1. ", "2. ", "3. " etc. (number followed by period and space)
        const numberedPoints: string[] = description.split(/(?=\d+\.\s)/).filter((point: string) => point.trim().length > 0)
        
        if (numberedPoints.length > 1) {
          // Multiple numbered points - format each as a separate paragraph
          sections.push(`<p><strong>Fix ${index + 1}:</strong></p>`)
          numberedPoints.forEach((point: string) => {
            const trimmedPoint = point.trim()
            if (trimmedPoint) {
              sections.push(`<p style="margin-bottom: 8px;">${escapeHtml(trimmedPoint)}</p>`)
            }
          })
        } else {
          // Single paragraph or no numbered points - format as normal
          sections.push(`<p><strong>Fix ${index + 1}:</strong> ${escapeHtml(description)}</p>`)
        }
      }
      
      // Code Example
      if (suggestion.codeExample || suggestion.code) {
        const code = suggestion.codeExample || suggestion.code || ''
        if (code.trim()) {
          sections.push(`<p style="margin-top: 12px;"><strong>Code Example:</strong></p>`)
          sections.push(`<pre style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; border-left: 3px solid #007acc; margin-top: 8px;"><code>${escapeHtml(code.trim())}</code></pre>`)
        }
      }
      
      if (issue.suggestions && index < issue.suggestions.length - 1) {
        sections.push(`<hr style="margin: 16px 0;"/>`)
      }
    })
  } else if (issue.help_text) {
    // If no suggestions but we have help text, include it
    sections.push(`<h3>Additional Guidance</h3>`)
    sections.push(`<p>${escapeHtml(issue.help_text)}</p>`)
    if (issue.help_url) {
      sections.push(`<p><a href="${escapeHtml(issue.help_url)}" target="_blank">Learn more about this issue</a></p>`)
    }
  }

  // Visual Evidence - add links to screenshots
  if (issue.screenshots || (issue.offendingElements && issue.offendingElements.some((e: any) => e.screenshot))) {
    sections.push(`<h3>Visual Evidence</h3>`)
    
    if (issue.screenshots) {
      if (issue.screenshots.fullPage) {
        sections.push(`<p><strong>Full Page Screenshot:</strong> <a href="${escapeHtml(issue.screenshots.fullPage)}" target="_blank">View Full Page Screenshot</a></p>`)
      }
      
      if (issue.screenshots.elements && Array.isArray(issue.screenshots.elements)) {
        issue.screenshots.elements.forEach((element: any, index: number) => {
          if (element.screenshot) {
            const selector = element.selector || `Element ${index + 1}`
            sections.push(`<p><strong>${escapeHtml(selector)}:</strong> <a href="${escapeHtml(element.screenshot)}" target="_blank">View Screenshot</a></p>`)
          }
        })
      }
    } else if (issue.offendingElements && issue.offendingElements.some((e: any) => e.screenshot)) {
      // Fallback: check offending elements for screenshots
      issue.offendingElements.forEach((element: any, index: number) => {
        if (element.screenshot) {
          const elementLabel = element.target && element.target.length > 0 
            ? escapeHtml(element.target.join(' > '))
            : `Element ${index + 1}`
          sections.push(`<p><strong>${elementLabel}:</strong> <a href="${escapeHtml(element.screenshot)}" target="_blank">View Screenshot</a></p>`)
        }
      })
    }
  }

  // Include rule information if available
  if (issue.rule_name) {
    sections.push(`<h3>Issue Details</h3>`)
    sections.push(`<p><strong>Rule:</strong> ${escapeHtml(issue.rule_name)}</p>`)
    if (issue.wcag_level) {
      sections.push(`<p><strong>WCAG Level:</strong> ${escapeHtml(issue.wcag_level)}</p>`)
    }
    if (issue.impact) {
      sections.push(`<p><strong>Impact:</strong> ${escapeHtml(issue.impact)}</p>`)
    }
    if (issue.total_occurrences) {
      sections.push(`<p><strong>Total Occurrences:</strong> ${issue.total_occurrences}</p>`)
    }
  }

  return sections.join('\n')
}

/**
 * Build the full work item body in backlog format: Issue Summary, Problem Description,
 * Implementation Steps, Offending Elements, AI-Generated Suggested Fix, Visual Evidence.
 * Used for both System.Description and Repro Steps so ADO shows the same content everywhere.
 */
function buildFullBodyForAdo(issue: LocalIssue): string {
  const sections: string[] = []

  // 📋 Issue Summary
  sections.push(`<h2>📋 Issue Summary</h2>`)
  const summaryParts: string[] = []
  if (issue.impact) summaryParts.push(`<strong>Impact:</strong> ${escapeHtml(issue.impact.toUpperCase())}`)
  if (issue.wcag_level) summaryParts.push(`<strong>WCAG Level:</strong> ${escapeHtml(issue.wcag_level)}`)
  if (issue.total_occurrences !== undefined && issue.total_occurrences > 0) summaryParts.push(`<strong>Occurrences:</strong> ${issue.total_occurrences}`)
  const affectedCount = issue.affected_pages?.length ?? 0
  summaryParts.push(`<strong>Affected Pages:</strong> ${affectedCount}`)
  if (summaryParts.length > 0) {
    sections.push(`<p>${summaryParts.join('<br/>')}</p>`)
  }

  // 🚨 Problem Description
  if (issue.description && issue.description.trim().length > 0) {
    sections.push(`<h2>🚨 Problem Description</h2>`)
    sections.push(`<p>${escapeHtml(issue.description)}</p>`)
  }

  // ✅ Implementation Steps
  const isDocumentScan = issue.offendingElements?.some((e: any) => e.pageNumber !== undefined)
  sections.push(`<h2>✅ Implementation Steps</h2>`)
  if (isDocumentScan) {
    sections.push(`<ol><li>Review the affected sections/pages listed below</li><li>Apply the recommended fixes to the document</li><li>Update the document structure or content as needed</li><li>Verify accessibility improvements using document accessibility checkers</li><li>Re-scan the document to confirm the issue is resolved</li></ol>`)
  } else {
    const wcagLevel = issue.wcag_level || 'wcag2a'
    sections.push(`<ol><li>Review the affected elements listed below</li><li>Apply the fixes provided in the code examples</li><li>Test the changes using browser developer tools</li><li>Verify the fix meets WCAG ${escapeHtml(wcagLevel)} standards</li><li>Test with screen readers and accessibility tools</li><li>Re-scan the page to confirm the issue is resolved</li></ol>`)
  }

  // 🔍 Offending Elements
  if (issue.offendingElements && issue.offendingElements.length > 0) {
    sections.push(`<h2>🔍 Offending Elements</h2>`)
    issue.offendingElements.forEach((element, index) => {
      const elementNum = index + 1
      const impact = (element.impact || issue.impact || 'moderate').toUpperCase()
      sections.push(`<h3>ELEMENT ${elementNum}</h3>`)
      sections.push(`<p><strong>${escapeHtml(impact)}</strong></p>`)
      if (isDocumentScan) {
        if (element.pageNumber) sections.push(`<p><strong>Page Number:</strong> ${element.pageNumber}</p>`)
        if (element.target?.length) sections.push(`<p><strong>Location:</strong> ${escapeHtml(element.target.join(' > '))}</p>`)
        if (element.failureSummary || element.html) sections.push(`<p><strong>Issue Description:</strong></p><p>${escapeHtml(element.failureSummary || element.html || '')}</p>`)
        if (element.url) sections.push(`<p><strong>Document:</strong> ${escapeHtml(element.url)}</p>`)
      } else {
        if (element.html) {
          sections.push(`<p><strong>HTML Code:</strong></p>`)
          sections.push(`<pre><code>${escapeHtml(element.html)}</code></pre>`)
        }
        if (element.target && element.target.length > 0) {
          sections.push(`<p><strong>CSS Selector:</strong></p><p>${escapeHtml(element.target.join(' > '))}</p>`)
        }
        if (element.failureSummary) {
          sections.push(`<p><strong>Issue Description:</strong></p><p>${escapeHtml(element.failureSummary)}</p>`)
        }
        if (element.url) {
          sections.push(`<p><strong>URL:</strong></p><p><a href="${escapeHtml(element.url)}" target="_blank">${escapeHtml(element.url)}</a></p>`)
        }
      }
      if (index < issue.offendingElements!.length - 1) sections.push(`<hr/>`)
    })
  }

  // 🔧 AI-Generated Suggested Fix
  if (issue.suggestions && issue.suggestions.length > 0) {
    sections.push(`<h2>🔧 AI-Generated Suggested Fix</h2>`)
    issue.suggestions.forEach((suggestion: any, index: number) => {
      if (suggestion.description) {
        sections.push(`<p>${escapeHtml(suggestion.description)}</p>`)
      }
      if (suggestion.codeExample || suggestion.code) {
        const code = (suggestion.codeExample || suggestion.code || '').trim()
        if (code) {
          sections.push(`<p><strong>💻 Suggested Fix:</strong></p>`)
          sections.push(`<pre><code>${escapeHtml(code)}</code></pre>`)
        }
      }
      if (index < issue.suggestions!.length - 1) sections.push(`<hr/>`)
    })
  }

  // 📸 Visual Evidence
  sections.push(`<h2>📸 Visual Evidence</h2>`)
  if (issue.screenshots?.fullPage || (issue.screenshots?.elements && issue.screenshots.elements.length > 0)) {
    if (issue.screenshots.fullPage) {
      sections.push(`<p><a href="${escapeHtml(issue.screenshots.fullPage)}" target="_blank">View Full Page Screenshot</a></p>`)
    }
    if (issue.screenshots.elements?.length) {
      issue.screenshots.elements.forEach((el: any) => {
        if (el.screenshot) sections.push(`<p><a href="${escapeHtml(el.screenshot)}" target="_blank">View Screenshot</a></p>`)
      })
    }
  } else if (issue.offendingElements?.some((e: any) => e.screenshot)) {
    issue.offendingElements.forEach((el: any) => {
      if (el.screenshot) sections.push(`<p><a href="${escapeHtml(el.screenshot)}" target="_blank">View Screenshot</a></p>`)
    })
  } else {
    sections.push(`<p>No screenshots available for this issue.</p>`)
    sections.push(`<p><em>Screenshots may not have been captured during the scan.</em></p>`)
  }

  sections.push(`<hr/>`)
  sections.push(`<p><em>Created from A11ytest.ai Scan</em></p>`)
  return sections.join('\n')
}

/**
 * Build HTML description for Azure DevOps work item (legacy / fallback)
 * Azure DevOps supports HTML in descriptions
 */
function buildDescription(issue: LocalIssue, _includeRemediationSteps: boolean = false): string {
  return buildFullBodyForAdo(issue)
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Generate work item title from local issue
 * Azure DevOps title limit is 256 characters
 */
function generateTitle(issue: LocalIssue): string {
  // Prefer rule_name, fallback to description, then issue_key
  let title = issue.rule_name || issue.description || issue.issue_key || 'Accessibility Issue'
  
  // Truncate to 256 characters (Azure DevOps limit)
  if (title.length > 256) {
    title = title.substring(0, 253) + '...'
  }

  return title
}

/**
 * Generate tags for Azure DevOps work item
 * Tags are semicolon-separated
 */
function generateTags(issue: LocalIssue): string {
  const tags: string[] = ['accessibility', 'a11y']

  // Add WCAG level as tag
  if (issue.wcag_level) {
    tags.push(`wcag-${issue.wcag_level.toLowerCase().replace(/\s+/g, '-')}`)
  }

  // Add impact as tag if available
  if (issue.impact) {
    tags.push(`impact-${issue.impact.toLowerCase().replace(/\s+/g, '-')}`)
  }

  // Remove duplicates and empty tags
  return Array.from(new Set(tags.filter(tag => tag && tag.length > 0))).join('; ')
}

/**
 * Map local issue to Azure DevOps work item creation request
 * Returns an array of JSON Patch operations
 * 
 * Smart field mapping based on work item type:
 * - Bug: Remediation steps go to Microsoft.VSTS.TCM.ReproSteps
 * - User Story: Remediation steps go to Microsoft.VSTS.Common.AcceptanceCriteria
 * - Task/Other: Remediation steps go to Description
 */
export function mapIssueToAzureDevOps(
  issue: LocalIssue,
  workItemType: string = 'Bug',
  areaPath?: string,
  iterationPath?: string
): CreateWorkItemRequest[] {
  const patches: CreateWorkItemRequest[] = []

  // Title (required)
  patches.push({
    op: 'add',
    path: '/fields/System.Title',
    value: generateTitle(issue)
  })

  // Single full body in backlog format: Issue Summary, Problem, Implementation Steps, Offending Elements, AI Fix, Visual Evidence
  const fullBody = buildFullBodyForAdo(issue)

  const workItemTypeLower = workItemType.toLowerCase()
  const isBug = workItemTypeLower === 'bug'
  const isUserStory = workItemTypeLower === 'user story' || workItemTypeLower === 'userstory'

  // System.Description always gets the full body
  patches.push({
    op: 'add',
    path: '/fields/System.Description',
    value: fullBody || '<p>Accessibility issue detected during scan.</p>'
  })

  // For Bug: Repro Steps gets the same full body so Offending Elements and full format appear there too
  if (isBug && fullBody) {
    patches.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
      value: fullBody
    })
  } else if (isUserStory && fullBody) {
    patches.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      value: fullBody
    })
  }

  // Work Item Type (required)
  patches.push({
    op: 'add',
    path: '/fields/System.WorkItemType',
    value: workItemType
  })

  // Priority
  const priority = mapPriority(issue.priority || issue.impact)
  patches.push({
    op: 'add',
    path: '/fields/Microsoft.VSTS.Common.Priority',
    value: priority
  })

  // Tags
  const tags = generateTags(issue)
  if (tags) {
    patches.push({
      op: 'add',
      path: '/fields/System.Tags',
      value: tags
    })
  }

  // Area Path (if provided)
  if (areaPath) {
    patches.push({
      op: 'add',
      path: '/fields/System.AreaPath',
      value: areaPath
    })
  }

  // Iteration Path (if provided)
  if (iterationPath) {
    patches.push({
      op: 'add',
      path: '/fields/System.IterationPath',
      value: iterationPath
    })
  }

  return patches
}


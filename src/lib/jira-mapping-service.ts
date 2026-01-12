import { CreateIssueRequest } from './jira-client'

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
 * Map local issue priority to Jira priority
 * Jira Cloud priority names can vary, so we use common ones
 */
function mapPriority(localPriority?: string): string {
  if (!localPriority) return 'Medium'
  
  const priorityMap: Record<string, string> = {
    'critical': 'Highest',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  }

  const mapped = priorityMap[localPriority.toLowerCase()]
  return mapped || 'Medium'
}

/**
 * Build Jira issue description in Atlassian Document Format (ADF)
 * Jira Cloud requires descriptions to be in ADF format
 */
function buildDescription(issue: LocalIssue): any {
  const content: any[] = []

  // Helper to add a paragraph
  const addParagraph = (text: string, marks: any[] = []) => {
    if (!text || text.trim().length === 0) return
    content.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: text.trim(),
        marks: marks
      }]
    })
  }

  // Helper to add a heading
  const addHeading = (text: string, level: number = 2) => {
    if (!text || text.trim().length === 0) return
    content.push({
      type: 'heading',
      attrs: { level },
      content: [{
        type: 'text',
        text: text.trim(),
        marks: [{ type: 'strong' }]
      }]
    })
  }

  // Helper to add a bullet list
  const addBulletList = (items: string[]) => {
    if (!items || items.length === 0) return
    const validItems = items.filter(item => item && item.trim().length > 0)
    if (validItems.length === 0) return
    
    content.push({
      type: 'bulletList',
      content: validItems.map(item => ({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: item.trim()
          }]
        }]
      }))
    })
  }

  // Main description
  if (issue.description && issue.description.trim().length > 0) {
    addHeading('Issue Description')
    addParagraph(issue.description)
  }

  // Impact and WCAG level
  if (issue.impact || issue.wcag_level) {
    addHeading('Accessibility Details')
    const impactInfo: string[] = []
    if (issue.impact) {
      impactInfo.push(`Impact: ${issue.impact}`)
    }
    if (issue.wcag_level) {
      impactInfo.push(`WCAG Level: ${issue.wcag_level}`)
    }
    if (impactInfo.length > 0) {
      addParagraph(impactInfo.join(' | '))
    }
  }

  // Affected pages
  if (issue.affected_pages && issue.affected_pages.length > 0) {
    addHeading('Affected Pages')
    addBulletList(issue.affected_pages)
  }

  // Total occurrences
  if (issue.total_occurrences !== undefined && issue.total_occurrences > 0) {
    addParagraph(`Total Occurrences: ${issue.total_occurrences}`)
  }

  // Help URL and text
  if (issue.help_url || issue.help_text) {
    addHeading('Additional Information')
    if (issue.help_text && issue.help_text.trim().length > 0) {
      addParagraph(issue.help_text)
    }
    if (issue.help_url && issue.help_url.trim().length > 0) {
      content.push({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Learn more: ',
        }, {
          type: 'text',
          text: issue.help_url.trim(),
          marks: [{
            type: 'link',
            attrs: {
              href: issue.help_url.trim()
            }
          }]
        }]
      })
    }
  }

  // Notes
  if (issue.notes && issue.notes.trim().length > 0) {
    addHeading('Notes')
    addParagraph(issue.notes)
  }

  // Offending Elements
  if (issue.offendingElements && issue.offendingElements.length > 0) {
    addHeading('Offending Elements')
    
    const isDocumentScan = issue.offendingElements.some((e: any) => e.pageNumber !== undefined)
    
    issue.offendingElements.forEach((element, index) => {
      const elementNum = index + 1
      const impact = element.impact || issue.impact || 'moderate'
      
      // Element header
      addParagraph(`ELEMENT ${elementNum}`, [{ type: 'strong' }])
      addParagraph(`Impact: ${impact.toUpperCase()}`)
      
      if (isDocumentScan) {
        // Document scan format
        // Page Number
        if (element.pageNumber) {
          addParagraph(`Page Number: ${element.pageNumber}`)
        }
        
        // Document Location
        if (element.target && element.target.length > 0) {
          addParagraph(`Location: ${element.target.join(' > ')}`)
        }
        
        // Issue Description
        if (element.failureSummary || element.html) {
          addParagraph(`Issue: ${element.failureSummary || element.html}`)
        }
        
        // Document/File reference
        if (element.url) {
          addParagraph(`Document: ${element.url}`)
        }
      } else {
        // Web scan format
        // HTML Code
        if (element.html) {
          addParagraph('HTML Code:')
          // Use code block for HTML (ADF format)
          content.push({
            type: 'codeBlock',
            attrs: {},
            content: [{
              type: 'text',
              text: element.html
            }]
          })
        }
        
        // CSS Selector
        if (element.target && element.target.length > 0) {
          const selector = element.target.join(' > ')
          addParagraph(`CSS Selector: ${selector}`)
        }
        
        // Issue Description
        if (element.failureSummary) {
          addParagraph(`Issue: ${element.failureSummary}`)
        }
        
        // URL
        if (element.url) {
          addParagraph(`URL: ${element.url}`)
        }
      }
      
      // Add spacing between elements
      if (index < issue.offendingElements.length - 1) {
        content.push({ type: 'rule' })
      }
    })
  }

  // Implementation Steps (different for document vs web scans)
  if (issue.offendingElements && issue.offendingElements.length > 0) {
    addHeading('Implementation Steps')
    const isDocumentScan = issue.offendingElements.some((e: any) => e.pageNumber !== undefined)
    
    if (isDocumentScan) {
      // Document-specific steps
      const steps = [
        'Review the affected sections/pages listed below',
        'Apply the recommended fixes to the document',
        'Update the document structure or content as needed',
        'Verify accessibility improvements using document accessibility checkers',
        'Re-scan the document to confirm the issue is resolved'
      ]
      addBulletList(steps)
    } else {
      // Web scan steps
      const steps = [
        'Review the affected elements listed below',
        'Apply the CSS fixes provided in the code examples',
        'Test the changes using browser developer tools',
        'Verify color contrast meets WCAG standards',
        'Test with screen readers and accessibility tools',
        'Re-scan the page to confirm the issue is resolved'
      ]
      addBulletList(steps)
    }
  }

  // AI-Generated Suggested Fix
  if (issue.suggestions && issue.suggestions.length > 0) {
    addHeading('AI-Generated Suggested Fix')
    
    issue.suggestions.forEach((suggestion, index) => {
      if (suggestion.description) {
        addParagraph(suggestion.description)
      }
      
      // Code Example
      if (suggestion.codeExample || suggestion.code) {
        const code = suggestion.codeExample || suggestion.code || ''
        if (code.trim()) {
          addParagraph('Suggested Fix:')
          content.push({
            type: 'codeBlock',
            attrs: {},
            content: [{
              type: 'text',
              text: code.trim()
            }]
          })
        }
      }
      
      if (index < issue.suggestions.length - 1) {
        content.push({ type: 'rule' })
      }
    })
  }

  // Visual Evidence - add links to Cloudinary screenshots
  if (issue.screenshots || (issue.offendingElements && issue.offendingElements.some(e => e.screenshot))) {
    addHeading('Visual Evidence')
    
    // Add links to screenshots stored in Cloudinary
    if (issue.screenshots) {
      if (issue.screenshots.fullPage) {
        content.push({
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Full Page Screenshot: '
          }, {
            type: 'text',
            text: 'View Full Page Screenshot',
            marks: [{
              type: 'link',
              attrs: {
                href: issue.screenshots.fullPage
              }
            }]
          }]
        })
      }
      
      if (issue.screenshots.elements && Array.isArray(issue.screenshots.elements)) {
        issue.screenshots.elements.forEach((element: any, index: number) => {
          if (element.screenshot) {
            const selector = element.selector || `Element ${index + 1}`
            content.push({
              type: 'paragraph',
              content: [{
                type: 'text',
                text: `${selector}: `
              }, {
                type: 'text',
                text: 'View Screenshot',
                marks: [{
                  type: 'link',
                  attrs: {
                    href: element.screenshot
                  }
                }]
              }]
            })
          }
        })
      }
    } else if (issue.offendingElements && issue.offendingElements.some((e: any) => e.screenshot)) {
      // Fallback: check offending elements for screenshots
      issue.offendingElements.forEach((element: any) => {
        if (element.screenshot) {
          content.push({
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Screenshot: '
            }, {
              type: 'text',
              text: 'View Screenshot',
              marks: [{
                type: 'link',
                attrs: {
                  href: element.screenshot
                }
              }]
            }]
          })
        }
      })
    }
  }

  // Add footer only if we have content
  if (content.length > 0) {
    content.push({
      type: 'rule'
    })
    content.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Created from Accessibility Scan',
        marks: [{ type: 'em' }]
      }]
    })
  } else {
    // If no content, add a minimal paragraph
    content.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Accessibility issue detected during scan.'
      }]
    })
  }

  // Return ADF document structure
  return {
    type: 'doc',
    version: 1,
    content: content
  }
}

/**
 * Generate Jira issue title from local issue
 * Truncates to 255 characters (Jira limit)
 */
function generateTitle(issue: LocalIssue): string {
  // Prefer rule_name, fallback to description, then issue_key
  let title = issue.rule_name || issue.description || issue.issue_key || 'Accessibility Issue'
  
  // Truncate to 255 characters (Jira's limit)
  if (title.length > 255) {
    title = title.substring(0, 252) + '...'
  }

  return title
}

/**
 * Sanitize label for Jira (remove spaces and invalid characters)
 * Jira labels can only contain alphanumeric characters, hyphens, and underscores
 */
function sanitizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9_-]/g, '') // Remove invalid characters (keep only alphanumeric, hyphens, underscores)
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate labels for Jira issue
 * Labels must not contain spaces
 */
function generateLabels(issue: LocalIssue): string[] {
  const labels: string[] = ['accessibility', 'a11y']

  // Add WCAG level as label (sanitized)
  if (issue.wcag_level) {
    const wcagLabel = sanitizeLabel(`wcag-${issue.wcag_level}`)
    if (wcagLabel && wcagLabel.length > 0) {
      labels.push(wcagLabel)
    }
  }

  // Add impact as label if available (sanitized)
  if (issue.impact) {
    const impactLabel = sanitizeLabel(`impact-${issue.impact}`)
    if (impactLabel && impactLabel.length > 0) {
      labels.push(impactLabel)
    }
  }

  // Remove duplicates and empty labels
  return [...new Set(labels.filter(label => label && label.length > 0))]
}

/**
 * Map local issue to Jira issue creation request
 */
export function mapIssueToJira(
  issue: LocalIssue,
  projectKey: string,
  issueType: string = 'Bug'
): CreateIssueRequest {
  return {
    fields: {
      project: {
        key: projectKey
      },
      summary: generateTitle(issue),
      description: buildDescription(issue),
      issuetype: {
        name: issueType
      },
      priority: {
        name: mapPriority(issue.priority || issue.impact)
      },
      labels: generateLabels(issue)
    }
  }
}

/**
 * Map local issue to Jira issue creation request
 * Jira Cloud requires descriptions in ADF format
 */
export function mapIssueToJiraSimple(
  issue: LocalIssue,
  projectKey: string,
  issueType: string = 'Bug'
): CreateIssueRequest {
  // Validate and clean inputs
  const cleanIssueType = issueType || 'Bug'
  const cleanProjectKey = projectKey.trim()
  const summary = generateTitle(issue)
  const description = buildDescription(issue) // This now returns ADF format
  
  // Ensure summary is not empty (Jira requires this)
  if (!summary || summary.trim().length === 0) {
    throw new Error('Issue summary cannot be empty')
  }
  
  // Build the request - priority is optional in some Jira configurations
  const request: CreateIssueRequest = {
    fields: {
      project: {
        key: cleanProjectKey
      },
      summary: summary,
      issuetype: {
        name: cleanIssueType
      }
    }
  }
  
  // Add description if available (now in ADF format)
  if (description && (typeof description === 'object' || (typeof description === 'string' && description.trim().length > 0))) {
    request.fields.description = description
  }
  
  // Add priority if we can map it (some Jira projects don't allow priority on creation)
  const priority = mapPriority(issue.priority || issue.impact)
  if (priority) {
    request.fields.priority = {
      name: priority
    }
  }
  
  // Add labels if available
  const labels = generateLabels(issue)
  if (labels && labels.length > 0) {
    request.fields.labels = labels
  }
  
  return request
}

/**
 * Update ADF description with attachment references
 * @param description The existing ADF description
 * @param attachments Array of uploaded attachment metadata
 * @param jiraBaseUrl The base URL of the Jira instance (for building attachment links)
 * @returns Updated ADF description with attachment references
 */
export function addMediaNodesToDescription(
  description: any,
  attachments: Array<{ id: string; filename: string }>,
  jiraBaseUrl?: string
): any {
  `)
  
  if (!description || !description.content || !Array.isArray(description.content)) {

    return description
  }

  // Find the "Visual Evidence" heading and replace the placeholder paragraph
  const updatedContent = [...description.content]
  let visualEvidenceIndex = -1
  
  for (let i = 0; i < updatedContent.length; i++) {
    const item = updatedContent[i]
    if (item.type === 'heading' && 
        item.content && 
        item.content.some((c: any) => c.text && c.text.includes('Visual Evidence'))) {
      visualEvidenceIndex = i

      break
    }
  }

  if (visualEvidenceIndex >= 0 && attachments.length > 0) {
    // Remove the placeholder paragraph after the heading
    const headingIndex = visualEvidenceIndex
    let paragraphIndex = -1
    
    for (let i = headingIndex + 1; i < updatedContent.length; i++) {
      if (updatedContent[i].type === 'paragraph') {
        // Check if this paragraph contains the placeholder text
        const paragraphText = updatedContent[i].content?.map((c: any) => c.text).join('') || ''
        if (paragraphText.includes('Screenshots are being attached') || paragraphText.includes('being attached')) {
          paragraphIndex = i

          break
        }
      }
    }
    
    if (paragraphIndex === -1) {
      // Look for any paragraph after the heading
      for (let i = headingIndex + 1; i < updatedContent.length && i < headingIndex + 3; i++) {
        if (updatedContent[i].type === 'paragraph') {
          paragraphIndex = i

          break
        }
      }
    }

    // Replace placeholder with attachment references
    const attachmentNodes: any[] = []
    
    // Add a note about the attachments
    attachmentNodes.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: `✅ ${attachments.length} screenshot(s) have been successfully attached to this issue.`
      }]
    })
    
    // List all attachments with their filenames
    attachmentNodes.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Attached screenshots:',
        marks: [{ type: 'strong' }]
      }]
    })
    
    attachmentNodes.push({
      type: 'bulletList',
      content: attachments.map(attachment => ({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `📷 ${attachment.filename}`
          }]
        }]
      }))
    })
    
    // Add note about viewing attachments (Jira doesn't support direct links to attachments in ADF)
    attachmentNodes.push({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: '👉 Please view and download the screenshots from the ',
      }, {
        type: 'text',
        text: 'Attachments',
        marks: [{ type: 'strong' }]
      }, {
        type: 'text',
        text: ' section below (located on the right side of this issue).'
      }]
    })

    if (paragraphIndex >= 0) {
      // Replace the placeholder paragraph with attachment nodes
      updatedContent.splice(paragraphIndex, 1, ...attachmentNodes)
    } else {
      // Insert attachment nodes after the heading
      updatedContent.splice(headingIndex + 1, 0, ...attachmentNodes)
    }
  }

  return {
    ...description,
    content: updatedContent
  }
}


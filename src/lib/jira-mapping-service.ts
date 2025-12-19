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


'use client'

import { useState, useEffect } from 'react'
import { X, Copy, ExternalLink, Calendar, User, Tag, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import CollapsibleIssue from './CollapsibleIssue'

interface IssueDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  issue: any
  onStatusChange?: (issueId: string, status: string, notes?: string, deferredReason?: string) => void
}

export default function IssueDetailsModal({ isOpen, onClose, issue, onStatusChange }: IssueDetailsModalProps) {
  const [issueStatus, setIssueStatus] = useState({
    status: issue?.status || 'open',
    notes: '',
    deferredReason: ''
  })

  const [copied, setCopied] = useState(false)
  const [jiraTicket, setJiraTicket] = useState<{ key: string; url: string } | null>(null)
  const [creatingJiraTicket, setCreatingJiraTicket] = useState(false)
  const [checkingJiraTicket, setCheckingJiraTicket] = useState(true)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  useEffect(() => {
    if (issue) {
      setIssueStatus({
        status: issue.status || 'open',
        notes: issue.notes || '',
        deferredReason: issue.deferredReason || ''
      })
      setSelectedTeamId(issue.team_id || '')
      checkJiraTicket()
      loadTeams()
    }
  }, [issue])

  const loadTeams = async () => {
    setLoadingTeams(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success && data.organizations.length > 0) {
        const orgId = data.organizations[0].id
        const teamsResponse = await fetch(`/api/organization/teams?organization_id=${orgId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const teamsData = await teamsResponse.json()
        if (teamsData.success) {
          setTeams(teamsData.teams || [])
        }
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    } finally {
      setLoadingTeams(false)
    }
  }

  const checkJiraTicket = async () => {
    if (!issue?.id) return
    
    setCheckingJiraTicket(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/jira/tickets/check?issueId=${issue.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      if (data.success && data.hasTicket) {
        setJiraTicket({
          key: data.ticketKey,
          url: data.ticketUrl
        })
      } else {
        setJiraTicket(null)
      }
    } catch (error) {
      console.error('Error checking Jira ticket:', error)
    } finally {
      setCheckingJiraTicket(false)
    }
  }

  const createJiraTicket = async () => {
    if (!issue?.id) return
    
    setCreatingJiraTicket(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/jira/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          issueId: issue.id,
          teamId: selectedTeamId || undefined // Only send if a team is selected
        })
      })
      
      const data = await response.json()
      if (data.success && data.ticket) {
        setJiraTicket({
          key: data.ticket.key,
          url: data.ticket.url
        })
      } else {
        alert(data.error || 'Failed to create Jira ticket')
      }
    } catch (error) {
      console.error('Error creating Jira ticket:', error)
      alert('Failed to create Jira ticket')
    } finally {
      setCreatingJiraTicket(false)
    }
  }

  if (!isOpen || !issue) return null

  const handleStatusChange = (status: string) => {
    setIssueStatus(prev => ({ ...prev, status }))
    if (onStatusChange) {
      onStatusChange(issue.id, status, issueStatus.notes, issueStatus.deferredReason)
    }
  }

  const handleNotesChange = (notes: string) => {
    setIssueStatus(prev => ({ ...prev, notes }))
  }

  const handleDeferredReasonChange = (reason: string) => {
    setIssueStatus(prev => ({ ...prev, deferredReason: reason }))
  }

  const generateDefectTicket = () => {
    const statusEmoji = {
      'open': '🔴',
      'in_progress': '🟡', 
      'resolved': '✅',
      'deferred': '⏸️'
    }

    const priorityEmoji = {
      'critical': '🚨',
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    }

    const impactEmoji = {
      'critical': '🚨',
      'serious': '⚠️',
      'moderate': '🟡',
      'minor': '🟢'
    }

    return `# Accessibility Issue: ${issue.rule_name}

## 📋 Issue Details
- **Status**: ${statusEmoji[issueStatus.status as keyof typeof statusEmoji]} ${issueStatus.status.toUpperCase()}
- **Priority**: ${priorityEmoji[issue.priority as keyof typeof priorityEmoji]} ${issue.priority.toUpperCase()}
- **Impact**: ${impactEmoji[issue.impact as keyof typeof impactEmoji]} ${issue.impact.toUpperCase()}
- **Occurrences**: ${issue.total_occurrences || 1}
- **Last Seen**: ${new Date(issue.last_seen).toLocaleDateString()}

## 🎯 Description
${issue.description}

## 🔧 WCAG Guidelines
- **Level**: ${issue.wcag_level || 'A'}
- **Help URL**: ${issue.help_url || 'N/A'}

## 📝 Notes
${issueStatus.notes || 'No additional notes'}

${issueStatus.status === 'deferred' ? `## ⏸️ Deferred Reason\n${issueStatus.deferredReason}\n` : ''}

## 🏷️ Tags
- Impact: ${issue.impact}
- Priority: ${issue.priority}
- Status: ${issueStatus.status}

---
*Generated by AccessScan - Accessibility Issue Management System*`
  }

  const copyDefectTicket = async () => {
    try {
      const ticket = generateDefectTicket()
      await navigator.clipboard.writeText(ticket)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy defect ticket:', error)
    }
  }

  // Create a mock scan result format for CollapsibleIssue
  const mockScanResult = {
    issues: [{
      id: issue.id,
      description: issue.rule_name,
      help: issue.description,
      impact: issue.impact,
      nodes: [{
        html: issue.element_html || '',
        target: [issue.element_selector || ''],
        failureSummary: issue.failure_summary || ''
      }]
    }],
    screenshots: {
      viewport: issue.screenshot_url,
      elements: issue.screenshot_url ? [{
        selector: issue.element_selector || '',
        issueId: issue.id,
        severity: issue.impact,
        screenshot: issue.screenshot_url
      }] : []
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{issue.rule_name}</h2>
                  <p className="text-sm text-gray-600">Issue #{issue.id.slice(-8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {checkingJiraTicket ? (
                  <div className="px-4 py-2 text-gray-500">Checking Jira...</div>
                ) : jiraTicket ? (
                  <a
                    href={jiraTicket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View in Jira ({jiraTicket.key})
                  </a>
                ) : (
                  <div className="flex items-center gap-2">
                    {teams.length > 0 && (
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="Select team to assign ticket to"
                      >
                        <option value="">Personal Integration</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name} {team.jira_project_key ? `(${team.jira_project_key})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={createJiraTicket}
                      disabled={creatingJiraTicket}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {creatingJiraTicket ? 'Creating...' : 'Create Jira Ticket'}
                    </button>
                  </div>
                )}
                <button
                  onClick={copyDefectTicket}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy Defect Ticket'}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Issue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">Impact</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  issue.impact === 'critical' ? 'bg-red-100 text-red-800' :
                  issue.impact === 'serious' ? 'bg-orange-100 text-orange-800' :
                  issue.impact === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {issue.impact.toUpperCase()}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Status</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  issueStatus.status === 'open' ? 'bg-red-100 text-red-800' :
                  issueStatus.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  issueStatus.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {issueStatus.status.toUpperCase()}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Priority</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  issue.priority === 'critical' ? 'bg-red-100 text-red-800' :
                  issue.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  issue.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {issue.priority.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Detailed Issue View */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Details</h3>
              
              {/* Use CollapsibleIssue component for consistency */}
              <CollapsibleIssue
                issueId={issue.id}
                ruleName={issue.rule_name}
                description={issue.description}
                impact={issue.impact}
                wcag22Level={issue.wcag_level}
                help={issue.description || ''}
                helpUrl={issue.help_url || ''}
                totalOccurrences={issue.total_occurrences || 1}
                affectedUrls={issue.affected_pages || []}
                offendingElements={[]}
                suggestions={[{
                  type: 'fix' as const,
                  description: issue.description,
                  priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                }]}
                priority={(issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'}
                screenshots={mockScanResult.screenshots}
                scanId={''}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
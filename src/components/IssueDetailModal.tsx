'use client'

import React, { useState } from 'react'
import { 
  X, 
  ExternalLink, 
  Image, 
  Code, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Target,
  Users,
  Calendar,
  MessageSquare,
  Plus,
  Edit3,
  Save,
  XCircle,
  FileText
} from 'lucide-react'

interface IssueDetailModalProps {
  issue: any
  isOpen: boolean
  onClose: () => void
  onUpdate?: (issueId: string, updates: any) => void
}

export default function IssueDetailModal({ issue, isOpen, onClose, onUpdate }: IssueDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [storyPoints, setStoryPoints] = useState(issue?.story_points || 1)
  const [remainingPoints, setRemainingPoints] = useState(issue?.remaining_points || issue?.story_points || 1)
  const [assignee, setAssignee] = useState(issue?.assignee || '')
  const [description, setDescription] = useState(issue?.description || '')
  const [comments, setComments] = useState<string[]>([])
  const [newComment, setNewComment] = useState('')

  // Update state when issue prop changes
  React.useEffect(() => {
    if (issue) {
      setStoryPoints(issue.story_points || 1)
      setRemainingPoints(issue.remaining_points || issue.story_points || 1)
      setAssignee(issue.assignee || '')
      setDescription(issue.description || '')
    }
  }, [issue])

  if (!isOpen || !issue) return null

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }


  const handleSave = async () => {
    try {
      console.log('💾 Saving issue updates:', {
        id: issue.id,
        story_points: storyPoints,
        remaining_points: remainingPoints,
        assignee,
        description
      })

      // Save to database
      const response = await fetch('/api/backlog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: issue.id,
          story_points: storyPoints,
          remaining_points: remainingPoints,
          assignee,
          description
        })
      })

      const data = await response.json()
      console.log('📊 Save response:', data)

      if (response.ok && data.success) {
        console.log('✅ Issue updated successfully in database')
        
        // Update local state
        if (onUpdate) {
          onUpdate(issue.id, {
            story_points: storyPoints,
            remaining_points: remainingPoints,
            assignee,
            description
          })
        }
        setIsEditing(false)
      } else {
        console.error('❌ Failed to update issue:', data.error)
        alert('Failed to save changes. Please try again.')
      }
    } catch (error) {
      console.error('❌ Error updating issue:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments([...comments, newComment.trim()])
      setNewComment('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">#{issue.issue_id}</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(issue.impact)}`}>
                {issue.impact.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{issue.rule_name}</h1>
              <p className="text-gray-600">{issue.description}</p>
            </div>

            {/* Bug Ticket Details */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Bug Ticket Details
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="prose prose-sm max-w-none">
                  {/* Issue Summary */}
                  <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">📋 Issue Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Impact:</span>
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(issue.impact)}`}>
                          {issue.impact.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">WCAG Level:</span>
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {issue.wcag_level}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Occurrences:</span>
                        <span className="ml-2 text-gray-600">{issue.scan_data?.total_occurrences || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Affected Pages:</span>
                        <span className="ml-2 text-gray-600">{issue.scan_data?.affected_pages?.length || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Problem Description */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">🚨 Problem Description</h4>
                    <p className="text-gray-800 mb-3">{issue.description}</p>
                    {issue.scan_data?.help_text && (
                      <p className="text-gray-700 text-sm">{issue.scan_data.help_text}</p>
                    )}
                  </div>

                  {/* Implementation Steps */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">✅ Implementation Steps</h4>
                    <ol className="list-decimal list-inside space-y-2 text-gray-800">
                      <li>Review the affected elements listed below</li>
                      <li>Apply the CSS fixes provided in the code examples</li>
                      <li>Test the changes using browser developer tools</li>
                      <li>Verify color contrast meets WCAG {issue.wcag_level} standards</li>
                      <li>Test with screen readers and accessibility tools</li>
                      <li>Re-scan the page to confirm the issue is resolved</li>
                    </ol>
                  </div>

                  {/* Offending Elements */}
                  {issue.scan_data?.offending_elements && issue.scan_data.offending_elements.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">🔍 Offending Elements</h4>
                      <div className="space-y-3">
                        {issue.scan_data.offending_elements.map((element: any, index: number) => (
                          <div key={index} className="bg-white border border-gray-200 rounded p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                ELEMENT {index + 1}
                              </span>
                              {element.impact && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(element.impact)}`}>
                                  {element.impact.toUpperCase()}
                                </span>
                              )}
                            </div>
                            
                            {/* HTML Code */}
                            {element.html && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2 font-medium">HTML Code:</p>
                                <pre className="bg-gray-100 border border-gray-200 text-gray-800 p-3 rounded text-sm overflow-x-auto">
                                  <code>{element.html}</code>
                                </pre>
                              </div>
                            )}
                            
                            {/* CSS Selector */}
                            {element.target && element.target.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2 font-medium">CSS Selector:</p>
                                <pre className="bg-gray-100 border border-gray-200 text-gray-800 p-3 rounded text-sm overflow-x-auto">
                                  <code>{element.target.join(' ')}</code>
                                </pre>
                              </div>
                            )}
                            
                            {/* Failure Summary */}
                            {element.failureSummary && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2 font-medium">Issue Description:</p>
                                <p className="text-gray-700 text-sm">{element.failureSummary}</p>
                              </div>
                            )}
                            
                            {/* Screenshot */}
                            {element.screenshot && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2 font-medium">📸 Element Screenshot:</p>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <img 
                                    src={element.screenshot}
                                    alt={`Screenshot of element ${index + 1}`}
                                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(element.screenshot, '_blank')}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {/* URL */}
                            {element.url && (
                              <div>
                                <p className="text-sm text-gray-600 mb-1 font-medium">URL:</p>
                                <a 
                                  href={element.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm break-all"
                                >
                                  {element.url}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Fix */}
                  {issue.scan_data?.suggestions && issue.scan_data.suggestions.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">🔧 Suggested Fix</h4>
                      <div className="space-y-4">
                        {issue.scan_data.suggestions.map((suggestion: any, index: number) => (
                          <div key={index} className="bg-white border border-gray-200 rounded p-3">
                            <div className="flex items-center gap-2 mb-2">
                            </div>
                            <div className="text-gray-700 mb-3">
                              {suggestion.description ? (
                                <div className="whitespace-pre-line">
                                  {suggestion.description
                                    .replace(/2\. Specific code fix:\s*/g, '')
                                    .replace(/3\./g, '2.')
                                  }
                                </div>
                              ) : (
                                'No description available'
                              )}
                            </div>
                            
                            {/* Affected Element Code */}
                            {suggestion.affectedElement && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2 font-medium">🔍 Affected Element:</p>
                                <pre className="bg-gray-100 border border-gray-200 text-gray-800 p-3 rounded text-sm overflow-x-auto">
                                  <code>{suggestion.affectedElement}</code>
                                </pre>
                              </div>
                            )}

                            {/* Suggested Fix Code */}
                            {suggestion.codeExample && (
                              <div>
                                <p className="text-sm text-gray-600 mb-2 font-medium">💻 Suggested Fix:</p>
                                <pre className="bg-gray-900 text-white p-3 rounded text-sm overflow-x-auto">
                                  <code>{suggestion.codeExample}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Visual Evidence */}
                  {issue.scan_data?.screenshots && (issue.scan_data.screenshots.viewport || issue.scan_data.screenshots.fullPage || (issue.scan_data.screenshots.elements && Array.isArray(issue.scan_data.screenshots.elements))) && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">📸 Visual Evidence</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(issue.scan_data.screenshots.viewport || issue.scan_data.screenshots.fullPage) && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="p-3 bg-gray-100 text-sm font-medium text-gray-900">
                              🌐 Website Screenshot
                            </div>
                            <img 
                              src={issue.scan_data.screenshots.viewport || issue.scan_data.screenshots.fullPage}
                              alt="Website screenshot"
                              className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(issue.scan_data.screenshots.viewport || issue.scan_data.screenshots.fullPage, '_blank')}
                            />
                          </div>
                        )}
                        {issue.scan_data.screenshots.elements && issue.scan_data.screenshots.elements.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">🎯 Affected Elements:</h5>
                            {issue.scan_data.screenshots.elements.slice(0, 4).map((element: any, index: number) => (
                              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="p-2 bg-gray-100 text-xs text-gray-900 font-mono">
                                  {element.selector}
                                </div>
                                <img 
                                  src={element.screenshot}
                                  alt={`Screenshot of ${element.selector}`}
                                  className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(element.screenshot, '_blank')}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Visual Evidence - Fallback when no screenshots */}
                  {(!issue.scan_data?.screenshots || (!issue.scan_data.screenshots.viewport && (!issue.scan_data.screenshots.elements || issue.scan_data.screenshots.elements.length === 0))) && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">📸 Visual Evidence</h4>
                      <div className="text-center py-8">
                        <div className="text-gray-500 mb-2">📷</div>
                        <p className="text-gray-500">No screenshots available for this issue</p>
                        <p className="text-gray-400 text-sm mt-1">Screenshots may not have been captured during the scan</p>
                      </div>
                    </div>
                  )}

                  {/* Resources */}
                  {issue.scan_data?.help_url && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">📚 Additional Resources</h4>
                      <a 
                        href={issue.scan_data.help_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View WCAG Guidelines for this issue
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>



            {/* Comments */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gray-600" />
                Comments ({comments.length})
              </h3>
              <div className="space-y-3">
                {comments.map((comment, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        U
                      </div>
                      <span className="text-sm font-medium text-gray-700">You</span>
                      <span className="text-xs text-gray-500">now</span>
                    </div>
                    <p className="text-gray-700">{comment}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddComment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l border-gray-200 p-6 bg-gray-50 overflow-y-auto">
            <div className="space-y-6">
              {/* Story Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Story Points</label>
                {isEditing ? (
                  <select
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={13}>13</option>
                    <option value={21}>21</option>
                    <option value={34}>34</option>
                    <option value={55}>55</option>
                    <option value={89}>89</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-gray-500" />
                    <span className="text-lg font-semibold">{storyPoints}</span>
                  </div>
                )}
              </div>

              {/* Remaining Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remaining Points</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={remainingPoints}
                    onChange={(e) => setRemainingPoints(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="20"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-lg font-semibold">{remainingPoints}</span>
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Assign to..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{assignee || 'Unassigned'}</span>
                  </div>
                )}
              </div>


              {/* Created Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{new Date(issue.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{issue.domain}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200">
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

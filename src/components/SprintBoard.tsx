'use client'

import { useState, useEffect } from 'react'
import { 
  Plus, 
  Settings, 
  MoreHorizontal,
  Calendar,
  Target,
  Users,
  BarChart3
} from 'lucide-react'
import IssueDetailModal from './IssueDetailModal'
import SprintSettingsModal from './SprintSettingsModal'

interface Sprint {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: string
  goal?: string
}

interface SprintColumn {
  id: string
  name: string
  description?: string
  position: number
  color: string
  wip_limit?: number
  is_done_column: boolean
}

interface SprintIssue {
  id: string
  sprint_id: string
  issue_id: string
  column_id: string
  position: number
  story_points: number
  assignee_id?: string
  created_at: string
  updated_at: string
  rule_name: string
  description: string
  impact: string
  wcag_level: string
  status: string
  priority: string
  total_occurrences: number
  affected_pages: number
  notes?: string
  help_url?: string
  help_text?: string
  url: string
  scan_results?: any
  // Add the same fields as BacklogItem for consistency
  issue_id: string
  element_selector?: string
  element_html?: string
  failure_summary?: string
  domain: string
  priority_rank: number
  comment_count: number
  scan_data?: {
    suggestions: any[]
    offending_elements: any[]
    total_occurrences: number
    affected_pages: number
    help_url?: string
    help_text?: string
    screenshots?: any
  }
}

export default function SprintBoard() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null)
  const [columns, setColumns] = useState<SprintColumn[]>([])
  
  const [issues, setIssues] = useState<SprintIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draggedIssue, setDraggedIssue] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showIssueMenu, setShowIssueMenu] = useState<string | null>(null)

  useEffect(() => {
    fetchSprints()
  }, [])

  useEffect(() => {
    if (selectedSprint) {
      fetchSprintData()
    }
  }, [selectedSprint])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowIssueMenu(null)
    }
    
    if (showIssueMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showIssueMenu])

  const fetchSprints = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sprint-board/sprints')
      const data = await response.json()
      
      if (data.success) {
        setSprints(data.data.sprints)
        if (data.data.sprints.length > 0 && !selectedSprint) {
          setSelectedSprint(data.data.sprints[0])
        }
      } else {
        console.error('❌ Sprint API error:', data.error)
      }
    } catch (error) {
      console.error('❌ Error fetching sprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSprintData = async () => {
    if (!selectedSprint) return

    try {
      setLoading(true)
      
      // Fetch columns for the sprint
      const columnsRes = await fetch(`/api/sprint-board/columns?sprintId=${selectedSprint.id}`)
      const columnsData = await columnsRes.json()

      if (columnsData.success) {
        setColumns(columnsData.data.columns)
      } else {
        console.error('❌ Columns API error:', columnsData.error)
      }
      
      // Fetch issues for the sprint
      const issuesRes = await fetch(`/api/sprint-board/issues?sprintId=${selectedSprint.id}`)
      const issuesData = await issuesRes.json()

      if (issuesData.success) {
        setIssues(issuesData.data.issues)
      } else {
        console.error('❌ Issues API error:', issuesData.error)
      }
    } catch (error) {
      console.error('Error fetching sprint data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIssuesForColumn = (columnId: string) => {
    return issues.filter(issue => issue.column_id === columnId)
  }

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    setDraggedIssue(issueId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedIssue || !selectedSprint) return

    const issueIdToMove = draggedIssue
    const oldColumnId = issues.find(issue => issue.issue_id === issueIdToMove)?.column_id

    if (oldColumnId === targetColumnId) {
      setDraggedIssue(null)
      return
    }

    // Optimistic UI update
    setIssues(prev => prev.map(issue =>
      issue.issue_id === issueIdToMove ? { ...issue, column_id: targetColumnId } : issue
    ))

    try {
      const response = await fetch('/api/sprint-board/move-issue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintId: selectedSprint.id,
          issueId: issueIdToMove,
          oldColumnId,
          newColumnId: targetColumnId
        })
      })

      if (!response.ok) {
        // Revert optimistic update if API call fails
        setIssues(prev => prev.map(issue =>
          issue.issue_id === issueIdToMove ? { ...issue, column_id: oldColumnId } : issue
        ))
        console.error('Failed to move issue:', await response.json())
      }
    } catch (err) {
      // Revert optimistic update on network error
      setIssues(prev => prev.map(issue =>
        issue.issue_id === issueIdToMove ? { ...issue, column_id: oldColumnId } : issue
      ))
      console.error('Error moving issue:', err)
    } finally {
      setDraggedIssue(null)
    }
  }

  const handleIssueClick = (sprintIssue: any) => {
    // Pass the raw sprint issue data directly, just like the product backlog does
    setSelectedIssue(sprintIssue)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedIssue(null)
    if (selectedSprint) {
      fetchSprintData()
    }
  }

  const handleSprintSave = async (sprintData: any) => {
    try {
      const response = await fetch('/api/sprint-board/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sprintData)
      })

      if (response.ok) {
        fetchSprints()
        setShowSettingsModal(false)
      }
    } catch (error) {
      console.error('Error creating sprint:', error)
    }
  }

  const handleSprintStatusUpdate = async (sprintId: string, status: string) => {
    try {
      const response = await fetch('/api/sprint-board/sprints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId, status })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        
        // Update the selected sprint status immediately
        if (selectedSprint?.id === sprintId) {
          setSelectedSprint(prev => prev ? { ...prev, status } : null)
        }
        
        // Refresh sprints list to get updated data
        fetchSprints()
      } else {
        console.error('❌ Failed to update sprint status:', data.error)
      }
    } catch (error) {
      console.error('❌ Error updating sprint status:', error)
    }
  }

  const handleMoveToBacklog = async (issueId: string) => {
    if (!selectedSprint) return

    const confirmed = window.confirm('Are you sure you want to move this issue back to the backlog?')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/sprint-board/remove-issue?sprintId=${selectedSprint.id}&issueId=${issueId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh sprint data to remove the issue
        fetchSprintData()
      } else {
        console.error('Failed to move issue to backlog')
      }
    } catch (error) {
      console.error('Error moving issue to backlog:', error)
    }
  }


  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'serious': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sprint board...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprint Board</h1>
            <p className="text-gray-600">Manage your accessibility sprints</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Sprint
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Sprint Selector */}
      {sprints.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Active Sprint:</label>
            <select
              value={selectedSprint?.id || ''}
              onChange={(e) => {
                const sprint = sprints.find(s => s.id === e.target.value)
                setSelectedSprint(sprint || null)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {sprints.map(sprint => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sprints.length === 0 && (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sprints Yet</h3>
            <p className="text-gray-500 mb-6">Create your first sprint to start managing accessibility issues</p>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Sprint
            </button>
          </div>
        </div>
      )}

      {/* Trello-Style Board */}
      {selectedSprint && (
        <div className="p-6">
          {/* Sprint Info */}
          <div className="mb-6 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedSprint.name}</h2>
                <p className="text-gray-600">{selectedSprint.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedSprint.start_date).toLocaleDateString()} - {new Date(selectedSprint.end_date).toLocaleDateString()}
                  </span>
                  {selectedSprint.goal && (
                    <span className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      {selectedSprint.goal}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{issues.length}</div>
                  <div className="text-sm text-gray-500">Total Issues</div>
                </div>
                
                {/* Sprint Status Management */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedSprint.status === 'planning' ? 'bg-blue-100 text-blue-800' :
                    selectedSprint.status === 'active' ? 'bg-green-100 text-green-800' :
                    selectedSprint.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    selectedSprint.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedSprint.status.charAt(0).toUpperCase() + selectedSprint.status.slice(1)}
                  </span>
                  
                  {/* Status Action Buttons */}
                  {selectedSprint.status === 'planning' && (
                    <button
                      onClick={() => handleSprintStatusUpdate(selectedSprint.id, 'active')}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Start Sprint
                    </button>
                  )}
                  
                  {selectedSprint.status === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSprintStatusUpdate(selectedSprint.id, 'completed')}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Complete Sprint
                      </button>
                      <button
                        onClick={() => handleSprintStatusUpdate(selectedSprint.id, 'cancelled')}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Cancel Sprint
                      </button>
                    </div>
                  )}
                  
                  {(selectedSprint.status === 'completed' || selectedSprint.status === 'cancelled') && (
                    <button
                      onClick={() => handleSprintStatusUpdate(selectedSprint.id, 'planning')}
                      className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Reset Sprint
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 300px)' }}>
            {columns.map(column => (
              <div
                key={column.id}
                className={`flex-shrink-0 w-72 bg-gray-200 rounded-lg ${
                  dragOverColumn === column.id ? 'ring-2 ring-blue-500 bg-blue-100' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="p-3 bg-white rounded-t-lg border-b border-gray-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: column.color }}
                      ></div>
                      <h3 className="font-semibold text-gray-900">{column.name}</h3>
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                        {getIssuesForColumn(column.id).length}
                      </span>
                    </div>
                    {column.wip_limit && (
                      <div className="text-xs text-gray-500">
                        {getIssuesForColumn(column.id).length}/{column.wip_limit}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column Content */}
                <div className="p-2 min-h-[400px]">
                  {getIssuesForColumn(column.id).map((sprintIssue, index) => (
                    <div
                      key={sprintIssue.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2 hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group"
                      draggable
                      onDragStart={(e) => handleDragStart(e, sprintIssue.issue_id)}
                      onClick={() => handleIssueClick(sprintIssue)}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                            {sprintIssue.rule_name}
                          </h4>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {sprintIssue.description}
                          </p>
                        </div>
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowIssueMenu(showIssueMenu === sprintIssue.issue_id ? null : sprintIssue.issue_id)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          
                          {showIssueMenu === sprintIssue.issue_id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMoveToBacklog(sprintIssue.issue_id)
                                    setShowIssueMenu(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Move to Backlog
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Tags */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getImpactColor(sprintIssue.impact)}`}>
                          {sprintIssue.impact.toUpperCase()}
                        </span>
                        {sprintIssue.story_points && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {sprintIssue.story_points} pts
                          </span>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>👁️ {sprintIssue.total_occurrences}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{new Date(sprintIssue.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty State */}
                  {getIssuesForColumn(column.id).length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-4xl mb-2">📋</div>
                      <p className="text-sm">No issues in this column</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
          </div>
        </div>
      )}

      {/* No Sprint State */}
      {!selectedSprint && sprints.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-6xl mb-4">🏃‍♂️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sprints Yet</h3>
            <p className="text-gray-600 mb-4">Create your first sprint to start managing accessibility issues</p>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Sprint
            </button>
          </div>
        </div>
      )}

      {/* Issue Details Modal */}
      <IssueDetailModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        issue={selectedIssue}
      />

      {/* Sprint Settings Modal */}
      <SprintSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSprintSave}
      />

    </div>
  )
}
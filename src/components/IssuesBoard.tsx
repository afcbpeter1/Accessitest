'use client'

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  BarChart3, 
  Filter, 
  TrendingUp, 
  Calendar, 
  User, 
  Tag, 
  MoreHorizontal,
  GripVertical,
  Eye
} from 'lucide-react'
import IssueDetailsModal from './IssueDetailsModal'
import { authenticatedFetch } from '@/lib/auth-utils'

interface Issue {
  id: string
  rule_name: string
  description: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  status: 'open' | 'in_progress' | 'resolved' | 'deferred' | 'duplicate'
  priority: 'critical' | 'high' | 'medium' | 'low'
  total_occurrences: number
  last_seen: string
  assignee_id?: string
  notes?: string
  labels?: Array<{ name: string; color: string }>
}

interface IssuesBoardProps {
  className?: string
}

export default function IssuesBoard({ className = '' }: IssuesBoardProps) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    impact: '',
    assignee: '',
    label: '',
    search: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sprints, setSprints] = useState<any[]>([])
  const [showSprintMenu, setShowSprintMenu] = useState<string | null>(null)

  useEffect(() => {
    console.log('IssuesBoard component mounted, fetching issues...')
    fetchIssues()
    fetchSprints()
  }, [filters, pagination.page])

  // Close sprint menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSprintMenu(null)
    }
    
    if (showSprintMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSprintMenu])

  // Debug: Log when issues state changes

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      })
      
      console.log('Fetching issues from:', `/api/issues-board?${queryParams}`)
      const response = await fetch(`/api/issues-board?${queryParams}`)
      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      if (data.success) {
        console.log('Setting issues:', data.data.issues)
        setIssues(data.data.issues || [])
        setPagination(data.data.pagination || pagination)
        console.log('Issues set:', data.data.issues?.length || 0)
        console.log('New issues data:', data.data.issues)
      } else {
        console.error('API returned error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSprints = async () => {
    try {
      const response = await authenticatedFetch('/api/sprint-board/sprints')
      const data = await response.json()
      
      if (data.success) {
        setSprints(data.data.sprints || [])
      }
    } catch (error) {
      console.error('Error fetching sprints:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    console.log('🚀 DRAG START:', issueId)
    setDraggedItem(issueId)
    setIsReordering(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', issueId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, issueId: string) => {
    e.preventDefault()
    console.log('🎯 DRAG ENTER:', issueId, 'draggedItem:', draggedItem)
    if (issueId !== draggedItem) {
      setDragOverItem(issueId)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverItem(null)
  }

  const handleDrop = async (e: React.DragEvent, targetIssueId: string) => {
    e.preventDefault()
    console.log('🎯 DROP EVENT FIRED:', draggedItem, 'onto:', targetIssueId)
    console.log('🎯 Current dragOverItem:', dragOverItem)
    
    if (!draggedItem || draggedItem === targetIssueId) {
      setDraggedItem(null)
      setDragOverItem(null)
      setIsReordering(false)
      return
    }

    const draggedIndex = issues.findIndex(issue => issue.id === draggedItem)
    const targetIndex = issues.findIndex(issue => issue.id === targetIssueId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null)
      setDragOverItem(null)
      setIsReordering(false)
      return
    }

    // Simple reordering - move dragged item to target position
    const newIssues = [...issues]
    const [draggedIssue] = newIssues.splice(draggedIndex, 1)
    newIssues.splice(targetIndex, 0, draggedIssue)
    
    
    // Batch state updates to prevent race conditions
    setIssues(newIssues)
    setRenderKey(prev => prev + 1)
    

    // Update database
    try {
      const rankUpdates = newIssues.map((issue, index) => ({
        issueId: issue.id,
        rank: index + 1
      }))

      await fetch('/api/issues-board/ranks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankUpdates })
      })
      
    } catch (error) {
      console.error('❌ Error updating ranks:', error)
    }

    // Reset drag state
    setDraggedItem(null)
    setDragOverItem(null)
    setIsReordering(false)
  }

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedIssue(null)
  }

  const handleIssueStatusChange = async (issueId: string, status: string, notes?: string, deferredReason?: string) => {
    // Update the issue in the local state
    setIssues(prevIssues => 
      prevIssues.map(issue => 
        issue.id === issueId 
          ? { ...issue, status, notes, deferredReason }
          : issue
      )
    )
    
    // Update in database
    try {
      await fetch('/api/issues-board/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, status, notes, deferredReason })
      })
    } catch (error) {
      console.error('Failed to update issue status:', error)
    }
  }

  const handleMoveToSprint = async (issueId: string, sprintId: string) => {
    try {
      const response = await authenticatedFetch('/api/sprint-board/move-issue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintId,
          issueId,
          columnId: null // Will be added to first column (To Do)
        })
      })

      if (response.ok) {
        setShowSprintMenu(null)
        // Optionally refresh the issues list
        fetchIssues()
      } else {
        console.error('❌ Failed to move issue to sprint')
      }
    } catch (error) {
      console.error('❌ Error moving issue to sprint:', error)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-800 bg-red-100 border-red-200'
      case 'serious': return 'text-orange-800 bg-orange-100 border-orange-200'
      case 'moderate': return 'text-yellow-800 bg-yellow-100 border-yellow-200'
      case 'minor': return 'text-blue-800 bg-blue-100 border-blue-200'
      default: return 'text-gray-800 bg-gray-100 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-800 bg-red-100 border-red-200'
      case 'in_progress': return 'text-blue-800 bg-blue-100 border-blue-200'
      case 'resolved': return 'text-green-800 bg-green-100 border-green-200'
      case 'deferred': return 'text-yellow-800 bg-yellow-100 border-yellow-200'
      case 'duplicate': return 'text-gray-800 bg-gray-100 border-gray-200'
      default: return 'text-gray-800 bg-gray-100 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-800 bg-red-100 border-red-200'
      case 'high': return 'text-orange-800 bg-orange-100 border-orange-200'
      case 'medium': return 'text-yellow-800 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-green-800 bg-green-100 border-green-200'
      default: return 'text-gray-800 bg-gray-100 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      case 'deferred': return <Clock className="h-4 w-4" />
      case 'duplicate': return <MoreHorizontal className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Backlog</h1>
            <p className="text-lg text-gray-600">Manage and prioritize accessibility issues across all scans</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full" aria-hidden="true"></div>
              <span>Centralized issue management for better accessibility</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-expanded={showFilters}
              aria-controls="filters-section"
              aria-label={`${showFilters ? 'Hide' : 'Show'} filters`}
            >
              <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
              Filters
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <section aria-label="Issues statistics" className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-label="Critical issues count">
          <div className="flex items-center">
            <div className="p-3 bg-red-500 rounded-xl shadow-sm" aria-hidden="true">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide">Critical Issues</p>
              <p className="text-3xl font-bold text-red-900 mt-1" aria-live="polite">
                {issues.filter(i => i.impact === 'critical').length}
              </p>
              <p className="text-xs text-red-600 mt-1">Requires immediate attention</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-label="Serious issues count">
          <div className="flex items-center">
            <div className="p-3 bg-orange-500 rounded-xl shadow-sm" aria-hidden="true">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Serious Issues</p>
              <p className="text-3xl font-bold text-orange-900 mt-1" aria-live="polite">
                {issues.filter(i => i.impact === 'serious').length}
              </p>
              <p className="text-xs text-orange-600 mt-1">High priority fixes</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-label="In progress issues count">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500 rounded-xl shadow-sm" aria-hidden="true">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">In Progress</p>
              <p className="text-3xl font-bold text-blue-900 mt-1" aria-live="polite">
                {issues.filter(i => i.status === 'in_progress').length}
              </p>
              <p className="text-xs text-blue-600 mt-1">Currently being fixed</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-label="Resolved issues count">
          <div className="flex items-center">
            <div className="p-3 bg-green-500 rounded-xl shadow-sm" aria-hidden="true">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Resolved</p>
              <p className="text-3xl font-bold text-green-900 mt-1" aria-live="polite">
                {issues.filter(i => i.status === 'resolved').length}
              </p>
              <p className="text-xs text-green-600 mt-1">Successfully fixed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      {showFilters && (
        <section id="filters-section" aria-label="Filter issues" className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="sr-only">Filter Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="deferred">Deferred</option>
                <option value="duplicate">Duplicate</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                id="priority-filter"
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter by priority"
              >
                <option value="">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label htmlFor="impact-filter" className="block text-sm font-medium text-gray-700 mb-2">Impact</label>
              <select
                id="impact-filter"
                value={filters.impact}
                onChange={(e) => setFilters({...filters, impact: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter by impact"
              >
                <option value="">All Impacts</option>
                <option value="critical">Critical</option>
                <option value="serious">Serious</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
              </select>
            </div>

            <div>
              <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <input
                  id="search-filter"
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  placeholder="Search issues..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Search issues"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Issues List */}
      <section aria-label="Issues list" className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading issues">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true"></div>
            <span className="ml-3 text-gray-600">Loading issues...</span>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-12" role="status" aria-label="No issues found">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
            <h2 className="mt-2 text-sm font-medium text-gray-900">No issues found</h2>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or run a new scan.</p>
            <p className="mt-2 text-xs text-gray-400">Debug: Issues count = {issues.length}</p>
          </div>
        ) : (
          <div key={renderKey} role="list" aria-label="Accessibility issues list" className="space-y-4">
            {issues.map((issue, index) => (
              <article 
                key={`${issue.id}-${index}`} 
                className={`bg-white rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 relative ${
                  draggedItem === issue.id ? 'opacity-30 scale-95 rotate-2 shadow-2xl border-blue-400' : ''
                } ${
                  dragOverItem === issue.id ? 'border-blue-400 bg-blue-50 shadow-lg scale-105 border-dashed ring-2 ring-blue-300' : ''
                } ${
                  isReordering && draggedItem !== issue.id ? 'pointer-events-auto' : ''
                }`}
                role="listitem"
                tabIndex={0}
                aria-label={`Issue ${index + 1}: ${issue.rule_name}`}
                draggable={true}
                onDragStart={(e) => {
                  console.log('🚀 DRAG START on issue:', issue.id)
                  handleDragStart(e, issue.id)
                }}
                onDragOver={(e) => {
                  handleDragOver(e)
                }}
                onDragEnter={(e) => {
                  console.log('🎯 DRAG ENTER on issue:', issue.id)
                  handleDragEnter(e, issue.id)
                }}
                onDragLeave={(e) => {
                  console.log('👋 DRAG LEAVE on issue:', issue.id)
                  handleDragLeave(e)
                }}
                onDrop={(e) => {
                  console.log('🎯 DROP on issue:', issue.id)
                  handleDrop(e, issue.id)
                }}
                onDragEnd={() => {
                  console.log('🏁 DRAG END')
                  // Reset drag state with a small delay to ensure it happens
                  setTimeout(() => {
                    setDraggedItem(null)
                    setDragOverItem(null)
                    setIsReordering(false)
                  }, 100)
                }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Row Number */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      
                      {/* Drag Handle */}
                      <div 
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 cursor-move rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <GripVertical className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 truncate">
                                {issue.rule_name}
                              </h3>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleIssueClick(issue)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowSprintMenu(showSprintMenu === issue.id ? null : issue.id)
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Move to sprint"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              
                              {showSprintMenu === issue.id && (
                                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
                                  <div className="p-2">
                                    <div className="text-xs font-medium text-gray-500 px-2 py-1">Move to Sprint</div>
                                    {sprints.length > 0 ? (
                                      sprints.map(sprint => (
                                        <button
                                          key={sprint.id}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleMoveToSprint(issue.id, sprint.id)
                                          }}
                                          className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                        >
                                          {sprint.name}
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-2 py-2 text-sm text-gray-500">No sprints available</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                              {issue.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3" role="group" aria-label="Issue metadata">
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getImpactColor(issue.impact)}`}
                            aria-label={`Impact: ${issue.impact}`}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                            {issue.impact.toUpperCase()}
                          </span>

                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}
                            aria-label={`Status: ${issue.status}`}
                          >
                            {getStatusIcon(issue.status)}
                            <span className="ml-1">{issue.status.replace('_', ' ').toUpperCase()}</span>
                          </span>

                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(issue.priority)}`}
                            aria-label={`Priority: ${issue.priority}`}
                          >
                            {issue.priority.toUpperCase()}
                          </span>

                          <span className="inline-flex items-center text-xs text-gray-500" aria-label={`Occurrences: ${issue.total_occurrences}`}>
                            <BarChart3 className="h-3 w-3 mr-1" aria-hidden="true" />
                            {issue.total_occurrences} occurrence{issue.total_occurrences !== 1 ? 's' : ''}
                          </span>

                          <span className="inline-flex items-center text-xs text-gray-500" aria-label={`Last seen: ${new Date(issue.last_seen).toLocaleDateString()}`}>
                            <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                            {new Date(issue.last_seen).toLocaleDateString()}
                          </span>

                          {issue.assignee_id && (
                            <span className="inline-flex items-center text-xs text-gray-500" aria-label={`Assigned to: ${issue.assignee_id}`}>
                              <User className="h-3 w-3 mr-1" aria-hidden="true" />
                              Assigned
                            </span>
                          )}

                          {issue.labels && issue.labels.length > 0 && (
                            <div className="flex items-center gap-1">
                              {issue.labels.map((label, labelIndex) => (
                                <span 
                                  key={labelIndex}
                                  className="inline-flex items-center text-xs text-gray-500" 
                                  aria-label={`Label: ${label.name}`}
                                >
                                  <Tag className="h-3 w-3 mr-1" aria-hidden="true" />
                                  {label.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="More actions"
                        aria-haspopup="menu"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <nav aria-label="Issues pagination" className="flex items-center justify-between">
          <div className="text-sm text-gray-700" aria-live="polite">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} issues
          </div>
          
          <div className="flex items-center gap-2" role="group" aria-label="Pagination controls">
            <button
              onClick={() => setPagination({...pagination, page: pagination.page - 1})}
              disabled={pagination.page === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
              aria-disabled={pagination.page === 1}
            >
              Previous
            </button>
            
            <span className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg" aria-current="page">
              {pagination.page}
            </span>
            
            <button
              onClick={() => setPagination({...pagination, page: pagination.page + 1})}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
              aria-disabled={pagination.page === pagination.totalPages}
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {/* Issue Details Modal */}
      <IssueDetailsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        issue={selectedIssue}
        onStatusChange={handleIssueStatusChange}
      />
    </div>
  )
}
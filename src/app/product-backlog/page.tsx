'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, MessageSquare, Copy, Trash2, Edit3, CheckCircle, Clock, XCircle, MoreHorizontal, ChevronDown, ExternalLink, CheckSquare } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import IssueDetailModal from '@/components/IssueDetailModal'
import { authenticatedFetch } from '@/lib/auth-utils'
import { useToast } from '@/components/Toast'

interface BacklogItem {
  id: string
  issue_id: string
  rule_name: string
  description: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  wcag_level: string
  element_selector?: string
  element_html?: string
  failure_summary?: string
  url: string
  domain: string
  story_points?: number
  priority_rank: number
  status: 'backlog' | 'in_progress' | 'done' | 'cancelled'
  created_at: string
  updated_at: string
  comment_count: number
  total_occurrences?: number
  last_scan_at?: string
}

interface Comment {
  id: string
  comment: string
  created_at: string
  user_email: string
}

interface Sprint {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: string
  goal?: string
}

const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'critical': return 'text-red-800 bg-red-50 border-red-200'
    case 'serious': return 'text-orange-800 bg-orange-50 border-orange-200'
    case 'moderate': return 'text-yellow-800 bg-yellow-50 border-yellow-200'
    case 'minor': return 'text-blue-800 bg-blue-50 border-blue-200'
    default: return 'text-gray-800 bg-gray-50 border-gray-200'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'backlog': return <Clock className="h-4 w-4 text-gray-500" />
    case 'in_progress': return <Edit3 className="h-4 w-4 text-blue-500" />
    case 'done': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />
    default: return <Clock className="h-4 w-4 text-gray-500" />
  }
}

export default function ProductBacklog() {
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showSprintDropdown, setShowSprintDropdown] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showIntegrationMenu, setShowIntegrationMenu] = useState<string | null>(null)
  const [jiraIntegration, setJiraIntegration] = useState<any>(null)
  const [syncingToJira, setSyncingToJira] = useState<string | null>(null)
  const [azureDevOpsIntegration, setAzureDevOpsIntegration] = useState<any>(null)
  const [syncingToAzureDevOps, setSyncingToAzureDevOps] = useState<string | null>(null)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchBacklogItems()
    fetchSprints()
    checkJiraIntegration()
    checkAzureDevOpsIntegration()
  }, [])

  // Close integration menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowIntegrationMenu(null)
    }
    
    if (showIntegrationMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showIntegrationMenu])

  const checkJiraIntegration = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/jira/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success && data.integration) {
        setJiraIntegration(data.integration)
      }
    } catch (error) {
      console.error('Failed to check Jira integration:', error)
    }
  }

  const checkAzureDevOpsIntegration = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/azure-devops/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success && data.integration) {
        setAzureDevOpsIntegration(data.integration)
      }
    } catch (error) {
      console.error('Failed to check Azure DevOps integration:', error)
    }
  }

  const handleAddToJira = async (item: BacklogItem) => {
    if (!item.issue_id) {
      showToast('Issue ID not found', 'error')
      return
    }

    setSyncingToJira(item.id)
    setShowIntegrationMenu(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        showToast('Authentication required', 'error')
        return
      }

      const response = await fetch('/api/jira/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ issueId: item.issue_id })
      })

      const data = await response.json()
      if (data.success) {
        if (data.existing) {
          showToast(`Already synced to Jira: ${data.ticket.key}`, 'success')
        } else {
          showToast(`Successfully added to Jira: ${data.ticket.key}`, 'success')
        }
        // Refresh backlog to show updated status
        fetchBacklogItems()
      } else {
        showToast(data.error || 'Failed to add to Jira', 'error')
      }
    } catch (error) {
      console.error('Error adding to Jira:', error)
      showToast('An unexpected error occurred', 'error')
    } finally {
      setSyncingToJira(null)
    }
  }

  const handleAddToAzureDevOps = async (item: BacklogItem) => {
    if (!item.issue_id) {
      showToast('Issue ID not found', 'error')
      return
    }

    setSyncingToAzureDevOps(item.id)
    setShowIntegrationMenu(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        showToast('Authentication required', 'error')
        return
      }

      const response = await fetch('/api/azure-devops/work-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ issueId: item.issue_id })
      })

      const data = await response.json()
      if (data.success) {
        if (data.existing) {
          showToast(`Already synced to Azure DevOps: Work Item #${data.workItem.id}`, 'success')
        } else {
          showToast(`Successfully added to Azure DevOps: Work Item #${data.workItem.id}`, 'success')
        }
        // Refresh backlog to show updated status
        fetchBacklogItems()
      } else {
        showToast(data.error || 'Failed to add to Azure DevOps', 'error')
      }
    } catch (error) {
      console.error('Error adding to Azure DevOps:', error)
      showToast('An unexpected error occurred', 'error')
    } finally {
      setSyncingToAzureDevOps(null)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSprintDropdown(null)
    }
    
    if (showSprintDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSprintDropdown])

  const fetchSprints = async () => {
    try {
      const response = await authenticatedFetch('/api/sprint-board/sprints')
      const data = await response.json()
      if (data.success) {
        setSprints(data.data.sprints)
      }
    } catch (error) {
      console.error('Failed to fetch sprints:', error)
    }
  }


  const fetchBacklogItems = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/backlog')
      const data = await response.json()
      if (data.success) {
        // Ensure we set ALL items - no filtering
        setBacklogItems(data.items || [])
        
        // Log diagnostics if available
        if (data.diagnostics) {

        }
      } else {
        console.error('❌ API returned success: false', data)
        setBacklogItems([])
      }
    } catch (error) {
      console.error('Error fetching backlog items:', error)
      setBacklogItems([])
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (itemId: string) => {
    try {
      const response = await authenticatedFetch(`/api/backlog/${itemId}/comments`)
      const data = await response.json()
      if (data.success) {
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) {
      return
    }

    const items = Array.from(backlogItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update ranks for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      rank: index + 1
    }))

    setBacklogItems(updatedItems)

    // Update all items' ranks in the database
    try {
      // Update all items with their new ranks
      const updatePromises = updatedItems.map((item, index) => {
        return authenticatedFetch(`/api/backlog/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priorityRank: index + 1 })
        })
      })

      const responses = await Promise.all(updatePromises)
      
      // Check if any updates failed
      const failedUpdates = responses.filter(response => !response.ok)
      if (failedUpdates.length > 0) {
        throw new Error(`Failed to update ${failedUpdates.length} items`)
      }
    } catch (error) {
      console.error('❌ Error updating ranks:', error)
      // Revert on error
      fetchBacklogItems()
    }
  }

  const updateStoryPoints = async (itemId: string, storyPoints: number) => {
    try {
      const response = await authenticatedFetch(`/api/backlog/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyPoints })
      })
      
      if (response.ok) {
        setBacklogItems(items => 
          items.map(item => 
            item.id === itemId ? { ...item, story_points: storyPoints } : item
          )
        )
      }
    } catch (error) {
      console.error('Error updating story points:', error)
    }
  }

  const updateStatus = async (itemId: string, status: string) => {
    try {
      const response = await authenticatedFetch(`/api/backlog/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        setBacklogItems(items => 
          items.map(item => 
            item.id === itemId ? { ...item, status: status as 'backlog' | 'in_progress' | 'done' | 'cancelled' } : item
          )
        )
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleMoveToSprint = async (itemId: string, sprintId: string) => {
    try {
      // First, get the "To Do" column ID for this sprint
      const columnsResponse = await authenticatedFetch(`/api/sprint-board/columns?sprintId=${sprintId}`)
      const columnsData = await columnsResponse.json()
      
      if (!columnsData.success || columnsData.data.columns.length === 0) {
        console.error('Failed to get sprint columns')
        return
      }
      
      // Find the "To Do" column (first column)
      const todoColumn = columnsData.data.columns.find((col: any) => col.name === 'To Do') || columnsData.data.columns[0]
      
      const response = await authenticatedFetch('/api/sprint-board/move-issue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintId,
          issueId: itemId,
          columnId: todoColumn.id
        })
      })

      if (response.ok) {
        setShowSprintDropdown(null)
        // Refresh backlog to remove the moved item
        fetchBacklogItems()
      } else {
        const errorData = await response.json()
        console.error('Failed to move issue to sprint:', errorData)
      }
    } catch (error) {
      console.error('Error moving issue to sprint:', error)
    }
  }

  const addComment = async () => {
    if (!selectedItem || !newComment.trim()) return

    try {
      const response = await authenticatedFetch(`/api/backlog/${selectedItem.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment.trim() })
      })
      
      if (response.ok) {
        setNewComment('')
        fetchComments(selectedItem.id)
        fetchBacklogItems() // Refresh to update comment count
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const copyTicket = (item: BacklogItem) => {
    const ticketText = `
**Accessibility Issue Ticket**

**Rule:** ${item.rule_name}
**Impact:** ${item.impact.toUpperCase()}
**WCAG Level:** ${item.wcag_level}
**URL:** ${item.url}
**Element:** ${item.element_selector || 'N/A'}

**Description:**
${item.description}

**Failure Summary:**
${item.failure_summary || 'N/A'}

**Story Points:** ${item.story_points || 'Not assigned'}
**Status:** ${item.status}

**HTML Element:**
\`\`\`html
${item.element_html || 'N/A'}
\`\`\`

---
*Generated from AccessiTest Product Backlog*
    `.trim()

    navigator.clipboard.writeText(ticketText)
    showToast('Ticket copied to clipboard!', 'success')
  }

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId)
    setShowDeleteConfirm(true)
  }

  const deleteItem = async (itemId: string) => {
    try {
      const response = await authenticatedFetch(`/api/backlog/${itemId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from UI immediately
        setBacklogItems(items => items.filter(item => item.id !== itemId))
        
        // Remove from selected items if it was selected
        setSelectedItems(prev => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
        
        // Close modal if this item was selected
        if (selectedItem?.id === itemId) {
          setSelectedItem(null)
          setShowComments(false)
        }
        
        // Show success toast
        showToast('Backlog item deleted successfully!', 'success')
      } else {
        const errorData = await response.json()
        showToast(`Failed to delete item: ${errorData.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      showToast('Failed to delete item. Please try again.', 'error')
    } finally {
      setShowDeleteConfirm(false)
      setItemToDelete(null)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(backlogItems.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleItemSelect = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return

    try {
      const itemIds = Array.from(selectedItems)
      const response = await authenticatedFetch('/api/backlog/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemIds })
      })
      
      if (response.ok) {
        // Remove from UI immediately
        setBacklogItems(items => items.filter(item => !selectedItems.has(item.id)))
        
        // Clear selected items
        setSelectedItems(new Set())
        
        // Close modal if any selected item was open
        if (selectedItem && selectedItems.has(selectedItem.id)) {
          setSelectedItem(null)
          setShowComments(false)
        }
        
        // Show success toast
        showToast(`${itemIds.length} backlog item(s) deleted successfully!`, 'success')
      } else {
        const errorData = await response.json()
        showToast(`Failed to delete items: ${errorData.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting items:', error)
      showToast('Failed to delete items. Please try again.', 'error')
    } finally {
      setShowBulkDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Sidebar>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading product backlog...</p>
            </div>
          </div>
        </Sidebar>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Sidebar>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Backlog</h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                Manage accessibility issues from your scans and organize them into sprints.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Backlog Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={backlogItems.length > 0 && selectedItems.size === backlogItems.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        title="Select all"
                      />
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        Backlog Items ({backlogItems.length})
                      </h2>
                      {selectedItems.size > 0 && (
                        <span className="text-sm text-gray-600">
                          ({selectedItems.size} selected)
                        </span>
                      )}
                    </div>
                    {selectedItems.size > 0 && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected ({selectedItems.size})
                      </button>
                    )}
                  </div>
                  
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="backlog">
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="divide-y divide-gray-200"
                        >
                          {backlogItems.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                              No backlog items found. Check the console for debug info.
                            </div>
                          ) : (
                            backlogItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-4 sm:p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                                    snapshot.isDragging ? 'bg-blue-50 shadow-lg' : ''
                                  } ${selectedItems.has(item.id) ? 'bg-blue-50' : ''}`}
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setShowDetailModal(true)
                                  }}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.id)}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          handleItemSelect(item.id, e.target.checked)
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                        title="Select item"
                                      />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-gray-500 flex-shrink-0">
                                          #{index + 1}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full border flex-shrink-0 whitespace-nowrap ${getImpactColor(item.impact)}`}>
                                          {item.impact.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                          {item.wcag_level}
                                        </span>
                                        {/* Show duplicate indicator if this issue appears multiple times */}
                                        {item.total_occurrences && item.total_occurrences > 1 && (
                                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full border border-purple-200 inline-flex items-center gap-1 whitespace-nowrap" title={`This issue appears ${item.total_occurrences} times`}>
                                            <span>🔄</span>
                                            <span>Duplicate ({item.total_occurrences}x)</span>
                                          </span>
                                        )}
                                      </div>
                                      
                                      <h3 className="font-medium text-gray-900 mb-1 break-words">
                                        {item.rule_name}
                                        {item.total_occurrences && item.total_occurrences > 1 && (
                                          <span className="ml-2 text-xs font-normal text-purple-600">
                                            (appears {item.total_occurrences} times)
                                          </span>
                                        )}
                                      </h3>
                                      
                                      <p className="text-sm text-gray-600 mb-3 break-words">
                                        {item.description}
                                      </p>
                                      
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                                        <span className="truncate max-w-full">Domain: {item.domain}</span>
                                        <span>•</span>
                                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                        {item.last_scan_at && (
                                          <>
                                            <span>•</span>
                                            <span className="text-blue-600">Auto-created</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 flex-wrap">
                                      {/* Story Points Display */}
                                      <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <span className="font-medium">Points:</span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                                          {item.story_points || 1}
                                        </span>
                                      </div>
                                      
                                      {/* Actions - touch-friendly min size */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedItem(item)
                                          setShowComments(true)
                                          fetchComments(item.id)
                                        }}
                                        className="p-2 sm:p-1 text-gray-400 hover:text-blue-600 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                        title="Comments"
                                        aria-label="Comments"
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyTicket(item)
                                        }}
                                        className="p-2 sm:p-1 text-gray-400 hover:text-green-600 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                        title="Copy Ticket"
                                        aria-label="Copy ticket"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteClick(item.id)
                                        }}
                                        className="p-2 sm:p-1 text-gray-400 hover:text-red-600 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                        title="Delete"
                                        aria-label="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                      
                                      {/* Integration Menu (Jira/Azure DevOps) */}
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setShowIntegrationMenu(showIntegrationMenu === item.id ? null : item.id)
                                            setShowSprintDropdown(null) // Close sprint dropdown if open
                                          }}
                                          className="p-2 sm:p-1 text-gray-400 hover:text-blue-600 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center disabled:opacity-50"
                                          title="Add to Integration"
                                          disabled={syncingToJira === item.id || syncingToAzureDevOps === item.id}
                                          aria-label="Add to Jira or Azure DevOps"
                                        >
                                          {(syncingToJira === item.id || syncingToAzureDevOps === item.id) ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                          ) : (
                                            <MoreHorizontal className="h-4 w-4" />
                                          )}
                                        </button>
                                        
                                        {showIntegrationMenu === item.id && (
                                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48">
                                            <div className="py-1">
                                              {jiraIntegration ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAddToJira(item)
                                                  }}
                                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                  <ExternalLink className="h-4 w-4" />
                                                  <span>Add to Jira</span>
                                                </button>
                                              ) : (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                  <div>Jira not configured</div>
                                                  <a href="/settings?tab=integrations" className="text-blue-600 hover:underline">
                                                    Set up in settings
                                                  </a>
                                                </div>
                                              )}
                                              {azureDevOpsIntegration ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAddToAzureDevOps(item)
                                                  }}
                                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                                                  disabled={syncingToAzureDevOps === item.id}
                                                >
                                                  <ExternalLink className="h-4 w-4" />
                                                  <span>Add to Azure DevOps</span>
                                                </button>
                                              ) : (
                                                <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                                                  <div>Azure DevOps not configured</div>
                                                  <a href="/settings?tab=integrations" className="text-blue-600 hover:underline">
                                                    Set up in settings
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Sprint Assignment Dropdown */}
                                      {sprints.length > 0 && (
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setShowSprintDropdown(showSprintDropdown === item.id ? null : item.id)
                                              setShowIntegrationMenu(null) // Close integration menu if open
                                            }}
                                            className="p-2 sm:p-1 text-gray-400 hover:text-purple-600 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                            title="Move to Sprint"
                                            aria-label="Move to sprint"
                                          >
                                            <ChevronDown className="h-4 w-4" />
                                          </button>
                                          
                                          {showSprintDropdown === item.id && (
                                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
                                              <div className="p-2 border-b border-gray-100">
                                                <div className="text-xs font-medium text-gray-700">Move to Sprint</div>
                                              </div>
                                              <div className="py-1">
                                                {sprints.map((sprint) => (
                                                  <button
                                                    key={sprint.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleMoveToSprint(item.id, sprint.id)
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                                  >
                                                    <div>
                                                      <div className="font-medium">{sprint.name}</div>
                                                      <div className="text-xs text-gray-500 capitalize">{sprint.status}</div>
                                                    </div>
                                                    <ChevronDown className="h-3 w-3 text-gray-400" />
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>

              {/* Comments Panel */}
              <div className="lg:col-span-1">
                {selectedItem && showComments ? (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
                        <button
                          onClick={() => setShowComments(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedItem.rule_name}
                      </p>
                    </div>
                    
                    <div className="p-6">
                      {/* Add Comment */}
                      <div className="mb-4">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                          rows={3}
                        />
                        <button
                          onClick={addComment}
                          disabled={!newComment.trim()}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Comment
                        </button>
                      </div>
                      
                      {/* Comments List */}
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="border-l-4 border-blue-200 pl-4">
                            <div className="text-sm text-gray-600 mb-1">
                              {comment.user_email} • {new Date(comment.created_at).toLocaleString()}
                            </div>
                            <p className="text-gray-900">{comment.comment}</p>
                          </div>
                        ))}
                        
                        {comments.length === 0 && (
                          <p className="text-gray-500 text-sm">No comments yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-6 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Comments</h3>
                    <p className="text-gray-600">
                      Select a backlog item to view and add comments
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Issue Detail Modal */}
        <IssueDetailModal
          issue={selectedItem}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedItem(null)
          }}
          onUpdate={(issueId, updates) => {
            // Update the issue in the backlog
            setBacklogItems(items => 
              items.map(item => 
                item.id === issueId 
                  ? { ...item, ...updates }
                  : item
              )
            )
          }}
        />
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowDeleteConfirm(false)}></div>
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">Delete Backlog Item</h3>
                    </div>
                  </div>
                  <div className="mb-6">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this backlog item? This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => itemToDelete && deleteItem(itemToDelete)}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowBulkDeleteConfirm(false)}></div>
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">Delete Selected Items</h3>
                    </div>
                  </div>
                  <div className="mb-6">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete {selectedItems.size} backlog item(s)? This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowBulkDeleteConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Delete {selectedItems.size} Item(s)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Toast Notifications */}
        <ToastContainer />
      </Sidebar>
    </ProtectedRoute>
  )
}
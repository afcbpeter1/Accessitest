'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, MessageSquare, Copy, Trash2, Edit3, CheckCircle, Clock, XCircle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'

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
}

interface Comment {
  id: string
  comment: string
  created_at: string
  user_email: string
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

  useEffect(() => {
    fetchBacklogItems()
  }, [])

  const fetchBacklogItems = async () => {
    try {
      const response = await fetch('/api/backlog')
      const data = await response.json()
      if (data.success) {
        setBacklogItems(data.items)
      }
    } catch (error) {
      console.error('Error fetching backlog items:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (itemId: string) => {
    try {
      const response = await fetch(`/api/backlog/${itemId}/comments`)
      const data = await response.json()
      if (data.success) {
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(backlogItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update priority ranks
    const updatedItems = items.map((item, index) => ({
      ...item,
      priority_rank: index + 1
    }))

    setBacklogItems(updatedItems)

    // Update the moved item's priority rank
    try {
      await fetch(`/api/backlog/${reorderedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityRank: result.destination.index + 1 })
      })
    } catch (error) {
      console.error('Error updating priority rank:', error)
      // Revert on error
      fetchBacklogItems()
    }
  }

  const updateStoryPoints = async (itemId: string, storyPoints: number) => {
    try {
      const response = await fetch(`/api/backlog/${itemId}`, {
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
      const response = await fetch(`/api/backlog/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        setBacklogItems(items => 
          items.map(item => 
            item.id === itemId ? { ...item, status } : item
          )
        )
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const addComment = async () => {
    if (!selectedItem || !newComment.trim()) return

    try {
      const response = await fetch(`/api/backlog/${selectedItem.id}/comments`, {
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
    alert('Ticket copied to clipboard!')
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this backlog item?')) return

    try {
      const response = await fetch(`/api/backlog/${itemId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setBacklogItems(items => items.filter(item => item.id !== itemId))
        if (selectedItem?.id === itemId) {
          setSelectedItem(null)
          setShowComments(false)
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error)
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
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Product Backlog</h1>
              <p className="mt-2 text-gray-600">
                Automated ticketing system for accessibility issues. Issues are automatically created from scans and can be moved to sprints.
              </p>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">Automated Ticketing</h3>
                    <p className="text-sm text-blue-700">
                      Issues are automatically created when scans detect new problems. Previously fixed issues that return after 7+ days will be reopened.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Backlog Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Backlog Items ({backlogItems.length})
                    </h2>
                  </div>
                  
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="backlog">
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="divide-y divide-gray-200"
                        >
                          {backlogItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-6 hover:bg-gray-50 transition-colors ${
                                    snapshot.isDragging ? 'bg-blue-50 shadow-lg' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm font-medium text-gray-500">
                                          #{index + 1}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(item.impact)}`}>
                                          {item.impact.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {item.wcag_level}
                                        </span>
                                      </div>
                                      
                                      <h3 className="font-medium text-gray-900 mb-1">
                                        {item.rule_name}
                                      </h3>
                                      
                                      <p className="text-sm text-gray-600 mb-3">
                                        {item.description}
                                      </p>
                                      
                                      <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Domain: {item.domain}</span>
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
                                    
                                    <div className="flex items-center gap-2 ml-4">
                                      {/* Story Points */}
                                      <select
                                        value={item.story_points || ''}
                                        onChange={(e) => updateStoryPoints(item.id, parseInt(e.target.value) || 0)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1"
                                      >
                                        <option value="">Points</option>
                                        {FIBONACCI_POINTS.map(point => (
                                          <option key={point} value={point}>{point}</option>
                                        ))}
                                      </select>
                                      
                                      {/* Status */}
                                      <select
                                        value={item.status}
                                        onChange={(e) => updateStatus(item.id, e.target.value)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1"
                                      >
                                        <option value="backlog">Backlog</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="done">Done</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>
                                      
                                      {/* Actions */}
                                      <button
                                        onClick={() => {
                                          setSelectedItem(item)
                                          setShowComments(true)
                                          fetchComments(item.id)
                                        }}
                                        className="p-1 text-gray-400 hover:text-blue-600"
                                        title="Comments"
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </button>
                                      
                                      <button
                                        onClick={() => copyTicket(item)}
                                        className="p-1 text-gray-400 hover:text-green-600"
                                        title="Copy Ticket"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                      
                                      <button
                                        onClick={() => deleteItem(item.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
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
      </Sidebar>
    </ProtectedRoute>
  )
}
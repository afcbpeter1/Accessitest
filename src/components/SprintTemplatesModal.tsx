'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Calendar, Settings, Clock, Repeat, Play, Pause, Trash2, Edit } from 'lucide-react'
import { authenticatedFetch } from '../lib/auth-utils'

interface SprintTemplate {
  id: string
  name: string
  description: string
  duration_days: number
  recurrence_type: 'none' | 'weekly' | 'biweekly' | 'monthly'
  auto_create: boolean
  advance_creation_days: number
  default_goal: string
  is_active: boolean
  sprint_count: number
  created_at: string
  updated_at: string
}

interface SprintTemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSprintCreated?: () => void
}

export default function SprintTemplatesModal({ isOpen, onClose, onSprintCreated }: SprintTemplatesModalProps) {
  const [templates, setTemplates] = useState<SprintTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SprintTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_days: 14,
    recurrence_type: 'none' as 'none' | 'weekly' | 'biweekly' | 'monthly',
    auto_create: false,
    advance_creation_days: 7,
    default_goal: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
    }
  }, [isOpen])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/sprint-templates')
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.data.templates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/sprint-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowCreateForm(false)
        setFormData({
          name: '',
          description: '',
          duration_days: 14,
          recurrence_type: 'none',
          auto_create: false,
          advance_creation_days: 7,
          default_goal: ''
        })
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error creating template:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/sprint-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editingTemplate.id,
          ...formData
        })
      })

      if (response.ok) {
        setEditingTemplate(null)
        setFormData({
          name: '',
          description: '',
          duration_days: 14,
          recurrence_type: 'none',
          auto_create: false,
          advance_creation_days: 7,
          default_goal: ''
        })
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error updating template:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await authenticatedFetch(`/api/sprint-templates?templateId=${templateId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleCreateSprint = async (template: SprintTemplate) => {
    try {
      const startDate = new Date().toISOString().split('T')[0]
      const response = await authenticatedFetch('/api/sprint-templates/create-sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          startDate
        })
      })

      if (response.ok) {
        onSprintCreated?.()
        onClose()
      }
    } catch (error) {
      console.error('Error creating sprint:', error)
    }
  }

  const startEditing = (template: SprintTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description,
      duration_days: template.duration_days,
      recurrence_type: template.recurrence_type as 'none' | 'weekly' | 'biweekly' | 'monthly',
      auto_create: template.auto_create,
      advance_creation_days: template.advance_creation_days,
      default_goal: template.default_goal
    })
  }

  const getRecurrenceLabel = (type: string) => {
    switch (type) {
      case 'weekly': return 'Weekly'
      case 'biweekly': return 'Bi-weekly'
      case 'monthly': return 'Monthly'
      default: return 'None'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Sprint Templates</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your sprint templates and auto-creation settings</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Templates List */}
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900">{template.name}</h4>
                          {template.auto_create && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Repeat className="h-3 w-3 mr-1" />
                              Auto-create
                            </span>
                          )}
                          {!template.is_active && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        {template.description && (
                          <p className="text-gray-600 mt-1">{template.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {template.duration_days} days
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {getRecurrenceLabel(template.recurrence_type)}
                          </div>
                          <div className="flex items-center">
                            <Settings className="h-4 w-4 mr-1" />
                            {template.sprint_count} sprints created
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCreateSprint(template)}
                          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Create Sprint
                        </button>
                        <button
                          onClick={() => startEditing(template)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {templates.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
                    <p className="text-gray-600 mb-4">Create your first sprint template to get started</p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </button>
                  </div>
                )}
              </div>

              {/* Create/Edit Form */}
              {(showCreateForm || editingTemplate) && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Weekly Sprint"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                      <input
                        type="number"
                        value={formData.duration_days}
                        onChange={(e) => setFormData({...formData, duration_days: parseInt(e.target.value) || 14})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="365"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
                      <select
                        value={formData.recurrence_type}
                        onChange={(e) => setFormData({...formData, recurrence_type: e.target.value as any})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Advance Creation (days)</label>
                      <input
                        type="number"
                        value={formData.advance_creation_days}
                        onChange={(e) => setFormData({...formData, advance_creation_days: parseInt(e.target.value) || 7})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="30"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Goal</label>
                      <textarea
                        value={formData.default_goal}
                        onChange={(e) => setFormData({...formData, default_goal: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Default sprint goal"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.auto_create}
                          onChange={(e) => setFormData({...formData, auto_create: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Automatically create new sprints</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingTemplate(null)
                        setFormData({
                          name: '',
                          description: '',
                          duration_days: 14,
                          recurrence_type: 'none',
                          auto_create: false,
                          advance_creation_days: 7,
                          default_goal: ''
                        })
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                      disabled={loading || !formData.name}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

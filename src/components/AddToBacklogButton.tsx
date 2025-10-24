'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

interface AddToBacklogButtonProps {
  issue: {
    id: string
    rule_name: string
    description: string
    impact: string
    wcag_level: string
    element_selector?: string
    element_html?: string
    failure_summary?: string
    url: string
    domain: string
  }
  onAdd: (issue: any) => void
}

export default function AddToBacklogButton({ issue, onAdd }: AddToBacklogButtonProps) {
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToBacklog = async () => {
    setIsAdding(true)
    try {
      await onAdd(issue)
    } catch (error) {
      console.error('Error adding to backlog:', error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <button
      onClick={handleAddToBacklog}
      disabled={isAdding}
      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Plus className="h-4 w-4 mr-1.5" />
      {isAdding ? 'Adding...' : 'Add to Backlog'}
    </button>
  )
}

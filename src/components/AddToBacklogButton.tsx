'use client'

import { useState } from 'react'
import { Plus, Check } from 'lucide-react'

interface AddToBacklogButtonProps {
  issueId: string
  onAdd?: (issueId: string) => void
  className?: string
}

export default function AddToBacklogButton({ issueId, onAdd, className = '' }: AddToBacklogButtonProps) {
  const [isAdded, setIsAdded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleAdd = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setIsAdded(true)
      if (onAdd) {
        onAdd(issueId)
      }
      
      // Reset after 2 seconds
      setTimeout(() => {
        setIsAdded(false)
      }, 2000)
    } catch (error) {
      console.error('Error adding to backlog:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isLoading || isAdded}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        isAdded
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      ) : isAdded ? (
        <Check className="w-4 h-4" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {isAdded ? 'Added' : 'Add to Backlog'}
    </button>
  )
}

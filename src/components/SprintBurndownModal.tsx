'use client'

import { useState, useEffect } from 'react'
import SprintBurndownChart from './SprintBurndownChart'
import { authenticatedFetch } from '@/lib/auth-utils'

interface Sprint {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

interface SprintBurndownModalProps {
  isOpen: boolean
  onClose: () => void
  sprint: Sprint | null
  refreshTrigger?: number
}

export default function SprintBurndownModal({ isOpen, onClose, sprint, refreshTrigger: externalRefreshTrigger }: SprintBurndownModalProps) {
  const [totalStoryPoints, setTotalStoryPoints] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (isOpen && sprint) {
      fetchSprintStoryPoints()
    }
  }, [isOpen, sprint])

  // Refresh data when modal is opened (in case sprint data changed)
  useEffect(() => {
    if (isOpen) {
      fetchSprintStoryPoints()
      // Trigger burndown chart refresh
      setRefreshTrigger(prev => prev + 1)
    }
  }, [isOpen])

  // Handle external refresh trigger (when issues are moved)
  useEffect(() => {
    if (externalRefreshTrigger && externalRefreshTrigger > 0) {
      fetchSprintStoryPoints()
      setRefreshTrigger(prev => prev + 1)
    }
  }, [externalRefreshTrigger])

  const fetchSprintStoryPoints = async () => {
    if (!sprint) return

    try {
      setLoading(true)
      const response = await authenticatedFetch(`/api/sprint-board/issues?sprintId=${sprint.id}`)
      const data = await response.json()

      if (data.success) {
        // Calculate total story points from sprint issues
        const totalPoints = data.data.issues.reduce((sum: number, issue: any) => {
          return sum + (issue.story_points || 0)
        }, 0)
        setTotalStoryPoints(totalPoints)
      }
    } catch (error) {
      console.error('Error fetching sprint story points:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !sprint) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>
        
        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading sprint data...</p>
                </div>
              </div>
            ) : (
              <SprintBurndownChart
                sprintId={sprint.id}
                sprintName={sprint.name}
                startDate={sprint.start_date}
                endDate={sprint.end_date}
                totalStoryPoints={totalStoryPoints}
                onClose={onClose}
                refreshTrigger={refreshTrigger}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

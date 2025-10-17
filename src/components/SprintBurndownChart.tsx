'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface BurndownDataPoint {
  day: number
  date: string
  ideal: number
  actual: number
  completed: number
}

interface SprintBurndownChartProps {
  sprintId: string
  sprintName: string
  startDate: string
  endDate: string
  totalStoryPoints: number
  onClose: () => void
  refreshTrigger?: number // Add this to trigger refreshes
}

export default function SprintBurndownChart({ 
  sprintId, 
  sprintName, 
  startDate, 
  endDate, 
  totalStoryPoints,
  onClose,
  refreshTrigger
}: SprintBurndownChartProps) {
  const [burndownData, setBurndownData] = useState<BurndownDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refresh burndown data when component mounts, sprintId changes, or refreshTrigger changes
  useEffect(() => {
    if (sprintId) {
      fetchBurndownData()
    }
  }, [sprintId, refreshTrigger])

  const fetchBurndownData = async () => {
    try {
      setLoading(true)
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now()
      const response = await fetch(`/api/sprint-board/burndown?sprintId=${sprintId}&totalStoryPoints=${totalStoryPoints}&t=${timestamp}`)
      const data = await response.json()

      if (data.success) {
        console.log('📊 Burndown chart data received:', {
          sprintId,
          totalStoryPoints,
          burndownData: data.data.burndownData,
          latestData: data.data.burndownData[data.data.burndownData.length - 1],
          allData: data.data.burndownData.map((d: any, i: number) => ({ day: d.day, actual: d.actual, completed: d.completed, ideal: d.ideal }))
        })
        setBurndownData(data.data.burndownData)
      } else {
        setError(data.error || 'Failed to fetch burndown data')
      }
    } catch (err) {
      setError('Error fetching burndown data')
      console.error('Error fetching burndown data:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateIdealBurndown = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    const idealData: BurndownDataPoint[] = []
    
    for (let day = 0; day <= totalDays; day++) {
      const currentDate = new Date(start)
      currentDate.setDate(start.getDate() + day)
      
      const idealRemaining = Math.max(0, totalStoryPoints - (totalStoryPoints * day / totalDays))
      
      idealData.push({
        day,
        date: currentDate.toISOString().split('T')[0],
        ideal: Math.round(idealRemaining),
        actual: 0, // Will be filled from API data
        completed: 0
      })
    }
    
    return idealData
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getCurrentDay = () => {
    const start = new Date(startDate)
    const today = new Date()
    const diffTime = today.getTime() - start.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading burndown chart...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">⚠️ {error}</div>
        <button 
          onClick={fetchBurndownData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const chartData = burndownData.length > 0 ? burndownData : generateIdealBurndown()

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sprint Burndown Chart</h2>
          <p className="text-gray-600">{sprintName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBurndownData}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>


      {/* Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Burndown Progress</h3>
        <div className="w-full" style={{ height: '320px', minHeight: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="day" 
                tickFormatter={(value) => `Day ${value}`}
                domain={[0, 'dataMax']}
              />
              <YAxis 
                label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }}
                domain={[0, totalStoryPoints]}
              />
              <Tooltip 
                labelFormatter={(value, payload) => {
                  if (payload && payload[0]) {
                    return `Day ${value} - ${formatDate(payload[0].payload.date)}`
                  }
                  return `Day ${value}`
                }}
                formatter={(value, name) => [
                  `${value} story points`,
                  name
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ideal" 
                stroke="#94a3b8" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Target"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="Actual"
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sprint Info */}
      <div className="grid grid-cols-1 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="font-medium text-gray-900">Total Story Points</div>
          <div className="text-2xl font-bold text-blue-600">{totalStoryPoints}</div>
        </div>
      </div>

      {/* Sprint Dates */}
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Sprint Duration:</strong> {formatDate(startDate)} - {formatDate(endDate)}</p>
        <p><strong>Current Day:</strong> Day {getCurrentDay()} of {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}</p>
      </div>
    </div>
  )
}

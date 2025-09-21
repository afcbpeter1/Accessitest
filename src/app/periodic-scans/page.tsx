'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, Globe, Bell, Settings, Play, Pause, Trash2, Edit, Eye } from 'lucide-react'
import PeriodicScanModal from '@/components/PeriodicScanModal'

interface PeriodicScan {
  id: string
  scan_type: string
  scan_title: string
  url?: string
  file_name?: string
  frequency: string
  scheduled_date: string
  scheduled_time: string
  timezone: string
  status: string
  next_run_at: string
  run_count: number
  execution_count: number
  last_completed_at?: string
  notify_on_completion: boolean
  notify_on_failure: boolean
  email_notifications: boolean
  created_at: string
}

export default function PeriodicScansPage() {
  const [scans, setScans] = useState<PeriodicScan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingScan, setEditingScan] = useState<PeriodicScan | null>(null)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'running' | 'paused' | 'completed'>('all')

  useEffect(() => {
    fetchScans()
  }, [])

  const fetchScans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/periodic-scans')
      const data = await response.json()
      
      if (data.success) {
        setScans(data.data.periodicScans)
      } else {
        console.error('Failed to fetch scans:', data.error)
      }
    } catch (error) {
      console.error('Error fetching scans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveScan = async (scanData: any) => {
    try {
      const url = editingScan ? `/api/periodic-scans/${editingScan.id}` : '/api/periodic-scans'
      const method = editingScan ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanData)
      })

      if (response.ok) {
        fetchScans()
        setShowModal(false)
        setEditingScan(null)
      } else {
        const error = await response.json()
        console.error('Failed to save scan:', error)
      }
    } catch (error) {
      console.error('Error saving scan:', error)
    }
  }

  const handleEditScan = (scan: PeriodicScan) => {
    setEditingScan(scan)
    setShowModal(true)
  }

  const handleDeleteScan = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this periodic scan?')) return

    try {
      const response = await fetch(`/api/periodic-scans/${scanId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchScans()
      } else {
        console.error('Failed to delete scan')
      }
    } catch (error) {
      console.error('Error deleting scan:', error)
    }
  }

  const handleToggleStatus = async (scanId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'scheduled' ? 'paused' : 'scheduled'
    
    try {
      const response = await fetch(`/api/periodic-scans/${scanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchScans()
      } else {
        console.error('Failed to update scan status')
      }
    } catch (error) {
      console.error('Error updating scan status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-green-100 text-green-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'once': return 'Once'
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      case 'custom': return 'Custom'
      default: return frequency
    }
  }

  const formatNextRun = (nextRunAt: string) => {
    if (!nextRunAt) return 'Not scheduled'
    const date = new Date(nextRunAt)
    return date.toLocaleString()
  }

  const filteredScans = scans.filter(scan => {
    if (filter === 'all') return true
    return scan.status === filter
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-medium text-gray-700">Loading periodic scans...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Periodic Scans</h1>
              <p className="text-gray-600">Schedule automated accessibility scans</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Schedule Scan
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-2 mb-6">
          {[
            { value: 'all', label: 'All' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'running', label: 'Running' },
            { value: 'paused', label: 'Paused' },
            { value: 'completed', label: 'Completed' }
          ].map(filterOption => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value as any)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterOption.value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {/* Scans List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {filteredScans.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No periodic scans</h3>
              <p className="text-gray-500 mb-4">Get started by scheduling your first automated scan</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Schedule Your First Scan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredScans.map(scan => (
                <div key={scan.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{scan.scan_title}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                          {scan.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getFrequencyLabel(scan.frequency)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          <span>{scan.url || scan.file_name || 'N/A'}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>Next: {formatNextRun(scan.next_run_at)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Bell className="h-4 w-4" />
                          <span>Runs: {scan.run_count}</span>
                        </div>
                        
                        {scan.last_completed_at && (
                          <div className="flex items-center gap-1">
                            <Settings className="h-4 w-4" />
                            <span>Last: {new Date(scan.last_completed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(scan.id, scan.status)}
                        className={`p-2 rounded-lg transition-colors ${
                          scan.status === 'scheduled' 
                            ? 'text-yellow-600 hover:bg-yellow-100' 
                            : 'text-green-600 hover:bg-green-100'
                        }`}
                        title={scan.status === 'scheduled' ? 'Pause scan' : 'Resume scan'}
                      >
                        {scan.status === 'scheduled' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleEditScan(scan)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit scan"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteScan(scan.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete scan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <PeriodicScanModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingScan(null)
        }}
        onSave={handleSaveScan}
        initialData={editingScan}
      />
    </div>
  )
}
 
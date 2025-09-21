'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Globe, Bell, Settings, Repeat, AlertCircle } from 'lucide-react'

interface PeriodicScanModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (scanData: PeriodicScanData) => void
  initialData?: Partial<PeriodicScanData>
}

interface PeriodicScanData {
  scanType: 'web' | 'document'
  scanTitle: string
  url?: string
  fileName?: string
  fileType?: string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
  scheduledDate: string
  scheduledTime: string
  timezone: string
  daysOfWeek: number[]
  dayOfMonth: number
  endDate?: string
  maxRuns?: number
  notifyOnCompletion: boolean
  notifyOnFailure: boolean
  emailNotifications: boolean
  notes?: string
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
]

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Run Once', description: 'Schedule a single scan' },
  { value: 'daily', label: 'Daily', description: 'Every day at the same time' },
  { value: 'weekly', label: 'Weekly', description: 'On specific days of the week' },
  { value: 'monthly', label: 'Monthly', description: 'On a specific day each month' },
  { value: 'custom', label: 'Custom', description: 'Advanced scheduling with cron expressions' }
]

export default function PeriodicScanModal({ isOpen, onClose, onSave, initialData }: PeriodicScanModalProps) {
  const [formData, setFormData] = useState<PeriodicScanData>({
    scanType: 'web',
    scanTitle: '',
    url: '',
    frequency: 'once',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    daysOfWeek: [],
    dayOfMonth: 1,
    notifyOnCompletion: true,
    notifyOnFailure: true,
    emailNotifications: true,
    ...initialData
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [isOpen, initialData])

  const handleInputChange = (field: keyof PeriodicScanData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleDaysOfWeekChange = (day: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.scanTitle.trim()) {
      newErrors.scanTitle = 'Scan title is required'
    }

    if (formData.scanType === 'web' && !formData.url?.trim()) {
      newErrors.url = 'URL is required for web scans'
    }

    if (formData.scanType === 'document' && !formData.fileName?.trim()) {
      newErrors.fileName = 'File name is required for document scans'
    }

    if (formData.frequency === 'weekly' && formData.daysOfWeek.length === 0) {
      newErrors.daysOfWeek = 'Select at least one day of the week'
    }

    if (formData.frequency === 'monthly' && (!formData.dayOfMonth || formData.dayOfMonth < 1 || formData.dayOfMonth > 31)) {
      newErrors.dayOfMonth = 'Day of month must be between 1 and 31'
    }

    if (formData.endDate && formData.scheduledDate && new Date(formData.endDate) < new Date(formData.scheduledDate)) {
      newErrors.endDate = 'End date must be after the scheduled date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Error saving periodic scan:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getNextRunPreview = () => {
    if (formData.frequency === 'once') {
      return `${formData.scheduledDate} at ${formData.scheduledTime}`
    }
    
    if (formData.frequency === 'daily') {
      return `Every day at ${formData.scheduledTime}`
    }
    
    if (formData.frequency === 'weekly' && formData.daysOfWeek.length > 0) {
      const selectedDays = formData.daysOfWeek
        .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.short)
        .join(', ')
      return `Every ${selectedDays} at ${formData.scheduledTime}`
    }
    
    if (formData.frequency === 'monthly') {
      return `Monthly on day ${formData.dayOfMonth} at ${formData.scheduledTime}`
    }
    
    return 'Custom schedule'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Schedule Periodic Scan</h3>
              <p className="text-sm text-gray-500">Set up automated accessibility scanning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Scan Details */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Scan Details
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scan Type
                </label>
                <select
                  value={formData.scanType}
                  onChange={(e) => handleInputChange('scanType', e.target.value as 'web' | 'document')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="web">Web Scan</option>
                  <option value="document">Document Scan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scan Title *
                </label>
                <input
                  type="text"
                  value={formData.scanTitle}
                  onChange={(e) => handleInputChange('scanTitle', e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.scanTitle ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter scan title"
                />
                {errors.scanTitle && (
                  <p className="text-red-500 text-xs mt-1">{errors.scanTitle}</p>
                )}
              </div>
            </div>

            {formData.scanType === 'web' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website URL *
                </label>
                <input
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.url ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="https://example.com"
                />
                {errors.url && (
                  <p className="text-red-500 text-xs mt-1">{errors.url}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Name *
                  </label>
                  <input
                    type="text"
                    value={formData.fileName || ''}
                    onChange={(e) => handleInputChange('fileName', e.target.value)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.fileName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="document.pdf"
                  />
                  {errors.fileName && (
                    <p className="text-red-500 text-xs mt-1">{errors.fileName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Type
                  </label>
                  <select
                    value={formData.fileType || ''}
                    onChange={(e) => handleInputChange('fileType', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">Word Document</option>
                    <option value="html">HTML</option>
                    <option value="txt">Text File</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Scheduling Options */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduling
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => handleInputChange('frequency', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FREQUENCY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {FREQUENCY_OPTIONS.find(f => f.value === formData.frequency)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <select
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.frequency === 'once' ? 'Schedule Date' : 'Start Date'}
                </label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Weekly options */}
            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days of Week
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDaysOfWeekChange(day.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        formData.daysOfWeek.includes(day.value)
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                {errors.daysOfWeek && (
                  <p className="text-red-500 text-xs mt-1">{errors.daysOfWeek}</p>
                )}
              </div>
            )}

            {/* Monthly options */}
            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => handleInputChange('dayOfMonth', parseInt(e.target.value))}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.dayOfMonth ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.dayOfMonth && (
                  <p className="text-red-500 text-xs mt-1">{errors.dayOfMonth}</p>
                )}
              </div>
            )}

            {/* End date for recurring scans */}
            {formData.frequency !== 'once' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  min={formData.scheduledDate}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for unlimited recurring scans
                </p>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h4>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifyOnCompletion}
                  onChange={(e) => handleInputChange('notifyOnCompletion', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Notify when scan completes successfully
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifyOnFailure}
                  onChange={(e) => handleInputChange('notifyOnFailure', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Notify when scan fails
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.emailNotifications}
                  onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send email notifications
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any notes about this scheduled scan..."
            />
          </div>

          {/* Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Schedule Preview</span>
            </div>
            <p className="text-sm text-blue-700">{getNextRunPreview()}</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Schedule Scan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
 
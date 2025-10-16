'use client'

import { useState } from 'react'
import { AlertTriangle, X, Check } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info'
  showDontAskAgain?: boolean
  onDontAskAgain?: (checked: boolean) => void
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  showDontAskAgain = false,
  onDontAskAgain
}: ConfirmationModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (showDontAskAgain && onDontAskAgain) {
      onDontAskAgain(dontAskAgain)
    }
    onConfirm()
    onClose()
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600',
          iconBg: 'bg-red-100',
          button: 'bg-red-600 hover:bg-red-700 text-white',
          border: 'border-red-200'
        }
      case 'info':
        return {
          icon: 'text-blue-600',
          iconBg: 'bg-blue-100',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
          border: 'border-blue-200'
        }
      default: // warning
        return {
          icon: 'text-amber-600',
          iconBg: 'bg-amber-100',
          button: 'bg-amber-600 hover:bg-amber-700 text-white',
          border: 'border-amber-200'
        }
    }
  }

  const styles = getTypeStyles()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${styles.iconBg}`}>
              <AlertTriangle className={`h-5 w-5 ${styles.icon}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">{message}</p>

          {/* Don't ask again checkbox */}
          {showDontAskAgain && (
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={dontAskAgain}
                    onChange={(e) => setDontAskAgain(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    dontAskAgain 
                      ? 'bg-amber-600 border-amber-600' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    {dontAskAgain && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-gray-700">Don't ask me again</span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

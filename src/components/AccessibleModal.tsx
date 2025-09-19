'use client'

import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  type?: 'info' | 'warning' | 'error' | 'success'
  size?: 'sm' | 'md' | 'lg'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export default function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement
      
      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus()
      }, 100)
    } else {
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, closeOnEscape, onClose])

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  // Get icon and colors based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-600" />,
          iconBg: 'bg-green-100',
          borderColor: 'border-green-200'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
          iconBg: 'bg-yellow-100',
          borderColor: 'border-yellow-200'
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-6 w-6 text-red-600" />,
          iconBg: 'bg-red-100',
          borderColor: 'border-red-200'
        }
      default:
        return {
          icon: <Info className="h-6 w-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          borderColor: 'border-blue-200'
        }
    }
  }

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-sm'
      case 'lg':
        return 'max-w-2xl'
      default:
        return 'max-w-md'
    }
  }

  const typeStyles = getTypeStyles()

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={`relative w-full ${getSizeClasses()} transform overflow-hidden rounded-lg bg-white shadow-xl transition-all`}
          tabIndex={-1}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b ${typeStyles.borderColor} bg-gray-50 px-6 py-4`}>
            <div className="flex items-center space-x-3">
              <div className={`flex-shrink-0 rounded-full p-2 ${typeStyles.iconBg}`}>
                {typeStyles.icon}
              </div>
              <h3
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h3>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  isLoading?: boolean
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmationModalProps) {
  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={type}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          {message}
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              type === 'error' 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : type === 'success'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : type === 'warning'
                ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </AccessibleModal>
  )
}

// Alert Modal Component (replacement for browser alert)
interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'success'
  buttonText?: string
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'OK'
}: AlertModalProps) {
  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={type}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          {message}
        </p>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 ${
              type === 'error' 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : type === 'success'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : type === 'warning'
                ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </AccessibleModal>
  )
}

'use client'

import { useState, useCallback } from 'react'

interface ModalState {
  isOpen: boolean
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

export function useModal() {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  const showAlert = useCallback((
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ) => {
    setModalState({
      isOpen: true,
      title,
      message,
      type
    })
  }, [])

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'info' | 'warning' | 'error' | 'success' = 'warning',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setModalState({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
      confirmText,
      cancelText
    })
  }, [])

  const closeModal = useCallback(() => {
    setModalState(prev => ({
      ...prev,
      isOpen: false,
      onConfirm: undefined,
      isLoading: false
    }))
  }, [])

  const handleConfirm = useCallback(() => {
    if (modalState.onConfirm) {
      modalState.onConfirm()
    }
    closeModal()
  }, [modalState.onConfirm, closeModal])

  const setLoading = useCallback((isLoading: boolean) => {
    setModalState(prev => ({ ...prev, isLoading }))
  }, [])

  return {
    modalState,
    showAlert,
    showConfirm,
    closeModal,
    handleConfirm,
    setLoading
  }
}

// Utility functions to replace browser alerts
export const showUserFriendlyAlert = (
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info'
) => {
  // This will be used with the modal hook
  return { title, message, type }
}

export const showUserFriendlyConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  type: 'info' | 'warning' | 'error' | 'success' = 'warning'
) => {
  // This will be used with the modal hook
  return { title, message, onConfirm, type }
}

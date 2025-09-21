'use client'

import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import SprintBoard from '@/components/SprintBoard'

export default function SprintBoardPage() {
  return (
    <ProtectedRoute>
      <Sidebar>
        <SprintBoard />
      </Sidebar>
    </ProtectedRoute>
  )
}
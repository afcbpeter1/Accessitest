'use client'

import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import IssuesBoard from '@/components/IssuesBoard'

export default function IssuesBoardPage() {
  return (
    <ProtectedRoute>
      <Sidebar>
        <IssuesBoard />
      </Sidebar>
    </ProtectedRoute>
  )
}
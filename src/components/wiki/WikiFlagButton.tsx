'use client'

import { useState } from 'react'
import { authenticatedFetch, isAuthenticated } from '@/lib/auth-utils'

export default function WikiFlagButton({ revisionId }: { revisionId: string | null }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!revisionId || !isAuthenticated()) {
    return null
  }

  const submit = async () => {
    if (!reason.trim()) return
    setStatus('sending')
    try {
      const res = await authenticatedFetch('/api/wiki/flag', {
        method: 'POST',
        body: JSON.stringify({ revisionId, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setStatus('error')
        setMessage(data.error || 'Could not submit')
        return
      }
      setStatus('done')
      setOpen(false)
      setReason('')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (status === 'done') {
    return (
      <p className="text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-1 rounded-sm inline-block">
        Thanks — moderators will review this revision.
      </p>
    )
  }

  return (
    <div className="text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[#0645ad] hover:underline"
        >
          Flag revision
        </button>
      ) : (
        <div className="flex flex-col gap-2 max-w-md border border-[#eaecf0] bg-white p-3 rounded-sm">
          <label htmlFor="flag-reason" className="text-xs text-[#54595d]">
            Describe the problem (spam, inaccurate, etc.)
          </label>
          <textarea
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="border border-[#a2a9b1] rounded-sm px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={status === 'sending' || !reason.trim()}
              className="px-3 py-1 bg-[#0645ad] text-white text-xs rounded-sm disabled:opacity-50"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 border border-[#a2a9b1] text-xs rounded-sm"
            >
              Cancel
            </button>
          </div>
          {status === 'error' && message && (
            <p className="text-xs text-red-700">{message}</p>
          )}
        </div>
      )}
    </div>
  )
}

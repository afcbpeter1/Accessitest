import WikiAuthGate from '@/components/WikiAuthGate'
import WikiNewForm from '@/components/wiki/WikiNewForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create wiki page',
}

export default function WikiNewPage() {
  return (
    <WikiAuthGate redirectPath="/wiki/new">
      <div className="bg-white border border-[#a7d7f9] rounded-sm p-6">
        <h1 className="font-serif text-[1.5em] border-b border-[#a2a9b1] pb-2 mb-4">Create a new article</h1>
        <WikiNewForm />
      </div>
    </WikiAuthGate>
  )
}

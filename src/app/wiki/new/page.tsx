import WikiAuthGate from '@/components/WikiAuthGate'
import WikiNewForm from '@/components/wiki/WikiNewForm'
import type { Metadata } from 'next'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Create wiki article · Accessibility Wiki',
  description:
    'Create a new community article in the a11ytest.ai accessibility wiki. Sign in to contribute WCAG-focused content.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${baseUrl}/wiki` },
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

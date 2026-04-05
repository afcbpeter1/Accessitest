import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Editing help · Accessibility Wiki',
  description: 'How to write and tag articles on the Accessibility Wiki.',
}

export default function WikiHelpPage() {
  return (
    <div className="border border-[#a7d7f9] bg-white">
      <div className="border-b border-[#eaecf0] px-4 py-2 text-sm">
        <Link href="/wiki" className="text-[#0645ad] hover:underline">
          ← Wiki home
        </Link>
      </div>
      <div className="px-4 py-4 max-w-2xl text-[15px] leading-relaxed">
        <h1 className="mb-4 font-serif text-[1.5em] border-b border-[#a2a9b1] pb-2">Editing help</h1>
        <h2 className="mt-4 font-sans text-[1.05em] font-semibold">Markdown</h2>
        <p className="mb-2 text-[#202122]">
          Articles are written in <strong className="font-semibold">Markdown</strong>: headings (<code className="rounded bg-[#f8f9fa] px-1 text-[13px]">##</code>), lists, tables, and links. When you edit an older page, stored HTML is converted to Markdown once for the textarea.
        </p>
        <h2 className="mt-6 font-sans text-[1.05em] font-semibold">Categories &amp; tags</h2>
        <p className="mb-2 text-[#202122]">
          Use the <strong className="font-semibold">Categories</strong> checkboxes for the six main topics — they match
          the wiki home “Browse by category” grids and link to each topic page. Use{' '}
          <strong className="font-semibold">Additional tags</strong> for anything else: comma-separated words become
          their own topic pages at <code className="rounded bg-[#f8f9fa] px-1 text-[13px]">/wiki/tag/…</code>, including
          brand-new topics.
        </p>
        <h2 className="mt-6 font-sans text-[1.05em] font-semibold">WCAG field</h2>
        <p className="mb-2 text-[#202122]">
          Optional <strong className="font-semibold">WCAG criterion</strong> (e.g. <code className="rounded bg-[#f8f9fa] px-1 text-[13px]">1.3.1</code>) appears in the article header and helps readers cross-reference success criteria.
        </p>
        <p className="mt-6 text-[14px] text-[#54595d]">
          You must be signed in with a <strong className="font-medium text-[#202122]">verified email</strong> to publish.
        </p>
      </div>
    </div>
  )
}

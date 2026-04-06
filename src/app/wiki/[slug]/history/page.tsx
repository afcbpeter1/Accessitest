import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWikiPageBySlug, listWikiRevisionsForSlug } from '@/lib/wiki/wiki-db'
import { formatPublicWikiEditorName } from '@/lib/wiki/public-editor-name'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) return { title: 'Not found · Accessibility Wiki' }
  const articlePath = `/wiki/${encodeURIComponent(page.slug)}`
  return {
    title: `Revision history: ${page.title} · Accessibility Wiki`,
    description: `Revision history for “${page.title}” on the a11ytest.ai accessibility wiki. The article page is the canonical URL for this topic.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${baseUrl}${articlePath}` },
  }
}

export default async function WikiHistoryPage({ params }: Props) {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    notFound()
  }

  let revisions: Awaited<ReturnType<typeof listWikiRevisionsForSlug>> = []
  try {
    revisions = await listWikiRevisionsForSlug(params.slug)
  } catch {
    revisions = []
  }

  return (
    <div className="bg-white border border-[#a7d7f9] rounded-sm p-6">
      <div className="flex flex-wrap gap-3 text-sm mb-4">
        <Link href={`/wiki/${encodeURIComponent(page.slug)}`} className="text-[#0645ad] hover:underline">
          Read
        </Link>
        <Link href={`/wiki/${encodeURIComponent(page.slug)}/edit`} className="text-[#0645ad] hover:underline">
          Edit
        </Link>
        <span className="text-[#202122] font-medium">History</span>
      </div>

      <h1 className="font-serif text-[1.5em] border-b border-[#a2a9b1] pb-2 mb-4">
        Revision history: {page.title}
      </h1>

      {revisions.length === 0 ? (
        <p className="text-[#54595d] text-sm">
          No revisions yet. Stubs and new pages get their first revision when someone edits.
        </p>
      ) : (
        <ul className="space-y-3 text-[15px]">
          {revisions.map((r) => (
            <li key={r.id} className="border-b border-[#eaecf0] pb-3">
              <div className="text-[#202122]">
                {new Date(r.edited_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                <span className="text-[#72777d]"> · </span>
                {formatPublicWikiEditorName(r, 'Editor')}
              </div>
              {r.edit_summary && <div className="text-[#54595d] text-sm mt-1">{r.edit_summary}</div>}
              {typeof r.char_delta === 'number' && (
                <div className="text-xs text-[#72777d] mt-1">
                  {r.char_delta >= 0 ? '+' : ''}
                  {r.char_delta} characters
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

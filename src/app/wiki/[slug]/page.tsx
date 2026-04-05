import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWikiPageBySlug } from '@/lib/wiki/wiki-db'
import WikiContent from '@/components/wiki/WikiContent'
import WikiFlagButton from '@/components/wiki/WikiFlagButton'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    return { title: 'Not found · Accessibility Wiki' }
  }
  return {
    title: `${page.title} · Accessibility Wiki`,
    description: page.wcag_criterion
      ? `WCAG ${page.wcag_criterion} — community article on a11ytest.ai`
      : 'Community accessibility article on a11ytest.ai',
  }
}

function editorLabel(page: NonNullable<Awaited<ReturnType<typeof getWikiPageBySlug>>>) {
  const fn = page.editor_first_name?.trim()
  const ln = page.editor_last_name?.trim()
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ')
  if (page.editor_email) return page.editor_email
  return 'Unknown editor'
}

export default async function WikiArticlePage({ params }: Props) {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    notFound()
  }

  const hasContent = !!(page.content && page.content.replace(/<[^>]+>/g, '').trim())

  return (
    <div className="bg-white border border-[#a7d7f9] rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaecf0] px-4 py-2 text-sm">
        <div className="flex flex-wrap gap-3">
          <span className="font-medium text-[#202122]">Article</span>
          <Link href={`/wiki/${encodeURIComponent(page.slug)}/edit`} className="text-[#0645ad] hover:underline">
            Edit
          </Link>
          <Link href={`/wiki/${encodeURIComponent(page.slug)}/history`} className="text-[#0645ad] hover:underline">
            History
          </Link>
        </div>
        {page.wcag_criterion && (
          <span className="text-xs text-[#54595d]">WCAG {page.wcag_criterion}</span>
        )}
      </div>

      <div className="px-4 py-4">
        <h1 className="font-serif text-[1.85em] leading-tight border-b border-[#a2a9b1] pb-2 mb-4">
          {page.title}
        </h1>

        {page.is_stub && (
          <div className="border border-[#fc3] bg-[#fef6e7] px-3 py-2 text-sm text-[#202122] mb-4">
            This article is a <strong>stub</strong>. You can help by expanding it —{' '}
            <Link href={`/wiki/${encodeURIComponent(page.slug)}/edit`} className="text-[#0645ad] underline">
              edit this page
            </Link>
            .
          </div>
        )}

        {page.is_locked && (
          <p className="text-sm text-[#54595d] border border-[#eaecf0] bg-[#f8f9fa] px-3 py-2 mb-4">
            This page is locked. Contact support if a correction is needed.
          </p>
        )}

        {!hasContent ? (
          <p className="text-[#54595d] text-[15px] italic mb-4">
            No article text yet.{' '}
            <Link href={`/wiki/${encodeURIComponent(page.slug)}/edit`} className="text-[#0645ad] not-italic">
              Add content
            </Link>
            .
          </p>
        ) : (
          <WikiContent html={page.content!} />
        )}

        <div className="mt-8 pt-4 border-t border-[#eaecf0] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <p className="text-xs text-[#72777d]">
            Last edited{' '}
            {page.edited_at
              ? new Date(page.edited_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : '—'}
            {page.edited_at && <> · {editorLabel(page)}</>}
          </p>
          <WikiFlagButton revisionId={page.current_revision_id} />
        </div>
      </div>
    </div>
  )
}

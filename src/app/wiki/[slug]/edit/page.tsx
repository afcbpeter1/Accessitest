import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWikiPageBySlug, getWikiTagsForPageSlug } from '@/lib/wiki/wiki-db'
import WikiAuthGate from '@/components/WikiAuthGate'
import WikiEditorForm from '@/components/wiki/WikiEditorForm'

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai').replace(/\/$/, '')

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    return { title: 'Not found · Accessibility Wiki' }
  }
  const articlePath = `/wiki/${encodeURIComponent(page.slug)}`
  return {
    title: `Edit: ${page.title} · Accessibility Wiki`,
    description: `Editor for the wiki article “${page.title}”. Read the public article at a11ytest.ai — this URL is for contributors only.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${baseUrl}${articlePath}` },
  }
}

export default async function WikiEditPage({ params }: Props) {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    notFound()
  }

  const tagRows = await getWikiTagsForPageSlug(page.slug)

  const path = `/wiki/${page.slug}/edit`

  return (
    <WikiAuthGate redirectPath={path}>
      <div className="bg-white border border-[#a7d7f9] rounded-sm p-6">
        <div className="flex flex-wrap gap-3 text-sm mb-4">
          <Link href={`/wiki/${encodeURIComponent(page.slug)}`} className="text-[#0645ad] hover:underline">
            Read
          </Link>
          <span className="text-[#202122] font-medium">Edit</span>
          <Link href={`/wiki/${encodeURIComponent(page.slug)}/history`} className="text-[#0645ad] hover:underline">
            History
          </Link>
        </div>
        <h1 className="font-serif text-xl border-b border-[#a2a9b1] pb-2 mb-4">Editing: {page.title}</h1>
        <WikiEditorForm
          slug={page.slug}
          initialTitle={page.title}
          initialContent={page.content || '<p></p>'}
          initialWcag={page.wcag_criterion || ''}
          initialTagRows={tagRows}
          pageLocked={page.is_locked}
        />
      </div>
    </WikiAuthGate>
  )
}

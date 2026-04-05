import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getWikiPageBySlug } from '@/lib/wiki/wiki-db'
import WikiAuthGate from '@/components/WikiAuthGate'
import WikiEditorForm from '@/components/wiki/WikiEditorForm'

type Props = { params: { slug: string } }

export default async function WikiEditPage({ params }: Props) {
  const page = await getWikiPageBySlug(params.slug)
  if (!page) {
    notFound()
  }

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
          pageLocked={page.is_locked}
        />
      </div>
    </WikiAuthGate>
  )
}

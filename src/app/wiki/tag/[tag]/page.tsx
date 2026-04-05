import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listWikiPagesByTagSlug } from '@/lib/wiki/wiki-db'
import { normalizeWikiSlug, isValidWikiSlug } from '@/lib/wiki/slug'

type Props = { params: { tag: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = normalizeWikiSlug(params.tag)
  if (!slug) return { title: 'Topic · Accessibility Wiki' }
  const title = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return {
    title: `${title} · Accessibility Wiki`,
    description: `Articles tagged “${title}” on the a11ytest.ai wiki.`,
  }
}

export default async function WikiTagPage({ params }: Props) {
  const slug = normalizeWikiSlug(params.tag)
  if (!slug || !isValidWikiSlug(slug)) {
    notFound()
  }

  const pages = await listWikiPagesByTagSlug(slug, 500)

  return (
    <div className="border border-[#a7d7f9] bg-white">
      <div className="border-b border-[#eaecf0] px-4 py-2 text-sm">
        <Link href="/wiki" className="text-[#0645ad] hover:underline">
          ← Wiki home
        </Link>
      </div>
      <div className="px-4 py-4">
        <h1 className="mb-1 font-serif text-[1.6em] leading-tight border-b border-[#a2a9b1] pb-2">
          Topic: {slug.replace(/-/g, ' ')}
        </h1>
        <p className="mb-4 text-[13px] text-[#54595d]">
          Articles sharing this tag. Tags are set in the article editor.
        </p>
        {pages.length === 0 ? (
          <p className="text-[#54595d]">
            No articles use this tag yet.{' '}
            <Link href="/wiki/new" className="text-[#0645ad] hover:underline">
              Create a page
            </Link>{' '}
            and add this tag (or a similar one) in the Tags field.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[15px] marker:text-[#54595d]">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/wiki/${encodeURIComponent(p.slug)}`} className="text-[#0645ad] hover:underline">
                  {p.title}
                </Link>
                {p.is_stub ? <span className="ml-1 text-[12px] text-[#72777d]">(stub)</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

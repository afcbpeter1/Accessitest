import Link from 'next/link'
import type { Metadata } from 'next'
import { listWikiPages } from '@/lib/wiki/wiki-db'

export const metadata: Metadata = {
  title: 'Accessibility Wiki — community knowledge base',
  description:
    'Community-editable articles on WCAG, accessibility fixes, and inclusive design. Free resource from a11ytest.ai.',
}

export default async function WikiIndexPage() {
  let pages: Awaited<ReturnType<typeof listWikiPages>> = []
  let loadError: string | null = null

  try {
    pages = await listWikiPages(500)
  } catch {
    loadError =
      'The wiki could not be loaded. If you have not run the database migration yet, apply database/wiki-schema.sql to your Postgres database.'
  }

  return (
    <div className="bg-white border border-[#a7d7f9] rounded-sm p-6">
      <h1 className="font-serif text-[1.75em] border-b border-[#a2a9b1] pb-2 mb-4">
        Accessibility Wiki
      </h1>
      <p className="text-[#202122] text-[15px] leading-relaxed mb-6">
        This is a free, Wikipedia-style knowledge base focused on digital accessibility — WCAG criteria,
        practical fixes, and examples. Signed-in users with a verified email can create and edit articles.
        Links you add in articles are saved with <code className="bg-[#f8f9fa] px-1">nofollow</code> for
        search engines.
      </p>

      {loadError && (
        <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
          {loadError}
        </p>
      )}

      {!loadError && pages.length === 0 && (
        <p className="text-[#54595d] text-sm mb-4">
          No articles yet.{' '}
          <Link href="/wiki/new" className="text-[#0645ad] hover:underline">
            Create the first page
          </Link>
          .
        </p>
      )}

      {!loadError && pages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">All pages</h2>
          <ul className="columns-1 sm:columns-2 gap-4 text-[15px]">
            {pages.map((p) => (
              <li key={p.id} className="mb-1 break-inside-avoid">
                <Link href={`/wiki/${encodeURIComponent(p.slug)}`} className="text-[#0645ad] hover:underline">
                  {p.title}
                </Link>
                {p.is_stub && (
                  <span className="text-[#72777d] text-xs ml-1" title="Stub article">
                    (stub)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { getWikiHomeStats, listWikiPages, listWikiPagesByTagSlug } from '@/lib/wiki/wiki-db'
import { WIKI_BROWSE_CATEGORIES } from '@/lib/wiki/wiki-home-categories'

export const metadata: Metadata = {
  title: 'Accessibility Wiki — a11ytest.ai',
  description:
    'Community-editable articles on WCAG, accessibility fixes, and inclusive design. Free resource from a11ytest.ai.',
}

export default async function WikiIndexPage() {
  let pages: Awaited<ReturnType<typeof listWikiPages>> = []
  let stats = { articleCount: 0, contributorCount: 0 }
  let loadError: string | null = null
  let categoryArticles: Awaited<ReturnType<typeof listWikiPagesByTagSlug>>[] = []

  try {
    const [p, s, ...cats] = await Promise.all([
      listWikiPages(500),
      getWikiHomeStats(),
      ...WIKI_BROWSE_CATEGORIES.map((c) => listWikiPagesByTagSlug(c.tagSlug, 7)),
    ])
    pages = p
    stats = s
    categoryArticles = cats
  } catch {
    loadError =
      'The wiki could not be loaded. If you have not run the database migration yet, apply database/wiki-schema.sql (and wiki-tags-migration.sql for tags) to your Postgres database.'
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-6 rounded-sm border border-[#a2a9b1] bg-[#eaf3fb] px-3.5 py-2.5 font-sans text-[13px]">
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-tight text-[#3366cc]">{stats.articleCount}</span>
          <span className="text-[11px] text-[#54595d]">Articles</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-tight text-[#3366cc]">{stats.contributorCount}</span>
          <span className="text-[11px] text-[#54595d]">Contributors</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-tight text-[#3366cc]">86</span>
          <span className="text-[11px] text-[#54595d]">WCAG 2.2 criteria</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-tight text-[#3366cc]">3</span>
          <span className="text-[11px] text-[#54595d]">Standards covered</span>
        </div>
      </div>

      <div className="mb-4 border border-[#a2a9b1] bg-white">
        <h1 className="bg-[#3366cc] px-3 py-2 font-serif text-[22px] font-normal text-white">Accessibility Wiki</h1>
        <div className="px-4 py-3.5 text-[14px] leading-[1.7]">
          <p className="mb-2.5">
            Welcome to the <strong>Accessibility Wiki</strong> — a free, community-editable knowledge base for digital
            accessibility. This wiki covers WCAG criteria, practical code fixes, testing techniques, and real-world
            examples across web, mobile, and document accessibility.
          </p>
          <p className="mb-2.5">
            Signed-in users with a verified email can{' '}
            <Link href="/wiki/new" className="text-[#0645ad] no-underline hover:underline">
              create and edit articles
            </Link>
            . Add{' '}
            <strong className="font-normal">tags</strong> on the edit form so articles show up under topics and in the
            sidebar. Content is contributed by the community — verify against{' '}
            <a
              href="https://www.w3.org/WAI/WCAG22/quickref/"
              className="text-[#0645ad] no-underline hover:underline"
              rel="nofollow noreferrer"
            >
              official W3C guidance
            </a>{' '}
            and real user testing. Links in articles are saved with <code className="rounded-sm bg-[#f8f9fa] px-1 text-[13px]">nofollow</code> for search engines.
          </p>
          <div className="border-l-4 border-[#3366cc] bg-[#f4f8ff] px-3 py-2 text-[14px]">
            <strong className="mb-1 block font-sans text-[12px] uppercase tracking-wide text-[#3366cc]">
              Did you know?
            </strong>
            Automated accessibility tools can detect approximately 30–57% of WCAG failures by volume. The rest require
            manual testing, user research, or behavioural checks that simulate keyboard navigation and screen reader
            use.
          </div>
        </div>
      </div>

      {loadError && (
        <p className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>
      )}

      {!loadError && (
        <div className="mb-4 border border-[#a2a9b1] bg-white">
          <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 font-sans text-[13px] font-semibold tracking-wide text-[#202122]">
            Browse by category
          </h2>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {WIKI_BROWSE_CATEGORIES.map((cat, idx) => {
              const articles = categoryArticles[idx] ?? []
              return (
                <div
                  key={cat.tagSlug}
                  className="rounded-sm border border-[#e0e0e0] bg-[#f8f9fa] px-3 py-2.5"
                >
                  <h3 className="mb-1 font-sans text-[13px] font-semibold text-[#0645ad]">
                    <Link
                      href={`/wiki/tag/${encodeURIComponent(cat.tagSlug)}`}
                      className="text-inherit no-underline hover:underline"
                    >
                      {cat.title}
                    </Link>
                  </h3>
                  <ul className="list-none space-y-0.5 p-0">
                    {articles.slice(0, 6).map((p) => (
                      <li key={p.id} className="text-[13px] leading-relaxed">
                        <Link
                          href={`/wiki/${encodeURIComponent(p.slug)}`}
                          className={
                            p.is_stub
                              ? 'text-[#72777d] no-underline hover:underline'
                              : 'text-[#0645ad] no-underline hover:underline'
                          }
                        >
                          {p.title}
                          {p.is_stub ? <span className="align-super text-[10px] text-[#72777d]"> *</span> : null}
                        </Link>
                      </li>
                    ))}
                    <li className="text-[13px]">
                      <Link
                        href={`/wiki/tag/${encodeURIComponent(cat.tagSlug)}`}
                        className="text-[#0645ad] no-underline hover:underline"
                      >
                        → All in this topic
                      </Link>
                    </li>
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loadError && (
        <div id="all-pages" className="scroll-mt-4 border border-[#a2a9b1] bg-white">
          <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 font-sans text-[13px] font-semibold tracking-wide text-[#202122]">
            All pages
          </h2>
          <div className="px-3.5 py-3">
            {pages.length === 0 ? (
              <p className="text-[14px] text-[#54595d]">
                No articles yet.{' '}
                <Link href="/wiki/new" className="text-[#0645ad] no-underline hover:underline">
                  Create the first page
                </Link>
                .
              </p>
            ) : (
              <ul className="columns-1 gap-4 text-[15px] sm:columns-2">
                {pages.map((p) => (
                  <li key={p.id} className="mb-1 break-inside-avoid">
                    <Link
                      href={`/wiki/${encodeURIComponent(p.slug)}`}
                      className="text-[#0645ad] no-underline hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.is_stub && (
                      <span className="ml-1 text-[12px] text-[#72777d]" title="Stub article">
                        (stub)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

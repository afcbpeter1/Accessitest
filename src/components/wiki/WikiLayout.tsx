import Link from 'next/link'
import WikiSidebarAuth from '@/components/wiki/WikiSidebarAuth'
import type { WikiTagWithCount } from '@/lib/wiki/wiki-db'

type WikiLayoutProps = {
  children: React.ReactNode
  /** Tag cloud in the sidebar; from DB when tag tables exist. */
  sidebarTags?: WikiTagWithCount[]
}

export default function WikiLayout({ children, sidebarTags = [] }: WikiLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202122] font-serif text-[15px] leading-relaxed">
      <header>
        <nav
          className="flex h-11 items-center gap-3 border-b border-[#a2a9b1] bg-white px-4 text-[13px] font-sans"
          aria-label="Wiki"
        >
          <Link href="/home" className="font-semibold text-[#202122] no-underline hover:underline">
            a11ytest.ai
          </Link>
          <span className="text-[#a2a9b1]" aria-hidden>
            |
          </span>
          <Link href="/wiki" className="text-[15px] text-[#0645ad] no-underline hover:underline">
            Accessibility Wiki
          </Link>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
            <Link href="/wiki" className="text-[#0645ad] no-underline hover:underline">
              Main page
            </Link>
            <Link href="/wiki/new" className="text-[#0645ad] no-underline hover:underline">
              Create page
            </Link>
            <Link href="/home" className="text-[#0645ad] no-underline hover:underline">
              Marketing site
            </Link>
          </div>
        </nav>
        <div className="border-b border-[#a2a9b1] bg-[#f8f9fa] px-4 py-1 font-sans text-[12px] text-[#54595d]">
          Free community resource
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">{children}</div>

        <aside className="space-y-4 font-sans text-[13px]" aria-label="Wiki tools">
          <div className="border border-[#a2a9b1] bg-white">
            <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#202122]">
              Contribute
            </h2>
            <div className="space-y-0 px-3 py-2.5 leading-loose">
              <Link href="/wiki/new" className="block text-[#0645ad] no-underline hover:underline">
                Create a new article
              </Link>
              <Link href="/wiki/stubs" className="block text-[#0645ad] no-underline hover:underline">
                Expand a stub article
              </Link>
              <Link href="/wiki/help" className="block text-[#0645ad] no-underline hover:underline">
                Editing help
              </Link>
              <Link href="/wiki#all-pages" className="block text-[#0645ad] no-underline hover:underline">
                All pages
              </Link>
              <WikiSidebarAuth />
            </div>
          </div>

          <div className="border border-[#a2a9b1] bg-white">
            <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#202122]">
              Standards covered
            </h2>
            <div className="divide-y divide-[#f0f0f0] p-0">
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                <span className="whitespace-nowrap rounded-sm bg-[#3366cc] px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                  WCAG 2.2
                </span>
                <span>A, AA &amp; AAA</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                <span className="whitespace-nowrap rounded-sm bg-[#1a7a1a] px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                  Section 508
                </span>
                <span>US federal</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                <span className="whitespace-nowrap rounded-sm bg-[#003399] px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                  EN 301 549
                </span>
                <span>European</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                <span className="whitespace-nowrap rounded-sm bg-[#555] px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                  PDF/UA
                </span>
                <span>ISO 14289</span>
              </div>
            </div>
          </div>

          <div className="border border-[#a2a9b1] bg-white">
            <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#202122]">
              Browse by topic
            </h2>
            <div className="px-2.5 py-2.5 leading-relaxed">
              {sidebarTags.length === 0 ? (
                <p className="text-[12px] leading-snug text-[#72777d]">
                  Tags appear here as editors add them to articles. Open any article → Edit → Tags.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {sidebarTags.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/wiki/tag/${encodeURIComponent(t.slug)}`}
                      className="mb-0.5 inline-block rounded-sm border border-[#a2c4e0] bg-[#eaf3fb] px-1.5 py-0.5 text-[11px] text-[#3366cc] no-underline hover:bg-[#cee0f2]"
                      title={`${t.count} article${t.count === 1 ? '' : 's'}`}
                    >
                      {t.label}
                      {t.count > 0 ? <span className="ml-0.5 text-[#54595d]">({t.count})</span> : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border border-[#a2a9b1] bg-white">
            <h2 className="border-b border-[#a2a9b1] bg-[#cee0f2] px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#202122]">
              Related
            </h2>
            <div className="space-y-0 px-3 py-2.5 leading-loose">
              <a
                href="https://a11ytest.ai"
                className="block text-[#0645ad] no-underline hover:underline"
                rel="noreferrer"
              >
                a11ytest.ai scanner
              </a>
              <a
                href="https://www.w3.org/WAI/WCAG22/quickref/"
                className="block text-[#0645ad] no-underline hover:underline"
                rel="noreferrer nofollow"
              >
                W3C WCAG 2.2 quick ref
              </a>
              <a
                href="https://webaim.org/projects/million/"
                className="block text-[#0645ad] no-underline hover:underline"
                rel="noreferrer nofollow"
              >
                WebAIM Million report
              </a>
              <a
                href="https://www.w3.org/WAI/test-evaluate/"
                className="block text-[#0645ad] no-underline hover:underline"
                rel="noreferrer nofollow"
              >
                W3C evaluation guidance
              </a>
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-2 border-t border-[#a2a9b1] bg-white px-4 py-3 text-center text-[12px] font-sans text-[#54595d]">
        <p>
          Content is contributed by signed-in users and may be inaccurate. Always test with real users and official{' '}
          <a href="https://www.w3.org/WAI/WCAG22/quickref/" className="text-[#0645ad] hover:underline">
            WCAG guidance
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

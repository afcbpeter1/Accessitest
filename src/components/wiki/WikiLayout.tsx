import Link from 'next/link'

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#202122]">
      <header className="bg-white border-b border-[#a7d7f9]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/home" className="text-sm text-[#0645ad] hover:underline">
              a11ytest.ai
            </Link>
            <span className="text-[#72777d]">|</span>
            <Link href="/wiki" className="font-serif text-lg text-[#0645ad] hover:underline">
              Accessibility Wiki
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link href="/wiki" className="text-[#0645ad] hover:underline">
              Main Page
            </Link>
            <Link href="/wiki/new" className="text-[#0645ad] hover:underline">
              Create page
            </Link>
            <Link href="/home" className="text-[#72777d] hover:underline">
              Marketing site
            </Link>
          </nav>
        </div>
      </header>

      <div className="bg-white border-b border-[#eaecf0]">
        <div className="max-w-5xl mx-auto px-4 py-2">
          <p className="text-xs text-[#72777d]">
            Free community resource
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-[#eaecf0] bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-[#72777d]">
          <p>
            Content is contributed by signed-in users and may be inaccurate. Always test with real users and
            official WCAG guidance.
          </p>
        </div>
      </footer>
    </div>
  )
}

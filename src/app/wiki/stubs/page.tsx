import Link from 'next/link'
import type { Metadata } from 'next'
import { listWikiStubPages } from '@/lib/wiki/wiki-db'

export const metadata: Metadata = {
  title: 'Stub articles · Accessibility Wiki',
  description: 'Short articles that need expansion on the Accessibility Wiki.',
}

export default async function WikiStubsPage() {
  let stubs: Awaited<ReturnType<typeof listWikiStubPages>> = []
  let error: string | null = null
  try {
    stubs = await listWikiStubPages(200)
  } catch {
    error = 'Could not load stub list.'
  }

  return (
    <div className="border border-[#a7d7f9] bg-white">
      <div className="border-b border-[#eaecf0] px-4 py-2 text-sm">
        <Link href="/wiki" className="text-[#0645ad] hover:underline">
          ← Wiki home
        </Link>
      </div>
      <div className="px-4 py-4">
        <h1 className="mb-2 font-serif text-[1.5em] border-b border-[#a2a9b1] pb-2">Stub articles</h1>
        <p className="mb-4 text-[14px] text-[#54595d]">
          These pages are marked as stubs — they need more detail. Pick one and expand it.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!error && stubs.length === 0 && (
          <p className="text-[#54595d]">No stub pages right now. Great job — or create a new article.</p>
        )}
        {!error && stubs.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {stubs.map((p) => (
              <li key={p.id}>
                <Link href={`/wiki/${encodeURIComponent(p.slug)}/edit`} className="text-[#0645ad] hover:underline">
                  {p.title}
                </Link>
                <span className="text-[#72777d]"> — </span>
                <Link href={`/wiki/${encodeURIComponent(p.slug)}`} className="text-[13px] text-[#0645ad] hover:underline">
                  read
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

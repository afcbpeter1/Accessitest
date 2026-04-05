import Link from 'next/link'

export default function WikiNotFound() {
  return (
    <div className="bg-white border border-[#a7d7f9] rounded-sm p-8 text-center">
      <h1 className="font-serif text-xl mb-2">No such article</h1>
      <p className="text-[#54595d] text-sm mb-4">
        This wiki page does not exist yet. Run a scan to auto-create stubs for rules, or create a page from the main wiki.
      </p>
      <Link href="/wiki" className="text-[#0645ad] hover:underline text-sm">
        ← Back to Accessibility Wiki
      </Link>
    </div>
  )
}

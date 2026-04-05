import WikiLayout from '@/components/wiki/WikiLayout'
import { listWikiTagsWithCounts } from '@/lib/wiki/wiki-db'

export default async function WikiRootLayout({ children }: { children: React.ReactNode }) {
  const sidebarTags = await listWikiTagsWithCounts(28)
  return <WikiLayout sidebarTags={sidebarTags}>{children}</WikiLayout>
}

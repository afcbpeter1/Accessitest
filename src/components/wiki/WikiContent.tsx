import { repairWikiHtmlForDisplay } from '@/lib/wiki/repair-wiki-html'
import { sanitizeWikiHtml } from '@/lib/wiki/sanitize'

export default function WikiContent({ html }: { html: string }) {
  const safe = sanitizeWikiHtml(repairWikiHtmlForDisplay(html || ''))
  return (
    <div
      className="wiki-article text-[15px] leading-[1.6] text-[#202122] [&_a]:text-[#0645ad] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#eaecf0] [&_blockquote]:pl-4 [&_blockquote]:text-[#54595d] [&_code]:bg-[#f8f9fa] [&_code]:px-1 [&_code]:text-sm [&_h2]:text-[1.5em] [&_h2]:font-normal [&_h2]:border-b [&_h2]:border-[#eaecf0] [&_h2]:pb-1 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[1.2em] [&_h3]:font-semibold [&_h3]:mt-4 [&_h4]:text-[1.05em] [&_h4]:font-semibold [&_h4]:mt-3 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-8 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:bg-[#f8f9fa] [&_pre]:p-3 [&_pre]:text-sm [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm [&_th]:border [&_th]:border-[#a2a9b1] [&_th]:bg-[#f8f9fa] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-[#a2a9b1] [&_td]:px-2 [&_td]:py-1.5 [&_ul]:list-disc [&_ul]:pl-8"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

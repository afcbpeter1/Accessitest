import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

const FENCED_CODE_BLOCK = /(```[\s\S]*?```)/g

/**
 * Marked treats raw `<tag>...</tag>` as HTML. A few tags (layout, forms, embeds) break the
 * Markdown tokenizer or are unsafe; we entity-encode **only those** outside fenced blocks.
 *
 * We intentionally do **not** encode normal document tags (`p`, `h1`, `table`, `a`, …) so pasted
 * semantic HTML and GFM-style content render as HTML, not as visible `&lt;p&gt;` text.
 */
const TAGS_ENCODE_IN_MARKDOWN = new Set([
  'area',
  'article',
  'aside',
  'audio',
  'base',
  'body',
  'button',
  'canvas',
  'datalist',
  'div',
  'embed',
  'fieldset',
  'footer',
  'form',
  'head',
  'header',
  'html',
  'iframe',
  'input',
  'label',
  'legend',
  'link',
  'main',
  'map',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'output',
  'progress',
  'script',
  'section',
  'select',
  'slot',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'track',
  'video',
  'x-turndown',
])

export function preprocessMarkdownForHtmlLiteracy(markdown: string): string {
  const md = String(markdown ?? '')
  return md.split(FENCED_CODE_BLOCK).map((segment) => {
    if (segment.startsWith('```')) return segment
    let out = segment.replace(
      /(?<![`\\])<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g,
      (_full, tag: string, rest: string) => {
        const t = String(tag).toLowerCase()
        if (t === 'http' || t === 'https') return _full
        if (!TAGS_ENCODE_IN_MARKDOWN.has(t)) return _full
        return `&lt;${tag}${rest}&gt;`
      }
    )
    out = out.replace(/(?<![`\\])<\/([a-zA-Z][a-zA-Z0-9-]*)>/g, (_full, tag: string) => {
      const t = String(tag).toLowerCase()
      if (!TAGS_ENCODE_IN_MARKDOWN.has(t)) return _full
      return `&lt;/${tag}&gt;`
    })
    return out
  }).join('')
}

/** Convert Markdown (headings, lists, links, fenced code) to HTML before sanitization. */
export function renderWikiMarkdown(markdown: string): string {
  const src = preprocessMarkdownForHtmlLiteracy(String(markdown ?? ''))
  const out = marked.parse(src, { async: false })
  return typeof out === 'string' ? out : ''
}

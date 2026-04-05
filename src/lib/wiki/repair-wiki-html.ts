import he from 'he'

const PRE_BLOCK = /(<pre\b[^>]*>[\s\S]*?<\/pre>)/gi

/** Decode entities only outside <pre>…</pre> so <code> snippets keep literal &lt; when intended. */
function decodeEntitiesOutsidePre(html: string): string {
  return html.split(PRE_BLOCK).map((chunk) => {
    if (/^<pre\b/i.test(chunk)) return chunk
    if (!chunk.includes('&lt;') && !chunk.includes('&amp;')) return chunk
    return he.decode(chunk)
  }).join('')
}

/**
 * Fix wiki HTML that was stored incorrectly (e.g. whole article HTML-escaped so tags show as text),
 * and strip Turndown artifacts. Safe to run before sanitize on every render/save.
 */
export function repairWikiHtmlForDisplay(html: string): string {
  let s = html
    .replace(/<\/?x-turndown[^>]*>/gi, '')
    .replace(/\s*<\/x-turndown>\s*/gi, '')
    .trim()
  if (!s) return s

  // Up to 3 passes: double-encoded content from older failed sanitization paths
  let prev = ''
  for (let i = 0; i < 3 && prev !== s; i++) {
    prev = s
    s = decodeEntitiesOutsidePre(s)
  }

  return s
}

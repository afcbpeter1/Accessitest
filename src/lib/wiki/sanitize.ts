import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

/**
 * Next.js RSC / server bundles sometimes resolve `isomorphic-dompurify`'s browser entry, where
 * bare DOMPurify runs without JSDOM — DOMPurify then throws `Element is not defined` internally
 * (`instanceof Element` in purify.cjs). Always bind to a real DOM implementation on the server.
 */
const domWindow =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'
    ? window
    : new JSDOM('<!DOCTYPE html><html><body></body></html>').window

const DOMPurify = createDOMPurify(domWindow as Parameters<typeof createDOMPurify>[0])

let hooksRegistered = false

function registerNofollowHook() {
  if (hooksRegistered) return
  hooksRegistered = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    try {
      if (node.nodeType !== 1 || node.nodeName?.toUpperCase() !== 'A') return
      const el = node as unknown as {
        getAttribute: (n: string) => string | null
        setAttribute: (n: string, v: string) => void
      }
      const rel = el.getAttribute('rel') || ''
      const parts = new Set(
        rel
          .split(/\s+/)
          .filter(Boolean)
          .filter((x) => x !== 'follow')
      )
      parts.add('nofollow')
      parts.add('noopener')
      parts.add('noreferrer')
      el.setAttribute('rel', Array.from(parts).join(' '))
    } catch {
      /* ignore hook failures — must never break sanitization */
    }
  })
}

/** Tags allowed in wiki HTML (marked output + accessibility articles / code samples). */
const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

const SANITIZE_OPTS: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel', 'colspan', 'rowspan', 'scope'],
  ALLOW_DATA_ATTR: false,
}

/** Sanitize wiki HTML from editors and add rel="nofollow" on all links for SEO policy. */
export function sanitizeWikiHtml(html: unknown): string {
  const str = typeof html === 'string' ? html : String(html ?? '')
  try {
    registerNofollowHook()
    return DOMPurify.sanitize(str, SANITIZE_OPTS)
  } catch (e) {
    console.error('[sanitizeWikiHtml]', e)
    const escaped = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<p>${escaped}</p>`
  }
}

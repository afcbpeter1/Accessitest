import DOMPurify from 'isomorphic-dompurify'

let hooksRegistered = false

function registerNofollowHook() {
  if (hooksRegistered) return
  hooksRegistered = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName?.toUpperCase() === 'A' && node instanceof Element) {
      const rel = node.getAttribute('rel') || ''
      const parts = new Set(
        rel
          .split(/\s+/)
          .filter(Boolean)
          .filter((x) => x !== 'follow')
      )
      parts.add('nofollow')
      parts.add('noopener')
      parts.add('noreferrer')
      node.setAttribute('rel', Array.from(parts).join(' '))
    }
  })
}

/** Sanitize wiki HTML from editors and add rel="nofollow" on all links for SEO policy. */
export function sanitizeWikiHtml(html: string): string {
  registerNofollowHook()
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a',
      'b',
      'blockquote',
      'br',
      'code',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
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
      'u',
      'ul',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  })
}

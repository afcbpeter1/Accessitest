/**
 * Public wiki UI: show editor identity in a privacy-preserving form (e.g. P**** J****),
 * not full names or raw email.
 */

function redactToken(word: string): string {
  const w = word.trim()
  if (!w) return ''
  return w[0] + '****'
}

/** Redact first + last name for public display. */
export function redactPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const fn = firstName?.trim()
  const ln = lastName?.trim()
  const parts: string[] = []
  if (fn) parts.push(redactToken(fn))
  if (ln) parts.push(redactToken(ln))
  if (parts.length === 0) return null
  return parts.join(' ')
}

/** Redact email local-part for public display (keep domain for recognition). */
export function redactEmail(email: string | null | undefined): string | null {
  const e = email?.trim()
  if (!e || !e.includes('@')) return null
  const [local, domain] = e.split('@', 2)
  if (!local.length) return `****@${domain}`
  return local[0] + '****@' + domain
}

type EditorFields = {
  editor_first_name?: string | null
  editor_last_name?: string | null
  editor_email?: string | null
}

/** Single string for “Last edited … · …” and history lines. */
export function formatPublicWikiEditorName(
  e: EditorFields,
  fallbackWhenAnonymous: string = 'Editor'
): string {
  const name = redactPersonName(e.editor_first_name, e.editor_last_name)
  if (name) return name
  const em = redactEmail(e.editor_email)
  if (em) return em
  return fallbackWhenAnonymous
}

/** Like {@link formatPublicWikiEditorName} but returns null if there is no editor row at all. */
export function formatPublicWikiEditorNameOrNull(e: EditorFields): string | null {
  const has =
    e.editor_first_name?.trim() ||
    e.editor_last_name?.trim() ||
    e.editor_email?.trim()
  if (!has) return null
  return formatPublicWikiEditorName(e, 'Editor')
}

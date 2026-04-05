'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import WikiTiptapEditor from '@/components/wiki/WikiTiptapEditor'
import { authenticatedFetch } from '@/lib/auth-utils'
import { normalizeWikiSlug, isValidWikiSlug } from '@/lib/wiki/slug'

export default function WikiNewForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [wcag, setWcag] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [html, setHtml] = useState('<p></p>')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slugTouched && title.trim()) {
      setSlug(normalizeWikiSlug(title))
    }
  }, [title, slugTouched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const finalSlug = normalizeWikiSlug(slug)
    if (!isValidWikiSlug(finalSlug)) {
      setError('Use a URL slug with lowercase letters, numbers, and hyphens only (e.g. missing-form-label).')
      return
    }
    setSaving(true)
    try {
      const res = await authenticatedFetch(`/api/wiki/${encodeURIComponent(finalSlug)}`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: html,
          editSummary: editSummary.trim() || 'Created page',
          wcagCriterion: wcag.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Save failed')
        return
      }
      router.push(`/wiki/${encodeURIComponent(finalSlug)}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="wiki-new-slug" className="block text-sm font-medium text-[#202122] mb-1">
          URL slug
        </label>
        <input
          id="wiki-new-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          placeholder="e.g. keyboard-accessibility-basics"
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px] font-mono text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="wiki-new-title" className="block text-sm font-medium text-[#202122] mb-1">
          Title
        </label>
        <input
          id="wiki-new-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px]"
          required
        />
      </div>

      <div>
        <label htmlFor="wiki-new-wcag" className="block text-sm font-medium text-[#202122] mb-1">
          WCAG criterion (optional)
        </label>
        <input
          id="wiki-new-wcag"
          value={wcag}
          onChange={(e) => setWcag(e.target.value)}
          placeholder="e.g. 2.4.7"
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px] max-w-xs"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-[#202122] mb-1">Article</span>
        <WikiTiptapEditor initialHtml="<p></p>" onChange={setHtml} />
      </div>

      <div>
        <label htmlFor="wiki-new-summary" className="block text-sm font-medium text-[#202122] mb-1">
          Edit summary
        </label>
        <input
          id="wiki-new-summary"
          value={editSummary}
          onChange={(e) => setEditSummary(e.target.value)}
          placeholder="Briefly describe this new page"
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px]"
        />
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-[#0645ad] text-white text-sm font-medium rounded-sm hover:bg-[#053a91] disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create page'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/wiki')}
          className="px-4 py-2 border border-[#a2a9b1] text-sm rounded-sm hover:bg-[#f8f9fa]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

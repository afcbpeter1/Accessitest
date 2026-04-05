'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import TurndownService from 'turndown'
import { authenticatedFetch } from '@/lib/auth-utils'
import WikiCategoryTagFields from '@/components/wiki/WikiCategoryTagFields'
import { mergeTagsForSave, splitTagsForForm } from '@/lib/wiki/wiki-category-tags'

function htmlToInitialMarkdown(html: string): string {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
  try {
    return td.turndown(html || '<p></p>')
  } catch {
    return ''
  }
}

interface WikiEditorFormProps {
  slug: string
  initialTitle: string
  initialContent: string
  initialWcag: string
  /** Tags from DB — split into curated categories vs additional tags in the form */
  initialTagRows?: { slug: string; label: string }[]
  pageLocked?: boolean
}

export default function WikiEditorForm({
  slug,
  initialTitle,
  initialContent,
  initialWcag,
  initialTagRows,
  pageLocked,
}: WikiEditorFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [wcag, setWcag] = useState(initialWcag)
  const initialTagSplit = useMemo(() => splitTagsForForm(initialTagRows ?? []), [initialTagRows])
  const [selectedCategories, setSelectedCategories] = useState(() => [...initialTagSplit.selectedSlugs])
  const [extraTags, setExtraTags] = useState(() => initialTagSplit.extraTags)
  const [editSummary, setEditSummary] = useState('')
  const [markdownBody, setMarkdownBody] = useState(() => htmlToInitialMarkdown(initialContent))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (pageLocked) {
    return (
      <p className="text-[#54595d] border border-[#fc3] bg-[#fef6e7] px-3 py-2 rounded-sm">
        This page is locked and cannot be edited.
      </p>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!markdownBody.trim()) {
      setError('Add Markdown content for the article.')
      return
    }
    setSaving(true)
    try {
      const res = await authenticatedFetch(`/api/wiki/${encodeURIComponent(slug)}`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: markdownBody,
          contentFormat: 'markdown',
          editSummary: editSummary.trim(),
          wcagCriterion: wcag.trim() || null,
          tags: mergeTagsForSave(selectedCategories, extraTags),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Save failed')
        return
      }
      router.push(`/wiki/${encodeURIComponent(slug)}`)
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
        <label htmlFor="wiki-title" className="block text-sm font-medium text-[#202122] mb-1">
          Title
        </label>
        <input
          id="wiki-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px]"
          required
        />
      </div>

      <div>
        <label htmlFor="wiki-wcag" className="block text-sm font-medium text-[#202122] mb-1">
          WCAG criterion (optional)
        </label>
        <input
          id="wiki-wcag"
          value={wcag}
          onChange={(e) => setWcag(e.target.value)}
          placeholder="e.g. 1.1.1"
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px] max-w-xs"
        />
      </div>

      <WikiCategoryTagFields
        idPrefix="wiki-edit"
        selectedSlugs={selectedCategories}
        onToggleSlug={(s) =>
          setSelectedCategories((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
        }
        extraTags={extraTags}
        onChangeExtraTags={setExtraTags}
      />

      <div className="rounded-sm border border-[#a2a9b1] bg-[#f8f9fa] p-3">
        <label htmlFor="wiki-edit-md" className="block text-sm font-medium text-[#202122] mb-1">
          Article (Markdown)
        </label>
        <textarea
          id="wiki-edit-md"
          value={markdownBody}
          onChange={(e) => setMarkdownBody(e.target.value)}
          rows={18}
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px] font-mono leading-relaxed bg-white"
          spellCheck
        />
        <p className="mt-1 text-xs text-[#54595d]">
          Existing HTML is converted to Markdown for editing. Use ## headings, lists, tables, and links.
        </p>
      </div>

      <div>
        <label htmlFor="wiki-summary" className="block text-sm font-medium text-[#202122] mb-1">
          Edit summary
        </label>
        <input
          id="wiki-summary"
          value={editSummary}
          onChange={(e) => setEditSummary(e.target.value)}
          placeholder="Briefly describe what you changed"
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
          {saving ? 'Publishing…' : 'Publish changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/wiki/${encodeURIComponent(slug)}`)}
          className="px-4 py-2 border border-[#a2a9b1] text-sm rounded-sm hover:bg-[#f8f9fa]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

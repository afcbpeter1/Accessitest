'use client'

import Link from 'next/link'
import { WIKI_BROWSE_CATEGORIES } from '@/lib/wiki/wiki-home-categories'

type Props = {
  selectedSlugs: string[]
  onToggleSlug: (slug: string) => void
  extraTags: string
  onChangeExtraTags: (value: string) => void
  /** input id prefix for labels */
  idPrefix: string
}

/**
 * Curated categories (same as wiki home “Browse by category”) + optional extra tags / new topics.
 */
export default function WikiCategoryTagFields({
  selectedSlugs,
  onToggleSlug,
  extraTags,
  onChangeExtraTags,
  idPrefix,
}: Props) {
  return (
    <div className="space-y-3 rounded-sm border border-[#a2a9b1] bg-[#f8f9fa] p-3">
      <div>
        <span className="mb-2 block text-sm font-medium text-[#202122]">Categories</span>
        <p className="mb-2 text-xs text-[#54595d]">
          Tick the topics this article belongs to. They match the wiki home{" "}
          <strong className="font-medium text-[#202122]">Browse by category</strong> sections and each topic page.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WIKI_BROWSE_CATEGORIES.map((c) => {
            const id = `${idPrefix}-cat-${c.tagSlug}`
            const checked = selectedSlugs.includes(c.tagSlug)
            return (
              <li key={c.tagSlug}>
                <label
                  htmlFor={id}
                  className={`flex cursor-pointer items-start gap-2 rounded-sm border px-2 py-1.5 text-[14px] ${
                    checked ? 'border-[#3366cc] bg-[#eaf3fb]' : 'border-[#eaecf0] bg-white'
                  }`}
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => onToggleSlug(c.tagSlug)}
                  />
                  <span>
                    <span className="text-[#202122]">{c.title}</span>
                    <span className="ml-1 text-[11px] text-[#72777d]">
                      (
                      <Link
                        href={`/wiki/tag/${encodeURIComponent(c.tagSlug)}`}
                        className="text-[#0645ad] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        topic page
                      </Link>
                      )
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-extra-tags`} className="block text-sm font-medium text-[#202122] mb-1">
          Additional tags / new topics
        </label>
        <input
          id={`${idPrefix}-extra-tags`}
          value={extraTags}
          onChange={(e) => onChangeExtraTags(e.target.value)}
          placeholder="e.g. semantic-html, mobile, your-new-topic"
          className="w-full border border-[#a2a9b1] rounded-sm px-3 py-2 text-[15px] bg-white"
        />
        <p className="mt-1 text-xs text-[#54595d]">
          Comma-separated. Any word here becomes a topic page at{' '}
          <code className="rounded bg-white px-0.5 text-[12px]">/wiki/tag/…</code> — including topics not in the list
          above.
        </p>
      </div>
    </div>
  )
}

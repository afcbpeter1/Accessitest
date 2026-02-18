'use client'

import { CheckCircle, Table, BookOpen, Languages, Palette, FileText, Link2, Shield, Type } from 'lucide-react'

interface FixReportProps {
  fixesApplied: {
    altText: number
    tableSummaries: number
    metadata: number
    bookmarks: number
    readingOrder: number
    colorContrast: number
    language: number
    formLabel: number
    linkText: number
    textSize: number
    fontEmbedding: number
    tabOrder: number
    formFieldProperties: number
    linkValidation: number
    securitySettings: number
  }
}

const fixCategories = [
  {
    title: 'Tables',
    icon: Table,
    fixes: [
      { key: 'tableSummaries', label: 'Table Summaries', description: 'Descriptive summaries for tables' },
    ],
    color: 'purple'
  },
  {
    title: 'Document Structure',
    icon: BookOpen,
    fixes: [
      { key: 'metadata', label: 'Metadata', description: 'Document title, language, and metadata' },
      { key: 'bookmarks', label: 'Bookmarks', description: 'Table of contents and navigation bookmarks' },
      { key: 'readingOrder', label: 'Reading Order', description: 'Logical reading order for screen readers' },
    ],
    color: 'green'
  },
  {
    title: 'Text & Language',
    icon: Languages,
    fixes: [
      { key: 'language', label: 'Language Tags', description: 'Language identification for text spans' },
      { key: 'textSize', label: 'Text Size', description: 'Increased font sizes for readability' },
    ],
    color: 'indigo'
  },
  {
    title: 'Color & Contrast',
    icon: Palette,
    fixes: [
      { key: 'colorContrast', label: 'Color Contrast', description: 'Improved color contrast ratios' },
    ],
    color: 'orange'
  },
  {
    title: 'Forms',
    icon: FileText,
    fixes: [
      { key: 'formLabel', label: 'Form Labels', description: 'Descriptive labels for form fields' },
      { key: 'formFieldProperties', label: 'Form Field Properties', description: 'Tooltips, required flags, and help text' },
      { key: 'tabOrder', label: 'Tab Order', description: 'Logical tab order for keyboard navigation' },
    ],
    color: 'teal'
  },
  {
    title: 'Links',
    icon: Link2,
    fixes: [
      { key: 'linkText', label: 'Link Text', description: 'Improved descriptive link text' },
      { key: 'linkValidation', label: 'Link Validation', description: 'Validated and flagged invalid links' },
    ],
    color: 'pink'
  },
  {
    title: 'Fonts & Typography',
    icon: Type,
    fixes: [
      { key: 'fontEmbedding', label: 'Font Embedding', description: 'Checked font embedding status' },
    ],
    color: 'gray'
  },
  {
    title: 'Security & Access',
    icon: Shield,
    fixes: [
      { key: 'securitySettings', label: 'Security Settings', description: 'Adjusted permissions for assistive technologies' },
    ],
    color: 'red'
  },
]

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
  red: 'bg-red-50 border-red-200 text-red-700',
}

export default function FixReport({ fixesApplied }: FixReportProps) {
  // Calculate total fixes
  const totalFixes = Object.values(fixesApplied).reduce((sum, count) => sum + count, 0)

  if (totalFixes === 0) {
    return null
  }

  return (
    <div className="mt-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Accessibility Fixes Applied</h3>
            <p className="text-sm text-gray-500">
              {totalFixes} {totalFixes === 1 ? 'fix' : 'fixes'} applied to improve accessibility
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fixCategories.map((category) => {
          const categoryFixes = category.fixes.filter(
            fix => fixesApplied[fix.key as keyof typeof fixesApplied] > 0
          )

          if (categoryFixes.length === 0) {
            return null
          }

          const Icon = category.icon
          const colorClass = colorClasses[category.color as keyof typeof colorClasses]

          return (
            <div
              key={category.title}
              className={`p-4 border-2 rounded-lg ${colorClass}`}
            >
              <div className="flex items-center space-x-2 mb-3">
                <Icon className="h-5 w-5" />
                <h4 className="font-semibold">{category.title}</h4>
              </div>
              <div className="space-y-2">
                {categoryFixes.map((fix) => {
                  const count = fixesApplied[fix.key as keyof typeof fixesApplied]
                  return (
                    <div key={fix.key} className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{fix.label}</span>
                          <span className="px-2 py-0.5 bg-white/60 rounded text-xs font-semibold">
                            {count}
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-80">{fix.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{fixesApplied.altText}</div>
            <div className="text-xs text-gray-500">Images Fixed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{fixesApplied.tableSummaries}</div>
            <div className="text-xs text-gray-500">Tables Fixed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{fixesApplied.bookmarks}</div>
            <div className="text-xs text-gray-500">Bookmarks Added</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{fixesApplied.colorContrast}</div>
            <div className="text-xs text-gray-500">Color Fixes</div>
          </div>
        </div>
      </div>
    </div>
  )
}


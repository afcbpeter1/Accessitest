'use client'

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function AutoFixCapabilities() {
  const autoFixable = [
    'Document metadata (title, language)',
    'Image alt text',
    'Heading structure (H1-H6)',
    'Language span tagging',
    'Form field labels',
    'Link text improvements',
    'Color contrast (WCAG AA)',
    'Color as only indicator (text alternatives)',
    'Text resizing (minimum font sizes)',
    'Images of text (OCR extraction)',
    'Table structure (structure tree)',
    'List structure (structure tree)',
  ]

  const manualOnly = [
    'Keyboard traps (requires application code)',
    'Time limits (requires application code)',
    'Script accessibility (requires code modification)',
    'Plug-in alternatives (requires alternative implementations)',
    'Audio descriptions (requires human narration)',
  ]

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-3">Auto-Fix Capabilities</h2>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold text-green-600">12</span>
          <span className="text-sm text-gray-600">auto-fixable issue types</span>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          We automatically fix these accessibility issues during document rebuild using PyMuPDF.
        </p>
      </div>

      <div className="space-y-4">
        {/* Auto-Fixable Issues */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Auto-Fixed (12 types)</h3>
          </div>
          <div className="space-y-1.5">
            {autoFixable.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Manual-Only Issues */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Manual Fix Required (5 types)</h3>
          </div>
          <div className="space-y-1.5">
            {manualOnly.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> Application-level and code-level issues require developer intervention.
        </p>
      </div>
    </div>
  )
}


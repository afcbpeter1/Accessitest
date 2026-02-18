'use client'

import { FileText, Sparkles, CheckCircle2, Download, Search, Wrench } from 'lucide-react'

export default function AutoFixCapabilities() {
  const documentTypes = {
    PDF: {
      icon: FileText,
      title: 'PDF Documents',
      steps: [
        {
          icon: Wrench,
          title: 'Step 1: Auto-Tag',
          description: 'Automatically tag your PDF document to add accessibility structure (headings, lists, tables, etc.) compliant with ISO 14289-1'
        },
        {
          icon: Search,
          title: 'Step 2: Scan',
          description: 'Run comprehensive ISO 14289-1 (PDF/UA) compliance validation to identify all accessibility issues'
        },
        {
          icon: Sparkles,
          title: 'Step 3: Auto-Fix',
          description: 'Automatically fix most ISO 14289-1 (PDF/UA) compliance issues including structure tree, tagged content, language, title, alt text, table summaries, metadata, bookmarks, headings, form labels, link text, text size, tab order, and more. Some complex structural issues may require manual intervention, for which we provide detailed AI-powered remediation suggestions.'
        },
        {
          icon: Search,
          title: 'Step 4: Re-Scan',
          description: 'Re-scan the fixed PDF to identify only remaining issues (no duplicates - only issues that couldn\'t be auto-fixed)'
        },
        {
          icon: Sparkles,
          title: 'Step 5: AI Guidance',
          description: 'Generate AI-powered remediation suggestions only for remaining issues that require manual intervention'
        },
        {
          icon: Download,
          title: 'Download Auto-Fixed PDF',
          description: 'Download the automatically fixed PDF with all improvements applied (alt text, summaries, metadata, bookmarks, etc.)'
        }
      ]
    }
  }

  const activeDocType = documentTypes.PDF
  const IconComponent = activeDocType.icon

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-4">What We Do</h2>
      

      {/* Active Tab Content */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <IconComponent className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">{activeDocType.title}</h3>
        </div>

        <div className="space-y-3">
          {activeDocType.steps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <StepIcon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-900 mb-1">{step.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-900 mb-1">Auto-Added to Backlog</p>
            <p className="text-xs text-gray-600">
              All detected issues are automatically added to your product backlog for tracking and prioritization.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

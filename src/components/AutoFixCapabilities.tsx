'use client'

import { useState } from 'react'
import { FileText, File, Presentation, FileCode, Sparkles, CheckCircle2, Download, Search, Wrench } from 'lucide-react'

export default function AutoFixCapabilities() {
  const [activeTab, setActiveTab] = useState<'PDF' | 'Word' | 'PPT' | 'HTML' | 'Text'>('PDF')

  const documentTypes = {
    PDF: {
      icon: FileText,
      title: 'PDF Documents',
      steps: [
        {
          icon: Wrench,
          title: 'Step 1: Auto-Tag',
          description: 'Automatically tag your PDF document using Adobe PDF Services to add accessibility structure (headings, lists, tables, etc.)'
        },
        {
          icon: Search,
          title: 'Step 2: Scan',
          description: 'Run comprehensive Adobe Acrobat accessibility tests (PDF/UA, WCAG 2.1 AA) on the tagged PDF to identify all issues'
        },
        {
          icon: Sparkles,
          title: 'Step 3: Auto-Fix',
          description: 'Automatically fix 15/16 accessibility issues (93.75% coverage) including alt text, table summaries, metadata, bookmarks, headings, language tags, color contrast, form labels, link text, text size, tab order, and more'
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
    },
    Word: {
      icon: File,
      title: 'Word Documents',
      steps: [
        {
          icon: Search,
          title: 'Step 1: Scan',
          description: 'Run comprehensive accessibility tests (WCAG 2.1 AA, Section 508) on your Word document to identify all issues'
        },
        {
          icon: Sparkles,
          title: 'Step 2: Auto-Fix',
          description: 'Automatically fix accessibility issues including alt text, table summaries, metadata, headings, language tags, color contrast, and more'
        },
        {
          icon: Search,
          title: 'Step 3: Re-Scan',
          description: 'Re-scan the fixed Word document to identify only remaining issues (no duplicates - only issues that couldn\'t be auto-fixed)'
        },
        {
          icon: Sparkles,
          title: 'Step 4: AI Guidance',
          description: 'Generate AI-powered remediation suggestions only for remaining issues that require manual intervention'
        },
        {
          icon: Download,
          title: 'Download Auto-Fixed Word Document',
          description: 'Download the automatically fixed Word document with all improvements applied (alt text, summaries, metadata, headings, etc.)'
        }
      ]
    },
    PPT: {
      icon: Presentation,
      title: 'PowerPoint Presentations',
      steps: [
        {
          icon: Search,
          title: 'Accessibility Analysis',
          description: 'Comprehensive accessibility analysis of your PowerPoint presentation structure and content'
        },
        {
          icon: Sparkles,
          title: 'AI Remediation',
          description: 'Get detailed AI-powered step-by-step suggestions for fixing each accessibility issue found'
        },
        {
          icon: CheckCircle2,
          title: 'Track Issues',
          description: 'All detected issues are automatically added to your product backlog for tracking'
        }
      ]
    },
    HTML: {
      icon: FileCode,
      title: 'HTML Files',
      steps: [
        {
          icon: Search,
          title: 'Accessibility Analysis',
          description: 'Comprehensive accessibility analysis of your HTML document structure and content'
        },
        {
          icon: Sparkles,
          title: 'AI Remediation',
          description: 'Get detailed AI-powered step-by-step suggestions for fixing each accessibility issue found'
        },
        {
          icon: CheckCircle2,
          title: 'Track Issues',
          description: 'All detected issues are automatically added to your product backlog for tracking'
        }
      ]
    },
    Text: {
      icon: FileText,
      title: 'Text Files',
      steps: [
        {
          icon: Search,
          title: 'Accessibility Analysis',
          description: 'Comprehensive accessibility analysis of your text document structure and content'
        },
        {
          icon: Sparkles,
          title: 'AI Remediation',
          description: 'Get detailed AI-powered step-by-step suggestions for fixing each accessibility issue found'
        },
        {
          icon: CheckCircle2,
          title: 'Track Issues',
          description: 'All detected issues are automatically added to your product backlog for tracking'
        }
      ]
    }
  }

  const activeDocType = documentTypes[activeTab]
  const IconComponent = activeDocType.icon

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-4">What We Do</h2>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-3">
        {Object.entries(documentTypes).map(([key, docType]) => {
          const TabIcon = docType.icon
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              <span>{key}</span>
            </button>
          )
        })}
      </div>

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

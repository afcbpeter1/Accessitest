'use client'

import { useState } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Code,
  Eye,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Sparkles
} from 'lucide-react'
// import AddToBacklogButton from './AddToBacklogButton'
// import { useToast } from './Toast'

// Function to format AI suggestion descriptions with proper numbering and spacing
function formatSuggestionDescription(description: string) {
  if (!description) return description
  
  // Split by lines and process each line
  const lines = description.split('\n')
  let stepNumber = 1
  
  return lines.map((line, index) => {
    // Skip empty lines
    if (!line.trim()) {
      return <br key={index} />
    }
    
    // Check if line starts with a number followed by a period
    const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/)
    if (numberedMatch) {
      const [, number, content] = numberedMatch
      // Use consistent numbering starting from 1
      const formattedLine = `${stepNumber}. ${content.trim()}`
      stepNumber++
      return (
        <p key={index} className="mb-2">
          {formattedLine}
        </p>
      )
    }
    
    // For non-numbered lines, just return as is
    return (
      <p key={index} className="mb-2">
        {line.trim()}
      </p>
    )
  })
}


interface CollapsibleIssueProps {
  issueId: string
  ruleName: string
  description: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  wcag22Level: string
  help: string
  helpUrl: string
  totalOccurrences: number
  affectedUrls: string[]
  offendingElements: Array<{
    html: string
    target: string[]
    failureSummary: string
    impact: string
    url: string
    screenshot?: string
    boundingBox?: any
  }>
  suggestions: Array<{
    type: 'fix' | 'improvement' | 'warning'
    description: string
    codeExample?: string
    priority: 'high' | 'medium' | 'low'
  }>
  priority: 'high' | 'medium' | 'low'
  screenshots?: {
    fullPage?: string
    viewport?: string
    elements?: Array<{
      selector: string
      issueId: string
      severity: string
      screenshot: string
      boundingBox?: {
        x: number
        y: number
        width: number
        height: number
      }
    }>
  }
  savedAIResponses?: any[]
  scanId: string
  scanType?: 'web' | 'document'
}

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'critical': return 'text-red-800 bg-red-50 border-red-200'
    case 'serious': return 'text-orange-800 bg-orange-50 border-orange-200'
    case 'moderate': return 'text-yellow-800 bg-yellow-50 border-yellow-200'
    case 'minor': return 'text-blue-800 bg-blue-50 border-blue-200'
    default: return 'text-gray-800 bg-gray-50 border-gray-200'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50'
    case 'medium': return 'text-yellow-600 bg-yellow-50'
    case 'low': return 'text-blue-600 bg-blue-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}


export default function CollapsibleIssue({
  issueId,
  ruleName,
  description,
  impact,
  wcag22Level,
  help,
  helpUrl,
  totalOccurrences,
  affectedUrls,
  offendingElements,
  suggestions,
  priority,
  screenshots,
  savedAIResponses,
  scanId,
  scanType = 'web'
}: CollapsibleIssueProps) {
  console.log('🔍 CollapsibleIssue received scanType:', scanType, 'for issue:', issueId);
  const [isExpanded, setIsExpanded] = useState(false) // Start collapsed by default
  const [copied, setCopied] = useState(false)
  // const { showToast, ToastContainer } = useToast()

  const handleCopy = async () => {
    const issueText = `Issue: ${ruleName}
Description: ${description}
Impact: ${impact.toUpperCase()}
WCAG Level: ${wcag22Level}
Help: ${help}
Occurrences: ${totalOccurrences}
Affected URLs: ${affectedUrls.join(', ')}`
    
    try {
      await navigator.clipboard.writeText(issueText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Collapsible Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 focus:bg-gray-50 focus:outline-none"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        aria-expanded={isExpanded}
        aria-controls={`issue-content-${issueId}`}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} issue: ${ruleName}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="flex-shrink-0 text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-base font-semibold text-gray-900 break-words">{ruleName}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(impact)}`}>
                  {impact.toUpperCase()}
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                  WCAG 2.2 {wcag22Level}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(priority || 'medium')} bg-opacity-10`}>
                  {(priority || 'medium').toUpperCase()} PRIORITY
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {(affectedUrls || []).length} page{(affectedUrls || []).length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy()
              }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy issue details"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          id={`issue-content-${issueId}`}
          className="border-t border-gray-200 p-4 space-y-6"
          role="region"
          aria-label="Issue details and management"
        >
          {/* Issue Details - Only for web scans */}
          {scanType !== 'document' && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Issue Details</h4>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Description</label>
                    <div className="text-sm text-blue-900 mt-1 leading-relaxed">
                      {help}
                    </div>
                    {helpUrl && (
                      <a 
                        href={helpUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Learn more about this issue
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Offending Elements / Document Content */}
          {(offendingElements || []).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Offending Items ({(offendingElements || []).length})
              </h4>
              <div className="space-y-3">
                {(offendingElements || []).map((element, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-end mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(element.impact)}`}>
                        {element.impact.toUpperCase()}
                      </span>
                    </div>
                    {element.failureSummary && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-700 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          {formatSuggestionDescription(element.failureSummary)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screenshots */}
          {screenshots && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Visual Context
              </h4>
              
              {/* Website Screenshot */}
              {screenshots.viewport && (
                <div className="mb-4">
                  <div className="text-xs text-gray-600 mb-2">Website Screenshot:</div>
                  <div className="border border-gray-200 rounded overflow-hidden max-w-full">
                    <img 
                      src={screenshots.viewport}
                      alt={`Screenshot of ${affectedUrls[0]}`}
                      className="w-full h-auto max-h-40 sm:max-h-48 md:max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity rounded"
                      onClick={() => window.open(screenshots.viewport, '_blank')}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Click to view full size</div>
                </div>
              )}
              
              {/* Element Screenshots */}
              {screenshots?.elements && (screenshots.elements || []).length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Affected Elements:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {screenshots.elements.map((element, index) => (
                      <div key={index} className="border border-gray-200 rounded overflow-hidden">
                        <div className="p-2 bg-gray-50 text-xs text-gray-600">
                          {element.selector}
                        </div>
                        <img 
                          src={element.screenshot}
                          alt={`Screenshot of ${element.selector}`}
                          className="w-full h-auto max-h-24 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(element.screenshot, '_blank')}
                        />
                        <div className="p-1 text-xs text-gray-500 text-center">
                          Click to enlarge
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI-Generated Remediation */}
          {(suggestions || []).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI-Generated Fixes
              </h4>
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => {
                  // All suggestions are AI-powered since we use Claude API
                  const isAISuggestion = true;
                  
                  return (
                    <div key={index} className={`border rounded p-3 ${
                      isAISuggestion 
                        ? 'border-purple-300 bg-purple-100' 
                        : 'border-blue-300 bg-blue-100'
                    }`}>
                      <div className="flex items-start gap-3">
                        {isAISuggestion ? (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center">
                              <Sparkles className="h-3 w-3 text-purple-800" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                              <Code className="h-3 w-3 text-blue-800" />
                            </div>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isAISuggestion && (
                              <span className="px-2 py-1 text-xs font-medium bg-purple-200 text-purple-900 rounded-full border border-purple-300">
                                AI SUGGESTION
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {suggestion.type}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(suggestion.priority || 'medium')}`}>
                              {(suggestion.priority || 'medium').toUpperCase()} PRIORITY
                            </span>
                          </div>
                          <div className={`mb-3 ${
                            isAISuggestion ? 'text-purple-900 font-medium' : 'text-gray-800'
                          }`}>
                            {formatSuggestionDescription(suggestion.description)}
                          </div>
                          {suggestion.codeExample && (
                            <div>
                              <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                                <Code className="h-4 w-4" />
                                {isAISuggestion ? 'Specific Code Fix:' : 'Code Example:'}
                              </p>
                              <pre className="rounded p-3 text-sm break-words max-w-full bg-gray-900 text-white">
                                <code>{suggestion.codeExample}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      )}
      {/* <ToastContainer /> */}
    </div>
  )
}
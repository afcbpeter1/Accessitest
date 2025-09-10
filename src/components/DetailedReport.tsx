import React from 'react';
import { AlertTriangle, CheckCircle, Info, Code, ExternalLink, FileText, Sparkles } from 'lucide-react';

interface OffendingElement {
  html: string;
  target: string[];
  failureSummary: string;
  impact: string;
  url: string;
  screenshot?: string; // Base64 encoded screenshot of the element
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface RemediationSuggestion {
  type: 'fix' | 'improvement' | 'warning';
  description: string;
  codeExample?: string;
  priority: 'high' | 'medium' | 'low';
}

interface DetailedReportProps {
  issueId: string;
  ruleName: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  wcag22Level: string;
  help: string;
  helpUrl: string;
  totalOccurrences: number;
  affectedUrls: string[];
  offendingElements: OffendingElement[];
  suggestions: RemediationSuggestion[];
  priority: 'high' | 'medium' | 'low';
  screenshots?: {
    fullPage?: string;
    viewport?: string;
    elements?: Array<{
      selector: string;
      issueId: string;
      severity: string;
      screenshot: string;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  };
}

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'critical': return 'text-red-800 bg-red-50 border-red-200';
    case 'serious': return 'text-orange-800 bg-orange-50 border-orange-200';
    case 'moderate': return 'text-yellow-800 bg-yellow-50 border-yellow-200';
    case 'minor': return 'text-blue-800 bg-blue-50 border-blue-200';
    default: return 'text-gray-800 bg-gray-50 border-gray-200';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'text-red-800';
    case 'medium': return 'text-yellow-800';
    case 'low': return 'text-blue-800';
    default: return 'text-gray-800';
  }
};

const getSuggestionIcon = (type: string) => {
  switch (type) {
    case 'fix': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'improvement': return <Info className="h-4 w-4 text-blue-600" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default: return <Info className="h-4 w-4 text-gray-600" />;
  }
};

export default function DetailedReport({
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
  screenshots
}: DetailedReportProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{ruleName}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(impact || 'minor')}`}>
              {(impact || 'minor').toUpperCase()}
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
              WCAG 2.2 {wcag22Level || 'A'}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(priority || 'medium')} bg-opacity-10`}>
              {(priority || 'medium').toUpperCase()} PRIORITY
            </span>
          </div>
          <p className="text-gray-600 mb-2">{description || 'No description available'}</p>
          <p className="text-sm text-gray-500 mb-3">{help || 'No help text available'}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              {affectedUrls.length} page{affectedUrls.length !== 1 ? 's' : ''} affected
            </span>
          </div>
        </div>
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
        >
          Learn More
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Screenshots */}
      {screenshots && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Visual Context
          </h4>
          
          {/* Website Screenshot */}
          {screenshots.viewport && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Website Screenshot:</div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <img 
                  src={`data:image/png;base64,${screenshots.viewport}`}
                  alt={`Screenshot of ${affectedUrls[0]}`}
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
            </div>
          )}
          
          {/* Element Screenshots */}
          {screenshots.elements && screenshots.elements.length > 0 && (
            <div>
              <div className="text-sm text-gray-600 mb-2">Affected Elements:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screenshots.elements
                  .filter(el => el.issueId === issueId)
                  .map((element, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={`data:image/png;base64,${element.screenshot}`}
                        alt={`Screenshot showing ${ruleName} issue`}
                        className="w-full h-auto max-h-32 object-contain"
                      />
                      {element.boundingBox && (
                        <div className="p-2 bg-gray-50 text-xs text-gray-500">
                          Position: {Math.round(element.boundingBox.x)}, {Math.round(element.boundingBox.y)}
                          ({Math.round(element.boundingBox.width)}×{Math.round(element.boundingBox.height)}px)
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offending Elements */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          Offending Elements ({offendingElements.length})
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {offendingElements.map((element, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {element.url}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(element.impact)}`}>
                  {element.impact}
                </span>
              </div>
              <div className="mb-2">
                <p className="text-sm text-gray-600 mb-1">HTML Element:</p>
                <pre className="bg-white border border-gray-300 rounded p-2 text-xs overflow-x-auto">
                  <code>{element.html}</code>
                </pre>
              </div>
              <div className="mb-2">
                <p className="text-sm text-gray-600 mb-1">CSS Selector:</p>
                <code className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                  {element.target.join(' ')}
                </code>
              </div>
              
            </div>
          ))}
        </div>
      </div>

      {/* Remediation Suggestions */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          How to Fix ({suggestions.length} suggestions)
        </h4>
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => {
            // Check if this is an AI-powered contextual suggestion
            const isAISuggestion = suggestion.description.length > 100 && 
              (suggestion.description.includes('#') || 
               suggestion.description.includes('Accessibility Fix:') ||
               suggestion.description.includes('Brief explanation') ||
               suggestion.description.includes('Issue Explanation') ||
               suggestion.description.includes('Specific Code Fix') ||
               suggestion.description.includes('Why this fix improves') ||
               suggestion.description.includes('Alternative approaches') ||
               suggestion.description.includes('This improves accessibility'));
            
            return (
              <div key={index} className={`border rounded-lg p-4 ${
                isAISuggestion 
                  ? 'border-purple-200 bg-purple-50' 
                  : 'border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  {isAISuggestion ? (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>
                  ) : (
                    getSuggestionIcon(suggestion.type)
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isAISuggestion && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                          AI SUGGESTION
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {suggestion.type}
                      </span>
                    </div>
                    <p className={`mb-3 ${
                      isAISuggestion ? 'text-purple-900 font-medium' : 'text-gray-700'
                    }`}>
                      {suggestion.description}
                    </p>
                    {suggestion.codeExample && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <Code className="h-4 w-4" />
                          {isAISuggestion ? 'Specific Code Fix:' : 'Code Example:'}
                        </p>
                        <pre className="rounded p-3 text-sm overflow-x-auto bg-gray-900 text-white">
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

      {/* Affected Pages */}
      {affectedUrls.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-900 mb-2">Affected Pages</h4>
          <div className="flex flex-wrap gap-2">
            {affectedUrls.map((url, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border"
              >
                {url}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

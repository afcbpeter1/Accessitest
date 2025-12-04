/**
 * Adobe PDF Services API Integration using Node.js SDK
 * 
 * Uses the official @adobe/pdfservices-node-sdk package which handles
 * the async job-based workflow automatically.
 * 
 * Documentation: https://developer.adobe.com/document-services/docs/overview/pdf-accessibility-auto-tag-api/
 */

import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  AutotagPDFParams,
  AutotagPDFJob,
  AutotagPDFResult,
  PDFAccessibilityCheckerJob,
  PDFAccessibilityCheckerResult,
  PDFAccessibilityCheckerParams,
} from '@adobe/pdfservices-node-sdk'
import { Readable } from 'stream'

export interface AdobePDFServicesConfig {
  clientId: string
  clientSecret: string
  organizationId?: string
  accountId?: string
}

export interface AutoTagResult {
  success: boolean
  taggedPdfBuffer?: Buffer
  reportBuffer?: Buffer // XLSX report
  error?: string
  message?: string
}

export interface AccessibilityCheckResult {
  success: boolean
  compliant: boolean
  report?: {
    summary: {
      totalIssues: number
      criticalIssues: number
      warnings: number
      passed: number
      needsManualCheck?: number
      failed?: number
      skipped?: number
    }
    // Detailed report by category (like Acrobat's report)
    categories?: {
      [categoryName: string]: Array<{
        ruleName: string
        status: 'Passed' | 'Failed' | 'Needs manual check' | 'Skipped'
        description: string
        page?: number
        location?: string
      }>
    }
    issues: Array<{
      type: 'error' | 'warning' | 'info'
      rule: string
      description: string
      page?: number
      location?: string
      category?: string
      status?: 'Passed' | 'Failed' | 'Needs manual check' | 'Skipped'
    }>
  }
  error?: string
}

export class AdobePDFServices {
  private config: AdobePDFServicesConfig
  private pdfServices: PDFServices | null = null

  constructor(config: AdobePDFServicesConfig) {
    this.config = config
    console.log('🔧 AdobePDFServices constructor called with:', {
      hasClientId: !!config.clientId,
      hasClientSecret: !!config.clientSecret,
    })
    
    // Initialize PDF Services SDK
    try {
      const credentials = new ServicePrincipalCredentials({
        clientId: config.clientId,
        clientSecret: config.clientSecret
      })
      
      this.pdfServices = new PDFServices({ credentials })
      console.log('✅ Adobe PDF Services SDK initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Adobe PDF Services SDK:', error)
      this.pdfServices = null
    }
  }

  /**
   * Convert Buffer to Readable stream (required by SDK)
   */
  private bufferToStream(buffer: Buffer): Readable {
    return Readable.from(buffer)
  }

  /**
   * Convert Readable stream to Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  /**
   * Automatically tag a PDF for accessibility using Adobe's Auto-Tag API
   * Uses the official Node.js SDK which handles the async job workflow
   */
  async autoTagPDF(pdfBuffer: Buffer): Promise<AutoTagResult> {
    try {
      if (!this.pdfServices) {
        throw new Error('PDF Services SDK not initialized')
      }

      console.log(`📤 Starting Adobe Auto-Tag using SDK...`)
      console.log(`📄 PDF size: ${pdfBuffer.length} bytes`)

      // Step 1: Upload the PDF asset
      console.log(`📤 Step 1: Uploading PDF asset...`)
      const readStream = this.bufferToStream(pdfBuffer)
      const inputAsset = await this.pdfServices.upload({
        readStream,
        mimeType: MimeType.PDF
      })
      console.log(`✅ PDF uploaded successfully`)

      // Step 2: Create parameters and job
      console.log(`📤 Step 2: Creating auto-tag job with parameters...`)
      const params = new AutotagPDFParams({
        generateReport: true,  // Generate XLSX report
        shiftHeadings: true    // Shift headings so document title is only H1
      })

      // Creates a new job instance with inputAsset and params
      const autotagPdfJob = new AutotagPDFJob({ inputAsset, params })

      // Step 3: Submit job and wait for result
      console.log(`📤 Step 3: Submitting job and waiting for result...`)
      const pollingURL = await this.pdfServices.submit({ job: autotagPdfJob })
      console.log(`✅ Job submitted, polling for result...`)
      
      const pdfServicesResponse = await this.pdfServices.getJobResult({
        pollingURL,
        resultType: AutotagPDFResult
      })

      console.log(`✅ Job completed successfully`)

      // Step 4: Download the tagged PDF
      console.log(`📤 Step 4: Downloading tagged PDF...`)
      const resultAsset = pdfServicesResponse.result.taggedPDF
      const streamAsset = await this.pdfServices.getContent({ asset: resultAsset })
      const taggedPdfBuffer = await this.streamToBuffer(streamAsset.readStream)
      console.log(`✅ Downloaded tagged PDF (${taggedPdfBuffer.length} bytes)`)

      // Step 5: Download the report (optional)
      let reportBuffer: Buffer | undefined
      if (pdfServicesResponse.result.report) {
        console.log(`📤 Step 5: Downloading tagging report...`)
        const resultAssetReport = pdfServicesResponse.result.report
        const streamAssetReport = await this.pdfServices.getContent({ asset: resultAssetReport })
        reportBuffer = await this.streamToBuffer(streamAssetReport.readStream)
        console.log(`✅ Downloaded report (${reportBuffer.length} bytes)`)
      }

      return {
        success: true,
        taggedPdfBuffer,
        reportBuffer,
        message: 'PDF successfully auto-tagged by Adobe'
      }
       
    } catch (error: any) {
      console.error('❌ Adobe Auto-Tag API error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack?.substring(0, 500)
      })
      
      return {
        success: false,
        error: error.message || 'Failed to auto-tag PDF',
        message: `Adobe Auto-Tag API error: ${error.message}`
      }
    }
  }

  /**
   * Check PDF accessibility using Adobe's Accessibility Checker API
   * Uses the official Node.js SDK
   * 
   * This runs a comprehensive accessibility check covering:
   * - Document structure (tags, reading order, language)
   * - Page content (alt text, color contrast, fonts)
   * - Form fields (labels, tab order)
   * - All pages in the document (unless page range specified)
   * 
   * The API checks against PDF/UA and WCAG 2.1 AA standards
   * 
   * @param pdfBuffer - The PDF file buffer to check
   * @param options - Optional configuration (pageStart, pageEnd for page range)
   */
  async checkAccessibility(
    pdfBuffer: Buffer, 
    options?: { pageStart?: number; pageEnd?: number }
  ): Promise<AccessibilityCheckResult> {
    try {
      if (!this.pdfServices) {
        throw new Error('PDF Services SDK not initialized')
      }

      console.log(`📤 Starting Adobe Accessibility Check using SDK...`)
      console.log(`📄 PDF size: ${pdfBuffer.length} bytes`)

      // Step 1: Upload the PDF asset
      console.log(`📤 Step 1: Uploading PDF asset...`)
      const readStream = this.bufferToStream(pdfBuffer)
      const inputAsset = await this.pdfServices.upload({
        readStream,
        mimeType: MimeType.PDF
      })
      console.log(`✅ PDF uploaded successfully`)

      // Step 2: Create and submit the accessibility check job
      // By default, checks ALL pages and ALL accessibility categories:
      // - Document structure (tags, reading order, language, title, bookmarks)
      // - Page content (alt text, color contrast, fonts, text language)
      // - Form fields (labels, tab order, field properties)
      // - All WCAG 2.1 AA and PDF/UA compliance checks
      console.log(`📤 Step 2: Creating comprehensive accessibility check job (all pages, all checks)...`)
      
      const paramsOptions: any = {}
      // If page range is specified, use it; otherwise check all pages (default)
      if (options?.pageStart && options?.pageEnd) {
        paramsOptions.pageStart = options.pageStart
        paramsOptions.pageEnd = options.pageEnd
        console.log(`   Checking pages ${options.pageStart} to ${options.pageEnd}`)
      } else {
        console.log(`   Checking all pages in document`)
      }
      
      const params = new PDFAccessibilityCheckerParams(paramsOptions)
      const checkAccessibilityJob = new PDFAccessibilityCheckerJob({ inputAsset, params })

      // Submit job and wait for result
      const pollingURL = await this.pdfServices.submit({ job: checkAccessibilityJob })
      console.log(`✅ Job submitted, polling for result...`)
      
      const pdfServicesResponse = await this.pdfServices.getJobResult({
        pollingURL,
        resultType: PDFAccessibilityCheckerResult
      })

      console.log(`✅ Job completed successfully`)

      // Step 3: Get the accessibility report
      // The report is ALWAYS an asset that needs to be downloaded
      let parsedReport: any
      
      // Log the FULL result structure for debugging - CRITICAL for troubleshooting
      console.log('📋 PDF Services Response structure (COMPLETE):')
      console.log('   Result type:', typeof pdfServicesResponse.result)
      console.log('   Result keys:', Object.keys(pdfServicesResponse.result || {}))
      console.log('   Has report:', !!pdfServicesResponse.result?.report)
      console.log('   Full result (COMPLETE, no truncation):', JSON.stringify(pdfServicesResponse.result, null, 2))
      
      // Also log the full response object to see if report is elsewhere
      console.log('📋 Full PDF Services Response (COMPLETE):')
      console.log(JSON.stringify(pdfServicesResponse, null, 2))
      
      // CRITICAL: The report is in result._report (with underscore), which is an asset reference
      // We MUST download it to get the actual JSON report
      // The structure is: result._report (not result.report)
      const reportAsset = pdfServicesResponse.result?._report || pdfServicesResponse.result?.report
      
      if (!reportAsset) {
        console.error('❌ NO REPORT ASSET FOUND!')
        console.error('   Result structure:', JSON.stringify(pdfServicesResponse.result, null, 2))
        throw new Error('No report asset found in PDF Services response - cannot generate accessibility report')
      }
      
      console.log('📦 Report asset found:')
      console.log('   Type:', typeof reportAsset)
      console.log('   Keys:', typeof reportAsset === 'object' ? Object.keys(reportAsset) : 'N/A')
      console.log('   Full asset:', JSON.stringify(reportAsset, null, 2))
      
      // ALWAYS download the report - it's never embedded
      console.log(`📤 Step 3: Downloading accessibility report from asset...`)
      
      // Try SDK getContent first
      let reportDownloaded = false
      try {
        console.log('   Attempting SDK getContent...')
        const streamAsset = await this.pdfServices.getContent({ asset: reportAsset })
        const reportBuffer = await this.streamToBuffer(streamAsset.readStream)
        const reportText = reportBuffer.toString('utf8')
        console.log(`✅ Report downloaded via SDK (${reportBuffer.length} bytes)`)
        console.log(`   Report preview (first 1000 chars):`, reportText.substring(0, 1000))
        
        if (reportText.length < 100) {
          throw new Error(`Report too short (${reportText.length} bytes) - likely not the actual report`)
        }
        
        parsedReport = JSON.parse(reportText)
        reportDownloaded = true
        console.log(`✅ Report parsed successfully from SDK`)
      } catch (sdkError: any) {
        console.error('❌ SDK getContent failed:', sdkError.message)
        console.error('   Error stack:', sdkError.stack?.substring(0, 500))
        
        // Fallback: try downloading from _downloadURI directly
        if (reportAsset && typeof reportAsset === 'object') {
          if ('_downloadURI' in reportAsset && typeof reportAsset._downloadURI === 'string') {
            const downloadURI = reportAsset._downloadURI
            console.log(`📤 Attempting direct download from URI...`)
            console.log(`   URI (first 150 chars): ${downloadURI.substring(0, 150)}...`)
            try {
              const response = await fetch(downloadURI)
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
              }
              const reportText = await response.text()
              console.log(`✅ Report downloaded from URI (${reportText.length} bytes)`)
              console.log(`   Report preview (first 1000 chars):`, reportText.substring(0, 1000))
              
              if (reportText.length < 100) {
                throw new Error(`Report too short (${reportText.length} bytes) - likely not the actual report`)
              }
              
              parsedReport = JSON.parse(reportText)
              reportDownloaded = true
              console.log(`✅ Report parsed successfully from URI`)
            } catch (uriError: any) {
              console.error('❌ Failed to download from URI:', uriError.message)
              console.error('   Error details:', uriError)
              throw new Error(`Failed to download report from URI: ${uriError.message}`)
            }
          } else if ('_assetId' in reportAsset) {
            console.error('❌ Report asset has _assetId but no _downloadURI')
            console.error('   Asset structure:', JSON.stringify(reportAsset, null, 2))
            throw new Error('Report asset has _assetId but no _downloadURI - cannot download report')
          } else {
            console.error('❌ Report asset structure unknown')
            console.error('   Asset:', JSON.stringify(reportAsset, null, 2))
            throw new Error('Report asset structure is not recognized - cannot download report')
          }
        } else {
          throw new Error(`Report asset is not an object: ${typeof reportAsset}`)
        }
      }
      
      if (!reportDownloaded || !parsedReport) {
        throw new Error('Report download failed - no report data available')
      }

      // Log the FULL parsed report for debugging
      console.log('📄 Parsed accessibility report structure:')
      console.log('   Top-level keys:', Object.keys(parsedReport))
      console.log('   Full report (COMPLETE):', JSON.stringify(parsedReport, null, 2))
      
      // Validate we got actual report data
      if (!parsedReport || Object.keys(parsedReport).length === 0) {
        console.error('❌ Report is EMPTY!')
        throw new Error('Report download succeeded but returned empty data')
      }
      
      // Check for all possible report structures (Adobe uses "Detailed Report" and "Summary")
      const detailedReport = parsedReport['Detailed Report'] || parsedReport.detailedReport || parsedReport.detailed_report
      const reportSummary = parsedReport.Summary || parsedReport.summary
      
      console.log('   Has "Detailed Report":', !!detailedReport)
      console.log('   Has "Summary":', !!reportSummary)
      console.log('   Has categories:', !!parsedReport.categories)
      console.log('   Has document:', !!parsedReport.document)
      console.log('   Has pageContent:', !!parsedReport.pageContent)
      console.log('   Has forms:', !!parsedReport.forms)
      console.log('   Has alternateText:', !!parsedReport.alternateText)
      console.log('   Has tables:', !!parsedReport.tables)
      console.log('   Has lists:', !!parsedReport.lists)
      console.log('   Has headings:', !!parsedReport.headings)
      console.log('   Has issues:', !!parsedReport.issues)
      console.log('   Has checks:', !!parsedReport.checks)
      console.log('   Has results:', !!parsedReport.results)
      console.log('   Has violations:', !!parsedReport.violations)
      console.log('   Has summary:', !!parsedReport.summary)
      
      if (reportSummary) {
        console.log('   Summary:', JSON.stringify(reportSummary, null, 2))
      }
      
      // Check if report has any actual content
      // Adobe's structure: { "Summary": {...}, "Detailed Report": { "Document": [...], ... } }
      const hasContent = detailedReport || 
                        reportSummary ||
                        parsedReport.categories || 
                        parsedReport.document || 
                        parsedReport.pageContent || 
                        parsedReport.issues || 
                        parsedReport.checks ||
                        parsedReport.results
      
      if (!hasContent) {
        console.error('❌ Report has no content!')
        console.error('   Report structure:', JSON.stringify(parsedReport, null, 2))
        console.error('   Top-level keys:', Object.keys(parsedReport))
        throw new Error('Report downloaded but contains no accessibility check data')
      }
      
      console.log('✅ Report validation passed - has content')
      
      // Determine if PDF is compliant
      const compliant = (parsedReport.summary?.criticalIssues || 0) === 0 && 
                       (parsedReport.summary?.warnings || 0) === 0

      // Extract ALL checks from the report - Adobe's report may have different structures
      // The report might have categories with all checks (Passed, Failed, Needs manual check, Skipped)
      let allChecks: any[] = []
      let categories: { [key: string]: any[] } = {}
      
      // detailedReport and reportSummary are already defined above in validation section
      // First, try to extract categories from "Detailed Report" (Adobe's actual structure)
      if (detailedReport && typeof detailedReport === 'object') {
        // Adobe uses category names as keys: "Document", "Page Content", "Forms", etc.
        categories = detailedReport
        console.log('✅ Found categories in "Detailed Report":', Object.keys(categories))
      } else if (parsedReport.categories) {
        categories = parsedReport.categories
      } else if (parsedReport.document || parsedReport.pageContent || parsedReport.forms) {
        // Group by category if report has category sections
        categories = {
          'Document': parsedReport.document || [],
          'Page Content': parsedReport.pageContent || [],
          'Forms': parsedReport.forms || [],
          'Alternate Text': parsedReport.alternateText || [],
          'Tables': parsedReport.tables || [],
          'Lists': parsedReport.lists || [],
          'Headings': parsedReport.headings || []
        }
      }
      
      // Extract all checks from categories
      // Adobe uses "Status" (capital S) and "Rule" (capital R) in the report
      if (Object.keys(categories).length > 0) {
        Object.keys(categories).forEach(categoryName => {
          const categoryChecks = categories[categoryName]
          if (Array.isArray(categoryChecks)) {
            categoryChecks.forEach((check: any) => {
              // Normalize status - Adobe uses "Status" (capital S)
              const statusValue = check.Status || check.status
              let normalizedStatus = statusValue
              if (statusValue) {
                const statusStr = String(statusValue)
                if (statusStr === 'Failed' || statusStr.toLowerCase().includes('failed')) {
                  normalizedStatus = 'Failed'
                } else if (statusStr === 'Needs manual check' || statusStr.toLowerCase().includes('manual') || statusStr.toLowerCase().includes('needs')) {
                  normalizedStatus = 'Needs manual check'
                } else if (statusStr === 'Skipped' || statusStr.toLowerCase().includes('skipped')) {
                  normalizedStatus = 'Skipped'
                } else if (statusStr === 'Passed' || statusStr.toLowerCase().includes('passed')) {
                  normalizedStatus = 'Passed'
                }
              }
              
              allChecks.push({
                ...check,
                category: categoryName,
                status: normalizedStatus || statusValue,
                // Also normalize rule name - Adobe uses "Rule" (capital R)
                rule: check.Rule || check.rule || check.ruleName,
                ruleName: check.Rule || check.rule || check.ruleName,
                description: check.Description || check.description
              })
            })
          }
        })
        console.log(`📊 Extracted ${allChecks.length} total checks from ${Object.keys(categories).length} categories`)
      }
      
      // Also try to extract from other report formats
      if (parsedReport.issues && Array.isArray(parsedReport.issues)) {
        allChecks.push(...parsedReport.issues)
      } else if (parsedReport.checks && Array.isArray(parsedReport.checks)) {
        allChecks.push(...parsedReport.checks)
      } else if (parsedReport.violations && Array.isArray(parsedReport.violations)) {
        allChecks.push(...parsedReport.violations)
      } else if (parsedReport.results && Array.isArray(parsedReport.results)) {
        allChecks.push(...parsedReport.results)
      }
      
      // If we still don't have categories, try to build them from checks
      if (Object.keys(categories).length === 0 && allChecks.length > 0) {
        const categoryMap: { [key: string]: any[] } = {}
        allChecks.forEach((check: any) => {
          const category = check.category || check.section || 'Other'
          if (!categoryMap[category]) {
            categoryMap[category] = []
          }
          categoryMap[category].push(check)
        })
        if (Object.keys(categoryMap).length > 0) {
          categories = categoryMap
        }
      }
      
      // Extract ALL checks from categories first (this is the primary source)
      // Adobe's report has all checks in "Detailed Report" categories
      if (Object.keys(categories).length > 0) {
        Object.keys(categories).forEach(categoryName => {
          const categoryChecks = categories[categoryName]
          if (Array.isArray(categoryChecks)) {
            // Add all checks from this category to allChecks
            categoryChecks.forEach((check: any) => {
              // Normalize status - Adobe uses "Status" (capital S)
              const statusValue = check.Status || check.status
              let normalizedStatus = statusValue
              if (statusValue) {
                const statusStr = String(statusValue)
                if (statusStr === 'Failed' || statusStr.toLowerCase().includes('failed')) {
                  normalizedStatus = 'Failed'
                } else if (statusStr === 'Needs manual check' || statusStr.toLowerCase().includes('manual') || statusStr.toLowerCase().includes('needs')) {
                  normalizedStatus = 'Needs manual check'
                } else if (statusStr === 'Skipped' || statusStr.toLowerCase().includes('skipped')) {
                  normalizedStatus = 'Skipped'
                } else if (statusStr === 'Passed' || statusStr.toLowerCase().includes('passed')) {
                  normalizedStatus = 'Passed'
                }
              }
              
              allChecks.push({
                ...check,
                category: categoryName,
                status: normalizedStatus || statusValue
              })
            })
          }
        })
        console.log(`📊 Extracted ${allChecks.length} total checks from ${Object.keys(categories).length} categories`)
      }
      
      // Filter to only get issues (Failed, Needs manual check) - not Passed or Skipped
      const issues = allChecks.filter((check: any) => {
        const status = check.status || check.Status || (check.passed === false ? 'Failed' : check.passed === true ? 'Passed' : 'Unknown')
        return status === 'Failed' || status === 'Needs manual check' || status === 'Failed manually'
      })
      
      console.log(`📊 Filtered to ${issues.length} issues (Failed + Needs manual check) from ${allChecks.length} total checks`)
      
      // Map issues to our format with status
      // Adobe uses "Status" (capital S) and "Rule" (capital R)
      const mappedIssues = issues.map((check: any) => {
        // Determine status - Adobe uses "Status" (capital S)
        const statusValue = check.Status || check.status
        let status: 'Passed' | 'Failed' | 'Needs manual check' | 'Skipped' = 'Failed'
        
        if (statusValue) {
          // Normalize status values - Adobe uses exact strings like "Failed", "Passed", "Needs manual check"
          const statusStr = String(statusValue)
          if (statusStr === 'Failed' || statusStr.toLowerCase().includes('failed') || statusStr === 'error') {
            status = 'Failed'
          } else if (statusStr === 'Needs manual check' || statusStr.toLowerCase().includes('manual') || statusStr.toLowerCase().includes('needs')) {
            status = 'Needs manual check'
          } else if (statusStr === 'Skipped' || statusStr.toLowerCase().includes('skipped')) {
            status = 'Skipped'
          } else if (statusStr === 'Passed' || statusStr.toLowerCase().includes('passed')) {
            status = 'Passed'
          } else {
            status = statusValue as any
          }
        } else if (check.passed === false) {
          status = 'Failed'
        } else if (check.passed === true) {
          status = 'Passed'
        } else if (check.type === 'error' || check.severity === 'error') {
          status = 'Failed'
        } else if (check.type === 'warning' || check.severity === 'warning') {
          status = 'Needs manual check'
        }
        
        // Adobe uses "Rule" (capital R) not "rule"
        const ruleName = check.Rule || check.rule || check.ruleName || check.check || check.name || 'Unknown'
        const description = check.Description || check.description || check.message || check.detail || 'No description'
        
        // Try to extract location from various fields, or infer from description
        let location = check.location || check.Location || check.context || check.elementLocation || check.objLocation
        if (!location || location === 'Unknown location') {
          // Try to extract location info from description
          // Adobe descriptions often contain location hints like "on page X" or "in section Y"
          const pageMatch = description.match(/page\s+(\d+)/i)
          const sectionMatch = description.match(/(?:in|at|within)\s+([^,\.]+)/i)
          if (pageMatch) {
            location = `Page ${pageMatch[1]}`
          } else if (sectionMatch) {
            location = sectionMatch[1].trim()
          } else {
            // Use rule name as location hint if available
            location = ruleName !== 'Unknown' ? ruleName : 'Document'
          }
        }
        
        // Try to extract element content from description if not provided
        let elementContent = check.elementContent || check.content || check.text
        if (!elementContent) {
          // Some Adobe descriptions contain the actual text/content
          // Look for quoted text or specific content patterns
          const quotedMatch = description.match(/"([^"]+)"/)
          const contentMatch = description.match(/(?:text|content|says?):\s*([^,\.]+)/i)
          if (quotedMatch) {
            elementContent = quotedMatch[1]
          } else if (contentMatch) {
            elementContent = contentMatch[1].trim()
          }
        }
        
        // Determine element type from rule name or description if not provided
        let elementType = check.elementType || check.type || check.objType || check.objectType
        if (!elementType) {
          // Infer from rule name or description
          const ruleLower = ruleName.toLowerCase()
          const descLower = description.toLowerCase()
          if (ruleLower.includes('figure') || ruleLower.includes('image') || descLower.includes('image') || descLower.includes('figure')) {
            elementType = 'Figure/Image'
          } else if (ruleLower.includes('table') || descLower.includes('table')) {
            elementType = 'Table'
          } else if (ruleLower.includes('heading') || descLower.includes('heading')) {
            elementType = 'Heading'
          } else if (ruleLower.includes('list') || descLower.includes('list')) {
            elementType = 'List'
          } else if (ruleLower.includes('form') || descLower.includes('form')) {
            elementType = 'Form Field'
          } else if (ruleLower.includes('link') || descLower.includes('link')) {
            elementType = 'Link'
          } else if (ruleLower.includes('text') || descLower.includes('text')) {
            elementType = 'Text'
          }
        }
        
        return {
          type: check.type || check.severity || (status === 'Failed' ? 'error' : status === 'Needs manual check' ? 'warning' : 'info'),
          rule: ruleName,
          ruleName: ruleName, // Also include as ruleName for compatibility
          description: description,
          page: check.page || check.Page || check.pageNumber || check.pageNum,
          location: location,
          // Element-level identification
          elementId: check.elementId || check.id || check.objId || check.objectId,
          elementType: elementType,
          elementContent: elementContent,
          elementTag: check.tag || check.elementTag,
          // Additional context
          category: check.category || check.section || 'Other',
          status: status
        }
      })
      
      // Map categories to Acrobat-style format (include ALL checks, not just failures)
      // Adobe uses "Status" (capital S) and "Rule" (capital R) and "Description" (capital D)
      const mappedCategories: { [key: string]: any[] } = {}
      Object.keys(categories).forEach(categoryName => {
        mappedCategories[categoryName] = categories[categoryName].map((item: any) => {
          // Determine status - Adobe uses "Status" (capital S)
          const statusValue = item.Status || item.status
          let status: 'Passed' | 'Failed' | 'Needs manual check' | 'Skipped' = 'Passed'
          
          if (statusValue) {
            const statusStr = String(statusValue)
            if (statusStr === 'Failed' || statusStr.toLowerCase().includes('failed') || statusStr === 'error') {
              status = 'Failed'
            } else if (statusStr === 'Needs manual check' || statusStr.toLowerCase().includes('manual') || statusStr.toLowerCase().includes('needs')) {
              status = 'Needs manual check'
            } else if (statusStr === 'Skipped' || statusStr.toLowerCase().includes('skipped')) {
              status = 'Skipped'
            } else if (statusStr === 'Passed' || statusStr.toLowerCase().includes('passed')) {
              status = 'Passed'
            } else {
              status = statusValue as any
            }
          } else if (item.passed === false) {
            status = 'Failed'
          } else if (item.passed === true) {
            status = 'Passed'
          }
          
          // Adobe uses "Rule" (capital R) and "Description" (capital D)
          const ruleName = item.Rule || item.rule || item.ruleName || item.name || 'Unknown'
          const description = item.Description || item.description || item.message || 'No description'
          
          // Try to extract location from various fields, or infer from description
          let location = item.location || item.Location || item.context || item.elementLocation || item.objLocation
          if (!location) {
            // Try to extract location info from description
            const pageMatch = description.match(/page\s+(\d+)/i)
            const sectionMatch = description.match(/(?:in|at|within)\s+([^,\.]+)/i)
            if (pageMatch) {
              location = `Page ${pageMatch[1]}`
            } else if (sectionMatch) {
              location = sectionMatch[1].trim()
            } else {
              location = ruleName !== 'Unknown' ? ruleName : 'Document'
            }
          }
          
          // Try to extract element content from description if not provided
          let elementContent = item.elementContent || item.content || item.text
          if (!elementContent) {
            const quotedMatch = description.match(/"([^"]+)"/)
            const contentMatch = description.match(/(?:text|content|says?):\s*([^,\.]+)/i)
            if (quotedMatch) {
              elementContent = quotedMatch[1]
            } else if (contentMatch) {
              elementContent = contentMatch[1].trim()
            }
          }
          
          // Determine element type from rule name or description if not provided
          let elementType = item.elementType || item.type || item.objType || item.objectType
          if (!elementType) {
            const ruleLower = ruleName.toLowerCase()
            const descLower = description.toLowerCase()
            if (ruleLower.includes('figure') || ruleLower.includes('image') || descLower.includes('image') || descLower.includes('figure')) {
              elementType = 'Figure/Image'
            } else if (ruleLower.includes('table') || descLower.includes('table')) {
              elementType = 'Table'
            } else if (ruleLower.includes('heading') || descLower.includes('heading')) {
              elementType = 'Heading'
            } else if (ruleLower.includes('list') || descLower.includes('list')) {
              elementType = 'List'
            } else if (ruleLower.includes('form') || descLower.includes('form')) {
              elementType = 'Form Field'
            } else if (ruleLower.includes('link') || descLower.includes('link')) {
              elementType = 'Link'
            } else if (ruleLower.includes('text') || descLower.includes('text')) {
              elementType = 'Text'
            }
          }
          
          return {
            ruleName: ruleName,
            status: status,
            description: description,
            page: item.page || item.Page || item.pageNumber || item.pageNum,
            location: location,
            // Element-level identification
            elementId: item.elementId || item.id || item.objId || item.objectId,
            elementType: elementType,
            elementContent: elementContent,
            elementTag: item.tag || item.elementTag
          }
        })
      })

      // Calculate summary statistics from ALL checks in categories (not just issues)
      // Adobe's summary is in "Summary" (capital S) with keys like "Failed", "Passed", "Needs manual check"
      let failedCount = 0
      let passedCount = 0
      let needsManualCheckCount = 0
      let skippedCount = 0
      
      // Use Adobe's Summary if available (it's accurate)
      if (reportSummary) {
        failedCount = reportSummary.Failed || reportSummary.failed || 0
        passedCount = reportSummary.Passed || reportSummary.passed || 0
        needsManualCheckCount = reportSummary['Needs manual check'] || reportSummary.needsManualCheck || 0
        skippedCount = reportSummary.Skipped || reportSummary.skipped || 0
        console.log(`📊 Using Adobe Summary: ${failedCount} failed, ${needsManualCheckCount} needs manual check, ${passedCount} passed, ${skippedCount} skipped`)
      } else if (Object.keys(mappedCategories).length > 0) {
        // Count from categories if available
        console.log(`📊 Counting checks from ${Object.keys(mappedCategories).length} categories`)
        Object.values(mappedCategories).forEach((categoryChecks: any[]) => {
          categoryChecks.forEach((check: any) => {
            if (check.status === 'Failed') failedCount++
            else if (check.status === 'Passed') passedCount++
            else if (check.status === 'Needs manual check') needsManualCheckCount++
            else if (check.status === 'Skipped') skippedCount++
          })
        })
        console.log(`📊 Summary from categories: ${failedCount} failed, ${needsManualCheckCount} needs manual check, ${passedCount} passed, ${skippedCount} skipped`)
      } else {
        // Fallback to counting from mapped issues
        failedCount = mappedIssues.filter((i: any) => i.status === 'Failed').length
        passedCount = mappedIssues.filter((i: any) => i.status === 'Passed').length
        needsManualCheckCount = mappedIssues.filter((i: any) => i.status === 'Needs manual check').length
        skippedCount = mappedIssues.filter((i: any) => i.status === 'Skipped').length
        console.log(`📊 Summary from issues: ${failedCount} failed, ${needsManualCheckCount} needs manual check`)
      }
      
      console.log(`📋 Total issues to report: ${mappedIssues.length} (Failed: ${failedCount}, Needs manual check: ${needsManualCheckCount})`)
      
      return {
        success: true,
        compliant: (failedCount === 0 && needsManualCheckCount === 0), // Only compliant if no failed or manual check issues
        report: {
          summary: {
            totalIssues: mappedIssues.length, // Total issues (Failed + Needs manual check)
            criticalIssues: failedCount, // Failed issues are critical
            warnings: needsManualCheckCount, // Needs manual check are warnings
            passed: passedCount,
            needsManualCheck: needsManualCheckCount,
            failed: failedCount,
            skipped: skippedCount
          },
          categories: Object.keys(mappedCategories).length > 0 ? mappedCategories : undefined,
          issues: mappedIssues // Only Failed and Needs manual check issues
        }
      }
      
    } catch (error: any) {
      console.error('❌ Adobe Accessibility Checker API error:', error)
      return {
        success: false,
        compliant: false,
        error: error.message || 'Failed to check PDF accessibility',
        report: {
          summary: {
            totalIssues: 0,
            criticalIssues: 0,
            warnings: 0,
            passed: 0
          },
          issues: []
        }
      }
    }
  }

  /**
   * Check if Adobe PDF Services is configured
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.pdfServices !== null)
  }
}

/**
 * Get Adobe PDF Services instance from environment variables
 */
export function getAdobePDFServices(): AdobePDFServices | null {
  const clientId = process.env.ADOBE_PDF_SERVICES_CLIENT_ID
  const clientSecret = process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET
  const organizationId = process.env.ADOBE_PDF_SERVICES_ORG_ID
  const accountId = process.env.ADOBE_PDF_SERVICES_ACCOUNT_ID

  console.log('🔍 Checking Adobe PDF Services configuration...')
  console.log(`   Client ID: ${clientId ? clientId.substring(0, 8) + '...' : 'NOT SET'}`)
  console.log(`   Client Secret: ${clientSecret ? 'SET' : 'NOT SET'}`)
  console.log(`   Org ID: ${organizationId || 'NOT SET'}`)
  console.log(`   Account ID: ${accountId || 'NOT SET'}`)

  if (!clientId) {
    console.log('⚠️ ADOBE_PDF_SERVICES_CLIENT_ID not set in environment')
    return null
  }

  if (!clientSecret) {
    console.log('⚠️ ADOBE_PDF_SERVICES_CLIENT_SECRET not set in environment')
    return null
  }

  console.log(`✅ Adobe PDF Services configured with Client ID: ${clientId.substring(0, 8)}...`)
  console.log(`✅ Using Adobe PDF Services Node.js SDK`)

  return new AdobePDFServices({
    clientId,
    clientSecret,
    organizationId,
    accountId
  })
}

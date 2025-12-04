/**
 * Test script to diagnose Adobe PDF Services Accessibility Report
 * This will help us understand what's actually being returned
 */

require('dotenv').config({ path: '.env' })
const fs = require('fs')
const path = require('path')

async function testAdobeReport() {
  console.log('🧪 Starting Adobe PDF Services Report Test\n')
  
  // Check environment variables
  console.log('📋 Environment Check:')
  console.log('   ADOBE_PDF_SERVICES_CLIENT_ID:', process.env.ADOBE_PDF_SERVICES_CLIENT_ID ? 'SET' : 'NOT SET')
  console.log('   ADOBE_PDF_SERVICES_CLIENT_SECRET:', process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET ? 'SET' : 'NOT SET')
  console.log('')
  
  try {
    // Import Adobe SDK
    const {
      ServicePrincipalCredentials,
      PDFServices,
      MimeType,
      PDFAccessibilityCheckerParams,
      PDFAccessibilityCheckerJob,
      PDFAccessibilityCheckerResult,
    } = require('@adobe/pdfservices-node-sdk')
    
    // Initialize PDF Services
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.ADOBE_PDF_SERVICES_CLIENT_ID,
      clientSecret: process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET
    })
    
    const pdfServices = new PDFServices({ credentials })
    console.log('✅ PDF Services initialized\n')
    
    // Read the test PDF
    const pdfPath = path.join(__dirname, 'syllabus_NOTaccessible (1).pdf')
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`)
    }
    
    console.log(`📄 Reading PDF: ${pdfPath}`)
    const pdfBuffer = fs.readFileSync(pdfPath)
    console.log(`   Size: ${pdfBuffer.length} bytes\n`)
    
    // Step 1: Auto-tag first
    console.log('🏷️ Step 1: Auto-tagging PDF...')
    const { Readable } = require('stream')
    const readStream = Readable.from(pdfBuffer)
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF
    })
    console.log('   ✅ PDF uploaded')
    
    const { AutotagPDFParams, AutotagPDFJob, AutotagPDFResult } = require('@adobe/pdfservices-node-sdk')
    const autotagParams = new AutotagPDFParams({
      generateReport: true,
      shiftHeadings: true
    })
    const autotagJob = new AutotagPDFJob({ inputAsset, params: autotagParams })
    
    const autotagPollingURL = await pdfServices.submit({ job: autotagJob })
    console.log('   ✅ Auto-tag job submitted')
    
    const autotagResponse = await pdfServices.getJobResult({
      pollingURL: autotagPollingURL,
      resultType: AutotagPDFResult
    })
    console.log('   ✅ Auto-tag job completed')
    
    // Get tagged PDF
    const taggedPdfAsset = autotagResponse.result.taggedPDF
    const taggedPdfStream = await pdfServices.getContent({ asset: taggedPdfAsset })
    const chunks = []
    for await (const chunk of taggedPdfStream.readStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const taggedPdfBuffer = Buffer.concat(chunks)
    console.log(`   ✅ Tagged PDF downloaded (${taggedPdfBuffer.length} bytes)\n`)
    
    // Step 2: Check accessibility
    console.log('🔍 Step 2: Checking accessibility...')
    const taggedReadStream = Readable.from(taggedPdfBuffer)
    const taggedInputAsset = await pdfServices.upload({
      readStream: taggedReadStream,
      mimeType: MimeType.PDF
    })
    console.log('   ✅ Tagged PDF uploaded')
    
    const checkParams = new PDFAccessibilityCheckerParams({})
    const checkJob = new PDFAccessibilityCheckerJob({ inputAsset: taggedInputAsset, params: checkParams })
    
    const checkPollingURL = await pdfServices.submit({ job: checkJob })
    console.log('   ✅ Accessibility check job submitted')
    
    const checkResponse = await pdfServices.getJobResult({
      pollingURL: checkPollingURL,
      resultType: PDFAccessibilityCheckerResult
    })
    console.log('   ✅ Accessibility check job completed\n')
    
    // Step 3: Analyze the result structure
    console.log('📊 Step 3: Analyzing result structure...')
    console.log('   Result type:', typeof checkResponse.result)
    console.log('   Result keys:', Object.keys(checkResponse.result || {}))
    console.log('   Has report:', !!checkResponse.result?.report)
    console.log('')
    
    // Log complete structure
    console.log('📋 COMPLETE RESULT STRUCTURE:')
    console.log(JSON.stringify(checkResponse.result, null, 2))
    console.log('')
    
    // Step 4: Try to download the report
    const reportAsset = checkResponse.result?.report
    if (reportAsset) {
      console.log('📦 Report Asset Found:')
      console.log('   Type:', typeof reportAsset)
      console.log('   Keys:', typeof reportAsset === 'object' ? Object.keys(reportAsset) : 'N/A')
      console.log('   Full asset:', JSON.stringify(reportAsset, null, 2))
      console.log('')
      
      console.log('📥 Attempting to download report...')
      try {
        const reportStream = await pdfServices.getContent({ asset: reportAsset })
        const reportChunks = []
        for await (const chunk of reportStream.readStream) {
          reportChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const reportBuffer = Buffer.concat(reportChunks)
        const reportText = reportBuffer.toString('utf8')
        
        console.log(`   ✅ Report downloaded (${reportBuffer.length} bytes)`)
        console.log('')
        console.log('📄 REPORT CONTENT (first 2000 chars):')
        console.log(reportText.substring(0, 2000))
        console.log('')
        
        // Try to parse as JSON
        try {
          const parsedReport = JSON.parse(reportText)
          console.log('✅ Report parsed as JSON successfully')
          console.log('')
          console.log('📊 PARSED REPORT STRUCTURE:')
          console.log(JSON.stringify(parsedReport, null, 2))
          console.log('')
          
          // Analyze structure
          console.log('🔍 STRUCTURE ANALYSIS:')
          console.log('   Top-level keys:', Object.keys(parsedReport))
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
          console.log('   Has summary:', !!parsedReport.summary)
          
          if (parsedReport.summary) {
            console.log('')
            console.log('📊 SUMMARY:')
            console.log(JSON.stringify(parsedReport.summary, null, 2))
          }
          
          if (parsedReport.categories) {
            console.log('')
            console.log('📁 CATEGORIES:')
            Object.keys(parsedReport.categories).forEach(cat => {
              console.log(`   ${cat}: ${parsedReport.categories[cat].length} checks`)
            })
          }
          
          if (parsedReport.issues && parsedReport.issues.length > 0) {
            console.log('')
            console.log('⚠️ ISSUES FOUND:')
            parsedReport.issues.forEach((issue, i) => {
              console.log(`   ${i + 1}. ${issue.rule || issue.ruleName || 'Unknown'}: ${issue.status || 'Unknown status'}`)
            })
          }
          
        } catch (parseError) {
          console.error('❌ Failed to parse report as JSON:', parseError.message)
          console.log('   Report might be in a different format')
        }
        
      } catch (downloadError) {
        console.error('❌ Failed to download report:', downloadError.message)
        console.error('   Error stack:', downloadError.stack)
      }
    } else {
      console.error('❌ NO REPORT ASSET FOUND IN RESULT!')
    }
    
    console.log('')
    console.log('✅ Test completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('   Stack:', error.stack)
    process.exit(1)
  }
}

testAdobeReport().catch(console.error)


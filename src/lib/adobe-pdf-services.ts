/**
 * Adobe PDF Services API Integration
 * 
 * Provides access to Adobe's PDF accessibility APIs:
 * - PDF Accessibility Auto-Tag API: Automatically tags PDFs for accessibility
 * - PDF Accessibility Checker API: Checks PDFs against PDF/UA and WCAG standards
 * 
 * Documentation: https://developer.adobe.com/document-services/apis/pdf-accessibility-auto-tag/
 */

import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'
import jwt from 'jsonwebtoken'

export interface AdobePDFServicesConfig {
  clientId: string
  clientSecret: string
  organizationId?: string
  accountId?: string
  accessToken?: string // Optional: use direct access token for testing
}

export interface AutoTagResult {
  success: boolean
  taggedPdfPath?: string
  taggedPdfBuffer?: Buffer
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
    }
    issues: Array<{
      type: 'error' | 'warning' | 'info'
      rule: string
      description: string
      page?: number
      location?: string
    }>
  }
  error?: string
}

export class AdobePDFServices {
  private config: AdobePDFServicesConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: AdobePDFServicesConfig) {
    this.config = config
  }

  /**
   * Get OAuth access token for Adobe PDF Services API
   * Uses JWT-based authentication (Service Account) or direct access token
   */
  private async getAccessToken(): Promise<string> {
    // If access token is provided directly (for testing), use it
    if (this.config.accessToken) {
      return this.config.accessToken
    }
    
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      // Adobe PDF Services uses JWT-based authentication with RS256
      // You need to provide a private key file path in environment variable
      const privateKeyPath = process.env.ADOBE_PDF_SERVICES_PRIVATE_KEY_PATH
      
      if (!privateKeyPath) {
        throw new Error('ADOBE_PDF_SERVICES_PRIVATE_KEY_PATH environment variable not set. Please provide path to your private key file, or set ADOBE_PDF_SERVICES_ACCESS_TOKEN for testing.')
      }
      
      // Read private key from file
      const privateKey = await fs.readFile(privateKeyPath, 'utf8')
      
      const now = Math.floor(Date.now() / 1000)
      const expiry = now + 3600 // 1 hour expiry
      
      // JWT payload for Adobe IMS
      const jwtPayload = {
        exp: expiry,
        iss: this.config.organizationId || this.config.clientId,
        sub: this.config.accountId || this.config.clientId,
        aud: 'https://ims-na1.adobelogin.com/c/' + this.config.clientId,
        'https://ims-na1.adobelogin.com/s/ent_documentcloud_sdk': true
      }
      
      // Sign JWT with RS256 using private key
      const jwtToken = jwt.sign(jwtPayload, privateKey, {
        algorithm: 'RS256'
      })
      
      // Exchange JWT for access token
      const tokenUrl = 'https://ims-na1.adobelogin.com/ims/exchange/jwt'
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        jwt_token: jwtToken
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      
      this.accessToken = response.data.access_token
      // Cache token for 55 minutes (expires in 1 hour)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000)
      
      return this.accessToken
      
    } catch (error: any) {
      console.error('❌ Failed to get Adobe access token:', error.response?.data || error.message)
      throw new Error(`Adobe PDF Services authentication failed: ${error.response?.data?.error_description || error.message}`)
    }
  }

  /**
   * Automatically tag a PDF for accessibility using Adobe's Auto-Tag API
   * This uses Adobe Sensei AI to automatically tag headings, lists, tables, etc.
   */
  async autoTagPDF(pdfBuffer: Buffer): Promise<AutoTagResult> {
    try {
      const accessToken = await this.getAccessToken()
      
      // Create a temporary file for the PDF
      const tempDir = tmpdir()
      const inputPath = path.join(tempDir, `input-${Date.now()}.pdf`)
      const outputPath = path.join(tempDir, `output-${Date.now()}.pdf`)
      
      await fs.writeFile(inputPath, pdfBuffer)
      
      // Adobe PDF Services API endpoint for auto-tagging
      const apiUrl = 'https://pdf-services.adobe.io/operation/autotagpdf'
      
      // Create form data with the PDF file
      const FormData = require('form-data')
      const formData = new FormData()
      formData.append('file', await fs.readFile(inputPath), {
        filename: 'input.pdf',
        contentType: 'application/pdf'
      })
      
      console.log(`📤 Sending PDF to Adobe Auto-Tag API...`)
      console.log(`🔑 Using Client ID: ${this.config.clientId.substring(0, 8)}...`)
      console.log(`📄 PDF size: ${pdfBuffer.length} bytes`)
      
      const response = await axios.post(apiUrl, formData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': this.config.clientId,
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes timeout for large PDFs
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      console.log(`✅ Received response from Adobe API (${response.data?.length || 0} bytes)`)
      
      // Save the tagged PDF
      const taggedPdfBuffer = Buffer.from(response.data)
      await fs.writeFile(outputPath, taggedPdfBuffer)
      
      console.log(`💾 Saved tagged PDF to: ${outputPath}`)
      
      // Cleanup
      await fs.unlink(inputPath).catch(() => {})
      
      return {
        success: true,
        taggedPdfPath: outputPath,
        taggedPdfBuffer,
        message: 'PDF successfully auto-tagged by Adobe'
      }
      
    } catch (error: any) {
      console.error('❌ Adobe Auto-Tag API error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data ? Buffer.from(error.response.data).toString('utf8').substring(0, 500) : 'No response data',
        status: error.response?.status,
        statusText: error.response?.statusText
      })
      
      return {
        success: false,
        error: error.message || 'Failed to auto-tag PDF',
        message: error.response?.data 
          ? `Adobe API error: ${error.response.status} - ${error.response.statusText}`
          : 'Adobe Auto-Tag API request failed. Check your credentials and network connection.'
      }
    }
  }

  /**
   * Check PDF accessibility using Adobe's Accessibility Checker API
   * Returns a detailed report of accessibility issues
   */
  async checkAccessibility(pdfBuffer: Buffer): Promise<AccessibilityCheckResult> {
    try {
      const accessToken = await this.getAccessToken()
      
      // Create a temporary file for the PDF
      const tempDir = tmpdir()
      const inputPath = path.join(tempDir, `check-${Date.now()}.pdf`)
      
      await fs.writeFile(inputPath, pdfBuffer)
      
      // Adobe PDF Services API endpoint for accessibility checking
      const apiUrl = 'https://pdf-services.adobe.io/operation/checkpdfaccessibility'
      
      // Create form data with the PDF file
      const FormData = require('form-data')
      const formData = new FormData()
      formData.append('file', await fs.readFile(inputPath), {
        filename: 'input.pdf',
        contentType: 'application/pdf'
      })
      
      const response = await axios.post(apiUrl, formData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': this.config.clientId,
          ...formData.getHeaders()
        },
        timeout: 300000 // 5 minutes timeout
      })
      
      // Parse the accessibility report
      const report = response.data
      
      // Cleanup
      await fs.unlink(inputPath).catch(() => {})
      
      // Determine if PDF is compliant
      const compliant = report.summary?.criticalIssues === 0 && report.summary?.warnings === 0
      
      return {
        success: true,
        compliant,
        report: {
          summary: {
            totalIssues: report.summary?.totalIssues || 0,
            criticalIssues: report.summary?.criticalIssues || 0,
            warnings: report.summary?.warnings || 0,
            passed: report.summary?.passed || 0
          },
          issues: (report.issues || []).map((issue: any) => ({
            type: issue.type || 'warning',
            rule: issue.rule || 'Unknown',
            description: issue.description || 'No description',
            page: issue.page,
            location: issue.location
          }))
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
    return !!(this.config.clientId && this.config.clientSecret)
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
  const accessToken = process.env.ADOBE_PDF_SERVICES_ACCESS_TOKEN // For testing - use direct access token

  if (!clientId) {
    console.log('⚠️ ADOBE_PDF_SERVICES_CLIENT_ID not set in environment')
    return null
  }

  // Allow accessToken OR clientSecret (accessToken for testing, clientSecret for production)
  if (!clientSecret && !accessToken) {
    console.log('⚠️ ADOBE_PDF_SERVICES_CLIENT_SECRET or ADOBE_PDF_SERVICES_ACCESS_TOKEN not set in environment')
    return null
  }

  console.log(`✅ Adobe PDF Services configured with Client ID: ${clientId.substring(0, 8)}...`)
  if (accessToken) {
    console.log(`✅ Using direct access token (for testing)`)
  } else {
    console.log(`✅ Will generate access tokens using JWT authentication`)
  }

  return new AdobePDFServices({
    clientId,
    clientSecret: clientSecret || '', // Required but won't be used if accessToken is provided
    organizationId,
    accountId,
    accessToken // Use direct access token if provided (for testing)
  })
}


/**
 * ISO 14289-1 Compliance Validator Wrapper
 * Calls the rigorous PDF/UA validator Python script and returns structured results
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

export interface ISOComplianceCheck {
  check_name: string
  passed: boolean
  failures: string[]
  details: Record<string, any>
}

export interface ISOComplianceResult {
  pdf_path: string
  compliant: boolean
  checks: Record<string, ISOComplianceCheck>
  failures: string[]
  warnings: string[]
  passed: string[]
  summary: {
    total_checks: number
    passed: number
    failed: number
    compliance_rate: string
  }
}

/**
 * Validate PDF for ISO 14289-1 compliance
 */
export async function validateISOCompliance(pdfPath: string): Promise<ISOComplianceResult> {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'rigorous-pdf-ua-validator.py')
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Validator script not found: ${scriptPath}`)
    }
    
    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF not found: ${pdfPath}`)
    }
    
    // Run validator (outputs JSON to stdout)
    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${pdfPath}"`,
      { 
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        encoding: 'utf-8' as BufferEncoding
      }
    )
    
    // Parse JSON output (validator outputs JSON at the end)
    // The validator prints to stderr for progress, JSON to stdout
    let jsonOutput = stdout.trim()
    
    // Try to extract JSON from output (might have progress messages)
    const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonOutput = jsonMatch[0]
    }
    
    const result = JSON.parse(jsonOutput) as ISOComplianceResult
    
    // Calculate summary
    const totalChecks = Object.keys(result.checks || {}).length
    const passed = result.passed?.length || 0
    const failed = result.failures?.length || 0
    
    result.summary = {
      total_checks: totalChecks,
      passed,
      failed,
      compliance_rate: totalChecks > 0 ? `${Math.round((passed / totalChecks) * 100)}%` : '0%'
    }
    
    return result
    
  } catch (error: any) {
    // If JSON parsing fails, try to extract info from text output
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      // Fallback: return error result
      return {
        pdf_path: pdfPath,
        compliant: false,
        checks: {},
        failures: [`Validation error: ${error.message}`],
        warnings: [],
        passed: [],
        summary: {
          total_checks: 0,
          passed: 0,
          failed: 1,
          compliance_rate: '0%'
        }
      }
    }
    
    throw error
  }
}

/**
 * Generate before/after ISO compliance report
 */
export async function generateISOComplianceReport(
  beforePdfPath: string,
  afterPdfPath: string
): Promise<{
  before: ISOComplianceResult
  after: ISOComplianceResult
  improvement: {
    checks_fixed: number
    checks_regressed: number
    compliance_rate_before: string
    compliance_rate_after: string
    compliant: boolean
  }
  checks: Array<{
    check_name: string
    iso_requirement: string
    iso_description: string
    before: { status: string; passed: boolean; failures: string[] }
    after: { status: string; passed: boolean; failures: string[] }
    improvement: { fixed: boolean; status_change: string }
  }>
}> {
  const before = await validateISOCompliance(beforePdfPath)
  const after = await validateISOCompliance(afterPdfPath)
  
  // ISO requirement mapping
  const isoRequirements: Record<string, { requirement: string; description: string }> = {
    'Tagged PDF': {
      requirement: 'UA1_Tpdf-ua-0052',
      description: 'Document must have a structure tree (StructTreeRoot) with Document wrapper'
    },
    'Primary Language': {
      requirement: 'UA1_Tpdf-ua-0031',
      description: 'Document language must be specified in catalog /Lang key'
    },
    'Title': {
      requirement: 'UA1_Tpdf-ua-0032',
      description: 'Document title must be specified in Info dictionary and XMP metadata'
    },
    'Tagged Content': {
      requirement: 'UA1_Tpdf-ua-0053',
      description: 'All content must be tagged with MCID linking (100% coverage required)'
    },
    'Tab Order': {
      requirement: 'UA1_Tpdf-ua-0054',
      description: 'Logical reading order must match visual order'
    },
    'Other Elements Alternate Text': {
      requirement: 'UA1_Tpdf-ua-0033',
      description: 'All non-text content must have alternate text'
    },
    'Appropriate Nesting': {
      requirement: 'UA1_Tpdf-ua-0055',
      description: 'Headings must follow proper hierarchy (H1 → H2 → H3, no skipping)'
    },
    'Structure Tree Integrity': {
      requirement: 'UA1_Tpdf-ua-0052',
      description: 'Structure tree must be properly formed and accessible'
    },
    'MarkInfo/Marked': {
      requirement: 'UA1_Tpdf-ua-0051',
      description: 'MarkInfo/Marked flag must be set to /true'
    },
    'Document Wrapper': {
      requirement: 'UA1_Tpdf-ua-0052',
      description: 'Document wrapper must exist as first child of StructTreeRoot'
    }
  }
  
  // Compare checks
  const allCheckNames = new Set([
    ...Object.keys(before.checks || {}),
    ...Object.keys(after.checks || {})
  ])
  
  const checks = Array.from(allCheckNames).map(checkName => {
    const beforeCheck = before.checks[checkName] || { passed: false, failures: [], details: {} }
    const afterCheck = after.checks[checkName] || { passed: false, failures: [], details: {} }
    
    const isoInfo = isoRequirements[checkName] || {
      requirement: 'N/A',
      description: 'Check not in ISO requirements list'
    }
    
    const fixed = !beforeCheck.passed && afterCheck.passed
    const regressed = beforeCheck.passed && !afterCheck.passed
    
    return {
      check_name: checkName,
      iso_requirement: isoInfo.requirement,
      iso_description: isoInfo.description,
      before: {
        status: beforeCheck.passed ? 'PASS' : 'FAIL',
        passed: beforeCheck.passed,
        failures: beforeCheck.failures || []
      },
      after: {
        status: afterCheck.passed ? 'PASS' : 'FAIL',
        passed: afterCheck.passed,
        failures: afterCheck.failures || []
      },
      improvement: {
        fixed,
        status_change: fixed ? 'FIXED' : (regressed ? 'REGRESSED' : 'UNCHANGED')
      }
    }
  })
  
  const checksFixed = checks.filter(c => c.improvement.fixed).length
  const checksRegressed = checks.filter(c => c.improvement.status_change === 'REGRESSED').length
  
  return {
    before,
    after,
    improvement: {
      checks_fixed: checksFixed,
      checks_regressed: checksRegressed,
      compliance_rate_before: before.summary.compliance_rate,
      compliance_rate_after: after.summary.compliance_rate,
      compliant: after.compliant
    },
    checks
  }
}


import pool from './database'
import { AccessibilityScanner } from './accessibility-scanner'
import { CloudinaryService } from './cloudinary-service'
import { EmailService } from './email-service'

export interface PeriodicScanExecution {
  id: string
  periodicScanId: string
  scanHistoryId?: string
  scheduledAt: Date
  startedAt?: Date
  completedAt?: Date
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  errorMessage?: string
  retryCount: number
  maxRetries: number
}

export class PeriodicScanService {
  private scanner: AccessibilityScanner
  private cloudinaryService: CloudinaryService
  private emailService: EmailService

  constructor() {
    this.scanner = new AccessibilityScanner()
    this.cloudinaryService = new CloudinaryService()
    this.emailService = new EmailService()
  }

  /**
   * Get all periodic scans that are due to run
   */
  async getDueScans(): Promise<any[]> {
    const now = new Date()
    
    const result = await pool.query(`
      SELECT ps.*, u.email, u.first_name, u.last_name
      FROM periodic_scans ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.status = 'scheduled' 
        AND ps.next_run_at <= $1
        AND (ps.end_date IS NULL OR ps.end_date >= $1)
        AND (ps.max_runs IS NULL OR ps.run_count < ps.max_runs)
      ORDER BY ps.next_run_at ASC
    `, [now])

    return result.rows
  }

  /**
   * Execute a periodic scan
   */
  async executePeriodicScan(periodicScan: any): Promise<void> {
    const executionId = await this.createExecution(periodicScan.id, periodicScan.next_run_at)
    
    try {
      // Update execution status to running
      await this.updateExecutionStatus(executionId, 'running', new Date())

      console.log(`🔄 Executing periodic scan: ${periodicScan.scan_title}`)

      let scanResult: any

      if (periodicScan.scan_type === 'web') {
        scanResult = await this.executeWebScan(periodicScan)
      } else if (periodicScan.scan_type === 'document') {
        scanResult = await this.executeDocumentScan(periodicScan)
      } else {
        throw new Error(`Unsupported scan type: ${periodicScan.scan_type}`)
      }

      // Update execution with results
      await this.updateExecutionResults(executionId, scanResult.id, {
        totalIssues: scanResult.total_issues || 0,
        criticalIssues: scanResult.critical_issues || 0,
        seriousIssues: scanResult.serious_issues || 0,
        moderateIssues: scanResult.moderate_issues || 0,
        minorIssues: scanResult.minor_issues || 0
      })

      // Update periodic scan run count and next run time
      await this.updatePeriodicScanAfterExecution(periodicScan.id)

      // Send notifications if enabled
      if (periodicScan.notify_on_completion && periodicScan.email_notifications) {
        await this.sendCompletionNotification(periodicScan, scanResult)
      }

      console.log(`✅ Periodic scan completed: ${periodicScan.scan_title}`)

    } catch (error) {
      console.error(`❌ Periodic scan failed: ${periodicScan.scan_title}`, error)
      
      // Update execution with error
      await this.updateExecutionError(executionId, error instanceof Error ? error.message : 'Unknown error')

      // Send failure notification if enabled
      if (periodicScan.notify_on_failure && periodicScan.email_notifications) {
        await this.sendFailureNotification(periodicScan, error)
      }

      // Handle retry logic
      await this.handleRetry(executionId, periodicScan.id)
    }
  }

  /**
   * Execute a web scan
   */
  private async executeWebScan(periodicScan: any): Promise<any> {
    if (!periodicScan.url) {
      throw new Error('URL is required for web scans')
    }

    // Use the existing web scan API logic
    const scanResult = await this.scanner.scanWebsite(periodicScan.url, {
      scanTitle: periodicScan.scan_title,
      userId: periodicScan.user_id,
      isPeriodicScan: true,
      periodicScanId: periodicScan.id
    })

    return scanResult
  }

  /**
   * Execute a document scan
   */
  private async executeDocumentScan(periodicScan: any): Promise<any> {
    if (!periodicScan.file_name) {
      throw new Error('File name is required for document scans')
    }

    // For document scans, we would need the actual file
    // This is a placeholder - in practice, you'd need to store the file
    // or have a way to retrieve it for scanning
    throw new Error('Document scanning for periodic scans not yet implemented')
  }

  /**
   * Create a new execution record
   */
  private async createExecution(periodicScanId: string, scheduledAt: Date): Promise<string> {
    const result = await pool.query(`
      INSERT INTO periodic_scan_executions (
        periodic_scan_id, scheduled_at, status
      ) VALUES ($1, $2, $3)
      RETURNING id
    `, [periodicScanId, scheduledAt, 'pending'])

    return result.rows[0].id
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(executionId: string, status: string, startedAt?: Date): Promise<void> {
    const updates: string[] = ['status = $2']
    const values: any[] = [executionId, status]

    if (startedAt) {
      updates.push('started_at = $3')
      values.push(startedAt)
    }

    if (status === 'completed') {
      updates.push('completed_at = NOW()')
    }

    await pool.query(`
      UPDATE periodic_scan_executions 
      SET ${updates.join(', ')}
      WHERE id = $1
    `, values)
  }

  /**
   * Update execution with results
   */
  private async updateExecutionResults(
    executionId: string, 
    scanHistoryId: string, 
    results: {
      totalIssues: number
      criticalIssues: number
      seriousIssues: number
      moderateIssues: number
      minorIssues: number
    }
  ): Promise<void> {
    await pool.query(`
      UPDATE periodic_scan_executions 
      SET 
        scan_history_id = $2,
        total_issues = $3,
        critical_issues = $4,
        serious_issues = $5,
        moderate_issues = $6,
        minor_issues = $7,
        status = 'completed',
        completed_at = NOW()
      WHERE id = $1
    `, [
      executionId, scanHistoryId, results.totalIssues,
      results.criticalIssues, results.seriousIssues,
      results.moderateIssues, results.minorIssues
    ])
  }

  /**
   * Update execution with error
   */
  private async updateExecutionError(executionId: string, errorMessage: string): Promise<void> {
    await pool.query(`
      UPDATE periodic_scan_executions 
      SET 
        error_message = $2,
        status = 'failed',
        completed_at = NOW()
      WHERE id = $1
    `, [executionId, errorMessage])
  }

  /**
   * Update periodic scan after successful execution
   */
  private async updatePeriodicScanAfterExecution(periodicScanId: string): Promise<void> {
    // Get current scan details
    const scanResult = await pool.query(`
      SELECT * FROM periodic_scans WHERE id = $1
    `, [periodicScanId])

    if (scanResult.rows.length === 0) return

    const scan = scanResult.rows[0]
    
    // Calculate next run time
    const nextRunAt = this.calculateNextRunTime(scan)
    
    // Update scan
    await pool.query(`
      UPDATE periodic_scans 
      SET 
        run_count = run_count + 1,
        last_run_at = NOW(),
        next_run_at = $2,
        status = CASE 
          WHEN end_date IS NOT NULL AND end_date <= NOW() THEN 'completed'
          WHEN max_runs IS NOT NULL AND run_count + 1 >= max_runs THEN 'completed'
          ELSE 'scheduled'
        END
      WHERE id = $1
    `, [periodicScanId, nextRunAt])
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRunTime(scan: any): Date {
    const now = new Date()
    const lastRun = scan.last_run_at ? new Date(scan.last_run_at) : new Date(scan.scheduled_date)
    
    switch (scan.frequency) {
      case 'once':
        return new Date('2099-12-31') // Far future date for one-time scans
      
      case 'daily':
        const nextDay = new Date(lastRun)
        nextDay.setDate(nextDay.getDate() + 1)
        return nextDay
      
      case 'weekly':
        const nextWeek = new Date(lastRun)
        nextWeek.setDate(nextWeek.getDate() + 7)
        return nextWeek
      
      case 'monthly':
        const nextMonth = new Date(lastRun)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth
      
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to tomorrow
    }
  }

  /**
   * Handle retry logic for failed executions
   */
  private async handleRetry(executionId: string, periodicScanId: string): Promise<void> {
    const execution = await pool.query(`
      SELECT * FROM periodic_scan_executions WHERE id = $1
    `, [executionId])

    if (execution.rows.length === 0) return

    const exec = execution.rows[0]
    
    if (exec.retry_count < exec.max_retries) {
      // Schedule retry
      const retryDelay = Math.pow(2, exec.retry_count) * 60 * 1000 // Exponential backoff
      const retryTime = new Date(Date.now() + retryDelay)
      
      await pool.query(`
        UPDATE periodic_scan_executions 
        SET 
          retry_count = retry_count + 1,
          scheduled_at = $2,
          status = 'pending'
        WHERE id = $1
      `, [executionId, retryTime])
    } else {
      // Max retries reached, mark as failed
      await pool.query(`
        UPDATE periodic_scan_executions 
        SET status = 'failed'
        WHERE id = $1
      `, [executionId])
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(periodicScan: any, scanResult: any): Promise<void> {
    try {
      await this.emailService.sendPeriodicScanCompletionEmail({
        to: periodicScan.email,
        scanTitle: periodicScan.scan_title,
        scanUrl: periodicScan.url,
        totalIssues: scanResult.total_issues || 0,
        criticalIssues: scanResult.critical_issues || 0,
        seriousIssues: scanResult.serious_issues || 0,
        moderateIssues: scanResult.moderate_issues || 0,
        minorIssues: scanResult.minor_issues || 0,
        scanHistoryId: scanResult.id,
        scanDate: new Date().toISOString(),
        firstName: periodicScan.first_name || 'User'
      })
    } catch (error) {
      console.error('Failed to send completion notification:', error)
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(periodicScan: any, error: any): Promise<void> {
    try {
      await this.emailService.sendPeriodicScanFailureEmail({
        to: periodicScan.email,
        scanTitle: periodicScan.scan_title,
        scanUrl: periodicScan.url,
        errorMessage: error.message || 'Unknown error',
        scanDate: new Date().toISOString(),
        firstName: periodicScan.first_name || 'User'
      })
    } catch (emailError) {
      console.error('Failed to send failure notification:', emailError)
    }
  }

  /**
   * Process all due scans
   */
  async processDueScans(): Promise<void> {
    console.log('🔄 Processing due periodic scans...')
    
    const dueScans = await this.getDueScans()
    console.log(`📋 Found ${dueScans.length} scans due for execution`)

    for (const scan of dueScans) {
      try {
        await this.executePeriodicScan(scan)
      } catch (error) {
        console.error(`Failed to execute scan ${scan.id}:`, error)
      }
    }

    console.log('✅ Finished processing periodic scans')
  }
}
 
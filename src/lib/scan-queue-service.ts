import { queryOne, query } from './database'

export interface QueuedScan {
  id: string
  userId: string
  scanType: 'web' | 'document'
  url?: string
  fileName?: string
  fileType?: string
  scanSettings: any
  priority: 'high' | 'normal' | 'low'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
  estimatedDuration: number // in seconds
}

export interface ScanLimits {
  maxConcurrentScans: number
  maxScansPerUser: number
  maxScansPerHour: number
  maxScansPerDay: number
  aiRateLimitPerMinute: number
  aiRateLimitPerHour: number
}

export class ScanQueueService {
  private static instance: ScanQueueService
  private activeScans = new Map<string, QueuedScan>()
  private scanLimits: ScanLimits = {
    maxConcurrentScans: 3, // Maximum 3 scans running simultaneously
    maxScansPerUser: 1, // Maximum 1 scan per user at a time
    maxScansPerHour: 10, // Maximum 10 scans per user per hour
    maxScansPerDay: 50, // Maximum 50 scans per user per day
    aiRateLimitPerMinute: 20, // Claude API rate limit
    aiRateLimitPerHour: 1000 // Claude API rate limit
  }

  static getInstance(): ScanQueueService {
    if (!ScanQueueService.instance) {
      ScanQueueService.instance = new ScanQueueService()
    }
    return ScanQueueService.instance
  }

  /**
   * Add a scan to the queue
   */
  async queueScan(scanData: Omit<QueuedScan, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const scanId = `${scanData.scanType}_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Check if user can queue more scans
    await this.checkUserLimits(scanData.userId)
    
    // Check if system can handle more scans
    await this.checkSystemLimits()
    
    const queuedScan: QueuedScan = {
      ...scanData,
      id: scanId,
      status: 'queued',
      createdAt: new Date()
    }

    // Store in database
    await query(
      `INSERT INTO scan_queue (
        id, user_id, scan_type, url, file_name, file_type, 
        scan_settings, priority, status, created_at, estimated_duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        scanId,
        scanData.userId,
        scanData.scanType,
        scanData.url || null,
        scanData.fileName || null,
        scanData.fileType || null,
        JSON.stringify(scanData.scanSettings),
        scanData.priority,
        'queued',
        new Date(),
        scanData.estimatedDuration
      ]
    )

    // Try to start the scan immediately if possible
    await this.processQueue()
    
    return scanId
  }

  /**
   * Check if user has reached their scan limits
   */
  private async checkUserLimits(userId: string): Promise<void> {
    // Check concurrent scans per user
    const activeUserScans = await query(
      'SELECT COUNT(*) as count FROM scan_queue WHERE user_id = $1 AND status IN ($2, $3)',
      [userId, 'queued', 'running']
    )
    
    if (activeUserScans[0].count >= this.scanLimits.maxScansPerUser) {
      throw new Error(`You can only have ${this.scanLimits.maxScansPerUser} scan(s) running at a time. Please wait for your current scan to complete.`)
    }

    // Check hourly limit
    const hourlyScans = await query(
      'SELECT COUNT(*) as count FROM scan_queue WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
      [userId]
    )
    
    if (hourlyScans[0].count >= this.scanLimits.maxScansPerHour) {
      throw new Error(`You have reached the hourly limit of ${this.scanLimits.maxScansPerHour} scans. Please try again later.`)
    }

    // Check daily limit
    const dailyScans = await query(
      'SELECT COUNT(*) as count FROM scan_queue WHERE user_id = $1 AND created_at > NOW() - INTERVAL \1 day\'',
      [userId]
    )
    
    if (dailyScans[0].count >= this.scanLimits.maxScansPerDay) {
      throw new Error(`You have reached the daily limit of ${this.scanLimits.maxScansPerDay} scans. Please try again tomorrow.`)
    }
  }

  /**
   * Check if system can handle more scans
   */
  private async checkSystemLimits(): Promise<void> {
    const activeScans = await query(
      'SELECT COUNT(*) as count FROM scan_queue WHERE status = $1',
      ['running']
    )
    
    if (activeScans[0].count >= this.scanLimits.maxConcurrentScans) {
      throw new Error(`System is currently at capacity (${this.scanLimits.maxConcurrentScans} scans running). Your scan has been queued and will start automatically when capacity is available.`)
    }
  }

  /**
   * Process the scan queue
   */
  async processQueue(): Promise<void> {
    // Get queued scans ordered by priority and creation time
    const queuedScans = await query(
      `SELECT * FROM scan_queue 
       WHERE status = 'queued' 
       ORDER BY 
         CASE priority 
           WHEN 'high' THEN 1 
           WHEN 'normal' THEN 2 
           WHEN 'low' THEN 3 
         END,
         created_at ASC
       LIMIT $1`,
      [this.scanLimits.maxConcurrentScans - this.activeScans.size]
    )

    for (const scan of queuedScans) {
      if (this.activeScans.size >= this.scanLimits.maxConcurrentScans) {
        break
      }

      // Check if user already has a running scan
      const userActiveScans = await query(
        'SELECT COUNT(*) as count FROM scan_queue WHERE user_id = $1 AND status = $2',
        [scan.user_id, 'running']
      )

      if (userActiveScans[0].count >= this.scanLimits.maxScansPerUser) {
        continue // Skip this scan, user already has max concurrent scans
      }

      // Start the scan
      await this.startScan(scan)
    }
  }

  /**
   * Start a queued scan
   */
  private async startScan(scan: any): Promise<void> {
    try {
      // Update status to running
      await query(
        'UPDATE scan_queue SET status = $1, started_at = $2 WHERE id = $3',
        ['running', new Date(), scan.id]
      )

      // Add to active scans
      this.activeScans.set(scan.id, {
        ...scan,
        status: 'running',
        startedAt: new Date()
      })

      // Start the actual scan process
      this.executeScan(scan.id, scan)
      
    } catch (error) {
      console.error(`Failed to start scan ${scan.id}:`, error)
      await this.markScanFailed(scan.id, error.message)
    }
  }

  /**
   * Execute the actual scan
   */
  private async executeScan(scanId: string, scan: any): Promise<void> {
    try {
      // This would integrate with your existing scan services
      // For now, we'll simulate the scan process
      
      if (scan.scan_type === 'web') {
        // Import and use web scan service
        const { ScanService } = await import('./scan-service')
        const scanService = new ScanService()
        
        // Execute web scan with the queued settings
        const results = await scanService.startScan(scan.scan_settings)
        
        // Mark as completed
        await this.markScanCompleted(scanId, results)
        
      } else if (scan.scan_type === 'document') {
        // Import and use document scan service
        const { DocumentScanService } = await import('./document-scan-service')
        const documentScanService = new DocumentScanService()
        
        // Execute document scan
        const results = await documentScanService.scanDocument(scan.scan_settings)
        
        // Mark as completed
        await this.markScanCompleted(scanId, results)
      }
      
    } catch (error) {
      console.error(`Scan execution failed for ${scanId}:`, error)
      await this.markScanFailed(scanId, error.message)
    }
  }

  /**
   * Mark a scan as completed
   */
  async markScanCompleted(scanId: string, results: any): Promise<void> {
    try {
      await query(
        'UPDATE scan_queue SET status = $1, completed_at = $2 WHERE id = $3',
        ['completed', new Date(), scanId]
      )

      // Remove from active scans
      this.activeScans.delete(scanId)

      // Process next in queue
      await this.processQueue()
      
    } catch (error) {
      console.error(`Failed to mark scan ${scanId} as completed:`, error)
    }
  }

  /**
   * Mark a scan as failed
   */
  async markScanFailed(scanId: string, error: string): Promise<void> {
    try {
      await query(
        'UPDATE scan_queue SET status = $1, completed_at = $2, error = $3 WHERE id = $4',
        ['failed', new Date(), error, scanId]
      )

      // Remove from active scans
      this.activeScans.delete(scanId)

      // Process next in queue
      await this.processQueue()
      
    } catch (error) {
      console.error(`Failed to mark scan ${scanId} as failed:`, error)
    }
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string): Promise<QueuedScan | null> {
    const result = await queryOne(
      'SELECT * FROM scan_queue WHERE id = $1',
      [scanId]
    )

    if (!result) return null

    return {
      id: result.id,
      userId: result.user_id,
      scanType: result.scan_type,
      url: result.url,
      fileName: result.file_name,
      fileType: result.file_type,
      scanSettings: JSON.parse(result.scan_settings),
      priority: result.priority,
      status: result.status,
      createdAt: result.created_at,
      startedAt: result.started_at,
      completedAt: result.completed_at,
      error: result.error,
      estimatedDuration: result.estimated_duration
    }
  }

  /**
   * Get user's scan queue
   */
  async getUserQueue(userId: string): Promise<QueuedScan[]> {
    const results = await query(
      'SELECT * FROM scan_queue WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )

    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      scanType: result.scan_type,
      url: result.url,
      fileName: result.file_name,
      fileType: result.file_type,
      scanSettings: JSON.parse(result.scan_settings),
      priority: result.priority,
      status: result.status,
      createdAt: result.created_at,
      startedAt: result.started_at,
      completedAt: result.completed_at,
      error: result.error,
      estimatedDuration: result.estimated_duration
    }))
  }

  /**
   * Cancel a queued scan
   */
  async cancelScan(scanId: string, userId: string): Promise<void> {
    const scan = await this.getScanStatus(scanId)
    
    if (!scan) {
      throw new Error('Scan not found')
    }

    if (scan.userId !== userId) {
      throw new Error('Unauthorized to cancel this scan')
    }

    if (scan.status === 'completed' || scan.status === 'failed') {
      throw new Error('Cannot cancel completed or failed scan')
    }

    await query(
      'UPDATE scan_queue SET status = $1 WHERE id = $2',
      ['cancelled', scanId]
    )

    // Remove from active scans if running
    this.activeScans.delete(scanId)

    // Process next in queue
    await this.processQueue()
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{
    activeScans: number
    queuedScans: number
    maxConcurrentScans: number
    estimatedWaitTime: number
  }> {
    const activeCount = await queryOne(
      'SELECT COUNT(*) as count FROM scan_queue WHERE status = $1',
      ['running']
    )

    const queuedCount = await queryOne(
      'SELECT COUNT(*) as count FROM scan_queue WHERE status = $1',
      ['queued']
    )

    // Estimate wait time based on average scan duration and queue position
    const avgDuration = await queryOne(
      'SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration FROM scan_queue WHERE status = $1 AND completed_at IS NOT NULL',
      ['completed']
    )

    const estimatedWaitTime = queuedCount.count * (avgDuration.avg_duration || 300) // Default 5 minutes

    return {
      activeScans: activeCount.count,
      queuedScans: queuedCount.count,
      maxConcurrentScans: this.scanLimits.maxConcurrentScans,
      estimatedWaitTime: Math.round(estimatedWaitTime)
    }
  }
}

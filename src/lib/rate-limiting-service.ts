import { query, queryOne } from './database';

export interface RateLimitInfo {
  scansUsed: number;
  maxScans: number;
  remainingScans: number;
  canScan: boolean;
}

export class RateLimitingService {
  private static readonly DEFAULT_DAILY_LIMIT = 30;

  /**
   * Check if user can perform a scan and increment counter if allowed
   */
  static async checkAndIncrementScanCount(userId: string, maxScans: number = this.DEFAULT_DAILY_LIMIT): Promise<boolean> {
    try {
      const result = await queryOne(
        'SELECT check_and_increment_scan_count($1, $2) as can_scan',
        [userId, maxScans]
      );
      
      return result.can_scan;
    } catch (error) {
      console.error('Rate limiting check failed:', error);
      // In case of error, allow the scan to proceed (fail open)
      return true;
    }
  }

  /**
   * Get current rate limit information for a user
   */
  static async getRateLimitInfo(userId: string): Promise<RateLimitInfo> {
    try {
      const result = await queryOne(
        'SELECT * FROM get_scan_usage_today($1)',
        [userId]
      );
      
      const scansUsed = result.scans_used || 0;
      const maxScans = result.max_scans || this.DEFAULT_DAILY_LIMIT;
      const remainingScans = result.remaining_scans || 0;
      
      return {
        scansUsed,
        maxScans,
        remainingScans,
        canScan: remainingScans > 0
      };
    } catch (error) {
      console.error('Failed to get rate limit info:', error);
      // Return default values on error
      return {
        scansUsed: 0,
        maxScans: this.DEFAULT_DAILY_LIMIT,
        remainingScans: this.DEFAULT_DAILY_LIMIT,
        canScan: true
      };
    }
  }

  /**
   * Get remaining scans for today
   */
  static async getRemainingScans(userId: string): Promise<number> {
    try {
      const result = await queryOne(
        'SELECT get_remaining_scans_today($1) as remaining',
        [userId]
      );
      
      return result.remaining || 0;
    } catch (error) {
      console.error('Failed to get remaining scans:', error);
      return this.DEFAULT_DAILY_LIMIT;
    }
  }

  /**
   * Reset daily scan count (for admin use)
   */
  static async resetDailyScans(userId: string): Promise<void> {
    try {
      await query(
        'DELETE FROM user_scan_limits WHERE user_id = $1 AND scan_date = CURRENT_DATE',
        [userId]
      );
    } catch (error) {
      console.error('Failed to reset daily scans:', error);
      throw error;
    }
  }

  /**
   * Update user's daily scan limit (for premium users)
   */
  static async updateDailyLimit(userId: string, newLimit: number): Promise<void> {
    try {
      await query(
        `INSERT INTO user_scan_limits (user_id, scan_date, max_scans_per_day)
         VALUES ($1, CURRENT_DATE, $2)
         ON CONFLICT (user_id, scan_date)
         DO UPDATE SET max_scans_per_day = $2, updated_at = NOW()`,
        [userId, newLimit]
      );
    } catch (error) {
      console.error('Failed to update daily limit:', error);
      throw error;
    }
  }

  /**
   * Get scan usage for the last 7 days
   */
  static async getWeeklyUsage(userId: string): Promise<Array<{ date: string; scansUsed: number; maxScans: number }>> {
    try {
      const result = await query(
        `SELECT 
           scan_date,
           scan_count as scans_used,
           max_scans_per_day as max_scans
         FROM user_scan_limits
         WHERE user_id = $1 
           AND scan_date >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY scan_date DESC`,
        [userId]
      );
      
      return result.rows.map(row => ({
        date: row.scan_date,
        scansUsed: row.scans_used,
        maxScans: row.max_scans
      }));
    } catch (error) {
      console.error('Failed to get weekly usage:', error);
      return [];
    }
  }
}
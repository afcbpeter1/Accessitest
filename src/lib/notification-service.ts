import { query } from '@/lib/database'

export interface NotificationData {
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(data: NotificationData): Promise<void> {
    try {
      await query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [data.userId, data.title, data.message, data.type]
      )
      console.log(`📢 Notification created for user ${data.userId}: ${data.title}`)
    } catch (error) {
      console.error('❌ Error creating notification:', error)
    }
  }

  /**
   * Create notification for credit purchase
   */
  static async notifyCreditPurchase(userId: string, credits: number, packageName: string): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Credits Added',
      message: `You've successfully purchased ${credits} credits with the ${packageName}. You can now perform more accessibility scans.`,
      type: 'success'
    })
  }

  /**
   * Create notification for subscription activation
   */
  static async notifySubscriptionActivated(userId: string, planType: string): Promise<void> {
    const planName = this.getPlanDisplayName(planType)
    await this.createNotification({
      userId,
      title: 'Subscription Activated',
      message: `Your ${planName} subscription has been activated! You now have unlimited scans.`,
      type: 'success'
    })
  }

  /**
   * Create notification for subscription cancellation
   */
  static async notifySubscriptionCancelled(userId: string): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. You now have 3 free credits to continue scanning.',
      type: 'warning'
    })
  }

  /**
   * Create notification for low credits
   */
  static async notifyLowCredits(userId: string, remainingCredits: number): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Low Credits Warning',
      message: `You have ${remainingCredits} credits remaining. Consider purchasing more credits or upgrading to a subscription plan.`,
      type: 'warning'
    })
  }

  /**
   * Create notification for scan completion
   */
  static async notifyScanCompleted(userId: string, scanType: 'web' | 'document', fileName: string): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Scan Completed',
      message: `Your ${scanType} scan of "${fileName}" has been completed successfully.`,
      type: 'success'
    })
  }

  /**
   * Create notification for scan failure
   */
  static async notifyScanFailed(userId: string, scanType: 'web' | 'document', fileName: string, error: string): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Scan Failed',
      message: `Your ${scanType} scan of "${fileName}" failed: ${error}`,
      type: 'error'
    })
  }

  /**
   * Create notification for insufficient credits
   */
  static async notifyInsufficientCredits(userId: string): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Insufficient Credits',
      message: 'You don\'t have enough credits to perform this scan. Please purchase more credits or upgrade to a subscription plan.',
      type: 'error'
    })
  }

  /**
   * Get display name for plan type
   */
  private static getPlanDisplayName(planType: string): string {
    const planNames: Record<string, string> = {
      'web_only': 'Web Scan Only',
      'document_only': 'Document Scan Only',
      'complete_access': 'Unlimited Access',
      'free': 'Free'
    }
    return planNames[planType] || planType
  }
}

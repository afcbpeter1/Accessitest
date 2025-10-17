import { Resend } from 'resend'

// Check if RESEND_API_KEY is loaded
const resendApiKey = process.env.RESEND_API_KEY
if (!resendApiKey) {
  console.warn('RESEND_API_KEY not found in environment variables')
}

const resend = new Resend(resendApiKey || 'dummy-key-for-development')

export interface EmailVerificationData {
  email: string
  verificationCode: string
  firstName?: string
}

export interface PeriodicScanCompletionData {
  to: string
  scanTitle: string
  scanUrl?: string
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  scanHistoryId: string
  scanDate: string
  firstName?: string
}

export interface PeriodicScanFailureData {
  to: string
  scanTitle: string
  scanUrl?: string
  errorMessage: string
  scanDate: string
  firstName?: string
}

export class EmailService {
  static async sendVerificationEmail(data: EmailVerificationData): Promise<boolean> {
    try {
      const { email, verificationCode, firstName = 'User' } = data

      const result = await resend.emails.send({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: [email],
        subject: 'Verify your A11ytest.ai account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your A11ytest.ai account</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #06B6D4; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .verification-code { background: #0B1220; color: white; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .button { display: inline-block; background: #06B6D4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Welcome to A11ytest.ai!</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Thank you for signing up for A11ytest.ai! To complete your registration and start testing website accessibility, please verify your email address.</p>
              
              <p><strong>Your verification code is:</strong></p>
              <div class="verification-code">${verificationCode}</div>
              
              <p>Enter this code in the verification form to activate your account.</p>
              
              <p><strong>This code will expire in 15 minutes.</strong></p>
              
              <p>If you didn't create an account with A11ytest.ai, please ignore this email.</p>
              
              <p>Best regards,<br>The A11ytest.ai Team</p>
            </div>
            <div class="footer">
              <p>A11ytest.ai - Professional Accessibility Testing</p>
              <p>This email was sent to ${email}</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Welcome to A11ytest.ai!
          
          Hi ${firstName},
          
          Thank you for signing up for A11ytest.ai! To complete your registration and start testing website accessibility, please verify your email address.
          
          Your verification code is: ${verificationCode}
          
          Enter this code in the verification form to activate your account.
          
          This code will expire in 15 minutes.
          
          If you didn't create an account with A11ytest.ai, please ignore this email.
          
          Best regards,
          The A11ytest.ai Team
          
          A11ytest.ai - Professional Accessibility Testing
          This email was sent to ${email}
        `
      })

      if (result.error) {
        console.error('Failed to send verification email:', result.error)
        return false
      }

      console.log('Verification email sent successfully:', result.data?.id)
      return true
    } catch (error) {
      console.error('Error sending verification email:', error)
      return false
    }
  }

  static generateVerificationCode(): string {
    // Generate a 6-digit verification code
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  static async sendPeriodicScanCompletionEmail(data: PeriodicScanCompletionData): Promise<boolean> {
    try {
      const { 
        to, 
        scanTitle, 
        scanUrl, 
        totalIssues, 
        criticalIssues, 
        seriousIssues, 
        moderateIssues, 
        minorIssues, 
        scanHistoryId, 
        scanDate, 
        firstName = 'User' 
      } = data

      const result = await resend.emails.send({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: [to],
        subject: `✅ Periodic Scan Complete: ${scanTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Periodic Scan Complete</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .scan-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; }
              .issues-summary { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .issue-count { display: inline-block; margin: 5px 10px 5px 0; padding: 8px 12px; border-radius: 6px; font-weight: bold; }
              .critical { background: #FEE2E2; color: #DC2626; }
              .serious { background: #FED7AA; color: #EA580C; }
              .moderate { background: #FEF3C7; color: #D97706; }
              .minor { background: #DBEAFE; color: #2563EB; }
              .button { display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>✅ Periodic Scan Complete</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Your scheduled accessibility scan has completed successfully!</p>
              
              <div class="scan-info">
                <h3>📊 Scan Details</h3>
                <p><strong>Scan:</strong> ${scanTitle}</p>
                ${scanUrl ? `<p><strong>URL:</strong> <a href="${scanUrl}" target="_blank">${scanUrl}</a></p>` : ''}
                <p><strong>Completed:</strong> ${new Date(scanDate).toLocaleString()}</p>
              </div>
              
              <div class="issues-summary">
                <h3>🔍 Accessibility Issues Found</h3>
                <p><strong>Total Issues:</strong> ${totalIssues}</p>
                <div>
                  ${criticalIssues > 0 ? `<span class="issue-count critical">${criticalIssues} Critical</span>` : ''}
                  ${seriousIssues > 0 ? `<span class="issue-count serious">${seriousIssues} Serious</span>` : ''}
                  ${moderateIssues > 0 ? `<span class="issue-count moderate">${moderateIssues} Moderate</span>` : ''}
                  ${minorIssues > 0 ? `<span class="issue-count minor">${minorIssues} Minor</span>` : ''}
                </div>
                ${totalIssues === 0 ? '<p style="color: #10B981; font-weight: bold;">🎉 No accessibility issues found! Great job!</p>' : ''}
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/scan-history/${scanHistoryId}" class="button">View Full Report</a>
              </div>
              
              <p>This scan was part of your scheduled periodic accessibility monitoring. Keep up the great work maintaining accessible websites!</p>
              
              <p>Best regards,<br>The A11ytest.ai Team</p>
            </div>
            <div class="footer">
              <p>A11ytest.ai - Professional Accessibility Testing</p>
              <p>This email was sent to ${to}</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Periodic Scan Complete - ${scanTitle}
          
          Hi ${firstName},
          
          Your scheduled accessibility scan has completed successfully!
          
          Scan Details:
          - Scan: ${scanTitle}
          ${scanUrl ? `- URL: ${scanUrl}` : ''}
          - Completed: ${new Date(scanDate).toLocaleString()}
          
          Accessibility Issues Found:
          - Total Issues: ${totalIssues}
          - Critical: ${criticalIssues}
          - Serious: ${seriousIssues}
          - Moderate: ${moderateIssues}
          - Minor: ${minorIssues}
          
          ${totalIssues === 0 ? '🎉 No accessibility issues found! Great job!' : ''}
          
          View your full report: ${process.env.NEXT_PUBLIC_APP_URL}/scan-history/${scanHistoryId}
          
          This scan was part of your scheduled periodic accessibility monitoring.
          
          Best regards,
          The A11ytest.ai Team
          
          A11ytest.ai - Professional Accessibility Testing
          This email was sent to ${to}
        `
      })

      if (result.error) {
        console.error('Failed to send periodic scan completion email:', result.error)
        return false
      }

      console.log('Periodic scan completion email sent successfully:', result.data?.id)
      return true
    } catch (error) {
      console.error('Error sending periodic scan completion email:', error)
      return false
    }
  }

  static async sendPeriodicScanFailureEmail(data: PeriodicScanFailureData): Promise<boolean> {
    try {
      const { to, scanTitle, scanUrl, errorMessage, scanDate, firstName = 'User' } = data

      const result = await resend.emails.send({
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: [to],
        subject: `❌ Periodic Scan Failed: ${scanTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Periodic Scan Failed</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .scan-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444; }
              .error-details { background: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #FECACA; }
              .button { display: inline-block; background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>❌ Periodic Scan Failed</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Unfortunately, your scheduled accessibility scan encountered an error and could not complete.</p>
              
              <div class="scan-info">
                <h3>📊 Scan Details</h3>
                <p><strong>Scan:</strong> ${scanTitle}</p>
                ${scanUrl ? `<p><strong>URL:</strong> <a href="${scanUrl}" target="_blank">${scanUrl}</a></p>` : ''}
                <p><strong>Attempted:</strong> ${new Date(scanDate).toLocaleString()}</p>
              </div>
              
              <div class="error-details">
                <h3>⚠️ Error Details</h3>
                <p><strong>Error Message:</strong> ${errorMessage}</p>
                <p>Our system will automatically retry this scan. If the problem persists, please check your scan settings or contact support.</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/periodic-scans" class="button">Manage Periodic Scans</a>
              </div>
              
              <p>Don't worry - your periodic scan will be retried automatically. If you continue to experience issues, please check your scan configuration.</p>
              
              <p>Best regards,<br>The A11ytest.ai Team</p>
            </div>
            <div class="footer">
              <p>A11ytest.ai - Professional Accessibility Testing</p>
              <p>This email was sent to ${to}</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Periodic Scan Failed - ${scanTitle}
          
          Hi ${firstName},
          
          Unfortunately, your scheduled accessibility scan encountered an error and could not complete.
          
          Scan Details:
          - Scan: ${scanTitle}
          ${scanUrl ? `- URL: ${scanUrl}` : ''}
          - Attempted: ${new Date(scanDate).toLocaleString()}
          
          Error Details:
          - Error Message: ${errorMessage}
          
          Our system will automatically retry this scan. If the problem persists, please check your scan settings or contact support.
          
          Manage your periodic scans: ${process.env.NEXT_PUBLIC_APP_URL}/periodic-scans
          
          Don't worry - your periodic scan will be retried automatically.
          
          Best regards,
          The A11ytest.ai Team
          
          A11ytest.ai - Professional Accessibility Testing
          This email was sent to ${to}
        `
      })

      if (result.error) {
        console.error('Failed to send periodic scan failure email:', result.error)
        return false
      }

      console.log('Periodic scan failure email sent successfully:', result.data?.id)
      return true
    } catch (error) {
      console.error('Error sending periodic scan failure email:', error)
      return false
    }
  }
}


import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailVerificationData {
  email: string
  verificationCode: string
  firstName?: string
}

export interface OrganizationInvitationData {
  email: string
  organizationName: string
  inviterName?: string
  invitationToken?: string
}

export interface BillingConfirmationData {
  email: string
  organizationName: string
  numberOfUsers: number
  amount: string
  billingPeriod: 'monthly' | 'yearly'
  subscriptionId?: string
}


export class EmailService {
  static async sendVerificationEmail(data: EmailVerificationData): Promise<boolean> {
    try {
      const { email, verificationCode, firstName = 'User' } = data

      // Use same hardcoded address as receipt emails for consistency
      const result = await resend.emails.send({
        from: 'A11ytest.ai <onboarding@resend.dev>',
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
        console.error('❌ Failed to send verification email. Error:', JSON.stringify(result.error, null, 2))
        console.error('📧 Attempted to send to:', email)
        return false
      }
      return true
    } catch (error) {
      console.error('❌ Exception sending verification email:', error)
      return false
    }
  }

  static generateVerificationCode(): string {
    // Generate a 6-digit verification code
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  static async sendOrganizationInvitation(data: OrganizationInvitationData): Promise<boolean> {
    try {
      const { email, organizationName, inviterName = 'A team member', invitationToken } = data
      
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const signupUrl = invitationToken 
        ? `${baseUrl}/signup?invite=${invitationToken}&email=${encodeURIComponent(email)}`
        : `${baseUrl}/signup?email=${encodeURIComponent(email)}`
      const acceptUrl = invitationToken
        ? `${baseUrl}/accept-invitation?token=${invitationToken}`
        : `${baseUrl}/organization`

      const result = await resend.emails.send({
        from: 'A11ytest.ai <onboarding@resend.dev>',
        to: [email],
        subject: `You've been invited to join ${organizationName} on A11ytest.ai`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Organization Invitation</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #06B6D4; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .button { display: inline-block; background: #06B6D4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Organization Invitation</h1>
            </div>
            <div class="content">
              <h2>Hi there,</h2>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on A11ytest.ai.</p>
              
              <p>You can access the organization's shared resources, including:</p>
              <ul>
                <li>Shared credit pool</li>
                <li>Team integrations</li>
                <li>Collaborative issue tracking</li>
              </ul>
              
              ${invitationToken ? `
                <p><strong>Don't have an account yet?</strong></p>
                <p><a href="${signupUrl}" class="button">Sign Up & Accept Invitation</a></p>
                
                <p><strong>Already have an account?</strong></p>
                <p><a href="${acceptUrl}" class="button">Accept Invitation</a></p>
              ` : `
                <p><a href="${baseUrl}/organization" class="button">View Organization</a></p>
              `}
              
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
          Organization Invitation
          
          Hi there,
          
          ${inviterName} has invited you to join ${organizationName} on A11ytest.ai.
          
          You can access the organization's shared resources, including:
          - Shared credit pool
          - Team integrations
          - Collaborative issue tracking
          
          ${invitationToken ? `
          Don't have an account yet? Sign up here: ${signupUrl}
          
          Already have an account? Accept invitation here: ${acceptUrl}
          ` : `
          View organization: ${baseUrl}/organization
          `}
          
          Best regards,
          The A11ytest.ai Team
          
          A11ytest.ai - Professional Accessibility Testing
          This email was sent to ${email}
        `
      })

      if (result.error) {
        console.error('❌ Failed to send organization invitation email. Error:', JSON.stringify(result.error, null, 2))
        return false
      }
      return true
    } catch (error) {
      console.error('❌ Exception sending organization invitation email:', error)
      return false
    }
  }

  static async sendBillingConfirmation(data: BillingConfirmationData): Promise<boolean> {
    try {
      const { email, organizationName, numberOfUsers, amount, billingPeriod, subscriptionId } = data
      
      const billingText = billingPeriod === 'yearly' ? 'yearly' : 'monthly'
      const billingFrequency = billingPeriod === 'yearly' ? 'per year' : 'per month'
      
      const result = await resend.emails.send({
        from: 'A11ytest.ai <onboarding@resend.dev>',
        to: [email],
        subject: `Billing Confirmation - ${numberOfUsers} Additional User Seat${numberOfUsers > 1 ? 's' : ''} Added`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Billing Confirmation</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #06B6D4; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .info-box { background: white; border-left: 4px solid #06B6D4; padding: 15px; margin: 20px 0; }
              .amount { font-size: 24px; font-weight: bold; color: #06B6D4; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Billing Confirmation</h1>
            </div>
            <div class="content">
              <h2>Thank you for your purchase!</h2>
              <p>Your additional user seats have been successfully added to <strong>${organizationName}</strong>.</p>
              
              <div class="info-box">
                <p><strong>Purchase Details:</strong></p>
                <p>Number of Seats: <strong>${numberOfUsers}</strong></p>
                <p>Amount: <span class="amount">${amount}</span> ${billingFrequency}</p>
                <p>Billing: <strong>${billingText.charAt(0).toUpperCase() + billingText.slice(1)}</strong></p>
                ${subscriptionId ? `<p>Subscription ID: ${subscriptionId}</p>` : ''}
              </div>
              
              <h3>How This Works:</h3>
              <ul>
                <li><strong>Added to Your Current Bill:</strong> This charge is added to your existing subscription and will appear on your next invoice.</li>
                <li><strong>Automatic Billing:</strong> You'll be charged ${billingFrequency} for these additional seats, aligned with your current billing cycle.</li>
                <li><strong>Immediate Access:</strong> You can now invite up to ${numberOfUsers} more user${numberOfUsers > 1 ? 's' : ''} to your organization.</li>
                <li><strong>Shared Credits:</strong> All users in your organization share the same credit pool.</li>
              </ul>
              
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Go to your <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/organization?tab=members">Organization page</a></li>
                <li>Click "Invite Member" to add users</li>
                <li>Users will receive an invitation email to join your organization</li>
              </ol>
              
              <p>If you have any questions about your billing, please contact our support team.</p>
              
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
          Billing Confirmation
          
          Thank you for your purchase!
          
          Your additional user seats have been successfully added to ${organizationName}.
          
          Purchase Details:
          - Number of Seats: ${numberOfUsers}
          - Amount: ${amount} ${billingFrequency}
          - Billing: ${billingText.charAt(0).toUpperCase() + billingText.slice(1)}
          ${subscriptionId ? `- Subscription ID: ${subscriptionId}` : ''}
          
          How This Works:
          - Added to Your Current Bill: This charge is added to your existing subscription and will appear on your next invoice.
          - Automatic Billing: You'll be charged ${billingFrequency} for these additional seats, aligned with your current billing cycle.
          - Immediate Access: You can now invite up to ${numberOfUsers} more user${numberOfUsers > 1 ? 's' : ''} to your organization.
          - Shared Credits: All users in your organization share the same credit pool.
          
          Next Steps:
          1. Go to your Organization page: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/organization?tab=members
          2. Click "Invite Member" to add users
          3. Users will receive an invitation email to join your organization
          
          If you have any questions about your billing, please contact our support team.
          
          Best regards,
          The A11ytest.ai Team
          
          A11ytest.ai - Professional Accessibility Testing
          This email was sent to ${email}
        `
      })

      if (result.error) {
        console.error('❌ Failed to send billing confirmation email. Error:', JSON.stringify(result.error, null, 2))
        return false
      }
      return true
    } catch (error) {
      console.error('❌ Exception sending billing confirmation email:', error)
      return false
    }
  }
}

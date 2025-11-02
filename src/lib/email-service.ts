import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailVerificationData {
  email: string
  verificationCode: string
  firstName?: string
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
        console.error('📧 Attempted to send from:', `${fromName} <${fromEmail}>`)
        console.error('📧 Attempted to send to:', email)
        return false
      }

      console.log('✅ Verification email sent successfully! Message ID:', result.data?.id)
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
}

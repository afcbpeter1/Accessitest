import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getEmailManageLinksFooterHtml, getEmailManageLinksFooterText } from './email-links'

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development')

// Use verified domain email address (a11ytest.ai is verified in Resend)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || 'A11ytest.ai <hello@a11ytest.ai>'

// Get logo as base64 for email embedding (most reliable for email clients)
function getLogoUrl(): string {
  try {
    // Try to load from local file first (more reliable)
    const logoPath = join(process.cwd(), 'public', 'allytest.png')
    const logoBuffer = readFileSync(logoPath)
    const base64Logo = logoBuffer.toString('base64')
    return `data:image/png;base64,${base64Logo}`
  } catch (error) {
    console.error('❌ Error loading local logo file, using Cloudinary URL:', error)
    // Fallback to Cloudinary URL if local file not found
    // Use direct Cloudinary URL (make sure it's publicly accessible)
    return 'https://res.cloudinary.com/dyzzpsxov/image/upload/v1764106136/allytest_vmuws6.png'
  }
}

export interface SubscriptionPaymentData {
  customerEmail: string
  customerName?: string
  planName: string
  amount: string
  billingPeriod: 'Monthly' | 'Yearly'
  invoiceId: string
  date: string
  nextBillingDate: string
}

export interface SubscriptionCancellationData {
  customerEmail: string
  customerName?: string
  planName: string
  cancellationDate: string
  accessEndDate: string
  savedCredits?: number
}

export interface SubscriptionReactivationData {
  customerEmail: string
  customerName?: string
  planName: string
  reactivationDate: string
  nextBillingDate?: string
  billingPeriod: 'Monthly' | 'Yearly'
}

/**
 * Send email when a recurring subscription payment is processed
 */
export async function sendSubscriptionPaymentEmail(data: SubscriptionPaymentData) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping subscription payment email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, amount, billingPeriod, invoiceId, date, nextBillingDate, customerName } = data

    const subject = `Subscription Payment Processed - ${planName} - A11ytest.ai`
    
    // Use Cloudinary logo URL with white background
    const logoUrl = getLogoUrl()
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Payment - A11ytest.ai</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: #ffffff;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            border-bottom: 2px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 20px;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
          }
          .logo-img {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
            background: #ffffff;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #0B1220;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            color: #6b7280;
            font-size: 16px;
            font-weight: 400;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 30px;
            font-weight: 500;
          }
          .payment-card {
            background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          .payment-title {
            font-size: 20px;
            font-weight: 600;
            color: #0B1220;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e5e7eb;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .detail-row:last-of-type {
            border-bottom: none;
            padding-top: 20px;
            margin-top: 8px;
            border-top: 2px solid #e5e7eb;
          }
          .detail-label {
            color: #6b7280;
            font-size: 15px;
            font-weight: 500;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 600;
            font-size: 15px;
            text-align: right;
          }
          .detail-row:last-of-type .detail-value {
            font-size: 24px;
            color: #0B1220;
            font-weight: 700;
          }
          .info-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #22c55e;
            border-radius: 8px;
            padding: 24px;
            margin: 30px 0;
          }
          .info-box-title {
            color: #166534;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-box-text {
            color: #166534;
            line-height: 1.8;
            margin: 0;
          }
          .cta-container {
            text-align: center;
            margin: 40px 0 30px;
          }
          .cta-button {
            display: inline-block;
            background: #ffffff;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(11, 18, 32, 0.2);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(11, 18, 32, 0.3);
          }
          .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
          }
          .footer-link {
            color: #0B1220;
            text-decoration: none;
            font-weight: 500;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
          .invoice-id {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #4b5563;
            word-break: break-all;
          }
          @media only screen and (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 30px 20px;
            }
            .content {
              padding: 30px 20px;
            }
            .payment-card {
              padding: 20px;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 4px;
            }
            .detail-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-container">
              <div class="header-title" style="font-size: 32px; font-weight: 700; color: #0B1220; letter-spacing: -1px;">A11ytest.ai</div>
            </div>
            <div class="header-title" style="margin-top: 20px;">Subscription Payment Processed</div>
            <div class="header-subtitle">Thank you for your continued subscription</div>
          </div>

          <div class="content">
            <div class="greeting" style="margin-bottom: 40px;">
              ${customerName ? `Hello ${customerName},` : 'Hello,'}
            </div>
            
            <p style="font-size: 16px; color: #1f2937; line-height: 1.8; margin-bottom: 30px;">
              We are pleased to confirm that your subscription payment has been successfully processed.
            </p>

            <div class="payment-card">
              <div class="payment-title">Payment Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Plan</span>
                <span class="detail-value">${planName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Billing Period</span>
                <span class="detail-value">${billingPeriod}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice ID</span>
                <span class="detail-value invoice-id">${invoiceId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Date</span>
                <span class="detail-value">${date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Next Billing Date</span>
                <span class="detail-value">${nextBillingDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount Charged</span>
                <span class="detail-value">${amount}</span>
              </div>
            </div>

            <div class="info-box">
              <div class="info-box-title">
                <span>✅ Your Subscription is Active</span>
              </div>
              <p class="info-box-text">
                Your ${billingPeriod.toLowerCase()} subscription payment has been successfully processed. 
                You continue to have unlimited access to all features.
              </p>
            </div>

            <div class="cta-container">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
                Go to Dashboard
              </a>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">
              Need help? <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings" class="footer-link">Contact Support</a>
            </p>
            <p class="footer-text" style="margin-bottom: 0;">
              This is an automated payment confirmation. Please keep this email for your records.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      A11ytest.ai - Subscription Payment Processed

      Thank you for your continued subscription!

      Plan: ${planName}
      Billing Period: ${billingPeriod}
      Invoice ID: ${invoiceId}
      Payment Date: ${date}
      Next Billing Date: ${nextBillingDate}
      Amount Charged: ${amount}

      Your subscription is active and you continue to have unlimited access to all features.

      Dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard
      Support: ${process.env.NEXT_PUBLIC_BASE_URL}/settings

      This is an automated payment confirmation. Please keep this email for your records.
    `

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    if (result.error) {
      console.error('❌ Resend API returned an error:', result.error)
      return { success: false, error: JSON.stringify(result.error) }
    }

    if (!result.data?.id) {
      console.error('❌ Resend API response has no message ID')
      return { success: false, error: 'No message ID in response' }
    }

    return { success: true, messageId: result.data.id }

  } catch (error) {
    console.error('❌ Failed to send subscription payment email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Send email when a subscription is cancelled
 */
export async function sendSubscriptionCancellationEmail(data: SubscriptionCancellationData) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping cancellation email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, cancellationDate, accessEndDate, savedCredits, customerName } = data

    const subject = `Subscription Cancelled - A11ytest.ai`
    
    // Use Cloudinary logo URL with white background
    const logoUrl = getLogoUrl()
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled - A11ytest.ai</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: #ffffff;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            border-bottom: 2px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 20px;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
          }
          .logo-img {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
            background: #ffffff;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #0B1220;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            color: #6b7280;
            font-size: 16px;
            font-weight: 400;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 30px;
            font-weight: 500;
          }
          .cancellation-card {
            background: linear-gradient(to bottom, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #f59e0b;
            border-left: 4px solid #f59e0b;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          .cancellation-title {
            font-size: 20px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #fbbf24;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #fde68a;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #92400e;
            font-size: 15px;
            font-weight: 500;
          }
          .detail-value {
            color: #78350f;
            font-weight: 600;
            font-size: 15px;
            text-align: right;
          }
          .info-box {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-left: 4px solid #3b82f6;
            border-radius: 8px;
            padding: 24px;
            margin: 30px 0;
          }
          .info-box-title {
            color: #1e40af;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .info-box-list {
            color: #1e40af;
            margin: 0;
            padding-left: 24px;
            line-height: 1.8;
          }
          .info-box-list li {
            margin-bottom: 8px;
          }
          .credits-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #22c55e;
            border-radius: 8px;
            padding: 24px;
            margin: 30px 0;
          }
          .credits-box-title {
            color: #166534;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .credits-box-text {
            color: #166534;
            line-height: 1.8;
            margin: 0;
          }
          .cta-container {
            text-align: center;
            margin: 40px 0 30px;
          }
          .cta-button {
            display: inline-block;
            background: #ffffff;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(11, 18, 32, 0.2);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(11, 18, 32, 0.3);
          }
          .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
          }
          .footer-link {
            color: #0B1220;
            text-decoration: none;
            font-weight: 500;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
          @media only screen and (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 30px 20px;
            }
            .content {
              padding: 30px 20px;
            }
            .cancellation-card {
              padding: 20px;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 4px;
            }
            .detail-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-container">
              <div class="header-title" style="font-size: 32px; font-weight: 700; color: #0B1220; letter-spacing: -1px;">A11ytest.ai</div>
            </div>
            <div class="header-title" style="margin-top: 20px;">Subscription Cancelled</div>
            <div class="header-subtitle">We're sorry to see you go</div>
          </div>

          <div class="content">
            <div class="greeting" style="margin-bottom: 40px;">
              ${customerName ? `Hello ${customerName},` : 'Hello,'}
            </div>
            
            <p style="font-size: 16px; color: #1f2937; line-height: 1.8; margin-bottom: 30px;">
              We have received your request to cancel your subscription.
            </p>

            <div class="cancellation-card">
              <div class="cancellation-title">Cancellation Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Plan</span>
                <span class="detail-value">${planName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Cancellation Date</span>
                <span class="detail-value">${cancellationDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Access Ends</span>
                <span class="detail-value">${accessEndDate}</span>
              </div>
            </div>

            ${savedCredits && savedCredits > 0 ? `
            <div class="credits-box">
              <div class="credits-box-title">💎 Your Saved Credits</div>
              <p class="credits-box-text">
                Good news! You have ${savedCredits} saved credits that you can continue to use after your subscription ends. 
                These credits will remain available for your use.
              </p>
            </div>
            ` : ''}

            <div class="info-box">
              <div class="info-box-title">What Happens Next?</div>
              <ul class="info-box-list">
                <li>Your subscription will remain active until ${accessEndDate}</li>
                <li>You'll continue to have unlimited access until then</li>
                ${savedCredits && savedCredits > 0 ? `<li>After that, you can use your ${savedCredits} saved credits</li>` : ''}
                <li>You can resubscribe anytime from your dashboard</li>
              </ul>
            </div>

            <div class="cta-container">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/pricing" class="cta-button">
                Resubscribe
              </a>
            </div>
          </div>

          <div class="footer">
            ${getEmailManageLinksFooterHtml(customerEmail)}
            <p class="footer-text" style="margin-top: 12px;">We'd love to have you back! <a href="${process.env.NEXT_PUBLIC_BASE_URL}/pricing" class="footer-link">View Plans</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      A11ytest.ai - Subscription Cancelled

      We're sorry to see you go.

      Plan: ${planName}
      Cancellation Date: ${cancellationDate}
      Access Ends: ${accessEndDate}
      ${savedCredits && savedCredits > 0 ? `Saved Credits: ${savedCredits}` : ''}

      What Happens Next?
      - Your subscription will remain active until ${accessEndDate}
      - You'll continue to have unlimited access until then
      ${savedCredits && savedCredits > 0 ? `- After that, you can use your ${savedCredits} saved credits` : ''}
      - You can resubscribe anytime from your dashboard

      ${getEmailManageLinksFooterText(customerEmail)}
      View Plans: ${process.env.NEXT_PUBLIC_BASE_URL}/pricing

      We'd love to have you back!
    `

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    if (result.error) {
      console.error('❌ Resend API returned an error:', result.error)
      return { success: false, error: JSON.stringify(result.error) }
    }

    if (!result.data?.id) {
      console.error('❌ Resend API response has no message ID')
      return { success: false, error: 'No message ID in response' }
    }

    return { success: true, messageId: result.data.id }

  } catch (error) {
    console.error('❌ Failed to send cancellation email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export interface AccountDeletedData {
  customerEmail: string
  customerName?: string
}

/**
 * Send email when a user permanently deletes their account.
 * Use this instead of the subscription cancellation email when the account was deleted
 * (no "access until end of period" - account is gone).
 */
export async function sendAccountDeletedEmail(data: AccountDeletedData) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping account deleted email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, customerName } = data

    const subject = `Sorry to see you go - A11ytest.ai`

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deleted - A11ytest.ai</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; padding: 40px 20px; margin: 0; }
          .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { padding: 40px 30px; text-align: center; border-bottom: 2px solid #e5e7eb; }
          .header-title { font-size: 28px; font-weight: 700; color: #0B1220; margin-bottom: 8px; }
          .header-subtitle { color: #6b7280; font-size: 16px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 18px; color: #1f2937; margin-bottom: 20px; font-weight: 500; }
          .message { font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 24px; }
          .note { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; font-size: 14px; color: #991b1b; margin-bottom: 24px; }
          .footer { padding: 24px 30px; text-align: center; background: #f9fafb; font-size: 14px; color: #6b7280; }
          .footer a { color: #2563eb; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="header-title">A11ytest.ai</div>
            <div class="header-subtitle">Sorry to see you go</div>
          </div>
          <div class="content">
            <div class="greeting">${customerName ? `Hello ${customerName},` : 'Hello,'}</div>
            <p class="message">
              Your account has been permanently deleted. We're sorry to see you go.
            </p>
            <div class="note">
              You have forfeited the remainder of your subscription and any unused credits. This action cannot be undone.
            </div>
          </div>
          <div class="footer">
            <p>Thank you for using A11ytest.ai.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
A11ytest.ai - Sorry to see you go

${customerName ? `Hello ${customerName},` : 'Hello,'}

Your account has been permanently deleted. We're sorry to see you go.

You have forfeited the remainder of your subscription and any unused credits. This action cannot be undone.

Thank you for using A11ytest.ai.
    `.trim()

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    if (result.error) {
      console.error('❌ Resend API returned an error (account deleted email):', result.error)
      return { success: false, error: JSON.stringify(result.error) }
    }

    return { success: true, messageId: result.data?.id }

  } catch (error) {
    console.error('❌ Failed to send account deleted email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Send email when a subscription is reactivated
 */
export async function sendSubscriptionReactivationEmail(data: SubscriptionReactivationData) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping reactivation email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, reactivationDate, nextBillingDate, billingPeriod, customerName } = data
    
    // Ensure nextBillingDate is not 'N/A' - use fallback if needed
    const displayNextBillingDate = nextBillingDate && nextBillingDate !== 'N/A' ? nextBillingDate : null

    const subject = `Subscription Reactivated - ${planName} - A11ytest.ai`
    
    // Use Cloudinary logo URL with white background
    const logoUrl = getLogoUrl()
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Reactivated - A11ytest.ai</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 40px 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: #ffffff;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            border-bottom: 2px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 20px;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
          }
          .logo-img {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
            background: #ffffff;
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #0B1220;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .header-subtitle {
            color: #6b7280;
            font-size: 16px;
            font-weight: 400;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 30px;
            font-weight: 500;
          }
          .reactivation-card {
            background: linear-gradient(to bottom, #f0fdf4 0%, #dcfce7 100%);
            border: 1px solid #22c55e;
            border-left: 4px solid #22c55e;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          .reactivation-title {
            font-size: 20px;
            font-weight: 600;
            color: #166534;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #86efac;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #dcfce7;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #166534;
            font-size: 15px;
            font-weight: 500;
          }
          .detail-value {
            color: #15803d;
            font-weight: 600;
            font-size: 15px;
            text-align: right;
          }
          .info-box {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-left: 4px solid #3b82f6;
            border-radius: 8px;
            padding: 24px;
            margin: 30px 0;
          }
          .info-box-title {
            color: #1e40af;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .info-box-text {
            color: #1e40af;
            line-height: 1.8;
            margin: 0;
          }
          .cta-container {
            text-align: center;
            margin: 40px 0 30px;
          }
          .cta-button {
            display: inline-block;
            background: #ffffff;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(11, 18, 32, 0.2);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(11, 18, 32, 0.3);
          }
          .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
          }
          .footer-link {
            color: #0B1220;
            text-decoration: none;
            font-weight: 500;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
          @media only screen and (max-width: 600px) {
            body {
              padding: 20px 10px;
            }
            .header {
              padding: 30px 20px;
            }
            .content {
              padding: 30px 20px;
            }
            .reactivation-card {
              padding: 20px;
            }
            .detail-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 4px;
            }
            .detail-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-container">
              <div class="header-title" style="font-size: 32px; font-weight: 700; color: #0B1220; letter-spacing: -1px;">A11ytest.ai</div>
            </div>
            <div class="header-title" style="margin-top: 20px;">Subscription Reactivated</div>
            <div class="header-subtitle">Your subscription is active again</div>
          </div>

          <div class="content">
            <div class="greeting" style="margin-bottom: 40px;">
              ${customerName ? `Hello ${customerName},` : 'Hello,'}
            </div>

            <p style="font-size: 16px; color: #1f2937; line-height: 1.8; margin-bottom: 30px;">
              We are pleased to confirm that your subscription has been successfully reactivated.
            </p>

            <div class="reactivation-card">
              <div class="reactivation-title">Reactivation Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Plan</span>
                <span class="detail-value">${planName}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Billing Period</span>
                <span class="detail-value">${billingPeriod}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Reactivation Date</span>
                <span class="detail-value">${reactivationDate}</span>
              </div>
              
              ${displayNextBillingDate ? `
              <div class="detail-row">
                <span class="detail-label">Next Billing Date</span>
                <span class="detail-value">${displayNextBillingDate}</span>
              </div>
              ` : ''}
            </div>

            <div class="info-box" style="margin-top: 40px;">
              <div class="info-box-title">✅ Your Subscription is Active</div>
              <p class="info-box-text">
                Your subscription has been reactivated and you continue to have unlimited access to all features.
                ${displayNextBillingDate ? `Your subscription will automatically renew on ${displayNextBillingDate}.` : 'Your subscription will continue to renew automatically according to your billing cycle.'}
              </p>
            </div>

            <div class="cta-container">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
                Go to Dashboard
              </a>
            </div>
          </div>

          <div class="footer">
            ${getEmailManageLinksFooterHtml(customerEmail)}
            <p class="footer-text" style="margin-top: 12px; margin-bottom: 0;">
              This is an automated confirmation. Please keep this email for your records.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      A11ytest.ai - Subscription Reactivated

      Welcome back! Your subscription is active again.

      Plan: ${planName}
      Billing Period: ${billingPeriod}
      Reactivation Date: ${reactivationDate}
      ${displayNextBillingDate ? `Next Billing Date: ${displayNextBillingDate}` : ''}

      Your subscription has been reactivated and you continue to have unlimited access to all features.
      ${displayNextBillingDate ? `Your subscription will automatically renew on ${displayNextBillingDate}.` : 'Your subscription will continue to renew automatically according to your billing cycle.'}

      Dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard
      ${getEmailManageLinksFooterText(customerEmail)}

      This is an automated confirmation. Please keep this email for your records.
    `

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    if (result.error) {
      console.error('❌ Resend API returned an error:', result.error)
      return { success: false, error: JSON.stringify(result.error) }
    }

    if (!result.data?.id) {
      console.error('❌ Resend API response has no message ID')
      return { success: false, error: 'No message ID in response' }
    }

    return { success: true, messageId: result.data.id }

  } catch (error) {
    console.error('❌ Failed to send reactivation email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


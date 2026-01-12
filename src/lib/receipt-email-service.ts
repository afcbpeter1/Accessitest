import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join } from 'path'

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development')

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

export interface ReceiptData {
  customerEmail: string
  customerName?: string
  planName: string
  amount: string
  type: 'subscription' | 'credits'
  transactionId: string
  date: string
  billingPeriod?: string
  creditAmount?: number
}

export async function sendReceiptEmail(receiptData: ReceiptData) {
  try {


    || 'NOT SET')
    
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping receipt email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, amount, type, transactionId, date, billingPeriod, creditAmount } = receiptData

    const subject = `Receipt for ${planName} - A11ytest.ai`
    
    // Use Cloudinary logo URL with white background
    const logoUrl = getLogoUrl()
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - A11ytest.ai</title>
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
          .receipt-card {
            background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          .receipt-title {
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
            display: flex;
            align-items: center;
            gap: 8px;
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
          .cta-container {
            text-align: center;
            margin: 40px 0 30px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #0B1220 0%, #1f2937 100%);
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
          .transaction-id {
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
            .receipt-card {
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
            <div class="header-title" style="margin-top: 20px;">Payment Receipt</div>
            <div class="header-subtitle">Thank you for your purchase</div>
          </div>

          <div class="content">
            <div class="greeting" style="margin-bottom: 40px;">
              ${receiptData.customerName ? `Hello ${receiptData.customerName},` : 'Hello,'}
            </div>
            
            <p style="font-size: 16px; color: #1f2937; line-height: 1.8; margin-bottom: 30px;">
              We are pleased to confirm that your payment has been successfully processed.
            </p>

            <div class="receipt-card">
              <div class="receipt-title">Receipt Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Plan</span>
                <span class="detail-value">${planName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <span class="detail-value">${type === 'subscription' ? 'Subscription' : 'Credit Package'}</span>
              </div>
              ${billingPeriod ? `
              <div class="detail-row">
                <span class="detail-label">Billing Period</span>
                <span class="detail-value">${billingPeriod}</span>
              </div>
              ` : ''}
              ${creditAmount ? `
              <div class="detail-row">
                <span class="detail-label">Credits Added</span>
                <span class="detail-value">${creditAmount} scans</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Transaction ID</span>
                <span class="detail-value transaction-id">${transactionId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Total Amount</span>
                <span class="detail-value">${amount}</span>
              </div>
            </div>

            <div class="info-box">
              <div class="info-box-title">
                <span>✨ What's Next?</span>
              </div>
              <ul class="info-box-list">
                ${type === 'subscription' ? `
                <li>Your subscription is now active and ready to use</li>
                <li>Access all premium features immediately</li>
                ` : `
                <li>Your credits have been added to your account</li>
                <li>Start running accessibility scans right away</li>
                `}
                <li>Check your dashboard for usage details</li>
              </ul>
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
              This is an automated receipt. Please keep this email for your records.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      A11ytest.ai - Payment Receipt

      Thank you for your purchase!

      Plan: ${planName}
      Type: ${type === 'subscription' ? 'Subscription' : 'Credit Package'}
      ${billingPeriod ? `Billing Period: ${billingPeriod}` : ''}
      ${creditAmount ? `Credits Added: ${creditAmount} scans` : ''}
      Transaction ID: ${transactionId}
      Date: ${date}
      Total Amount: ${amount}

      What's Next?
      ${type === 'subscription' 
        ? '- Your subscription is now active and ready to use\n- Access all premium features immediately'
        : '- Your credits have been added to your account\n- Start running accessibility scans right away'
      }
      - Check your dashboard for usage details

      Dashboard: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard
      Support: ${process.env.NEXT_PUBLIC_BASE_URL}/settings

      This is an automated receipt. Please keep this email for your records.
    `

    const result = await resend.emails.send({
      from: 'A11ytest.ai <onboarding@resend.dev>',
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    // Log full response for debugging
    )
    
    // Check for errors in the response
    if (result.error) {
      console.error('❌ Resend API returned an error:', result.error)
      return { success: false, error: JSON.stringify(result.error) }
    }

    // Check if data exists
    if (!result.data) {
      console.error('❌ Resend API response has no data field')
      return { success: false, error: 'No data in response' }
    }

    const messageId = result.data.id
    if (!messageId) {
      console.error('❌ Resend API response has no message ID')
      console.error('Full response data:', JSON.stringify(result.data, null, 2))
      return { success: false, error: 'No message ID in response' }
    }

    return { success: true, messageId }

  } catch (error) {
    console.error('❌ Failed to send receipt email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

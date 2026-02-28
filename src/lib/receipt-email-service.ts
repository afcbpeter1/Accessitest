import { Resend } from 'resend'
import { getEmailManageLinksFooterHtml, getEmailManageLinksFooterText, getManageBillingUrl, getProfileUrl } from './email-links'

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development')

// Public logo URL for emails (many clients block data URIs; use a stable CDN URL)
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL?.trim() ||
  'https://res.cloudinary.com/dyzzpsxov/image/upload/v1764106136/allytest_vmuws6.png'

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
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping receipt email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, amount, type, transactionId, date, billingPeriod, creditAmount } = receiptData

    const subject = `Receipt for ${planName} - A11ytest.ai`
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://a11ytest.ai'

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - A11ytest.ai</title>
        <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <![endif]-->
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
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
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          }
          .brand-bar {
            height: 4px;
            background: linear-gradient(90deg, #06B6D4 0%, #0891b2 100%);
            width: 100%;
          }
          .header {
            background: #ffffff;
            padding: 40px 30px 32px;
            text-align: center;
            border-bottom: 2px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 24px;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            display: inline-block;
          }
          .logo-img {
            max-width: 180px;
            width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
            border: 0;
            outline: none;
            text-decoration: none;
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
            padding: 40px 30px 36px;
          }
          .greeting {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 32px;
            font-weight: 500;
          }
          .intro-text {
            font-size: 16px;
            color: #1f2937;
            line-height: 1.8;
            margin-bottom: 32px;
          }
          .receipt-card {
            background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 30px 28px;
            margin: 32px 0;
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
            align-items: flex-start;
            padding: 14px 0;
            border-bottom: 1px solid #f3f4f6;
            gap: 16px;
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
            flex-shrink: 0;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 600;
            font-size: 15px;
            text-align: right;
            min-width: 0;
          }
          .detail-row:last-of-type .detail-value {
            font-size: 24px;
            color: #0B1220;
            font-weight: 700;
          }
          .transaction-id {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #4b5563;
            word-break: break-all;
            overflow-wrap: break-word;
            max-width: 100%;
          }
          .info-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #22c55e;
            border-radius: 8px;
            padding: 24px 26px;
            margin: 32px 0;
          }
          .info-box-title {
            color: #166534;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .info-box-list {
            color: #166534;
            margin: 0;
            padding-left: 22px;
            line-height: 1.9;
          }
          .info-box-list li { margin-bottom: 8px; }
          .cta-container {
            text-align: center;
            margin: 40px 0 32px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #06B6D4 0%, #0891b2 100%);
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(6, 182, 212, 0.25);
          }
          .manage-box {
            margin-top: 32px;
            padding: 24px;
            background: #f0fdfa;
            border-radius: 8px;
            border-left: 4px solid #06B6D4;
          }
          .manage-box-title {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 12px;
            font-size: 15px;
          }
          .manage-box a { color: #0891b2; text-decoration: none; }
          .manage-box a:hover { text-decoration: underline; }
          .manage-box p { margin: 0 0 8px 0; font-size: 14px; color: #334155; line-height: 1.6; }
          .manage-box p:last-child { margin-bottom: 0; }
          .footer {
            background-color: #f9fafb;
            padding: 30px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
          }
          .footer-link { color: #0B1220; text-decoration: none; font-weight: 500; }
          @media only screen and (max-width: 600px) {
            body { padding: 20px 10px; }
            .header { padding: 30px 20px 24px; }
            .content { padding: 30px 20px; }
            .receipt-card { padding: 24px 20px; }
            .detail-row { flex-direction: column; align-items: flex-start; gap: 6px; }
            .detail-value { text-align: left; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="brand-bar" role="presentation"></div>
          <div class="header">
            <div class="logo-container">
              <img src="${EMAIL_LOGO_URL}" alt="A11ytest.ai" class="logo-img" width="180" style="max-width:180px;height:auto;display:block;margin:0 auto;" />
            </div>
            <div class="header-title" style="margin-top: 20px;">Payment Receipt</div>
            <div class="header-subtitle">Thank you for your purchase</div>
          </div>

          <div class="content">
            <div class="greeting">
              ${receiptData.customerName ? `Hello ${receiptData.customerName},` : 'Hello,'}
            </div>
            <p class="intro-text">
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
              <div class="info-box-title">✅ What's next?</div>
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
              <a href="${baseUrl}/dashboard" class="cta-button">Go to Dashboard</a>
            </div>

            <div class="manage-box">
              <p class="manage-box-title">Manage your account</p>
              <p><a href="${getManageBillingUrl(customerEmail)}">Manage subscription &amp; billing (Stripe)</a> – update payment method, view invoices, cancel</p>
              <p><a href="${getProfileUrl()}">Update profile</a></p>
            </div>
          </div>

          <div class="footer">
            ${getEmailManageLinksFooterHtml(customerEmail)}
            <p class="footer-text" style="margin-top: 12px; margin-bottom: 0;">
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

      Dashboard: ${baseUrl}/dashboard

      Manage your account:
      - Manage subscription & billing (Stripe): ${getManageBillingUrl(customerEmail)}
      - Update profile: ${getProfileUrl()}

      ${getEmailManageLinksFooterText(customerEmail)}

      This is an automated receipt. Please keep this email for your records.
    `

    // Use verified domain email address (a11ytest.ai is verified in Resend)
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'A11ytest.ai <hello@a11ytest.ai>'
    
    const result = await resend.emails.send({
      from: fromEmail,
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    // Log full response for debugging
    
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

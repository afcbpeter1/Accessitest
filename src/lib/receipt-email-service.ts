import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development')

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
    console.log('📧 Attempting to send receipt email to:', receiptData.customerEmail)
    
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping receipt email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, amount, type, transactionId, date, billingPeriod, creditAmount } = receiptData

    const subject = `Receipt for ${planName} - AccessiTest`
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - AccessiTest</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0B1220;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0B1220;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .subtitle {
            color: #6b7280;
            font-size: 16px;
          }
          .receipt-details {
            background-color: #f9fafb;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
            font-weight: 600;
            font-size: 18px;
            color: #0B1220;
          }
          .detail-label {
            color: #6b7280;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 500;
          }
          .next-steps {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
          .next-steps h3 {
            color: #1e40af;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
          }
          .next-steps li {
            margin-bottom: 8px;
            color: #1e40af;
          }
          .cta-button {
            display: inline-block;
            background-color: #0B1220;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .cta-button:hover {
            background-color: #1f2937;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .support-link {
            color: #0B1220;
            text-decoration: none;
          }
          .support-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AccessiTest</div>
            <div class="title">Payment Receipt</div>
            <div class="subtitle">Thank you for your purchase!</div>
          </div>

          <div class="receipt-details">
            <div class="detail-row">
              <span class="detail-label">Plan:</span>
              <span class="detail-value">${planName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">${type === 'subscription' ? 'Subscription' : 'Credit Package'}</span>
            </div>
            ${billingPeriod ? `
            <div class="detail-row">
              <span class="detail-label">Billing Period:</span>
              <span class="detail-value">${billingPeriod}</span>
            </div>
            ` : ''}
            ${creditAmount ? `
            <div class="detail-row">
              <span class="detail-label">Credits Added:</span>
              <span class="detail-value">${creditAmount} scans</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span class="detail-value">${transactionId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${date}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Amount:</span>
              <span class="detail-value">${amount}</span>
            </div>
          </div>

          <div class="next-steps">
            <h3>What's Next?</h3>
            <ul>
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

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
              Go to Dashboard
            </a>
          </div>

          <div class="footer">
            <p>Need help? <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings" class="support-link">Contact Support</a></p>
            <p>This is an automated receipt. Please keep this email for your records.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      AccessiTest - Payment Receipt

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
      from: 'AccessiTest <onboarding@resend.dev>',
      to: [customerEmail],
      subject,
      html: htmlContent,
      text: textContent,
    })

    console.log('✅ Receipt email sent successfully:', result.data?.id)
    return { success: true, messageId: result.data?.id }

  } catch (error) {
    console.error('❌ Failed to send receipt email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

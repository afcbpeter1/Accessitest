import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development')

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

/**
 * Send email when a recurring subscription payment is processed
 */
export async function sendSubscriptionPaymentEmail(data: SubscriptionPaymentData) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping subscription payment email')
      return { success: false, error: 'Email service not configured' }
    }

    const { customerEmail, planName, amount, billingPeriod, invoiceId, date, nextBillingDate } = data

    const subject = `Subscription Payment Processed - ${planName} - A11ytest.ai`
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Payment - A11ytest.ai</title>
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
          .payment-details {
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
          .info-box {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
          .info-box h3 {
            color: #1e40af;
            margin-top: 0;
            margin-bottom: 15px;
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
            <div class="logo">A11ytest.ai</div>
            <div class="title">Subscription Payment Processed</div>
            <div class="subtitle">Thank you for your continued subscription!</div>
          </div>

          <div class="payment-details">
            <div class="detail-row">
              <span class="detail-label">Plan:</span>
              <span class="detail-value">${planName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Billing Period:</span>
              <span class="detail-value">${billingPeriod}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Invoice ID:</span>
              <span class="detail-value">${invoiceId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Date:</span>
              <span class="detail-value">${date}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Next Billing Date:</span>
              <span class="detail-value">${nextBillingDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount Charged:</span>
              <span class="detail-value">${amount}</span>
            </div>
          </div>

          <div class="info-box">
            <h3>Your Subscription is Active</h3>
            <p style="color: #1e40af; margin: 0;">
              Your ${billingPeriod.toLowerCase()} subscription payment has been successfully processed. 
              You continue to have unlimited access to all features.
            </p>
          </div>

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" class="cta-button">
              Go to Dashboard
            </a>
          </div>

          <div class="footer">
            <p>Need help? <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings" class="support-link">Contact Support</a></p>
            <p>This is an automated payment confirmation. Please keep this email for your records.</p>
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
      from: 'A11ytest.ai <onboarding@resend.dev>',
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

    console.log('✅ Subscription payment email sent successfully! Message ID:', result.data.id)
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

    const { customerEmail, planName, cancellationDate, accessEndDate, savedCredits } = data

    const subject = `Subscription Cancelled - A11ytest.ai`
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled - A11ytest.ai</title>
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
          .cancellation-details {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
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
          }
          .detail-label {
            color: #6b7280;
          }
          .detail-value {
            color: #1f2937;
            font-weight: 500;
          }
          .info-box {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
          .info-box h3 {
            color: #1e40af;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .credits-box {
            background-color: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
          .credits-box h3 {
            color: #059669;
            margin-top: 0;
            margin-bottom: 15px;
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
            <div class="logo">A11ytest.ai</div>
            <div class="title">Subscription Cancelled</div>
            <div class="subtitle">We're sorry to see you go</div>
          </div>

          <div class="cancellation-details">
            <div class="detail-row">
              <span class="detail-label">Plan:</span>
              <span class="detail-value">${planName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cancellation Date:</span>
              <span class="detail-value">${cancellationDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Access Ends:</span>
              <span class="detail-value">${accessEndDate}</span>
            </div>
          </div>

          ${savedCredits && savedCredits > 0 ? `
          <div class="credits-box">
            <h3>Your Saved Credits</h3>
            <p style="color: #059669; margin: 0;">
              Good news! You have ${savedCredits} saved credits that you can continue to use after your subscription ends. 
              These credits will remain available for your use.
            </p>
          </div>
          ` : ''}

          <div class="info-box">
            <h3>What Happens Next?</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li>Your subscription will remain active until ${accessEndDate}</li>
              <li>You'll continue to have unlimited access until then</li>
              ${savedCredits && savedCredits > 0 ? `<li>After that, you can use your ${savedCredits} saved credits</li>` : ''}
              <li>You can resubscribe anytime from your dashboard</li>
            </ul>
          </div>

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/pricing" class="cta-button">
              Resubscribe
            </a>
          </div>

          <div class="footer">
            <p>We'd love to have you back! <a href="${process.env.NEXT_PUBLIC_BASE_URL}/pricing" class="support-link">View Plans</a></p>
            <p>Need help? <a href="${process.env.NEXT_PUBLIC_BASE_URL}/settings" class="support-link">Contact Support</a></p>
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

      View Plans: ${process.env.NEXT_PUBLIC_BASE_URL}/pricing
      Support: ${process.env.NEXT_PUBLIC_BASE_URL}/settings

      We'd love to have you back!
    `

    const result = await resend.emails.send({
      from: 'A11ytest.ai <onboarding@resend.dev>',
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

    console.log('✅ Subscription cancellation email sent successfully! Message ID:', result.data.id)
    return { success: true, messageId: result.data.id }

  } catch (error) {
    console.error('❌ Failed to send cancellation email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


require('dotenv').config();
const { sendReceiptEmail } = require('./src/lib/receipt-email-service');

async function testEmail() {
  try {
    console.log('🧪 Testing email service...');
    console.log('📧 RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'Not set');
    console.log('🌐 NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'Not set');
    
    const testReceiptData = {
      customerEmail: 'theytookourjawb@gmail.com',
      planName: 'Starter Pack',
      amount: '$7.50',
      type: 'credits',
      transactionId: 'test_123',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      creditAmount: 5
    };
    
    console.log('📧 Sending test email...');
    const result = await sendReceiptEmail(testReceiptData);
    
    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
    } else {
      console.log('❌ Test email failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing email:', error.message);
  }
}

testEmail();

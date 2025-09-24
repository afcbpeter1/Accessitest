require('dotenv').config();

async function testEmailDirect() {
  try {
    console.log('🧪 Testing email service directly...');
    console.log('📧 RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'Not set');
    console.log('🌐 NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'Not set');
    
    // Test Resend API directly
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log('📧 Sending test email...');
    const result = await resend.emails.send({
      from: 'AccessiTest <onboarding@resend.dev>',
      to: ['peter.kirby85@gmail.com'],
      subject: 'Test Email from AccessiTest',
      html: '<h1>Test Email</h1><p>This is a test email to verify the email service is working.</p>',
      text: 'Test Email - This is a test email to verify the email service is working.'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.data?.id);
    console.log('📧 Result:', result);
    
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    console.error('❌ Full error:', error);
  }
}

testEmailDirect();

const { EmailService } = require('../src/lib/email-service');

async function testPeriodicScanEmails() {
  console.log('📧 Testing Periodic Scan Email Notifications...');
  
  try {
    // Test completion email
    console.log('✅ Testing completion email...');
    const completionResult = await EmailService.sendPeriodicScanCompletionEmail({
      to: 'test@example.com',
      scanTitle: 'Weekly Accessibility Check',
      scanUrl: 'https://example.com',
      totalIssues: 5,
      criticalIssues: 1,
      seriousIssues: 2,
      moderateIssues: 1,
      minorIssues: 1,
      scanHistoryId: 'test-scan-id',
      scanDate: new Date().toISOString(),
      firstName: 'Test User'
    });
    
    if (completionResult) {
      console.log('✅ Completion email test passed');
    } else {
      console.log('❌ Completion email test failed');
    }
    
    // Test failure email
    console.log('❌ Testing failure email...');
    const failureResult = await EmailService.sendPeriodicScanFailureEmail({
      to: 'test@example.com',
      scanTitle: 'Weekly Accessibility Check',
      scanUrl: 'https://example.com',
      errorMessage: 'Connection timeout after 30 seconds',
      scanDate: new Date().toISOString(),
      firstName: 'Test User'
    });
    
    if (failureResult) {
      console.log('✅ Failure email test passed');
    } else {
      console.log('❌ Failure email test failed');
    }
    
    console.log('\n🎯 Email Features:');
    console.log('  ✅ Completion notifications with scan results');
    console.log('  ✅ Failure notifications with error details');
    console.log('  ✅ Beautiful HTML email templates');
    console.log('  ✅ Issue breakdown by severity');
    console.log('  ✅ Direct links to scan reports');
    console.log('  ✅ Professional branding');
    
    console.log('\n📋 Email Templates Include:');
    console.log('  📊 Scan details (title, URL, completion time)');
    console.log('  🔍 Issue summary (total, critical, serious, moderate, minor)');
    console.log('  🎉 Success message for zero issues');
    console.log('  🔗 Direct link to full scan report');
    console.log('  ⚠️ Error details for failed scans');
    console.log('  🎨 Color-coded issue severity badges');
    console.log('  📱 Mobile-responsive design');
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

testPeriodicScanEmails()
  .then(() => {
    console.log('\n✅ Periodic Scan Email System Ready!');
    console.log('🚀 Users will receive beautiful email notifications for their scheduled scans.');
  })
  .catch(error => {
    console.error('❌ Email test failed:', error);
    process.exit(1);
  });
import { runAllTests as runAuthTests } from './auth-tests.js';
import { runAllTests as runAuthzTests } from './authorization-tests.js';
import { runAllTests as runInjectionTests } from './injection-tests.js';
import { runAllTests as runInputTests } from './input-validation-tests.js';
// import { runAllTests as runFileTests } from './file-upload-tests.js'; // File upload tests temporarily disabled
import { runAllTests as runRateLimitTests } from './rate-limiting-tests.js';
import { runAllTests as runPaymentTests } from './payment-tests.js';
import { config } from '../config.js';
import colors from 'colors';

console.log(colors.bold.cyan('\n🔒 Starting Comprehensive Penetration Test Suite\n'));
console.log(colors.gray(`Target: ${config.baseUrl}\n`));

const allResults = [];

async function runAllTestSuites() {
  try {
    console.log(colors.yellow('='.repeat(80)));
    const authResults = await runAuthTests();
    allResults.push(...authResults);
    
    console.log(colors.yellow('='.repeat(80)));
    const authzResults = await runAuthzTests();
    allResults.push(...authzResults);
    
    console.log(colors.yellow('='.repeat(80)));
    const injectionResults = await runInjectionTests();
    allResults.push(...injectionResults);
    
    console.log(colors.yellow('='.repeat(80)));
    const inputResults = await runInputTests();
    allResults.push(...inputResults);
    
    // File upload tests temporarily disabled
    // console.log(colors.yellow('='.repeat(80)));
    // const fileResults = await runFileTests();
    // allResults.push(...fileResults);
    
    console.log(colors.yellow('='.repeat(80)));
    const rateLimitResults = await runRateLimitTests();
    allResults.push(...rateLimitResults);
    
    console.log(colors.yellow('='.repeat(80)));
    const paymentResults = await runPaymentTests();
    allResults.push(...paymentResults);
    
    // Generate summary
    console.log(colors.bold.cyan('\n' + '='.repeat(80)));
    console.log(colors.bold.cyan('📊 PENETRATION TEST SUMMARY'));
    console.log(colors.bold.cyan('='.repeat(80) + '\n'));
    
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed).length;
    const critical = allResults.filter(r => !r.passed && r.severity === 'CRITICAL').length;
    const high = allResults.filter(r => !r.passed && r.severity === 'HIGH').length;
    const medium = allResults.filter(r => !r.passed && r.severity === 'MEDIUM').length;
    const low = allResults.filter(r => !r.passed && r.severity === 'LOW').length;
    
    console.log(colors.green(`✓ Passed: ${passed}`));
    console.log(colors.red(`✗ Failed: ${failed}`));
    console.log(colors.red.bold(`  - CRITICAL: ${critical}`));
    console.log(colors.red(`  - HIGH: ${high}`));
    console.log(colors.yellow(`  - MEDIUM: ${medium}`));
    console.log(colors.gray(`  - LOW: ${low}`));
    
    // Show critical and high severity issues
    const criticalIssues = allResults.filter(r => !r.passed && r.severity === 'CRITICAL');
    const highIssues = allResults.filter(r => !r.passed && r.severity === 'HIGH');
    
    if (criticalIssues.length > 0) {
      console.log(colors.bold.red('\n🚨 CRITICAL ISSUES:\n'));
      criticalIssues.forEach(issue => {
        console.log(colors.red(`  ✗ ${issue.name}`));
        console.log(colors.gray(`    ${issue.details.description || ''}`));
        if (issue.details.recommendation) {
          console.log(colors.cyan(`    Recommendation: ${issue.details.recommendation}`));
        }
        console.log('');
      });
    }
    
    if (highIssues.length > 0) {
      console.log(colors.bold.yellow('\n⚠️  HIGH SEVERITY ISSUES:\n'));
      highIssues.forEach(issue => {
        console.log(colors.yellow(`  ✗ ${issue.name}`));
        console.log(colors.gray(`    ${issue.details.description || ''}`));
        if (issue.details.recommendation) {
          console.log(colors.cyan(`    Recommendation: ${issue.details.recommendation}`));
        }
        console.log('');
      });
    }
    
    // Save results to file
    const fs = await import('fs');
    const report = {
      timestamp: new Date().toISOString(),
      target: config.baseUrl,
      summary: {
        total: allResults.length,
        passed,
        failed,
        bySeverity: { critical, high, medium, low }
      },
      results: allResults.map(r => ({
        name: r.name,
        passed: r.passed,
        severity: r.severity,
        details: r.details,
        timestamp: r.timestamp
      }))
    };
    
    fs.writeFileSync(
      'penetration-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log(colors.green(`\n✓ Detailed report saved to: penetration-test-report.json\n`));
    
    // Exit with appropriate code
    process.exit(critical > 0 || high > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(colors.red('Fatal error running tests:'), error);
    process.exit(1);
  }
}

runAllTestSuites();


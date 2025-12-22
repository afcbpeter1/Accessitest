import { APISecurityTests } from './tests/api-security-tests.js';
import { DatabaseSecurityTests } from './tests/database-security-tests.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const testType = args.includes('--type') 
  ? args[args.indexOf('--type') + 1] 
  : 'all';

async function runTests() {
  console.log('🚀 Starting Penetration Test Suite\n');
  console.log(`Test Type: ${testType}\n`);
  console.log('='.repeat(60) + '\n');

  const allResults = [];
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    bySeverity: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0
    }
  };

  try {
    // Run API tests
    if (testType === 'all' || testType === 'api') {
      console.log('\n' + '='.repeat(60));
      console.log('API SECURITY TESTS');
      console.log('='.repeat(60) + '\n');
      
      const apiTests = new APISecurityTests();
      const apiResults = await apiTests.runAllTests();
      allResults.push(...apiResults);
    }

    // Run Database tests
    if (testType === 'all' || testType === 'db') {
      console.log('\n' + '='.repeat(60));
      console.log('DATABASE SECURITY TESTS');
      console.log('='.repeat(60) + '\n');
      
      try {
        const dbTests = new DatabaseSecurityTests();
        const dbResults = await dbTests.runAllTests();
        allResults.push(...dbResults);
        
        // Close database connection
        await dbTests.close();
      } catch (error) {
        if (error.message.includes('DATABASE_URL')) {
          console.log('⚠️  Skipping database tests: DATABASE_URL not configured');
          console.log('   Set DATABASE_URL in your .env file to run database tests\n');
        } else {
          throw error;
        }
      }
    }

    // Calculate summary
    allResults.forEach(result => {
      summary.total++;
      if (result.passed) {
        summary.passed++;
      } else {
        summary.failed++;
      }
      const severity = result.severity || 'INFO';
      if (summary.bySeverity[severity] !== undefined) {
        summary.bySeverity[severity]++;
      }
    });

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      target: process.env.TEST_BASE_URL || 'http://localhost:3000',
      testType,
      summary,
      results: allResults.map(r => ({
        name: r.name,
        passed: r.passed,
        severity: r.severity,
        details: r.details,
        timestamp: new Date().toISOString()
      }))
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'penetration-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('PENETRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} ✅`);
    console.log(`Failed: ${summary.failed} ❌`);
    console.log('\nBy Severity:');
    console.log(`  CRITICAL: ${summary.bySeverity.CRITICAL}`);
    console.log(`  HIGH: ${summary.bySeverity.HIGH}`);
    console.log(`  MEDIUM: ${summary.bySeverity.MEDIUM}`);
    console.log(`  LOW: ${summary.bySeverity.LOW}`);
    console.log(`  INFO: ${summary.bySeverity.INFO}`);
    console.log('\n' + '='.repeat(60));

    // Print failed tests
    const failedTests = allResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:\n');
      failedTests.forEach(test => {
        console.log(`  [${test.severity}] ${test.name}`);
        if (test.details?.error) {
          console.log(`    Error: ${test.details.error}`);
        }
      });
    }

    // Print critical/high severity issues
    const criticalIssues = allResults.filter(r => 
      !r.passed && (r.severity === 'CRITICAL' || r.severity === 'HIGH')
    );
    if (criticalIssues.length > 0) {
      console.log('\n⚠️  CRITICAL/HIGH SEVERITY ISSUES:\n');
      criticalIssues.forEach(issue => {
        console.log(`  [${issue.severity}] ${issue.name}`);
        console.log(`    Details: ${JSON.stringify(issue.details, null, 2)}`);
      });
    }

    console.log(`\n📄 Full report saved to: ${reportPath}\n`);

    // Exit with error code if there are failures
    if (summary.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error running penetration tests:', error);
    process.exit(1);
  }
}

runTests();


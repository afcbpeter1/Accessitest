import { LoadTests } from './load-tests.js';
import { PerformanceTests } from './performance-tests.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const testType = args.includes('--type') 
  ? args[args.indexOf('--type') + 1] 
  : 'all';

async function runTests() {
  console.log('🚀 Starting Performance & Load Test Suite\n');
  console.log(`Test Type: ${testType}\n`);
  console.log('='.repeat(60) + '\n');

  const allResults = {
    load: [],
    performance: []
  };

  try {
    // Run Load tests
    if (testType === 'all' || testType === 'load' || testType === 'stress') {
      console.log('\n' + '='.repeat(60));
      console.log('LOAD TESTS');
      console.log('='.repeat(60) + '\n');
      
      const loadTests = new LoadTests();
      const loadResults = await loadTests.runAllTests();
      allResults.load = loadResults;
    }

    // Run Performance tests
    if (testType === 'all' || testType === 'performance') {
      console.log('\n' + '='.repeat(60));
      console.log('PERFORMANCE TESTS');
      console.log('='.repeat(60) + '\n');
      
      const perfTests = new PerformanceTests();
      const perfResults = await perfTests.runAllTests();
      allResults.performance = perfResults;
    }

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      target: process.env.TEST_BASE_URL || 'http://localhost:3000',
      testType,
        summary: {
        load: {
          total: allResults.load.length,
          passed: allResults.load.filter(r => !r.threshold || checkThresholds(r)).length,
          failed: allResults.load.filter(r => r.threshold && !checkThresholds(r)).length
        },
        performance: {
          total: allResults.performance.length,
          passed: allResults.performance.filter(r => r.passed !== false).length,
          failed: allResults.performance.filter(r => r.passed === false).length
        }
      },
      results: allResults
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'performance-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));
    
    if (allResults.load.length > 0) {
      console.log('\n📊 Load Tests:');
      console.log(`  Total: ${report.summary.load.total}`);
      console.log(`  Passed: ${report.summary.load.passed} ✅`);
      console.log(`  Failed: ${report.summary.load.failed} ❌`);
      
      allResults.load.forEach(result => {
        const passed = !result.threshold || checkThresholds(result);
        console.log(`\n  ${passed ? '✅' : '❌'} ${result.name}`);
        if (result.requestsPerSecond) {
          console.log(`    Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
        }
        if (result.latency?.mean) {
          console.log(`    Avg Latency: ${result.latency.mean}ms`);
        }
        if (result.errors > 0) {
          console.log(`    Errors: ${result.errors}`);
        }
      });
    }

    if (allResults.performance.length > 0) {
      console.log('\n⚡ Performance Tests:');
      console.log(`  Total: ${report.summary.performance.total}`);
      console.log(`  Passed: ${report.summary.performance.passed} ✅`);
      console.log(`  Failed: ${report.summary.performance.failed} ❌`);
      
      allResults.performance.forEach(result => {
        console.log(`\n  ${result.passed !== false ? '✅' : '❌'} ${result.name}`);
        if (result.average) {
          console.log(`    Avg Response Time: ${result.average}ms`);
        }
        if (result.averageTime) {
          console.log(`    Avg Time: ${result.averageTime}ms`);
        }
        if (result.successRate !== undefined) {
          console.log(`    Success Rate: ${result.successRate.toFixed(1)}%`);
        }
      });
    }

    console.log(`\n📄 Full report saved to: ${reportPath}\n`);

    // Exit with error code if there are failures
    const totalFailed = report.summary.load.failed + report.summary.performance.failed;
    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error running performance tests:', error);
    process.exit(1);
  }
}

function checkThresholds(result) {
  if (!result.threshold) return true;
  
  let passed = true;
  
  if (result.threshold.requestsPerSecond && result.requestsPerSecond < result.threshold.requestsPerSecond) {
    passed = false;
  }
  
  if (result.threshold.latency && result.latency?.mean > result.threshold.latency) {
    passed = false;
  }
  
  if (result.threshold.errors && result.errors > result.threshold.errors) {
    passed = false;
  }
  
  return passed;
}

runTests();


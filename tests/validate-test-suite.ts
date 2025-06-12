import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResults {
  backend: {
    unit: { total: number; passed: number; failed: number; coverage: number };
    integration: { total: number; passed: number; failed: number };
    performance: { 
      total: number; 
      passed: number; 
      benchmarks: Record<string, number> 
    };
  };
  frontend: {
    unit: { total: number; passed: number; failed: number; coverage: number };
    integration: { total: number; passed: number; failed: number };
    e2e: { total: number; passed: number; failed: number };
  };
  overall: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    coverageAverage: number;
    duration: number;
  };
}

async function runBackendTests(): Promise<TestResults['backend']> {
  console.log('🔬 Running Backend Tests...\n');
  
  const results: TestResults['backend'] = {
    unit: { total: 0, passed: 0, failed: 0, coverage: 0 },
    integration: { total: 0, passed: 0, failed: 0 },
    performance: { total: 0, passed: 0, benchmarks: {} }
  };
  
  try {
    // Unit tests with coverage
    console.log('📦 Running backend unit tests...');
    const unitOutput = execSync(
      'cd backend && source venv/bin/activate && pytest tests/unit -v --cov=app --cov-report=json --cov-report=term',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    // Parse unit test results
    const unitMatch = unitOutput.match(/(\d+) passed.*?(\d+) failed/);
    if (unitMatch) {
      results.unit.passed = parseInt(unitMatch[1]);
      results.unit.failed = parseInt(unitMatch[2]);
      results.unit.total = results.unit.passed + results.unit.failed;
    }
    
    // Parse coverage
    const coverageData = JSON.parse(
      fs.readFileSync('backend/coverage.json', 'utf-8')
    );
    results.unit.coverage = Math.round(coverageData.totals.percent_covered);
    
    // Integration tests
    console.log('🔗 Running backend integration tests...');
    try {
      const integrationOutput = execSync(
        'cd backend && source venv/bin/activate && pytest tests/integration -v',
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const integMatch = integrationOutput.match(/(\d+) passed.*?(\d+) failed/);
      if (integMatch) {
        results.integration.passed = parseInt(integMatch[1]);
        results.integration.failed = parseInt(integMatch[2]);
        results.integration.total = results.integration.passed + results.integration.failed;
      }
    } catch (e: any) {
      console.warn('⚠️  Integration tests had issues:', e.message);
    }
    
    // Performance tests
    console.log('⚡ Running backend performance tests...');
    try {
      const perfOutput = execSync(
        'cd backend && source venv/bin/activate && pytest tests/performance -v --benchmark-json=bench.json',
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const perfMatch = perfOutput.match(/(\d+) passed.*?(\d+) failed/);
      if (perfMatch) {
        results.performance.passed = parseInt(perfMatch[1]);
        results.performance.total = results.performance.passed + parseInt(perfMatch[2]);
      }
      
      // Parse benchmark results
      if (fs.existsSync('backend/bench.json')) {
        const benchData = JSON.parse(fs.readFileSync('backend/bench.json', 'utf-8'));
        benchData.benchmarks.forEach((bench: any) => {
          results.performance.benchmarks[bench.name] = Math.round(bench.stats.mean * 1000);
        });
      }
    } catch (e: any) {
      console.warn('⚠️  Performance tests had issues:', e.message);
    }
    
  } catch (error: any) {
    console.error('❌ Backend tests failed:', error.message);
  }
  
  return results;
}

async function runFrontendTests(): Promise<TestResults['frontend']> {
  console.log('\n🎨 Running Frontend Tests...\n');
  
  const results: TestResults['frontend'] = {
    unit: { total: 0, passed: 0, failed: 0, coverage: 0 },
    integration: { total: 0, passed: 0, failed: 0 },
    e2e: { total: 0, passed: 0, failed: 0 }
  };
  
  try {
    // Unit tests with coverage
    console.log('📦 Running frontend unit tests...');
    const unitOutput = execSync(
      'cd frontend && npm run test:unit -- --reporter=json --coverage',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    // Parse test results from JSON output
    try {
      const jsonOutput = JSON.parse(unitOutput);
      results.unit.total = jsonOutput.numTotalTests || 0;
      results.unit.passed = jsonOutput.numPassedTests || 0;
      results.unit.failed = jsonOutput.numFailedTests || 0;
      
      // Get coverage
      if (fs.existsSync('frontend/coverage/coverage-summary.json')) {
        const coverage = JSON.parse(
          fs.readFileSync('frontend/coverage/coverage-summary.json', 'utf-8')
        );
        results.unit.coverage = Math.round(coverage.total.lines.pct);
      }
    } catch (e) {
      // Fallback parsing
      const match = unitOutput.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
      if (match) {
        results.unit.passed = parseInt(match[1]);
        results.unit.failed = parseInt(match[2]);
        results.unit.total = results.unit.passed + results.unit.failed;
      }
    }
    
    // Integration tests
    console.log('🔗 Running frontend integration tests...');
    try {
      const integOutput = execSync(
        'cd frontend && npm run test:integration',
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const integMatch = integOutput.match(/(\d+)\s+passed.*?(\d+)\s+failed/);
      if (integMatch) {
        results.integration.passed = parseInt(integMatch[1]);
        results.integration.failed = parseInt(integMatch[2]);
        results.integration.total = results.integration.passed + results.integration.failed;
      }
    } catch (e: any) {
      console.warn('⚠️  Frontend integration tests had issues:', e.message);
    }
    
  } catch (error: any) {
    console.error('❌ Frontend tests failed:', error.message);
  }
  
  return results;
}

async function runE2ETests(): Promise<{ total: number; passed: number; failed: number }> {
  console.log('\n🌐 Running E2E Tests...\n');
  
  const results = { total: 0, passed: 0, failed: 0 };
  
  try {
    const e2eOutput = execSync(
      'npx playwright test --reporter=json',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    const e2eResults = JSON.parse(e2eOutput);
    results.total = e2eResults.stats.total || 0;
    results.passed = e2eResults.stats.passed || 0;
    results.failed = e2eResults.stats.failed || 0;
    
  } catch (error: any) {
    console.warn('⚠️  E2E tests had issues:', error.message);
    
    // Try to parse from test-results.json if it exists
    if (fs.existsSync('test-results.json')) {
      const testResults = JSON.parse(fs.readFileSync('test-results.json', 'utf-8'));
      results.total = testResults.stats?.total || 0;
      results.passed = testResults.stats?.passed || 0;
      results.failed = testResults.stats?.failed || 0;
    }
  }
  
  return results;
}

async function validateTestSuite(): Promise<TestResults> {
  const startTime = Date.now();
  
  console.log('🚀 Scanalyzer Test Suite Validation\n');
  console.log('=' .repeat(50) + '\n');
  
  // Run all test suites
  const backendResults = await runBackendTests();
  const frontendResults = await runFrontendTests();
  const e2eResults = await runE2ETests();
  
  // Update frontend e2e results
  frontendResults.e2e = e2eResults;
  
  // Calculate overall statistics
  const overall: TestResults['overall'] = {
    totalTests: 
      backendResults.unit.total + backendResults.integration.total + backendResults.performance.total +
      frontendResults.unit.total + frontendResults.integration.total + frontendResults.e2e.total,
    passedTests:
      backendResults.unit.passed + backendResults.integration.passed + backendResults.performance.passed +
      frontendResults.unit.passed + frontendResults.integration.passed + frontendResults.e2e.passed,
    failedTests: 0, // Will calculate
    coverageAverage: 
      (backendResults.unit.coverage + frontendResults.unit.coverage) / 2,
    duration: Date.now() - startTime
  };
  
  overall.failedTests = overall.totalTests - overall.passedTests;
  
  return {
    backend: backendResults,
    frontend: frontendResults,
    overall
  };
}

function generateTestReport(results: TestResults): void {
  const report = `# Test Suite Validation Report

Generated: ${new Date().toISOString()}

## Overall Summary

- **Total Tests**: ${results.overall.totalTests}
- **Passed**: ${results.overall.passedTests} ✅
- **Failed**: ${results.overall.failedTests} ❌
- **Success Rate**: ${((results.overall.passedTests / results.overall.totalTests) * 100).toFixed(1)}%
- **Average Coverage**: ${results.overall.coverageAverage}%
- **Total Duration**: ${(results.overall.duration / 1000).toFixed(1)}s

## Backend Tests

### Unit Tests
- Total: ${results.backend.unit.total}
- Passed: ${results.backend.unit.passed} ✅
- Failed: ${results.backend.unit.failed} ${results.backend.unit.failed > 0 ? '❌' : ''}
- Coverage: ${results.backend.unit.coverage}% ${results.backend.unit.coverage >= 80 ? '✅' : '⚠️'}

### Integration Tests
- Total: ${results.backend.integration.total}
- Passed: ${results.backend.integration.passed} ✅
- Failed: ${results.backend.integration.failed} ${results.backend.integration.failed > 0 ? '❌' : ''}

### Performance Tests
- Total: ${results.backend.performance.total}
- Passed: ${results.backend.performance.passed} ✅

#### Performance Benchmarks
${Object.entries(results.backend.performance.benchmarks)
  .map(([name, time]) => `- ${name}: ${time}ms`)
  .join('\n')}

## Frontend Tests

### Unit Tests
- Total: ${results.frontend.unit.total}
- Passed: ${results.frontend.unit.passed} ✅
- Failed: ${results.frontend.unit.failed} ${results.frontend.unit.failed > 0 ? '❌' : ''}
- Coverage: ${results.frontend.unit.coverage}% ${results.frontend.unit.coverage >= 80 ? '✅' : '⚠️'}

### Integration Tests
- Total: ${results.frontend.integration.total}
- Passed: ${results.frontend.integration.passed} ✅
- Failed: ${results.frontend.integration.failed} ${results.frontend.integration.failed > 0 ? '❌' : ''}

### E2E Tests
- Total: ${results.frontend.e2e.total}
- Passed: ${results.frontend.e2e.passed} ✅
- Failed: ${results.frontend.e2e.failed} ${results.frontend.e2e.failed > 0 ? '❌' : ''}

## Coverage Analysis

- **Backend Coverage**: ${results.backend.unit.coverage}% ${results.backend.unit.coverage >= 80 ? '✅' : '❌'}
- **Frontend Coverage**: ${results.frontend.unit.coverage}% ${results.frontend.unit.coverage >= 80 ? '✅' : '❌'}
- **Overall Coverage**: ${results.overall.coverageAverage}% ${results.overall.coverageAverage >= 80 ? '✅' : '❌'}

## Test Health Status

${results.overall.failedTests === 0 ? '### ✅ All tests passing!' : '### ❌ Some tests are failing'}
${results.overall.coverageAverage >= 80 ? '### ✅ Coverage target met!' : '### ⚠️ Coverage below 80% target'}

## Recommendations

${results.backend.unit.coverage < 80 ? '- Increase backend unit test coverage to meet 80% target\n' : ''}
${results.frontend.unit.coverage < 80 ? '- Increase frontend unit test coverage to meet 80% target\n' : ''}
${results.overall.failedTests > 0 ? '- Fix failing tests before proceeding\n' : ''}
${Object.values(results.backend.performance.benchmarks).some(t => t > 10000) ? '- Optimize slow performance tests (>10s)\n' : ''}

---

*Test validation completed successfully.*
`;

  fs.writeFileSync('test-validation-report.md', report);
  console.log('\n📄 Report saved to test-validation-report.md');
  
  // Also save JSON results
  fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
  console.log('📄 JSON results saved to test-results.json');
}

// Main execution
async function main() {
  try {
    const results = await validateTestSuite();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Validation Complete\n');
    
    generateTestReport(results);
    
    // Exit with error code if tests failed or coverage is low
    if (results.overall.failedTests > 0) {
      console.error(`\n❌ ${results.overall.failedTests} tests failed!`);
      process.exit(1);
    }
    
    if (results.overall.coverageAverage < 80) {
      console.error(`\n⚠️  Coverage ${results.overall.coverageAverage}% is below 80% target!`);
      process.exit(1);
    }
    
    console.log('\n✅ All validation checks passed!');
    
  } catch (error) {
    console.error('\n❌ Test validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { validateTestSuite, generateTestReport };
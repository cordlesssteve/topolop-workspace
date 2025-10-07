#!/usr/bin/env node

/**
 * Dependency Analyzers Integration Test
 *
 * Tests the integration of all 6 dependency security analyzers with
 * Topolop's unified analysis platform.
 */

console.log('🧪 Dependency Analyzers Integration Test\n');

async function testAnalyzerIntegration() {
  const analyzers = [
    { name: 'NPM Audit', path: './npm-audit-analyzer/src/index.js' },
    { name: 'OSV Scanner', path: './osv-analyzer/src/index.js' },
    { name: 'Packj', path: './packj-analyzer/src/index.js' },
    { name: 'Pip-Audit', path: './pip-audit-analyzer/src/index.js' },
    { name: 'Safety', path: './safety-analyzer/src/index.js' },
    { name: 'RetireJS', path: './retirejs-analyzer/src/index.js' }
  ];

  console.log('📦 Testing analyzer imports and instantiation...\n');

  let successCount = 0;
  const results = [];

  for (const analyzer of analyzers) {
    try {
      console.log(`🔍 Testing ${analyzer.name}...`);

      // Test import
      const AnalyzerClass = require(analyzer.path);
      console.log(`   ✅ Import successful`);

      // Test instantiation
      const instance = new AnalyzerClass();
      console.log(`   ✅ Instantiation successful`);

      // Test getInfo method
      const info = instance.getInfo();
      console.log(`   ✅ getInfo() returns:`, {
        name: info.name,
        displayName: info.displayName,
        analysisType: info.analysisType
      });

      results.push({
        name: analyzer.name,
        status: 'SUCCESS',
        info: info
      });

      successCount++;
      console.log(`   🎉 ${analyzer.name} integration test PASSED\n`);

    } catch (error) {
      console.error(`   ❌ ${analyzer.name} integration test FAILED:`, error.message);
      results.push({
        name: analyzer.name,
        status: 'FAILED',
        error: error.message
      });
      console.log('');
    }
  }

  console.log('📊 Integration Test Summary:');
  console.log(`   ✅ Successful: ${successCount}/${analyzers.length}`);
  console.log(`   ❌ Failed: ${analyzers.length - successCount}/${analyzers.length}`);

  if (successCount === analyzers.length) {
    console.log('\n🎉 ALL DEPENDENCY ANALYZERS INTEGRATION TESTS PASSED!');
    console.log('   Ready for integration with Topolop unified model');
  } else {
    console.log('\n⚠️  Some integration tests failed. Check errors above.');
  }

  return results;
}

// Test main analyzer registry integration
async function testMainRegistryIntegration() {
  console.log('\n🔗 Testing main analyzer registry integration...\n');

  try {
    // Test import of main analyzers index
    const Layer1DataSources = require('../index.js');
    console.log('   ✅ Main analyzer registry import successful');

    // Test instantiation with dependency analyzers enabled
    const dataSources = new Layer1DataSources({
      npmAudit: {},
      osv: {},
      packj: {},
      pipAudit: {},
      safety: {},
      retireJS: {}
    });

    console.log('   ✅ Layer1DataSources instantiation with dependency analyzers successful');

    // Check that dependency analyzers are properly initialized
    const dependencyAnalyzers = [
      'npmAuditAnalyzer',
      'osvAnalyzer',
      'packjAnalyzer',
      'pipAuditAnalyzer',
      'safetyAnalyzer',
      'retireJSAnalyzer'
    ];

    let registeredCount = 0;
    for (const analyzerName of dependencyAnalyzers) {
      if (dataSources[analyzerName]) {
        console.log(`   ✅ ${analyzerName} registered in main registry`);
        registeredCount++;
      } else {
        console.log(`   ❌ ${analyzerName} NOT registered in main registry`);
      }
    }

    console.log(`\n📊 Registry Integration: ${registeredCount}/${dependencyAnalyzers.length} analyzers registered`);

    if (registeredCount === dependencyAnalyzers.length) {
      console.log('🎉 MAIN REGISTRY INTEGRATION TEST PASSED!');
      return true;
    } else {
      console.log('⚠️  Main registry integration incomplete');
      return false;
    }

  } catch (error) {
    console.error('❌ Main registry integration test FAILED:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Dependency Analyzers Integration Tests\n');

  try {
    // Test individual analyzer integration
    const analyzerResults = await testAnalyzerIntegration();

    // Test main registry integration
    const registrySuccess = await testMainRegistryIntegration();

    console.log('\n' + '='.repeat(60));
    console.log('🏁 FINAL INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));

    const successfulAnalyzers = analyzerResults.filter(r => r.status === 'SUCCESS').length;
    console.log(`📦 Individual Analyzers: ${successfulAnalyzers}/6 PASSED`);
    console.log(`🔗 Main Registry: ${registrySuccess ? 'PASSED' : 'FAILED'}`);

    if (successfulAnalyzers === 6 && registrySuccess) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✨ Dependency analyzers are ready for Topolop unified analysis');
      console.log('🚀 Ready to proceed with cross-tool correlation and city visualization');
      process.exit(0);
    } else {
      console.log('\n⚠️  Integration tests incomplete - check errors above');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n🚨 Integration test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { testAnalyzerIntegration, testMainRegistryIntegration };
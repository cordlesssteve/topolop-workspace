#!/usr/bin/env node

/**
 * New Relic APM Analyzer CLI - Topolop Phase 2
 *
 * Command-line interface for New Relic Application Performance Monitoring integration.
 * Part of Phase 2 workflow integration expanding beyond static analysis.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 */

const { NewRelicAdapter } = require('../dist/newrelic-adapter');

// CLI configuration
const CLI_VERSION = '1.0.0';
const TOOL_NAME = 'New Relic APM Analyzer';

/**
 * Display CLI help information
 */
function showHelp() {
  console.log(`🔍 ${TOOL_NAME} CLI - Topolop Phase 2

USAGE:
  node cli.js <command> [options]

COMMANDS:
  test                    Test connection to New Relic API
  config                  Show current configuration status
  analyze <appId>         Analyze application performance
  apps                    List available applications
  metrics <appId>         Get performance metrics for application
  capabilities            Show analyzer capabilities

ENVIRONMENT VARIABLES:
  NEW_RELIC_API_KEY       New Relic API key (required)
  NEW_RELIC_ACCOUNT_ID    New Relic account ID (required)
  NEW_RELIC_APP_ID        Default application ID (optional)

EXAMPLES:
  node cli.js test
  node cli.js apps
  node cli.js analyze "12345"
  node cli.js metrics "12345"

PHASE 2 INTEGRATION:
  This analyzer integrates Application Performance Monitoring data
  into Topolop's unified analysis platform, expanding beyond static
  analysis to provide comprehensive workflow intelligence.
`);
}

/**
 * Show analyzer capabilities
 */
function showCapabilities() {
  console.log(`🔧 ${TOOL_NAME} Capabilities

🔍 New Relic APM Analyzer initialized
   📊 API: NerdGraph (GraphQL) + REST API v2
   📈 Version: ${CLI_VERSION}
🎯 Phase: 2.0 (Workflow Integration)
📊 Market Focus: Application Performance Monitoring

✨ FEATURES:
   ✅ real-time monitoring
   ✅ historical data analysis
   ✅ error tracking
   ✅ response time analysis
   ✅ throughput monitoring
   ✅ apdex scoring
   ✅ memory usage tracking
   ✅ custom metrics
   ✅ alerting integration
   ✅ workflow correlation

📋 PERFORMANCE CATEGORIES:
   ✅ response time analysis
   ✅ error rate monitoring
   ✅ availability tracking
   ✅ throughput analysis
   ✅ memory usage
   ✅ user satisfaction (Apdex)

🔗 INTEGRATIONS:
   ✅ nerdgraph api
   ✅ rest api v2
   ✅ real-time monitoring
   ✅ historical analysis
   ✅ multi-application

🏙️  CITY MAPPING:
   🏢 buildings: applications with height based on throughput + response time
   🏢 districts: application grouping by performance tier
   🏢 buildingCondition: performance health and error rates
   🏢 performanceZones: response time and availability heat maps
   🏢 infrastructure: APM health indicators and real-time monitoring

⚡ WORKFLOW INTEGRATION:
   🔗 Performance-Security correlation (slow endpoints + vulnerabilities)
   🔗 Architecture-Performance analysis (complexity + response time)
   🔗 Dependency-Performance impact (external services + latency)
   📊 Real-time hotspot detection and prioritization
   🎯 Unified performance + static analysis insights`);
}

/**
 * Test New Relic API connection
 */
async function testConnection() {
  try {
    console.log('🔍 Testing New Relic API connection...');

    const config = getConfigFromEnv();
    const adapter = new NewRelicAdapter();

    await adapter.initialize(config);
    console.log('✅ New Relic API connection successful');
    console.log(`📊 Account ID: ${config.accountId}`);
    console.log('🎯 Ready for performance analysis integration');

  } catch (error) {
    console.error('❌ New Relic API connection failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Verify NEW_RELIC_API_KEY environment variable');
    console.log('   • Verify NEW_RELIC_ACCOUNT_ID environment variable');
    console.log('   • Check API key permissions (read access required)');
    console.log('   • Ensure account ID is correct');
    process.exit(1);
  }
}

/**
 * Show current configuration status
 */
function showConfig() {
  console.log(`⚙️  ${TOOL_NAME} Configuration Status

📊 Phase 2 Workflow Integration Setup
==================================`);

  const config = getConfigFromEnv();

  console.log(`✅ API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : '❌ Not set'}`);
  console.log(`✅ Account ID: ${config.accountId || '❌ Not set'}`);
  console.log(`📱 App ID: ${config.applicationId || 'Not set (will use parameter)'}`);
  console.log(`🌐 Base URL: ${config.baseUrl || 'https://api.newrelic.com'}`);
  console.log(`📈 NerdGraph URL: ${config.nerdGraphUrl || 'https://api.newrelic.com/graphql'}`);

  console.log('\n🔧 Environment Variables:');
  console.log('   NEW_RELIC_API_KEY:', process.env.NEW_RELIC_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   NEW_RELIC_ACCOUNT_ID:', process.env.NEW_RELIC_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
  console.log('   NEW_RELIC_APP_ID:', process.env.NEW_RELIC_APP_ID ? '✅ Set' : '⚪ Optional');

  if (!config.apiKey || !config.accountId) {
    console.log('\n❌ Configuration incomplete. Required environment variables:');
    console.log('   export NEW_RELIC_API_KEY="your-api-key"');
    console.log('   export NEW_RELIC_ACCOUNT_ID="your-account-id"');
  } else {
    console.log('\n✅ Configuration ready for Phase 2 integration');
  }
}

/**
 * List available New Relic applications
 */
async function listApplications() {
  try {
    console.log('📱 Fetching New Relic applications...');

    const config = getConfigFromEnv();
    const adapter = new NewRelicAdapter();

    await adapter.initialize(config);

    // Use adapter's internal API to get applications
    const apps = await adapter.makeRequest('/v2/applications.json', 'GET');

    console.log(`\n📊 Found ${apps.applications.length} applications:`);
    console.log('=' + '='.repeat(50));

    for (const app of apps.applications) {
      const status = app.reporting ? '🟢' : '🔴';
      const health = app.health_status === 'green' ? '✅' :
                    app.health_status === 'yellow' ? '⚠️' :
                    app.health_status === 'red' ? '❌' : '⚪';

      console.log(`${status} ${health} ${app.name} (ID: ${app.id})`);
      console.log(`   Language: ${app.language}`);
      console.log(`   Response Time: ${app.application_summary?.response_time || 'N/A'}ms`);
      console.log(`   Throughput: ${app.application_summary?.throughput || 'N/A'} rpm`);
      console.log(`   Error Rate: ${app.application_summary?.error_rate || 'N/A'}%`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to fetch applications:', error.message);
    process.exit(1);
  }
}

/**
 * Analyze application performance
 */
async function analyzeApplication(applicationId) {
  if (!applicationId) {
    console.error('❌ Application ID required');
    console.log('Usage: node cli.js analyze <appId>');
    process.exit(1);
  }

  try {
    console.log(`🔍 Analyzing application performance for ID: ${applicationId}`);

    const config = getConfigFromEnv();
    const adapter = new NewRelicAdapter();

    await adapter.initialize(config);

    // Get performance issues
    const issues = await adapter.getPerformanceMetrics(applicationId);

    console.log(`\n📊 Performance Analysis Results`);
    console.log('=' + '='.repeat(40));
    console.log(`🎯 Found ${issues.length} performance issues\n`);

    if (issues.length === 0) {
      console.log('✅ No performance issues detected');
      console.log('🎉 Application appears to be performing well');
      return;
    }

    // Group issues by severity
    const critical = issues.filter(i => i.severity === 'critical');
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    const low = issues.filter(i => i.severity === 'low');

    console.log('📈 Issue Distribution:');
    if (critical.length > 0) console.log(`   🔴 Critical: ${critical.length}`);
    if (high.length > 0) console.log(`   🟠 High: ${high.length}`);
    if (medium.length > 0) console.log(`   🟡 Medium: ${medium.length}`);
    if (low.length > 0) console.log(`   🟢 Low: ${low.length}`);
    console.log('');

    // Display issues
    for (const issue of issues) {
      const severityIcon = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
      }[issue.severity] || '⚪';

      console.log(`${severityIcon} ${issue.title}`);
      console.log(`   ${issue.description}`);
      console.log(`   Category: ${issue.performanceCategory}`);
      console.log(`   Impact: ${issue.impactLevel}`);

      if (issue.performanceMetrics.responseTime) {
        console.log(`   Response Time: ${issue.performanceMetrics.responseTime}ms`);
      }
      if (issue.performanceMetrics.errorRate) {
        console.log(`   Error Rate: ${issue.performanceMetrics.errorRate}%`);
      }
      if (issue.performanceMetrics.throughput) {
        console.log(`   Throughput: ${issue.performanceMetrics.throughput} rpm`);
      }

      if (issue.optimizationOpportunity) {
        console.log(`   💡 Optimization: ${issue.optimizationOpportunity.potentialImprovement}`);
        console.log(`   ⚡ Effort: ${issue.optimizationOpportunity.effort}, Priority: ${issue.optimizationOpportunity.priority}`);
      }

      console.log('');
    }

    console.log('🚀 Phase 2 Integration Ready:');
    console.log('   • Performance data unified with static analysis');
    console.log('   • Cross-dimensional correlation enabled');
    console.log('   • Workflow hotspots enhanced with APM data');

  } catch (error) {
    console.error('❌ Performance analysis failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get performance metrics for application
 */
async function getMetrics(applicationId) {
  if (!applicationId) {
    console.error('❌ Application ID required');
    console.log('Usage: node cli.js metrics <appId>');
    process.exit(1);
  }

  try {
    console.log(`📊 Fetching performance metrics for application: ${applicationId}`);

    const config = getConfigFromEnv();
    const adapter = new NewRelicAdapter();

    await adapter.initialize(config);

    // Get raw metrics data
    const app = await adapter.getApplicationDetails(applicationId);

    console.log(`\n📈 Performance Metrics for "${app.name}"`);
    console.log('=' + '='.repeat(50));
    console.log(`🏥 Health Status: ${app.health_status}`);
    console.log(`📡 Reporting: ${app.reporting ? 'Yes' : 'No'}`);
    console.log(`🕐 Last Report: ${app.last_reported_at}`);
    console.log('');

    console.log('⚡ Application Summary:');
    console.log(`   Response Time: ${app.application_summary.response_time}ms`);
    console.log(`   Throughput: ${app.application_summary.throughput} rpm`);
    console.log(`   Error Rate: ${app.application_summary.error_rate}%`);
    console.log(`   Apdex Target: ${app.application_summary.apdex_target}s`);
    console.log(`   Apdex Score: ${app.application_summary.apdex_score}`);

    // Performance assessment
    console.log('\n🎯 Performance Assessment:');
    const responseGood = app.application_summary.response_time <= 1000;
    const errorGood = app.application_summary.error_rate <= 1;
    const apdexGood = app.application_summary.apdex_score >= 0.8;

    console.log(`   Response Time: ${responseGood ? '✅' : '❌'} ${responseGood ? 'Good' : 'Needs Improvement'}`);
    console.log(`   Error Rate: ${errorGood ? '✅' : '❌'} ${errorGood ? 'Good' : 'Needs Improvement'}`);
    console.log(`   User Satisfaction: ${apdexGood ? '✅' : '❌'} ${apdexGood ? 'Good' : 'Needs Improvement'}`);

  } catch (error) {
    console.error('❌ Failed to fetch metrics:', error.message);
    process.exit(1);
  }
}

/**
 * Get configuration from environment variables
 */
function getConfigFromEnv() {
  return {
    apiKey: process.env.NEW_RELIC_API_KEY,
    accountId: process.env.NEW_RELIC_ACCOUNT_ID,
    applicationId: process.env.NEW_RELIC_APP_ID
  };
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  // Handle no command or help
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Handle version
  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(`${TOOL_NAME} v${CLI_VERSION}`);
    return;
  }

  // Route commands
  try {
    switch (command) {
      case 'test':
        await testConnection();
        break;

      case 'config':
        showConfig();
        break;

      case 'capabilities':
        showCapabilities();
        break;

      case 'apps':
        await listApplications();
        break;

      case 'analyze':
        await analyzeApplication(param);
        break;

      case 'metrics':
        await getMetrics(param);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Use "node cli.js help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command execution failed:', error.message);
    process.exit(1);
  }
}

// Execute CLI
if (require.main === module) {
  main().catch(error => {
    console.error('❌ CLI execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { main };
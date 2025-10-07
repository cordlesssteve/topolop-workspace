#!/usr/bin/env node

const { program } = require('commander');
const VeracodeAnalyzer = require('./index');
const fs = require('fs-extra');
const path = require('path');

/**
 * Veracode CLI Interface
 * 
 * Provides command-line access to Veracode enterprise security analysis capabilities
 * via Veracode's REST API with HMAC authentication.
 */

// CLI Configuration
program
  .name('topolop-veracode')
  .description('Veracode enterprise security analysis integration for Topolop')
  .version('1.0.0')
  .option('--api-id <id>', 'Veracode API ID (overrides VERACODE_API_ID env var)')
  .option('--api-key <key>', 'Veracode API Key (overrides VERACODE_API_KEY env var)')
  .option('-f, --format <format>', 'Output format (json|summary|executive)', 'json')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '60000');

/**
 * Application Analysis Command
 */
program
  .command('analyze')
  .description('Analyze a specific Veracode application')
  .argument('<application-id>', 'Veracode application ID')
  .option('--max-findings <number>', 'Maximum number of findings to fetch', '1000')
  .option('--max-scans <number>', 'Maximum number of scans to include', '10')
  .option('--include-policy', 'Include policy compliance data')
  .option('--include-history', 'Include historical scan data')
  .action(async (applicationId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Analyzing Veracode application: ${applicationId}`);
      
      const analysisOptions = {
        maxFindings: parseInt(options.maxFindings),
        maxScans: parseInt(options.maxScans),
        includePolicyData: options.includePolicy,
        includeHistoricalData: options.includeHistory
      };
      
      const result = await analyzer.analyzeApplication(applicationId, analysisOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Portfolio Analysis Command
 */
program
  .command('portfolio')
  .description('Analyze multiple applications (portfolio analysis)')
  .option('-l, --limit <number>', 'Maximum number of applications to analyze', '10')
  .option('--business-criticality <level>', 'Filter by business criticality')
  .option('--name <pattern>', 'Filter applications by name pattern')
  .option('--tags <tags>', 'Filter by application tags (comma-separated)')
  .action(async (options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Running portfolio analysis with limit: ${options.limit}`);
      
      const filters = {
        limit: parseInt(options.limit),
        business_criticality: options.businessCriticality,
        name: options.name,
        tags: options.tags
      };
      
      const result = await analyzer.analyzePortfolio(filters);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Portfolio analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Application Search Command
 */
program
  .command('search')
  .description('Search Veracode applications')
  .argument('[search-term]', 'Search term for application name/description')
  .option('--business-criticality <level>', 'Filter by business criticality')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('-l, --limit <number>', 'Maximum number of results', '50')
  .action(async (searchTerm, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Searching applications: ${searchTerm || 'all'}`);
      
      const filters = {
        business_criticality: options.businessCriticality,
        tags: options.tags,
        limit: parseInt(options.limit)
      };
      
      const result = await analyzer.searchApplications(searchTerm, filters);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Search failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Application Metrics Command
 */
program
  .command('metrics')
  .description('Get security metrics for a specific application')
  .argument('<application-id>', 'Veracode application ID')
  .option('--include-trends', 'Include historical trend data')
  .action(async (applicationId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Fetching metrics for application: ${applicationId}`);
      
      const metricsOptions = {
        includeTrends: options.includeTrends
      };
      
      const result = await analyzer.getApplicationMetrics(applicationId, metricsOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Metrics fetch failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Comprehensive Analysis Command
 */
program
  .command('comprehensive')
  .description('Run comprehensive security analysis with executive reporting')
  .argument('<application-id>', 'Veracode application ID')
  .option('--max-findings <number>', 'Maximum number of findings to analyze', '1000')
  .option('--executive-summary', 'Include executive summary and recommendations')
  .action(async (applicationId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Running comprehensive analysis for application: ${applicationId}`);
      
      const analysisOptions = {
        maxFindings: parseInt(options.maxFindings),
        includeExecutive: options.executiveSummary
      };
      
      const result = await analyzer.comprehensiveAnalysis(applicationId, analysisOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Comprehensive analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Applications List Command
 */
program
  .command('list')
  .description('List accessible Veracode applications')
  .option('-l, --limit <number>', 'Maximum number of applications to list', '100')
  .option('--business-criticality <level>', 'Filter by business criticality')
  .option('--format-table', 'Display results in table format')
  .action(async (options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Listing applications with limit: ${options.limit}`);
      
      const filters = {
        limit: parseInt(options.limit),
        business_criticality: options.businessCriticality
      };
      
      const result = await analyzer.client.getApplications(filters);
      
      if (options.formatTable) {
        displayApplicationsTable(result.applications);
      } else {
        await outputResult(result, program.opts());
      }
      
    } catch (error) {
      console.error(`❌ Failed to list applications: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Capabilities Command
 */
program
  .command('capabilities')
  .description('Show Veracode analyzer capabilities and configuration')
  .action(async () => {
    try {
      // Don't require authentication for capabilities
      const analyzer = new VeracodeAnalyzer(program.opts());
      
      const capabilities = analyzer.getCapabilities();
      const configStatus = {
        apiUrl: 'https://api.veracode.com/appsec/v1',
        authenticated: false,
        rateLimit: 100,
        requestCount: 0,
        requestsRemaining: 100,
        rateLimitResetTime: new Date(Date.now() + 3600000).toISOString(),
        apiIdConfigured: !!(program.opts().apiId || process.env.VERACODE_API_ID),
        apiKeyConfigured: !!(program.opts().apiKey || process.env.VERACODE_API_KEY)
      };
      
      const result = {
        capabilities,
        configuration: configStatus,
        integration: {
          layer: 1,
          dataSource: 'Veracode Enterprise REST API',
          analysisTypes: ['Enterprise Security', 'SAST', 'Policy Compliance', 'Risk Assessment'],
          marketShare: '9.0%',
          tier: 'Tier 1 - High Complexity',
          phase: 'Phase 1.9',
          status: 'Active'
        }
      };
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Capabilities check failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Test Connection Command
 */
program
  .command('test')
  .description('Test Veracode API connection and authentication')
  .action(async () => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', 'Testing Veracode API connection...');
      
      const testResult = await analyzer.client.testConnection();
      
      const result = {
        connection: 'successful',
        authentication: 'valid',
        applicationsAccessible: testResult.applicationsCount,
        timestamp: new Date().toISOString(),
        apiEndpoint: analyzer.client.config.apiUrl
      };
      
      console.log('✅ Veracode connection test successful');
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Connection test failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Configuration Command
 */
program
  .command('config')
  .description('Show current configuration and setup instructions')
  .action(async () => {
    const result = {
      configuration: {
        apiIdEnvVar: 'VERACODE_API_ID',
        apiKeyEnvVar: 'VERACODE_API_KEY',
        apiIdSet: !!(process.env.VERACODE_API_ID || program.opts().apiId),
        apiKeySet: !!(process.env.VERACODE_API_KEY || program.opts().apiKey),
        apiUrl: 'https://api.veracode.com/appsec/v1',
        timeout: program.opts().timeout || 60000,
        authentication: 'HMAC-SHA256'
      },
      setup: {
        instructions: [
          '1. Create Veracode account and get API access',
          '2. Generate API ID and API Key from Veracode platform',
          '3. Set environment variables: export VERACODE_API_ID=your_id VERACODE_API_KEY=your_key',
          '4. Test connection: topolop-veracode test'
        ],
        documentation: 'https://docs.veracode.com/r/Veracode_APIs'
      },
      capabilities: {
        enterpriseSecurity: true,
        staticAnalysis: true,
        policyCompliance: true,
        portfolioAnalysis: true,
        executiveReporting: true,
        hmacAuthentication: true,
        binaryAnalysis: true,
        complianceFrameworks: true
      }
    };
    
    await outputResult(result, program.opts());
  });

/**
 * Create analyzer instance with configuration
 */
async function createAnalyzer(options) {
  const config = {
    timeout: parseInt(options.timeout),
    apiId: options.apiId,
    apiKey: options.apiKey
  };
  
  const analyzer = new VeracodeAnalyzer(config);
  
  // Test authentication on creation
  try {
    await analyzer.initialize();
  } catch (error) {
    if (error.message.includes('credentials required')) {
      console.error('❌ Veracode authentication required.');
      console.error('Set VERACODE_API_ID and VERACODE_API_KEY environment variables or use --api-id and --api-key options.');
      console.error('Run "topolop-veracode config" for setup instructions.');
    }
    throw error;
  }
  
  return analyzer;
}

/**
 * Output result in specified format
 */
async function outputResult(result, options) {
  let output;
  
  if (options.format === 'summary') {
    output = formatSummary(result);
  } else if (options.format === 'executive') {
    output = formatExecutiveSummary(result);
  } else {
    output = JSON.stringify(result, null, 2);
  }
  
  if (options.output) {
    await fs.ensureFile(options.output);
    await fs.writeFile(options.output, output);
    log('verbose', `Output written to: ${options.output}`);
  } else {
    console.log(output);
  }
}

/**
 * Format result as human-readable summary
 */
function formatSummary(result) {
  if (result.project) {
    let summary = `\n🛡️  Veracode Security Analysis Summary\n`;
    summary += `Application: ${result.project.name}\n`;
    summary += `Security Score: ${result.project.metrics.securityScore}/100\n`;
    summary += `Risk Rating: ${result.project.metrics.riskRating}\n`;
    summary += `Total Findings: ${result.project.metrics.totalFindings}\n`;
    summary += `Critical: ${result.project.metrics.criticalFindings}, High: ${result.project.metrics.highFindings}\n`;
    summary += `Policy Compliant: ${result.project.metrics.policyCompliance?.compliant ? 'Yes' : 'No'}\n`;
    summary += `Business Criticality: ${result.project.metrics.businessCriticality}\n`;
    return summary;
  }
  
  if (result.portfolio) {
    let summary = `\n🏢 Veracode Portfolio Analysis Summary\n`;
    summary += `Applications Analyzed: ${result.portfolio.analyzedApplications}\n`;
    summary += `Portfolio Security Score: ${result.aggregateMetrics.overallSecurityScore}/100\n`;
    summary += `Total Findings: ${result.aggregateMetrics.totalFindings}\n`;
    summary += `Policy Compliant Apps: ${result.aggregateMetrics.policyCompliantApps}\n`;
    summary += `Risk Distribution: Critical: ${result.aggregateMetrics.riskDistribution.critical}, High: ${result.aggregateMetrics.riskDistribution.high}\n`;
    return summary;
  }
  
  if (result.applications) {
    let summary = `\n📱 Veracode Applications (${result.applications.length})\n`;
    result.applications.slice(0, 10).forEach(app => {
      summary += `- ${app.profile?.name || app.id} (${app.profile?.business_criticality || 'Unknown'})\n`;
    });
    return summary;
  }
  
  return JSON.stringify(result, null, 2);
}

/**
 * Format result as executive summary
 */
function formatExecutiveSummary(result) {
  if (result.executiveSummary) {
    let summary = `\n📊 Executive Security Summary\n`;
    summary += `Application: ${result.executiveSummary.applicationName}\n`;
    summary += `Security Posture: ${result.executiveSummary.securityPosture}\n`;
    summary += `Business Impact: ${result.executiveSummary.businessImpact}\n`;
    summary += `Compliance Status: ${result.executiveSummary.complianceStatus}\n`;
    summary += `Key Recommendations:\n`;
    result.executiveSummary.recommendedActions.forEach(action => {
      summary += `  • ${action}\n`;
    });
    return summary;
  }
  
  return formatSummary(result);
}

/**
 * Display applications in table format
 */
function displayApplicationsTable(applications) {
  console.log('\n📱 Veracode Applications');
  console.log('=' .repeat(80));
  console.log(
    'Name'.padEnd(30) + 
    'ID'.padEnd(15) + 
    'Criticality'.padEnd(15) + 
    'Last Scan'.padEnd(20)
  );
  console.log('-'.repeat(80));
  
  applications.forEach(app => {
    console.log(
      (app.profile?.name || 'Unknown').padEnd(30).substring(0, 29) + 
      app.id.toString().padEnd(15) + 
      (app.profile?.business_criticality || 'Unknown').padEnd(15) + 
      (app.last_scan_date || 'Never').padEnd(20)
    );
  });
  
  console.log('');
}

/**
 * Logging utility
 */
function log(level, message) {
  if (level === 'verbose' && program.opts().verbose) {
    console.log(`[DEBUG] ${message}`);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(`❌ Unhandled error: ${error.message}`);
  process.exit(1);
});

program.parse();
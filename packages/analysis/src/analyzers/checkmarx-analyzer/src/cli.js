#!/usr/bin/env node

const { Command } = require('commander');
const CheckmarxAnalyzer = require('./index');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .name('topolop-checkmarx')
  .description('Checkmarx comprehensive SAST analysis integration for Topolop')
  .version('1.0.0');

/**
 * Global configuration setup
 */
function getConfig(options) {
  return {
    baseUrl: options.baseUrl || process.env.CHECKMARX_BASE_URL || 'http://localhost:80',
    apiPath: options.apiPath || '/cxrestapi',
    username: options.username || process.env.CHECKMARX_USERNAME,
    password: options.password || process.env.CHECKMARX_PASSWORD,
    clientId: options.clientId || 'resource_owner_client',
    clientSecret: options.clientSecret || '014DF517-39D1-4453-B7B3-9930C563627C',
    grantType: options.grantType || 'password',
    scope: options.scope || 'sast_rest_api',
    timeout: parseInt(options.timeout) || 120000,
    maxRetries: parseInt(options.maxRetries) || 3,
    rateLimit: parseInt(options.rateLimit) || 50,
    includeDataFlow: options.includeDataFlow !== false
  };
}

/**
 * Test connection command
 */
program
  .command('test')
  .description('Test connection and authentication with Checkmarx')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '120000')
  .action(async (options) => {
    try {
      console.log('🔍 Testing Checkmarx connection...');
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.testConnection();
      
      if (result.success) {
        console.log('✅ Connection successful!');
        console.log(`📊 Server version: ${result.version || 'unknown'}`);
        console.log(`🏗️  Projects accessible: ${result.projectsCount}`);
        console.log(`🔐 Authentication: ${result.authenticated ? '✅ Valid' : '❌ Invalid'}`);
        console.log(`⚙️  Configuration: Rate limit ${result.configuration.requestsRemaining}/${result.configuration.rateLimit} remaining`);
      } else {
        console.log('❌ Connection failed!');
        console.log(`Error: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      process.exit(1);
    }
  });

/**
 * List projects command
 */
program
  .command('projects')
  .description('List all accessible Checkmarx projects')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--team-id <id>', 'Filter by team ID')
  .option('--project-name <name>', 'Filter by project name')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      console.log('📋 Fetching Checkmarx projects...');
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.getProjects({
        teamId: options.teamId,
        projectName: options.projectName
      });
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.totalProjects} projects:\n`);
        result.projects.forEach((project, index) => {
          console.log(`${index + 1}. ${project.name} (ID: ${project.id})`);
          console.log(`   Team: ${project.teamName || 'N/A'}`);
          console.log(`   Created: ${project.dateCreated ? new Date(project.dateCreated).toLocaleDateString() : 'N/A'}`);
          console.log(`   Language: ${project.projectLanguages?.join(', ') || 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error.message);
      process.exit(1);
    }
  });

/**
 * Search projects command
 */
program
  .command('search')
  .description('Search Checkmarx projects by name')
  .argument('<search-term>', 'Search term for project names')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--team-id <id>', 'Filter by team ID')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (searchTerm, options) => {
    try {
      console.log(`🔍 Searching projects for "${searchTerm}"...`);
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.searchProjects(searchTerm, {
        teamId: options.teamId
      });
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.totalCount} matching projects:\n`);
        result.projects.forEach((project, index) => {
          console.log(`${index + 1}. ${project.name} (ID: ${project.id})`);
          console.log(`   Team: ${project.teamName || 'N/A'}`);
          console.log(`   Created: ${project.dateCreated ? new Date(project.dateCreated).toLocaleDateString() : 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Analyze project command
 */
program
  .command('analyze')
  .description('Analyze a Checkmarx project and get comprehensive SAST results')
  .argument('<project-id>', 'Checkmarx project ID to analyze')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--output <path>', 'Output file path for results')
  .option('--format <format>', 'Output format (json|summary)', 'summary')
  .option('--include-data-flow', 'Include data flow analysis (default: true)', true)
  .action(async (projectId, options) => {
    try {
      console.log(`🔍 Analyzing Checkmarx project ${projectId}...`);
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.analyzeProject(projectId, {
        includeDataFlow: options.includeDataFlow
      });
      
      // Output results
      if (options.output) {
        await analyzer.exportResults(result, path.dirname(options.output), 'json');
        console.log(`📄 Results exported to: ${options.output}`);
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n🎯 Checkmarx Analysis Summary:');
        console.log(`Project: ${result.project?.name || projectId}`);
        console.log(`Status: ${result.status}`);
        
        if (result.summary) {
          console.log('\n📊 Security Summary:');
          console.log(`🔴 High Severity: ${result.summary.highSeverity}`);
          console.log(`🟡 Medium Severity: ${result.summary.mediumSeverity}`);
          console.log(`🔵 Low Severity: ${result.summary.lowSeverity}`);
          console.log(`ℹ️  Information: ${result.summary.infoSeverity}`);
          console.log(`📈 Total Vulnerabilities: ${result.summary.totalVulnerabilities}`);
        }
        
        if (result.latestScan) {
          console.log('\n📅 Latest Scan:');
          console.log(`Scan ID: ${result.latestScan.id}`);
          console.log(`Status: ${result.latestScan.status}`);
          console.log(`Started: ${result.latestScan.startedOn ? new Date(result.latestScan.startedOn).toLocaleString() : 'N/A'}`);
          console.log(`Finished: ${result.latestScan.finishedOn ? new Date(result.latestScan.finishedOn).toLocaleString() : 'N/A'}`);
        }
        
        if (result.cityData) {
          console.log('\n🏙️  City Visualization Data:');
          console.log(`Buildings (files): ${result.cityData.buildings?.length || 0}`);
          console.log(`Districts: ${result.cityData.districts?.length || 0}`);
          console.log(`Security zones: ${result.cityData.securityZones?.length || 0}`);
        }
      }
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Create scan command
 */
program
  .command('scan')
  .description('Create a new SAST scan for a project')
  .argument('<project-id>', 'Checkmarx project ID to scan')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--incremental', 'Perform incremental scan', false)
  .option('--preset <preset>', 'Scan preset ID')
  .option('--engine-config <config>', 'Engine configuration ID')
  .option('--comment <comment>', 'Scan comment')
  .option('--no-wait', 'Don\'t wait for scan completion')
  .option('--max-wait <ms>', 'Maximum wait time in milliseconds', '3600000')
  .option('--poll-interval <ms>', 'Polling interval in milliseconds', '30000')
  .action(async (projectId, options) => {
    try {
      console.log(`🚀 Creating new scan for project ${projectId}...`);
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.createAndRunScan(projectId, {
        incremental: options.incremental,
        preset: options.preset,
        engineConfiguration: options.engineConfig,
        comment: options.comment,
        waitForCompletion: !options.noWait,
        maxWaitTime: parseInt(options.maxWait),
        pollInterval: parseInt(options.pollInterval)
      });
      
      console.log('\n🎯 Scan Results:');
      console.log(`Scan ID: ${result.scanId}`);
      console.log(`Status: ${result.status}`);
      
      if (result.status === 'completed' && result.summary) {
        console.log('\n📊 Scan Summary:');
        console.log(`🔴 High Severity: ${result.summary.highSeverity}`);
        console.log(`🟡 Medium Severity: ${result.summary.mediumSeverity}`);
        console.log(`🔵 Low Severity: ${result.summary.lowSeverity}`);
        console.log(`ℹ️  Information: ${result.summary.infoSeverity}`);
        console.log(`📈 Total Vulnerabilities: ${result.summary.totalVulnerabilities}`);
      } else if (result.status === 'running') {
        console.log(`\nℹ️  ${result.message}`);
        console.log(`Use 'topolop-checkmarx status ${result.scanId}' to check progress.`);
      }
    } catch (error) {
      console.error('❌ Scan creation failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Scan status command
 */
program
  .command('status')
  .description('Get status of a running scan')
  .argument('<scan-id>', 'Scan ID to check')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--format <format>', 'Output format (json|summary)', 'summary')
  .action(async (scanId, options) => {
    try {
      console.log(`🔍 Getting status for scan ${scanId}...`);
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.getScanStatus(scanId);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n📊 Scan Status:');
        console.log(`Scan ID: ${result.scanId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Progress: ${result.progress}%`);
        console.log(`Stage: ${result.stage || 'N/A'}`);
        console.log(`Started: ${result.startedOn ? new Date(result.startedOn).toLocaleString() : 'N/A'}`);
        console.log(`Finished: ${result.finishedOn ? new Date(result.finishedOn).toLocaleString() : 'N/A'}`);
        console.log(`Queued: ${result.queuedOn ? new Date(result.queuedOn).toLocaleString() : 'N/A'}`);
      }
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Presets command
 */
program
  .command('presets')
  .description('List available scan presets')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      console.log('📋 Fetching scan presets...');
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.getPresets();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Available Presets:\n`);
        result.presets.forEach((preset, index) => {
          console.log(`${index + 1}. ${preset.name} (ID: ${preset.id})`);
          console.log(`   Owner: ${preset.ownerName || 'N/A'}`);
          console.log(`   Languages: ${preset.queryLanguages?.join(', ') || 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch presets:', error.message);
      process.exit(1);
    }
  });

/**
 * Engine configurations command
 */
program
  .command('engines')
  .description('List available engine configurations')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      console.log('📋 Fetching engine configurations...');
      
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      const result = await analyzer.getEngineConfigurations();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Available Engine Configurations:\n`);
        result.engineConfigurations.forEach((config, index) => {
          console.log(`${index + 1}. ${config.name} (ID: ${config.id})`);
          console.log(`   Description: ${config.description || 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch engine configurations:', error.message);
      process.exit(1);
    }
  });

/**
 * Configuration status command
 */
program
  .command('config')
  .description('Show current analyzer configuration and status')
  .option('--base-url <url>', 'Checkmarx server base URL')
  .option('--username <username>', 'Checkmarx username')
  .option('--password <password>', 'Checkmarx password')
  .action(async (options) => {
    try {
      const config = getConfig(options);
      const analyzer = new CheckmarxAnalyzer(config);
      
      // Try to initialize to get full status
      let status;
      try {
        await analyzer.initialize();
        status = analyzer.getStatus();
      } catch (error) {
        status = {
          analyzer: 'checkmarx',
          version: '1.0.0',
          initialized: false,
          authenticated: false,
          error: error.message
        };
      }
      
      console.log('\n⚙️  Checkmarx Analyzer Configuration:\n');
      console.log(`Analyzer: ${status.analyzer}`);
      console.log(`Version: ${status.version}`);
      console.log(`Initialized: ${status.initialized ? '✅' : '❌'}`);
      console.log(`Authenticated: ${status.authenticated ? '✅' : '❌'}`);
      
      if (status.configuration) {
        console.log(`Base URL: ${status.configuration.baseUrl}`);
        console.log(`API Path: ${status.configuration.apiPath}`);
        console.log(`Rate Limit: ${status.configuration.requestsRemaining}/${status.configuration.rateLimit}`);
        console.log(`Token Valid: ${status.configuration.tokenValid ? '✅' : '❌'}`);
      }
      
      if (status.capabilities) {
        console.log('\n🎯 Capabilities:');
        Object.entries(status.capabilities).forEach(([capability, enabled]) => {
          console.log(`  ${capability}: ${enabled ? '✅' : '❌'}`);
        });
      }
      
      if (status.error) {
        console.log(`\n❌ Error: ${status.error}`);
      }
    } catch (error) {
      console.error('❌ Configuration check failed:', error.message);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

// Show help when no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();
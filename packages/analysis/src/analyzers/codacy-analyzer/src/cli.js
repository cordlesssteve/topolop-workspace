#!/usr/bin/env node

const { Command } = require('commander');
const CodacyAnalyzer = require('./index');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .name('topolop-codacy')
  .description('Codacy code quality analysis integration for Topolop')
  .version('1.0.0');

/**
 * Global configuration setup
 */
function getConfig(options) {
  return {
    baseUrl: options.baseUrl || process.env.CODACY_BASE_URL || 'https://app.codacy.com/api/v3',
    apiToken: options.apiToken || process.env.CODACY_API_TOKEN,
    timeout: parseInt(options.timeout) || 30000,
    maxRetries: parseInt(options.maxRetries) || 3,
    rateLimit: parseInt(options.rateLimit) || 2500,
    maxIssuesPerRepository: parseInt(options.maxIssues) || 1000,
    maxFilesPerRepository: parseInt(options.maxFiles) || 1000,
    includeFileMetrics: options.includeFileMetrics !== false
  };
}

/**
 * Test connection command
 */
program
  .command('test')
  .description('Test connection and authentication with Codacy')
  .option('--api-token <token>', 'Codacy API token')
  .option('--base-url <url>', 'Codacy API base URL')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
  .action(async (options) => {
    try {
      console.log('🔍 Testing Codacy connection...');
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const result = await analyzer.testConnection();
      
      if (result.success) {
        console.log('✅ Connection successful!');
        console.log(`👤 User: ${result.user?.name || result.user?.username || 'Unknown'}`);
        console.log(`📧 Email: ${result.user?.email || 'Not provided'}`);
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
 * List organizations command
 */
program
  .command('organizations')
  .description('List accessible organizations')
  .option('--api-token <token>', 'Codacy API token')
  .option('--provider <provider>', 'Git provider (gh, gl, bb)', 'gh')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      console.log('🏢 Fetching organizations...');
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const result = await analyzer.getOrganizations(options.provider);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.totalOrganizations} organizations:\n`);
        result.organizations.forEach((org, index) => {
          console.log(`${index + 1}. ${org.name}`);
          console.log(`   Provider: ${org.provider || options.provider}`);
          console.log(`   Type: ${org.type || 'Unknown'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch organizations:', error.message);
      process.exit(1);
    }
  });

/**
 * List repositories command
 */
program
  .command('repositories')
  .description('List repositories for an organization')
  .argument('<organization>', 'Organization name')
  .option('--api-token <token>', 'Codacy API token')
  .option('--provider <provider>', 'Git provider (gh, gl, bb)', 'gh')
  .option('--limit <number>', 'Maximum number of repositories', '100')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (organization, options) => {
    try {
      console.log(`📋 Fetching repositories for ${options.provider}/${organization}...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const result = await analyzer.getRepositories(options.provider, organization, {
        limit: parseInt(options.limit)
      });
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.repositories.length} repositories:\n`);
        result.repositories.forEach((repo, index) => {
          console.log(`${index + 1}. ${repo.name}`);
          console.log(`   Last analyzed: ${repo.lastAnalyzed ? new Date(repo.lastAnalyzed).toLocaleDateString() : 'Never'}`);
          console.log(`   Grade: ${repo.grade || 'Not graded'}`);
          console.log(`   Issues: ${repo.issues || 0}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch repositories:', error.message);
      process.exit(1);
    }
  });

/**
 * Search repositories command
 */
program
  .command('search')
  .description('Search repositories by name')
  .argument('<search-term>', 'Search term for repository names')
  .option('--api-token <token>', 'Codacy API token')
  .option('--provider <provider>', 'Git provider (gh, gl, bb)', 'gh')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (searchTerm, options) => {
    try {
      console.log(`🔍 Searching repositories for "${searchTerm}"...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const result = await analyzer.searchRepositories(searchTerm, options.provider);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.totalCount} matching repositories:\n`);
        result.repositories.forEach((repo, index) => {
          console.log(`${index + 1}. ${repo.organization}/${repo.name}`);
          console.log(`   Provider: ${repo.provider}`);
          console.log(`   Grade: ${repo.grade || 'Not graded'}`);
          console.log(`   Last analyzed: ${repo.lastAnalyzed ? new Date(repo.lastAnalyzed).toLocaleDateString() : 'Never'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Analyze repository command
 */
program
  .command('analyze')
  .description('Analyze a repository and get comprehensive quality results')
  .argument('<provider>', 'Git provider (gh, gl, bb)')
  .argument('<organization>', 'Organization name')
  .argument('<repository>', 'Repository name')
  .option('--api-token <token>', 'Codacy API token')
  .option('--branch <branch>', 'Branch to analyze')
  .option('--directory <path>', 'Specific directory to analyze')
  .option('--max-issues <number>', 'Maximum issues to retrieve', '1000')
  .option('--max-files <number>', 'Maximum files to retrieve', '1000')
  .option('--severities <levels>', 'Issue severity levels (Error,Warning,Info)', 'Error,Warning,Info')
  .option('--categories <types>', 'Issue categories to include')
  .option('--output <path>', 'Output file path for results')
  .option('--format <format>', 'Output format (json|summary)', 'summary')
  .action(async (provider, organization, repository, options) => {
    try {
      console.log(`🔍 Analyzing ${provider}/${organization}/${repository}...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const analysisOptions = {
        branch: options.branch,
        directory: options.directory,
        maxIssues: parseInt(options.maxIssues),
        maxFiles: parseInt(options.maxFiles),
        severities: options.severities?.split(',').map(s => s.trim()),
        categories: options.categories?.split(',').map(c => c.trim())
      };
      
      const result = await analyzer.analyzeRepository(provider, organization, repository, analysisOptions);
      
      // Output results
      if (options.output) {
        await analyzer.exportResults(result, path.dirname(options.output), 'json');
        console.log(`📄 Results exported to: ${options.output}`);
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n🎯 Codacy Quality Analysis Summary:');
        console.log(`Repository: ${provider}/${organization}/${repository}`);
        console.log(`Branch: ${result.qualityData.analysis?.branch || 'default'}`);
        console.log(`Status: ${result.status}`);
        
        if (result.qualityData.summary) {
          console.log('\n📊 Quality Summary:');
          console.log(`🎖️  Overall Grade: ${result.qualityData.summary.grade}`);
          console.log(`📈 Total Issues: ${result.qualityData.summary.totalIssues}`);
          console.log(`📁 Files Analyzed: ${result.qualityData.summary.totalFiles}`);
          
          const quality = result.qualityData.analysis?.quality || {};
          console.log('\n📋 Quality Metrics:');
          console.log(`🔀 Complexity: ${quality.complexity || 0}%`);
          console.log(`🧪 Coverage: ${quality.coverage || 0}%`);
          console.log(`📋 Duplication: ${quality.duplication || 0}%`);
        }
        
        if (result.qualityData.issues?.length > 0) {
          console.log('\n🚨 Issue Breakdown:');
          const issuesByLevel = result.qualityData.issues.reduce((acc, issue) => {
            acc[issue.level] = (acc[issue.level] || 0) + 1;
            return acc;
          }, {});
          
          console.log(`🔴 Errors: ${issuesByLevel.Error || 0}`);
          console.log(`🟡 Warnings: ${issuesByLevel.Warning || 0}`);
          console.log(`ℹ️  Info: ${issuesByLevel.Info || 0}`);
        }
        
        if (result.cityData) {
          console.log('\n🏙️  City Visualization Data:');
          console.log(`Buildings (files): ${result.cityData.buildings?.length || 0}`);
          console.log(`Districts: ${result.cityData.districts?.length || 0}`);
          console.log(`Quality zones: ${result.cityData.qualityZones?.length || 0}`);
        }
      }
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Issues search command
 */
program
  .command('issues')
  .description('Search issues in a repository')
  .argument('<provider>', 'Git provider (gh, gl, bb)')
  .argument('<organization>', 'Organization name')
  .argument('<repository>', 'Repository name')
  .option('--api-token <token>', 'Codacy API token')
  .option('--severities <levels>', 'Issue severity levels (Error,Warning,Info)', 'Error,Warning')
  .option('--categories <types>', 'Issue categories to include')
  .option('--file-path <path>', 'Filter by file path')
  .option('--limit <number>', 'Maximum issues to retrieve', '100')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (provider, organization, repository, options) => {
    try {
      console.log(`🔍 Searching issues in ${provider}/${organization}/${repository}...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const filters = {
        severities: options.severities?.split(',').map(s => s.trim()),
        categories: options.categories?.split(',').map(c => c.trim()),
        filePath: options.filePath,
        limit: parseInt(options.limit)
      };
      
      const result = await analyzer.searchIssues(provider, organization, repository, filters);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.issues.length} issues:\n`);
        result.issues.forEach((issue, index) => {
          console.log(`${index + 1}. ${issue.patternInfo?.title || 'Quality Issue'}`);
          console.log(`   File: ${issue.filePath}:${issue.line || 0}`);
          console.log(`   Level: ${issue.level}`);
          console.log(`   Category: ${issue.patternInfo?.category || 'Unknown'}`);
          console.log(`   Pattern: ${issue.patternId}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ Issues search failed:', error.message);
      process.exit(1);
    }
  });

/**
 * File metrics command
 */
program
  .command('files')
  .description('Get file-level quality metrics')
  .argument('<provider>', 'Git provider (gh, gl, bb)')
  .argument('<organization>', 'Organization name')
  .argument('<repository>', 'Repository name')
  .option('--api-token <token>', 'Codacy API token')
  .option('--directory <path>', 'Filter by directory path')
  .option('--branch <branch>', 'Branch to analyze')
  .option('--limit <number>', 'Maximum files to retrieve', '100')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (provider, organization, repository, options) => {
    try {
      console.log(`📁 Getting file metrics for ${provider}/${organization}/${repository}...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const fileOptions = {
        directory: options.directory,
        branch: options.branch,
        limit: parseInt(options.limit)
      };
      
      const result = await analyzer.getFileMetrics(provider, organization, repository, fileOptions);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📊 Found ${result.files.length} files:\n`);
        result.files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.path}`);
          console.log(`   Grade: ${file.grade || 'Not graded'}`);
          console.log(`   Issues: ${file.issues || 0}`);
          console.log(`   Complexity: ${file.complexity || 0}`);
          console.log(`   Coverage: ${file.coverage || 0}%`);
          console.log(`   Lines: ${file.linesOfCode || 0}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('❌ File metrics retrieval failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Quality report command
 */
program
  .command('report')
  .description('Generate comprehensive quality report')
  .argument('<provider>', 'Git provider (gh, gl, bb)')
  .argument('<organization>', 'Organization name')
  .argument('<repository>', 'Repository name')
  .option('--api-token <token>', 'Codacy API token')
  .option('--branch <branch>', 'Branch to analyze')
  .option('--directory <path>', 'Specific directory to analyze')
  .option('--output <path>', 'Output file path for report')
  .option('--format <format>', 'Output format (json|summary)', 'summary')
  .action(async (provider, organization, repository, options) => {
    try {
      console.log(`📊 Generating quality report for ${provider}/${organization}/${repository}...`);
      
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      const reportOptions = {
        branch: options.branch,
        directory: options.directory
      };
      
      const result = await analyzer.generateQualityReport(provider, organization, repository, reportOptions);
      
      // Output results
      if (options.output) {
        const reportPath = path.join(path.dirname(options.output), `quality-report-${Date.now()}.json`);
        await fs.writeJson(reportPath, result.report, { spaces: 2 });
        console.log(`📄 Report exported to: ${reportPath}`);
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const report = result.report;
        console.log('\n📋 Quality Report Summary:');
        console.log(`Repository: ${report.repository}`);
        console.log(`Analysis Date: ${new Date(report.analysisDate).toLocaleDateString()}`);
        
        console.log('\n🎯 Executive Summary:');
        console.log(`Overall Grade: ${report.executiveSummary.overallGrade}`);
        console.log(`Quality Score: ${report.executiveSummary.qualityScore}/100`);
        console.log(`Total Issues: ${report.executiveSummary.totalIssues}`);
        console.log(`Files Analyzed: ${report.executiveSummary.totalFiles}`);
        
        console.log('\n📊 Key Metrics:');
        console.log(`Complexity: ${report.executiveSummary.keyMetrics.complexity}%`);
        console.log(`Coverage: ${report.executiveSummary.keyMetrics.coverage}%`);
        console.log(`Duplication: ${report.executiveSummary.keyMetrics.duplication}%`);
        
        if (report.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          report.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Configuration status command
 */
program
  .command('config')
  .description('Show current analyzer configuration and status')
  .option('--api-token <token>', 'Codacy API token')
  .action(async (options) => {
    try {
      const config = getConfig(options);
      const analyzer = new CodacyAnalyzer(config);
      
      // Try to initialize to get full status
      let status;
      try {
        await analyzer.initialize();
        status = analyzer.getStatus();
      } catch (error) {
        status = {
          analyzer: 'codacy',
          version: '1.0.0',
          initialized: false,
          authenticated: false,
          configured: analyzer.isConfigured(),
          error: error.message
        };
      }
      
      console.log('\n⚙️  Codacy Analyzer Configuration:\n');
      console.log(`Analyzer: ${status.analyzer}`);
      console.log(`Version: ${status.version}`);
      console.log(`Initialized: ${status.initialized ? '✅' : '❌'}`);
      console.log(`Authenticated: ${status.authenticated ? '✅' : '❌'}`);
      console.log(`Configured: ${status.configured ? '✅' : '❌'}`);
      
      if (status.configuration) {
        console.log(`Base URL: ${status.configuration.baseUrl}`);
        console.log(`Rate Limit: ${status.configuration.requestsRemaining}/${status.configuration.rateLimit}`);
      }
      
      if (status.capabilities) {
        console.log('\n🎯 Capabilities:');
        console.log(`Analysis Types: ${status.capabilities.analysisTypes.join(', ')}`);
        console.log(`Supported Providers: ${status.capabilities.supportedProviders.join(', ')}`);
        console.log(`Quality Metrics: ${status.capabilities.qualityMetrics.length} available`);
        console.log(`Issue Categories: ${status.capabilities.issueCategories.join(', ')}`);
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
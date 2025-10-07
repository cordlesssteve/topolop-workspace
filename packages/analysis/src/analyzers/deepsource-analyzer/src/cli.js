#!/usr/bin/env node

const { program } = require('commander');
const DeepSourceAnalyzer = require('./index');
const fs = require('fs-extra');
const path = require('path');

/**
 * DeepSource CLI Interface
 * 
 * Provides command-line access to AI-powered code analysis capabilities
 * via DeepSource's GraphQL API integration.
 */

// CLI Configuration
program
  .name('topolop-deepsource')
  .description('DeepSource AI-powered analysis integration for Topolop')
  .version('1.0.0')
  .option('-t, --token <token>', 'DeepSource API token (overrides DEEPSOURCE_TOKEN env var)')
  .option('-f, --format <format>', 'Output format (json|summary)', 'json')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000');

/**
 * Repository Analysis Command
 */
program
  .command('analyze')
  .description('Analyze repository using DeepSource AI analysis')
  .argument('<repository-id>', 'DeepSource repository ID')
  .option('-b, --branch <branch>', 'Specific branch to analyze')
  .option('-l, --limit <number>', 'Maximum number of analysis runs to fetch', '10')
  .option('--include-metrics', 'Include quality and security metrics')
  .option('--include-history', 'Include analysis run history')
  .action(async (repositoryId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Analyzing repository: ${repositoryId}`);
      
      const analysisOptions = {
        branch: options.branch,
        limit: parseInt(options.limit),
        includeMetrics: options.includeMetrics,
        includeHistory: options.includeHistory
      };
      
      const result = await analyzer.analyzeRepository(repositoryId, analysisOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Autofix Suggestions Command
 */
program
  .command('autofix')
  .description('Get AI-powered autofix suggestions for issues')
  .argument('<issue-id>', 'DeepSource issue ID')
  .option('--confidence-threshold <number>', 'Minimum confidence level (0-1)', '0.7')
  .action(async (issueId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Getting autofix suggestions for issue: ${issueId}`);
      
      const suggestions = await analyzer.getAutofixSuggestions(issueId);
      
      if (suggestions && suggestions.available) {
        const confidence = parseFloat(suggestions.confidence || 0);
        const threshold = parseFloat(options.confidenceThreshold);
        
        if (confidence >= threshold) {
          await outputResult({
            issueId,
            autofix: suggestions,
            meetsThreshold: true,
            confidence,
            threshold
          }, program.opts());
        } else {
          await outputResult({
            issueId,
            autofix: suggestions,
            meetsThreshold: false,
            confidence,
            threshold,
            message: `Autofix confidence ${confidence} below threshold ${threshold}`
          }, program.opts());
        }
      } else {
        await outputResult({
          issueId,
          autofix: null,
          message: 'No autofix suggestions available'
        }, program.opts());
      }
      
    } catch (error) {
      console.error(`❌ Autofix fetch failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Repository Search Command
 */
program
  .command('search')
  .description('Search accessible repositories')
  .argument('[search-term]', 'Search term for repository name/description')
  .option('-l, --language <language>', 'Filter by programming language')
  .option('--private', 'Include only private repositories')
  .option('--public', 'Include only public repositories')
  .option('--limit <number>', 'Maximum number of results', '50')
  .action(async (searchTerm, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Searching repositories: ${searchTerm || 'all'}`);
      
      const searchOptions = {
        language: options.language,
        limit: parseInt(options.limit)
      };
      
      if (options.private) searchOptions.isPrivate = true;
      if (options.public) searchOptions.isPrivate = false;
      
      const result = await analyzer.client.searchRepositories(searchTerm, searchOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Search failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Repository Metrics Command
 */
program
  .command('metrics')
  .description('Get repository quality and security metrics')
  .argument('<repository-id>', 'DeepSource repository ID')
  .option('-b, --branch <branch>', 'Specific branch for metrics')
  .option('--from <date>', 'Start date for metrics history (ISO format)')
  .option('--to <date>', 'End date for metrics history (ISO format)')
  .option('--history', 'Include metrics history')
  .action(async (repositoryId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Fetching metrics for repository: ${repositoryId}`);
      
      const metricsOptions = {
        branch: options.branch,
        from: options.from,
        to: options.to
      };
      
      const result = await analyzer.client.getRepositoryMetrics(repositoryId, metricsOptions);
      
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
  .description('Run comprehensive DeepSource analysis with all AI features')
  .argument('<repository-id>', 'DeepSource repository ID')
  .option('-b, --branch <branch>', 'Specific branch to analyze')
  .option('--autofix-threshold <number>', 'Confidence threshold for autofix suggestions', '0.8')
  .option('--max-issues <number>', 'Maximum number of issues to include', '100')
  .action(async (repositoryId, options) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Running comprehensive analysis for repository: ${repositoryId}`);
      
      const analysisOptions = {
        branch: options.branch,
        autofixThreshold: parseFloat(options.autofixThreshold),
        maxIssues: parseInt(options.maxIssues)
      };
      
      const result = await analyzer.comprehensiveAnalysis(repositoryId, analysisOptions);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Comprehensive analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Analysis Run Details Command
 */
program
  .command('run')
  .description('Get detailed analysis run information')
  .argument('<analysis-run-id>', 'DeepSource analysis run ID')
  .action(async (analysisRunId) => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', `Fetching analysis run: ${analysisRunId}`);
      
      const result = await analyzer.client.getAnalysisRun(analysisRunId);
      
      await outputResult(result, program.opts());
      
    } catch (error) {
      console.error(`❌ Analysis run fetch failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Capabilities Command
 */
program
  .command('capabilities')
  .description('Show DeepSource analyzer capabilities and configuration')
  .action(async () => {
    try {
      // Don't require authentication for capabilities
      const analyzer = new DeepSourceAnalyzer(program.opts());
      
      const capabilities = analyzer.getCapabilities();
      const configStatus = {
        apiUrl: 'https://api.deepsource.io/graphql/',
        authenticated: false,
        rateLimit: 5000,
        requestCount: 0,
        requestsRemaining: 5000,
        rateLimitResetTime: new Date(Date.now() + 3600000).toISOString()
      };
      
      const result = {
        capabilities,
        configuration: configStatus,
        integration: {
          layer: 1,
          dataSource: 'DeepSource GraphQL API',
          analysisTypes: ['AI-powered', 'Autofix', 'Quality', 'Security'],
          marketShare: '8.0%',
          tier: 'Tier 1 - Medium Complexity',
          phase: 'Phase 1.5',
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
  .description('Test DeepSource API connection and authentication')
  .action(async () => {
    try {
      const analyzer = await createAnalyzer(program.opts());
      
      log('verbose', 'Testing DeepSource API connection...');
      
      const testResult = await analyzer.client.testConnection();
      
      const result = {
        connection: 'successful',
        authentication: 'valid',
        user: testResult.user,
        userId: testResult.userId,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ DeepSource connection test successful');
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
        tokenEnvVar: 'DEEPSOURCE_TOKEN',
        tokenSet: !!process.env.DEEPSOURCE_TOKEN,
        apiUrl: 'https://api.deepsource.io/graphql/',
        timeout: program.opts().timeout || 30000
      },
      setup: {
        instructions: [
          '1. Create DeepSource account at https://deepsource.io/',
          '2. Generate API token from account settings',
          '3. Set environment variable: export DEEPSOURCE_TOKEN=your_token',
          '4. Test connection: topolop-deepsource test'
        ]
      },
      capabilities: {
        aiPowered: true,
        autofixSuggestions: true,
        qualityAnalysis: true,
        securityAnalysis: true,
        metricsHistory: true,
        graphqlApi: true
      }
    };
    
    await outputResult(result, program.opts());
  });

/**
 * Create analyzer instance with configuration
 */
async function createAnalyzer(options) {
  const config = {
    timeout: parseInt(options.timeout)
  };
  
  if (options.token) {
    config.token = options.token;
  }
  
  const analyzer = new DeepSourceAnalyzer(config);
  
  // Test authentication on creation
  try {
    await analyzer.client.initialize();
  } catch (error) {
    if (error.message.includes('token required')) {
      console.error('❌ DeepSource authentication required.');
      console.error('Set DEEPSOURCE_TOKEN environment variable or use --token option.');
      console.error('Run "topolop-deepsource config" for setup instructions.');
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
  if (result.repository) {
    let summary = `\n📊 DeepSource Analysis Summary\n`;
    summary += `Repository: ${result.repository.name || result.repository.fullName}\n`;
    
    if (result.analysisRuns && result.analysisRuns.edges.length > 0) {
      const latestRun = result.analysisRuns.edges[0].node;
      summary += `Latest Analysis: ${latestRun.branch} (${latestRun.status})\n`;
      summary += `Issues: ${latestRun.summary?.issuesIntroduced || 0} introduced, ${latestRun.summary?.issuesResolved || 0} resolved\n`;
      
      if (latestRun.metrics) {
        if (latestRun.metrics.quality) {
          summary += `Quality Grade: ${latestRun.metrics.quality.grade} (${latestRun.metrics.quality.value})\n`;
        }
        if (latestRun.metrics.security) {
          summary += `Security Grade: ${latestRun.metrics.security.grade} (${latestRun.metrics.security.value})\n`;
        }
        if (latestRun.metrics.coverage) {
          summary += `Coverage: ${latestRun.metrics.coverage.percentage}%\n`;
        }
      }
    }
    
    return summary;
  }
  
  if (result.autofix) {
    let summary = `\n🔧 DeepSource Autofix Summary\n`;
    summary += `Available: ${result.autofix.available ? 'Yes' : 'No'}\n`;
    if (result.autofix.available) {
      summary += `Title: ${result.autofix.title}\n`;
      summary += `Confidence: ${result.confidence || 'Unknown'}\n`;
      summary += `Description: ${result.autofix.description}\n`;
    }
    return summary;
  }
  
  if (result.repositories) {
    let summary = `\n📁 Repository Search Results (${result.repositories.length})\n`;
    result.repositories.slice(0, 10).forEach(repo => {
      summary += `- ${repo.fullName} (${repo.language?.name || 'Unknown'})\n`;
    });
    return summary;
  }
  
  return JSON.stringify(result, null, 2);
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
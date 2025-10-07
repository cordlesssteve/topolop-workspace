#!/usr/bin/env node

/**
 * DataDog APM CLI Interface for Topolop
 *
 * Command-line interface for DataDog Application Performance Monitoring.
 * Provides direct access to DataDog APM adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node datadog-cli.js [options] <service-name>
 *   node datadog-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');

// Note: Using CommonJS require for the compiled adapter
const DataDogAdapter = require('../dist/datadog-adapter.js').DataDogAdapter;

class DataDogCLI {
    constructor() {
        this.adapter = new DataDogAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('datadog-cli')
            .description('DataDog APM performance monitoring and analysis')
            .version('1.0.0')
            .argument('<service-name>', 'Name of the service to analyze')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site (datadoghq.com, datadoghq.eu, etc.)', 'datadoghq.com')
            .option('--time-range <hours>', 'Time range in hours (default: 1)', '1')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '30000')
            .action(async (serviceName, options) => {
                await this.runAnalysis(serviceName, options);
            });

        this.program
            .command('services')
            .description('List available DataDog services')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site', 'datadoghq.com')
            .action(async (options) => {
                await this.listServices(options);
            });

        this.program
            .command('metrics')
            .description('Show available DataDog metrics for a service')
            .argument('<service-name>', 'Service name')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site', 'datadoghq.com')
            .option('--time-range <hours>', 'Time range in hours', '1')
            .action(async (serviceName, options) => {
                await this.showMetrics(serviceName, options);
            });

        this.program
            .command('errors')
            .description('Show recent errors for a service')
            .argument('<service-name>', 'Service name')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site', 'datadoghq.com')
            .option('--time-range <hours>', 'Time range in hours', '1')
            .option('--limit <n>', 'Maximum number of errors to show', '10')
            .action(async (serviceName, options) => {
                await this.showErrors(serviceName, options);
            });

        this.program
            .command('traces')
            .description('Show recent traces for a service')
            .argument('<service-name>', 'Service name')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site', 'datadoghq.com')
            .option('--time-range <hours>', 'Time range in hours', '1')
            .option('--limit <n>', 'Maximum number of traces to show', '10')
            .option('--slow-only', 'Show only slow traces (>1s)')
            .action(async (serviceName, options) => {
                await this.showTraces(serviceName, options);
            });

        this.program
            .command('check')
            .description('Check DataDog API connectivity')
            .option('--api-key <key>', 'DataDog API key')
            .option('--app-key <key>', 'DataDog application key')
            .option('--site <site>', 'DataDog site', 'datadoghq.com')
            .action(async (options) => {
                await this.checkConnection(options);
            });

        this.program
            .command('version')
            .description('Show DataDog CLI version information')
            .action(() => {
                this.showVersion();
            });
    }

    async runAnalysis(serviceName, options) {
        try {
            // Get API credentials
            const config = await this.getConfig(options);

            if (options.verbose) {
                console.log(`🔬 Starting DataDog APM analysis for service: ${serviceName}`);
                console.log(`⚙️  Configuration: site=${config.site}, timeRange=${options.timeRange}h`);
            }

            // Initialize adapter
            await this.adapter.initialize(config);

            // Calculate time range
            const timeRange = this.calculateTimeRange(parseInt(options.timeRange, 10));

            // Run analysis
            const startTime = Date.now();
            const result = await this.adapter.getPerformanceMetrics(serviceName, timeRange);
            const duration = Date.now() - startTime;

            // Display results
            await this.displayResults(result, options, duration, serviceName);

            // Exit with appropriate code based on issues found
            const hasHighSeverityIssues = result.some(issue => issue.severity === 'high' || issue.severity === 'critical');
            process.exit(hasHighSeverityIssues ? 1 : 0);

        } catch (error) {
            this.printError(`Analysis failed: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async listServices(options) {
        try {
            const config = await this.getConfig(options);
            await this.adapter.initialize(config);

            console.log('📋 DataDog Services');
            console.log('═'.repeat(50));

            // Note: This would need to be implemented in the adapter
            // For now, show a message about using the main analysis command
            console.log('Use the main analysis command with a service name to analyze specific services.');
            console.log('Example: datadog-cli my-service --api-key YOUR_KEY --app-key YOUR_APP_KEY');

        } catch (error) {
            this.printError(`Failed to list services: ${error.message}`);
            process.exit(1);
        }
    }

    async showMetrics(serviceName, options) {
        try {
            const config = await this.getConfig(options);
            await this.adapter.initialize(config);

            const timeRange = this.calculateTimeRange(parseInt(options.timeRange, 10));

            console.log(`📊 DataDog Metrics for ${serviceName}`);
            console.log('═'.repeat(50));

            // Run analysis to get metrics data
            const results = await this.adapter.getPerformanceMetrics(serviceName, timeRange);

            if (results.length === 0) {
                console.log('✅ No performance issues found - service is healthy');
                return;
            }

            // Group metrics by category
            const metricsByCategory = {};
            results.forEach(issue => {
                const category = issue.performanceCategory || 'other';
                if (!metricsByCategory[category]) {
                    metricsByCategory[category] = [];
                }
                metricsByCategory[category].push(issue);
            });

            Object.entries(metricsByCategory).forEach(([category, issues]) => {
                console.log(`\n📈 ${category.toUpperCase().replace('_', ' ')}`);
                console.log('─'.repeat(30));

                issues.forEach(issue => {
                    console.log(`  ${this.getSeverityIcon(issue.severity)} ${issue.title}`);
                    if (issue.performanceMetrics) {
                        Object.entries(issue.performanceMetrics).forEach(([key, value]) => {
                            if (typeof value === 'number') {
                                console.log(`    ${key}: ${value.toFixed(2)}`);
                            }
                        });
                    }
                });
            });

        } catch (error) {
            this.printError(`Failed to show metrics: ${error.message}`);
            process.exit(1);
        }
    }

    async showErrors(serviceName, options) {
        try {
            const config = await this.getConfig(options);
            await this.adapter.initialize(config);

            const timeRange = this.calculateTimeRange(parseInt(options.timeRange, 10));
            const limit = parseInt(options.limit, 10);

            console.log(`🚨 DataDog Errors for ${serviceName}`);
            console.log('═'.repeat(50));

            // Run analysis to get error data
            const results = await this.adapter.getPerformanceMetrics(serviceName, timeRange);
            const errorIssues = results.filter(issue =>
                issue.performanceCategory === 'availability' ||
                issue.ruleId?.includes('error')
            ).slice(0, limit);

            if (errorIssues.length === 0) {
                console.log('✅ No error issues found');
                return;
            }

            errorIssues.forEach((error, index) => {
                console.log(`\n${index + 1}. ${this.getSeverityIcon(error.severity)} ${error.title}`);
                console.log(`   📝 ${error.description}`);

                if (error.performanceMetrics?.errorRate) {
                    console.log(`   📊 Error Rate: ${error.performanceMetrics.errorRate.toFixed(2)}%`);
                }

                if (error.optimizationOpportunity) {
                    console.log(`   💡 ${error.optimizationOpportunity.potentialImprovement}`);
                }
            });

        } catch (error) {
            this.printError(`Failed to show errors: ${error.message}`);
            process.exit(1);
        }
    }

    async showTraces(serviceName, options) {
        try {
            const config = await this.getConfig(options);
            await this.adapter.initialize(config);

            const timeRange = this.calculateTimeRange(parseInt(options.timeRange, 10));
            const limit = parseInt(options.limit, 10);

            console.log(`🔍 DataDog Traces for ${serviceName}`);
            console.log('═'.repeat(50));

            // Run analysis to get trace data
            const results = await this.adapter.getPerformanceMetrics(serviceName, timeRange);
            let traceIssues = results.filter(issue =>
                issue.ruleId?.includes('trace') ||
                issue.performanceCategory === 'response_time'
            );

            if (options.slowOnly) {
                traceIssues = traceIssues.filter(issue =>
                    issue.performanceMetrics?.responseTime > 1000
                );
            }

            traceIssues = traceIssues.slice(0, limit);

            if (traceIssues.length === 0) {
                console.log(options.slowOnly ? '✅ No slow traces found' : '✅ No trace issues found');
                return;
            }

            traceIssues.forEach((trace, index) => {
                console.log(`\n${index + 1}. ${this.getSeverityIcon(trace.severity)} ${trace.title}`);
                console.log(`   📝 ${trace.description}`);

                if (trace.performanceMetrics?.responseTime) {
                    console.log(`   ⏱️  Duration: ${Math.round(trace.performanceMetrics.responseTime)}ms`);
                }

                if (trace.performanceMetrics?.traceId) {
                    console.log(`   🔗 Trace ID: ${trace.performanceMetrics.traceId}`);
                }
            });

        } catch (error) {
            this.printError(`Failed to show traces: ${error.message}`);
            process.exit(1);
        }
    }

    async checkConnection(options) {
        try {
            const config = await this.getConfig(options);

            console.log('🔍 Checking DataDog API connectivity...');

            await this.adapter.initialize(config);

            console.log('✅ DataDog API connectivity verified');
            console.log(`🌐 Site: ${config.site}`);
            console.log('📊 APM monitoring ready');

        } catch (error) {
            this.printError(`DataDog API connection failed: ${error.message}`);
            console.log('\n📦 To fix this issue:');
            console.log('   1. Verify your API key and application key');
            console.log('   2. Ensure you have APM access in DataDog');
            console.log('   3. Check your network connection');
            console.log('   4. Verify the correct DataDog site (US: datadoghq.com, EU: datadoghq.eu)');
            process.exit(1);
        }
    }

    showVersion() {
        console.log('📊 DataDog APM CLI v1.0.0');
        console.log('🔧 Application Performance Monitoring integration for Topolop');
        console.log('📋 Real-time performance analysis, error tracking, and distributed tracing');
    }

    async displayResults(results, options, duration, serviceName) {
        switch (options.format) {
            case 'json':
                console.log(JSON.stringify(results, null, 2));
                break;

            case 'summary':
                this.displaySummary(results, duration, serviceName);
                break;

            case 'table':
            default:
                this.displayTable(results, options, duration, serviceName);
                break;
        }
    }

    displaySummary(results, duration, serviceName) {
        console.log('📊 DataDog APM Performance Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`🎯 Service: ${serviceName}`);
        console.log(`🔍 Issues Found: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: DataDog APM`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No performance issues detected! Service is healthy!');
            return;
        }

        // Categorize issues
        const issuesByCategory = {};
        const issuesBySeverity = {};

        results.forEach(issue => {
            const category = issue.performanceCategory || 'other';
            const severity = issue.severity || 'medium';

            issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;
            issuesBySeverity[severity] = (issuesBySeverity[severity] || 0) + 1;
        });

        console.log('📈 Issues by Category:');
        Object.entries(issuesByCategory).forEach(([category, count]) => {
            console.log(`   ${this.getCategoryIcon(category)} ${category}: ${count}`);
        });

        console.log('\n🚨 Issues by Severity:');
        Object.entries(issuesBySeverity).forEach(([severity, count]) => {
            console.log(`   ${this.getSeverityIcon(severity)} ${severity}: ${count}`);
        });
    }

    displayTable(results, options, duration, serviceName) {
        // Header
        console.log('📊 DataDog APM Performance Analysis Results');
        console.log('═'.repeat(80));
        console.log(`🎯 Service: ${serviceName}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Issues: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No performance issues detected! Your service is performing well!');
            return;
        }

        // Group issues by category for better organization
        const issuesByCategory = {};
        results.forEach(issue => {
            const category = issue.performanceCategory || 'other';
            if (!issuesByCategory[category]) {
                issuesByCategory[category] = [];
            }
            issuesByCategory[category].push(issue);
        });

        // Display each category
        Object.entries(issuesByCategory).forEach(([category, categoryIssues]) => {
            console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase().replace(/_/g, ' ')} (${categoryIssues.length} issues)`);
            console.log('─'.repeat(80));

            categoryIssues.forEach((issue, index) => {
                const severity = this.formatSeverity(issue.severity, options.noColor);

                console.log(`${index + 1}. ${severity} ${issue.title}`);
                console.log(`   📝 ${issue.description}`);

                if (issue.performanceMetrics) {
                    const metrics = [];
                    if (issue.performanceMetrics.responseTime) {
                        metrics.push(`Response: ${Math.round(issue.performanceMetrics.responseTime)}ms`);
                    }
                    if (issue.performanceMetrics.errorRate) {
                        metrics.push(`Error Rate: ${issue.performanceMetrics.errorRate.toFixed(2)}%`);
                    }
                    if (issue.performanceMetrics.throughput) {
                        metrics.push(`Throughput: ${issue.performanceMetrics.throughput.toFixed(1)}/min`);
                    }
                    if (issue.performanceMetrics.availabilityScore) {
                        metrics.push(`Availability: ${issue.performanceMetrics.availabilityScore.toFixed(1)}%`);
                    }

                    if (metrics.length > 0) {
                        console.log(`   📊 ${metrics.join(' | ')}`);
                    }
                }

                if (issue.optimizationOpportunity && options.verbose) {
                    console.log(`   💡 ${issue.optimizationOpportunity.potentialImprovement}`);
                    console.log(`   🔧 Effort: ${issue.optimizationOpportunity.effort} | Priority: ${issue.optimizationOpportunity.priority}`);
                }

                console.log('');
            });
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(results, duration, serviceName);
    }

    getCategoryIcon(category) {
        const icons = {
            'response_time': '⏱️',
            'availability': '🟢',
            'loading': '📊',
            'memory': '💾',
            'cpu': '🔲',
            'other': '📋'
        };
        return icons[category] || '📋';
    }

    getSeverityIcon(severity) {
        const icons = {
            'critical': '🔥',
            'high': '🚨',
            'medium': '⚠️',
            'low': 'ℹ️'
        };
        return icons[severity] || '📋';
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity?.toUpperCase() || 'UNKNOWN'}]`;
        }

        const colors = {
            critical: '\x1b[35m',   // Magenta
            high: '\x1b[31m',       // Red
            medium: '\x1b[33m',     // Yellow
            low: '\x1b[36m',        // Cyan
            reset: '\x1b[0m'        // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity?.toUpperCase() || 'UNKNOWN'}]${colors.reset}`;
    }

    calculateTimeRange(hours) {
        const end = new Date();
        const start = new Date(end.getTime() - (hours * 60 * 60 * 1000));
        return { start, end };
    }

    async getConfig(options) {
        const config = {
            apiKey: options.apiKey || process.env.DATADOG_API_KEY,
            appKey: options.appKey || process.env.DATADOG_APP_KEY,
            site: options.site || 'datadoghq.com',
            timeout: parseInt(options.timeout, 10)
        };

        if (!config.apiKey) {
            throw new Error('DataDog API key is required. Use --api-key or set DATADOG_API_KEY environment variable');
        }

        if (!config.appKey) {
            throw new Error('DataDog application key is required. Use --app-key or set DATADOG_APP_KEY environment variable');
        }

        return config;
    }

    printError(message) {
        console.error(`❌ ${message}`);
    }

    async run() {
        await this.program.parseAsync();
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new DataDogCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = DataDogCLI;
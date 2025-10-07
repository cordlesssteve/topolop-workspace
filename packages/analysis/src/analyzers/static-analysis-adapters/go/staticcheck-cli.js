#!/usr/bin/env node

/**
 * Staticcheck CLI Interface for Topolop
 * 
 * Command-line interface for Go static analysis using Staticcheck.
 * Provides direct access to staticcheck adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node staticcheck-cli.js [options] <project-path>
 *   node staticcheck-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const StaticcheckAdapter = require('./staticcheck-adapter');

class StaticcheckCLI {
    constructor() {
        this.adapter = new StaticcheckAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('staticcheck-cli')
            .description('Go static analysis using Staticcheck')
            .version('1.0.0')
            .arguments('<project-path>')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('-c, --checks <checks>', 'Comma-separated list of checks to run (e.g., SA1000,SA1001)', '')
            .option('-i, --ignore <checks>', 'Comma-separated list of checks to ignore', '')
            .option('--all-checks', 'Run all available staticcheck checks')
            .option('--unused', 'Include unused code detection')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '240000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Staticcheck is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show Staticcheck installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show Staticcheck version information')
            .action(async () => {
                await this.showVersion();
            });

        this.program
            .command('list-checks')
            .description('List available Staticcheck rules')
            .action(() => {
                this.listAvailableChecks();
            });
    }

    async runAnalysis(projectPath, options) {
        try {
            // Validate project path
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🔍 Starting Staticcheck analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                timeout: parseInt(options.timeout, 10),
                allChecks: options.allChecks,
                includeUnused: options.unused
            };

            // Add specific checks if provided
            if (options.checks) {
                analysisOptions.specificChecks = options.checks.split(',').map(c => c.trim());
            }

            // Add ignored checks if provided
            if (options.ignore) {
                analysisOptions.ignoreChecks = options.ignore.split(',').map(c => c.trim());
            }

            // Run analysis
            const startTime = Date.now();
            const result = await this.adapter.analyze(resolvedPath, analysisOptions);
            const duration = Date.now() - startTime;

            // Check for errors
            if (result.error) {
                this.printError(`Analysis failed: ${result.error}`);
                process.exit(1);
            }

            // Format and display results
            await this.displayResults(result, options, duration);

            // Exit with appropriate code
            const hasCriticalIssues = result.results?.some(r => r.category === 'bug' && r.severity === 'high');
            process.exit(hasCriticalIssues ? 1 : 0);

        } catch (error) {
            this.printError(`CLI Error: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async validateProjectPath(projectPath) {
        try {
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory()) {
                throw new Error('Project path must be a directory');
            }

            // Check for go.mod or .go files
            const hasGoMod = await fs.access(path.join(projectPath, 'go.mod')).then(() => true).catch(() => false);
            if (!hasGoMod) {
                // Check for .go files
                const entries = await fs.readdir(projectPath);
                const hasGoFiles = entries.some(entry => entry.endsWith('.go'));
                if (!hasGoFiles) {
                    console.warn('⚠️  No go.mod or .go files found - this may not be a Go project');
                }
            }
        } catch (error) {
            throw new Error(`Invalid project path: ${error.message}`);
        }
    }

    async displayResults(result, options, duration) {
        const { results = [], metadata = {} } = result;

        switch (options.format) {
            case 'json':
                console.log(JSON.stringify(result, null, 2));
                break;

            case 'summary':
                this.displaySummary(result, duration);
                break;

            case 'table':
            default:
                this.displayTable(result, options, duration);
                break;
        }
    }

    displaySummary(result, duration) {
        const { results = [], metadata = {} } = result;
        
        console.log('🔍 Staticcheck Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`📊 Total Issues: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool Version: ${result.version || 'unknown'}`);
        console.log('');

        if (metadata.totalIssues > 0) {
            console.log('📈 Issue Breakdown:');
            console.log(`   Bugs:        ${metadata.bugCount || 0}`);
            console.log(`   Performance: ${metadata.performanceCount || 0}`);
            console.log(`   Style:       ${metadata.styleCount || 0}`);
            console.log(`   Unused:      ${metadata.unusedCount || 0}`);
            console.log(`   Deprecated:  ${metadata.deprecatedCount || 0}`);
        } else {
            console.log('✅ No issues found! Your Go code looks excellent!');
        }
    }

    displayTable(result, options, duration) {
        const { results = [], metadata = {} } = result;

        // Header
        console.log('🔍 Staticcheck Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Issues: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No issues found! Your Go code follows excellent practices!');
            console.log('');
            console.log('💡 Tips:');
            console.log('   • Run staticcheck regularly as part of your build process');
            console.log('   • Consider using golangci-lint for comprehensive linting');
            console.log('   • Keep your Go version updated for latest static analysis');
            return;
        }

        // Group issues by category
        const categorized = this.categorizeIssues(results);

        for (const [category, issues] of Object.entries(categorized)) {
            if (issues.length === 0) continue;

            console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase()} (${issues.length} issues)`);
            console.log('─'.repeat(80));

            issues.slice(0, 10).forEach((issue, index) => { // Limit to first 10 per category
                const severity = this.formatSeverity(issue.severity, options.noColor);
                const location = `${issue.file}:${issue.line}:${issue.column}`;
                
                console.log(`${index + 1}. ${severity} ${issue.title}`);
                console.log(`   📍 ${location}`);
                
                if (issue.metadata?.rule) {
                    console.log(`   📋 Rule: ${issue.metadata.rule}`);
                }
                
                if (issue.metadata?.message && issue.metadata.message !== issue.title) {
                    console.log(`   💬 ${issue.metadata.message}`);
                }
                
                if (issue.metadata?.suggestion) {
                    console.log(`   💡 ${issue.metadata.suggestion}`);
                }
                console.log('');
            });

            if (issues.length > 10) {
                console.log(`   ... and ${issues.length - 10} more ${category} issues`);
                console.log('');
            }
        }

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    categorizeIssues(results) {
        const categories = {
            bug: [],
            performance: [],
            style: [],
            unused: [],
            deprecated: [],
            other: []
        };

        results.forEach(issue => {
            const category = issue.category || 'other';
            if (categories[category]) {
                categories[category].push(issue);
            } else {
                categories.other.push(issue);
            }
        });

        return categories;
    }

    getCategoryIcon(category) {
        const icons = {
            bug: '🐛',
            performance: '🚀',
            style: '✨',
            unused: '🗑️',
            deprecated: '⚠️',
            other: '📋'
        };
        return icons[category] || '📋';
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity.toUpperCase()}]`;
        }

        const colors = {
            high: '\x1b[31m',      // Red
            medium: '\x1b[33m',    // Yellow
            low: '\x1b[36m',       // Cyan
            reset: '\x1b[0m'       // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity.toUpperCase()}]${colors.reset}`;
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Staticcheck availability...');
            await this.adapter.checkToolAvailability();
            const version = await this.adapter.getToolVersion();
            console.log(`✅ Staticcheck is available (version: ${version})`);
        } catch (error) {
            console.log(`❌ Staticcheck is not available: ${error.message}`);
            console.log('\n📦 To install Staticcheck:');
            console.log('   go install honnef.co/go/tools/cmd/staticcheck@latest');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        const instructions = this.adapter.getInstallationInstructions();
        
        console.log('📦 Staticcheck Installation Instructions');
        console.log('═'.repeat(50));
        console.log('');

        instructions.instructions.forEach((instruction, index) => {
            console.log(`${index + 1}. ${instruction}`);
        });

        console.log('\n📋 Requirements:');
        instructions.requirements.forEach(req => {
            console.log(`   • ${req}`);
        });

        console.log('\n💡 Notes:');
        instructions.notes.forEach(note => {
            console.log(`   • ${note}`);
        });
    }

    async showVersion() {
        try {
            const version = await this.adapter.getToolVersion();
            console.log(`🔍 Staticcheck CLI v1.0.0`);
            console.log(`🔧 Staticcheck version: ${version}`);
        } catch (error) {
            console.log(`🔍 Staticcheck CLI v1.0.0`);
            console.log(`❌ Staticcheck not available: ${error.message}`);
        }
    }

    listAvailableChecks() {
        console.log('📋 Staticcheck Check Categories');
        console.log('═'.repeat(50));
        console.log('');
        
        const checkCategories = {
            'SA': 'Static analysis checks - potential bugs and issues',
            'S': 'Stylistic issues - code style and formatting',
            'ST': 'Code organization and naming conventions',
            'U': 'Unused code detection',
            'QF': 'Quick fixes and suggestions'
        };

        Object.entries(checkCategories).forEach(([prefix, description]) => {
            console.log(`${prefix}*: ${description}`);
        });

        console.log('');
        console.log('💡 Common specific checks:');
        console.log('   SA1000: Invalid regular expression');
        console.log('   SA1001: Invalid template');
        console.log('   SA1002: Invalid format string');
        console.log('   SA1003: Unsupported argument to time.Time.Format');
        console.log('   SA4000: Boolean expression has identical expressions on both sides');
        console.log('   SA4001: &*x will be simplified to x');
        console.log('   ST1000: Package comment should be present');
        console.log('   U1000: Unused function, variable, constant or type');
        console.log('');
        console.log('🔧 Usage:');
        console.log('   --checks SA1000,SA1001  # Run specific checks');
        console.log('   --ignore U1000          # Ignore specific checks');
        console.log('   --all-checks            # Run all available checks');
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
    const cli = new StaticcheckCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = StaticcheckCLI;
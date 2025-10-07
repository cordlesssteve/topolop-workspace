#!/usr/bin/env node

/**
 * Clippy CLI Interface for Topolop
 * 
 * Command-line interface for Rust static analysis using Clippy.
 * Provides direct access to clippy adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node clippy-cli.js [options] <project-path>
 *   node clippy-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const ClippyAdapter = require('./clippy-adapter');

class ClippyCLI {
    constructor() {
        this.adapter = new ClippyAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('clippy-cli')
            .description('Rust static analysis using Clippy')
            .version('1.0.0')
            .argument('<project-path>', 'Path to Rust project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('-s, --strict', 'Enable strict mode with additional lints')
            .option('--allow-deprecated', 'Allow deprecated code without warnings')
            .option('-c, --categories <categories>', 'Comma-separated list of categories to include', '')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '180000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Clippy is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show Clippy installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show Clippy version information')
            .action(async () => {
                await this.showVersion();
            });
    }

    async runAnalysis(projectPath, options) {
        try {
            // Validate project path
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🦀 Starting Clippy analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                strictMode: options.strict,
                allowDeprecated: options.allowDeprecated,
                timeout: parseInt(options.timeout, 10)
            };

            // Add category filtering if specified
            if (options.categories) {
                analysisOptions.categories = options.categories.split(',').map(c => c.trim());
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
            const hasHighSeverityIssues = result.results?.some(r => r.severity === 'high');
            process.exit(hasHighSeverityIssues ? 1 : 0);

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
        
        console.log('🦀 Clippy Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`📊 Total Issues: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool Version: ${result.version || 'unknown'}`);
        console.log('');

        if (metadata.totalIssues > 0) {
            console.log('📈 Issue Breakdown:');
            console.log(`   Correctness: ${metadata.correctnessCount || 0}`);
            console.log(`   Performance: ${metadata.performanceCount || 0}`);
            console.log(`   Complexity:  ${metadata.complexityCount || 0}`);
            console.log(`   Style:       ${metadata.styleCount || 0}`);
            console.log(`   Suspicious:  ${metadata.suspiciousCount || 0}`);
        } else {
            console.log('✅ No issues found! Great work!');
        }
    }

    displayTable(result, options, duration) {
        const { results = [], metadata = {} } = result;

        // Header
        console.log('🦀 Clippy Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Issues: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No issues found! Your Rust code looks great!');
            return;
        }

        // Group issues by category
        const categorized = this.categorizeIssues(results);

        for (const [category, issues] of Object.entries(categorized)) {
            if (issues.length === 0) continue;

            console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase()} (${issues.length} issues)`);
            console.log('─'.repeat(80));

            issues.forEach((issue, index) => {
                const severity = this.formatSeverity(issue.severity, options.noColor);
                const location = `${issue.file}:${issue.line}:${issue.column}`;
                
                console.log(`${index + 1}. ${severity} ${issue.title}`);
                console.log(`   📍 ${location}`);
                if (issue.metadata?.help) {
                    console.log(`   💡 ${issue.metadata.help}`);
                }
                if (issue.metadata?.suggestion) {
                    console.log(`   🔧 Suggestion: ${issue.metadata.suggestion.replacement}`);
                }
                console.log('');
            });
        }

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    categorizeIssues(results) {
        const categories = {
            correctness: [],
            performance: [],
            complexity: [],
            suspicious: [],
            style: []
        };

        results.forEach(issue => {
            const category = issue.category || 'style';
            if (categories[category]) {
                categories[category].push(issue);
            } else {
                categories.style.push(issue);
            }
        });

        return categories;
    }

    getCategoryIcon(category) {
        const icons = {
            correctness: '🚨',
            performance: '🚀',
            complexity: '🧠',
            suspicious: '🤔',
            style: '✨'
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
            console.log('🔍 Checking Clippy availability...');
            await this.adapter.checkToolAvailability();
            const version = await this.adapter.getToolVersion();
            console.log(`✅ Clippy is available (version: ${version})`);
        } catch (error) {
            console.log(`❌ Clippy is not available: ${error.message}`);
            console.log('\n📦 To install Clippy, run:');
            console.log('   rustup component add clippy');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        const instructions = this.adapter.getInstallationInstructions();
        
        console.log('📦 Clippy Installation Instructions');
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
            console.log(`🦀 Clippy CLI v1.0.0`);
            console.log(`🔧 Clippy version: ${version}`);
        } catch (error) {
            console.log(`🦀 Clippy CLI v1.0.0`);
            console.log(`❌ Clippy not available: ${error.message}`);
        }
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
    const cli = new ClippyCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = ClippyCLI;
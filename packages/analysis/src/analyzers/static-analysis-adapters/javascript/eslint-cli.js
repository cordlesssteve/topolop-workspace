#!/usr/bin/env node

/**
 * ESLint CLI Interface for Topolop
 *
 * Command-line interface for JavaScript/TypeScript static analysis using ESLint.
 * Provides direct access to ESLint adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node eslint-cli.js [options] <project-path>
 *   node eslint-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const eslintAdapter = require('./eslint-adapter');

class ESLintCLI {
    constructor() {
        this.adapter = eslintAdapter;
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('eslint-cli')
            .description('JavaScript/TypeScript static analysis using ESLint')
            .version('1.0.0')
            .argument('<project-path>', 'Path to JavaScript/TypeScript project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--security-only', 'Show only security-related issues')
            .option('--no-warnings', 'Hide warnings, show only errors')
            .option('-r, --rules <rules>', 'Comma-separated list of specific rules to check', '')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--fix-suggestions', 'Include fix suggestions where available')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '120000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if ESLint is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('rules')
            .description('List available security and quality rules')
            .action(() => {
                this.showAvailableRules();
            });

        this.program
            .command('config')
            .description('Show current ESLint configuration')
            .action(() => {
                this.showConfiguration();
            });

        this.program
            .command('version')
            .description('Show ESLint version information')
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
                console.log(`🔍 Starting ESLint analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                securityOnly: options.securityOnly,
                hideWarnings: !options.warnings,
                timeout: parseInt(options.timeout, 10),
                fixSuggestions: options.fixSuggestions
            };

            // Add rule filtering if specified
            if (options.rules) {
                analysisOptions.specificRules = options.rules.split(',').map(r => r.trim());
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

            // Exit with appropriate code based on severity
            const hasErrors = result.results?.some(r => r.errorCount > 0);
            process.exit(hasErrors ? 1 : 0);

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
        const { results = [], summary = {} } = result;

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
        const { results = [], summary = {} } = result;

        console.log('🔍 ESLint Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`📊 Files Analyzed: ${summary.totalFiles || 0}`);
        console.log(`⚠️  Total Issues: ${summary.totalIssues || 0}`);
        console.log(`🚨 Errors: ${summary.totalErrors || 0}`);
        console.log(`⚡ Warnings: ${summary.totalWarnings || 0}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: ESLint ${result.version || 'unknown'}`);
        console.log('');

        if (summary.totalIssues > 0) {
            console.log('📈 Top Rule Violations:');
            (summary.topViolatedRules || []).slice(0, 5).forEach(rule => {
                console.log(`   ${rule.rule}: ${rule.count} violations`);
            });

            if (summary.filesWithIssues > 0) {
                console.log(`\n📁 Files with Issues: ${summary.filesWithIssues}/${summary.totalFiles}`);
            }
        } else {
            console.log('✅ No issues found! Great JavaScript/TypeScript code!');
        }
    }

    displayTable(result, options, duration) {
        const { results = [], summary = {} } = result;

        // Header
        console.log('🔍 ESLint Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.codebasePath || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Files: ${summary.totalFiles || 0} | Issues: ${summary.totalIssues || 0}`);
        console.log('');

        if (!results.length || summary.totalIssues === 0) {
            console.log('✅ No issues found! Your JavaScript/TypeScript code looks great!');
            return;
        }

        // Process results by file
        results.forEach((fileResult, fileIndex) => {
            if (!fileResult.messages || fileResult.messages.length === 0) return;

            const filename = path.basename(fileResult.filePath);
            const relativePath = path.relative(process.cwd(), fileResult.filePath);

            console.log(`\n📄 ${filename} (${relativePath})`);
            console.log('─'.repeat(80));

            // Group messages by severity
            const errors = fileResult.messages.filter(m => m.severity === 2);
            const warnings = fileResult.messages.filter(m => m.severity === 1);

            // Display errors first
            if (errors.length > 0) {
                console.log(`🚨 ERRORS (${errors.length})`);
                errors.forEach((msg, index) => {
                    const severity = this.formatSeverity('error', options.noColor);
                    console.log(`  ${index + 1}. ${severity} ${msg.message}`);
                    console.log(`     📍 Line ${msg.line}:${msg.column}`);
                    console.log(`     🏷️  Rule: ${msg.ruleId || 'unknown'}`);
                    if (msg.nodeType) {
                        console.log(`     🔧 Node: ${msg.nodeType}`);
                    }
                    if (options.fixSuggestions && msg.suggestions) {
                        console.log(`     💡 Fix available`);
                    }
                    console.log('');
                });
            }

            // Display warnings if not hidden
            if (warnings.length > 0 && options.warnings !== false) {
                console.log(`⚠️  WARNINGS (${warnings.length})`);
                warnings.forEach((msg, index) => {
                    const severity = this.formatSeverity('warning', options.noColor);
                    console.log(`  ${index + 1}. ${severity} ${msg.message}`);
                    console.log(`     📍 Line ${msg.line}:${msg.column}`);
                    console.log(`     🏷️  Rule: ${msg.ruleId || 'unknown'}`);
                    if (msg.nodeType) {
                        console.log(`     🔧 Node: ${msg.nodeType}`);
                    }
                    console.log('');
                });
            }
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity.toUpperCase()}]`;
        }

        const colors = {
            error: '\x1b[31m',      // Red
            warning: '\x1b[33m',    // Yellow
            info: '\x1b[36m',       // Cyan
            reset: '\x1b[0m'        // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity.toUpperCase()}]${colors.reset}`;
    }

    async checkTool() {
        try {
            console.log('🔍 Checking ESLint availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ ESLint is available');
                // Try to get version if possible
                try {
                    console.log('🔧 Configuration ready for secure analysis');
                } catch (e) {
                    // Version check not critical
                }
            } else {
                throw new Error('ESLint not found');
            }
        } catch (error) {
            console.log(`❌ ESLint is not available: ${error.message}`);
            console.log('\n📦 To install ESLint, run:');
            console.log('   npm install eslint');
            console.log('   # or globally:');
            console.log('   npm install -g eslint');
            process.exit(1);
        }
    }

    showAvailableRules() {
        console.log('📋 ESLint Security and Quality Rules');
        console.log('═'.repeat(50));
        console.log('');

        const ruleCategories = {
            'Security Rules': [
                'no-eval - Prevents dangerous eval() usage',
                'no-implied-eval - Prevents indirect eval usage',
                'no-new-func - Prevents Function constructor usage',
                'no-script-url - Prevents javascript: URLs',
                'no-proto - Prevents __proto__ usage'
            ],
            'Code Quality Rules': [
                'no-unused-vars - Detects unused variables',
                'no-undef - Detects undefined variables',
                'no-unreachable - Detects unreachable code',
                'no-console - Warns about console usage',
                'no-debugger - Prevents debugger statements'
            ],
            'Best Practices': [
                'eqeqeq - Requires strict equality',
                'curly - Requires curly braces',
                'no-caller - Prevents arguments.caller usage',
                'no-throw-literal - Proper error throwing',
                'wrap-iife - Wraps IIFEs properly'
            ]
        };

        Object.entries(ruleCategories).forEach(([category, rules]) => {
            console.log(`${category}:`);
            rules.forEach(rule => {
                console.log(`  • ${rule}`);
            });
            console.log('');
        });
    }

    showConfiguration() {
        console.log('⚙️  ESLint Secure Configuration');
        console.log('═'.repeat(50));

        const config = this.adapter.secureConfig || {};

        console.log('Security-focused rules enabled:');
        Object.entries(config.rules || {}).forEach(([rule, level]) => {
            const levelIcon = level === 'error' ? '🚨' : level === 'warn' ? '⚠️' : '💡';
            console.log(`  ${levelIcon} ${rule}: ${level}`);
        });

        console.log('\nParser Options:');
        const parserOptions = config.parserOptions || {};
        console.log(`  ECMAScript Version: ${parserOptions.ecmaVersion || 'default'}`);
        console.log(`  Source Type: ${parserOptions.sourceType || 'script'}`);
        console.log(`  JSX Support: ${parserOptions.ecmaFeatures?.jsx ? 'enabled' : 'disabled'}`);

        console.log('\nEnvironment:');
        const env = config.env || {};
        Object.entries(env).forEach(([envName, enabled]) => {
            const icon = enabled ? '✅' : '❌';
            console.log(`  ${icon} ${envName}`);
        });
    }

    async showVersion() {
        try {
            console.log('🔍 ESLint CLI v1.0.0');
            console.log('🔧 Secure static analysis for JavaScript/TypeScript');
            console.log('📋 Security-focused rule configuration active');
        } catch (error) {
            console.log('🔍 ESLint CLI v1.0.0');
            console.log(`❌ ESLint not available: ${error.message}`);
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
    const cli = new ESLintCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = ESLintCLI;
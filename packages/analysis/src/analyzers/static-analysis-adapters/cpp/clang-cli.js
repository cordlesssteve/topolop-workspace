#!/usr/bin/env node

/**
 * Clang Static Analyzer CLI Interface for Topolop
 *
 * Command-line interface for C/C++ static analysis using Clang Static Analyzer.
 * Provides direct access to Clang analyzer functionality with enhanced output formatting.
 *
 * Usage:
 *   node clang-cli.js [options] <project-path>
 *   node clang-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const ClangStaticAnalyzer = require('./clang-static-analyzer');

class ClangCLI {
    constructor() {
        this.adapter = new ClangStaticAnalyzer();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('clang-cli')
            .description('C/C++ static analysis using Clang Static Analyzer')
            .version('1.0.0')
            .argument('<project-path>', 'Path to C/C++ project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--checkers <checkers>', 'Comma-separated list of checker categories', '')
            .option('--security-only', 'Show only security-related issues')
            .option('--memory-only', 'Show only memory-related issues')
            .option('--enable-alpha', 'Enable alpha (experimental) checkers')
            .option('--max-depth <n>', 'Maximum analysis depth', '3')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
            .option('--max-files <n>', 'Maximum files to analyze', '100')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Clang Static Analyzer is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('checkers')
            .description('List available checker categories')
            .action(() => {
                this.showAvailableCheckers();
            });

        this.program
            .command('security')
            .description('Run security-focused analysis only')
            .argument('<project-path>', 'Path to project')
            .option('-v, --verbose', 'Show detailed security information')
            .action(async (projectPath, options) => {
                await this.runSecurityAnalysis(projectPath, options);
            });

        this.program
            .command('memory')
            .description('Run memory safety analysis only')
            .argument('<project-path>', 'Path to project')
            .option('-v, --verbose', 'Show detailed memory information')
            .action(async (projectPath, options) => {
                await this.runMemoryAnalysis(projectPath, options);
            });

        this.program
            .command('deadcode')
            .description('Find dead/unreachable code')
            .argument('<project-path>', 'Path to project')
            .action(async (projectPath) => {
                await this.findDeadCode(projectPath);
            });

        this.program
            .command('version')
            .description('Show Clang Static Analyzer version information')
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
                console.log(`🔍 Starting Clang Static Analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                checkers: options.checkers ? options.checkers.split(',').map(c => c.trim()) : [],
                securityOnly: options.securityOnly,
                memoryOnly: options.memoryOnly,
                enableAlpha: options.enableAlpha,
                maxDepth: parseInt(options.maxDepth, 10),
                timeout: parseInt(options.timeout, 10),
                maxFiles: parseInt(options.maxFiles, 10),
                verbose: options.verbose
            };

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

            // Exit with appropriate code based on issues found
            const hasHighSeverityIssues = result.issues?.some(i =>
                ['high', 'error', 'critical'].includes(i.severity)) || false;
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
        const { issues = [], summary = {} } = result;

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
        const { issues = [], summary = {} } = result;

        console.log('🔍 Clang Static Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`📊 Files Analyzed: ${summary.filesAnalyzed || 0}`);
        console.log(`⚠️  Total Issues: ${issues.length || 0}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: Clang Static Analyzer ${result.version || 'unknown'}`);
        console.log('');

        if (issues.length === 0) {
            console.log('✅ No issues found! Great C/C++ code quality!');
        } else {
            // Categorize issues
            const issueCategories = {};
            const severityCounts = {};

            issues.forEach(issue => {
                const category = issue.category || 'unknown';
                const severity = issue.severity || 'info';

                issueCategories[category] = (issueCategories[category] || 0) + 1;
                severityCounts[severity] = (severityCounts[severity] || 0) + 1;
            });

            console.log('📊 Issues by Category:');
            Object.entries(issueCategories)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([category, count]) => {
                    console.log(`   ${this.getCategoryIcon(category)} ${category}: ${count}`);
                });

            console.log('\n🎯 Issues by Severity:');
            Object.entries(severityCounts).forEach(([severity, count]) => {
                console.log(`   ${this.getSeverityIcon(severity)} ${severity}: ${count}`);
            });
        }

        if (summary.checkers) {
            console.log(`\n🔧 Checkers Used: ${summary.checkers.length}`);
        }
    }

    displayTable(result, options, duration) {
        const { issues = [], summary = {} } = result;

        // Header
        console.log('🔍 Clang Static Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Files: ${summary.filesAnalyzed || 0} | Issues: ${issues.length}`);
        console.log('');

        if (issues.length === 0) {
            console.log('✅ No issues found! Your C/C++ code passes static analysis!');
            return;
        }

        // Group issues by category and severity
        const groupedIssues = {};
        issues.forEach(issue => {
            const category = issue.category || 'general';
            if (!groupedIssues[category]) {
                groupedIssues[category] = [];
            }
            groupedIssues[category].push(issue);
        });

        // Sort categories by severity (security first, then memory, etc.)
        const categoryPriority = {
            'security': 1,
            'memory': 2,
            'null-dereference': 3,
            'deadcode': 4,
            'general': 5
        };

        const sortedCategories = Object.entries(groupedIssues).sort(([a], [b]) => {
            return (categoryPriority[a] || 99) - (categoryPriority[b] || 99);
        });

        // Display each category
        sortedCategories.forEach(([category, categoryIssues]) => {
            console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase().replace(/-/g, ' ')} (${categoryIssues.length} issues)`);
            console.log('─'.repeat(80));

            categoryIssues.forEach((issue, index) => {
                const severity = this.formatSeverity(issue.severity || 'info', options.noColor);
                const location = issue.location
                    ? `${path.basename(issue.location.file)}:${issue.location.line}`
                    : 'unknown location';

                console.log(`${index + 1}. ${severity} ${issue.description || issue.message}`);
                console.log(`   📍 ${location}`);

                if (issue.checker) {
                    console.log(`   🔧 Checker: ${issue.checker}`);
                }

                if (issue.explanation && options.verbose) {
                    console.log(`   💡 ${issue.explanation}`);
                }

                if (issue.fix_suggestion) {
                    console.log(`   🔧 Suggestion: ${issue.fix_suggestion}`);
                }

                console.log('');
            });
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    getCategoryIcon(category) {
        const icons = {
            'security': '🔒',
            'memory': '🧠',
            'null-dereference': '⚠️',
            'deadcode': '💀',
            'performance': '⚡',
            'general': '📋'
        };
        return icons[category] || '🔍';
    }

    getSeverityIcon(severity) {
        const icons = {
            'critical': '🚨',
            'high': '🔴',
            'error': '🔴',
            'medium': '🟡',
            'warning': '🟡',
            'low': '🔵',
            'info': '🔵'
        };
        return icons[severity] || 'ℹ️';
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity.toUpperCase()}]`;
        }

        const colors = {
            critical: '\x1b[35m',   // Magenta
            high: '\x1b[31m',       // Red
            error: '\x1b[31m',      // Red
            medium: '\x1b[33m',     // Yellow
            warning: '\x1b[33m',    // Yellow
            low: '\x1b[36m',        // Cyan
            info: '\x1b[36m',       // Cyan
            reset: '\x1b[0m'        // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity.toUpperCase()}]${colors.reset}`;
    }

    async runSecurityAnalysis(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('🔒 Running security-focused analysis...');
            const result = await this.adapter.analyze(resolvedPath, {
                securityOnly: true,
                checkers: ['security', 'alpha.security'],
                verbose: options.verbose
            });

            const securityIssues = result.issues?.filter(i =>
                i.category === 'security' ||
                (i.checker && i.checker.includes('security'))
            ) || [];

            if (securityIssues.length === 0) {
                console.log('✅ No security issues found!');
                process.exit(0);
            } else {
                console.log(`🔒 Found ${securityIssues.length} security issues:`);
                securityIssues.forEach((issue, index) => {
                    const location = issue.location
                        ? `${path.basename(issue.location.file)}:${issue.location.line}`
                        : 'unknown';
                    console.log(`  ${index + 1}. ${issue.description || issue.message}`);
                    console.log(`     📍 ${location}`);
                    if (options.verbose && issue.explanation) {
                        console.log(`     💡 ${issue.explanation}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Security analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    async runMemoryAnalysis(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('🧠 Running memory safety analysis...');
            const result = await this.adapter.analyze(resolvedPath, {
                memoryOnly: true,
                checkers: ['core', 'alpha.core'],
                verbose: options.verbose
            });

            const memoryIssues = result.issues?.filter(i =>
                ['memory', 'null-dereference', 'use-after-free'].includes(i.category) ||
                (i.checker && i.checker.includes('core'))
            ) || [];

            if (memoryIssues.length === 0) {
                console.log('✅ No memory safety issues found!');
                process.exit(0);
            } else {
                console.log(`🧠 Found ${memoryIssues.length} memory safety issues:`);
                memoryIssues.forEach((issue, index) => {
                    const location = issue.location
                        ? `${path.basename(issue.location.file)}:${issue.location.line}`
                        : 'unknown';
                    console.log(`  ${index + 1}. ${issue.description || issue.message}`);
                    console.log(`     📍 ${location}`);
                    if (options.verbose && issue.explanation) {
                        console.log(`     💡 ${issue.explanation}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Memory analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    async findDeadCode(projectPath) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('💀 Finding dead/unreachable code...');
            const result = await this.adapter.analyze(resolvedPath, {
                checkers: ['deadcode', 'alpha.deadcode']
            });

            const deadCodeIssues = result.issues?.filter(i =>
                i.category === 'deadcode' ||
                (i.checker && i.checker.includes('deadcode'))
            ) || [];

            if (deadCodeIssues.length === 0) {
                console.log('✅ No dead code found!');
                process.exit(0);
            } else {
                console.log(`💀 Found ${deadCodeIssues.length} dead code issues:`);
                deadCodeIssues.forEach((issue, index) => {
                    const location = issue.location
                        ? `${path.basename(issue.location.file)}:${issue.location.line}`
                        : 'unknown';
                    console.log(`  ${index + 1}. ${issue.description || issue.message}`);
                    console.log(`     📍 ${location}`);
                });
            }

        } catch (error) {
            this.printError(`Dead code analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    showAvailableCheckers() {
        console.log('🔧 Available Clang Static Analyzer Checkers');
        console.log('═'.repeat(50));
        console.log('');

        const checkerCategories = [
            {
                name: 'core',
                description: 'Core checkers (null dereference, divide by zero, etc.)',
                examples: ['core.NullDereference', 'core.DivideZero', 'core.CallAndMessage']
            },
            {
                name: 'security',
                description: 'Security-related checkers',
                examples: ['security.insecureAPI.UncheckedReturn', 'security.FloatLoopCounter']
            },
            {
                name: 'deadcode',
                description: 'Dead code detection',
                examples: ['deadcode.DeadStores', 'alpha.deadcode.UnreachableCode']
            },
            {
                name: 'unix',
                description: 'Unix API checkers',
                examples: ['unix.Malloc', 'unix.MallocSizeof', 'unix.MismatchedDeallocator']
            },
            {
                name: 'alpha.core',
                description: 'Alpha core checkers (experimental)',
                examples: ['alpha.core.BoolAssignment', 'alpha.core.CastSize']
            },
            {
                name: 'alpha.security',
                description: 'Alpha security checkers (experimental)',
                examples: ['alpha.security.ArrayBoundV2', 'alpha.security.MallocOverflow']
            }
        ];

        checkerCategories.forEach(category => {
            console.log(`🔧 ${category.name}`);
            console.log(`   Description: ${category.description}`);
            console.log(`   Examples: ${category.examples.join(', ')}`);
            console.log('');
        });

        console.log('Usage: --checkers <category1,category2,...>');
        console.log('Example: clang-cli --checkers core,security,deadcode ./src');
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Clang Static Analyzer availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ Clang Static Analyzer is available');
                console.log('🔧 Ready for C/C++ static analysis');
            } else {
                throw new Error('Clang Static Analyzer not found');
            }
        } catch (error) {
            console.log(`❌ Clang Static Analyzer is not available: ${error.message}`);
            console.log('\n📦 To install Clang Static Analyzer:');
            console.log('   Ubuntu/Debian: apt-get install clang clang-tools');
            console.log('   macOS: brew install llvm');
            console.log('   Or install with your system package manager');
            process.exit(1);
        }
    }

    async showVersion() {
        try {
            console.log('🔍 Clang Static Analyzer CLI v1.0.0');
            console.log('🔧 C/C++ static analysis for memory safety and security');
            console.log('📋 Advanced static analysis with path-sensitive checking');
        } catch (error) {
            console.log('🔍 Clang Static Analyzer CLI v1.0.0');
            console.log(`❌ Clang not available: ${error.message}`);
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
    const cli = new ClangCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = ClangCLI;
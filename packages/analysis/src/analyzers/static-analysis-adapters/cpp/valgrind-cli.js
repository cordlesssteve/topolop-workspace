#!/usr/bin/env node

/**
 * Valgrind CLI Interface for Topolop
 *
 * Command-line interface for C/C++ dynamic analysis using Valgrind.
 * Provides direct access to Valgrind functionality with enhanced output formatting.
 *
 * Usage:
 *   node valgrind-cli.js [options] <executable-path>
 *   node valgrind-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
// Note: Using c-cpp valgrind adapter since cpp directory doesn't have one yet
const ValgrindAdapter = require('../c-cpp/valgrind-adapter');

class ValgrindCLI {
    constructor() {
        this.adapter = new ValgrindAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('valgrind-cli')
            .description('C/C++ dynamic analysis using Valgrind')
            .version('1.0.0')
            .argument('<executable-path>', 'Path to compiled C/C++ executable')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--tool <tool>', 'Valgrind tool to use (memcheck, cachegrind, callgrind)', 'memcheck')
            .option('--leak-check <level>', 'Memory leak detection level (summary, yes, full)', 'full')
            .option('--track-origins', 'Track origins of undefined values')
            .option('--show-reachable', 'Show reachable but not freed memory')
            .option('--gen-suppressions', 'Generate suppression entries')
            .option('--args <args>', 'Arguments to pass to the executable', '')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '180000')
            .action(async (executablePath, options) => {
                await this.runAnalysis(executablePath, options);
            });

        this.program
            .command('check')
            .description('Check if Valgrind is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('memcheck')
            .description('Run memory error detection analysis')
            .argument('<executable-path>', 'Path to executable')
            .option('--args <args>', 'Arguments for the executable', '')
            .option('-v, --verbose', 'Show detailed memory information')
            .action(async (executablePath, options) => {
                await this.runMemcheck(executablePath, options);
            });

        this.program
            .command('profile')
            .description('Run performance profiling analysis')
            .argument('<executable-path>', 'Path to executable')
            .option('--tool <tool>', 'Profiling tool (cachegrind, callgrind)', 'cachegrind')
            .option('--args <args>', 'Arguments for the executable', '')
            .action(async (executablePath, options) => {
                await this.runProfiling(executablePath, options);
            });

        this.program
            .command('leaks')
            .description('Find memory leaks only')
            .argument('<executable-path>', 'Path to executable')
            .option('--args <args>', 'Arguments for the executable', '')
            .action(async (executablePath, options) => {
                await this.findLeaksOnly(executablePath, options);
            });

        this.program
            .command('tools')
            .description('Show available Valgrind tools')
            .action(() => {
                this.showAvailableTools();
            });

        this.program
            .command('version')
            .description('Show Valgrind version information')
            .action(async () => {
                await this.showVersion();
            });
    }

    async runAnalysis(executablePath, options) {
        try {
            // Validate executable path
            const resolvedPath = path.resolve(executablePath);
            await this.validateExecutablePath(resolvedPath);

            if (options.verbose) {
                console.log(`🔍 Starting Valgrind analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                tool: options.tool,
                leakCheck: options.leakCheck,
                trackOrigins: options.trackOrigins,
                showReachable: options.showReachable,
                genSuppressions: options.genSuppressions,
                executableArgs: options.args ? options.args.split(' ') : [],
                timeout: parseInt(options.timeout, 10),
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
            const hasMemoryErrors = this.hasMemoryErrors(result);
            process.exit(hasMemoryErrors ? 1 : 0);

        } catch (error) {
            this.printError(`CLI Error: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async validateExecutablePath(executablePath) {
        try {
            const stats = await fs.stat(executablePath);
            if (!stats.isFile()) {
                throw new Error('Executable path must be a file');
            }

            // Check if file is executable
            try {
                await fs.access(executablePath, fs.constants.X_OK);
            } catch (accessError) {
                throw new Error('File is not executable');
            }

        } catch (error) {
            throw new Error(`Invalid executable path: ${error.message}`);
        }
    }

    hasMemoryErrors(result) {
        const memcheck = result.memcheck || [];
        return memcheck.some(issue =>
            ['memory-leak', 'invalid-read', 'invalid-write', 'use-after-free'].includes(issue.type)
        );
    }

    async displayResults(result, options, duration) {
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
        const { memcheck = [], cachegrind = [], callgrind = [] } = result;

        console.log('🔍 Valgrind Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: Valgrind ${result.version || 'unknown'}`);
        console.log('');

        // Memory check results
        if (memcheck.length > 0) {
            console.log(`🧠 Memory Check Results: ${memcheck.length} issues`);

            const issueTypes = {};
            memcheck.forEach(issue => {
                issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
            });

            Object.entries(issueTypes).forEach(([type, count]) => {
                console.log(`   ${this.getMemoryIcon(type)} ${type.replace(/-/g, ' ')}: ${count}`);
            });
        } else {
            console.log('✅ No memory errors found!');
        }

        // Performance results
        if (cachegrind.length > 0 || callgrind.length > 0) {
            console.log(`\n📊 Performance Analysis:`);
            if (cachegrind.length > 0) {
                console.log(`   Cache profiling: ${cachegrind.length} metrics`);
            }
            if (callgrind.length > 0) {
                console.log(`   Call profiling: ${callgrind.length} metrics`);
            }
        }
    }

    displayTable(result, options, duration) {
        const { memcheck = [], cachegrind = [], callgrind = [] } = result;

        // Header
        console.log('🔍 Valgrind Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Executable: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🛠️  Tool: ${result.tool || 'memcheck'}`);
        console.log('');

        // Memory check results
        if (memcheck.length > 0) {
            console.log(`🧠 MEMORY CHECK RESULTS (${memcheck.length} issues)`);
            console.log('─'.repeat(80));

            // Group by type
            const groupedMemcheck = {};
            memcheck.forEach(issue => {
                const type = issue.type || 'unknown';
                if (!groupedMemcheck[type]) {
                    groupedMemcheck[type] = [];
                }
                groupedMemcheck[type].push(issue);
            });

            Object.entries(groupedMemcheck).forEach(([type, issues]) => {
                console.log(`\n${this.getMemoryIcon(type)} ${type.replace(/-/g, ' ').toUpperCase()} (${issues.length})`);

                issues.forEach((issue, index) => {
                    const severity = this.formatSeverity(this.getMemorySeverity(type), options.noColor);

                    console.log(`${index + 1}. ${severity} ${issue.description || issue.message}`);

                    if (issue.location) {
                        console.log(`   📍 ${issue.location}`);
                    }

                    if (issue.stackTrace && options.verbose) {
                        console.log(`   📚 Stack trace: ${issue.stackTrace.slice(0, 200)}${issue.stackTrace.length > 200 ? '...' : ''}`);
                    }

                    if (issue.leakSize) {
                        console.log(`   💧 Leaked: ${issue.leakSize} bytes`);
                    }

                    console.log('');
                });
            });
        }

        // Performance results
        if (cachegrind.length > 0) {
            console.log(`\n📊 CACHE PROFILING RESULTS`);
            console.log('─'.repeat(80));

            cachegrind.forEach((metric, index) => {
                console.log(`${index + 1}. ${metric.description || metric.name}`);
                if (metric.instructions) console.log(`   🔢 Instructions: ${metric.instructions}`);
                if (metric.cacheMisses) console.log(`   💥 Cache misses: ${metric.cacheMisses}`);
                if (metric.branchMispredictions) console.log(`   🔀 Branch mispredictions: ${metric.branchMispredictions}`);
                console.log('');
            });
        }

        if (callgrind.length > 0) {
            console.log(`\n📞 CALL PROFILING RESULTS`);
            console.log('─'.repeat(80));

            callgrind.forEach((metric, index) => {
                console.log(`${index + 1}. ${metric.function || 'Unknown function'}`);
                if (metric.calls) console.log(`   📞 Calls: ${metric.calls}`);
                if (metric.time) console.log(`   ⏱️  Time: ${metric.time}`);
                if (metric.percentage) console.log(`   📊 Percentage: ${metric.percentage}%`);
                console.log('');
            });
        }

        if (memcheck.length === 0 && cachegrind.length === 0 && callgrind.length === 0) {
            console.log('✅ Analysis completed successfully with no issues found!');
        }

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    getMemoryIcon(type) {
        const icons = {
            'memory-leak': '💧',
            'invalid-read': '🚫',
            'invalid-write': '✍️',
            'use-after-free': '🔥',
            'buffer-overflow': '📊',
            'double-free': '💥',
            'uninitialized-value': '❓'
        };
        return icons[type] || '⚠️';
    }

    getMemorySeverity(type) {
        const criticalTypes = ['invalid-read', 'invalid-write', 'use-after-free', 'buffer-overflow', 'double-free'];
        const mediumTypes = ['memory-leak', 'uninitialized-value'];

        if (criticalTypes.includes(type)) return 'error';
        if (mediumTypes.includes(type)) return 'warning';
        return 'info';
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

    async runMemcheck(executablePath, options) {
        try {
            const resolvedPath = path.resolve(executablePath);
            await this.validateExecutablePath(resolvedPath);

            console.log('🧠 Running memory error detection...');
            const result = await this.adapter.analyze(resolvedPath, {
                tool: 'memcheck',
                leakCheck: 'full',
                trackOrigins: true,
                executableArgs: options.args ? options.args.split(' ') : [],
                verbose: options.verbose
            });

            const memoryErrors = result.memcheck || [];

            if (memoryErrors.length === 0) {
                console.log('✅ No memory errors found!');
                process.exit(0);
            } else {
                console.log(`🧠 Found ${memoryErrors.length} memory issues:`);
                memoryErrors.forEach((error, index) => {
                    console.log(`  ${index + 1}. ${error.type}: ${error.description || error.message}`);
                    if (error.location) {
                        console.log(`     📍 ${error.location}`);
                    }
                    if (options.verbose && error.stackTrace) {
                        console.log(`     📚 ${error.stackTrace.slice(0, 200)}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Memory check failed: ${error.message}`);
            process.exit(1);
        }
    }

    async runProfiling(executablePath, options) {
        try {
            const resolvedPath = path.resolve(executablePath);
            await this.validateExecutablePath(resolvedPath);

            console.log(`📊 Running ${options.tool} profiling...`);
            const result = await this.adapter.analyze(resolvedPath, {
                tool: options.tool,
                executableArgs: options.args ? options.args.split(' ') : []
            });

            const profileData = result[options.tool] || [];

            if (profileData.length === 0) {
                console.log('📊 No profiling data collected');
                return;
            }

            console.log(`📊 ${options.tool} profiling results:`);
            profileData.slice(0, 10).forEach((data, index) => {
                if (options.tool === 'cachegrind') {
                    console.log(`  ${index + 1}. Instructions: ${data.instructions || 'N/A'}, Cache misses: ${data.cacheMisses || 'N/A'}`);
                } else if (options.tool === 'callgrind') {
                    console.log(`  ${index + 1}. Function: ${data.function || 'N/A'}, Calls: ${data.calls || 'N/A'}, Time: ${data.time || 'N/A'}`);
                }
            });

        } catch (error) {
            this.printError(`Profiling failed: ${error.message}`);
            process.exit(1);
        }
    }

    async findLeaksOnly(executablePath, options) {
        try {
            const resolvedPath = path.resolve(executablePath);
            await this.validateExecutablePath(resolvedPath);

            console.log('💧 Searching for memory leaks...');
            const result = await this.adapter.analyze(resolvedPath, {
                tool: 'memcheck',
                leakCheck: 'full',
                showReachable: false,
                executableArgs: options.args ? options.args.split(' ') : []
            });

            const memoryLeaks = result.memcheck?.filter(issue => issue.type === 'memory-leak') || [];

            if (memoryLeaks.length === 0) {
                console.log('✅ No memory leaks found!');
                process.exit(0);
            } else {
                console.log(`💧 Found ${memoryLeaks.length} memory leaks:`);
                memoryLeaks.forEach((leak, index) => {
                    console.log(`  ${index + 1}. ${leak.description || leak.message}`);
                    if (leak.leakSize) {
                        console.log(`     💧 Size: ${leak.leakSize} bytes`);
                    }
                    if (leak.location) {
                        console.log(`     📍 ${leak.location}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Memory leak check failed: ${error.message}`);
            process.exit(1);
        }
    }

    showAvailableTools() {
        console.log('🛠️  Available Valgrind Tools');
        console.log('═'.repeat(50));
        console.log('');

        const tools = [
            {
                name: 'memcheck',
                description: 'Memory error detector (default)',
                features: ['Memory leaks', 'Buffer overflows', 'Use after free', 'Invalid reads/writes']
            },
            {
                name: 'cachegrind',
                description: 'Cache and branch prediction profiler',
                features: ['Instruction counts', 'Cache misses', 'Branch mispredictions']
            },
            {
                name: 'callgrind',
                description: 'Call graph profiler',
                features: ['Function call counts', 'Call relationships', 'Performance bottlenecks']
            },
            {
                name: 'helgrind',
                description: 'Thread error detector',
                features: ['Race conditions', 'Lock ordering problems', 'Thread synchronization']
            },
            {
                name: 'drd',
                description: 'Thread error detector (alternative)',
                features: ['Data race detection', 'Lock contention', 'Thread safety issues']
            }
        ];

        tools.forEach(tool => {
            console.log(`🛠️  ${tool.name}`);
            console.log(`   Description: ${tool.description}`);
            console.log(`   Features: ${tool.features.join(', ')}`);
            console.log('');
        });

        console.log('Usage: --tool <tool-name>');
        console.log('Example: valgrind-cli --tool cachegrind ./my-program');
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Valgrind availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ Valgrind is available');
                console.log('🔧 Ready for dynamic analysis and memory debugging');
            } else {
                throw new Error('Valgrind not found');
            }
        } catch (error) {
            console.log(`❌ Valgrind is not available: ${error.message}`);
            console.log('\n📦 To install Valgrind:');
            console.log('   Ubuntu/Debian: apt-get install valgrind');
            console.log('   macOS: brew install valgrind');
            console.log('   Or install with your system package manager');
            process.exit(1);
        }
    }

    async showVersion() {
        try {
            console.log('🔍 Valgrind CLI v1.0.0');
            console.log('🔧 C/C++ dynamic analysis and memory debugging');
            console.log('📋 Runtime error detection and performance profiling');
        } catch (error) {
            console.log('🔍 Valgrind CLI v1.0.0');
            console.log(`❌ Valgrind not available: ${error.message}`);
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
    const cli = new ValgrindCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = ValgrindCLI;
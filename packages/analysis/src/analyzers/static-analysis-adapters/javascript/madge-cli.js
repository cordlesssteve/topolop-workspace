#!/usr/bin/env node

/**
 * Madge CLI Interface for Topolop
 *
 * Command-line interface for JavaScript/TypeScript dependency analysis using Madge.
 * Provides direct access to Madge adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node madge-cli.js [options] <project-path>
 *   node madge-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const madgeAdapter = require('./madge-adapter');

class MadgeCLI {
    constructor() {
        this.adapter = madgeAdapter;
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('madge-cli')
            .description('JavaScript/TypeScript dependency analysis using Madge')
            .version('1.0.0')
            .argument('<project-path>', 'Path to JavaScript/TypeScript project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--circular-only', 'Show only circular dependency issues')
            .option('--entry-point <file>', 'Specify custom entry point for analysis')
            .option('--depth <number>', 'Maximum dependency depth to analyze', '10')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--include-npm', 'Include node_modules in analysis (not recommended)')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '120000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Madge is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('circular')
            .description('Find only circular dependencies')
            .argument('<project-path>', 'Path to project')
            .option('-v, --verbose', 'Enable verbose output')
            .action(async (projectPath, options) => {
                await this.findCircularDependencies(projectPath, options);
            });

        this.program
            .command('stats')
            .description('Show dependency statistics')
            .argument('<project-path>', 'Path to project')
            .action(async (projectPath) => {
                await this.showDependencyStats(projectPath);
            });

        this.program
            .command('graph')
            .description('Generate dependency graph information')
            .argument('<project-path>', 'Path to project')
            .option('--entry-point <file>', 'Specify entry point')
            .action(async (projectPath, options) => {
                await this.generateGraphInfo(projectPath, options);
            });

        this.program
            .command('version')
            .description('Show Madge version information')
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
                console.log(`🕷️  Starting Madge analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                entryPoint: options.entryPoint,
                includeNpm: options.includeNpm,
                maxDepth: parseInt(options.depth, 10),
                timeout: parseInt(options.timeout, 10)
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

            // Exit with appropriate code based on circular dependencies
            const hasCircularDeps = result.results?.circular?.length > 0;
            process.exit(hasCircularDeps ? 1 : 0);

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
        const { results = {}, summary = {} } = result;

        // Filter to circular only if requested
        if (options.circularOnly) {
            const circularResult = {
                ...result,
                results: { circular: results.circular || [] }
            };
            return this.displayCircularOnly(circularResult, options, duration);
        }

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
        const { results = {}, summary = {} } = result;

        console.log('🕷️  Madge Dependency Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`📊 Total Files: ${summary.totalFiles || 0}`);
        console.log(`🔗 Total Dependencies: ${summary.totalDependencies || 0}`);
        console.log(`📈 Average Dependencies: ${summary.averageDependencies || 0}`);
        console.log(`🚨 Circular Dependencies: ${summary.circularDependencies || 0}`);
        console.log(`💯 Health Score: ${summary.healthScore || 0}/100`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log('');

        if (summary.circularDependencies > 0) {
            console.log('⚠️  Circular dependencies detected! These need attention:');
            (results.circular || []).slice(0, 3).forEach((cycle, index) => {
                console.log(`   ${index + 1}. ${cycle.join(' → ')}`);
            });
            if (results.circular?.length > 3) {
                console.log(`   ... and ${results.circular.length - 3} more`);
            }
        } else {
            console.log('✅ No circular dependencies found! Great architecture!');
        }

        if (summary.dependencyStats) {
            console.log('\n📈 Dependency Statistics:');
            console.log(`   Most Dependent: ${summary.dependencyStats.mostDependent?.file || 'none'} (${summary.dependencyStats.mostDependent?.count || 0})`);
            console.log(`   Most Depended Upon: ${summary.dependencyStats.mostDependedUpon?.file || 'none'} (${summary.dependencyStats.mostDependedUpon?.count || 0})`);
        }
    }

    displayTable(result, options, duration) {
        const { results = {}, summary = {} } = result;

        // Header
        console.log('🕷️  Madge Dependency Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.codebasePath || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Files: ${summary.totalFiles || 0} | Dependencies: ${summary.totalDependencies || 0}`);
        console.log('');

        // Display circular dependencies first (most critical)
        if (results.circular?.length > 0) {
            console.log(`🚨 CIRCULAR DEPENDENCIES (${results.circular.length})`);
            console.log('─'.repeat(80));
            results.circular.forEach((cycle, index) => {
                const severity = this.formatSeverity('error', options.noColor);
                console.log(`${index + 1}. ${severity} Circular dependency detected:`);
                console.log(`   📍 ${cycle.join(' → ')}`);
                console.log(`   🔧 Files involved: ${cycle.length}`);
                console.log('');
            });
        }

        // Display dependency statistics
        if (summary.dependencyStats) {
            console.log('📈 DEPENDENCY STATISTICS');
            console.log('─'.repeat(80));
            const stats = summary.dependencyStats;
            console.log(`📊 Maximum outgoing dependencies: ${stats.maxOutgoing || 0}`);
            console.log(`📊 Maximum incoming dependencies: ${stats.maxIncoming || 0}`);
            console.log(`📊 Average outgoing dependencies: ${stats.averageOutgoing || 0}`);
            console.log(`📊 Files with no dependencies: ${stats.filesWithNoDependencies || 0}`);
            console.log('');

            if (stats.mostDependent?.file) {
                console.log(`🏆 Most dependent file: ${path.basename(stats.mostDependent.file)} (${stats.mostDependent.count} deps)`);
            }
            if (stats.mostDependedUpon?.file) {
                console.log(`🎯 Most depended upon: ${path.basename(stats.mostDependedUpon.file)} (${stats.mostDependedUpon.count} times)`);
            }
            console.log('');
        }

        // Display complexity metrics
        if (summary.complexityMetrics) {
            console.log('🧠 COMPLEXITY METRICS');
            console.log('─'.repeat(80));
            const metrics = summary.complexityMetrics;
            console.log(`🔗 Connected components: ${metrics.connectedComponents || 0}`);
            console.log(`📏 Maximum depth: ${metrics.depth || 0}`);
            console.log(`📤 Average fan-out: ${metrics.fanOut || 0}`);
            if (metrics.coupling) {
                console.log(`🔗 Coupling: ${metrics.coupling.coupling || 0}`);
                console.log(`🤝 Cohesion: ${metrics.coupling.cohesion || 0}`);
            }
            console.log('');
        }

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    displayCircularOnly(result, options, duration) {
        const { results = {} } = result;
        const circular = results.circular || [];

        console.log('🚨 Circular Dependencies Analysis');
        console.log('═'.repeat(80));

        if (circular.length === 0) {
            console.log('✅ No circular dependencies found!');
            return;
        }

        console.log(`Found ${circular.length} circular dependency chains:`);
        console.log('');

        circular.forEach((cycle, index) => {
            console.log(`${index + 1}. ${this.formatSeverity('error', options.noColor)} Chain of ${cycle.length} files:`);
            cycle.forEach((file, fileIndex) => {
                const isLast = fileIndex === cycle.length - 1;
                const arrow = isLast ? ' → (back to start)' : ' →';
                console.log(`   ${file}${arrow}`);
            });
            console.log('');
        });
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

    async findCircularDependencies(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🕷️  Checking for circular dependencies in: ${resolvedPath}`);
            }

            const result = await this.adapter.analyze(resolvedPath, {});
            const circular = result.results?.circular || [];

            if (circular.length === 0) {
                console.log('✅ No circular dependencies found!');
                process.exit(0);
            } else {
                console.log(`🚨 Found ${circular.length} circular dependency chains:`);
                circular.forEach((cycle, index) => {
                    console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Circular dependency check failed: ${error.message}`);
            process.exit(1);
        }
    }

    async showDependencyStats(projectPath) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('📊 Analyzing dependency statistics...');
            const result = await this.adapter.analyze(resolvedPath, {});
            const summary = result.summary || {};

            console.log('\n📈 Dependency Statistics Report');
            console.log('═'.repeat(50));
            console.log(`Total Files: ${summary.totalFiles || 0}`);
            console.log(`Total Dependencies: ${summary.totalDependencies || 0}`);
            console.log(`Average Dependencies per File: ${summary.averageDependencies || 0}`);
            console.log(`Health Score: ${summary.healthScore || 0}/100`);

            if (summary.dependencyStats) {
                const stats = summary.dependencyStats;
                console.log('\n🎯 Key Metrics:');
                console.log(`• Max outgoing dependencies: ${stats.maxOutgoing || 0}`);
                console.log(`• Max incoming dependencies: ${stats.maxIncoming || 0}`);
                console.log(`• Files with no dependencies: ${stats.filesWithNoDependencies || 0}`);

                if (stats.mostDependent?.file) {
                    console.log(`• Most dependent file: ${path.basename(stats.mostDependent.file)}`);
                }
            }

        } catch (error) {
            this.printError(`Stats analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    async generateGraphInfo(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('🕸️  Generating dependency graph information...');
            const result = await this.adapter.analyze(resolvedPath, {
                entryPoint: options.entryPoint
            });

            const { results = {}, summary = {} } = result;

            console.log('\n🕸️  Dependency Graph Analysis');
            console.log('═'.repeat(50));

            if (results.dependencies) {
                const depCount = Object.keys(results.dependencies).length;
                console.log(`Graph nodes: ${depCount} files`);

                const totalEdges = Object.values(results.dependencies)
                    .reduce((sum, deps) => sum + deps.length, 0);
                console.log(`Graph edges: ${totalEdges} dependencies`);
            }

            if (summary.complexityMetrics) {
                const metrics = summary.complexityMetrics;
                console.log(`Connected components: ${metrics.connectedComponents || 0}`);
                console.log(`Maximum depth: ${metrics.depth || 0}`);
            }

            if (results.tree && Object.keys(results.tree).length > 0) {
                console.log('\n🌳 Entry point dependency tree available');
            }

        } catch (error) {
            this.printError(`Graph analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Madge availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ Madge is available');
                console.log('🔧 Configuration ready for secure dependency analysis');
            } else {
                throw new Error('Madge not found');
            }
        } catch (error) {
            console.log(`❌ Madge is not available: ${error.message}`);
            console.log('\n📦 To install Madge, run:');
            console.log('   npm install madge');
            console.log('   # or globally:');
            console.log('   npm install -g madge');
            process.exit(1);
        }
    }

    async showVersion() {
        try {
            console.log('🕷️  Madge CLI v1.0.0');
            console.log('🔧 Secure dependency analysis for JavaScript/TypeScript');
            console.log('📋 Circular dependency detection and architecture analysis');
        } catch (error) {
            console.log('🕷️  Madge CLI v1.0.0');
            console.log(`❌ Madge not available: ${error.message}`);
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
    const cli = new MadgeCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = MadgeCLI;
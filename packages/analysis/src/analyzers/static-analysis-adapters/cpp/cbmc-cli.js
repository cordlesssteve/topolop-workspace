#!/usr/bin/env node

/**
 * CBMC CLI Interface for Topolop
 *
 * Command-line interface for C/C++ formal verification using CBMC (Bounded Model Checker).
 * Provides direct access to CBMC adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node cbmc-cli.js [options] <project-path>
 *   node cbmc-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const CBMCAdapter = require('./cbmc-adapter');

class CBMCCLI {
    constructor() {
        this.adapter = new CBMCAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('cbmc-cli')
            .description('C/C++ formal verification using CBMC (Bounded Model Checker)')
            .version('1.0.0')
            .argument('<project-path>', 'Path to C/C++ project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--unwind <depth>', 'Set loop unwinding depth', '10')
            .option('--bounds-check', 'Enable array bounds checking')
            .option('--overflow-check', 'Enable integer overflow checking')
            .option('--memory-check', 'Enable memory safety checking')
            .option('--concurrency', 'Enable concurrency bug detection')
            .option('--property <prop>', 'Check specific property')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '600000')
            .option('--max-files <n>', 'Maximum files to analyze', '50')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if CBMC is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('properties')
            .description('Show available verification properties')
            .action(() => {
                this.showAvailableProperties();
            });

        this.program
            .command('verify')
            .description('Verify specific assertions in a file')
            .argument('<file-path>', 'Path to C/C++ file')
            .option('--property <prop>', 'Specific property to verify')
            .option('-v, --verbose', 'Show detailed verification steps')
            .action(async (filePath, options) => {
                await this.verifyFile(filePath, options);
            });

        this.program
            .command('bounds')
            .description('Check array bounds violations only')
            .argument('<project-path>', 'Path to project')
            .option('-v, --verbose', 'Show detailed bounds information')
            .action(async (projectPath, options) => {
                await this.checkBoundsOnly(projectPath, options);
            });

        this.program
            .command('version')
            .description('Show CBMC version information')
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
                console.log(`🔬 Starting CBMC analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                unwindDepth: parseInt(options.unwind, 10),
                enableBoundsCheck: options.boundsCheck,
                enableOverflowCheck: options.overflowCheck,
                enableMemoryCheck: options.memoryCheck,
                enableConcurrency: options.concurrency,
                specificProperty: options.property,
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

            // Exit with appropriate code based on verification results
            const hasViolations = result.violations && result.violations.length > 0;
            process.exit(hasViolations ? 1 : 0);

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
        const { violations = [], assertions = [], summary = {} } = result;

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
        const { violations = [], assertions = [], summary = {} } = result;

        console.log('🔬 CBMC Formal Verification Summary');
        console.log('═'.repeat(50));
        console.log(`🔍 Files Analyzed: ${summary.filesAnalyzed || 0}`);
        console.log(`✅ Assertions Verified: ${assertions.length || 0}`);
        console.log(`🚨 Violations Found: ${violations.length || 0}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: CBMC ${result.version || 'unknown'}`);
        console.log('');

        if (violations.length === 0) {
            console.log('✅ No violations found! Your code passes formal verification!');
        } else {
            console.log('❌ Formal verification failed. Critical issues detected:');

            const violationTypes = {};
            violations.forEach(v => {
                violationTypes[v.type] = (violationTypes[v.type] || 0) + 1;
            });

            Object.entries(violationTypes).forEach(([type, count]) => {
                console.log(`   ${this.getViolationIcon(type)} ${type}: ${count}`);
            });
        }

        if (summary.properties) {
            console.log(`\n📊 Properties Checked: ${summary.properties.length}`);
            console.log(`   Verified: ${summary.properties.filter(p => p.status === 'success').length}`);
            console.log(`   Failed: ${summary.properties.filter(p => p.status === 'failure').length}`);
        }
    }

    displayTable(result, options, duration) {
        const { violations = [], assertions = [], summary = {} } = result;

        // Header
        console.log('🔬 CBMC Formal Verification Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Files: ${summary.filesAnalyzed || 0} | Violations: ${violations.length}`);
        console.log('');

        if (violations.length === 0) {
            console.log('✅ No violations found! Your C/C++ code passes formal verification!');
            if (assertions.length > 0) {
                console.log(`🎯 Successfully verified ${assertions.length} assertions`);
            }
            return;
        }

        // Group violations by type for better organization
        const violationsByType = {};
        violations.forEach(violation => {
            const type = violation.type || 'unknown';
            if (!violationsByType[type]) {
                violationsByType[type] = [];
            }
            violationsByType[type].push(violation);
        });

        // Display each violation type
        Object.entries(violationsByType).forEach(([type, typeViolations]) => {
            console.log(`\n${this.getViolationIcon(type)} ${type.toUpperCase().replace(/_/g, ' ')} (${typeViolations.length} issues)`);
            console.log('─'.repeat(80));

            typeViolations.forEach((violation, index) => {
                const severity = this.formatSeverity(this.getViolationSeverity(type), options.noColor);
                const location = violation.location
                    ? `${path.basename(violation.location.file)}:${violation.location.line}`
                    : 'unknown location';

                console.log(`${index + 1}. ${severity} ${violation.description || violation.message}`);
                console.log(`   📍 ${location}`);

                if (violation.property) {
                    console.log(`   🎯 Property: ${violation.property}`);
                }

                if (violation.trace && options.verbose) {
                    console.log(`   🔍 Execution trace: ${violation.trace.slice(0, 100)}${violation.trace.length > 100 ? '...' : ''}`);
                }

                if (violation.counterexample) {
                    console.log(`   💡 Counterexample available`);
                }

                console.log('');
            });
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    getViolationIcon(type) {
        const icons = {
            'bounds_violation': '🚫',
            'assertion_failure': '🚨',
            'integer_overflow': '📊',
            'memory_leak': '💧',
            'null_dereference': '⚠️',
            'use_after_free': '🔥',
            'concurrency_bug': '🔀',
            'division_by_zero': '➗'
        };
        return icons[type] || '❗';
    }

    getViolationSeverity(type) {
        const criticalTypes = ['assertion_failure', 'bounds_violation', 'null_dereference', 'use_after_free'];
        const mediumTypes = ['integer_overflow', 'memory_leak', 'division_by_zero'];

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

    async verifyFile(filePath, options) {
        try {
            const resolvedPath = path.resolve(filePath);

            // Validate file exists
            const stats = await fs.stat(resolvedPath);
            if (!stats.isFile()) {
                throw new Error('File path must be a file');
            }

            if (options.verbose) {
                console.log(`🔬 Verifying file: ${resolvedPath}`);
            }

            const analysisOptions = {
                singleFile: true,
                specificProperty: options.property,
                verbose: options.verbose
            };

            const result = await this.adapter.analyze(path.dirname(resolvedPath), {
                ...analysisOptions,
                targetFile: resolvedPath
            });

            if (result.violations && result.violations.length > 0) {
                console.log(`❌ Verification failed for ${path.basename(filePath)}`);
                result.violations.forEach((violation, index) => {
                    console.log(`  ${index + 1}. ${violation.description || violation.message}`);
                });
                process.exit(1);
            } else {
                console.log(`✅ Verification passed for ${path.basename(filePath)}`);
                process.exit(0);
            }

        } catch (error) {
            this.printError(`File verification failed: ${error.message}`);
            process.exit(1);
        }
    }

    async checkBoundsOnly(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('🚫 Checking array bounds violations...');
            const result = await this.adapter.analyze(resolvedPath, {
                enableBoundsCheck: true,
                enableOverflowCheck: false,
                enableMemoryCheck: false
            });

            const boundsViolations = result.violations?.filter(v => v.type === 'bounds_violation') || [];

            if (boundsViolations.length === 0) {
                console.log('✅ No array bounds violations found!');
                process.exit(0);
            } else {
                console.log(`🚫 Found ${boundsViolations.length} array bounds violations:`);
                boundsViolations.forEach((violation, index) => {
                    const location = violation.location
                        ? `${path.basename(violation.location.file)}:${violation.location.line}`
                        : 'unknown';
                    console.log(`  ${index + 1}. ${violation.description || violation.message}`);
                    console.log(`     📍 ${location}`);
                    if (options.verbose && violation.trace) {
                        console.log(`     🔍 ${violation.trace.slice(0, 150)}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Bounds check failed: ${error.message}`);
            process.exit(1);
        }
    }

    showAvailableProperties() {
        console.log('🎯 Available CBMC Verification Properties');
        console.log('═'.repeat(50));
        console.log('');

        const properties = [
            { name: 'bounds-check', description: 'Array bounds checking' },
            { name: 'div-by-zero-check', description: 'Division by zero detection' },
            { name: 'signed-overflow-check', description: 'Signed integer overflow detection' },
            { name: 'unsigned-overflow-check', description: 'Unsigned integer overflow detection' },
            { name: 'pointer-check', description: 'Pointer safety verification' },
            { name: 'memory-leak-check', description: 'Memory leak detection' },
            { name: 'deadlock-check', description: 'Deadlock detection (concurrency)' },
            { name: 'data-race-check', description: 'Data race detection (concurrency)' }
        ];

        properties.forEach(prop => {
            console.log(`🔧 ${prop.name}`);
            console.log(`   ${prop.description}`);
            console.log('');
        });

        console.log('Usage: --property <property-name>');
        console.log('Example: cbmc-cli --property bounds-check ./src');
    }

    async checkTool() {
        try {
            console.log('🔍 Checking CBMC availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ CBMC is available');
                console.log('🔧 Bounded model checking ready for formal verification');
            } else {
                throw new Error('CBMC not found');
            }
        } catch (error) {
            console.log(`❌ CBMC is not available: ${error.message}`);
            console.log('\n📦 To install CBMC:');
            console.log('   Ubuntu/Debian: apt-get install cbmc');
            console.log('   macOS: brew install cbmc');
            console.log('   Or download from: https://www.cprover.org/cbmc/');
            process.exit(1);
        }
    }

    async showVersion() {
        try {
            console.log('🔬 CBMC CLI v1.0.0');
            console.log('🔧 C/C++ formal verification using bounded model checking');
            console.log('📋 Mathematical proof-based verification for memory safety');
        } catch (error) {
            console.log('🔬 CBMC CLI v1.0.0');
            console.log(`❌ CBMC not available: ${error.message}`);
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
    const cli = new CBMCCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = CBMCCLI;
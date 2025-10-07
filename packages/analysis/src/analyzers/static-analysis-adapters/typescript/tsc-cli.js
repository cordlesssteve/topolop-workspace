#!/usr/bin/env node

/**
 * TypeScript Compiler CLI Interface for Topolop
 *
 * Command-line interface for TypeScript static analysis using TSC.
 * Provides direct access to TypeScript compiler functionality with enhanced output formatting.
 *
 * Usage:
 *   node tsc-cli.js [options] <project-path>
 *   node tsc-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const TypeScriptAdapter = require('./tsc-adapter');

class TypeScriptCLI {
    constructor() {
        this.adapter = new TypeScriptAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('tsc-cli')
            .description('TypeScript static analysis using TSC compiler')
            .version('1.0.0')
            .argument('<project-path>', 'Path to TypeScript project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--strict', 'Enable strict mode compilation')
            .option('--no-strict', 'Disable strict mode compilation')
            .option('--check-unused', 'Check for unused variables and parameters')
            .option('--errors-only', 'Show only type errors, hide warnings')
            .option('--project <path>', 'Path to tsconfig.json file')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--fix-suggestions', 'Include fix suggestions where available')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if TypeScript compiler is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('config')
            .description('Show TypeScript configuration for project')
            .argument('<project-path>', 'Path to TypeScript project')
            .action(async (projectPath) => {
                await this.showConfiguration(projectPath);
            });

        this.program
            .command('errors')
            .description('Show only type errors for quick debugging')
            .argument('<project-path>', 'Path to TypeScript project')
            .option('-v, --verbose', 'Show detailed error information')
            .action(async (projectPath, options) => {
                await this.showErrorsOnly(projectPath, options);
            });

        this.program
            .command('stats')
            .description('Show TypeScript project statistics')
            .argument('<project-path>', 'Path to TypeScript project')
            .action(async (projectPath) => {
                await this.showProjectStats(projectPath);
            });

        this.program
            .command('version')
            .description('Show TypeScript version information')
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
                console.log(`📝 Starting TypeScript analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                strict: options.strict,
                checkUnused: options.checkUnused,
                timeout: parseInt(options.timeout, 10)
            };

            if (options.project) {
                analysisOptions.tsconfigPath = path.resolve(options.project);
            }

            // Run analysis
            const startTime = Date.now();
            const result = await this.adapter.analyze(resolvedPath, analysisOptions);
            const duration = Date.now() - startTime;

            // Filter results if errors-only
            if (options.errorsOnly) {
                result.strictModeViolations = [];
                result.unusedDeclarations = [];
            }

            // Format and display results
            await this.displayResults(result, options, duration);

            // Exit with appropriate code based on compilation success
            process.exit(result.compilationSuccess ? 0 : 1);

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
        const { summary = {} } = result;

        console.log('📝 TypeScript Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`✅ Compilation: ${result.compilationSuccess ? 'SUCCESS' : 'FAILED'}`);
        console.log(`🚨 Type Errors: ${summary.totalErrors || 0}`);
        console.log(`⚠️  Warnings: ${summary.totalWarnings || 0}`);
        console.log(`💡 Info: ${summary.totalInfo || 0}`);
        console.log(`📁 Files Processed: ${summary.filesProcessed || 0}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Type Check: ${summary.typeCheckSuccess ? 'PASSED' : 'FAILED'}`);
        console.log('');

        if (result.compilationSuccess) {
            console.log('✅ No type errors found! Great TypeScript code!');
        } else {
            console.log('❌ TypeScript compilation failed. Check errors above.');
        }

        // Health metrics
        if (result.cityVisualizationData?.healthMetrics) {
            const health = result.cityVisualizationData.healthMetrics;
            console.log('\n📊 Code Quality Metrics:');
            console.log(`   Type Check Score: ${health.typeCheckScore || 0}/100`);
            console.log(`   Code Quality Score: ${health.codeQualityScore || 0}/100`);
            console.log(`   Maintenance Score: ${health.maintenanceScore || 0}/100`);
        }
    }

    displayTable(result, options, duration) {
        // Header
        console.log('📝 TypeScript Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`✅ Compilation: ${result.compilationSuccess ? 'SUCCESS' : 'FAILED'}`);
        console.log('');

        let hasIssues = false;

        // Display type errors first (most critical)
        if (result.typeErrors?.length > 0) {
            hasIssues = true;
            console.log(`🚨 TYPE ERRORS (${result.typeErrors.length})`);
            console.log('─'.repeat(80));
            result.typeErrors.forEach((error, index) => {
                const severity = this.formatSeverity('error', options.noColor);
                const location = `${path.basename(error.file)}:${error.line}:${error.column}`;

                console.log(`${index + 1}. ${severity} ${error.message}`);
                console.log(`   📍 ${location}`);
                console.log(`   🏷️  Code: ${error.errorCode}`);
                if (options.fixSuggestions && this.getFixSuggestion(error)) {
                    console.log(`   💡 Suggestion: ${this.getFixSuggestion(error)}`);
                }
                console.log('');
            });
        }

        // Display import/export issues
        if (result.importExportIssues?.length > 0) {
            hasIssues = true;
            console.log(`🔗 IMPORT/EXPORT ISSUES (${result.importExportIssues.length})`);
            console.log('─'.repeat(80));
            result.importExportIssues.forEach((error, index) => {
                const severity = this.formatSeverity('error', options.noColor);
                const location = `${path.basename(error.file)}:${error.line}:${error.column}`;

                console.log(`${index + 1}. ${severity} ${error.message}`);
                console.log(`   📍 ${location}`);
                console.log(`   🏷️  Code: ${error.errorCode}`);
                console.log('');
            });
        }

        // Display strict mode violations if not errors-only
        if (result.strictModeViolations?.length > 0 && !options.errorsOnly) {
            hasIssues = true;
            console.log(`⚠️  STRICT MODE VIOLATIONS (${result.strictModeViolations.length})`);
            console.log('─'.repeat(80));
            result.strictModeViolations.forEach((warning, index) => {
                const severity = this.formatSeverity('warning', options.noColor);
                const location = `${path.basename(warning.file)}:${warning.line}:${warning.column}`;

                console.log(`${index + 1}. ${severity} ${warning.message}`);
                console.log(`   📍 ${location}`);
                console.log(`   🏷️  Code: ${warning.errorCode}`);
                console.log('');
            });
        }

        // Display unused declarations if not errors-only
        if (result.unusedDeclarations?.length > 0 && !options.errorsOnly) {
            hasIssues = true;
            console.log(`💡 UNUSED DECLARATIONS (${result.unusedDeclarations.length})`);
            console.log('─'.repeat(80));
            result.unusedDeclarations.forEach((info, index) => {
                const severity = this.formatSeverity('info', options.noColor);
                const location = `${path.basename(info.file)}:${info.line}:${info.column}`;

                console.log(`${index + 1}. ${severity} ${info.message}`);
                console.log(`   📍 ${location}`);
                console.log(`   🏷️  Code: ${info.errorCode}`);
                console.log('');
            });
        }

        if (!hasIssues) {
            console.log('✅ No issues found! Your TypeScript code compiles perfectly!');
            return;
        }

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

    getFixSuggestion(error) {
        const suggestions = {
            'TS2322': 'Check type compatibility and ensure correct types',
            'TS2304': 'Import the missing identifier or check spelling',
            'TS2307': 'Install the missing module or check the import path',
            'TS2339': 'Check property name or add property to type definition',
            'TS7006': 'Add explicit type annotation to avoid implicit any'
        };

        return suggestions[error.errorCode] || null;
    }

    async showErrorsOnly(projectPath, options) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('🔍 Checking for TypeScript errors...');
            const result = await this.adapter.analyze(resolvedPath, { strict: true });

            if (result.typeErrors.length === 0) {
                console.log('✅ No type errors found!');
                process.exit(0);
            } else {
                console.log(`🚨 Found ${result.typeErrors.length} type errors:`);
                result.typeErrors.forEach((error, index) => {
                    const location = `${path.basename(error.file)}:${error.line}:${error.column}`;
                    console.log(`  ${index + 1}. ${error.message}`);
                    console.log(`     📍 ${location}`);
                    if (options.verbose) {
                        console.log(`     🏷️  ${error.errorCode}`);
                    }
                });
                process.exit(1);
            }

        } catch (error) {
            this.printError(`Error check failed: ${error.message}`);
            process.exit(1);
        }
    }

    async showProjectStats(projectPath) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('📊 Analyzing TypeScript project statistics...');
            const result = await this.adapter.analyze(resolvedPath, { strict: true, checkUnused: true });

            console.log('\n📈 TypeScript Project Statistics');
            console.log('═'.repeat(50));
            console.log(`Compilation Status: ${result.compilationSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
            console.log(`Files Processed: ${result.summary.filesProcessed || 0}`);
            console.log(`Type Errors: ${result.typeErrors.length}`);
            console.log(`Strict Mode Violations: ${result.strictModeViolations.length}`);
            console.log(`Unused Declarations: ${result.unusedDeclarations.length}`);
            console.log(`Import/Export Issues: ${result.importExportIssues.length}`);

            if (result.cityVisualizationData?.healthMetrics) {
                const health = result.cityVisualizationData.healthMetrics;
                console.log('\n🏥 Health Metrics:');
                console.log(`Overall Health: ${health.overallHealth}`);
                console.log(`Type Check Score: ${health.typeCheckScore}/100`);
                console.log(`Code Quality Score: ${health.codeQualityScore}/100`);
                console.log(`Maintenance Score: ${health.maintenanceScore}/100`);
            }

        } catch (error) {
            this.printError(`Stats analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    async showConfiguration(projectPath) {
        try {
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            console.log('⚙️  TypeScript Project Configuration');
            console.log('═'.repeat(50));

            // Look for tsconfig.json
            const tsconfigPath = await this.adapter._findTsConfig(resolvedPath);
            if (tsconfigPath) {
                console.log(`📄 tsconfig.json found: ${path.relative(process.cwd(), tsconfigPath)}`);

                try {
                    const tsconfigContent = await fs.readFile(tsconfigPath, 'utf8');
                    const tsconfig = JSON.parse(tsconfigContent);

                    if (tsconfig.compilerOptions) {
                        console.log('\n🔧 Compiler Options:');
                        Object.entries(tsconfig.compilerOptions).forEach(([key, value]) => {
                            console.log(`   ${key}: ${JSON.stringify(value)}`);
                        });
                    }

                    if (tsconfig.include) {
                        console.log('\n📥 Include patterns:');
                        tsconfig.include.forEach(pattern => console.log(`   • ${pattern}`));
                    }

                    if (tsconfig.exclude) {
                        console.log('\n📤 Exclude patterns:');
                        tsconfig.exclude.forEach(pattern => console.log(`   • ${pattern}`));
                    }

                } catch (parseError) {
                    console.log(`❌ Error parsing tsconfig.json: ${parseError.message}`);
                }
            } else {
                console.log('📄 No tsconfig.json found - using default TypeScript configuration');
            }

            // Check for package.json TypeScript dependency
            const packageJsonPath = path.join(resolvedPath, 'package.json');
            try {
                const packageContent = await fs.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(packageContent);

                console.log('\n📦 TypeScript Installation:');
                if (packageJson.devDependencies?.typescript) {
                    console.log(`   DevDependency: ${packageJson.devDependencies.typescript}`);
                }
                if (packageJson.dependencies?.typescript) {
                    console.log(`   Dependency: ${packageJson.dependencies.typescript}`);
                }

                if (!packageJson.devDependencies?.typescript && !packageJson.dependencies?.typescript) {
                    console.log('   ⚠️  TypeScript not found in package.json');
                }

            } catch (packageError) {
                console.log('   📦 No package.json found');
            }

        } catch (error) {
            this.printError(`Configuration check failed: ${error.message}`);
            process.exit(1);
        }
    }

    async checkTool() {
        try {
            console.log('🔍 Checking TypeScript compiler availability...');
            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                console.log('✅ TypeScript compiler is available');
                // Try to get version
                try {
                    const { execSync } = require('child_process');
                    const version = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
                    console.log(`🔧 Version: ${version}`);
                } catch (e) {
                    try {
                        const version = execSync('tsc --version', { encoding: 'utf8' }).trim();
                        console.log(`🔧 Version: ${version}`);
                    } catch (e2) {
                        console.log('🔧 Version check failed, but compiler is available');
                    }
                }
            } else {
                throw new Error('TypeScript compiler not found');
            }
        } catch (error) {
            console.log(`❌ TypeScript compiler is not available: ${error.message}`);
            console.log('\n📦 To install TypeScript, run:');
            console.log('   npm install typescript');
            console.log('   # or globally:');
            console.log('   npm install -g typescript');
            process.exit(1);
        }
    }

    async showVersion() {
        try {
            console.log('📝 TypeScript CLI v1.0.0');
            console.log('🔧 TypeScript static analysis and compilation checking');

            const isAvailable = await this.adapter.checkAvailability();
            if (isAvailable) {
                try {
                    const { execSync } = require('child_process');
                    const version = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
                    console.log(`📋 ${version}`);
                } catch (e) {
                    console.log('📋 TypeScript available (version check failed)');
                }
            } else {
                console.log('❌ TypeScript compiler not available');
            }
        } catch (error) {
            console.log('📝 TypeScript CLI v1.0.0');
            console.log(`❌ TypeScript not available: ${error.message}`);
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
    const cli = new TypeScriptCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = TypeScriptCLI;
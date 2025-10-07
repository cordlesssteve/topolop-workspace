#!/usr/bin/env node

/**
 * Cargo Audit CLI Interface for Topolop
 * 
 * Command-line interface for Rust security vulnerability scanning using cargo-audit.
 * Provides direct access to cargo-audit adapter functionality with enhanced output formatting.
 *
 * Usage:
 *   node cargo-audit-cli.js [options] <project-path>
 *   node cargo-audit-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const CargoAuditAdapter = require('./cargo-audit-adapter');

class CargoAuditCLI {
    constructor() {
        this.adapter = new CargoAuditAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('cargo-audit-cli')
            .description('Rust security vulnerability scanning using cargo-audit')
            .version('1.0.0')
            .argument('<project-path>', 'Path to Rust project directory')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('-s, --severity <level>', 'Minimum severity level (low, medium, high, critical)', 'low')
            .option('--ignore-unmaintained', 'Ignore vulnerabilities in unmaintained crates')
            .option('--ignore-yanked', 'Ignore vulnerabilities in yanked crates')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '120000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if cargo-audit is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show cargo-audit installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show cargo-audit version information')
            .action(async () => {
                await this.showVersion();
            });

        this.program
            .command('update')
            .description('Update vulnerability database')
            .action(async () => {
                await this.updateDatabase();
            });
    }

    async runAnalysis(projectPath, options) {
        try {
            // Validate project path
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🔒 Starting cargo-audit analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                minSeverity: options.severity,
                ignoreUnmaintained: options.ignoreUnmaintained,
                ignoreYanked: options.ignoreYanked,
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

            // Exit with appropriate code
            const hasCriticalVulns = result.results?.some(r => r.severity === 'critical');
            const hasHighVulns = result.results?.some(r => r.severity === 'high');
            process.exit(hasCriticalVulns ? 2 : hasHighVulns ? 1 : 0);

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

            // Check for Cargo.lock
            const cargoLockPath = path.join(projectPath, 'Cargo.lock');
            try {
                await fs.access(cargoLockPath);
            } catch (error) {
                throw new Error('Cargo.lock not found - ensure dependencies are resolved');
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
        
        console.log('🔒 Cargo Audit Security Summary');
        console.log('═'.repeat(50));
        console.log(`🚨 Total Vulnerabilities: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool Version: ${result.version || 'unknown'}`);
        console.log('');

        if (metadata.totalVulnerabilities > 0) {
            console.log('📊 Severity Breakdown:');
            console.log(`   Critical: ${metadata.criticalCount || 0}`);
            console.log(`   High:     ${metadata.highCount || 0}`);
            console.log(`   Medium:   ${metadata.mediumCount || 0}`);
            console.log(`   Low:      ${metadata.lowCount || 0}`);
        } else {
            console.log('🛡️  No vulnerabilities found! Your dependencies are secure!');
        }
    }

    displayTable(result, options, duration) {
        const { results = [], metadata = {} } = result;

        // Header
        console.log('🔒 Cargo Audit Security Report');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🚨 Vulnerabilities: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('🛡️  No vulnerabilities found! Your Rust dependencies are secure!');
            console.log('');
            console.log('💡 Tips:');
            console.log('   • Run cargo-audit regularly to stay updated');
            console.log('   • Keep dependencies updated with cargo update');
            console.log('   • Consider using cargo-deny for policy enforcement');
            return;
        }

        // Group vulnerabilities by severity
        const bySeverity = this.groupBySeverity(results);

        ['critical', 'high', 'medium', 'low'].forEach(severity => {
            const vulns = bySeverity[severity] || [];
            if (vulns.length === 0) return;

            console.log(`\n${this.getSeverityIcon(severity)} ${severity.toUpperCase()} SEVERITY (${vulns.length} vulnerabilities)`);
            console.log('─'.repeat(80));

            vulns.forEach((vuln, index) => {
                const severityLabel = this.formatSeverity(vuln.severity, options.noColor);
                
                console.log(`${index + 1}. ${severityLabel} ${vuln.title}`);
                console.log(`   📦 Package: ${vuln.metadata?.package || 'unknown'}`);
                console.log(`   🔢 Version: ${vuln.metadata?.version || 'unknown'}`);
                
                if (vuln.metadata?.advisory) {
                    console.log(`   🆔 Advisory: ${vuln.metadata.advisory}`);
                }
                
                if (vuln.metadata?.url) {
                    console.log(`   🔗 URL: ${vuln.metadata.url}`);
                }
                
                if (vuln.description && vuln.description !== vuln.title) {
                    // Truncate long descriptions
                    const desc = vuln.description.length > 100 
                        ? vuln.description.substring(0, 100) + '...'
                        : vuln.description;
                    console.log(`   📝 ${desc}`);
                }

                if (vuln.metadata?.solution) {
                    console.log(`   🔧 Solution: ${vuln.metadata.solution}`);
                }

                console.log('');
            });
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
        
        // Show recommendations
        if (results.length > 0) {
            console.log('\n💡 Recommendations:');
            console.log('   • Update vulnerable dependencies: cargo update');
            console.log('   • Review and audit your Cargo.lock file');
            console.log('   • Consider alternative crates for critical vulnerabilities');
            console.log('   • Implement cargo-deny for automated policy enforcement');
        }
    }

    groupBySeverity(results) {
        const groups = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        results.forEach(result => {
            const severity = result.severity || 'low';
            if (groups[severity]) {
                groups[severity].push(result);
            } else {
                groups.low.push(result);
            }
        });

        return groups;
    }

    getSeverityIcon(severity) {
        const icons = {
            critical: '🚨',
            high: '⚠️',
            medium: '🟡',
            low: '🔵'
        };
        return icons[severity] || '📋';
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity.toUpperCase()}]`;
        }

        const colors = {
            critical: '\x1b[41m\x1b[97m', // White on red background
            high: '\x1b[31m',             // Red
            medium: '\x1b[33m',           // Yellow
            low: '\x1b[36m',              // Cyan
            reset: '\x1b[0m'              // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity.toUpperCase()}]${colors.reset}`;
    }

    async checkTool() {
        try {
            console.log('🔍 Checking cargo-audit availability...');
            await this.adapter.checkToolAvailability();
            const version = await this.adapter.getToolVersion();
            console.log(`✅ cargo-audit is available (version: ${version})`);
        } catch (error) {
            console.log(`❌ cargo-audit is not available: ${error.message}`);
            console.log('\n📦 To install cargo-audit, run:');
            console.log('   cargo install cargo-audit');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        const instructions = this.adapter.getInstallationInstructions();
        
        console.log('📦 Cargo Audit Installation Instructions');
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
            console.log(`🔒 Cargo Audit CLI v1.0.0`);
            console.log(`🔧 cargo-audit version: ${version}`);
        } catch (error) {
            console.log(`🔒 Cargo Audit CLI v1.0.0`);
            console.log(`❌ cargo-audit not available: ${error.message}`);
        }
    }

    async updateDatabase() {
        console.log('🔄 Updating vulnerability database...');
        console.log('💡 Run manually: cargo audit --update');
        console.log('');
        console.log('This will:');
        console.log('   • Download latest vulnerability database');
        console.log('   • Update RustSec advisory database');
        console.log('   • Ensure you have the most recent security information');
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
    const cli = new CargoAuditCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = CargoAuditCLI;
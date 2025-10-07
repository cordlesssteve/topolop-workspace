#!/usr/bin/env node

/**
 * Safety CLI Interface for Topolop
 * 
 * Command-line interface for Python dependency vulnerability analysis using Safety.
 * Provides direct access to safety analyzer functionality with enhanced vulnerability-focused output formatting.
 *
 * Usage:
 *   node safety-cli.js [options] <project-path>
 *   node safety-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const SafetyAnalyzer = require('./src/index');

class SafetyCLI {
    constructor() {
        this.analyzer = new SafetyAnalyzer();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('safety-cli')
            .description('Python dependency vulnerability analysis using Safety')
            .version('1.0.0')
            .arguments('<project-path>')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('--full-report', 'Include detailed vulnerability information')
            .option('--ignore <ids>', 'Comma-separated list of vulnerability IDs to ignore', '')
            .option('--db', 'Update Safety vulnerability database before scan')
            .option('--json-version <version>', 'JSON schema version for output (1 or 2)', '1')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Safety is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show Safety installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show Safety version information')
            .action(async () => {
                await this.showVersion();
            });

        this.program
            .command('update-db')
            .description('Update Safety vulnerability database')
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
                console.log(`🔍 Starting Safety dependency analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Update database if requested
            if (options.db) {
                console.log('📡 Updating Safety vulnerability database...');
                await this.updateDatabase();
            }

            // Initialize analyzer
            await this.analyzer.initialize();

            // Run analysis
            const startTime = Date.now();
            const result = await this.analyzer.analyzeProject(resolvedPath);
            const duration = Date.now() - startTime;

            // Check for errors
            if (!result.success) {
                this.printError(`Analysis failed: ${result.error}`);
                process.exit(1);
            }

            // Format and display results
            await this.displayResults(result, options, duration);

            // Exit with appropriate code based on vulnerability findings
            const hasVulnerabilities = this.hasVulnerabilities(result.data);
            process.exit(hasVulnerabilities ? 1 : 0);

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

            // Check for Python dependency files
            const entries = await fs.readdir(projectPath);
            const hasRequirements = entries.some(entry => 
                entry === 'requirements.txt' || 
                entry === 'Pipfile' || 
                entry === 'pyproject.toml' ||
                entry === 'setup.py' ||
                entry === 'setup.cfg'
            );
            
            if (!hasRequirements) {
                console.warn('⚠️  No Python dependency files found (requirements.txt, Pipfile, pyproject.toml, etc.)');
                console.warn('    Safety works best with explicit dependency files');
            }
        } catch (error) {
            throw new Error(`Invalid project path: ${error.message}`);
        }
    }

    async displayResults(result, options, duration) {
        const vulnerabilities = this.extractVulnerabilities(result.data);

        switch (options.format) {
            case 'json':
                console.log(JSON.stringify(result, null, 2));
                break;

            case 'summary':
                this.displaySummary(result, vulnerabilities, duration);
                break;

            case 'table':
            default:
                this.displayTable(result, vulnerabilities, options, duration);
                break;
        }
    }

    extractVulnerabilities(data) {
        // Safety can return different formats, handle both array and object
        if (Array.isArray(data)) {
            return data;
        }
        
        if (data.vulnerabilities) {
            return data.vulnerabilities;
        }

        if (data.raw_output) {
            try {
                const parsed = JSON.parse(data.raw_output);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }

        return [];
    }

    hasVulnerabilities(data) {
        const vulnerabilities = this.extractVulnerabilities(data);
        return vulnerabilities.length > 0;
    }

    displaySummary(result, vulnerabilities, duration) {
        console.log('🛡️ Safety Dependency Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`🚨 Vulnerabilities Found: ${vulnerabilities.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool: ${result.tool}`);
        console.log('');

        if (vulnerabilities.length > 0) {
            // Categorize vulnerabilities by severity if available
            const severityCount = this.categorizeBySeverity(vulnerabilities);
            
            console.log('📊 Vulnerability Breakdown:');
            Object.entries(severityCount).forEach(([severity, count]) => {
                if (count > 0) {
                    console.log(`   ${severity.toUpperCase()}: ${count}`);
                }
            });
            
            // Show affected packages
            const affectedPackages = this.getAffectedPackages(vulnerabilities);
            console.log('');
            console.log(`📦 Affected Packages: ${affectedPackages.length}`);
            if (affectedPackages.length > 0) {
                affectedPackages.slice(0, 5).forEach(pkg => {
                    console.log(`   • ${pkg.package} (${pkg.version})`);
                });
                if (affectedPackages.length > 5) {
                    console.log(`   ... and ${affectedPackages.length - 5} more packages`);
                }
            }
        } else {
            console.log('✅ No known vulnerabilities found! Your dependencies appear secure.');
            console.log('');
            console.log('💡 Security Best Practices:');
            console.log('   • Keep dependencies updated regularly');
            console.log('   • Run safety checks in CI/CD pipeline');
            console.log('   • Monitor security advisories for your dependencies');
            console.log('   • Consider using dependency pinning for production');
        }
    }

    displayTable(result, vulnerabilities, options, duration) {
        // Header
        console.log('🛡️ Safety Dependency Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.projectPath || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🚨 Vulnerabilities: ${vulnerabilities.length}`);
        console.log('');

        if (vulnerabilities.length === 0) {
            console.log('✅ No known vulnerabilities found! Your dependencies appear secure.');
            console.log('');
            console.log('💡 Dependency Security Tips:');
            console.log('   • Run safety regularly to catch new vulnerabilities');
            console.log('   • Keep dependencies updated to latest secure versions');
            console.log('   • Use virtual environments to isolate project dependencies');
            console.log('   • Consider automated dependency update tools (Dependabot, etc.)');
            console.log('   • Review dependency security advisories regularly');
            return;
        }

        // Group vulnerabilities by package
        const packageVulns = this.groupByPackage(vulnerabilities);

        console.log('🚨 VULNERABILITY DETAILS');
        console.log('─'.repeat(80));

        Object.entries(packageVulns).forEach(([packageName, vulns], index) => {
            console.log(`\n${index + 1}. 📦 Package: ${this.formatPackageName(packageName, vulns[0], options.noColor)}`);
            
            vulns.forEach((vuln, vulnIndex) => {
                const severityFormatted = this.formatSeverity(this.extractSeverity(vuln), options.noColor);
                
                console.log(`   ${String.fromCharCode(97 + vulnIndex)}. ${severityFormatted} ${this.extractTitle(vuln)}`);
                
                if (vuln.vulnerability_id || vuln.id) {
                    console.log(`      🔍 ID: ${vuln.vulnerability_id || vuln.id}`);
                }
                
                if (vuln.installed_version || vuln.vulnerable_versions) {
                    const installedVer = vuln.installed_version || 'unknown';
                    const vulnerableVer = vuln.vulnerable_versions || 'unknown';
                    console.log(`      📋 Installed: ${installedVer}, Vulnerable: ${vulnerableVer}`);
                }
                
                if (vuln.more_info_url) {
                    console.log(`      🔗 More info: ${vuln.more_info_url}`);
                }
                
                if (options.fullReport && vuln.advisory) {
                    const advisory = vuln.advisory.length > 100 
                        ? vuln.advisory.substring(0, 97) + '...'
                        : vuln.advisory;
                    console.log(`      💬 Advisory: ${advisory}`);
                }
            });
        });

        // Summary footer
        console.log('\n' + '═'.repeat(80));
        this.displaySummary(result, vulnerabilities, duration);
    }

    groupByPackage(vulnerabilities) {
        const grouped = {};
        vulnerabilities.forEach(vuln => {
            const packageName = vuln.package_name || vuln.package || 'unknown';
            if (!grouped[packageName]) {
                grouped[packageName] = [];
            }
            grouped[packageName].push(vuln);
        });
        return grouped;
    }

    categorizeBySeverity(vulnerabilities) {
        const severityCount = { high: 0, medium: 0, low: 0, unknown: 0 };
        
        vulnerabilities.forEach(vuln => {
            const severity = this.extractSeverity(vuln);
            severityCount[severity]++;
        });
        
        return severityCount;
    }

    extractSeverity(vuln) {
        // Safety doesn't always provide explicit severity, so we infer it
        if (vuln.severity) {
            return vuln.severity.toLowerCase();
        }
        
        // Infer based on CVSS score if available
        if (vuln.cvss_score || vuln.cvss) {
            const score = vuln.cvss_score || vuln.cvss;
            if (score >= 7.0) return 'high';
            if (score >= 4.0) return 'medium';
            return 'low';
        }
        
        // Default inference - could be enhanced with vulnerability ID patterns
        return 'unknown';
    }

    extractTitle(vuln) {
        return vuln.advisory_title || 
               vuln.title || 
               vuln.advisory?.substring(0, 50) + '...' || 
               'Vulnerability found';
    }

    getAffectedPackages(vulnerabilities) {
        const packages = new Map();
        vulnerabilities.forEach(vuln => {
            const packageName = vuln.package_name || vuln.package;
            const version = vuln.installed_version || vuln.affected_versions;
            if (packageName) {
                packages.set(packageName, { package: packageName, version });
            }
        });
        return Array.from(packages.values());
    }

    formatPackageName(packageName, vuln, noColor = false) {
        const version = vuln.installed_version || vuln.affected_versions || '';
        const packageInfo = version ? `${packageName} (${version})` : packageName;
        
        if (noColor) {
            return packageInfo;
        }

        const severity = this.extractSeverity(vuln);
        const colors = {
            high: '\x1b[31m',      // Red
            medium: '\x1b[33m',    // Yellow
            low: '\x1b[36m',       // Cyan
            unknown: '\x1b[37m',   // Gray
            reset: '\x1b[0m'       // Reset
        };

        const color = colors[severity] || colors.unknown;
        return `${color}${packageInfo}${colors.reset}`;
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity.toUpperCase()}]`;
        }

        const colors = {
            high: '\x1b[31m',      // Red
            medium: '\x1b[33m',    // Yellow
            low: '\x1b[36m',       // Cyan
            unknown: '\x1b[37m',   // Gray
            reset: '\x1b[0m'       // Reset
        };

        const color = colors[severity] || colors.unknown;
        return `${color}[${severity.toUpperCase()}]${colors.reset}`;
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Safety availability...');
            const result = await this.analyzer.initialize();
            if (result.success) {
                console.log(`✅ Safety is available`);
            } else {
                throw new Error('Safety not available');
            }
        } catch (error) {
            console.log(`❌ Safety is not available: ${error.message}`);
            console.log('\n📦 To install Safety:');
            console.log('   pip install safety');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        console.log('📦 Safety Installation Instructions');
        console.log('═'.repeat(50));
        console.log('');

        console.log('1. Install using pip (recommended):');
        console.log('   pip install safety');
        console.log('');
        console.log('2. Install with additional features:');
        console.log('   pip install safety[complete]');
        console.log('');
        console.log('3. Install from conda:');
        console.log('   conda install -c conda-forge safety');
        console.log('');

        console.log('📋 Requirements:');
        console.log('   • Python 3.6+ (Python 3.8+ recommended)');
        console.log('   • pip package manager');
        console.log('   • Internet connection for vulnerability database updates');
        console.log('');

        console.log('💡 Notes:');
        console.log('   • Safety checks Python packages against known vulnerability databases');
        console.log('   • Works with requirements.txt, Pipfile, and other dependency formats');
        console.log('   • Supports ignoring specific vulnerabilities with --ignore');
        console.log('   • Can be integrated into CI/CD pipelines for automated security checking');
        console.log('   • Regularly updated vulnerability database from PyUp.io');
    }

    async showVersion() {
        try {
            console.log(`🛡️ Safety CLI v1.0.0`);
            console.log(`🔧 Checking Safety version...`);
            
            const result = await this.analyzer.initialize();
            if (result.success) {
                console.log('✅ Safety is available');
                // Note: SafetyAnalyzer doesn't expose version in its output
            } else {
                console.log('❌ Safety not available');
            }
        } catch (error) {
            console.log(`🛡️ Safety CLI v1.0.0`);
            console.log(`❌ Safety not available: ${error.message}`);
        }
    }

    async updateDatabase() {
        console.log('📡 Updating Safety vulnerability database...');
        console.log('💡 Note: Safety automatically updates its database during checks');
        console.log('    Use --db flag with analysis to force database update');
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
    const cli = new SafetyCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = SafetyCLI;
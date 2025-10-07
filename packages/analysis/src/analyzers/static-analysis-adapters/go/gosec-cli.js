#!/usr/bin/env node

/**
 * Gosec CLI Interface for Topolop
 * 
 * Command-line interface for Go security analysis using Gosec.
 * Provides direct access to gosec adapter functionality with enhanced security-focused output formatting.
 *
 * Usage:
 *   node gosec-cli.js [options] <project-path>
 *   node gosec-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const GosecAdapter = require('./gosec-adapter');

class GosecCLI {
    constructor() {
        this.adapter = new GosecAdapter();
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('gosec-cli')
            .description('Go security analysis using Gosec')
            .version('1.0.0')
            .arguments('<project-path>')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('-s, --severity <level>', 'Minimum severity level (high, medium, low)', 'low')
            .option('-c, --confidence <level>', 'Minimum confidence level (high, medium, low)', 'low')
            .option('-r, --rules <rules>', 'Comma-separated list of rules to run (e.g., G101,G102)', '')
            .option('-i, --ignore <rules>', 'Comma-separated list of rules to ignore', '')
            .option('--include-tests', 'Include test files in analysis')
            .option('--nosec', 'Track uses of #nosec and report them')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Gosec is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show Gosec installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show Gosec version information')
            .action(async () => {
                await this.showVersion();
            });

        this.program
            .command('list-rules')
            .description('List available Gosec security rules')
            .action(() => {
                this.listAvailableRules();
            });
    }

    async runAnalysis(projectPath, options) {
        try {
            // Validate project path
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🔍 Starting Gosec security analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                timeout: parseInt(options.timeout, 10),
                includeTests: options.includeTests,
                trackNosec: options.nosec,
                severity: options.severity,
                confidence: options.confidence
            };

            // Add specific rules if provided
            if (options.rules) {
                analysisOptions.specificRules = options.rules.split(',').map(r => r.trim());
            }

            // Add ignored rules if provided
            if (options.ignore) {
                analysisOptions.ignoreRules = options.ignore.split(',').map(r => r.trim());
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

            // Exit with appropriate code based on security findings
            const hasCriticalVulnerabilities = result.results?.some(r => 
                r.category === 'security' && r.severity === 'high'
            );
            process.exit(hasCriticalVulnerabilities ? 1 : 0);

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
        
        console.log('🔒 Gosec Security Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`🚨 Security Issues: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Tool Version: ${result.version || 'unknown'}`);
        console.log('');

        if (metadata.totalIssues > 0) {
            console.log('📊 Security Issue Breakdown:');
            console.log(`   High Severity:     ${metadata.highSeverity || 0}`);
            console.log(`   Medium Severity:   ${metadata.mediumSeverity || 0}`);
            console.log(`   Low Severity:      ${metadata.lowSeverity || 0}`);
            console.log('');
            console.log('🔍 Issue Categories:');
            console.log(`   Hardcoded Secrets: ${metadata.hardcodedSecrets || 0}`);
            console.log(`   SQL Injection:     ${metadata.sqlInjection || 0}`);
            console.log(`   Weak Crypto:       ${metadata.weakCrypto || 0}`);
            console.log(`   Path Traversal:    ${metadata.pathTraversal || 0}`);
            console.log(`   Other Security:    ${metadata.otherSecurity || 0}`);
        } else {
            console.log('✅ No security issues found! Your Go code follows excellent security practices!');
        }
    }

    displayTable(result, options, duration) {
        const { results = [], metadata = {} } = result;

        // Header
        console.log('🔒 Gosec Security Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.target || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🚨 Security Issues: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No security issues found! Your Go code follows excellent security practices!');
            console.log('');
            console.log('💡 Security Tips:');
            console.log('   • Run gosec regularly in your CI/CD pipeline');
            console.log('   • Keep dependencies updated to avoid known vulnerabilities');
            console.log('   • Use static analysis alongside dynamic security testing');
            console.log('   • Review code for hardcoded secrets and credentials');
            return;
        }

        // Group issues by severity
        const categorized = this.categorizeIssues(results);

        // Display high severity first
        const severityOrder = ['high', 'medium', 'low'];
        
        severityOrder.forEach(severity => {
            const issues = categorized[severity];
            if (issues.length === 0) return;

            console.log(`\n${this.getSeverityIcon(severity)} ${severity.toUpperCase()} SEVERITY (${issues.length} issues)`);
            console.log('─'.repeat(80));

            issues.slice(0, 15).forEach((issue, index) => { // Limit to first 15 per severity
                const severityFormatted = this.formatSeverity(issue.severity, options.noColor);
                const location = `${issue.file}:${issue.line}:${issue.column}`;
                
                console.log(`${index + 1}. ${severityFormatted} ${issue.title}`);
                console.log(`   📍 ${location}`);
                
                if (issue.metadata?.ruleId) {
                    console.log(`   📋 Rule: ${issue.metadata.ruleId}`);
                }

                if (issue.metadata?.cwe) {
                    console.log(`   🔗 CWE: ${issue.metadata.cwe}`);
                }
                
                if (issue.metadata?.details && issue.metadata.details !== issue.title) {
                    console.log(`   💬 ${issue.metadata.details}`);
                }
                
                if (issue.metadata?.solution) {
                    console.log(`   💡 Fix: ${issue.metadata.solution}`);
                }

                if (issue.metadata?.nosecComment) {
                    console.log(`   ⚠️  #nosec: ${issue.metadata.nosecComment}`);
                }
                
                console.log('');
            });

            if (issues.length > 15) {
                console.log(`   ... and ${issues.length - 15} more ${severity} severity issues`);
                console.log('');
            }
        });

        // Summary footer
        console.log('═'.repeat(80));
        this.displaySummary(result, duration);
    }

    categorizeIssues(results) {
        const categories = {
            high: [],
            medium: [],
            low: []
        };

        results.forEach(issue => {
            const severity = issue.severity || 'low';
            if (categories[severity]) {
                categories[severity].push(issue);
            } else {
                categories.low.push(issue);
            }
        });

        return categories;
    }

    getSeverityIcon(severity) {
        const icons = {
            high: '🚨',
            medium: '⚠️',
            low: '🔍'
        };
        return icons[severity] || '🔍';
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
            console.log('🔍 Checking Gosec availability...');
            await this.adapter.checkToolAvailability();
            const version = await this.adapter.getToolVersion();
            console.log(`✅ Gosec is available (version: ${version})`);
        } catch (error) {
            console.log(`❌ Gosec is not available: ${error.message}`);
            console.log('\n📦 To install Gosec:');
            console.log('   go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        const instructions = this.adapter.getInstallationInstructions();
        
        console.log('📦 Gosec Installation Instructions');
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
            console.log(`🔒 Gosec CLI v1.0.0`);
            console.log(`🔧 Gosec version: ${version}`);
        } catch (error) {
            console.log(`🔒 Gosec CLI v1.0.0`);
            console.log(`❌ Gosec not available: ${error.message}`);
        }
    }

    listAvailableRules() {
        console.log('📋 Gosec Security Rules');
        console.log('═'.repeat(50));
        console.log('');
        
        const ruleCategories = {
            'G101': 'Look for hardcoded credentials',
            'G102': 'Bind to all interfaces',
            'G103': 'Audit the use of unsafe block',
            'G104': 'Audit errors not checked',
            'G105': 'Audit the use of big.Exp function',
            'G106': 'Audit the use of ssh.InsecureIgnoreHostKey',
            'G107': 'Url provided to HTTP request as taint input',
            'G108': 'Profiling endpoint automatically exposed on /debug/pprof',
            'G109': 'Potential Integer overflow made by strconv.Atoi result conversion',
            'G110': 'Potential DoS vulnerability via decompression bomb',
            'G111': 'Potential directory traversal',
            'G112': 'Potential slowloris attack',
            'G113': 'Usage of Rat.SetString in math/big with an overflow',
            'G114': 'Use of net/http serve function that has no support for setting timeouts',
            'G115': 'Potential integer overflow when converting between integer types',
            'G201': 'SQL query construction using format string',
            'G202': 'SQL query construction using string concatenation',
            'G203': 'Use of unescaped data in HTML templates',
            'G204': 'Audit use of command execution',
            'G301': 'Poor file permissions used when creating a directory',
            'G302': 'Poor file permissions used with chmod',
            'G303': 'Creating tempfile using a predictable path',
            'G304': 'File path provided as taint input',
            'G305': 'File traversal when extracting zip/tar archive',
            'G306': 'Poor file permissions used when writing to a new file',
            'G307': 'Poor file permissions used when creating a file with os.Create',
            'G401': 'Detect the usage of DES, RC4, MD5 or SHA1',
            'G402': 'Look for bad TLS connection settings',
            'G403': 'Ensure minimum RSA key length of 2048 bits',
            'G404': 'Insecure random number source (rand)',
            'G501': 'Import blocklist: crypto/md5',
            'G502': 'Import blocklist: crypto/des',
            'G503': 'Import blocklist: crypto/rc4',
            'G504': 'Import blocklist: net/http/cgi',
            'G505': 'Import blocklist: crypto/sha1',
            'G601': 'Implicit memory aliasing of items from a range statement'
        };

        console.log('🔐 Core Security Rules:');
        Object.entries(ruleCategories).forEach(([ruleId, description]) => {
            console.log(`   ${ruleId}: ${description}`);
        });

        console.log('');
        console.log('🔧 Usage Examples:');
        console.log('   --rules G101,G102,G401  # Check specific rules');
        console.log('   --ignore G104           # Ignore specific rules');
        console.log('   --severity high         # Only high severity issues');
        console.log('   --confidence medium     # Medium+ confidence issues');
        console.log('   --include-tests         # Include test files');
        console.log('   --nosec                 # Track #nosec usage');
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
    const cli = new GosecCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = GosecCLI;
#!/usr/bin/env node

/**
 * Bandit CLI Interface for Topolop
 * 
 * Command-line interface for Python security analysis using Bandit.
 * Provides direct access to bandit adapter functionality with enhanced security-focused output formatting.
 *
 * Usage:
 *   node bandit-cli.js [options] <project-path>
 *   node bandit-cli.js --help
 */

const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const BanditAdapter = require('./bandit-adapter');

class BanditCLI {
    constructor() {
        this.adapter = BanditAdapter;
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('bandit-cli')
            .description('Python security analysis using Bandit')
            .version('1.0.0')
            .arguments('<project-path>')
            .option('-f, --format <type>', 'Output format (json, table, summary)', 'table')
            .option('-s, --severity <level>', 'Minimum severity level (HIGH, MEDIUM, LOW)', 'LOW')
            .option('-c, --confidence <level>', 'Minimum confidence level (HIGH, MEDIUM, LOW)', 'LOW')
            .option('-t, --tests <tests>', 'Comma-separated list of tests to run (e.g., B101,B102)', '')
            .option('-i, --skip <tests>', 'Comma-separated list of tests to skip', '')
            .option('-x, --exclude <paths>', 'Comma-separated list of paths to exclude', '')
            .option('--include-test-files', 'Include test files in analysis')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .option('--timeout <ms>', 'Analysis timeout in milliseconds', '300000')
            .action(async (projectPath, options) => {
                await this.runAnalysis(projectPath, options);
            });

        this.program
            .command('check')
            .description('Check if Bandit is available')
            .action(async () => {
                await this.checkTool();
            });

        this.program
            .command('install')
            .description('Show Bandit installation instructions')
            .action(() => {
                this.showInstallationInstructions();
            });

        this.program
            .command('version')
            .description('Show Bandit version information')
            .action(async () => {
                await this.showVersion();
            });

        this.program
            .command('list-tests')
            .description('List available Bandit security tests')
            .action(() => {
                this.listAvailableTests();
            });
    }

    async runAnalysis(projectPath, options) {
        try {
            // Validate project path
            const resolvedPath = path.resolve(projectPath);
            await this.validateProjectPath(resolvedPath);

            if (options.verbose) {
                console.log(`🔍 Starting Bandit security analysis for: ${resolvedPath}`);
                console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);
            }

            // Prepare analysis options
            const analysisOptions = {
                timeout: parseInt(options.timeout, 10),
                includeTestFiles: options.includeTestFiles,
                severity: options.severity,
                confidence: options.confidence
            };

            // Add specific tests if provided
            if (options.tests) {
                analysisOptions.specificTests = options.tests.split(',').map(t => t.trim());
            }

            // Add skip tests if provided
            if (options.skip) {
                analysisOptions.skipTests = options.skip.split(',').map(t => t.trim());
            }

            // Add exclude paths if provided
            if (options.exclude) {
                analysisOptions.excludePaths = options.exclude.split(',').map(p => p.trim());
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
            const hasCriticalVulnerabilities = result.results?.some(issue => 
                issue.issue_severity === 'HIGH'
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

            // Check for Python files
            const entries = await fs.readdir(projectPath);
            const hasPythonFiles = entries.some(entry => entry.endsWith('.py'));
            const hasRequirements = entries.some(entry => 
                entry === 'requirements.txt' || entry === 'setup.py' || entry === 'pyproject.toml'
            );
            
            if (!hasPythonFiles && !hasRequirements) {
                console.warn('⚠️  No .py files or Python project files found - this may not be a Python project');
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
        
        console.log('🔒 Bandit Security Analysis Summary');
        console.log('═'.repeat(50));
        console.log(`🚨 Security Issues: ${results.length}`);
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🔧 Security Score: ${summary.securityScore || 'N/A'}/100`);
        console.log('');

        if (summary.severityCounts && summary.totalIssues > 0) {
            console.log('📊 Security Issue Breakdown:');
            console.log(`   HIGH Severity:     ${summary.severityCounts.HIGH || 0}`);
            console.log(`   MEDIUM Severity:   ${summary.severityCounts.MEDIUM || 0}`);
            console.log(`   LOW Severity:      ${summary.severityCounts.LOW || 0}`);
            console.log('');
            console.log('🔍 Confidence Levels:');
            console.log(`   HIGH Confidence:   ${summary.confidenceCounts?.HIGH || 0}`);
            console.log(`   MEDIUM Confidence: ${summary.confidenceCounts?.MEDIUM || 0}`);
            console.log(`   LOW Confidence:    ${summary.confidenceCounts?.LOW || 0}`);
        } else {
            console.log('✅ No security issues found! Your Python code follows excellent security practices!');
        }

        // Show top vulnerabilities if available
        if (summary.topVulnerabilityTypes && summary.topVulnerabilityTypes.length > 0) {
            console.log('');
            console.log('🎯 Most Common Vulnerability Types:');
            summary.topVulnerabilityTypes.slice(0, 5).forEach((vuln, index) => {
                console.log(`   ${index + 1}. ${vuln.type}: ${vuln.count} occurrences`);
            });
        }
    }

    displayTable(result, options, duration) {
        const { results = [], summary = {} } = result;

        // Header
        console.log('🔒 Bandit Security Analysis Results');
        console.log('═'.repeat(80));
        console.log(`📁 Target: ${result.codebasePath || 'unknown'}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🚨 Security Issues: ${results.length}`);
        console.log(`🔧 Security Score: ${summary.securityScore || 'N/A'}/100`);
        console.log('');

        if (results.length === 0) {
            console.log('✅ No security issues found! Your Python code follows excellent security practices!');
            console.log('');
            console.log('💡 Security Best Practices:');
            console.log('   • Run bandit regularly in your CI/CD pipeline');
            console.log('   • Keep dependencies updated to avoid known vulnerabilities');
            console.log('   • Use static analysis alongside dynamic security testing');
            console.log('   • Review code for hardcoded secrets and credentials');
            console.log('   • Implement proper input validation and sanitization');
            return;
        }

        // Group issues by severity
        const categorized = this.categorizeIssues(results);

        // Display high severity first
        const severityOrder = ['HIGH', 'MEDIUM', 'LOW'];
        
        severityOrder.forEach(severity => {
            const issues = categorized[severity];
            if (issues.length === 0) return;

            console.log(`\n${this.getSeverityIcon(severity)} ${severity} SEVERITY (${issues.length} issues)`);
            console.log('─'.repeat(80));

            issues.slice(0, 15).forEach((issue, index) => { // Limit to first 15 per severity
                const severityFormatted = this.formatSeverity(issue.issue_severity, options.noColor);
                const confidenceFormatted = this.formatConfidence(issue.issue_confidence, options.noColor);
                const location = `${issue.filename}:${issue.line_number}`;
                
                console.log(`${index + 1}. ${severityFormatted} ${confidenceFormatted} ${issue.test_name}`);
                console.log(`   📍 ${location}`);
                
                if (issue.test_id) {
                    console.log(`   📋 Test ID: ${issue.test_id}`);
                }

                if (issue.issue_text) {
                    const description = issue.issue_text.length > 100 
                        ? issue.issue_text.substring(0, 97) + '...'
                        : issue.issue_text;
                    console.log(`   💬 ${description}`);
                }
                
                if (issue.more_info) {
                    console.log(`   🔗 More info: ${issue.more_info}`);
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
            HIGH: [],
            MEDIUM: [],
            LOW: []
        };

        results.forEach(issue => {
            const severity = issue.issue_severity || 'LOW';
            if (categories[severity]) {
                categories[severity].push(issue);
            } else {
                categories.LOW.push(issue);
            }
        });

        return categories;
    }

    getSeverityIcon(severity) {
        const icons = {
            HIGH: '🚨',
            MEDIUM: '⚠️',
            LOW: '🔍'
        };
        return icons[severity] || '🔍';
    }

    formatSeverity(severity, noColor = false) {
        if (noColor) {
            return `[${severity}]`;
        }

        const colors = {
            HIGH: '\x1b[31m',      // Red
            MEDIUM: '\x1b[33m',    // Yellow
            LOW: '\x1b[36m',       // Cyan
            reset: '\x1b[0m'       // Reset
        };

        const color = colors[severity] || colors.reset;
        return `${color}[${severity}]${colors.reset}`;
    }

    formatConfidence(confidence, noColor = false) {
        if (noColor) {
            return `(${confidence})`;
        }

        const colors = {
            HIGH: '\x1b[32m',      // Green
            MEDIUM: '\x1b[33m',    // Yellow
            LOW: '\x1b[37m',       // Gray
            reset: '\x1b[0m'       // Reset
        };

        const color = colors[confidence] || colors.reset;
        return `${color}(${confidence})${colors.reset}`;
    }

    async checkTool() {
        try {
            console.log('🔍 Checking Bandit availability...');
            const available = await this.adapter.checkAvailability();
            if (available) {
                console.log(`✅ Bandit is available`);
            } else {
                throw new Error('Bandit not available');
            }
        } catch (error) {
            console.log(`❌ Bandit is not available: ${error.message}`);
            console.log('\n📦 To install Bandit:');
            console.log('   pip install bandit');
            console.log('   # or');
            console.log('   pip install bandit[toml]  # for pyproject.toml support');
            process.exit(1);
        }
    }

    showInstallationInstructions() {
        console.log('📦 Bandit Installation Instructions');
        console.log('═'.repeat(50));
        console.log('');

        console.log('1. Install using pip (recommended):');
        console.log('   pip install bandit');
        console.log('');
        console.log('2. Install with TOML configuration support:');
        console.log('   pip install bandit[toml]');
        console.log('');
        console.log('3. Install from conda:');
        console.log('   conda install -c conda-forge bandit');
        console.log('');

        console.log('📋 Requirements:');
        console.log('   • Python 3.5+ (Python 3.8+ recommended)');
        console.log('   • pip package manager');
        console.log('');

        console.log('💡 Notes:');
        console.log('   • Bandit analyzes Python AST for common security issues');
        console.log('   • Works with both Python 2 and 3 codebases');
        console.log('   • Supports .bandit configuration files');
        console.log('   • Can be integrated into CI/CD pipelines');
        console.log('   • Extensible with custom security tests');
    }

    async showVersion() {
        try {
            // Bandit adapter doesn't have getToolVersion method, so we'll implement basic version check
            console.log(`🔒 Bandit CLI v1.0.0`);
            console.log(`🔧 Checking Bandit version...`);
            
            const available = await this.adapter.checkAvailability();
            if (available) {
                console.log('✅ Bandit is available (version detection not implemented in adapter)');
            } else {
                console.log('❌ Bandit not available');
            }
        } catch (error) {
            console.log(`🔒 Bandit CLI v1.0.0`);
            console.log(`❌ Bandit not available: ${error.message}`);
        }
    }

    listAvailableTests() {
        console.log('📋 Bandit Security Tests');
        console.log('═'.repeat(50));
        console.log('');
        
        const testCategories = {
            // Injection flaws
            'B101': 'assert_used - Use of assert detected',
            'B102': 'exec_used - Use of exec detected',
            'B103': 'set_bad_file_permissions - chmod setting a permissive mask',
            'B104': 'hardcoded_bind_all_interfaces - Binding to all network interfaces',
            'B105': 'hardcoded_password_string - Possible hardcoded password: string',
            'B106': 'hardcoded_password_funcarg - Possible hardcoded password: function argument',
            'B107': 'hardcoded_password_default - Possible hardcoded password: default',
            'B108': 'hardcoded_tmp_directory - Probable insecure usage of temp file/directory',
            'B110': 'try_except_pass - Try, Except, Pass detected',
            'B112': 'try_except_continue - Try, Except, Continue detected',
            
            // Crypto issues
            'B301': 'pickle - Pickle and modules that wrap it can be unsafe',
            'B302': 'marshal - Deserialization with the marshal module',
            'B303': 'md5 - Use of insecure MD2, MD4, MD5, or SHA1 hash function',
            'B304': 'des - Use of insecure cipher',
            'B305': 'cipher - Use of insecure cipher mode',
            'B306': 'mktemp - Use of insecure and deprecated function (mktemp)',
            'B307': 'eval - Use of possibly insecure function - consider using safer ast.literal_eval',
            'B308': 'mark_safe - Use of mark_safe() may expose cross-site scripting vulnerabilities',
            'B309': 'httpsconnection - Use of HTTPSConnection on older versions of Python prior to 2.7.9',
            'B310': 'urllib_urlopen - Audit url open for permitted schemes',
            'B311': 'random - Standard pseudo-random generators are not suitable for security/cryptographic purposes',
            'B312': 'telnetlib - Telnet-related functions are being called',
            'B313': 'xml_bad_cElementTree - Using xml.etree.cElementTree.XMLParser with XMLParser',
            'B314': 'xml_bad_ElementTree - Using xml.etree.ElementTree.XMLParser with XMLParser',
            'B315': 'xml_bad_expatreader - Using xml.sax.expatreader.ExpatParser with XMLParser',
            'B316': 'xml_bad_expatbuilder - Using xml.dom.expatbuilder.ExpatBuilder with XMLParser',
            'B317': 'xml_bad_sax - Using xml.sax.xmlreader.XMLReader with XMLParser',
            'B318': 'xml_bad_minidom - Using xml.dom.minidom.parseString with XMLParser',
            'B319': 'xml_bad_pulldom - Using xml.dom.pulldom.parseString with XMLParser',
            'B320': 'xml_bad_etree - Using lxml.etree.XMLParser with XMLParser',
            
            // SQL injection
            'B608': 'hardcoded_sql_expressions - Possible SQL injection vector through string-based query construction',
            'B609': 'linux_commands_wildcard_injection - Possible wildcard injection',
            
            // Shell injection
            'B601': 'paramiko_calls - Paramiko call with shell=True identified, security issue',
            'B602': 'subprocess_popen_with_shell_equals_true - subprocess call with shell=True identified',
            'B603': 'subprocess_without_shell_equals_true - subprocess call - check for execution of untrusted input',
            'B604': 'any_other_function_with_shell_equals_true - Function call with shell=True parameter identified',
            'B605': 'start_process_with_a_shell - Starting a process with a shell, possible injection',
            'B606': 'start_process_with_no_shell - Starting a process without a shell',
            'B607': 'start_process_with_partial_path - Starting a process with a partial executable path'
        };

        console.log('🔐 Security Test Categories:');
        Object.entries(testCategories).forEach(([testId, description]) => {
            console.log(`   ${testId}: ${description}`);
        });

        console.log('');
        console.log('🔧 Usage Examples:');
        console.log('   --tests B101,B102,B105  # Run specific tests');
        console.log('   --skip B110,B112        # Skip specific tests');
        console.log('   --severity HIGH         # Only high severity issues');
        console.log('   --confidence MEDIUM     # Medium+ confidence issues');
        console.log('   --exclude tests/        # Exclude test directories');
        console.log('   --include-test-files    # Include test files');
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
    const cli = new BanditCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = BanditCLI;
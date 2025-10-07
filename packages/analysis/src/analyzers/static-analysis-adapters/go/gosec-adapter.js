/**
 * Secure Gosec Adapter for Topolop
 *
 * Security-first implementation for Go security scanning.
 * Implements static security analysis with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Security vulnerabilities → Red security warning towers
 * - Critical security flaws → Towering red alert structures with sirens
 * - SQL injection risks → Purple database connection warning beacons
 * - Cryptographic issues → Blue encrypted vault warning indicators
 * - Input validation issues → Yellow border security checkpoints
 * - File system vulnerabilities → Orange infrastructure warning lights
 *
 * Security Features:
 * - Input validation and sanitization
 * - No code execution (static analysis only)
 * - Resource limits and timeouts
 * - Path traversal protection
 * - Go module workspace analysis only
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Import security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class GosecAdapter {
    constructor() {
        this.toolName = 'gosec';
        this.version = '2.18.0'; // Target version
        this.timeout = resolveConfig('staticAnalysis.go.timeout') || 180000; // 3 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.go.maxFileSize') || 15 * 1024 * 1024; // 15MB
        this.allowedFiles = new Set(['.go', 'go.mod', 'go.sum']);
        this.outputFormats = ['json'];
        this.securityLevel = 'strict';
        this.securityRules = [
            'G101', // Look for hard coded credentials
            'G102', // Bind to all interfaces
            'G103', // Audit the use of unsafe block
            'G104', // Audit errors not checked
            'G105', // Audit the use of math/big.Int.Exp
            'G106', // Audit the use of ssh.InsecureIgnoreHostKey
            'G107', // Url provided to HTTP request as taint input
            'G108', // Profiling endpoint automatically exposed
            'G109', // Potential Integer overflow made by strconv.Atoi result conversion
            'G110', // Potential DoS vulnerability via decompression bomb
            'G201', // SQL query construction using format string
            'G202', // SQL query construction using string concatenation
            'G203', // Use of unescaped data in HTML templates
            'G204', // Audit use of command execution
            'G301', // Poor file permissions used when creating a directory
            'G302', // Poor file permissions used with chmod
            'G303', // Creating tempfile using a predictable path
            'G304', // File path provided as taint input
            'G305', // File traversal when extracting zip/tar archive
            'G306', // Poor file permissions used when writing to a new file
            'G307', // Poor file permissions used when creating a file with os.Create
            'G401', // Detect the usage of DES, RC4, MD5 or SHA1
            'G402', // Look for bad TLS connection settings
            'G403', // Ensure minimum RSA key length of 2048 bits
            'G404', // Insecure random number source (rand)
            'G501', // Import blocklist: crypto/md5
            'G502', // Import blocklist: crypto/des
            'G503', // Import blocklist: crypto/rc4
            'G504', // Import blocklist: net/http/cgi
            'G505', // Import blocklist: crypto/sha1
            'G601', // Implicit memory aliasing of items from a range statement
        ];
    }

    /**
     * Analyze Go project for security vulnerabilities
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);
            const goProjectPath = await this.findGoProject(validatedPath);

            // Check tool availability
            await this.checkToolAvailability();

            // Run gosec analysis
            const rawResults = await this.runGosec(goProjectPath, options);

            // Process and normalize results
            const processedResults = await this.processResults(rawResults, validatedPath);

            // Generate city visualization data
            const cityData = this.generateCityVisualization(processedResults);

            return {
                tool: this.toolName,
                version: await this.getToolVersion(),
                timestamp: new Date().toISOString(),
                target: validatedPath,
                results: processedResults,
                visualization: cityData,
                metadata: {
                    totalVulnerabilities: processedResults.length,
                    criticalCount: processedResults.filter(v => v.severity === 'critical').length,
                    highCount: processedResults.filter(v => v.severity === 'high').length,
                    mediumCount: processedResults.filter(v => v.severity === 'medium').length,
                    lowCount: processedResults.filter(v => v.severity === 'low').length,
                    categoryBreakdown: this.getCategoryBreakdown(processedResults),
                    executionTime: Date.now()
                }
            };
        } catch (error) {
            return {
                tool: this.toolName,
                error: error.message,
                timestamp: new Date().toISOString(),
                target: projectPath
            };
        }
    }

    /**
     * Validate input path and security constraints
     */
    async validateInput(inputPath) {
        // Use existing security validator
        const validation = await securityValidator.validatePath(inputPath, {
            maxFileSize: this.maxFileSize,
            allowedExtensions: ['.go', '.mod', '.sum'],
            checkExists: true,
            preventTraversal: true
        });

        if (!validation.isValid) {
            throw new Error(`Input validation failed: ${validation.error}`);
        }

        return validation.resolvedPath;
    }

    /**
     * Find Go project root
     */
    async findGoProject(projectPath) {
        const possiblePaths = [
            projectPath,
            path.dirname(projectPath), // Handle subdirectories
            path.join(projectPath, '..'), // Handle nested project structures
        ];

        for (const searchPath of possiblePaths) {
            try {
                const goModPath = path.join(searchPath, 'go.mod');
                const stats = await fs.stat(goModPath);
                if (stats.isFile()) {
                    // Validate go.mod content
                    await this.validateGoMod(goModPath);
                    return searchPath;
                }
            } catch (error) {
                // Continue searching
                continue;
            }
        }

        throw new Error('go.mod file not found - not a Go module project');
    }

    /**
     * Validate go.mod file format
     */
    async validateGoMod(goModPath) {
        const content = await fs.readFile(goModPath, 'utf8');

        // Basic format validation
        if (!content.includes('module ') && !content.includes('go ')) {
            throw new Error('Invalid go.mod format - missing module declaration');
        }

        // Size limit check
        if (content.length > this.maxFileSize) {
            throw new Error(`go.mod too large: ${content.length} bytes`);
        }

        return true;
    }

    /**
     * Check if gosec is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('gosec', ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 10000 // 10 second timeout
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`gosec not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`gosec execution error: ${error.message}`));
            });
        });
    }

    /**
     * Run gosec with security constraints
     */
    async runGosec(projectPath, options = {}) {
        return new Promise((resolve, reject) => {
            // Prepare secure command arguments
            const args = [
                '-fmt=json',      // JSON output format
                '-sort',          // Sort output
                '-quiet',         // Reduce noise
                './...'           // Analyze all packages
            ];

            // Add rule inclusions/exclusions
            if (options.excludeRules && options.excludeRules.length > 0) {
                args.push('-exclude', options.excludeRules.join(','));
            }

            if (options.includeRules && options.includeRules.length > 0) {
                args.push('-include', options.includeRules.join(','));
            }

            // Add severity filter
            if (options.severity) {
                args.push('-severity', options.severity);
            }

            // Add confidence filter
            if (options.confidence) {
                args.push('-confidence', options.confidence);
            }

            // Security: Validate all arguments
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid argument type: ${typeof arg}`);
                }

                // Check for shell metacharacters (allow ./... pattern)
                if (/[;&|`$(){}[\\]<>*?~]/.test(arg) && !arg.startsWith('./')) {
                    throw new Error(`Unsafe characters in argument: ${arg}`);
                }

                return arg;
            });

            const process = spawn('gosec', safeArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: this.timeout,
                cwd: projectPath // Set working directory to project root
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                try {
                    // Parse JSON output from gosec
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    // If JSON parsing fails but we have output, it might be an older format
                    if (stdout.trim()) {
                        try {
                            // Try to handle legacy format or partial output
                            const lines = stdout.split('\n').filter(line => line.trim());
                            const fallbackResult = { Issues: [] };

                            for (const line of lines) {
                                try {
                                    const parsed = JSON.parse(line);
                                    if (parsed.file) {
                                        fallbackResult.Issues.push(parsed);
                                    }
                                } catch (e) {
                                    // Skip non-JSON lines
                                }
                            }

                            resolve(fallbackResult);
                        } catch (fallbackError) {
                            reject(new Error(`gosec JSON parse failed: ${parseError.message}`));
                        }
                    } else {
                        reject(new Error(`gosec failed (code ${code}): ${stderr || 'No output'}`));
                    }
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Process and normalize gosec results
     */
    async processResults(rawResults, projectPath) {
        const vulnerabilities = [];

        // Handle both new and legacy gosec output formats
        const issues = rawResults.Issues || rawResults.issues || [];

        for (const issue of issues) {
            const normalized = await this.normalizeGosecIssue(issue, projectPath);
            if (normalized) {
                vulnerabilities.push(normalized);
            }
        }

        return vulnerabilities;
    }

    /**
     * Normalize gosec issue to unified format
     */
    async normalizeGosecIssue(issue, projectPath) {
        // Extract rule information
        const ruleId = issue.rule_id || issue.type || 'unknown';
        const category = this.categorizeRule(ruleId);
        const severity = this.mapSeverity(issue.severity, issue.confidence, ruleId);

        // Parse location information
        const filePath = issue.file || '';
        const line = parseInt(issue.line) || 1;
        const column = parseInt(issue.column) || 1;

        return {
            id: `gosec-${crypto.createHash('md5').update(`${filePath}-${line}-${issue.details}`).digest('hex').substring(0, 8)}`,
            title: issue.details || issue.message || 'Security vulnerability detected',
            description: this.buildDescription(issue, ruleId),
            severity: severity,
            category: 'security',
            subcategory: category,
            file: path.relative(projectPath, filePath),
            line: line,
            column: column,
            endLine: line, // gosec doesn't provide end positions
            endColumn: column + (issue.code?.length || 10),
            tool: this.toolName,
            confidence: this.normalizeConfidence(issue.confidence),
            tags: this.generateTags(ruleId, category),
            metadata: {
                ruleId: ruleId,
                gosecSeverity: issue.severity,
                gosecConfidence: issue.confidence,
                cwe: this.getCWE(ruleId),
                owasp: this.getOWASP(ruleId),
                code: issue.code,
                documentation: this.getDocumentationUrl(ruleId)
            }
        };
    }

    /**
     * Categorize gosec rule based on rule ID
     */
    categorizeRule(ruleId) {
        const categoryMap = {
            'G101': 'credentials',      // Hard coded credentials
            'G102': 'network',          // Bind to all interfaces
            'G103': 'unsafe',           // Unsafe block usage
            'G104': 'error-handling',   // Errors not checked
            'G105': 'crypto',           // Math/big integer issues
            'G106': 'ssh',              // SSH security
            'G107': 'injection',        // URL injection
            'G108': 'information-disclosure', // Profiling endpoint
            'G109': 'overflow',         // Integer overflow
            'G110': 'dos',              // Decompression bomb
            'G201': 'sql-injection',    // SQL injection via format
            'G202': 'sql-injection',    // SQL injection via concatenation
            'G203': 'xss',              // XSS in templates
            'G204': 'command-injection', // Command execution
            'G301': 'file-permissions', // Directory permissions
            'G302': 'file-permissions', // Chmod permissions
            'G303': 'file-security',    // Predictable temp files
            'G304': 'path-traversal',   // File path injection
            'G305': 'path-traversal',   // Archive extraction
            'G306': 'file-permissions', // File permissions
            'G307': 'file-permissions', // os.Create permissions
            'G401': 'weak-crypto',      // Weak cryptography
            'G402': 'tls',              // TLS configuration
            'G403': 'crypto',           // RSA key length
            'G404': 'random',           // Insecure randomness
            'G501': 'weak-crypto',      // MD5 import
            'G502': 'weak-crypto',      // DES import
            'G503': 'weak-crypto',      // RC4 import
            'G504': 'unsafe',           // CGI import
            'G505': 'weak-crypto',      // SHA1 import
            'G601': 'memory',           // Memory aliasing
        };

        return categoryMap[ruleId] || 'general';
    }

    /**
     * Map gosec severity and confidence to unified scale
     */
    mapSeverity(severity, confidence, ruleId) {
        // Convert gosec severity to our scale
        const severityMap = {
            'HIGH': 'high',
            'MEDIUM': 'medium',
            'LOW': 'low'
        };

        let mappedSeverity = severityMap[severity?.toUpperCase()] || 'medium';

        // Adjust based on rule type
        if (ruleId.startsWith('G101') || ruleId.startsWith('G201') || ruleId.startsWith('G202')) {
            // Credentials and SQL injection are always high
            mappedSeverity = 'high';
        }

        if (ruleId.startsWith('G401') || ruleId.startsWith('G402')) {
            // Crypto issues are at least medium
            if (mappedSeverity === 'low') {
                mappedSeverity = 'medium';
            }
        }

        // Adjust based on confidence
        if (confidence === 'LOW' && mappedSeverity === 'high') {
            mappedSeverity = 'medium';
        }

        return mappedSeverity;
    }

    /**
     * Normalize confidence to numeric scale
     */
    normalizeConfidence(confidence) {
        const confidenceMap = {
            'HIGH': 0.9,
            'MEDIUM': 0.7,
            'LOW': 0.5
        };

        return confidenceMap[confidence?.toUpperCase()] || 0.7;
    }

    /**
     * Build comprehensive description
     */
    buildDescription(issue, ruleId) {
        let description = issue.details || issue.message || 'Security vulnerability detected';

        description += `\n\nGosec Rule: ${ruleId}`;
        description += `\nSeverity: ${issue.severity || 'MEDIUM'}`;
        description += `\nConfidence: ${issue.confidence || 'MEDIUM'}`;

        if (issue.code) {
            description += `\n\nVulnerable Code:\n\`\`\`go\n${issue.code}\n\`\`\``;
        }

        const mitigation = this.getMitigation(ruleId);
        if (mitigation) {
            description += `\n\nMitigation: ${mitigation}`;
        }

        return description;
    }

    /**
     * Get CWE mapping for rule
     */
    getCWE(ruleId) {
        const cweMap = {
            'G101': 'CWE-798', // Hard-coded credentials
            'G102': 'CWE-200', // Information exposure
            'G103': 'CWE-242', // Use of inherently dangerous function
            'G104': 'CWE-754', // Improper check for unusual conditions
            'G107': 'CWE-20',  // Improper input validation
            'G201': 'CWE-89',  // SQL injection
            'G202': 'CWE-89',  // SQL injection
            'G203': 'CWE-79',  // Cross-site scripting
            'G204': 'CWE-78',  // OS command injection
            'G304': 'CWE-22',  // Path traversal
            'G305': 'CWE-22',  // Path traversal
            'G401': 'CWE-327', // Use of broken cryptography
            'G402': 'CWE-295', // Improper certificate validation
            'G404': 'CWE-338', // Use of cryptographically weak PRNG
        };

        return cweMap[ruleId] || null;
    }

    /**
     * Get OWASP Top 10 mapping for rule
     */
    getOWASP(ruleId) {
        const owaspMap = {
            'G101': 'A07:2021 – Identification and Authentication Failures',
            'G201': 'A03:2021 – Injection',
            'G202': 'A03:2021 – Injection',
            'G203': 'A03:2021 – Injection',
            'G204': 'A03:2021 – Injection',
            'G304': 'A01:2021 – Broken Access Control',
            'G305': 'A01:2021 – Broken Access Control',
            'G401': 'A02:2021 – Cryptographic Failures',
            'G402': 'A02:2021 – Cryptographic Failures',
            'G404': 'A02:2021 – Cryptographic Failures',
        };

        return owaspMap[ruleId] || null;
    }

    /**
     * Get mitigation advice for rule
     */
    getMitigation(ruleId) {
        const mitigationMap = {
            'G101': 'Use environment variables or secure configuration management for credentials',
            'G102': 'Bind to specific interfaces instead of 0.0.0.0',
            'G103': 'Avoid unsafe operations or carefully validate their necessity',
            'G104': 'Always check and handle errors appropriately',
            'G201': 'Use parameterized queries or prepared statements',
            'G202': 'Use parameterized queries instead of string concatenation',
            'G203': 'Use proper template escaping functions',
            'G204': 'Validate and sanitize all command inputs',
            'G304': 'Validate file paths and use path.Clean()',
            'G305': 'Validate archive contents before extraction',
            'G401': 'Use strong cryptographic algorithms (AES, SHA-256+)',
            'G402': 'Use proper TLS configuration with certificate validation',
            'G404': 'Use crypto/rand instead of math/rand for security-sensitive operations',
        };

        return mitigationMap[ruleId] || 'Review code for security implications';
    }

    /**
     * Generate relevant tags
     */
    generateTags(ruleId, category) {
        const tags = ['go', 'security', 'gosec', category];

        if (ruleId.startsWith('G2')) {
            tags.push('injection');
        }

        if (ruleId.startsWith('G3')) {
            tags.push('file-security');
        }

        if (ruleId.startsWith('G4')) {
            tags.push('cryptography');
        }

        if (ruleId.startsWith('G5')) {
            tags.push('imports');
        }

        return tags;
    }

    /**
     * Get documentation URL for rule
     */
    getDocumentationUrl(ruleId) {
        return `https://securecodewarrior.github.io/gosec-docs/rules/${ruleId.toLowerCase()}.html`;
    }

    /**
     * Generate city visualization data
     */
    generateCityVisualization(vulnerabilities) {
        const buildings = [];
        const districts = [];

        // Group vulnerabilities by file
        const fileVulns = {};
        vulnerabilities.forEach(vuln => {
            const fileName = vuln.file;
            if (!fileVulns[fileName]) {
                fileVulns[fileName] = [];
            }
            fileVulns[fileName].push(vuln);
        });

        // Create buildings for each file with vulnerabilities
        Object.entries(fileVulns).forEach(([fileName, vulns]) => {
            const riskScore = this.calculateRiskScore(vulns);
            const height = this.calculateBuildingHeight(vulns);
            const color = this.getRiskColor(riskScore);

            buildings.push({
                id: `go-security-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 8)}`,
                name: path.basename(fileName),
                height: height,
                color: color,
                position: this.generatePosition(fileName),
                metadata: {
                    type: 'go-security',
                    filePath: fileName,
                    vulnerabilityCount: vulns.length,
                    riskScore: riskScore,
                    tool: this.toolName,
                    categories: this.getCategoryBreakdown(vulns),
                    issues: vulns.map(v => ({
                        id: v.id,
                        severity: v.severity,
                        subcategory: v.subcategory,
                        title: v.title,
                        ruleId: v.metadata?.ruleId
                    }))
                }
            });
        });

        // Create security district
        if (buildings.length > 0) {
            districts.push({
                name: 'Go Security District',
                type: 'security',
                buildings: buildings,
                health: this.calculateDistrictSecurity(vulnerabilities)
            });
        }

        return {
            buildings: buildings,
            districts: districts,
            metadata: {
                totalVulnerabilities: vulnerabilities.length,
                affectedFiles: Object.keys(fileVulns).length,
                averageRiskScore: this.calculateAverageRisk(vulnerabilities),
                tool: this.toolName
            }
        };
    }

    /**
     * Calculate risk score based on vulnerabilities
     */
    calculateRiskScore(vulnerabilities) {
        if (vulnerabilities.length === 0) return 0.0;

        let score = 0.0;
        vulnerabilities.forEach(vuln => {
            switch (vuln.severity) {
                case 'critical': score += 1.0; break;
                case 'high': score += 0.8; break;
                case 'medium': score += 0.5; break;
                case 'low': score += 0.2; break;
            }

            // Weight by confidence
            score *= vuln.confidence;
        });

        return Math.min(1.0, score / vulnerabilities.length);
    }

    /**
     * Calculate building height based on vulnerabilities
     */
    calculateBuildingHeight(vulnerabilities) {
        let baseHeight = 35;

        vulnerabilities.forEach(vuln => {
            switch (vuln.severity) {
                case 'critical': baseHeight += 30; break;
                case 'high': baseHeight += 20; break;
                case 'medium': baseHeight += 12; break;
                case 'low': baseHeight += 6; break;
            }
        });

        return Math.min(baseHeight, 200); // Cap at 200 units
    }

    /**
     * Get color based on risk score
     */
    getRiskColor(riskScore) {
        if (riskScore >= 0.8) return '#8B0000'; // Dark red (critical)
        if (riskScore >= 0.6) return '#DC143C'; // Crimson (high)
        if (riskScore >= 0.4) return '#FF4500'; // Orange red (medium)
        if (riskScore >= 0.2) return '#FFA500'; // Orange (low)
        return '#32CD32'; // Lime green (secure)
    }

    /**
     * Generate pseudo-random position for building
     */
    generatePosition(fileName) {
        // Use file name as seed for consistent positioning
        const hash = crypto.createHash('md5').update(fileName).digest('hex');
        const x = parseInt(hash.substring(0, 8), 16) % 200 - 100; // -100 to 100
        const z = parseInt(hash.substring(8, 16), 16) % 200 - 100; // -100 to 100

        return { x, y: 0, z };
    }

    /**
     * Get category breakdown for metadata
     */
    getCategoryBreakdown(vulnerabilities) {
        const breakdown = {};
        vulnerabilities.forEach(vuln => {
            const category = vuln.subcategory;
            breakdown[category] = (breakdown[category] || 0) + 1;
        });
        return breakdown;
    }

    /**
     * Calculate district security level
     */
    calculateDistrictSecurity(vulnerabilities) {
        if (vulnerabilities.length === 0) return 'excellent';

        const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

        if (criticalCount > 0) return 'critical';
        if (highCount > 5) return 'poor';
        if (highCount > 2) return 'fair';
        if (vulnerabilities.length > 20) return 'poor';
        if (vulnerabilities.length > 10) return 'fair';
        return 'good';
    }

    /**
     * Calculate average risk score
     */
    calculateAverageRisk(vulnerabilities) {
        if (vulnerabilities.length === 0) return 0.0;

        const fileGroups = {};
        vulnerabilities.forEach(vuln => {
            const file = vuln.file;
            if (!fileGroups[file]) fileGroups[file] = [];
            fileGroups[file].push(vuln);
        });

        const scores = Object.values(fileGroups).map(fileVulns =>
            this.calculateRiskScore(fileVulns)
        );

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    /**
     * Get tool version
     */
    async getToolVersion() {
        try {
            const output = await this.checkToolAvailability();
            const match = output.match(/gosec ([\d.]+)/);
            return match ? match[1] : 'unknown';
        } catch (error) {
            return 'not-installed';
        }
    }

    /**
     * Get tool installation instructions
     */
    getInstallationInstructions() {
        return {
            tool: this.toolName,
            instructions: [
                'Install Go from https://golang.org/doc/install',
                'Run: go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest',
                'Verify installation: gosec -version'
            ],
            requirements: [
                'Go toolchain 1.18 or later',
                'Valid Go module project with go.mod',
                'GOPATH or Go modules properly configured'
            ],
            notes: [
                'Gosec runs static security analysis only - no code execution',
                'Works on any valid Go module project',
                'Provides comprehensive security vulnerability detection'
            ]
        };
    }
}

module.exports = GosecAdapter;
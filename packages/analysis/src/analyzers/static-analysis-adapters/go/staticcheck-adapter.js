/**
 * Secure Staticcheck Adapter for Topolop
 *
 * Security-first implementation for Go static analysis.
 * Implements offline analysis with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Static analysis issues → Building structural problems
 * - Unused code → Empty, dark buildings (abandoned structures)
 * - Performance issues → Orange efficiency indicators
 * - Bug patterns → Red warning sirens
 * - Deprecated usage → Weathered, aging building surfaces
 * - Code simplification → Green renovation opportunities
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

class StaticcheckAdapter {
    constructor() {
        this.toolName = 'staticcheck';
        this.version = '2023.1.6'; // Target version
        this.timeout = resolveConfig('staticAnalysis.go.timeout') || 240000; // 4 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.go.maxFileSize') || 15 * 1024 * 1024; // 15MB
        this.allowedFiles = new Set(['.go', 'go.mod', 'go.sum']);
        this.outputFormats = ['json', 'stylish'];
        this.securityLevel = 'strict';
        this.checkCategories = [
            'all',     // All staticcheck checks
            '-SA9003', // Exclude empty branch checks (too noisy)
            '-ST1000'  // Exclude package comment checks (not critical)
        ];
    }

    /**
     * Analyze Go project for static analysis issues
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);
            const goProjectPath = await this.findGoProject(validatedPath);

            // Check tool availability
            await this.checkToolAvailability();

            // Run staticcheck analysis
            const rawResults = await this.runStaticcheck(goProjectPath, options);

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
                    totalIssues: processedResults.length,
                    bugCount: processedResults.filter(i => i.category === 'bug').length,
                    performanceCount: processedResults.filter(i => i.category === 'performance').length,
                    styleCount: processedResults.filter(i => i.category === 'style').length,
                    unusedCount: processedResults.filter(i => i.category === 'unused').length,
                    deprecatedCount: processedResults.filter(i => i.category === 'deprecated').length,
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
     * Check if staticcheck is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('staticcheck', ['-version'], {
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
                    reject(new Error(`staticcheck not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`staticcheck execution error: ${error.message}`));
            });
        });
    }

    /**
     * Run staticcheck with security constraints
     */
    async runStaticcheck(projectPath, options = {}) {
        return new Promise((resolve, reject) => {
            // Prepare secure command arguments
            const args = [
                '-f', 'json',  // JSON output format
                '-checks', this.checkCategories.join(','),
                './...'        // Analyze all packages
            ];

            // Add optional flags based on options
            if (options.unusedOnly) {
                args[2] = 'U1000'; // Only unused code checks
            }

            if (options.tests === false) {
                args.push('-tests=false');
            }

            // Security: Validate all arguments
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid argument type: ${typeof arg}`);
                }

                // Check for shell metacharacters
                if (/[;&|`$(){}[\\]<>*?~]/.test(arg) && !arg.startsWith('./')) {
                    throw new Error(`Unsafe characters in argument: ${arg}`);
                }

                return arg;
            });

            const process = spawn('staticcheck', safeArgs, {
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
                // Parse JSON output from staticcheck
                const lines = stdout.split('\n').filter(line => line.trim());
                const staticcheckIssues = [];

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        staticcheckIssues.push(parsed);
                    } catch (parseError) {
                        // Skip non-JSON lines
                        continue;
                    }
                }

                if (staticcheckIssues.length > 0 || code === 0) {
                    resolve(staticcheckIssues);
                } else {
                    reject(new Error(`staticcheck failed (code ${code}): ${stderr || stdout}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Process and normalize staticcheck results
     */
    async processResults(rawResults, projectPath) {
        const issues = [];

        for (const result of rawResults) {
            const normalized = await this.normalizeStaticcheckIssue(result, projectPath);
            if (normalized) {
                issues.push(normalized);
            }
        }

        return issues;
    }

    /**
     * Normalize staticcheck issue to unified format
     */
    async normalizeStaticcheckIssue(issue, projectPath) {
        // Extract check ID and category
        const checkId = issue.code || 'unknown';
        const category = this.categorizeCheck(checkId);
        const severity = this.mapSeverity(checkId, category);

        // Parse location information
        const location = issue.location || {};
        const filePath = location.filename || '';
        const line = location.line || 1;
        const column = location.column || 1;

        return {
            id: `staticcheck-${crypto.createHash('md5').update(`${filePath}-${line}-${issue.message}`).digest('hex').substring(0, 8)}`,
            title: issue.message,
            description: this.buildDescription(issue, checkId),
            severity: severity,
            category: category,
            subcategory: checkId,
            file: path.relative(projectPath, filePath),
            line: line,
            column: column,
            endLine: location.end?.line || line,
            endColumn: location.end?.column || column,
            tool: this.toolName,
            confidence: this.calculateConfidence(checkId, category),
            tags: this.generateTags(checkId, category),
            metadata: {
                checkId: checkId,
                checkCategory: this.getCheckCategory(checkId),
                suggestion: this.extractSuggestion(issue),
                documentation: this.getDocumentationUrl(checkId)
            }
        };
    }

    /**
     * Categorize staticcheck check based on check ID
     */
    categorizeCheck(checkId) {
        // SA: Static analysis (bugs and correctness)
        if (checkId.startsWith('SA')) {
            return 'bug';
        }

        // S: Code simplification
        if (checkId.startsWith('S')) {
            return 'style';
        }

        // ST: Stylistic issues
        if (checkId.startsWith('ST')) {
            return 'style';
        }

        // QF: Questionable fixes
        if (checkId.startsWith('QF')) {
            return 'suspicious';
        }

        // U: Unused code
        if (checkId.startsWith('U')) {
            return 'unused';
        }

        return 'bug'; // Default to bug for unknown checks
    }

    /**
     * Get detailed check category
     */
    getCheckCategory(checkId) {
        const categoryMap = {
            'SA1': 'Various misuses of the standard library',
            'SA2': 'Concurrency issues',
            'SA3': 'Testing issues',
            'SA4': 'Code that isn\'t really doing anything',
            'SA5': 'Correctness issues',
            'SA6': 'Performance issues',
            'SA9': 'Questionable constructs',
            'S1': 'Code simplification',
            'ST1': 'Stylistic issues',
            'QF1': 'Questionable fixes',
            'U1': 'Unused code'
        };

        const prefix = checkId.substring(0, 3);
        return categoryMap[prefix] || 'Unknown category';
    }

    /**
     * Map check severity based on ID and category
     */
    mapSeverity(checkId, category) {
        // Bug category is typically high severity
        if (category === 'bug') {
            // Concurrency issues are critical
            if (checkId.startsWith('SA2')) {
                return 'high';
            }
            // Correctness issues are high
            if (checkId.startsWith('SA5')) {
                return 'high';
            }
            // Other bugs are medium to high
            return 'medium';
        }

        // Performance issues are medium
        if (checkId.startsWith('SA6')) {
            return 'medium';
        }

        // Unused code is low to medium
        if (category === 'unused') {
            return 'low';
        }

        // Style issues are typically low
        if (category === 'style') {
            return 'low';
        }

        // Suspicious code is medium
        if (category === 'suspicious') {
            return 'medium';
        }

        return 'medium'; // Default
    }

    /**
     * Build comprehensive description
     */
    buildDescription(issue, checkId) {
        let description = issue.message;

        description += `\n\nStaticcheck: ${checkId}`;
        description += `\nCategory: ${this.getCheckCategory(checkId)}`;

        if (issue.related) {
            description += `\n\nRelated locations: ${issue.related.length}`;
        }

        return description;
    }

    /**
     * Extract suggestion from staticcheck issue
     */
    extractSuggestion(issue) {
        // Staticcheck doesn't provide direct suggestions in JSON format
        // but some checks have implicit suggestions
        if (issue.code?.startsWith('S1')) {
            return {
                type: 'simplification',
                message: 'This code can be simplified'
            };
        }

        if (issue.code?.startsWith('U1')) {
            return {
                type: 'removal',
                message: 'This code appears to be unused and can be removed'
            };
        }

        return null;
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(checkId, category) {
        let confidence = 0.85; // Base confidence for staticcheck

        // Higher confidence for well-established checks
        if (checkId.startsWith('SA')) {
            confidence += 0.1;
        }

        // Very high confidence for unused code detection
        if (category === 'unused') {
            confidence += 0.1;
        }

        // Lower confidence for stylistic issues
        if (category === 'style') {
            confidence -= 0.15;
        }

        return Math.min(0.95, Math.max(0.6, confidence));
    }

    /**
     * Generate relevant tags
     */
    generateTags(checkId, category) {
        const tags = ['go', 'static-analysis', category];

        if (checkId.startsWith('SA2')) {
            tags.push('concurrency');
        }

        if (checkId.startsWith('SA3')) {
            tags.push('testing');
        }

        if (checkId.startsWith('SA6')) {
            tags.push('performance');
        }

        if (checkId.startsWith('U1')) {
            tags.push('dead-code');
        }

        return tags;
    }

    /**
     * Get documentation URL for check
     */
    getDocumentationUrl(checkId) {
        return `https://staticcheck.io/docs/checks#${checkId}`;
    }

    /**
     * Generate city visualization data
     */
    generateCityVisualization(issues) {
        const buildings = [];
        const districts = [];

        // Group issues by file
        const fileIssues = {};
        issues.forEach(issue => {
            const fileName = issue.file;
            if (!fileIssues[fileName]) {
                fileIssues[fileName] = [];
            }
            fileIssues[fileName].push(issue);
        });

        // Create buildings for each file with issues
        Object.entries(fileIssues).forEach(([fileName, fileIssueList]) => {
            const codeHealth = this.calculateCodeHealth(fileIssueList);
            const height = this.calculateBuildingHeight(fileIssueList);
            const color = this.getHealthColor(codeHealth);

            buildings.push({
                id: `go-file-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 8)}`,
                name: path.basename(fileName),
                height: height,
                color: color,
                position: this.generatePosition(fileName),
                metadata: {
                    type: 'go-file',
                    filePath: fileName,
                    issueCount: fileIssueList.length,
                    codeHealth: codeHealth,
                    tool: this.toolName,
                    categories: this.getCategoryBreakdown(fileIssueList),
                    issues: fileIssueList.map(i => ({
                        id: i.id,
                        severity: i.severity,
                        category: i.category,
                        title: i.title,
                        checkId: i.subcategory
                    }))
                }
            });
        });

        // Create analysis district
        if (buildings.length > 0) {
            districts.push({
                name: 'Go Static Analysis District',
                type: 'analysis',
                buildings: buildings,
                health: this.calculateDistrictHealth(issues)
            });
        }

        return {
            buildings: buildings,
            districts: districts,
            metadata: {
                totalIssues: issues.length,
                affectedFiles: Object.keys(fileIssues).length,
                averageHealth: this.calculateAverageHealth(issues),
                tool: this.toolName
            }
        };
    }

    /**
     * Calculate code health score based on issues
     */
    calculateCodeHealth(issues) {
        if (issues.length === 0) return 1.0;

        let score = 1.0;
        issues.forEach(issue => {
            switch (issue.category) {
                case 'bug': score -= 0.20; break;
                case 'performance': score -= 0.15; break;
                case 'suspicious': score -= 0.10; break;
                case 'style': score -= 0.05; break;
                case 'unused': score -= 0.03; break;
            }
        });

        return Math.max(0.0, score);
    }

    /**
     * Calculate building height based on issues
     */
    calculateBuildingHeight(issues) {
        let baseHeight = 25;

        issues.forEach(issue => {
            switch (issue.category) {
                case 'bug': baseHeight += 18; break;
                case 'performance': baseHeight += 12; break;
                case 'suspicious': baseHeight += 8; break;
                case 'style': baseHeight += 4; break;
                case 'unused': baseHeight += 2; break;
            }
        });

        return Math.min(baseHeight, 160); // Cap at 160 units
    }

    /**
     * Get color based on health score
     */
    getHealthColor(healthScore) {
        if (healthScore >= 0.9) return '#228B22'; // Forest green (healthy)
        if (healthScore >= 0.7) return '#32CD32'; // Lime green (good)
        if (healthScore >= 0.5) return '#FFD700'; // Gold (fair)
        if (healthScore >= 0.3) return '#FF8C00'; // Dark orange (concerning)
        return '#B22222'; // Fire brick (critical)
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
    getCategoryBreakdown(issues) {
        const breakdown = {};
        issues.forEach(issue => {
            breakdown[issue.category] = (breakdown[issue.category] || 0) + 1;
        });
        return breakdown;
    }

    /**
     * Calculate district health score
     */
    calculateDistrictHealth(issues) {
        if (issues.length === 0) return 'excellent';

        const bugCount = issues.filter(i => i.category === 'bug').length;
        const performanceCount = issues.filter(i => i.category === 'performance').length;

        if (bugCount > 15) return 'critical';
        if (bugCount > 8 || performanceCount > 20) return 'poor';
        if (bugCount > 3 || performanceCount > 10) return 'fair';
        if (issues.length > 80) return 'poor';
        if (issues.length > 40) return 'fair';
        return 'good';
    }

    /**
     * Calculate average health score
     */
    calculateAverageHealth(issues) {
        if (issues.length === 0) return 1.0;

        const fileGroups = {};
        issues.forEach(issue => {
            const file = issue.file;
            if (!fileGroups[file]) fileGroups[file] = [];
            fileGroups[file].push(issue);
        });

        const scores = Object.values(fileGroups).map(fileIssues =>
            this.calculateCodeHealth(fileIssues)
        );

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    /**
     * Get tool version
     */
    async getToolVersion() {
        try {
            const output = await this.checkToolAvailability();
            const match = output.match(/staticcheck ([\d.]+)/);
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
                'Run: go install honnef.co/go/tools/cmd/staticcheck@latest',
                'Verify installation: staticcheck -version'
            ],
            requirements: [
                'Go toolchain 1.18 or later',
                'Valid Go module project with go.mod',
                'GOPATH or Go modules properly configured'
            ],
            notes: [
                'Staticcheck runs static analysis only - no code execution',
                'Works on any valid Go module project',
                'Provides comprehensive analysis of Go code patterns'
            ]
        };
    }
}

module.exports = StaticcheckAdapter;
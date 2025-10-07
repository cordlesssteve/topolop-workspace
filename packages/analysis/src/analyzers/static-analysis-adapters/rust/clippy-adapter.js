/**
 * Secure Clippy Adapter for Topolop
 *
 * Security-first implementation for Rust static analysis and linting.
 * Implements offline code quality analysis with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Code quality issues → Building quality indicators (structural integrity)
 * - High complexity → Darker building colors, structural stress indicators
 * - Performance issues → Orange/yellow warning lights
 * - Style violations → Minor aesthetic imperfections
 * - Best practice violations → Red architectural compliance flags
 * - Deprecated usage → Rust/decay indicators on building surfaces
 *
 * Security Features:
 * - Input validation and sanitization
 * - No arbitrary code execution (check mode only)
 * - Resource limits and timeouts
 * - Path traversal protection
 * - Cargo workspace analysis only
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Import security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class ClippyAdapter {
    constructor() {
        this.toolName = 'clippy';
        this.version = '1.75.0'; // Target Rust version
        this.timeout = resolveConfig('staticAnalysis.rust.timeout') || 180000; // 3 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.rust.maxFileSize') || 10 * 1024 * 1024; // 10MB
        this.allowedFiles = new Set(['.rs', 'Cargo.toml', 'Cargo.lock']);
        this.outputFormats = ['json'];
        this.securityLevel = 'strict';
        this.lintCategories = [
            'clippy::all',
            'clippy::pedantic',
            'clippy::nursery',
            'clippy::cargo'
        ];
    }

    /**
     * Analyze Rust project for code quality issues
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);
            const cargoProjectPath = await this.findCargoProject(validatedPath);

            // Check tool availability
            await this.checkToolAvailability();

            // Run clippy analysis
            const rawResults = await this.runClippy(cargoProjectPath, options);

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
                    correctnessCount: processedResults.filter(i => i.category === 'correctness').length,
                    styleCount: processedResults.filter(i => i.category === 'style').length,
                    complexityCount: processedResults.filter(i => i.category === 'complexity').length,
                    performanceCount: processedResults.filter(i => i.category === 'performance').length,
                    suspiciousCount: processedResults.filter(i => i.category === 'suspicious').length,
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
            allowedExtensions: ['.rs', '.toml', '.lock'],
            checkExists: true,
            preventTraversal: true
        });

        if (!validation.isValid) {
            throw new Error(`Input validation failed: ${validation.error}`);
        }

        return validation.resolvedPath;
    }

    /**
     * Find Cargo project root
     */
    async findCargoProject(projectPath) {
        const possiblePaths = [
            projectPath,
            path.dirname(projectPath), // Handle src/ subdirectories
            path.join(projectPath, '..'), // Handle nested project structures
        ];

        for (const searchPath of possiblePaths) {
            try {
                const cargoTomlPath = path.join(searchPath, 'Cargo.toml');
                const stats = await fs.stat(cargoTomlPath);
                if (stats.isFile()) {
                    // Validate Cargo.toml content
                    await this.validateCargoToml(cargoTomlPath);
                    return searchPath;
                }
            } catch (error) {
                // Continue searching
                continue;
            }
        }

        throw new Error('Cargo.toml file not found - not a Rust project');
    }

    /**
     * Validate Cargo.toml file format
     */
    async validateCargoToml(cargoTomlPath) {
        const content = await fs.readFile(cargoTomlPath, 'utf8');

        // Basic format validation
        if (!content.includes('[package]') && !content.includes('[workspace]')) {
            throw new Error('Invalid Cargo.toml format - missing [package] or [workspace] section');
        }

        // Size limit check
        if (content.length > this.maxFileSize) {
            throw new Error(`Cargo.toml too large: ${content.length} bytes`);
        }

        return true;
    }

    /**
     * Check if clippy is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('cargo', ['clippy', '--version'], {
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
                    reject(new Error(`clippy not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`clippy execution error: ${error.message}`));
            });
        });
    }

    /**
     * Run clippy with security constraints
     */
    async runClippy(projectPath, options = {}) {
        return new Promise((resolve, reject) => {
            // Prepare secure command arguments
            const args = [
                'clippy',
                '--message-format=json',
                '--',
                '--deny', 'warnings'
            ];

            // Add clippy-specific lint categories
            this.lintCategories.forEach(category => {
                args.push('-W', category);
            });

            // Add optional flags based on options
            if (options.strictMode) {
                args.push('-W', 'clippy::restriction');
            }

            if (options.allowDeprecated !== true) {
                args.push('-W', 'deprecated');
            }

            // Security: Validate all arguments
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid argument type: ${typeof arg}`);
                }

                // Check for shell metacharacters
                if (/[;&|`$(){}[\\]<>*?~]/.test(arg)) {
                    throw new Error(`Unsafe characters in argument: ${arg}`);
                }

                return arg;
            });

            const process = spawn('cargo', safeArgs, {
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
                // Parse JSON output from clippy
                const lines = stdout.split('\n').filter(line => line.trim());
                const clippyMessages = [];

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.reason === 'compiler-message') {
                            clippyMessages.push(parsed.message);
                        }
                    } catch (parseError) {
                        // Skip non-JSON lines (compilation output)
                        continue;
                    }
                }

                if (clippyMessages.length > 0 || code === 0) {
                    resolve(clippyMessages);
                } else {
                    reject(new Error(`clippy failed (code ${code}): ${stderr || stdout}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Process and normalize clippy results
     */
    async processResults(rawResults, projectPath) {
        const issues = [];

        for (const message of rawResults) {
            if (message.level === 'error' || message.level === 'warning') {
                const normalized = await this.normalizeClippyMessage(message, projectPath);
                if (normalized) {
                    issues.push(normalized);
                }
            }
        }

        return issues;
    }

    /**
     * Normalize clippy message to unified format
     */
    async normalizeClippyMessage(message, projectPath) {
        const spans = message.spans || [];
        const primarySpan = spans.find(s => s.is_primary) || spans[0];

        if (!primarySpan) {
            return null; // Skip messages without location information
        }

        // Extract clippy lint name from message
        const clippyLintMatch = message.message.match(/`#\[warn\(([^)]+)\)\]`/) ||
                              message.code?.code?.match(/clippy::(.+)/);
        const lintName = clippyLintMatch ? clippyLintMatch[1] : 'unknown';

        // Determine category based on lint name
        const category = this.categorizeLint(lintName);
        const severity = this.mapSeverity(message.level, category);

        return {
            id: `clippy-${crypto.createHash('md5').update(`${primarySpan.file_name}-${primarySpan.line_start}-${message.message}`).digest('hex').substring(0, 8)}`,
            title: message.message,
            description: this.buildDescription(message, lintName),
            severity: severity,
            category: category,
            subcategory: lintName,
            file: path.relative(projectPath, primarySpan.file_name),
            line: primarySpan.line_start,
            column: primarySpan.column_start,
            endLine: primarySpan.line_end || primarySpan.line_start,
            endColumn: primarySpan.column_end || primarySpan.column_start,
            tool: this.toolName,
            confidence: this.calculateConfidence(message, category),
            tags: this.generateTags(lintName, category),
            metadata: {
                lintName: lintName,
                level: message.level,
                clippy_category: category,
                suggestion: this.extractSuggestion(message),
                help: message.help || null
            }
        };
    }

    /**
     * Categorize clippy lint based on lint name
     */
    categorizeLint(lintName) {
        if (lintName.includes('correctness') ||
            lintName.includes('logic') ||
            lintName.includes('panic') ||
            lintName.includes('unreachable') ||
            lintName.includes('wrong')) {
            return 'correctness';
        }

        if (lintName.includes('performance') ||
            lintName.includes('slow') ||
            lintName.includes('allocation') ||
            lintName.includes('clone')) {
            return 'performance';
        }

        if (lintName.includes('style') ||
            lintName.includes('naming') ||
            lintName.includes('format') ||
            lintName.includes('convention')) {
            return 'style';
        }

        if (lintName.includes('complexity') ||
            lintName.includes('cognitive') ||
            lintName.includes('cyclomatic') ||
            lintName.includes('too_many')) {
            return 'complexity';
        }

        if (lintName.includes('suspicious') ||
            lintName.includes('unusual') ||
            lintName.includes('weird') ||
            lintName.includes('redundant')) {
            return 'suspicious';
        }

        return 'style'; // Default category
    }

    /**
     * Map clippy severity to unified scale
     */
    mapSeverity(level, category) {
        // Correctness issues are always high severity
        if (category === 'correctness') {
            return 'high';
        }

        // Performance issues are medium to high
        if (category === 'performance') {
            return level === 'error' ? 'high' : 'medium';
        }

        // Complexity issues are medium
        if (category === 'complexity') {
            return 'medium';
        }

        // Style and suspicious are typically low unless flagged as error
        return level === 'error' ? 'medium' : 'low';
    }

    /**
     * Build comprehensive description
     */
    buildDescription(message, lintName) {
        let description = message.message;

        if (message.help) {
            description += `\n\nHelp: ${message.help}`;
        }

        description += `\n\nClippy lint: ${lintName}`;

        return description;
    }

    /**
     * Extract suggestion from clippy message
     */
    extractSuggestion(message) {
        const spans = message.spans || [];
        const suggestionSpan = spans.find(s => s.suggested_replacement);

        if (suggestionSpan) {
            return {
                replacement: suggestionSpan.suggested_replacement,
                range: {
                    start: { line: suggestionSpan.line_start, column: suggestionSpan.column_start },
                    end: { line: suggestionSpan.line_end, column: suggestionSpan.column_end }
                }
            };
        }

        return null;
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(message, category) {
        let confidence = 0.8; // Base confidence for clippy

        // Higher confidence for correctness issues
        if (category === 'correctness') {
            confidence += 0.15;
        }

        // Lower confidence for style issues
        if (category === 'style') {
            confidence -= 0.2;
        }

        // Higher confidence when suggestion is provided
        if (this.extractSuggestion(message)) {
            confidence += 0.1;
        }

        return Math.min(0.95, Math.max(0.5, confidence));
    }

    /**
     * Generate relevant tags
     */
    generateTags(lintName, category) {
        const tags = ['rust', 'lint', 'code-quality', category];

        if (lintName.includes('unsafe')) {
            tags.push('unsafe');
        }

        if (lintName.includes('async')) {
            tags.push('async');
        }

        if (lintName.includes('macro')) {
            tags.push('macro');
        }

        return tags;
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
            const qualityScore = this.calculateFileQualityScore(fileIssueList);
            const height = this.calculateBuildingHeight(fileIssueList);
            const color = this.getQualityColor(qualityScore);

            buildings.push({
                id: `rust-file-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 8)}`,
                name: path.basename(fileName),
                height: height,
                color: color,
                position: this.generatePosition(fileName),
                metadata: {
                    type: 'rust-file',
                    filePath: fileName,
                    issueCount: fileIssueList.length,
                    qualityScore: qualityScore,
                    tool: this.toolName,
                    categories: this.getCategoryBreakdown(fileIssueList),
                    issues: fileIssueList.map(i => ({
                        id: i.id,
                        severity: i.severity,
                        category: i.category,
                        title: i.title
                    }))
                }
            });
        });

        // Create quality district
        if (buildings.length > 0) {
            districts.push({
                name: 'Rust Code Quality District',
                type: 'quality',
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
                averageQualityScore: this.calculateAverageQuality(issues),
                tool: this.toolName
            }
        };
    }

    /**
     * Calculate file quality score based on issues
     */
    calculateFileQualityScore(issues) {
        if (issues.length === 0) return 1.0;

        let score = 1.0;
        issues.forEach(issue => {
            switch (issue.category) {
                case 'correctness': score -= 0.15; break;
                case 'performance': score -= 0.10; break;
                case 'complexity': score -= 0.08; break;
                case 'suspicious': score -= 0.05; break;
                case 'style': score -= 0.02; break;
            }
        });

        return Math.max(0.0, score);
    }

    /**
     * Calculate building height based on issues
     */
    calculateBuildingHeight(issues) {
        let baseHeight = 30;

        issues.forEach(issue => {
            switch (issue.category) {
                case 'correctness': baseHeight += 20; break;
                case 'performance': baseHeight += 15; break;
                case 'complexity': baseHeight += 12; break;
                case 'suspicious': baseHeight += 8; break;
                case 'style': baseHeight += 3; break;
            }
        });

        return Math.min(baseHeight, 180); // Cap at 180 units
    }

    /**
     * Get color based on quality score
     */
    getQualityColor(qualityScore) {
        if (qualityScore >= 0.9) return '#2E8B57'; // Sea green (excellent)
        if (qualityScore >= 0.7) return '#32CD32'; // Lime green (good)
        if (qualityScore >= 0.5) return '#FFD700'; // Gold (fair)
        if (qualityScore >= 0.3) return '#FF8C00'; // Dark orange (poor)
        return '#DC143C'; // Crimson (critical)
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

        const correctnessCount = issues.filter(i => i.category === 'correctness').length;
        const performanceCount = issues.filter(i => i.category === 'performance').length;

        if (correctnessCount > 10) return 'critical';
        if (correctnessCount > 5 || performanceCount > 15) return 'poor';
        if (correctnessCount > 0 || performanceCount > 5) return 'fair';
        if (issues.length > 50) return 'poor';
        if (issues.length > 20) return 'fair';
        return 'good';
    }

    /**
     * Calculate average quality score
     */
    calculateAverageQuality(issues) {
        if (issues.length === 0) return 1.0;

        const fileGroups = {};
        issues.forEach(issue => {
            const file = issue.file;
            if (!fileGroups[file]) fileGroups[file] = [];
            fileGroups[file].push(issue);
        });

        const scores = Object.values(fileGroups).map(fileIssues =>
            this.calculateFileQualityScore(fileIssues)
        );

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    /**
     * Get tool version
     */
    async getToolVersion() {
        try {
            const output = await this.checkToolAvailability();
            const match = output.match(/clippy ([\d.]+)/);
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
                'Install Rust and Cargo from https://rustup.rs/',
                'Run: rustup component add clippy',
                'Verify installation: cargo clippy --version'
            ],
            requirements: [
                'Rust toolchain with Clippy component',
                'Cargo package manager',
                'Valid Rust project with Cargo.toml'
            ],
            notes: [
                'Clippy runs static analysis only - no code execution',
                'Works on any valid Rust project structure',
                'Provides automatic fix suggestions for many issues'
            ]
        };
    }
}

module.exports = ClippyAdapter;
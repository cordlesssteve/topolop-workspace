/**
 * Secure Clang Static Analyzer for Topolop
 *
 * Security-first implementation for C/C++ static analysis.
 * Implements offline security analysis with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Memory leaks → Red building foundation cracks
 * - Null pointer dereferences → Structural warning signs
 * - Buffer overflows → Building safety violations (red alerts)
 * - Use-after-free → Abandoned building warnings
 * - Dead code → Gray unutilized building sections
 * - Security issues → Red emergency sirens and barriers
 *
 * Security Features:
 * - Direct analysis only (no build system execution)
 * - Pre-compiled analysis mode only
 * - Input validation and sanitization
 * - Resource limits and timeouts
 * - Path traversal protection
 * - Container isolation ready
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class ClangStaticAnalyzer {
    constructor() {
        this.toolName = 'clang-static-analyzer';
        this.version = '15.0.0'; // Target version
        this.timeout = resolveConfig('staticAnalysis.cpp.timeout') || 300000; // 5 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.cpp.maxFileSize') || 5 * 1024 * 1024; // 5MB
        this.allowedExtensions = new Set(['.c', '.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp', '.hxx']);
        this.outputFormats = ['plist'];
        this.securityLevel = 'strict';

        // Secure analysis checkers - focus on security and memory safety
        this.secureCheckers = [
            'core',                    // Core checkers (null dereference, etc.)
            'deadcode',               // Dead code detection
            'security',               // Security-related issues
            'unix',                   // Unix API checkers
            'alpha.security',         // Alpha security checkers
            'alpha.deadcode',         // Alpha dead code checkers
            'alpha.core',             // Alpha core checkers
            'debug.ExprInspection'    // Expression inspection for debugging
        ];

        // Security-focused analysis arguments
        this.secureArgs = [
            '--analyze',              // Run static analysis
            '--analyzer-output=plist-multi-file', // Structured output
            '-Xanalyzer', '-analyzer-eagerly-assume', // Aggressive analysis
            '-Xanalyzer', '-analyzer-checker=core',
            '-Xanalyzer', '-analyzer-checker=deadcode',
            '-Xanalyzer', '-analyzer-checker=security',
            '-Xanalyzer', '-analyzer-checker=unix',
            '-Xanalyzer', '-analyzer-checker=alpha.security',
            '-Xanalyzer', '-analyzer-disable-checker=alpha.security.taint.TaintPropagation', // Too noisy
            '-Xanalyzer', '-analyzer-max-loop=4', // Limit loop analysis for performance
            '-Xanalyzer', '-analyzer-inline-max-stack-depth=4', // Limit recursion
            '-fsyntax-only',          // Don't generate object files
            '-w',                     // Suppress warnings to focus on analysis
            '-std=c11'                // Default to C11 standard
        ];
    }

    /**
     * Analyze C/C++ files for memory safety and security issues
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);

            // Find C/C++ source files
            const targetFiles = await this.findCppFiles(validatedPath);

            if (targetFiles.length === 0) {
                return this.createEmptyResult(validatedPath, 'No C/C++ source files found');
            }

            // Check tool availability
            await this.checkToolAvailability();

            // Create secure temporary directory for analysis output
            const outputDir = await this.createSecureTempDir();

            try {
                // Run Clang Static Analyzer
                const rawResults = await this.runClangAnalyzer(targetFiles, outputDir, options);

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
                        memoryIssues: processedResults.filter(r => r.category === 'memory_safety').length,
                        securityIssues: processedResults.filter(r => r.category === 'security').length,
                        deadCodeIssues: processedResults.filter(r => r.category === 'dead_code').length,
                        filesAnalyzed: targetFiles.length,
                        analysisMode: 'security-focused',
                        executionTime: Date.now()
                    }
                };
            } finally {
                // Cleanup temporary directory
                await this.cleanupTempDir(outputDir);
            }
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
            allowedExtensions: Array.from(this.allowedExtensions),
            checkExists: true,
            preventTraversal: true
        });

        if (!validation.isValid) {
            throw new Error(`Input validation failed: ${validation.error}`);
        }

        return validation.resolvedPath;
    }

    /**
     * Find C/C++ source files in project
     */
    async findCppFiles(projectPath) {
        const files = [];
        const maxFiles = 500; // Limit for performance

        async function scanDirectory(dirPath, depth = 0) {
            // Prevent deep recursion (security limit)
            if (depth > 8 || files.length >= maxFiles) return;

            try {
                const items = await fs.readdir(dirPath, { withFileTypes: true });

                for (const item of items) {
                    if (files.length >= maxFiles) break;

                    const fullPath = path.join(dirPath, item.name);

                    // Skip dangerous directories
                    if (item.isDirectory()) {
                        if (item.name === '.git' ||
                            item.name === 'build' ||
                            item.name === 'cmake-build-debug' ||
                            item.name === 'cmake-build-release' ||
                            item.name === '.vscode' ||
                            item.name === '.idea' ||
                            item.name.startsWith('.')) {
                            continue;
                        }
                        await scanDirectory(fullPath, depth + 1);
                    } else if (item.isFile()) {
                        const ext = path.extname(item.name);
                        if (this.allowedExtensions.has(ext)) {
                            // Validate file size
                            const stats = await fs.stat(fullPath);
                            if (stats.size <= this.maxFileSize) {
                                files.push(fullPath);
                            }
                        }
                    }
                }
            } catch (error) {
                // Skip inaccessible directories
                console.warn(`Skipping directory ${dirPath}: ${error.message}`);
            }
        }

        await scanDirectory(projectPath);
        return files;
    }

    /**
     * Check if Clang Static Analyzer is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('clang', ['--version'], {
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
                    reject(new Error(`Clang not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Clang execution error: ${error.message}`));
            });
        });
    }

    /**
     * Create secure temporary directory for analysis output
     */
    async createSecureTempDir() {
        const tempBase = process.env.TMPDIR || '/tmp';
        const dirName = `topolop-clang-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const tempDir = path.join(tempBase, dirName);

        await fs.mkdir(tempDir, { mode: 0o700 }); // Secure permissions
        return tempDir;
    }

    /**
     * Run Clang Static Analyzer with security constraints
     */
    async runClangAnalyzer(targetFiles, outputDir, options = {}) {
        const analysisResults = [];

        // Analyze files in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < targetFiles.length; i += batchSize) {
            const batch = targetFiles.slice(i, i + batchSize);
            const batchResults = await this.analyzeBatch(batch, outputDir, options);
            analysisResults.push(...batchResults);
        }

        return analysisResults;
    }

    /**
     * Analyze a batch of files
     */
    async analyzeBatch(files, outputDir, options) {
        const results = [];

        for (const file of files) {
            try {
                const fileResult = await this.analyzeFile(file, outputDir, options);
                results.push(...fileResult);
            } catch (error) {
                console.warn(`Failed to analyze ${file}: ${error.message}`);
                // Continue with other files
            }
        }

        return results;
    }

    /**
     * Analyze a single file
     */
    async analyzeFile(filePath, outputDir, options) {
        return new Promise((resolve, reject) => {
            // Determine C++ standard based on file extension
            const ext = path.extname(filePath);
            const isCpp = ['.cpp', '.cc', '.cxx', '.c++'].includes(ext);
            const stdArg = isCpp ? '-std=c++17' : '-std=c11';

            // Prepare secure command arguments
            const outputFile = path.join(outputDir, `${path.basename(filePath)}.plist`);
            const args = [
                ...this.secureArgs.filter(arg => arg !== '-std=c11'), // Remove default std
                stdArg, // Add appropriate standard
                `-o`, outputFile,
                filePath
            ];

            // Security: Validate all arguments
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid argument type: ${typeof arg}`);
                }

                // Check for shell metacharacters
                if (/[;&|`$(){}[\\]<>*?~]/.test(arg) && !arg.startsWith('/')) {
                    throw new Error(`Unsafe characters in argument: ${arg}`);
                }

                return arg;
            });

            const process = spawn('clang', safeArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: this.timeout,
                cwd: path.dirname(filePath), // Set working directory safely
                env: {
                    ...process.env,
                    PATH: process.env.PATH // Keep PATH for tool discovery
                }
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', async (code) => {
                try {
                    // Clang static analyzer can exit with various codes
                    // Check if analysis output was created
                    const hasOutput = await fs.access(outputFile).then(() => true).catch(() => false);

                    if (hasOutput) {
                        // Parse plist output
                        const plistContent = await fs.readFile(outputFile, 'utf8');
                        const issues = await this.parsePlistOutput(plistContent, filePath);
                        resolve(issues);
                    } else {
                        // No issues found or analysis failed
                        resolve([]);
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse output for ${filePath}: ${parseError.message}`);
                    resolve([]);
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Parse Clang Static Analyzer plist output
     */
    async parsePlistOutput(plistContent, sourceFile) {
        const issues = [];

        try {
            // Simple plist parsing - extract issue information
            // Note: For production, consider using a proper plist parser
            const issuePattern = /<key>description<\/key>\s*<string>([^<]+)<\/string>/g;
            const categoryPattern = /<key>category<\/key>\s*<string>([^<]+)<\/string>/g;
            const locationPattern = /<key>line<\/key>\s*<integer>(\d+)<\/integer>/g;

            let match;
            const descriptions = [];
            const categories = [];
            const lines = [];

            // Extract descriptions
            while ((match = issuePattern.exec(plistContent)) !== null) {
                descriptions.push(match[1]);
            }

            // Extract categories
            while ((match = categoryPattern.exec(plistContent)) !== null) {
                categories.push(match[1]);
            }

            // Extract line numbers
            while ((match = locationPattern.exec(plistContent)) !== null) {
                lines.push(parseInt(match[1], 10));
            }

            // Combine extracted data into issues
            const maxIssues = Math.min(descriptions.length, categories.length, lines.length);
            for (let i = 0; i < maxIssues; i++) {
                issues.push({
                    file: sourceFile,
                    line: lines[i] || 1,
                    description: descriptions[i] || 'Unknown issue',
                    category: categories[i] || 'unknown',
                    tool: this.toolName
                });
            }

        } catch (error) {
            console.warn(`Failed to parse plist content: ${error.message}`);
        }

        return issues;
    }

    /**
     * Process and normalize Clang Static Analyzer results
     */
    async processResults(rawResults, projectPath) {
        const issues = [];

        for (const clangIssue of rawResults) {
            const normalized = await this.normalizeIssue(clangIssue, projectPath);
            issues.push(normalized);
        }

        return issues;
    }

    /**
     * Normalize Clang Static Analyzer issue to unified format
     */
    async normalizeIssue(clangIssue, projectPath) {
        // Make path relative to project root
        const relativePath = path.relative(projectPath, clangIssue.file);

        return {
            id: `clang-${crypto.createHash('md5').update(`${relativePath}:${clangIssue.line}:${clangIssue.description}`).digest('hex')}`,
            title: this.generateTitle(clangIssue),
            description: `Clang Static Analyzer: ${clangIssue.description}`,
            severity: this.mapSeverity(clangIssue.category),
            file: relativePath,
            line: clangIssue.line,
            column: 1, // Clang output doesn't always include column
            tool: this.toolName,
            category: this.categorizeIssue(clangIssue.category, clangIssue.description),
            tags: this.generateTags(clangIssue.category, clangIssue.description),
            confidence: 'high', // Clang Static Analyzer has high confidence
            metadata: {
                clangCategory: clangIssue.category,
                rawDescription: clangIssue.description,
                analysisType: 'static'
            }
        };
    }

    /**
     * Generate human-readable title from Clang issue
     */
    generateTitle(clangIssue) {
        const description = clangIssue.description;
        const category = clangIssue.category;

        // Common patterns for better titles
        if (description.includes('null pointer')) {
            return 'Null pointer dereference';
        } else if (description.includes('memory leak')) {
            return 'Memory leak detected';
        } else if (description.includes('use after free')) {
            return 'Use after free';
        } else if (description.includes('buffer overflow')) {
            return 'Buffer overflow risk';
        } else if (description.includes('dead')) {
            return 'Dead code detected';
        } else if (category === 'Security') {
            return 'Security vulnerability';
        } else {
            // Truncate long descriptions
            return description.length > 50 ? description.substring(0, 50) + '...' : description;
        }
    }

    /**
     * Map Clang category to severity
     */
    mapSeverity(category) {
        const severityMap = {
            'Security': 'high',
            'Memory error': 'high',
            'Logic error': 'medium',
            'Dead code': 'low',
            'API Misuse': 'medium',
            'Unix API': 'medium',
            'Core Foundation/Objective-C': 'medium'
        };

        return severityMap[category] || 'medium';
    }

    /**
     * Categorize Clang issue
     */
    categorizeIssue(clangCategory, description) {
        if (clangCategory === 'Security' || description.toLowerCase().includes('security')) {
            return 'security';
        } else if (clangCategory === 'Memory error' ||
                   description.toLowerCase().includes('leak') ||
                   description.toLowerCase().includes('null pointer') ||
                   description.toLowerCase().includes('use after free')) {
            return 'memory_safety';
        } else if (clangCategory === 'Dead code' || description.toLowerCase().includes('dead')) {
            return 'dead_code';
        } else if (clangCategory === 'Logic error') {
            return 'logic_error';
        } else {
            return 'code_quality';
        }
    }

    /**
     * Generate tags for Clang issue
     */
    generateTags(category, description) {
        const tags = ['cpp', 'c', 'static-analysis', 'memory-safety'];

        if (category) {
            tags.push(category.toLowerCase().replace(/\s+/g, '-'));
        }

        if (description) {
            const desc = description.toLowerCase();
            if (desc.includes('null')) tags.push('null-pointer');
            if (desc.includes('leak')) tags.push('memory-leak');
            if (desc.includes('buffer')) tags.push('buffer-safety');
            if (desc.includes('free')) tags.push('memory-management');
            if (desc.includes('security')) tags.push('security');
            if (desc.includes('dead')) tags.push('dead-code');
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
            if (!fileIssues[issue.file]) {
                fileIssues[issue.file] = [];
            }
            fileIssues[issue.file].push(issue);
        });

        // Create buildings for each file with issues
        Object.entries(fileIssues).forEach(([filePath, fileIssueList]) => {
            const memoryRisk = this.calculateMemoryRisk(fileIssueList);
            const height = this.calculateBuildingHeight(fileIssueList);
            const color = this.getBuildingColor(fileIssueList);

            buildings.push({
                id: `cpp-file-${crypto.createHash('md5').update(filePath).digest('hex')}`,
                name: path.basename(filePath),
                height: height,
                color: color,
                position: this.generatePosition(filePath),
                metadata: {
                    type: 'cpp-file',
                    filePath: filePath,
                    issueCount: fileIssueList.length,
                    memoryRisk: memoryRisk,
                    tool: this.toolName,
                    issues: fileIssueList.map(i => ({
                        id: i.id,
                        severity: i.severity,
                        title: i.title,
                        line: i.line,
                        category: i.category
                    }))
                }
            });
        });

        // Create C/C++ safety district
        if (buildings.length > 0) {
            districts.push({
                name: 'C/C++ Memory Safety District',
                type: 'memory_safety',
                buildings: buildings,
                health: this.calculateDistrictHealth(issues)
            });
        }

        return {
            buildings: buildings,
            districts: districts,
            metadata: {
                totalIssues: issues.length,
                uniqueFiles: Object.keys(fileIssues).length,
                tool: this.toolName
            }
        };
    }

    /**
     * Calculate memory risk level for a file
     */
    calculateMemoryRisk(issues) {
        const memoryIssues = issues.filter(i => i.category === 'memory_safety').length;
        const securityIssues = issues.filter(i => i.category === 'security').length;

        if (securityIssues > 0 || memoryIssues > 3) return 'critical';
        if (memoryIssues > 1) return 'high';
        if (memoryIssues > 0) return 'medium';
        return 'low';
    }

    /**
     * Calculate building height based on issues
     */
    calculateBuildingHeight(issues) {
        let baseHeight = 25;

        issues.forEach(issue => {
            switch (issue.severity) {
                case 'high': baseHeight += 30; break;
                case 'medium': baseHeight += 15; break;
                case 'low': baseHeight += 8; break;
                default: baseHeight += 5; break;
            }
        });

        return Math.min(baseHeight, 250); // Cap at 250 units
    }

    /**
     * Get building color based on issue types
     */
    getBuildingColor(issues) {
        const hasMemoryIssues = issues.some(i => i.category === 'memory_safety');
        const hasSecurityIssues = issues.some(i => i.category === 'security');
        const hasHighSeverity = issues.some(i => i.severity === 'high');

        if (hasSecurityIssues) {
            return '#8B0000'; // Dark red for security issues
        } else if (hasMemoryIssues && hasHighSeverity) {
            return '#DC143C'; // Crimson for memory safety issues
        } else if (hasMemoryIssues) {
            return '#FF4500'; // Orange red for memory issues
        } else if (hasHighSeverity) {
            return '#FF6347'; // Tomato for high severity
        } else {
            return '#FFA500'; // Orange for other issues
        }
    }

    /**
     * Generate pseudo-random position for building
     */
    generatePosition(filePath) {
        // Use file path as seed for consistent positioning
        const hash = crypto.createHash('md5').update(filePath).digest('hex');
        const x = parseInt(hash.substring(0, 8), 16) % 300 - 150; // -150 to 150
        const z = parseInt(hash.substring(8, 16), 16) % 300 - 150; // -150 to 150

        return { x, y: 0, z };
    }

    /**
     * Calculate district health score
     */
    calculateDistrictHealth(issues) {
        if (issues.length === 0) return 'excellent';

        const securityCount = issues.filter(i => i.category === 'security').length;
        const memoryCount = issues.filter(i => i.category === 'memory_safety').length;
        const highSeverityCount = issues.filter(i => i.severity === 'high').length;

        if (securityCount > 0 || highSeverityCount > 10) return 'critical';
        if (memoryCount > 15 || highSeverityCount > 5) return 'poor';
        if (memoryCount > 5 || highSeverityCount > 0) return 'fair';
        if (issues.length > 20) return 'good';
        return 'excellent';
    }

    /**
     * Cleanup temporary directory
     */
    async cleanupTempDir(tempDir) {
        try {
            await fs.rmdir(tempDir, { recursive: true });
        } catch (error) {
            console.warn(`Failed to cleanup temp directory ${tempDir}: ${error.message}`);
        }
    }

    /**
     * Create empty result for no files found
     */
    createEmptyResult(projectPath, reason) {
        return {
            tool: this.toolName,
            version: 'unknown',
            timestamp: new Date().toISOString(),
            target: projectPath,
            results: [],
            visualization: {
                buildings: [],
                districts: [],
                metadata: { totalIssues: 0, uniqueFiles: 0, tool: this.toolName }
            },
            metadata: {
                totalIssues: 0,
                memoryIssues: 0,
                securityIssues: 0,
                deadCodeIssues: 0,
                filesAnalyzed: 0,
                analysisMode: 'security-focused',
                executionTime: Date.now(),
                reason: reason
            }
        };
    }

    /**
     * Get tool version
     */
    async getToolVersion() {
        try {
            const output = await this.checkToolAvailability();
            const match = output.match(/clang version (\d+\.\d+\.\d+)/);
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
                'Install LLVM/Clang from https://llvm.org/',
                'On Ubuntu: sudo apt install clang',
                'On macOS: xcode-select --install',
                'Verify installation: clang --version'
            ],
            requirements: [
                'LLVM/Clang compiler suite',
                'C/C++ development headers',
                'Read access to source files'
            ],
            notes: [
                'Clang Static Analyzer runs without compiling code',
                'Analysis focuses on memory safety and security',
                'No build system execution required'
            ]
        };
    }
}

module.exports = new ClangStaticAnalyzer();
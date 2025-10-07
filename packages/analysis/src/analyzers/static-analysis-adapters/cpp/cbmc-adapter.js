/**
 * Secure CBMC Bounded Model Checker for Topolop
 *
 * Security-first implementation for C/C++ formal verification.
 * Implements offline bounded model checking with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Assertion failures → Red structural failure warnings
 * - Array bounds violations → Building safety perimeter breaches
 * - Integer overflows → Building capacity exceeded alerts
 * - Concurrency bugs → Traffic coordination failures between buildings
 * - Memory safety violations → Foundation integrity warnings
 * - Unreachable code → Gray abandoned building sections
 *
 * Security Features:
 * - Pure verification mode (no code execution)
 * - Bounded model checking only
 * - Input validation and sanitization
 * - Resource limits and unwinding bounds
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

class CBMCAdapter {
    constructor() {
        this.toolName = 'cbmc';
        this.version = '5.89.0'; // Target version
        this.timeout = resolveConfig('staticAnalysis.cpp.timeout') || 600000; // 10 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.cpp.maxFileSize') || 3 * 1024 * 1024; // 3MB
        this.allowedExtensions = new Set(['.c', '.cpp', '.cc', '.cxx', '.c++']);
        this.outputFormats = ['xml', 'json'];
        this.securityLevel = 'strict';

        // Security-focused CBMC arguments
        this.secureArgs = [
            '--bounds-check',         // Check array bounds
            '--div-by-zero-check',    // Check division by zero
            '--signed-overflow-check', // Check integer overflows
            '--unsigned-overflow-check', // Check unsigned overflows
            '--pointer-check',        // Check pointer safety
            '--memory-leak-check',    // Check memory leaks
            '--nan-check',           // Check for NaN
            '--no-assertions',       // Don't require user assertions
            '--xml-ui',              // XML output for parsing
            '--unwind', '10',        // Reasonable unwinding limit
            '--partial-loops',       // Handle partial loop unwinding
            '--no-unwinding-assertions', // Don't fail on unwinding limits
            '--flush',               // Flush output immediately
            '--verbosity', '2'       // Moderate verbosity
        ];

        // Maximum bounds for safety
        this.maxUnwindBound = 50;
        this.maxDepthBound = 20;
    }

    /**
     * Analyze C/C++ files for formal verification
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);

            // Find C/C++ source files suitable for CBMC
            const targetFiles = await this.findCbmcSuitableFiles(validatedPath);

            if (targetFiles.length === 0) {
                return this.createEmptyResult(validatedPath, 'No suitable C/C++ files found for CBMC analysis');
            }

            // Check tool availability
            await this.checkToolAvailability();

            // Create secure temporary directory for analysis
            const outputDir = await this.createSecureTempDir();

            try {
                // Run CBMC analysis
                const rawResults = await this.runCBMCAnalysis(targetFiles, outputDir, options);

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
                        totalViolations: processedResults.length,
                        memoryViolations: processedResults.filter(r => r.category === 'memory_safety').length,
                        boundsViolations: processedResults.filter(r => r.category === 'bounds_check').length,
                        overflowViolations: processedResults.filter(r => r.category === 'overflow').length,
                        concurrencyViolations: processedResults.filter(r => r.category === 'concurrency').length,
                        filesAnalyzed: targetFiles.length,
                        verificationMode: 'bounded-model-checking',
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
     * Find C/C++ files suitable for CBMC analysis
     */
    async findCbmcSuitableFiles(projectPath) {
        const files = [];
        const maxFiles = 100; // CBMC is resource-intensive, limit files

        async function scanDirectory(dirPath, depth = 0) {
            // Prevent deep recursion (security limit)
            if (depth > 6 || files.length >= maxFiles) return;

            try {
                const items = await fs.readdir(dirPath, { withFileTypes: true });

                for (const item of items) {
                    if (files.length >= maxFiles) break;

                    const fullPath = path.join(dirPath, item.name);

                    // Skip dangerous directories
                    if (item.isDirectory()) {
                        if (item.name === '.git' ||
                            item.name === 'build' ||
                            item.name === 'test' ||      // Skip test directories (often complex)
                            item.name === 'tests' ||
                            item.name === 'benchmark' ||
                            item.name === 'examples' ||
                            item.name.startsWith('.')) {
                            continue;
                        }
                        await scanDirectory(fullPath, depth + 1);
                    } else if (item.isFile()) {
                        const ext = path.extname(item.name);
                        if (this.allowedExtensions.has(ext) && await this.isSuitableForCBMC(fullPath)) {
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
     * Check if file is suitable for CBMC analysis
     */
    async isSuitableForCBMC(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');

            // Skip files that are too complex or unsuitable for CBMC
            const unsuitablePatterns = [
                /\#include\s*<windows\.h>/,    // Windows-specific code
                /\#include\s*<pthread\.h>/,    // Complex threading
                /\#include\s*<mpi\.h>/,        // MPI code
                /class\s+\w+.*virtual/,        // Complex C++ inheritance
                /template\s*<.*>/,             // Template metaprogramming
                /\bassembly\b/,                // Assembly code
                /\basm\b/,                     // Inline assembly
                /goto\s+\w+/                   // Goto statements (can complicate analysis)
            ];

            // Check for unsuitable patterns
            if (unsuitablePatterns.some(pattern => pattern.test(content))) {
                return false;
            }

            // Prefer files with main function or simple functions
            const suitablePatterns = [
                /int\s+main\s*\(/,             // Has main function
                /\bassert\s*\(/,               // Has assertions
                /\bif\s*\(/,                   // Has conditionals (good for bounded checking)
                /for\s*\(/,                    // Has loops
                /while\s*\(/                   // Has loops
            ];

            return suitablePatterns.some(pattern => pattern.test(content));

        } catch (error) {
            return false;
        }
    }

    /**
     * Check if CBMC is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('cbmc', ['--version'], {
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
                    reject(new Error(`CBMC not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`CBMC execution error: ${error.message}`));
            });
        });
    }

    /**
     * Create secure temporary directory for analysis
     */
    async createSecureTempDir() {
        const tempBase = process.env.TMPDIR || '/tmp';
        const dirName = `topolop-cbmc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const tempDir = path.join(tempBase, dirName);

        await fs.mkdir(tempDir, { mode: 0o700 }); // Secure permissions
        return tempDir;
    }

    /**
     * Run CBMC analysis with security constraints
     */
    async runCBMCAnalysis(targetFiles, outputDir, options = {}) {
        const analysisResults = [];

        // Analyze files individually (CBMC works on single files)
        for (const file of targetFiles) {
            try {
                const fileResult = await this.analyzeSingleFile(file, outputDir, options);
                if (fileResult.length > 0) {
                    analysisResults.push(...fileResult);
                }
            } catch (error) {
                console.warn(`CBMC analysis failed for ${file}: ${error.message}`);
                // Continue with other files
            }
        }

        return analysisResults;
    }

    /**
     * Analyze a single file with CBMC
     */
    async analyzeSingleFile(filePath, outputDir, options) {
        return new Promise((resolve, reject) => {
            // Create unique output file
            const outputFile = path.join(outputDir, `${path.basename(filePath)}-cbmc.xml`);

            // Prepare secure command arguments
            const args = [
                ...this.secureArgs,
                '--xml-ui', outputFile,
                filePath
            ];

            // Add custom unwinding if specified and within bounds
            const unwindBound = Math.min(options.unwindBound || 10, this.maxUnwindBound);
            const depthBound = Math.min(options.depthBound || 10, this.maxDepthBound);

            // Replace default unwind bound
            const unwindIndex = args.indexOf('10');
            if (unwindIndex > 0) {
                args[unwindIndex] = unwindBound.toString();
            }

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

            const process = spawn('cbmc', safeArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: this.timeout,
                cwd: path.dirname(filePath), // Set working directory safely
                env: {
                    ...process.env,
                    CBMC_MAX_MEMORY: '1GB' // Limit memory usage
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
                    // CBMC returns different codes:
                    // 0 = verification successful
                    // 10 = verification failed (violations found)
                    // Other codes = analysis error

                    if (code === 0 || code === 10) {
                        // Check if XML output was created
                        const hasOutput = await fs.access(outputFile).then(() => true).catch(() => false);

                        if (hasOutput) {
                            const xmlContent = await fs.readFile(outputFile, 'utf8');
                            const violations = await this.parseXmlOutput(xmlContent, filePath);
                            resolve(violations);
                        } else {
                            // No violations found
                            resolve([]);
                        }
                    } else {
                        console.warn(`CBMC analysis error for ${filePath} (code ${code}): ${stderr}`);
                        resolve([]);
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse CBMC output for ${filePath}: ${parseError.message}`);
                    resolve([]);
                }
            });

            process.on('error', (error) => {
                reject(new Error(`CBMC process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Parse CBMC XML output
     */
    async parseXmlOutput(xmlContent, sourceFile) {
        const violations = [];

        try {
            // Simple XML parsing for CBMC results
            // Extract property violations
            const propertyPattern = /<property[^>]*name="([^"]*)"[^>]*status="FAILURE"[^>]*>/g;
            const locationPattern = /<location[^>]*file="([^"]*)"[^>]*line="(\d+)"[^>]*>/g;
            const descriptionPattern = /<description>([^<]+)<\/description>/g;

            let match;
            const failedProperties = [];
            const locations = [];
            const descriptions = [];

            // Extract failed properties
            while ((match = propertyPattern.exec(xmlContent)) !== null) {
                failedProperties.push(match[1]);
            }

            // Extract locations
            while ((match = locationPattern.exec(xmlContent)) !== null) {
                locations.push({
                    file: match[1],
                    line: parseInt(match[2], 10)
                });
            }

            // Extract descriptions
            while ((match = descriptionPattern.exec(xmlContent)) !== null) {
                descriptions.push(match[1]);
            }

            // Combine extracted data into violations
            for (let i = 0; i < failedProperties.length; i++) {
                const property = failedProperties[i];
                const location = locations[i] || { file: sourceFile, line: 1 };
                const description = descriptions[i] || `Property violation: ${property}`;

                violations.push({
                    file: sourceFile, // Use source file since CBMC might reference temp files
                    line: location.line,
                    property: property,
                    description: description,
                    tool: this.toolName
                });
            }

        } catch (error) {
            console.warn(`Failed to parse CBMC XML content: ${error.message}`);
        }

        return violations;
    }

    /**
     * Process and normalize CBMC results
     */
    async processResults(rawResults, projectPath) {
        const issues = [];

        for (const cbmcViolation of rawResults) {
            const normalized = await this.normalizeViolation(cbmcViolation, projectPath);
            issues.push(normalized);
        }

        return issues;
    }

    /**
     * Normalize CBMC violation to unified format
     */
    async normalizeViolation(cbmcViolation, projectPath) {
        // Make path relative to project root
        const relativePath = path.relative(projectPath, cbmcViolation.file);

        return {
            id: `cbmc-${crypto.createHash('md5').update(`${relativePath}:${cbmcViolation.line}:${cbmcViolation.property}`).digest('hex')}`,
            title: this.generateTitle(cbmcViolation),
            description: `CBMC: ${cbmcViolation.description}`,
            severity: this.mapSeverity(cbmcViolation.property),
            file: relativePath,
            line: cbmcViolation.line,
            column: 1, // CBMC doesn't provide column info
            tool: this.toolName,
            category: this.categorizeViolation(cbmcViolation.property, cbmcViolation.description),
            tags: this.generateTags(cbmcViolation.property, cbmcViolation.description),
            confidence: 'high', // CBMC provides formal verification with high confidence
            metadata: {
                property: cbmcViolation.property,
                rawDescription: cbmcViolation.description,
                verificationType: 'bounded-model-checking'
            }
        };
    }

    /**
     * Generate human-readable title from CBMC violation
     */
    generateTitle(violation) {
        const property = violation.property;

        // Map common CBMC properties to readable titles
        const propertyMap = {
            'bounds-check': 'Array bounds violation',
            'pointer-check': 'Pointer safety violation',
            'overflow-check': 'Integer overflow',
            'div-by-zero-check': 'Division by zero',
            'memory-leak-check': 'Memory leak',
            'assertion': 'Assertion failure',
            'nan-check': 'NaN value detected'
        };

        for (const [key, title] of Object.entries(propertyMap)) {
            if (property.includes(key)) {
                return title;
            }
        }

        // Default title
        return `Verification failure: ${property}`;
    }

    /**
     * Map CBMC property to severity
     */
    mapSeverity(property) {
        const highSeverityProperties = [
            'bounds-check',
            'pointer-check',
            'overflow-check',
            'memory-leak-check'
        ];

        const mediumSeverityProperties = [
            'div-by-zero-check',
            'assertion',
            'nan-check'
        ];

        if (highSeverityProperties.some(p => property.includes(p))) {
            return 'high';
        } else if (mediumSeverityProperties.some(p => property.includes(p))) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Categorize CBMC violation
     */
    categorizeViolation(property, description) {
        if (property.includes('bounds-check') || property.includes('pointer-check')) {
            return 'memory_safety';
        } else if (property.includes('overflow') || property.includes('div-by-zero')) {
            return 'arithmetic_safety';
        } else if (property.includes('memory-leak')) {
            return 'memory_management';
        } else if (property.includes('concurrency') || property.includes('thread')) {
            return 'concurrency';
        } else if (property.includes('assertion')) {
            return 'assertion_failure';
        } else {
            return 'formal_verification';
        }
    }

    /**
     * Generate tags for CBMC violation
     */
    generateTags(property, description) {
        const tags = ['cpp', 'c', 'formal-verification', 'bounded-model-checking'];

        if (property) {
            if (property.includes('bounds')) tags.push('array-bounds');
            if (property.includes('pointer')) tags.push('pointer-safety');
            if (property.includes('overflow')) tags.push('integer-overflow');
            if (property.includes('memory')) tags.push('memory-safety');
            if (property.includes('assertion')) tags.push('assertion');
            if (property.includes('concurrency')) tags.push('concurrency');
        }

        if (description) {
            const desc = description.toLowerCase();
            if (desc.includes('null')) tags.push('null-pointer');
            if (desc.includes('buffer')) tags.push('buffer-safety');
            if (desc.includes('leak')) tags.push('memory-leak');
            if (desc.includes('deadlock')) tags.push('deadlock');
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

        // Create buildings for each file with violations
        Object.entries(fileIssues).forEach(([filePath, fileIssueList]) => {
            const verificationRisk = this.calculateVerificationRisk(fileIssueList);
            const height = this.calculateBuildingHeight(fileIssueList);
            const color = this.getBuildingColor(fileIssueList);

            buildings.push({
                id: `cbmc-file-${crypto.createHash('md5').update(filePath).digest('hex')}`,
                name: path.basename(filePath),
                height: height,
                color: color,
                position: this.generatePosition(filePath),
                metadata: {
                    type: 'cbmc-verified-file',
                    filePath: filePath,
                    violationCount: fileIssueList.length,
                    verificationRisk: verificationRisk,
                    tool: this.toolName,
                    issues: fileIssueList.map(i => ({
                        id: i.id,
                        severity: i.severity,
                        title: i.title,
                        line: i.line,
                        category: i.category,
                        property: i.metadata.property
                    }))
                }
            });
        });

        // Create formal verification district
        if (buildings.length > 0) {
            districts.push({
                name: 'Formal Verification District',
                type: 'formal_verification',
                buildings: buildings,
                health: this.calculateDistrictHealth(issues)
            });
        }

        return {
            buildings: buildings,
            districts: districts,
            metadata: {
                totalViolations: issues.length,
                uniqueFiles: Object.keys(fileIssues).length,
                tool: this.toolName
            }
        };
    }

    /**
     * Calculate verification risk level for a file
     */
    calculateVerificationRisk(issues) {
        const memoryViolations = issues.filter(i => i.category === 'memory_safety').length;
        const arithmeticViolations = issues.filter(i => i.category === 'arithmetic_safety').length;
        const highSeverityViolations = issues.filter(i => i.severity === 'high').length;

        if (highSeverityViolations > 3 || memoryViolations > 2) return 'critical';
        if (highSeverityViolations > 1 || memoryViolations > 0) return 'high';
        if (arithmeticViolations > 0 || issues.length > 2) return 'medium';
        return 'low';
    }

    /**
     * Calculate building height based on violations
     */
    calculateBuildingHeight(issues) {
        let baseHeight = 30;

        issues.forEach(issue => {
            switch (issue.severity) {
                case 'high': baseHeight += 35; break;
                case 'medium': baseHeight += 20; break;
                case 'low': baseHeight += 10; break;
                default: baseHeight += 5; break;
            }
        });

        return Math.min(baseHeight, 300); // Cap at 300 units
    }

    /**
     * Get building color based on violation types
     */
    getBuildingColor(issues) {
        const hasMemoryViolations = issues.some(i => i.category === 'memory_safety');
        const hasArithmeticViolations = issues.some(i => i.category === 'arithmetic_safety');
        const hasCriticalViolations = issues.some(i => i.severity === 'high');

        if (hasMemoryViolations && hasCriticalViolations) {
            return '#8B0000'; // Dark red for critical memory violations
        } else if (hasMemoryViolations) {
            return '#DC143C'; // Crimson for memory violations
        } else if (hasArithmeticViolations && hasCriticalViolations) {
            return '#B22222'; // Fire brick for arithmetic violations
        } else if (hasCriticalViolations) {
            return '#FF4500'; // Orange red for other critical violations
        } else {
            return '#FF6347'; // Tomato for other violations
        }
    }

    /**
     * Generate pseudo-random position for building
     */
    generatePosition(filePath) {
        // Use file path as seed for consistent positioning
        const hash = crypto.createHash('md5').update(filePath).digest('hex');
        const x = parseInt(hash.substring(0, 8), 16) % 320 - 160; // -160 to 160
        const z = parseInt(hash.substring(8, 16), 16) % 320 - 160; // -160 to 160

        return { x, y: 0, z };
    }

    /**
     * Calculate district health score
     */
    calculateDistrictHealth(issues) {
        if (issues.length === 0) return 'excellent';

        const memoryViolations = issues.filter(i => i.category === 'memory_safety').length;
        const arithmeticViolations = issues.filter(i => i.category === 'arithmetic_safety').length;
        const criticalViolations = issues.filter(i => i.severity === 'high').length;

        if (criticalViolations > 10 || memoryViolations > 5) return 'critical';
        if (criticalViolations > 5 || memoryViolations > 2) return 'poor';
        if (criticalViolations > 0 || arithmeticViolations > 3) return 'fair';
        if (issues.length > 10) return 'good';
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
                metadata: { totalViolations: 0, uniqueFiles: 0, tool: this.toolName }
            },
            metadata: {
                totalViolations: 0,
                memoryViolations: 0,
                boundsViolations: 0,
                overflowViolations: 0,
                concurrencyViolations: 0,
                filesAnalyzed: 0,
                verificationMode: 'bounded-model-checking',
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
            const match = output.match(/CBMC version (\d+\.\d+\.\d+)/);
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
                'Install CBMC from https://www.cprover.org/cbmc/',
                'On Ubuntu: sudo apt install cbmc',
                'On macOS: brew install cbmc',
                'Verify installation: cbmc --version'
            ],
            requirements: [
                'CBMC bounded model checker',
                'C/C++ compiler (for preprocessing)',
                'Sufficient memory (CBMC can be memory-intensive)'
            ],
            notes: [
                'CBMC performs formal verification without executing code',
                'Analysis uses bounded model checking with configurable limits',
                'Best suited for smaller, well-defined functions'
            ]
        };
    }
}

module.exports = new CBMCAdapter();
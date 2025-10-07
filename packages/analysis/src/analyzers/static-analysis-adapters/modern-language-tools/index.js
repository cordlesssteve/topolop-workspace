/**
 * Modern Language Tools Integration Hub for Topolop
 *
 * Centralized hub for modern language static analysis and security tools.
 * Provides unified interface for Rust, Go, and future language toolchains.
 *
 * Security Architecture:
 * - All tools run in isolation with input validation
 * - No arbitrary code execution - static analysis only
 * - Comprehensive resource limits and timeouts
 * - Path traversal protection across all adapters
 *
 * Supported Tool Categories:
 * - Rust: cargo-audit (vulnerability scanner), clippy (static analyzer/linter)
 * - Go: staticcheck (static analyzer), gosec (security scanner)
 * - Future: Enhanced TypeScript, Python, Java analyzers
 */

const path = require('path');
const fs = require('fs').promises;

// Modern language tool adapters
const CargoAuditAdapter = require('../rust/cargo-audit-adapter');
const ClippyAdapter = require('../rust/clippy-adapter');
const StaticcheckAdapter = require('../go/staticcheck-adapter');
const GosecAdapter = require('../go/gosec-adapter');

// Security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class ModernLanguageToolsHub {
    constructor() {
        this.name = 'ModernLanguageToolsHub';
        this.version = '1.0.0';
        this.supportedLanguages = ['rust', 'go'];
        this.enabledTools = new Map();
        this.securityLevel = 'strict';

        // Initialize available adapters
        this.adapters = {
            rust: {
                'cargo-audit': new CargoAuditAdapter(),
                'clippy': new ClippyAdapter()
            },
            go: {
                'staticcheck': new StaticcheckAdapter(),
                'gosec': new GosecAdapter()
            }
        };

        // Tool availability cache
        this.toolAvailability = new Map();
        this.lastAvailabilityCheck = new Map();
        this.availabilityCacheTTL = 300000; // 5 minutes
    }

    /**
     * Initialize the hub and check tool availability
     */
    async initialize() {
        console.log('Initializing Modern Language Tools Hub...');

        try {
            // Check availability of all tools
            await this.checkAllToolsAvailability();

            // Log available tools
            this.logAvailableTools();

            return {
                success: true,
                availableTools: this.getAvailableToolsSummary(),
                totalTools: this.getTotalToolCount()
            };
        } catch (error) {
            console.error('Modern Language Tools Hub initialization failed:', error.message);
            return {
                success: false,
                error: error.message,
                availableTools: this.getAvailableToolsSummary()
            };
        }
    }

    /**
     * Analyze project with appropriate tools based on detected languages
     */
    async analyzeProject(projectPath, options = {}) {
        try {
            // Validate input
            const validatedPath = await this.validateProjectPath(projectPath);

            // Detect project languages
            const detectedLanguages = await this.detectProjectLanguages(validatedPath);

            if (detectedLanguages.length === 0) {
                return {
                    success: false,
                    error: 'No supported languages detected in project',
                    supportedLanguages: this.supportedLanguages
                };
            }

            // Run analysis for detected languages
            const results = await this.runAnalysisForLanguages(validatedPath, detectedLanguages, options);

            // Combine and correlate results
            const combinedResults = this.combineResults(results);

            return {
                success: true,
                projectPath: validatedPath,
                detectedLanguages: detectedLanguages,
                results: combinedResults,
                metadata: {
                    timestamp: new Date().toISOString(),
                    toolsUsed: results.map(r => r.tool),
                    totalIssues: combinedResults.reduce((sum, r) => sum + r.results.length, 0)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                projectPath: projectPath
            };
        }
    }

    /**
     * Validate project path with security constraints
     */
    async validateProjectPath(projectPath) {
        const validation = await securityValidator.validatePath(projectPath, {
            checkExists: true,
            preventTraversal: true,
            allowedExtensions: ['.rs', '.go', '.toml', '.mod', '.sum', '.lock'],
            maxFileSize: 50 * 1024 * 1024 // 50MB for large projects
        });

        if (!validation.isValid) {
            throw new Error(`Project path validation failed: ${validation.error}`);
        }

        return validation.resolvedPath;
    }

    /**
     * Detect supported languages in project
     */
    async detectProjectLanguages(projectPath) {
        const detectedLanguages = [];

        try {
            // Check for Rust
            if (await this.isRustProject(projectPath)) {
                detectedLanguages.push('rust');
            }

            // Check for Go
            if (await this.isGoProject(projectPath)) {
                detectedLanguages.push('go');
            }

            return detectedLanguages;
        } catch (error) {
            console.warn('Language detection failed:', error.message);
            return [];
        }
    }

    /**
     * Check if project contains Rust code
     */
    async isRustProject(projectPath) {
        try {
            // Check for Cargo.toml
            const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
            const cargoTomlExists = await fs.access(cargoTomlPath).then(() => true).catch(() => false);

            if (cargoTomlExists) {
                return true;
            }

            // Check for .rs files
            const hasRustFiles = await this.hasFilesWithExtension(projectPath, '.rs');
            return hasRustFiles;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if project contains Go code
     */
    async isGoProject(projectPath) {
        try {
            // Check for go.mod
            const goModPath = path.join(projectPath, 'go.mod');
            const goModExists = await fs.access(goModPath).then(() => true).catch(() => false);

            if (goModExists) {
                return true;
            }

            // Check for .go files
            const hasGoFiles = await this.hasFilesWithExtension(projectPath, '.go');
            return hasGoFiles;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if directory contains files with specific extension
     */
    async hasFilesWithExtension(dirPath, extension, maxDepth = 3) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith(extension)) {
                    return true;
                }

                if (entry.isDirectory() && maxDepth > 0 && !entry.name.startsWith('.')) {
                    const subdirPath = path.join(dirPath, entry.name);
                    const found = await this.hasFilesWithExtension(subdirPath, extension, maxDepth - 1);
                    if (found) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Run analysis for detected languages
     */
    async runAnalysisForLanguages(projectPath, languages, options) {
        const analysisPromises = [];

        for (const language of languages) {
            const languageAdapters = this.adapters[language];

            if (!languageAdapters) {
                console.warn(`No adapters available for language: ${language}`);
                continue;
            }

            // Run each adapter for the language
            for (const [toolName, adapter] of Object.entries(languageAdapters)) {
                if (await this.isToolAvailable(language, toolName)) {
                    const toolOptions = options[toolName] || {};
                    analysisPromises.push(
                        this.runSingleTool(adapter, projectPath, toolOptions)
                            .catch(error => ({
                                tool: toolName,
                                language: language,
                                error: error.message,
                                results: []
                            }))
                    );
                }
            }
        }

        return Promise.all(analysisPromises);
    }

    /**
     * Run a single tool analysis with error handling
     */
    async runSingleTool(adapter, projectPath, options) {
        const startTime = Date.now();

        try {
            const result = await adapter.analyze(projectPath, options);
            const executionTime = Date.now() - startTime;

            return {
                ...result,
                executionTime: executionTime
            };
        } catch (error) {
            return {
                tool: adapter.toolName,
                error: error.message,
                executionTime: Date.now() - startTime,
                results: []
            };
        }
    }

    /**
     * Combine results from multiple tools
     */
    combineResults(toolResults) {
        const combinedResults = [];

        for (const result of toolResults) {
            if (result.error) {
                console.warn(`Tool ${result.tool} failed: ${result.error}`);
                continue;
            }

            combinedResults.push({
                tool: result.tool,
                version: result.version,
                timestamp: result.timestamp,
                target: result.target,
                results: result.results || [],
                visualization: result.visualization,
                metadata: result.metadata,
                executionTime: result.executionTime
            });
        }

        return combinedResults;
    }

    /**
     * Check availability of all tools
     */
    async checkAllToolsAvailability() {
        const checkPromises = [];

        for (const [language, adapters] of Object.entries(this.adapters)) {
            for (const [toolName, adapter] of Object.entries(adapters)) {
                checkPromises.push(
                    this.checkSingleToolAvailability(language, toolName, adapter)
                );
            }
        }

        await Promise.all(checkPromises);
    }

    /**
     * Check availability of a single tool
     */
    async checkSingleToolAvailability(language, toolName, adapter) {
        const cacheKey = `${language}-${toolName}`;
        const now = Date.now();

        // Check cache first
        const lastCheck = this.lastAvailabilityCheck.get(cacheKey);
        if (lastCheck && (now - lastCheck) < this.availabilityCacheTTL) {
            return this.toolAvailability.get(cacheKey);
        }

        try {
            await adapter.checkToolAvailability();
            this.toolAvailability.set(cacheKey, true);
            this.enabledTools.set(cacheKey, { language, toolName, adapter });
        } catch (error) {
            this.toolAvailability.set(cacheKey, false);
            console.warn(`Tool ${toolName} (${language}) not available: ${error.message}`);
        }

        this.lastAvailabilityCheck.set(cacheKey, now);
        return this.toolAvailability.get(cacheKey);
    }

    /**
     * Check if specific tool is available
     */
    async isToolAvailable(language, toolName) {
        const cacheKey = `${language}-${toolName}`;
        return this.toolAvailability.get(cacheKey) || false;
    }

    /**
     * Get summary of available tools
     */
    getAvailableToolsSummary() {
        const summary = {};

        for (const [cacheKey, isAvailable] of this.toolAvailability.entries()) {
            const [language, toolName] = cacheKey.split('-');

            if (!summary[language]) {
                summary[language] = {};
            }

            summary[language][toolName] = isAvailable;
        }

        return summary;
    }

    /**
     * Get total count of available tools
     */
    getTotalToolCount() {
        let totalTools = 0;
        let availableTools = 0;

        for (const [, isAvailable] of this.toolAvailability.entries()) {
            totalTools++;
            if (isAvailable) {
                availableTools++;
            }
        }

        return { total: totalTools, available: availableTools };
    }

    /**
     * Log available tools to console
     */
    logAvailableTools() {
        console.log('\n=== Modern Language Tools Availability ===');

        const summary = this.getAvailableToolsSummary();

        for (const [language, tools] of Object.entries(summary)) {
            console.log(`\n${language.toUpperCase()}:`);

            for (const [toolName, isAvailable] of Object.entries(tools)) {
                const status = isAvailable ? '✅ Available' : '❌ Not Available';
                console.log(`  ${toolName}: ${status}`);
            }
        }

        const counts = this.getTotalToolCount();
        console.log(`\nTotal: ${counts.available}/${counts.total} tools available\n`);
    }

    /**
     * Get installation instructions for missing tools
     */
    getInstallationInstructions() {
        const instructions = {};

        for (const [language, adapters] of Object.entries(this.adapters)) {
            for (const [toolName, adapter] of Object.entries(adapters)) {
                const cacheKey = `${language}-${toolName}`;
                const isAvailable = this.toolAvailability.get(cacheKey);

                if (!isAvailable) {
                    if (!instructions[language]) {
                        instructions[language] = {};
                    }

                    instructions[language][toolName] = adapter.getInstallationInstructions();
                }
            }
        }

        return instructions;
    }

    /**
     * Get adapter for specific tool
     */
    getAdapter(language, toolName) {
        return this.adapters[language]?.[toolName] || null;
    }

    /**
     * Get all enabled tools
     */
    getEnabledTools() {
        return Array.from(this.enabledTools.values());
    }

    /**
     * Force refresh of tool availability
     */
    async refreshToolAvailability() {
        this.toolAvailability.clear();
        this.lastAvailabilityCheck.clear();
        this.enabledTools.clear();

        return this.checkAllToolsAvailability();
    }
}

module.exports = ModernLanguageToolsHub;
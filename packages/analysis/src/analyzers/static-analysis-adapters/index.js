#!/usr/bin/env node

/**
 * Static Analysis Adapters Integration Hub
 * Provides unified access to static analysis, security scanning, and code quality tools
 */

const path = require('path');
const SecureContainerAdapter = require('./python/secure-container-adapter');
const SecureCppContainerAdapter = require('./cpp/secure-container-adapter');
const TypeScriptCompilerAdapter = require('./typescript/tsc-adapter');
const ModernLanguageToolsHub = require('./modern-language-tools');

class StaticAnalysisHub {
    constructor() {
        this.adapters = {
            python: {
                container: new SecureContainerAdapter()
            },
            cpp: {
                container: new SecureCppContainerAdapter()
            },
            typescript: {
                tsc: new TypeScriptCompilerAdapter()
            }
        };

        // Initialize modern language tools hub for Rust and Go
        this.modernLanguageToolsHub = new ModernLanguageToolsHub();

        this.supportedLanguages = ['python', 'cpp', 'c', 'typescript', 'javascript', 'rust', 'go'];
        this.supportedTools = ['pylint', 'bandit', 'mypy', 'clang-analyzer', 'cppcheck', 'tsc', 'eslint', 'madge', 'cargo-audit', 'clippy', 'staticcheck', 'gosec'];
    }

    /**
     * Get available tools for a language
     */
    getToolsForLanguage(language) {
        switch (language.toLowerCase()) {
            case 'python':
                return ['pylint', 'bandit', 'mypy'];
            case 'cpp':
            case 'c++':
            case 'c':
                return ['clang-analyzer', 'cppcheck'];
            case 'javascript':
            case 'js':
                return ['eslint', 'madge', 'jshint', 'flow'];
            case 'typescript':
            case 'ts':
                return ['tsc', 'eslint', 'madge'];
            case 'rust':
                return ['cargo-audit', 'clippy'];
            case 'go':
                return ['staticcheck', 'gosec'];
            default:
                return [];
        }
    }

    /**
     * Analyze codebase with specified tool
     */
    async analyzeTool(tool, targetPath, options = {}) {
        const language = this.inferLanguage(targetPath, options.language);

        // Check if it's a modern language tool (Rust/Go)
        if (['cargo-audit', 'clippy', 'staticcheck', 'gosec'].includes(tool)) {
            const modernResult = await this.modernLanguageToolsHub.analyzeProject(targetPath, { [tool]: options });

            if (modernResult.success) {
                // Extract specific tool result
                const toolResult = modernResult.results.find(r => r.tool === tool);
                return toolResult || { error: `Tool ${tool} not found in results` };
            } else {
                return { error: modernResult.error };
            }
        }

        if (language === 'python') {
            const adapter = this.adapters.python.container;

            switch (tool) {
                case 'pylint':
                    return await adapter.analyzePylint(targetPath);
                case 'bandit':
                    return await adapter.analyzeBandit(targetPath);
                case 'mypy':
                    return await adapter.analyzeMypy(targetPath);
                default:
                    throw new Error(`Unsupported Python tool: ${tool}`);
            }
        } else if (language === 'cpp' || language === 'c') {
            const adapter = this.adapters.cpp.container;

            switch (tool) {
                case 'clang-analyzer':
                    return await adapter.runClangAnalyzer(targetPath, options);
                case 'cppcheck':
                    return await adapter.runCppcheck(targetPath, options);
                default:
                    throw new Error(`Unsupported C/C++ tool: ${tool}`);
            }
        } else {
            throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Analyze codebase with all available tools
     */
    async analyzeAll(targetPath, options = {}) {
        // First, try modern language tools hub which auto-detects Rust/Go
        try {
            const modernResult = await this.modernLanguageToolsHub.analyzeProject(targetPath, options);
            if (modernResult.success && modernResult.results.length > 0) {
                // Modern language tools found and analyzed the project
                return {
                    timestamp: new Date().toISOString(),
                    target: targetPath,
                    detectedLanguages: modernResult.detectedLanguages,
                    tools: this.convertModernResultsToLegacyFormat(modernResult.results),
                    summary: this.generateModernSummary(modernResult.results)
                };
            }
        } catch (error) {
            console.warn('Modern language tools analysis failed:', error.message);
        }

        // Fallback to legacy language detection and analysis
        const language = this.inferLanguage(targetPath, options.language);

        if (language === 'python') {
            return await this.adapters.python.container.analyzeAll(targetPath);
        } else if (language === 'cpp' || language === 'c') {
            return await this.adapters.cpp.container.analyzeAll(targetPath, options);
        } else if (language === 'typescript') {
            return await this.adapters.typescript.tsc.analyze(targetPath, options);
        } else if (language === 'javascript') {
            // For JavaScript, we can use existing ESLint and Madge adapters
            const ESLintAdapter = require('./javascript/eslint-adapter');
            const MadgeAdapter = require('./javascript/madge-adapter');

            const results = {};
            try {
                const eslintAdapter = new ESLintAdapter();
                results.eslint = await eslintAdapter.analyze(targetPath, options);
            } catch (error) {
                results.eslint = { error: error.message };
            }

            try {
                const madgeAdapter = new MadgeAdapter();
                results.madge = await madgeAdapter.analyze(targetPath, options);
            } catch (error) {
                results.madge = { error: error.message };
            }

            return results;
        } else {
            throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Analyze codebase with security-focused tools only
     */
    async analyzeSecurity(targetPath, options = {}) {
        const language = this.inferLanguage(targetPath, options.language);
        
        if (language === 'python') {
            const adapter = this.adapters.python.container;
            return await adapter.analyzeBandit(targetPath);
        } else {
            throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Analyze codebase with quality-focused tools only
     */
    async analyzeQuality(targetPath, options = {}) {
        const language = this.inferLanguage(targetPath, options.language);
        
        if (language === 'python') {
            const adapter = this.adapters.python.container;
            const results = {};
            
            try {
                results.pylint = await adapter.analyzePylint(targetPath);
            } catch (error) {
                results.pylint = { error: error.message };
            }

            try {
                results.mypy = await adapter.analyzeMypy(targetPath);
            } catch (error) {
                results.mypy = { error: error.message };
            }

            return {
                timestamp: new Date().toISOString(),
                target: targetPath,
                language,
                tools: results,
                summary: this.generateQualitySummary(results)
            };
        } else {
            throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Generate city visualization data from analysis results
     */
    generateCityVisualization(analysisResults) {
        const cityData = {
            buildings: [],
            roads: [],
            districts: [],
            metadata: {
                timestamp: new Date().toISOString(),
                totalIssues: 0,
                securityIssues: 0,
                qualityIssues: 0,
                typeIssues: 0
            }
        };

        if (analysisResults.tools) {
            Object.entries(analysisResults.tools).forEach(([tool, result]) => {
                if (result.visualization && result.visualization.buildings) {
                    cityData.buildings.push(...result.visualization.buildings);
                    
                    // Update metadata
                    if (result.visualization.metadata) {
                        cityData.metadata.totalIssues += result.visualization.metadata.totalIssues || 0;
                        
                        if (tool === 'bandit') {
                            cityData.metadata.securityIssues += result.visualization.metadata.totalIssues || 0;
                        } else if (tool === 'pylint') {
                            cityData.metadata.qualityIssues += result.visualization.metadata.totalIssues || 0;
                        } else if (tool === 'mypy') {
                            cityData.metadata.typeIssues += result.visualization.metadata.totalIssues || 0;
                        }
                    }
                }
            });
        }

        // Create districts based on issue types
        if (cityData.metadata.securityIssues > 0) {
            cityData.districts.push({
                name: 'Security District',
                type: 'security',
                buildings: cityData.buildings.filter(b => b.tool === 'bandit'),
                health: this.calculateDistrictHealth(cityData.buildings.filter(b => b.tool === 'bandit'))
            });
        }

        if (cityData.metadata.qualityIssues > 0) {
            cityData.districts.push({
                name: 'Quality District', 
                type: 'quality',
                buildings: cityData.buildings.filter(b => b.tool === 'pylint'),
                health: this.calculateDistrictHealth(cityData.buildings.filter(b => b.tool === 'pylint'))
            });
        }

        if (cityData.metadata.typeIssues > 0) {
            cityData.districts.push({
                name: 'Type Safety District',
                type: 'types',
                buildings: cityData.buildings.filter(b => b.tool === 'mypy'),
                health: this.calculateDistrictHealth(cityData.buildings.filter(b => b.tool === 'mypy'))
            });
        }

        return cityData;
    }

    /**
     * Calculate district health score
     */
    calculateDistrictHealth(buildings) {
        if (buildings.length === 0) return 'excellent';
        
        const totalHeight = buildings.reduce((sum, b) => sum + (b.height || 0), 0);
        const avgHeight = totalHeight / buildings.length;
        
        if (avgHeight < 20) return 'excellent';
        if (avgHeight < 40) return 'good';  
        if (avgHeight < 60) return 'fair';
        return 'poor';
    }

    /**
     * Infer programming language from path
     */
    inferLanguage(targetPath, explicitLanguage = null) {
        if (explicitLanguage) {
            return explicitLanguage.toLowerCase();
        }

        const ext = path.extname(targetPath).toLowerCase();
        
        switch (ext) {
            case '.py':
            case '.pyw':
                return 'python';
            case '.c':
            case '.h':
                return 'c';
            case '.cpp':
            case '.cxx':
            case '.cc':
            case '.hpp':
            case '.hxx':
                return 'cpp';
            case '.js':
            case '.jsx':
                return 'javascript';
            case '.ts':
            case '.tsx':
                return 'typescript';
            case '.rs':
                return 'rust';
            case '.go':
                return 'go';
            case '.java':
                return 'java';
            default:
                // Try to infer from directory contents
                return 'python'; // Default fallback
        }
    }

    /**
     * Generate quality summary
     */
    generateQualitySummary(results) {
        const summary = {
            totalTools: Object.keys(results).length,
            successful: 0,
            failed: 0,
            totalIssues: 0,
            qualityScore: 100
        };

        Object.entries(results).forEach(([tool, result]) => {
            if (result.error) {
                summary.failed++;
            } else {
                summary.successful++;
                
                if (tool === 'pylint' && Array.isArray(result.results)) {
                    summary.totalIssues += result.results.length;
                    // Reduce quality score based on issues
                    summary.qualityScore -= result.results.length * 2;
                } else if (tool === 'mypy' && Array.isArray(result.results)) {
                    summary.totalIssues += result.results.length;
                    summary.qualityScore -= result.results.length * 1;
                }
            }
        });

        summary.qualityScore = Math.max(0, summary.qualityScore);
        return summary;
    }

    /**
     * Convert modern language tool results to legacy format for compatibility
     */
    convertModernResultsToLegacyFormat(modernResults) {
        const legacyFormat = {};

        for (const result of modernResults) {
            legacyFormat[result.tool] = {
                tool: result.tool,
                version: result.version,
                timestamp: result.timestamp,
                target: result.target,
                results: result.results,
                visualization: result.visualization,
                metadata: result.metadata,
                executionTime: result.executionTime
            };
        }

        return legacyFormat;
    }

    /**
     * Generate summary for modern language tool results
     */
    generateModernSummary(modernResults) {
        const summary = {
            totalTools: modernResults.length,
            successful: 0,
            failed: 0,
            totalIssues: 0,
            qualityScore: 100,
            securityScore: 100,
            languages: []
        };

        const detectedLanguages = new Set();

        for (const result of modernResults) {
            if (result.error) {
                summary.failed++;
            } else {
                summary.successful++;

                const issueCount = result.results?.length || 0;
                summary.totalIssues += issueCount;

                // Determine language from tool
                if (['cargo-audit', 'clippy'].includes(result.tool)) {
                    detectedLanguages.add('rust');
                    // Rust-specific scoring
                    if (result.tool === 'cargo-audit') {
                        summary.securityScore -= issueCount * 5; // Security issues heavily weighted
                    } else if (result.tool === 'clippy') {
                        summary.qualityScore -= issueCount * 2; // Quality issues moderately weighted
                    }
                } else if (['staticcheck', 'gosec'].includes(result.tool)) {
                    detectedLanguages.add('go');
                    // Go-specific scoring
                    if (result.tool === 'gosec') {
                        summary.securityScore -= issueCount * 5; // Security issues heavily weighted
                    } else if (result.tool === 'staticcheck') {
                        summary.qualityScore -= issueCount * 2; // Static analysis moderately weighted
                    }
                }
            }
        }

        summary.languages = Array.from(detectedLanguages);
        summary.qualityScore = Math.max(0, summary.qualityScore);
        summary.securityScore = Math.max(0, summary.securityScore);

        return summary;
    }

    /**
     * Get system status and available tools
     */
    async getStatus() {
        const containerStatus = await this._checkContainerStatus();
        
        return {
            version: '1.0.0',
            supportedLanguages: this.supportedLanguages,
            supportedTools: this.supportedTools,
            containerStatus,
            security: {
                containerIsolation: true,
                networkDisabled: true,
                nonRootUser: true,
                readOnlyFileSystem: true
            }
        };
    }

    /**
     * Check actual container and tool availability
     */
    async _checkContainerStatus() {
        const status = {
            pythonAnalyzer: 'checking',
            dockerAvailable: false,
            localToolsAvailable: {}
        };

        try {
            // Check if Docker is available using safe command execution
            await this._safeDockerCommand(['--version']);
            status.dockerAvailable = true;
            
            // Check if Python analysis container is available
            try {
                // Use safe command construction to prevent injection
                const { spawn } = require('child_process');
                const result = await this._safeDockerCommand(['images', 'topolop/python-analysis', '--format', '{{.Repository}}']);
                status.pythonAnalyzer = result.trim() === 'topolop/python-analysis' ? 'available' : 'missing';
            } catch (error) {
                status.pythonAnalyzer = 'missing';
            }
        } catch (error) {
            status.dockerAvailable = false;
            status.pythonAnalyzer = 'docker-unavailable';
        }

        // Check local tool availability
        status.localToolsAvailable = await this._checkLocalTools();

        return status;
    }

    /**
     * Check if tools are available locally as fallback
     */
    async _checkLocalTools() {
        const { execSync } = require('child_process');
        const tools = {};
        const toolCommands = {
            python: 'python3 --version',
            pylint: 'pylint --version',
            bandit: 'bandit --version',
            mypy: 'mypy --version',
            typescript: 'tsc --version || npx tsc --version',
            eslint: 'eslint --version || npx eslint --version'
        };

        for (const [tool, command] of Object.entries(toolCommands)) {
            try {
                execSync(command, { stdio: 'pipe' });
                tools[tool] = 'available';
            } catch (error) {
                tools[tool] = 'unavailable';
            }
        }

        return tools;
    }

    /**
     * Safely execute docker commands with parameter validation
     */
    async _safeDockerCommand(args) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Validate all arguments are strings and don't contain shell metacharacters
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid docker argument type: ${typeof arg}`);
                }
                
                // Check for shell metacharacters that could be dangerous
                if (/[;&|`$(){}[\]<>*?~]/.test(arg)) {
                    throw new Error(`Unsafe characters in docker argument: ${arg}`);
                }
                
                return arg;
            });

            const dockerProcess = spawn('docker', safeArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 10000 // 10 second timeout
            });

            let stdout = '';
            let stderr = '';

            dockerProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            dockerProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            dockerProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Docker command failed: ${stderr}`));
                }
            });

            dockerProcess.on('error', (error) => {
                reject(new Error(`Docker command error: ${error.message}`));
            });
        });
    }
}

module.exports = StaticAnalysisHub;

// CLI usage
if (require.main === module) {
    const hub = new StaticAnalysisHub();
    const [,, command, ...args] = process.argv;

    if (!command) {
        console.error('Usage: node index.js <command> [args...]');
        console.error('Commands: status, analyze-tool <tool> <path>, analyze-all <path>, analyze-security <path>, analyze-quality <path>');
        process.exit(1);
    }

    let promise;
    
    switch (command) {
        case 'status':
            promise = hub.getStatus();
            break;
        case 'analyze-tool':
            if (args.length < 2) {
                console.error('Usage: analyze-tool <tool> <path>');
                process.exit(1);
            }
            promise = hub.analyzeTool(args[0], args[1]);
            break;
        case 'analyze-all':
            if (args.length < 1) {
                console.error('Usage: analyze-all <path>');
                process.exit(1);
            }
            promise = hub.analyzeAll(args[0]);
            break;
        case 'analyze-security':
            if (args.length < 1) {
                console.error('Usage: analyze-security <path>');
                process.exit(1);
            }
            promise = hub.analyzeSecurity(args[0]);
            break;
        case 'analyze-quality':
            if (args.length < 1) {
                console.error('Usage: analyze-quality <path>');
                process.exit(1);
            }
            promise = hub.analyzeQuality(args[0]);
            break;
        default:
            console.error('Unknown command:', command);
            process.exit(1);
    }

    promise
        .then(results => {
            console.log(JSON.stringify(results, null, 2));
        })
        .catch(error => {
            console.error('Command failed:', error.message);
            process.exit(1);
        });
}
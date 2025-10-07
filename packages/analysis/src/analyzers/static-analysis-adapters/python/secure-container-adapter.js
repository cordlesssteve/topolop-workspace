#!/usr/bin/env node

/**
 * Secure Container-based Adapter for Python Analysis Tools
 * Uses Docker containers for maximum isolation and security
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const crypto = require('crypto');
const { resolveConfig } = require('../../config/default-config');

class SecureContainerAdapter {
    constructor() {
        this.containerImage = 'topolop-python-analyzer';
        this.maxFileSize = resolveConfig('formalMethods.javascript.maxFileSize') || 10 * 1024 * 1024; // 10MB default
        this.maxFiles = 1000;
        this.timeout = resolveConfig('formalMethods.python.timeout');
        this.dockerTimeout = resolveConfig('formalMethods.python.dockerTimeout');
        this.allowedExtensions = new Set(['.py', '.pyw']);
    }

    /**
     * Validate input path for security
     */
    async validatePath(inputPath) {
        try {
            const resolvedPath = path.resolve(inputPath);
            const stats = await fs.stat(resolvedPath);
            
            if (!stats) {
                throw new Error(`Path does not exist: ${inputPath}`);
            }

            if (stats.isFile() && stats.size > this.maxFileSize) {
                throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
            }

            return resolvedPath;
        } catch (error) {
            throw new Error(`Path validation failed: ${error.message}`);
        }
    }

    /**
     * Run secure analysis using Docker container
     */
    async runSecureAnalysis(tool, targetPath, options = {}) {
        const validatedPath = await this.validatePath(targetPath);
        const outputDir = path.join('/tmp', `analysis-${crypto.randomBytes(8).toString('hex')}`);
        
        await fs.mkdir(outputDir, { recursive: true });

        try {
            const dockerArgs = [
                'run', '--rm',
                '--network', 'none',                    // No network access
                '--user', '1001:1001',                  // Non-root user
                '--read-only',                          // Read-only filesystem
                '--tmpfs', '/tmp:size=100M,noexec,nosuid,nodev',
                '--memory', '512m',                     // Memory limit
                '--cpus', '1.0',                        // CPU limit
                '--security-opt', 'no-new-privileges:true',
                '--cap-drop', 'ALL',                    // Drop all capabilities
                '-v', `${validatedPath}:/opt/analysis/workspace/target:ro`,
                this.containerImage,
                'python', '-m', tool, 
                ...(tool === 'bandit' ? ['-f', 'json', '-r'] : 
                   tool === 'pylint' ? ['--output-format', 'json'] :
                   []), // mypy doesn't need special flags
                '/opt/analysis/workspace/target'
            ];

            const result = await this.executeCommand('docker', dockerArgs);
            
            // Parse results from stdout/stderr
            let analysisResults = null;
            
            if (tool === 'mypy') {
                // MyPy outputs text, not JSON
                const output = result.stdout || result.stderr || '';
                analysisResults = output.split('\n').filter(line => line.trim());
            } else {
                // Try parsing JSON from stdout first, then stderr
                const outputToTry = [result.stdout, result.stderr].filter(Boolean);
                for (const output of outputToTry) {
                    try {
                        analysisResults = JSON.parse(output);
                        break;
                    } catch (e) {
                        // Continue trying other outputs
                    }
                }
                if (!analysisResults && result.stdout) {
                    analysisResults = result.stdout;
                }
            }

            return {
                tool,
                success: result.exitCode === 0 || (tool === 'pylint' && result.exitCode <= 32), // Pylint exit codes
                results: analysisResults || [],
                metadata: {
                    target: targetPath,
                    executionTime: result.executionTime,
                    containerUsed: true,
                    security: {
                        isolated: true,
                        networkDisabled: true,
                        readOnlyFileSystem: true,
                        nonRootUser: true
                    }
                },
                raw: {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode
                }
            };

        } finally {
            // Cleanup temporary directory
            try {
                await fs.rm(outputDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Could not cleanup temporary directory:', error.message);
            }
        }
    }

    /**
     * Execute command with timeout and security measures
     */
    executeCommand(command, args) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const process = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            const timeout = setTimeout(() => {
                process.kill('SIGKILL');
                reject(new Error(`Process timed out after ${this.timeout}ms`));
            }, this.timeout);

            process.on('close', (code) => {
                clearTimeout(timeout);
                const executionTime = Date.now() - startTime;
                
                resolve({
                    exitCode: code,
                    stdout,
                    stderr,
                    executionTime
                });
            });

            process.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Run Pylint analysis
     */
    async analyzePylint(targetPath) {
        const result = await this.runSecureAnalysis('pylint', targetPath);
        
        return {
            ...result,
            visualization: this.convertPylintToVisualization(result.results)
        };
    }

    /**
     * Run Bandit analysis
     */
    async analyzeBandit(targetPath) {
        const result = await this.runSecureAnalysis('bandit', targetPath);
        
        return {
            ...result,
            visualization: this.convertBanditToVisualization(result.results)
        };
    }

    /**
     * Run MyPy analysis
     */
    async analyzeMypy(targetPath) {
        const result = await this.runSecureAnalysis('mypy', targetPath);
        
        return {
            ...result,
            visualization: this.convertMypyToVisualization(result.results)
        };
    }

    /**
     * Run all Python analysis tools
     */
    async analyzeAll(targetPath) {
        const results = {};
        
        try {
            results.pylint = await this.analyzePylint(targetPath);
        } catch (error) {
            results.pylint = { error: error.message };
        }

        try {
            results.bandit = await this.analyzeBandit(targetPath);
        } catch (error) {
            results.bandit = { error: error.message };
        }

        try {
            results.mypy = await this.analyzeMypy(targetPath);
        } catch (error) {
            results.mypy = { error: error.message };
        }

        return {
            timestamp: new Date().toISOString(),
            target: targetPath,
            tools: results,
            summary: this.generateSummary(results)
        };
    }

    /**
     * Convert Pylint results to city visualization
     */
    convertPylintToVisualization(results) {
        if (!Array.isArray(results)) return { buildings: [], roads: [] };

        const fileIssues = {};
        results.forEach(issue => {
            const file = issue.path || 'unknown';
            if (!fileIssues[file]) fileIssues[file] = [];
            fileIssues[file].push(issue);
        });

        const buildings = Object.entries(fileIssues).map(([filePath, issues]) => {
            const severityWeights = { error: 10, warning: 5, info: 1, convention: 1, refactor: 3 };
            const totalWeight = issues.reduce((sum, issue) => 
                sum + (severityWeights[issue.type] || 1), 0);

            return {
                id: `pylint-${crypto.createHash('md5').update(filePath).digest('hex').slice(0, 8)}`,
                name: path.basename(filePath),
                path: filePath,
                type: 'code-quality-building',
                height: Math.min(Math.max(totalWeight * 2, 10), 100),
                color: this.getSeverityColor(issues, 'pylint'),
                issues: issues.length,
                tool: 'pylint',
                details: {
                    errors: issues.filter(i => i.type === 'error').length,
                    warnings: issues.filter(i => i.type === 'warning').length,
                    conventions: issues.filter(i => i.type === 'convention').length,
                    refactoring: issues.filter(i => i.type === 'refactor').length
                }
            };
        });

        return { buildings, roads: [], metadata: { tool: 'pylint', totalIssues: results.length } };
    }

    /**
     * Convert Bandit results to city visualization
     */
    convertBanditToVisualization(results) {
        if (!results || !results.results) return { buildings: [], roads: [] };

        const buildings = results.results.map((issue, index) => ({
            id: `bandit-${index}`,
            name: `Security Issue ${index + 1}`,
            path: issue.filename,
            type: 'security-building',
            height: this.getSeverityHeight(issue.issue_severity),
            color: this.getSeverityColor([issue], 'bandit'),
            tool: 'bandit',
            details: {
                severity: issue.issue_severity,
                confidence: issue.issue_confidence,
                test_id: issue.test_id,
                test_name: issue.test_name,
                line_number: issue.line_number,
                description: issue.issue_text
            }
        }));

        return { 
            buildings, 
            roads: [], 
            metadata: { 
                tool: 'bandit', 
                totalIssues: results.results.length,
                severityBreakdown: this.getBanditSeverityBreakdown(results.results)
            } 
        };
    }

    /**
     * Convert MyPy results to city visualization
     */
    convertMypyToVisualization(results) {
        if (!Array.isArray(results)) return { buildings: [], roads: [] };

        const fileIssues = {};
        results.forEach(line => {
            if (line.includes(':')) {
                const [filePath] = line.split(':');
                if (!fileIssues[filePath]) fileIssues[filePath] = [];
                fileIssues[filePath].push(line);
            }
        });

        const buildings = Object.entries(fileIssues).map(([filePath, issues]) => ({
            id: `mypy-${crypto.createHash('md5').update(filePath).digest('hex').slice(0, 8)}`,
            name: path.basename(filePath),
            path: filePath,
            type: 'type-building',
            height: Math.min(issues.length * 5 + 10, 80),
            color: '#4444ff', // Blue for type issues
            tool: 'mypy',
            issues: issues.length,
            details: {
                typeIssues: issues.length,
                issues: issues.slice(0, 5) // Show first 5 issues
            }
        }));

        return { buildings, roads: [], metadata: { tool: 'mypy', totalIssues: results.length } };
    }

    /**
     * Get severity color based on tool and issues
     */
    getSeverityColor(issues, tool) {
        if (tool === 'pylint') {
            const hasErrors = issues.some(i => i.type === 'error');
            const hasWarnings = issues.some(i => i.type === 'warning');
            if (hasErrors) return '#ff4444';
            if (hasWarnings) return '#ffaa44';
            return '#44ff44';
        } else if (tool === 'bandit') {
            const hasHigh = issues.some(i => i.issue_severity === 'HIGH');
            const hasMedium = issues.some(i => i.issue_severity === 'MEDIUM');
            if (hasHigh) return '#ff0000';
            if (hasMedium) return '#ff8800';
            return '#ffff00';
        }
        return '#888888';
    }

    /**
     * Get height based on security severity
     */
    getSeverityHeight(severity) {
        const heights = { HIGH: 80, MEDIUM: 50, LOW: 30 };
        return heights[severity] || 20;
    }

    /**
     * Get Bandit severity breakdown
     */
    getBanditSeverityBreakdown(results) {
        const breakdown = { HIGH: 0, MEDIUM: 0, LOW: 0 };
        results.forEach(issue => {
            const severity = issue.issue_severity;
            if (breakdown[severity] !== undefined) {
                breakdown[severity]++;
            }
        });
        return breakdown;
    }

    /**
     * Generate summary of all analysis results
     */
    generateSummary(results) {
        const summary = {
            totalTools: Object.keys(results).length,
            successful: 0,
            failed: 0,
            totalIssues: 0,
            securityIssues: 0,
            qualityIssues: 0,
            typeIssues: 0
        };

        Object.entries(results).forEach(([tool, result]) => {
            if (result.error) {
                summary.failed++;
            } else {
                summary.successful++;
                
                if (tool === 'bandit' && result.results && result.results.results) {
                    summary.securityIssues += result.results.results.length;
                    summary.totalIssues += result.results.results.length;
                } else if (tool === 'pylint' && Array.isArray(result.results)) {
                    summary.qualityIssues += result.results.length;
                    summary.totalIssues += result.results.length;
                } else if (tool === 'mypy' && Array.isArray(result.results)) {
                    summary.typeIssues += result.results.length;
                    summary.totalIssues += result.results.length;
                }
            }
        });

        return summary;
    }
}

module.exports = SecureContainerAdapter;

// CLI usage
if (require.main === module) {
    const adapter = new SecureContainerAdapter();
    const [,, command, targetPath] = process.argv;

    if (!command || !targetPath) {
        console.error('Usage: node secure-container-adapter.js <command> <path>');
        console.error('Commands: pylint, bandit, mypy, all');
        process.exit(1);
    }

    let promise;
    switch (command) {
        case 'pylint':
            promise = adapter.analyzePylint(targetPath);
            break;
        case 'bandit':
            promise = adapter.analyzeBandit(targetPath);
            break;
        case 'mypy':
            promise = adapter.analyzeMypy(targetPath);
            break;
        case 'all':
            promise = adapter.analyzeAll(targetPath);
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
            console.error('Analysis failed:', error.message);
            process.exit(1);
        });
}
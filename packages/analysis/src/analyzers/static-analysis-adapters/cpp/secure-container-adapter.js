/**
 * Secure C/C++ Container Adapter
 * Provides containerized analysis using Clang Static Analyzer and Cppcheck
 * with maximum security isolation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { resolveConfig } = require('../../config/default-config');

class SecureCppContainerAdapter {
    constructor() {
        this.containerImage = 'topolop-cpp-analyzer';
        this.maxFileSize = resolveConfig('formalMethods.javascript.maxFileSize') || 10 * 1024 * 1024; // 10MB
        this.maxFiles = 1000;
        this.timeout = resolveConfig('formalMethods.cpp.timeout') || 300000; // 5 minutes
        this.cppcheckTimeout = resolveConfig('formalMethods.cpp.cppcheckTimeout') || 60000;
        this.clangTimeout = resolveConfig('formalMethods.cpp.clangTimeout') || 60000;
        this.allowedExtensions = ['.c', '.cpp', '.cxx', '.cc', '.h', '.hpp', '.hxx'];
        
        // Security settings
        this.securityConfig = {
            user: '1002:1002',
            network: 'none',
            memory: '1024m',
            cpus: '2.0',
            readOnly: true,
            tmpfs: '/tmp',
            capDrop: 'ALL',
            noNewPrivileges: true
        };
    }

    /**
     * Validate that target path exists and is safe to analyze
     */
    async validatePath(targetPath) {
        try {
            const realPath = path.resolve(targetPath);
            const stat = await fs.stat(realPath);
            
            if (!stat.isDirectory() && !stat.isFile()) {
                throw new Error('Target must be a file or directory');
            }
            
            return realPath;
        } catch (error) {
            throw new Error(`Invalid target path: ${error.message}`);
        }
    }

    /**
     * Find C/C++ files in the target directory
     */
    async findCppFiles(targetPath) {
        const files = [];
        
        async function scanDirectory(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Skip dangerous directories
                if (entry.isDirectory()) {
                    const dirname = entry.name;
                    if (!dirname.startsWith('.') && 
                        !['node_modules', '__pycache__', 'build', 'dist'].includes(dirname)) {
                        await scanDirectory(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (this.allowedExtensions.includes(ext)) {
                        // Check file size
                        const stat = await fs.stat(fullPath);
                        if (stat.size <= this.maxFileSize) {
                            files.push(fullPath);
                            if (files.length >= this.maxFiles) {
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        const stat = await fs.stat(targetPath);
        if (stat.isDirectory()) {
            await scanDirectory(targetPath);
        } else {
            const ext = path.extname(targetPath).toLowerCase();
            if (this.allowedExtensions.includes(ext) && stat.size <= this.maxFileSize) {
                files.push(targetPath);
            }
        }
        
        return files;
    }

    /**
     * Build Docker command with security restrictions
     */
    buildDockerCommand(tool, targetPath, outputPath) {
        const workspaceMount = `${path.dirname(targetPath)}:/opt/analysis/workspace:ro`;
        const outputMount = `${outputPath}:/opt/analysis/reports:rw`;
        
        return [
            'docker', 'run',
            '--rm',
            '--user', this.securityConfig.user,
            '--network', this.securityConfig.network,
            '--memory', this.securityConfig.memory,
            '--cpus', this.securityConfig.cpus,
            '--read-only',
            '--tmpfs', this.securityConfig.tmpfs,
            '--cap-drop', this.securityConfig.capDrop,
            '--security-opt', 'no-new-privileges:true',
            '-v', workspaceMount,
            '-v', outputMount,
            this.containerImage,
            '/opt/analysis/tools/analyze.sh',
            tool,
            '/opt/analysis/workspace'
        ];
    }

    /**
     * Execute container with security isolation
     */
    async executeContainer(command) {
        return new Promise((resolve, reject) => {
            const process = spawn(command[0], command.slice(1), {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            const timer = setTimeout(() => {
                process.kill('SIGKILL');
                reject(new Error('Analysis timed out'));
            }, this.timeout);

            process.on('close', (code) => {
                clearTimeout(timer);
                resolve({ exitCode: code, stdout, stderr });
            });

            process.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    /**
     * Run Clang Static Analyzer
     */
    async runClangAnalyzer(targetPath, options = {}) {
        console.log(`🔍 Running Clang Static Analyzer on: ${targetPath}`);
        
        // Validate target
        const validatedPath = await this.validatePath(targetPath);
        
        // Find C/C++ files
        const files = await this.findCppFiles(validatedPath);
        if (files.length === 0) {
            return {
                tool: 'clang-analyzer',
                status: 'completed',
                filesAnalyzed: 0,
                issues: [],
                message: 'No C/C++ files found'
            };
        }
        
        // Create output directory
        const outputDir = options.outputDir || '/tmp/clang-analysis';
        await fs.mkdir(outputDir, { recursive: true });
        
        try {
            // Build and execute command
            const command = this.buildDockerCommand('clang-analyzer', validatedPath, outputDir);
            const result = await this.executeContainer(command);
            
            // Parse results
            const reportDir = path.join(outputDir, 'clang');
            let issues = [];
            
            try {
                const reportFiles = await fs.readdir(reportDir);
                for (const file of reportFiles) {
                    if (file.endsWith('.plist')) {
                        // Parse plist files for issues (simplified)
                        const content = await fs.readFile(path.join(reportDir, file), 'utf8');
                        // Basic issue extraction (would need proper plist parser for production)
                        if (content.includes('issue')) {
                            issues.push({
                                file: file.replace('.plist', ''),
                                type: 'static-analysis',
                                severity: 'unknown',
                                description: 'Issue detected (detailed parsing required)'
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not parse Clang analysis results:', error.message);
            }
            
            return {
                tool: 'clang-analyzer',
                status: result.exitCode === 0 ? 'completed' : 'error',
                filesAnalyzed: files.length,
                issues,
                rawOutput: result.stdout,
                errorOutput: result.stderr,
                exitCode: result.exitCode,
                outputPath: reportDir
            };
            
        } catch (error) {
            return {
                tool: 'clang-analyzer',
                status: 'error',
                error: error.message,
                filesAnalyzed: files.length
            };
        }
    }

    /**
     * Run Cppcheck
     */
    async runCppcheck(targetPath, options = {}) {
        console.log(`🔍 Running Cppcheck on: ${targetPath}`);
        
        // Validate target
        const validatedPath = await this.validatePath(targetPath);
        
        // Find C/C++ files
        const files = await this.findCppFiles(validatedPath);
        if (files.length === 0) {
            return {
                tool: 'cppcheck',
                status: 'completed',
                filesAnalyzed: 0,
                issues: [],
                message: 'No C/C++ files found'
            };
        }
        
        // Create output directory
        const outputDir = options.outputDir || '/tmp/cppcheck-analysis';
        await fs.mkdir(outputDir, { recursive: true });
        
        try {
            // Build and execute command
            const command = this.buildDockerCommand('cppcheck', validatedPath, outputDir);
            const result = await this.executeContainer(command);
            
            // Parse XML results
            const reportFile = path.join(outputDir, 'cppcheck-report.xml');
            let issues = [];
            
            try {
                const xmlContent = await fs.readFile(reportFile, 'utf8');
                
                // Basic XML parsing for issues (simplified)
                const errorMatches = xmlContent.match(/<error[^>]*>/g) || [];
                for (const match of errorMatches) {
                    const idMatch = match.match(/id="([^"]+)"/);
                    const severityMatch = match.match(/severity="([^"]+)"/);
                    const msgMatch = match.match(/msg="([^"]+)"/);
                    
                    if (idMatch && severityMatch && msgMatch) {
                        issues.push({
                            id: idMatch[1],
                            severity: severityMatch[1],
                            description: msgMatch[1],
                            type: 'cppcheck'
                        });
                    }
                }
            } catch (error) {
                console.warn('Could not parse Cppcheck XML results:', error.message);
            }
            
            return {
                tool: 'cppcheck',
                status: result.exitCode <= 1 ? 'completed' : 'error', // Exit code 1 is normal for issues found
                filesAnalyzed: files.length,
                issues,
                rawOutput: result.stdout,
                errorOutput: result.stderr,
                exitCode: result.exitCode,
                outputPath: reportFile
            };
            
        } catch (error) {
            return {
                tool: 'cppcheck',
                status: 'error',
                error: error.message,
                filesAnalyzed: files.length
            };
        }
    }

    /**
     * Run comprehensive C/C++ analysis
     */
    async analyzeAll(targetPath, options = {}) {
        console.log(`🚀 Running comprehensive C/C++ analysis on: ${targetPath}`);
        
        const results = {
            timestamp: new Date().toISOString(),
            target: targetPath,
            tools: {},
            summary: {
                totalIssues: 0,
                criticalIssues: 0,
                highIssues: 0,
                mediumIssues: 0,
                lowIssues: 0
            }
        };
        
        try {
            // Run Clang Static Analyzer
            results.tools.clangAnalyzer = await this.runClangAnalyzer(targetPath, options);
            
            // Run Cppcheck
            results.tools.cppcheck = await this.runCppcheck(targetPath, options);
            
            // Calculate summary
            for (const toolResult of Object.values(results.tools)) {
                if (toolResult.issues) {
                    results.summary.totalIssues += toolResult.issues.length;
                    for (const issue of toolResult.issues) {
                        switch (issue.severity) {
                            case 'error':
                            case 'critical':
                                results.summary.criticalIssues++;
                                break;
                            case 'warning':
                            case 'high':
                                results.summary.highIssues++;
                                break;
                            case 'style':
                            case 'medium':
                                results.summary.mediumIssues++;
                                break;
                            default:
                                results.summary.lowIssues++;
                        }
                    }
                }
            }
            
            console.log(`✅ C/C++ analysis completed: ${results.summary.totalIssues} total issues found`);
            return results;
            
        } catch (error) {
            console.error('❌ C/C++ analysis failed:', error.message);
            results.error = error.message;
            return results;
        }
    }

    /**
     * Check if container is available and tools are working
     */
    async healthCheck() {
        try {
            const command = [
                'docker', 'run', '--rm',
                '--user', this.securityConfig.user,
                '--network', this.securityConfig.network,
                this.containerImage,
                'bash', '-c', 'clang --version && cppcheck --version'
            ];
            
            const result = await this.executeContainer(command);
            
            return {
                status: result.exitCode === 0 ? 'healthy' : 'unhealthy',
                version: result.stdout.trim(),
                error: result.exitCode !== 0 ? result.stderr : null
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = SecureCppContainerAdapter;
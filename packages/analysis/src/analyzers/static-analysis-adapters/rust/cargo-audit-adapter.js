/**
 * Secure Cargo-Audit Adapter for Topolop
 *
 * Security-first implementation for Rust vulnerability scanning.
 * Implements offline security analysis with comprehensive input validation.
 *
 * City Metaphor Mapping:
 * - Security vulnerabilities → Red emergency sirens on buildings
 * - High/Critical vulns → Towering red warning structures
 * - Medium vulns → Yellow alert beacons
 * - Low vulns → Orange caution indicators
 * - Dependency chains → Underground utility tunnels connecting buildings
 *
 * Security Features:
 * - Input validation and sanitization
 * - No code execution (Cargo.lock analysis only)
 * - Resource limits and timeouts
 * - Path traversal protection
 * - Offline vulnerability database
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Import security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class CargoAuditAdapter {
    constructor() {
        this.toolName = 'cargo-audit';
        this.version = '0.21.0'; // Target version
        this.timeout = resolveConfig('staticAnalysis.rust.timeout') || 120000; // 2 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.rust.maxFileSize') || 5 * 1024 * 1024; // 5MB
        this.allowedFiles = new Set(['Cargo.lock', 'Cargo.toml']);
        this.outputFormats = ['json'];
        this.securityLevel = 'strict';
    }

    /**
     * Analyze Rust project for security vulnerabilities
     */
    async analyze(projectPath, options = {}) {
        try {
            // Security validation
            const validatedPath = await this.validateInput(projectPath);
            const cargoLockPath = await this.findCargoLock(validatedPath);

            // Check tool availability
            await this.checkToolAvailability();

            // Run cargo-audit analysis
            const rawResults = await this.runCargoAudit(cargoLockPath, options);

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
            allowedExtensions: ['.toml', '.lock'],
            checkExists: true,
            preventTraversal: true
        });

        if (!validation.isValid) {
            throw new Error(`Input validation failed: ${validation.error}`);
        }

        return validation.resolvedPath;
    }

    /**
     * Find Cargo.lock file in project
     */
    async findCargoLock(projectPath) {
        const possiblePaths = [
            path.join(projectPath, 'Cargo.lock'),
            path.join(projectPath, '..', 'Cargo.lock'), // Handle src/ subdirectories
            projectPath.endsWith('Cargo.lock') ? projectPath : null
        ].filter(Boolean);

        for (const cargoPath of possiblePaths) {
            try {
                const stats = await fs.stat(cargoPath);
                if (stats.isFile()) {
                    // Validate Cargo.lock content
                    await this.validateCargoLock(cargoPath);
                    return cargoPath;
                }
            } catch (error) {
                // Continue searching
                continue;
            }
        }

        throw new Error('Cargo.lock file not found or invalid');
    }

    /**
     * Validate Cargo.lock file format
     */
    async validateCargoLock(cargoLockPath) {
        const content = await fs.readFile(cargoLockPath, 'utf8');

        // Basic format validation
        if (!content.includes('# This file is automatically @generated by Cargo') &&
            !content.includes('[[package]]')) {
            throw new Error('Invalid Cargo.lock format');
        }

        // Size limit check
        if (content.length > this.maxFileSize) {
            throw new Error(`Cargo.lock too large: ${content.length} bytes`);
        }

        return true;
    }

    /**
     * Check if cargo-audit is available
     */
    async checkToolAvailability() {
        return new Promise((resolve, reject) => {
            const process = spawn('cargo', ['audit', '--version'], {
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
                    reject(new Error(`cargo-audit not available: ${stderr || 'Tool not found'}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`cargo-audit execution error: ${error.message}`));
            });
        });
    }

    /**
     * Run cargo-audit with security constraints
     */
    async runCargoAudit(cargoLockPath, options = {}) {
        return new Promise((resolve, reject) => {
            // Prepare secure command arguments
            const args = [
                'audit',
                '--format', 'json',
                '--file', cargoLockPath
            ];

            // Add optional flags
            if (options.ignoreUnpatched) {
                args.push('--ignore-yanked');
            }

            if (options.quietMode) {
                args.push('--quiet');
            }

            // Security: Validate all arguments
            const safeArgs = args.map(arg => {
                if (typeof arg !== 'string') {
                    throw new Error(`Invalid argument type: ${typeof arg}`);
                }

                // Check for shell metacharacters
                if (/[;&|`$(){}[\]<>*?~]/.test(arg)) {
                    throw new Error(`Unsafe characters in argument: ${arg}`);
                }

                return arg;
            });

            const process = spawn('cargo', safeArgs, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: this.timeout,
                cwd: path.dirname(cargoLockPath) // Set working directory
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
                    try {
                        const jsonResult = JSON.parse(stdout);
                        resolve(jsonResult);
                    } catch (parseError) {
                        reject(new Error(`JSON parse error: ${parseError.message}`));
                    }
                } else {
                    // cargo-audit exits with code 1 when vulnerabilities are found
                    if (code === 1 && stdout.startsWith('{')) {
                        try {
                            const jsonResult = JSON.parse(stdout);
                            resolve(jsonResult);
                        } catch (parseError) {
                            reject(new Error(`Vulnerabilities found but JSON parse failed: ${parseError.message}`));
                        }
                    } else {
                        reject(new Error(`cargo-audit failed (code ${code}): ${stderr || stdout}`));
                    }
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Process execution error: ${error.message}`));
            });
        });
    }

    /**
     * Process and normalize cargo-audit results
     */
    async processResults(rawResults, projectPath) {
        const vulnerabilities = [];

        if (rawResults.vulnerabilities && Array.isArray(rawResults.vulnerabilities.list)) {
            for (const vuln of rawResults.vulnerabilities.list) {
                const normalized = await this.normalizeVulnerability(vuln, projectPath);
                vulnerabilities.push(normalized);
            }
        }

        return vulnerabilities;
    }

    /**
     * Normalize vulnerability to unified format
     */
    async normalizeVulnerability(vuln, projectPath) {
        const advisory = vuln.advisory || {};
        const package_info = vuln.package || {};

        return {
            id: advisory.id || `RUSTSEC-${Date.now()}`,
            title: advisory.title || 'Unknown vulnerability',
            description: advisory.description || 'No description available',
            severity: this.mapSeverity(advisory.severity),
            package: {
                name: package_info.name || 'unknown',
                version: package_info.version || 'unknown',
                source: package_info.source || 'crates.io'
            },
            cvss: advisory.cvss || null,
            cwe: advisory.cwe || null,
            url: advisory.url || null,
            date: advisory.date || new Date().toISOString(),
            patched_versions: advisory.patched_versions || [],
            unaffected_versions: advisory.unaffected_versions || [],
            affected_functions: vuln.affected_functions || [],
            file: 'Cargo.lock',
            line: 1, // Cargo.lock doesn't have specific line numbers for packages
            column: 1,
            tool: this.toolName,
            category: 'security',
            tags: ['rust', 'dependency', 'vulnerability'],
            confidence: 'high' // cargo-audit has high confidence (official database)
        };
    }

    /**
     * Map cargo-audit severity to unified scale
     */
    mapSeverity(severity) {
        if (!severity) return 'medium';

        const severityMap = {
            'critical': 'critical',
            'high': 'high',
            'medium': 'medium',
            'moderate': 'medium',
            'low': 'low',
            'info': 'info',
            'informational': 'info'
        };

        return severityMap[severity.toLowerCase()] || 'medium';
    }

    /**
     * Generate city visualization data
     */
    generateCityVisualization(vulnerabilities) {
        const buildings = [];
        const districts = [];

        // Group vulnerabilities by package
        const packageVulns = {};
        vulnerabilities.forEach(vuln => {
            const packageName = vuln.package.name;
            if (!packageVulns[packageName]) {
                packageVulns[packageName] = [];
            }
            packageVulns[packageName].push(vuln);
        });

        // Create buildings for each package with vulnerabilities
        Object.entries(packageVulns).forEach(([packageName, vulns]) => {
            const maxSeverity = this.getMaxSeverity(vulns);
            const height = this.calculateBuildingHeight(vulns);
            const color = this.getSeverityColor(maxSeverity);

            buildings.push({
                id: `rust-pkg-${packageName}`,
                name: packageName,
                height: height,
                color: color,
                position: this.generatePosition(packageName),
                metadata: {
                    type: 'rust-package',
                    vulnerabilityCount: vulns.length,
                    maxSeverity: maxSeverity,
                    tool: this.toolName,
                    issues: vulns.map(v => ({
                        id: v.id,
                        severity: v.severity,
                        title: v.title
                    }))
                }
            });
        });

        // Create security district
        if (buildings.length > 0) {
            districts.push({
                name: 'Rust Security District',
                type: 'security',
                buildings: buildings,
                health: this.calculateDistrictHealth(vulnerabilities)
            });
        }

        return {
            buildings: buildings,
            districts: districts,
            metadata: {
                totalVulnerabilities: vulnerabilities.length,
                uniquePackages: Object.keys(packageVulns).length,
                tool: this.toolName
            }
        };
    }

    /**
     * Get maximum severity from vulnerability list
     */
    getMaxSeverity(vulnerabilities) {
        const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

        for (const severity of severityOrder) {
            if (vulnerabilities.some(v => v.severity === severity)) {
                return severity;
            }
        }

        return 'medium';
    }

    /**
     * Calculate building height based on vulnerabilities
     */
    calculateBuildingHeight(vulnerabilities) {
        let baseHeight = 20;

        vulnerabilities.forEach(vuln => {
            switch (vuln.severity) {
                case 'critical': baseHeight += 25; break;
                case 'high': baseHeight += 15; break;
                case 'medium': baseHeight += 10; break;
                case 'low': baseHeight += 5; break;
                default: baseHeight += 3; break;
            }
        });

        return Math.min(baseHeight, 200); // Cap at 200 units
    }

    /**
     * Get color based on severity
     */
    getSeverityColor(severity) {
        const colorMap = {
            'critical': '#8B0000', // Dark red
            'high': '#FF4500',     // Orange red
            'medium': '#FFA500',   // Orange
            'low': '#FFD700',      // Gold
            'info': '#87CEEB'      // Sky blue
        };

        return colorMap[severity] || '#FFA500';
    }

    /**
     * Generate pseudo-random position for building
     */
    generatePosition(packageName) {
        // Use package name as seed for consistent positioning
        const hash = crypto.createHash('md5').update(packageName).digest('hex');
        const x = parseInt(hash.substring(0, 8), 16) % 200 - 100; // -100 to 100
        const z = parseInt(hash.substring(8, 16), 16) % 200 - 100; // -100 to 100

        return { x, y: 0, z };
    }

    /**
     * Calculate district health score
     */
    calculateDistrictHealth(vulnerabilities) {
        if (vulnerabilities.length === 0) return 'excellent';

        const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

        if (criticalCount > 0) return 'critical';
        if (highCount > 3) return 'poor';
        if (highCount > 0) return 'fair';
        if (vulnerabilities.length > 10) return 'poor';
        if (vulnerabilities.length > 5) return 'fair';
        return 'good';
    }

    /**
     * Get tool version
     */
    async getToolVersion() {
        try {
            const output = await this.checkToolAvailability();
            const match = output.match(/cargo-audit (\S+)/);
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
                'Run: cargo install cargo-audit',
                'Verify installation: cargo audit --version'
            ],
            requirements: [
                'Rust toolchain',
                'Cargo package manager',
                'Network access for initial database download'
            ],
            notes: [
                'cargo-audit uses an offline vulnerability database',
                'Database is updated when cargo-audit is updated',
                'No network access required during analysis'
            ]
        };
    }
}

module.exports = CargoAuditAdapter;
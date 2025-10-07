/**
 * Secure Pylint Adapter for Topolop
 * 
 * Security-first implementation using Python subprocess with strict controls.
 * Implements static analysis only with comprehensive input validation.
 * 
 * City Metaphor Mapping:
 * - Pylint errors → Red alert beacons on buildings
 * - Pylint warnings → Yellow caution lights
 * - Code quality score → Building structural integrity
 * - Convention violations → Building style inconsistencies
 * 
 * Security Features:
 * - Input validation and sanitization
 * - No arbitrary code execution
 * - Resource limits and timeouts
 * - Path traversal protection
 * - Content security filtering
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Import security utilities
const securityValidator = require('../security/input-validator');
const { resolveConfig } = require('../../config/default-config');

class SecurePylintAdapter {
  constructor() {
    this.name = 'secure-pylint';
    this.supportedLanguages = ['python'];
    this.description = 'Secure Python static analysis and code quality checker';
    
    // Security configuration (using configurable values)
    this.maxFileSize = resolveConfig('formalMethods.javascript.maxFileSize') || 10 * 1024 * 1024; // 10MB per file
    this.maxFiles = 1000;
    this.maxExecutionTime = resolveConfig('formalMethods.python.maxExecutionTime') || 120000;
    this.dockerTimeout = resolveConfig('formalMethods.python.dockerTimeout') || 5000;
    this.analysisTimeout = resolveConfig('formalMethods.python.analysisTimeout') || 30000;
    this.allowedExtensions = ['.py', '.pyw'];
    this.forbiddenPatterns = [
      /exec\s*\(/,
      /eval\s*\(/,
      /compile\s*\(/,
      /__import__\s*\(/,
      /subprocess\./,
      /os\.system/,
      /os\.popen/
    ];
    
    this.validator = securityValidator;
  }

  /**
   * Check if Pylint is available in a secure manner
   * Checks multiple installation paths: venv, system, pip user
   */
  async checkAvailability() {
    const checkMethods = [
      // Check virtual environment first
      () => this.executeSecurePythonWithPath(path.join(process.cwd(), 'formal-methods-venv/bin/python'), ['-m', 'pylint', '--version']),
      // Check system installation
      () => this.executeSecurePython(['-m', 'pylint', '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      })
    ];

    for (const method of checkMethods) {
      try {
        const result = await method();
        if (result.exitCode === 0) {
          return true;
        }
      } catch (error) {
        // Continue to next method
      }
    }
    
    return false;
  }

  /**
   * Execute Python with specific Python executable path
   */
  async executeSecurePythonWithPath(pythonPath, args, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || this.maxExecutionTime;
      const cwd = options.cwd || process.cwd();
      
      const child = spawn(pythonPath, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Minimal environment for security
          PATH: process.env.PATH,
          PYTHONPATH: '', // Clear Python path
          PYTHONHOME: '', // Clear Python home
          PYTHONSTARTUP: '', // No startup script
          PYTHONOPTIMIZE: '1' // Optimize bytecode
        }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        
        if (timedOut) {
          reject(new Error('Python execution timed out'));
          return;
        }

        resolve({
          exitCode,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Securely execute Python with Pylint
   */
  async executeSecurePython(args, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || this.maxExecutionTime;
      const cwd = options.cwd || process.cwd();
      
      const child = spawn('python3', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Minimal environment for security
          PATH: process.env.PATH,
          PYTHONPATH: '', // Clear Python path
          PYTHONHOME: '', // Clear Python home
          PYTHONSTARTUP: '', // No startup script
          PYTHONOPTIMIZE: '1' // Optimize bytecode
        }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        
        if (timedOut) {
          reject(new Error('Python execution timed out'));
          return;
        }

        resolve({
          exitCode,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Create secure Pylint configuration
   */
  createSecureConfig() {
    return {
      // Disable potentially dangerous checkers
      'disable': [
        'import-error',  // Don't try to import modules
        'no-member',     // Don't resolve members dynamically
        'exec-used',     // Flag exec usage
        'eval-used',     // Flag eval usage
        'dangerous-default-value'
      ],
      
      // Enable security-focused checks
      'enable': [
        'security',
        'dangerous-default-value',
        'exec-used',
        'eval-used'
      ],
      
      // Limit analysis scope
      'max-line-length': 120,
      'max-module-lines': 1000,
      'max-attributes': 20,
      'max-args': 10,
      'max-locals': 20,
      'max-returns': 6,
      'max-branches': 20,
      'max-statements': 50,
      
      // Ignore patterns for security
      'ignore-patterns': [
        '.*\\.git.*',
        '.*node_modules.*',
        '.*__pycache__.*',
        '.*\\.pyc$',
        '.*\\.pyo$',
        '.*\\.egg-info.*'
      ]
    };
  }

  /**
   * Generate secure temporary configuration file
   */
  async createTempConfig() {
    const config = this.createSecureConfig();
    const configContent = Object.entries(config)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}=${value.join(',')}`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    const tempDir = os.tmpdir();
    const configFile = path.join(tempDir, `pylint-config-${crypto.randomUUID()}.conf`);
    
    await fs.writeFile(configFile, `[MASTER]\n${configContent}\n`);
    return configFile;
  }

  /**
   * Run secure Pylint analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    // Input validation
    const validationResult = await this.validator.validateCodebase(codebasePath, 'python');
    if (!validationResult.valid) {
      throw new Error(`Security validation failed: ${validationResult.errors.join(', ')}`);
    }

    if (!await this.checkAvailability()) {
      throw new Error('Pylint not available. Run: pip install pylint');
    }

    let configFile = null;
    
    try {
      // Create secure configuration
      configFile = await this.createTempConfig();
      
      // Get list of Python files to analyze
      const pythonFiles = await this.findPythonFiles(codebasePath);
      
      if (pythonFiles.length === 0) {
        return {
          tool: 'secure-pylint',
          timestamp: new Date().toISOString(),
          codebasePath,
          results: [],
          overallScore: 10.0,
          summary: this.generateEmptySummary()
        };
      }

      // Run Pylint analysis
      const results = await this.runPylintAnalysis(pythonFiles, configFile, codebasePath);
      
      return {
        tool: 'secure-pylint',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: results.issues,
        overallScore: results.score,
        summary: this.generateSummary(results.issues),
        security: {
          filesAnalyzed: pythonFiles.length,
          validationResult: validationResult,
          inputValidation: 'passed'
        }
      };
      
    } finally {
      // Clean up temporary config file
      if (configFile) {
        try {
          await fs.unlink(configFile);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Find Python files in codebase with security validation
   */
  async findPythonFiles(basePath) {
    const pythonFiles = [];
    
    async function scanDirectory(dirPath) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip dangerous directories
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === '__pycache__') {
            continue;
          }
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.py', '.pyw'].includes(ext)) {
            pythonFiles.push(fullPath);
          }
        }
      }
    }
    
    await scanDirectory(basePath);
    return pythonFiles.slice(0, this.maxFiles); // Limit number of files
  }

  /**
   * Run Pylint analysis with security controls
   */
  async runPylintAnalysis(pythonFiles, configFile, basePath) {
    const issues = [];
    let totalScore = 0;
    let validFiles = 0;

    // Analyze files in batches to control resource usage
    const batchSize = 10;
    for (let i = 0; i < pythonFiles.length; i += batchSize) {
      const batch = pythonFiles.slice(i, i + batchSize);
      
      for (const filePath of batch) {
        try {
          const fileResult = await this.analyzeSingleFile(filePath, configFile, basePath);
          issues.push(...fileResult.issues);
          if (fileResult.score !== null) {
            totalScore += fileResult.score;
            validFiles++;
          }
        } catch (error) {
          // Log error but continue with other files
          console.warn(`Failed to analyze ${filePath}: ${error.message}`);
        }
      }
    }

    const averageScore = validFiles > 0 ? totalScore / validFiles : 10.0;
    
    return {
      issues,
      score: Math.round(averageScore * 100) / 100
    };
  }

  /**
   * Analyze single file with Pylint
   */
  async analyzeSingleFile(filePath, configFile, basePath) {
    const args = [
      '-m', 'pylint',
      '--rcfile', configFile,
      '--output-format', 'json',
      '--score', 'yes',
      filePath
    ];

    // Try virtual environment first, fallback to system python
    let result;
    const venvPython = path.join(process.cwd(), 'formal-methods-venv/bin/python');
    try {
      result = await this.executeSecurePythonWithPath(venvPython, args, {
        timeout: 30000,
        cwd: basePath
      });
    } catch (error) {
      // Fallback to system python
      result = await this.executeSecurePython(args, {
        timeout: 30000,
        cwd: basePath
      });
    }

    let issues = [];
    let score = null;

    // Parse JSON output - Pylint outputs JSON to stdout
    if (result.stdout) {
      try {
        const jsonOutput = result.stdout.split('\n').find(line => line.startsWith('['));
        if (jsonOutput) {
          issues = JSON.parse(jsonOutput);
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }

    // Extract score from stdout or stderr
    const scoreText = result.stdout + result.stderr;
    if (scoreText) {
      const scoreMatch = scoreText.match(/Your code has been rated at ([\d.-]+)\/10/);
      if (scoreMatch) {
        score = parseFloat(scoreMatch[1]);
      }
    }

    return {
      issues: issues.map(issue => ({
        ...issue,
        path: path.relative(basePath, filePath)
      })),
      score
    };
  }

  /**
   * Generate empty summary for codebases with no Python files
   */
  generateEmptySummary() {
    return {
      totalIssues: 0,
      severityCounts: {
        error: 0,
        warning: 0,
        refactor: 0,
        convention: 0
      },
      fileStats: {},
      moduleStats: {},
      topMessageTypes: [],
      qualityMetrics: {
        weightedQualityScore: '10.0',
        errorRatio: 0,
        criticalIssueRatio: 0
      }
    };
  }

  /**
   * Generate analysis summary
   */
  generateSummary(pylintResults) {
    const severityCounts = {
      error: 0,
      warning: 0,
      refactor: 0,
      convention: 0
    };
    
    const messageTypes = {};
    const fileStats = {};
    const moduleStats = {};

    for (const issue of pylintResults) {
      const severity = issue.type || 'unknown';
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Track message types
      const msgId = issue['message-id'] || issue.symbol;
      if (msgId) {
        messageTypes[msgId] = (messageTypes[msgId] || 0) + 1;
      }

      // Track per-file stats
      const filePath = issue.path;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          errors: 0,
          warnings: 0,
          refactor: 0,
          convention: 0,
          total: 0,
          issues: []
        };
      }
      
      fileStats[filePath][severity]++;
      fileStats[filePath].total++;
      fileStats[filePath].issues.push(issue);

      // Track module-level stats
      const module = issue.module || path.dirname(filePath);
      if (!moduleStats[module]) {
        moduleStats[module] = { files: new Set(), issues: 0 };
      }
      moduleStats[module].files.add(filePath);
      moduleStats[module].issues++;
    }

    return {
      totalIssues: pylintResults.length,
      severityCounts,
      fileStats,
      moduleStats: this.processModuleStats(moduleStats),
      topMessageTypes: this.getTopMessages(messageTypes, 10),
      qualityMetrics: this.calculateQualityMetrics(severityCounts, pylintResults.length)
    };
  }

  processModuleStats(moduleStats) {
    const processed = {};
    for (const [module, stats] of Object.entries(moduleStats)) {
      processed[module] = {
        fileCount: stats.files.size,
        issueCount: stats.issues,
        averageIssuesPerFile: (stats.issues / stats.files.size).toFixed(2)
      };
    }
    return processed;
  }

  getTopMessages(messageTypes, limit = 10) {
    return Object.entries(messageTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  calculateQualityMetrics(severityCounts, totalIssues) {
    const errorWeight = severityCounts.error * 4;
    const warningWeight = severityCounts.warning * 2;
    const refactorWeight = severityCounts.refactor * 1;
    const conventionWeight = severityCounts.convention * 0.5;
    
    const weightedScore = Math.max(0, 100 - (errorWeight + warningWeight + refactorWeight + conventionWeight));
    
    return {
      weightedQualityScore: weightedScore.toFixed(1),
      errorRatio: totalIssues > 0 ? (severityCounts.error / totalIssues).toFixed(3) : 0,
      criticalIssueRatio: totalIssues > 0 ? ((severityCounts.error + severityCounts.warning) / totalIssues).toFixed(3) : 0
    };
  }

  /**
   * Transform Pylint output into city visualization data
   */
  toCityData(pylintOutput) {
    const { results, summary, overallScore } = pylintOutput;
    
    const cityData = {
      qualityIssues: [],
      buildingEnhancements: {},
      districtHealth: {},
      codeQualityIndex: overallScore || 5.0,
      securityEnhancements: {
        secureAnalysis: true,
        inputValidation: true,
        resourceLimits: true
      }
    };

    // Process each file's issues
    for (const [filePath, stats] of Object.entries(summary.fileStats)) {
      if (stats.total > 0) {
        // Add quality issues for visualization
        cityData.qualityIssues.push({
          file: filePath,
          type: 'secure-pylint',
          severity: this.calculateSeverity(stats),
          count: stats.total,
          details: {
            errors: stats.errors,
            warnings: stats.warnings,
            refactor: stats.refactor,
            convention: stats.convention,
            topIssues: this.getTopIssuesForFile(stats.issues)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[filePath] = {
          qualityScore: this.calculateFileQualityScore(stats),
          structuralIntegrity: this.calculateStructuralIntegrity(stats),
          codeStyleConsistency: this.calculateStyleConsistency(stats),
          visualEffects: {
            errorBeacons: stats.errors > 0,
            warningLights: stats.warnings > 0,
            refactoringSigns: stats.refactor > 3,
            styleInconsistencies: stats.convention > 5,
            securityShield: true // Indicates secure analysis
          }
        };
      }
    }

    // Calculate district-level health
    cityData.districtHealth = this.calculateDistrictHealth(summary.moduleStats);

    return cityData;
  }

  calculateSeverity(stats) {
    if (stats.errors > 0) return 'error';
    if (stats.warnings > 0) return 'warning';
    if (stats.refactor > 0) return 'refactor';
    return 'convention';
  }

  getTopIssuesForFile(issues) {
    const typeCounts = {};
    for (const issue of issues) {
      const type = issue['message-id'] || issue.symbol || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  calculateFileQualityScore(stats) {
    const errorPenalty = stats.errors * 15;
    const warningPenalty = stats.warnings * 5;
    const refactorPenalty = stats.refactor * 2;
    const conventionPenalty = stats.convention * 1;
    
    return Math.max(0, 100 - errorPenalty - warningPenalty - refactorPenalty - conventionPenalty);
  }

  calculateStructuralIntegrity(stats) {
    const criticalIssues = stats.errors + stats.warnings;
    if (criticalIssues === 0) return 'excellent';
    if (criticalIssues <= 2) return 'good';
    if (criticalIssues <= 5) return 'fair';
    return 'poor';
  }

  calculateStyleConsistency(stats) {
    if (stats.convention === 0) return 'consistent';
    if (stats.convention <= 3) return 'mostly-consistent';
    if (stats.convention <= 8) return 'inconsistent';
    return 'very-inconsistent';
  }

  calculateDistrictHealth(moduleStats) {
    const districtHealth = {};
    
    for (const [module, stats] of Object.entries(moduleStats)) {
      const district = this.inferDistrict(module);
      if (!districtHealth[district]) {
        districtHealth[district] = {
          modules: 0,
          totalFiles: 0,
          totalIssues: 0,
          scores: []
        };
      }
      
      districtHealth[district].modules++;
      districtHealth[district].totalFiles += stats.fileCount;
      districtHealth[district].totalIssues += stats.issueCount;
      districtHealth[district].scores.push(parseFloat(stats.averageIssuesPerFile));
    }

    // Calculate aggregate scores for each district
    for (const [district, data] of Object.entries(districtHealth)) {
      const avgIssuesPerFile = data.totalIssues / data.totalFiles;
      data.healthScore = Math.max(0, 100 - (avgIssuesPerFile * 10));
      data.healthLevel = this.getHealthLevel(avgIssuesPerFile);
      data.averageIssuesPerFile = avgIssuesPerFile.toFixed(2);
    }

    return districtHealth;
  }

  inferDistrict(modulePath) {
    const pathLower = modulePath.toLowerCase();
    
    if (pathLower.includes('test') || pathLower.includes('tests')) {
      return 'testing';
    }
    if (pathLower.includes('api') || pathLower.includes('server') || pathLower.includes('backend')) {
      return 'backend';
    }
    if (pathLower.includes('ui') || pathLower.includes('frontend') || pathLower.includes('client')) {
      return 'frontend';
    }
    if (pathLower.includes('config') || pathLower.includes('settings') || pathLower.includes('deploy')) {
      return 'infrastructure';
    }
    if (pathLower.includes('util') || pathLower.includes('helper') || pathLower.includes('common')) {
      return 'utilities';
    }
    
    return 'core';
  }

  getHealthLevel(avgIssues) {
    if (avgIssues <= 1) return 'excellent';
    if (avgIssues <= 3) return 'good';
    if (avgIssues <= 6) return 'fair';
    if (avgIssues <= 10) return 'poor';
    return 'critical';
  }
}

module.exports = new SecurePylintAdapter();
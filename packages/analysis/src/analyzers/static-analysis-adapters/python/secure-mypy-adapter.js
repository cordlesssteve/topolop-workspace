/**
 * Secure MyPy Adapter for Topolop
 * 
 * Security-first implementation using Python subprocess with strict controls.
 * Implements type checking only with comprehensive input validation.
 * 
 * City Metaphor Mapping:
 * - Type errors → Structural instability indicators on buildings
 * - Type warnings → Construction warning signs
 * - Missing type annotations → Incomplete building blueprints
 * - Type coverage → Building construction completion percentage
 * - Complex type issues → Engineering complexity indicators
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Type checking only (no imports or execution)
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

class SecureMyPyAdapter {
  constructor() {
    this.name = 'secure-mypy';
    this.supportedLanguages = ['python'];
    this.description = 'Secure Python static type checker';
    
    // Security configuration
    this.maxFileSize = 10 * 1024 * 1024; // 10MB per file
    this.maxFiles = 1000;
    this.maxExecutionTime = 180000; // 3 minutes
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
   * Check if MyPy is available in a secure manner
   * Checks multiple installation paths: venv, system, pip user
   */
  async checkAvailability() {
    const checkMethods = [
      // Check virtual environment first
      () => this.executeSecurePythonWithPath(path.join(process.cwd(), 'formal-methods-venv/bin/python'), ['-m', 'mypy', '--version']),
      // Check system installation
      () => this.executeSecurePython(['-m', 'mypy', '--version'], {
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
   * Securely execute Python with MyPy
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
          PYTHONOPTIMIZE: '1', // Optimize bytecode
          PYTHONUNBUFFERED: '1', // Unbuffered output
          MYPYPATH: '' // Clear MyPy path
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
   * Create secure MyPy configuration
   */
  createSecureConfig() {
    return {
      // Security and performance settings
      'ignore_missing_imports': true,
      'disallow_untyped_calls': false, // Too restrictive for security analysis
      'disallow_untyped_defs': false,
      'disallow_incomplete_defs': false,
      'check_untyped_defs': true,
      'disallow_untyped_decorators': false,
      'no_implicit_optional': true,
      'warn_redundant_casts': true,
      'warn_unused_ignores': true,
      'warn_no_return': true,
      'warn_return_any': false, // Too noisy for security analysis
      'warn_unreachable': true,
      'strict_equality': true,
      
      // Performance and security limits
      'cache_dir': '/dev/null', // Disable caching for security
      'sqlite_cache': false,
      'incremental': false,
      'no_site_packages': true, // Don't look at site-packages
      'no_silence_site_packages': true,
      
      // Error reporting
      'show_error_codes': true,
      'show_column_numbers': true,
      'error_summary': false,
      'pretty': false, // Machine readable output
      'show_traceback': false, // No stack traces
      
      // Module discovery restrictions
      'namespace_packages': false,
      'explicit_package_bases': true,
      
      // File processing limits
      'follow_imports': 'skip', // Don't follow imports for security
      'follow_imports_for_stubs': false
    };
  }

  /**
   * Generate secure temporary configuration file
   */
  async createTempConfig() {
    const config = this.createSecureConfig();
    const configContent = Object.entries(config)
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return `${key} = ${value ? 'True' : 'False'}`;
        } else if (typeof value === 'string') {
          return `${key} = ${value}`;
        }
        return `${key} = ${value}`;
      })
      .join('\n');

    const fullConfig = `[mypy]\n${configContent}\n`;

    const tempDir = os.tmpdir();
    const configFile = path.join(tempDir, `mypy-config-${crypto.randomUUID()}.ini`);
    
    await fs.writeFile(configFile, fullConfig);
    return configFile;
  }

  /**
   * Run secure MyPy analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    // Input validation
    const validationResult = await this.validator.validateCodebase(codebasePath, 'python');
    if (!validationResult.valid) {
      throw new Error(`Security validation failed: ${validationResult.errors.join(', ')}`);
    }

    if (!await this.checkAvailability()) {
      throw new Error('MyPy not available. Run: pip install mypy');
    }

    let configFile = null;
    
    try {
      // Create secure configuration
      configFile = await this.createTempConfig();
      
      // Get list of Python files to analyze
      const pythonFiles = await this.findPythonFiles(codebasePath);
      
      if (pythonFiles.length === 0) {
        return {
          tool: 'secure-mypy',
          timestamp: new Date().toISOString(),
          codebasePath,
          results: [],
          typeCoverage: null,
          summary: this.generateEmptySummary()
        };
      }

      // Run MyPy analysis
      const results = await this.runMyPyAnalysis(pythonFiles, configFile, codebasePath);
      
      return {
        tool: 'secure-mypy',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: results.issues,
        typeCoverage: results.coverage,
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
              entry.name === '__pycache__' ||
              entry.name === 'venv' ||
              entry.name === 'env' ||
              entry.name === '.mypy_cache') {
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
   * Run MyPy analysis with security controls
   */
  async runMyPyAnalysis(pythonFiles, configFile, basePath) {
    // Analyze files in batches to control resource usage
    const issues = [];
    const batchSize = 20; // MyPy can handle larger batches than other tools
    
    for (let i = 0; i < pythonFiles.length; i += batchSize) {
      const batch = pythonFiles.slice(i, i + batchSize);
      
      const args = [
        '-m', 'mypy',
        '--config-file', configFile,
        '--show-error-codes',
        '--show-column-numbers',
        '--no-error-summary',
        '--ignore-missing-imports',
        ...batch
      ];

      try {
        // Try virtual environment first, fallback to system python
        let result;
        const venvPython = path.join(process.cwd(), 'formal-methods-venv/bin/python');
        try {
          result = await this.executeSecurePythonWithPath(venvPython, args, {
            timeout: 60000,
            cwd: basePath
          });
        } catch (error) {
          // Fallback to system python
          result = await this.executeSecurePython(args, {
            timeout: 60000,
            cwd: basePath
          });
        }

        // Parse MyPy output (both stdout and stderr may contain results)
        const output = result.stdout + result.stderr;
        const batchIssues = this.parseMyPyOutput(output, basePath);
        issues.push(...batchIssues);
        
      } catch (error) {
        // Log error but continue with other batches
        console.warn(`Failed to analyze batch starting at ${batch[0]}: ${error.message}`);
      }
    }

    // Try to get type coverage (optional)
    let coverage = null;
    try {
      const coverageArgs = [
        '-m', 'mypy',
        '--config-file', configFile,
        '--txt-report', '/dev/null',
        '--any-exprs-report', '/dev/null',
        basePath
      ];
      
      const coverageResult = await this.executeSecurePython(coverageArgs, {
        timeout: 30000,
        cwd: basePath
      });
      
      coverage = this.extractTypeCoverage(coverageResult.stderr);
    } catch (error) {
      // Coverage is optional
    }

    return {
      issues,
      coverage
    };
  }

  /**
   * Parse MyPy output into structured results
   */
  parseMyPyOutput(output, basePath) {
    const lines = output.split('\n').filter(line => line.trim());
    const results = [];
    
    for (const line of lines) {
      // Parse MyPy output format: file:line:col: severity: message [error-code]
      const match = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|note):\s*(.+?)(?:\s*\[([^\]]+)\])?$/);
      if (match) {
        const filePath = path.relative(basePath, match[1]);
        results.push({
          file: filePath,
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4],
          message: match[5].trim(),
          errorCode: match[6] || null
        });
      }
    }
    
    return results;
  }

  /**
   * Extract type coverage from MyPy output
   */
  extractTypeCoverage(coverageOutput) {
    // Try to extract coverage percentage from MyPy output
    const match = coverageOutput.match(/Total coverage: ([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
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
        note: 0
      },
      fileStats: {},
      topErrorCodes: [],
      typeIssueCategories: {},
      typeQualityMetrics: {
        typeQualityScore: '100.0',
        errorRatio: 0,
        typeStability: 'excellent'
      },
      complexityIndicators: []
    };
  }

  /**
   * Generate analysis summary
   */
  generateSummary(mypyResults) {
    const severityCounts = {
      error: 0,
      warning: 0,
      note: 0
    };
    
    const errorCodes = {};
    const fileStats = {};
    const typeIssueCategories = {};

    for (const issue of mypyResults) {
      // Count by severity
      const severity = issue.severity;
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Track error codes
      const errorCode = issue.errorCode;
      if (errorCode) {
        errorCodes[errorCode] = (errorCodes[errorCode] || 0) + 1;
        
        // Categorize type issues
        const category = this.categorizeTypeIssue(errorCode);
        typeIssueCategories[category] = (typeIssueCategories[category] || 0) + 1;
      }

      // Track per-file stats
      const filePath = issue.file;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          errors: 0,
          warnings: 0,
          notes: 0,
          total: 0,
          issues: [],
          uniqueErrorCodes: new Set()
        };
      }
      
      fileStats[filePath][severity]++;
      fileStats[filePath].total++;
      fileStats[filePath].issues.push(issue);
      if (errorCode) {
        fileStats[filePath].uniqueErrorCodes.add(errorCode);
      }
    }

    // Convert Sets to arrays for serialization
    for (const stats of Object.values(fileStats)) {
      stats.uniqueErrorCodes = Array.from(stats.uniqueErrorCodes);
    }

    return {
      totalIssues: mypyResults.length,
      severityCounts,
      fileStats,
      topErrorCodes: this.getTopErrorCodes(errorCodes, 10),
      typeIssueCategories,
      typeQualityMetrics: this.calculateTypeQualityMetrics(severityCounts, mypyResults.length),
      complexityIndicators: this.calculateComplexityIndicators(fileStats)
    };
  }

  categorizeTypeIssue(errorCode) {
    const typeCategories = {
      'annotation': ['annotation-unchecked', 'type-abstract', 'misc'],
      'incompatible': ['assignment', 'return-value', 'argument'],
      'undefined': ['name-defined', 'attr-defined', 'has-type'],
      'import': ['import', 'no-redef'],
      'generic': ['type-arg', 'valid-type'],
      'union': ['union-attr', 'operator'],
      'callable': ['call-overload', 'call-arg'],
      'override': ['override', 'method-override']
    };
    
    for (const [category, codes] of Object.entries(typeCategories)) {
      if (codes.some(code => errorCode.includes(code))) {
        return category;
      }
    }
    
    return 'other';
  }

  getTopErrorCodes(errorCodes, limit = 10) {
    return Object.entries(errorCodes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([code, count]) => ({ code, count }));
  }

  calculateTypeQualityMetrics(severityCounts, totalIssues) {
    const errorWeight = severityCounts.error * 3;
    const warningWeight = severityCounts.warning * 1;
    const noteWeight = severityCounts.note * 0.5;
    
    const typeScore = Math.max(0, 100 - (errorWeight + warningWeight + noteWeight));
    
    return {
      typeQualityScore: typeScore.toFixed(1),
      errorRatio: totalIssues > 0 ? (severityCounts.error / totalIssues).toFixed(3) : 0,
      typeStability: this.calculateTypeStability(severityCounts)
    };
  }

  calculateTypeStability(severityCounts) {
    const totalIssues = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    if (totalIssues === 0) return 'excellent';
    
    const errorRatio = severityCounts.error / totalIssues;
    if (errorRatio > 0.7) return 'unstable';
    if (errorRatio > 0.3) return 'fragile';
    if (errorRatio > 0.1) return 'stable';
    return 'robust';
  }

  calculateComplexityIndicators(fileStats) {
    const complexityScores = [];
    
    for (const [file, stats] of Object.entries(fileStats)) {
      const complexity = stats.uniqueErrorCodes.length + (stats.errors * 2) + stats.warnings;
      complexityScores.push({ file, complexity, issues: stats.total });
    }
    
    // Sort by complexity and return top 5
    return complexityScores
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5);
  }

  /**
   * Transform MyPy output into city visualization data
   */
  toCityData(mypyOutput) {
    const { results, summary, typeCoverage } = mypyOutput;
    
    const cityData = {
      typeIssues: [],
      buildingEnhancements: {},
      districtTypeHealth: {},
      overallTypeCoverage: typeCoverage || 0,
      securityEnhancements: {
        secureAnalysis: true,
        typeCheckingOnly: true,
        inputValidation: true,
        resourceLimits: true
      }
    };

    // Process each file's type issues
    for (const [filePath, stats] of Object.entries(summary.fileStats)) {
      if (stats.total > 0) {
        // Add type issues for visualization
        cityData.typeIssues.push({
          file: filePath,
          type: 'secure-mypy',
          severity: this.calculateTypeSeverity(stats),
          count: stats.total,
          details: {
            errors: stats.errors,
            warnings: stats.warnings,
            notes: stats.notes,
            errorCodeVariety: stats.uniqueErrorCodes.length,
            topErrorCodes: stats.uniqueErrorCodes.slice(0, 3)
          }
        });

        // Building type enhancement data
        cityData.buildingEnhancements[filePath] = {
          typeStability: this.calculateFileTypeStability(stats),
          constructionQuality: this.calculateConstructionQuality(stats),
          blueprintCompleteness: this.calculateBlueprintCompleteness(stats),
          engineeringComplexity: this.calculateEngineeringComplexity(stats),
          visualEffects: {
            structuralWarnings: stats.errors > 0,
            constructionSigns: stats.warnings > 0,
            blueprintGaps: stats.notes > 2,
            engineeringComplexity: stats.uniqueErrorCodes.length > 3,
            stabilityIndicators: this.getStabilityIndicators(stats),
            securityShield: true // Indicates secure analysis
          }
        };
      }
    }

    // Calculate district-level type health
    cityData.districtTypeHealth = this.calculateDistrictTypeHealth(cityData.typeIssues);

    return cityData;
  }

  calculateTypeSeverity(stats) {
    if (stats.errors > 0) return 'error';
    if (stats.warnings > 0) return 'warning';
    return 'note';
  }

  calculateFileTypeStability(stats) {
    const totalIssues = stats.total;
    if (totalIssues === 0) return 'excellent';
    
    const errorRatio = stats.errors / totalIssues;
    if (errorRatio > 0.6) return 'unstable';
    if (errorRatio > 0.3) return 'fragile';
    if (errorRatio > 0.1) return 'stable';
    return 'robust';
  }

  calculateConstructionQuality(stats) {
    const score = Math.max(0, 100 - (stats.errors * 10 + stats.warnings * 3 + stats.notes * 1));
    
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  calculateBlueprintCompleteness(stats) {
    // Higher notes often indicate missing type annotations
    if (stats.notes === 0 && stats.errors === 0) return 'complete';
    if (stats.notes <= 2) return 'mostly-complete';
    if (stats.notes <= 5) return 'incomplete';
    return 'very-incomplete';
  }

  calculateEngineeringComplexity(stats) {
    const complexity = stats.uniqueErrorCodes.length;
    if (complexity === 0) return 'simple';
    if (complexity <= 2) return 'moderate';
    if (complexity <= 5) return 'complex';
    return 'very-complex';
  }

  getStabilityIndicators(stats) {
    const indicators = [];
    
    if (stats.errors === 0) indicators.push('no-structural-issues');
    if (stats.warnings <= 1) indicators.push('minimal-warnings');
    if (stats.uniqueErrorCodes.length <= 2) indicators.push('simple-type-structure');
    if (stats.total <= 3) indicators.push('good-type-quality');
    
    return indicators;
  }

  calculateDistrictTypeHealth(typeIssues) {
    const districtStats = {};
    
    for (const issue of typeIssues) {
      const district = this.inferDistrict(issue.file);
      if (!districtStats[district]) {
        districtStats[district] = {
          files: 0,
          totalIssues: 0,
          typeErrors: 0,
          typeWarnings: 0,
          typeNotes: 0
        };
      }
      
      districtStats[district].files++;
      districtStats[district].totalIssues += issue.count;
      districtStats[district].typeErrors += issue.details.errors;
      districtStats[district].typeWarnings += issue.details.warnings;
      districtStats[district].typeNotes += issue.details.notes;
    }

    // Calculate type health scores for each district
    const districtTypeHealth = {};
    for (const [district, stats] of Object.entries(districtStats)) {
      const typeScore = Math.max(0, 100 - (
        stats.typeErrors * 10 + 
        stats.typeWarnings * 3 + 
        stats.typeNotes * 1
      ) / stats.files);
      
      districtTypeHealth[district] = {
        typeHealthScore: typeScore.toFixed(1),
        typeStability: this.getDistrictTypeStability(stats),
        files: stats.files,
        totalIssues: stats.totalIssues,
        errorRate: (stats.typeErrors / stats.files).toFixed(2),
        averageIssuesPerFile: (stats.totalIssues / stats.files).toFixed(1)
      };
    }

    return districtTypeHealth;
  }

  inferDistrict(filePath) {
    const pathLower = filePath.toLowerCase();
    
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
    if (pathLower.includes('model') || pathLower.includes('data') || pathLower.includes('db')) {
      return 'data';
    }
    
    return 'core';
  }

  getDistrictTypeStability(stats) {
    const errorRate = stats.typeErrors / stats.files;
    if (errorRate === 0) return 'excellent';
    if (errorRate <= 1) return 'stable';
    if (errorRate <= 3) return 'moderate';
    if (errorRate <= 5) return 'fragile';
    return 'unstable';
  }
}

module.exports = new SecureMyPyAdapter();
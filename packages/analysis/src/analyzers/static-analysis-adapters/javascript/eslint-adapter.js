/**
 * Secure ESLint Adapter for Topolop
 * 
 * Transforms ESLint static analysis output into city visualization data.
 * SECURITY: Uses direct AST parsing only - no plugin execution or config loading
 * 
 * City Metaphor Mapping:
 * - ESLint errors → Red warning indicators on buildings
 * - ESLint warnings → Orange caution signs  
 * - Rule violations → Building "code smell" intensity
 * - Severity levels → Building color saturation
 */

const fs = require('fs');
const path = require('path');
const { resolveConfig } = require('../../config/default-config');

// Import ESLint components directly for safe usage
let ESLint, Linter;
try {
  // Try to import ESLint if available
  const eslintModule = require('eslint');
  ESLint = eslintModule.ESLint;
  Linter = eslintModule.Linter;
} catch (error) {
  // ESLint not available - will be handled in checkAvailability
  ESLint = null;
  Linter = null;
}

class SecureESLintAdapter {
  constructor() {
    this.name = 'eslint';
    this.supportedLanguages = ['javascript'];
    this.description = 'Secure JavaScript/TypeScript static analysis and linting (AST-only)';
    this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
    this.maxFiles = 1000;
    this.allowedExtensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx'];
    this.secureConfig = this.createSecureConfig();
  }

  /**
   * Check if ESLint is available (library mode only)
   */
  async checkAvailability() {
    return ESLint !== null && Linter !== null;
  }

  /**
   * Create secure ESLint configuration (no plugins, hardcoded rules)
   */
  createSecureConfig() {
    return {
      rules: {
        // Security-focused rules
        'no-eval': 'error',
        'no-implied-eval': 'error', 
        'no-new-func': 'error',
        'no-script-url': 'error',
        'no-proto': 'error',
        'no-iterator': 'error',
        'no-with': 'error',
        
        // Code quality rules
        'no-unused-vars': 'error',
        'no-undef': 'error',
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-alert': 'warn',
        'no-unreachable': 'error',
        'no-duplicate-case': 'error',
        'no-empty': 'error',
        'no-extra-semi': 'error',
        'no-func-assign': 'error',
        'no-invalid-regexp': 'error',
        'no-irregular-whitespace': 'error',
        'no-obj-calls': 'error',
        'no-sparse-arrays': 'error',
        'use-isnan': 'error',
        'valid-typeof': 'error',
        
        // Best practices
        'curly': 'error',
        'eqeqeq': 'error',
        'no-caller': 'error',
        'no-else-return': 'warn',
        'no-eq-null': 'error',
        'no-floating-decimal': 'error',
        'no-self-compare': 'error',
        'no-throw-literal': 'error',
        'no-unused-expressions': 'error',
        'radix': 'error',
        'wrap-iife': 'error'
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          globalReturn: false,
          impliedStrict: true
        }
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
        commonjs: true
      }
    };
  }

  /**
   * Run secure ESLint analysis using direct API (no external execution)
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('ESLint not available. Run: npm install eslint');
    }

    try {
      // Find JavaScript files to analyze
      const filesToAnalyze = await this.findJavaScriptFiles(codebasePath);
      
      if (filesToAnalyze.length === 0) {
        return {
          tool: 'eslint',
          timestamp: new Date().toISOString(),
          codebasePath,
          results: [],
          summary: this.generateSummary([])
        };
      }

      // Validate files before analysis
      const validatedFiles = this.validateFiles(filesToAnalyze);
      
      // Create ESLint instance with secure configuration
      const eslint = new ESLint({
        baseConfig: this.secureConfig,
        useEslintrc: false,
        allowInlineConfig: false,
        ignore: true,
        ignorePath: null,
        extensions: this.allowedExtensions
      });
      
      // Analyze files using ESLint API
      const results = await eslint.lintFiles(validatedFiles);
      
      // Sanitize results
      const sanitizedResults = this.sanitizeResults(results);
      
      return {
        tool: 'eslint',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: sanitizedResults,
        summary: this.generateSummary(sanitizedResults)
      };
      
    } catch (error) {
      throw new Error(`Secure ESLint analysis failed: ${error.message}`);
    }
  }

  /**
   * Find JavaScript files in the codebase with security validation
   */
  async findJavaScriptFiles(codebasePath) {
    const files = [];
    const maxDepth = 10; // Prevent infinite recursion
    
    const walkDirectory = async (dir, depth = 0) => {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Security: validate path
          if (!this.isSecurePath(fullPath, codebasePath)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Skip common directories that shouldn't be analyzed
            if (this.shouldSkipDirectory(entry.name)) {
              continue;
            }
            await walkDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (this.allowedExtensions.includes(ext)) {
              // Validate file size
              const stats = await fs.promises.stat(fullPath);
              if (stats.size <= this.maxFileSize) {
                files.push(fullPath);
                
                // Security: limit total number of files
                if (files.length >= this.maxFiles) {
                  return files;
                }
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.warn(`Skipping directory ${dir}: ${error.message}`);
      }
    };
    
    await walkDirectory(codebasePath);
    return files;
  }

  /**
   * Validate that a path is secure (no directory traversal)
   */
  isSecurePath(filePath, basePath) {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(basePath);
    
    // Ensure path is within the base directory
    return resolvedPath.startsWith(resolvedBase);
  }

  /**
   * Check if directory should be skipped for security/performance
   */
  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      '__pycache__',
      '.pytest_cache',
      'coverage',
      '.nyc_output',
      'dist',
      'build',
      'target',
      'bin',
      'obj',
      '.idea',
      '.vscode'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Validate files before analysis
   */
  validateFiles(files) {
    return files.filter(file => {
      try {
        // Check file extension
        const ext = path.extname(file).toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
          return false;
        }
        
        // Additional security checks could go here
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * Sanitize ESLint results to prevent injection attacks
   */
  sanitizeResults(results) {
    return results.map(result => ({
      filePath: this.sanitizeString(result.filePath),
      messages: result.messages.map(message => ({
        ruleId: this.sanitizeString(message.ruleId || ''),
        severity: Math.max(0, Math.min(2, parseInt(message.severity) || 0)),
        message: this.sanitizeString(message.message || ''),
        line: Math.max(0, parseInt(message.line) || 0),
        column: Math.max(0, parseInt(message.column) || 0),
        nodeType: this.sanitizeString(message.nodeType || ''),
        source: this.sanitizeString(message.source || '').substring(0, 200) // Limit source length
      })),
      errorCount: Math.max(0, parseInt(result.errorCount) || 0),
      warningCount: Math.max(0, parseInt(result.warningCount) || 0),
      fixableErrorCount: Math.max(0, parseInt(result.fixableErrorCount) || 0),
      fixableWarningCount: Math.max(0, parseInt(result.fixableWarningCount) || 0)
    }));
  }

  /**
   * Sanitize string to prevent injection
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    
    return str
      .replace(/[<>"'&]/g, '') // Remove potential HTML/JS injection chars
      .replace(/\x00/g, '')    // Remove null bytes
      .trim()
      .substring(0, 1000);     // Limit length
  }

  /**
   * Generate analysis summary
   */
  generateSummary(eslintResults) {
    let totalErrors = 0;
    let totalWarnings = 0;
    let filesWithIssues = 0;
    const ruleViolations = {};
    const fileStats = {};

    for (const fileResult of eslintResults) {
      const errorCount = fileResult.errorCount || 0;
      const warningCount = fileResult.warningCount || 0;
      
      totalErrors += errorCount;
      totalWarnings += warningCount;
      
      if (errorCount > 0 || warningCount > 0) {
        filesWithIssues++;
      }

      // Track per-file stats
      fileStats[fileResult.filePath] = {
        errors: errorCount,
        warnings: warningCount,
        total: errorCount + warningCount,
        messages: fileResult.messages || []
      };

      // Track rule violations
      for (const message of fileResult.messages || []) {
        if (message.ruleId) {
          ruleViolations[message.ruleId] = (ruleViolations[message.ruleId] || 0) + 1;
        }
      }
    }

    return {
      totalFiles: eslintResults.length,
      filesWithIssues,
      totalErrors,
      totalWarnings,
      totalIssues: totalErrors + totalWarnings,
      ruleViolations,
      fileStats,
      topViolatedRules: this.getTopRules(ruleViolations, 10)
    };
  }

  getTopRules(ruleViolations, limit = 10) {
    return Object.entries(ruleViolations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([rule, count]) => ({ rule, count }));
  }

  /**
   * Transform ESLint output into city visualization data
   */
  toCityData(eslintOutput) {
    const { results, summary } = eslintOutput;
    
    const cityData = {
      qualityIssues: [],
      buildingEnhancements: {},
      districtHealth: {},
      codeSmellIntensity: {}
    };

    // Process each file result
    for (const fileResult of results) {
      const filePath = this.normalizeFilePath(fileResult.filePath, eslintOutput.codebasePath);
      const stats = summary.fileStats[fileResult.filePath];
      
      if (stats.total > 0) {
        // Add quality issues for visualization
        cityData.qualityIssues.push({
          file: filePath,
          type: 'eslint',
          severity: stats.errors > 0 ? 'error' : 'warning',
          count: stats.total,
          details: {
            errors: stats.errors,
            warnings: stats.warnings,
            topIssues: this.getTopIssuesForFile(stats.messages)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[filePath] = {
          qualityScore: this.calculateQualityScore(stats),
          issueIntensity: Math.min(stats.total / 10, 1), // 0-1 scale
          errorLevel: stats.errors > 0 ? 'high' : stats.warnings > 0 ? 'medium' : 'low',
          visualEffects: {
            warningFlags: stats.warnings > 5,
            errorBeacons: stats.errors > 0,
            codeSmellHaze: stats.total > 15
          }
        };

        // Code smell intensity (for building colors/effects)
        cityData.codeSmellIntensity[filePath] = {
          intensity: Math.min(stats.total / 20, 1),
          category: this.categorizeCodeSmell(stats),
          dominantRules: this.getDominantRulesForFile(stats.messages)
        };
      }
    }

    // Calculate district-level health
    cityData.districtHealth = this.calculateDistrictHealth(cityData.qualityIssues);

    return cityData;
  }

  normalizeFilePath(fullPath, basePath) {
    return path.relative(basePath, fullPath);
  }

  getTopIssuesForFile(messages) {
    const ruleCounts = {};
    for (const message of messages) {
      if (message.ruleId) {
        ruleCounts[message.ruleId] = (ruleCounts[message.ruleId] || 0) + 1;
      }
    }
    
    return Object.entries(ruleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([rule, count]) => ({ rule, count }));
  }

  calculateQualityScore(stats) {
    // Quality score from 0-100 (higher is better)
    const errorPenalty = stats.errors * 10;
    const warningPenalty = stats.warnings * 2;
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }

  categorizeCodeSmell(stats) {
    if (stats.errors > 5) return 'severe';
    if (stats.errors > 0 || stats.warnings > 10) return 'moderate';
    if (stats.warnings > 0) return 'mild';
    return 'clean';
  }

  getDominantRulesForFile(messages) {
    const ruleCounts = {};
    for (const message of messages) {
      if (message.ruleId) {
        ruleCounts[message.ruleId] = (ruleCounts[message.ruleId] || 0) + 1;
      }
    }
    
    return Object.entries(ruleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([rule]) => rule);
  }

  calculateDistrictHealth(qualityIssues) {
    const districtStats = {};
    
    for (const issue of qualityIssues) {
      const district = this.inferDistrict(issue.file);
      if (!districtStats[district]) {
        districtStats[district] = { files: 0, issues: 0, errors: 0 };
      }
      
      districtStats[district].files++;
      districtStats[district].issues += issue.count;
      districtStats[district].errors += issue.details.errors;
    }

    // Calculate health scores for each district
    const districtHealth = {};
    for (const [district, stats] of Object.entries(districtStats)) {
      const avgIssuesPerFile = stats.issues / stats.files;
      const errorRatio = stats.errors / stats.issues;
      
      // Health score (0-100, higher is better)
      districtHealth[district] = {
        score: Math.max(0, 100 - (avgIssuesPerFile * 5) - (errorRatio * 20)),
        files: stats.files,
        issues: stats.issues,
        errors: stats.errors,
        level: this.getHealthLevel(avgIssuesPerFile, errorRatio)
      };
    }

    return districtHealth;
  }

  inferDistrict(filePath) {
    const pathParts = filePath.split(path.sep);
    
    if (pathParts.includes('test') || pathParts.includes('tests') || filePath.includes('.test.')) {
      return 'testing';
    }
    if (pathParts.includes('src') || pathParts.includes('lib')) {
      return 'core';
    }
    if (pathParts.includes('components') || pathParts.includes('ui')) {
      return 'frontend';
    }
    if (pathParts.includes('api') || pathParts.includes('server')) {
      return 'backend';
    }
    if (pathParts.includes('config') || pathParts.includes('scripts')) {
      return 'infrastructure';
    }
    
    return 'misc';
  }

  getHealthLevel(avgIssues, errorRatio) {
    if (errorRatio > 0.3 || avgIssues > 15) return 'critical';
    if (errorRatio > 0.1 || avgIssues > 8) return 'poor';
    if (avgIssues > 3) return 'fair';
    return 'good';
  }
}

module.exports = new SecureESLintAdapter();
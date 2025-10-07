const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

/**
 * Semgrep CLI Client
 * 
 * Handles execution of Semgrep CLI commands and JSON parsing.
 * Supports security analysis with custom and registry rules.
 */
class SemgrepClient {
  constructor(config = {}) {
    this.semgrepPath = config.semgrepPath || 'semgrep';
    this.timeout = config.timeout || 120000; // 2 minutes default
    this.maxBuffer = config.maxBuffer || 1024 * 1024 * 10; // 10MB buffer
    
    console.log('🔍 Semgrep Client initialized');
    console.log(`   📍 Semgrep path: ${this.semgrepPath}`);
  }

  /**
   * Test if Semgrep is available and get version info
   */
  async testConnection() {
    try {
      const { stdout } = await execAsync(`${this.semgrepPath} --version`, {
        timeout: 10000,
        maxBuffer: this.maxBuffer
      });
      
      const version = stdout.trim();
      console.log(`✅ Semgrep available: ${version}`);
      
      return {
        success: true,
        version: version,
        semgrepPath: this.semgrepPath
      };
    } catch (error) {
      console.error('❌ Semgrep not available:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run Semgrep analysis on a directory or file
   */
  async analyze(targetPath, options = {}) {
    console.log(`🔍 Running Semgrep analysis on: ${targetPath}`);
    
    const args = this._buildAnalysisArgs(targetPath, options);
    
    try {
      const { stdout, stderr } = await execAsync(`${this.semgrepPath} ${args.join(' ')}`, {
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        cwd: options.workingDirectory || process.cwd()
      });

      let results;
      try {
        results = JSON.parse(stdout);
      } catch (parseError) {
        throw new Error(`Failed to parse Semgrep JSON output: ${parseError.message}`);
      }

      console.log(`✅ Semgrep analysis complete:`);
      console.log(`   📊 Findings: ${results.results?.length || 0}`);
      console.log(`   📋 Rules run: ${results.paths?.scanned?.length || 'unknown'}`);

      return {
        results: results.results || [],
        errors: results.errors || [],
        paths: results.paths || {},
        version: results.version,
        metadata: {
          analyzedAt: new Date().toISOString(),
          targetPath: targetPath,
          rulesUsed: options.config || options.rules || 'auto',
          executionTime: results.time || 0
        }
      };
    } catch (error) {
      console.error(`❌ Semgrep analysis failed: ${error.message}`);
      throw new Error(`Semgrep analysis failed: ${error.message}`);
    }
  }

  /**
   * Run Semgrep with custom rules file
   */
  async analyzeWithRules(targetPath, rulesPath, options = {}) {
    return await this.analyze(targetPath, {
      ...options,
      rules: rulesPath
    });
  }

  /**
   * Run Semgrep with registry rules (e.g., p/owasp-top-10)
   */
  async analyzeWithRegistry(targetPath, registryRules, options = {}) {
    return await this.analyze(targetPath, {
      ...options,
      config: registryRules
    });
  }

  /**
   * Run security-focused analysis using OWASP and security rulesets
   */
  async securityAnalysis(targetPath, options = {}) {
    return await this.analyzeWithRegistry(targetPath, 'p/security-audit', {
      ...options,
      severity: options.severity || ['ERROR', 'WARNING']
    });
  }

  /**
   * Get list of available registry rulesets
   */
  async getRegistryRulesets() {
    try {
      const { stdout } = await execAsync(`${this.semgrepPath} --help`, {
        timeout: 10000,
        maxBuffer: this.maxBuffer
      });

      // Parse help output for registry information
      // This is a placeholder - Semgrep doesn't have a direct API for this
      return {
        security: ['p/security-audit', 'p/owasp-top-10', 'p/cwe-top-25'],
        quality: ['p/code-quality', 'p/maintainability'],
        performance: ['p/performance'],
        custom: []
      };
    } catch (error) {
      console.error('❌ Failed to get registry rulesets:', error.message);
      return {
        security: ['p/security-audit'],
        quality: [],
        performance: [],
        custom: []
      };
    }
  }

  /**
   * Validate that target path exists and is accessible
   */
  async validateTarget(targetPath) {
    try {
      const stats = await fs.stat(targetPath);
      return {
        valid: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        path: path.resolve(targetPath)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get Semgrep configuration status
   */
  getConfigurationStatus() {
    return {
      configured: true, // Semgrep doesn't require special config like API tokens
      semgrepPath: this.semgrepPath,
      requirements: [
        {
          type: 'binary',
          name: 'semgrep',
          description: 'Semgrep CLI tool must be installed and available in PATH',
          required: true
        }
      ]
    };
  }

  /**
   * Build command line arguments for Semgrep analysis
   */
  _buildAnalysisArgs(targetPath, options = {}) {
    const args = [];

    // Output format
    args.push('--json');

    // Rules/Config
    if (options.config) {
      args.push('--config', options.config);
    } else if (options.rules) {
      args.push('--config', options.rules);
    } else {
      args.push('--config', 'auto'); // Use default rules
    }

    // Severity filtering
    if (options.severity && Array.isArray(options.severity)) {
      options.severity.forEach(sev => {
        args.push('--severity', sev);
      });
    }

    // Exclude patterns
    if (options.exclude && Array.isArray(options.exclude)) {
      options.exclude.forEach(pattern => {
        args.push('--exclude', pattern);
      });
    }

    // Language filtering
    if (options.lang && Array.isArray(options.lang)) {
      args.push('--lang', options.lang.join(','));
    }

    // Performance options
    if (options.jobs) {
      args.push('--jobs', options.jobs.toString());
    }

    // Disable metrics collection for privacy
    args.push('--disable-version-check');
    args.push('--quiet');

    // Target path (must be last)
    args.push(targetPath);

    return args;
  }
}

module.exports = SemgrepClient;